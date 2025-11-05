// main.js
// 职责：作为项目入口，导入所有模块，按顺序执行初始化，并启动动画循环。

import * as THREE from 'three';
import * as TWEEN from 'tween.js';
import { scene, camera, renderer, controls, initScene, EARTH_RADIUS, cloudSphere, earthMat, stand, globeAssembly, zenMasterGroup, dayTexture, nightTexture, ambientLight } from './modules/scene.js';
import { drawGeoFeatures, geoLinesGroup } from './modules/features.js';
import { convertVec3ToLatLon } from './modules/geography.js';
import { loadData, extraData, labels } from './modules/data.js';
import { initCities, updateCities } from './modules/cities.js';
import { initInteraction, updateIdlIndicators, lockedCountry, hoveredCountry, getTimezoneFor, formatDateTime, updateInfoPanelContent } from './modules/interaction.js';
import { findCountryAt } from './modules/hit-test.js';
import { updateLabels } from './modules/labels.js';
import { AppConfig } from './modules/config.js';
// ▼▼▼ 核心修改：导入 starfield ▼▼▼
import { initZenMode, updateZenMode, starfield } from './modules/zen-mode.js';
// ▲▲▲ 核心修改 ▲▲▲

// --- 全局状态 ---
window.currentLanguage = 'en';
let focusedCountryCode = null;
let idlLine = null;
let isIdlCentered = false;
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
let currentLabelDensity = AppConfig.LABEL_DEFAULT_DENSITY;

// --- UI元素变量 ---
let settingsBtn, settingsPanel, cloudToggle, nightModeToggle, langBtn, timeObserverMain, timeObserverHover, labelDensityGroup;

// ▼▼▼ 核心修改：新增一个时钟用于动画计时 ▼▼▼
const clock = new THREE.Clock();
// ▲▲▲ 核心修改 ▲▲▲

// --- 初始化流程 ---
document.addEventListener('DOMContentLoaded', async () => {
  initScene();

  const zenModeBtn = document.getElementById('toggle-stand-btn');
  const textureLoader = new THREE.TextureLoader();
  zenModeBtn.textContent = '加载资源...';
  zenModeBtn.disabled = true;
  textureLoader.load('./assets/earth_night.webp', () => {
    zenModeBtn.disabled = false;
    zenModeBtn.textContent = '禅定时刻';
  }, undefined, () => {
    zenModeBtn.textContent = '资源加载失败';
  });

  drawGeoFeatures();
  await loadData();
  initCities(scene);
  initInteraction();
  initZenMode({ scene, camera, renderer, controls, globeAssembly, stand, zenMasterGroup });

  langBtn = document.getElementById('language-switch-btn');
  settingsBtn = document.getElementById('settings-btn');
  settingsPanel = document.getElementById('settings-panel');
  cloudToggle = document.getElementById('cloud-toggle');
  nightModeToggle = document.getElementById('night-mode-toggle');
  idlLine = scene.getObjectByName('interactive_idl_line');
  timeObserverMain = document.getElementById('time-observer-main');
  timeObserverHover = document.getElementById('time-observer-hover');
  labelDensityGroup = document.getElementById('label-density-group');

  langBtn.addEventListener('click', toggleLanguage);

  const handleClickOutsideSettings = (event) => {
    if (settingsPanel && !settingsPanel.contains(event.target) && settingsBtn && !settingsBtn.contains(event.target)) {
        settingsPanel.classList.remove('visible');
        document.removeEventListener('click', handleClickOutsideSettings, true);
    }
  };
  settingsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const isVisible = settingsPanel.classList.toggle('visible');
    if (isVisible) document.addEventListener('click', handleClickOutsideSettings, true);
    else document.removeEventListener('click', handleClickOutsideSettings, true);
  });

  cloudToggle.addEventListener('change', (event) => { if (cloudSphere) cloudSphere.visible = event.target.checked; });
  nightModeToggle.addEventListener('change', (event) => {
    if (window.isZenMode) return;
    if (event.target.checked) {
      earthMat.map = nightTexture;
      earthMat.emissiveIntensity = AppConfig.NIGHT_MODE_EMISSIVE_INTENSITY;
    } else {
      earthMat.map = dayTexture;
      earthMat.emissiveIntensity = 0;
    }
  });

  labelDensityGroup.addEventListener('change', (event) => {
    if (event.target.name === 'label-density') {
      currentLabelDensity = event.target.value;
    }
  });
  const initialRadio = labelDensityGroup.querySelector(`[value=${currentLabelDensity}]`);
  if (initialRadio) initialRadio.checked = true;

  animate();
});

