// modules/interaction.js
// 职责：处理用户输入事件，并管理交互状态。

import * as THREE from 'three';
import { scene, camera, renderer, sphere, globeAssembly } from './scene.js';
import { geoFeatures, extraData, bordersGroup, fillsGroup, fillCache } from './data.js';
import { convertVec3ToLatLon, buildCountryFillGroup } from './geography.js';
import { findCountryAt } from './hit-test.js';
import { AppConfig } from './config.js';

function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

const CONTINENT_TRANSLATIONS = {
    'North America': '北美洲', 'South America': '南美洲', 'Europe': '欧洲', 'Asia': '亚洲',
    'Africa': '非洲', 'Oceania': '大洋洲', 'Antarctica': '南极洲'
};

let infoPanel, infoCountryName, infoBody;
let idlIndicatorLeft, idlIndicatorRight;

export let hoveredCountry = null;
export let lockedCountry = null;

const raycaster = new THREE.Raycaster();
let selectedCode = null;
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
let isIdlHovered = false;

const COUNTRY_TZ_OVERRIDE = {
  CHN: 'Asia/Shanghai', IND: 'Asia/Kolkata', IRN: 'Asia/Tehran',
  AFG: 'Asia/Kabul', NPL: 'Asia/Kathmandu', MMR: 'Asia/Yangon'
};

const throttledPointerMove = throttle(onPointerMove, AppConfig.OPTIMIZATION.INTERACTION_THROTTLE_MS);

export function initInteraction() {
  infoPanel = document.getElementById('info-panel');
  infoCountryName = document.getElementById('info-country-name');
  infoBody = document.getElementById('info-body');
  idlIndicatorLeft = document.getElementById('idl-indicator-left');
  idlIndicatorRight = document.getElementById('idl-indicator-right');

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', throttledPointerMove);
}

function getCorrectedHitPoint(hit) {
    const pointInWorld = hit.point.clone();
    const inverseMatrix = new THREE.Matrix4();
    inverseMatrix.copy(globeAssembly.matrixWorld).invert();
    const pointInLocal = pointInWorld.applyMatrix4(inverseMatrix);
    return pointInLocal;
}

function onPointerDown(e) {
  globeAssembly.updateMatrixWorld(true);

  const { x, y } = clientToNDC(e.clientX, e.clientY);
  raycaster.setFromCamera({ x, y }, camera);

  // ★ 核心修复：使用更可靠的、遍历整个场景的射线检测方法
  const hits = raycaster.intersectObjects(scene.children, true);
  // 在所有被击中的对象里，找到我们的地球 (sphere)
  const hit = hits.find(h => h.object === sphere);

  if (!hit) {
    hideInfoPanel();
    return;
  }

  const correctedPoint = getCorrectedHitPoint(hit);
  const { lat, lon } = convertVec3ToLatLon(correctedPoint);

  const feature = findCountryAt(lat, lon);
  if (feature) {
    showInfoPanel(feature.properties, lat, lon);
  } else {
    hideInfoPanel();
  }
}

function onPointerMove(e) {
  globeAssembly.updateMatrixWorld(true);

  if (isTouchDevice) return;
  const { x, y } = clientToNDC(e.clientX, e.clientY);
  raycaster.setFromCamera({ x, y }, camera);

  // ★ 核心修复：同样在这里使用更可靠的检测方法
  const hits = raycaster.intersectObjects(scene.children, true);
  const hit = hits.find(h => h.object === sphere);

  if (hit) {
    const correctedPoint = getCorrectedHitPoint(hit);
    const { lat, lon } = convertVec3ToLatLon(correctedPoint);
    hoveredCountry = findCountryAt(lat, lon);
  } else {
    hoveredCountry = null;
  }

  const idlLine = scene.getObjectByName('interactive_idl_line');
  if (idlLine && checkHoverOnIdl(hits)) { // ★ 传递 hits 结果以优化
    if (!isIdlHovered) {
      isIdlHovered = true;
      updateIdlIndicators(true, window.currentLanguage || 'en');
    }
  } else {
    if (isIdlHovered) {
      isIdlHovered = false;
      updateIdlIndicators(false, window.currentLanguage || 'en');
    }
  }
}

export function formatDateTime(tz, date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const time = date.toLocaleString('en-US', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true
    });
    return `${year}/${month}/${day} ${time}`;
  } catch (e) { return 'Invalid Timezone Data'; }
}

export function getTimezoneFor(lat, lon, iso3) {
  try {
    if (iso3 && COUNTRY_TZ_OVERRIDE[iso3]) return COUNTRY_TZ_OVERRIDE[iso3];
    if (typeof window.tzlookup === 'function') { const tz = window.tzlookup(lat, lon); if (tz) return tz; }
  } catch (e) { console.warn('[tz] lookup error:', e); }
  return 'UTC';
}

// ★ 优化：接收 hits 数组，避免重复射线检测
function checkHoverOnIdl(hits) {
    const hit = hits.find(h => h.object === sphere);
    if (!hit) return false;
    const idlLine = scene.getObjectByName('interactive_idl_line');
    const hitPoint = hit.point;
    const positions = idlLine.geometry.attributes.position.array;
    const thresholdSq = 0.2 * 0.2;
    for (let i = 0; i < positions.length; i += 3) {
        const p = new THREE.Vector3(positions[i], positions[i+1], positions[i+2]);
        if (p.distanceToSquared(hitPoint) < thresholdSq) return true;
    }
    return false;
}

export function updateIdlIndicators(visible, lang) {
  if (!idlIndicatorLeft || !idlIndicatorRight) return;
  if (visible) {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const earlierText = lang === 'zh' ? '前一天' : 'Earlier Day';
    const laterText = lang === 'zh' ? '后一天' : 'Later Day';
    idlIndicatorLeft.textContent = `◀ ${yesterday.toLocaleDateString(locale, options)} (${earlierText})`;
    idlIndicatorRight.textContent = `${today.toLocaleDateString(locale, options)} (${laterText}) ▶`;
    idlIndicatorLeft.classList.add('visible');
    idlIndicatorRight.classList.add('visible');
  } else {
    idlIndicatorLeft.classList.remove('visible');
    idlIndicatorRight.classList.remove('visible');
  }
}

function setSelectedCountryByCode(code) {
  if (selectedCode === code) return;
  if (selectedCode) {
    bordersGroup.children.forEach(line => {
      if (line.userData.countryCode === selectedCode) line.material.color.set(0xffffff);
    });
  }
  selectedCode = code || null;
  if (selectedCode) {
    bordersGroup.children.forEach(line => {
      if (line.userData.countryCode === selectedCode) line.material.color.set(0xffff00);
    });
  }
  updateCountryFill(selectedCode);
}

function updateCountryFill(code) {
  fillsGroup.clear();
  if (!code) return;
  let grp = fillCache.get(code);
  if (!grp) {
    const feature = geoFeatures.find(f => (f.properties.ADM0_A3 || f.properties.ISO_A3) === code);
    if (!feature) return;
    grp = buildCountryFillGroup(feature);
    fillCache.set(code, grp);
  }
  fillsGroup.add(grp);
}

export function showInfoPanel(data, clickedLat, clickedLon) {
  const code = data.ADM0_A3 || data.ISO_A3;
  setSelectedCountryByCode(code);
  lockedCountry = {
      properties: data, lat: clickedLat, lon: clickedLon,
  };
  updateInfoPanelContent();
  infoPanel.classList.add('visible');
}

export function updateInfoPanelContent() {
    if (!lockedCountry) return;
    const data = lockedCountry.properties;
    const code = data.ADM0_A3 || data.ISO_A3;
    const lang = window.currentLanguage || 'en';
    const extra = extraData[code] || {};
    const name = lang === 'zh' ? (extra.NAME_ZH || data.NAME_ZH || data.NAME_EN) : (data.NAME_EN || data.NAME);
    const capital = lang === 'zh' ? (extra.CAPITAL_ZH || extra.CAPITAL_EN) : (extra.CAPITAL_EN);
    const pop = extra.POPULATION ? Number(extra.POPULATION).toLocaleString('en-US') : 'N/A';
    const areaUnit = lang === 'zh' ? '平方公里' : 'km²';
    const area = extra.AREA_KM2 ? `${Number(extra.AREA_KM2).toLocaleString('en-US')} ${areaUnit}` : 'N/A';
    const gdpUnit = lang === 'zh' ? '万亿美元' : 'Trillion USD';
    const gdp = extra.GDP_USD_TRILLION ? `${extra.GDP_USD_TRILLION} ${gdpUnit}` : 'N/A';
    const continentEN = data.CONTINENT;
    const continent = lang === 'zh' ? (CONTINENT_TRANSLATIONS[continentEN] || continentEN) : continentEN;
    const labels = {
        capital: lang === 'zh' ? '首 都' : 'Capital', population: lang === 'zh' ? '人 口' : 'Population',
        gdp: 'GDP', area: lang === 'zh' ? '面 积' : 'Area', continent: lang === 'zh' ? '大 洲' : 'Continent'
    };
    infoCountryName.textContent = name || '';
    infoBody.innerHTML = `
      <p><b>${labels.capital}</b>${capital || 'N/A'}</p> <p><b>${labels.population}</b>${pop}</p>
      <p><b>${labels.gdp}</b>${gdp}</p> <p><b>${labels.area}</b>${area}</p>
      <p><b>${labels.continent}</b>${continent || 'N/A'}</p>
    `;
}

function hideInfoPanel() {
  setSelectedCountryByCode(null);
  lockedCountry = null;
  infoPanel.classList.remove('visible');
}

function clientToNDC(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;
  return { x, y };
}