function animate() {
  requestAnimationFrame(animate);

  // ▼▼▼ 核心修改：在每一帧更新时间 ▼▼▼
  const elapsedTime = clock.getElapsedTime();
  if (starfield && starfield.material.uniforms.time) {
      starfield.material.uniforms.time.value = elapsedTime;
  }
  // ▲▲▲ 核心修改 ▲▲▲

  TWEEN.update();
  controls.update();
  updateZenMode();
  if (stand && stand.visible) stand.quaternion.copy(camera.quaternion);
  if (cloudSphere && cloudSphere.visible) cloudSphere.rotation.y += AppConfig.CLOUD_ROTATION_SPEED;
  updateCities(camera);
  updateFocus();
  const finalFocusedCode = lockedCountry ? (lockedCountry.properties.ADM0_A3 || lockedCountry.properties.ISO_A3) : focusedCountryCode;
  updateLabels(finalFocusedCode, currentLabelDensity);
  updateTimeObserver();
  if (idlLine && (isTouchDevice || controls.dampingFactor < 0.05)) {
    if (checkIdlCentered()) {
      if (!isIdlCentered) { isIdlCentered = true; updateIdlIndicators(true, window.currentLanguage); }
    } else {
      if (isIdlCentered) { isIdlCentered = false; updateIdlIndicators(false, window.currentLanguage); }
    }
  }
  renderer.render(scene, camera);
}
// ... 其他辅助函数无变化 ...
function toggleLanguage(){window.currentLanguage="en"===window.currentLanguage?"zh":"en",langBtn.textContent="en"===window.currentLanguage?"中文":"English",labels.forEach(label=>{if(label.element){const name=label[`name_${window.currentLanguage}`];name&&(label.element.textContent=name)}}),updateInfoPanelContent()}const centerRaycaster=new THREE.Raycaster;function updateTimeObserver(){if(timeObserverMain&&timeObserverHover){const dateForTime=new Date,lang=window.currentLanguage;if(lockedCountry){const data=lockedCountry.properties,code=data.ADM0_A3||data.ISO_A3,extra=extraData[code]||{},name="zh"===lang?extra.NAME_ZH||data.NAME_ZH||data.NAME_EN:data.NAME_EN||data.NAME,tz=getTimezoneFor(lockedCountry.lat,lockedCountry.lon,code);timeObserverMain.textContent=formatDateTime(tz,dateForTime),timeObserverHover.textContent=name,timeObserverHover.classList.add("visible");return}if(hoveredCountry){const data=hoveredCountry.properties,code=data.ADM0_A3||data.ISO_A3,extra=extraData[code]||{},name="zh"===lang?extra.NAME_ZH||data.NAME_ZH||data.NAME_EN:data.NAME_EN||data.NAME,tz=getTimezoneFor(data.LABEL_Y,data.LABEL_X,code);timeObserverMain.textContent=formatDateTime(tz,dateForTime),timeObserverHover.textContent=name,timeObserverHover.classList.add("visible");return}timeObserverHover.classList.remove("visible");const sphereMesh=scene.getObjectByName("earth_sphere"),hits=centerRaycaster.intersectObjects(scene.children,!0),hit=hits.find(h=>h.object===sphereMesh);hit?(timeObserverMain.textContent=formatDateTime(getTimezoneFor(convertVec3ToLatLon(hit.point,EARTH_RADIUS).lat,convertVec3ToLatLon(hit.point,EARTH_RADIUS).lon,null),dateForTime)):timeObserverMain.textContent="---"}}function updateFocus(){const sphereMesh=scene.getObjectByName("earth_sphere");centerRaycaster.setFromCamera({x:0,y:0},camera);const hit=sphereMesh?centerRaycaster.intersectObject(sphereMesh,!1)[0]:null;if(hit){const{lat,lon}=convertVec3ToLatLon(hit.point,EARTH_RADIUS),feature=findCountryAt(lat,lon);focusedCountryCode=feature&&feature.properties?feature.properties.ADM0_A3||feature.properties.ISO_A3:null}else focusedCountryCode=null}const idlCenterCheckVec=new THREE.Vector3;function checkIdlCentered(){if(!idlLine)return!1;const positions=idlLine.geometry.attributes.position.array,cameraDirection=new THREE.Vector3;camera.getWorldDirection(cameraDirection);const centerThreshold=.15;for(let i=0;i<positions.length;i+=30){idlCenterCheckVec.set(positions[i],positions[i+1],positions[i+2]);const toPoint=idlCenterCheckVec.clone().sub(camera.position).normalize;if(cameraDirection.dot(toPoint)>-.1&&(idlCenterCheckVec.project(camera),idlCenterCheckVec.x>-centerThreshold&&idlCenterCheckVec.x<centerThreshold))return!0}return!1}