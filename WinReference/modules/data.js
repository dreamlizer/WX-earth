// modules/data.js
// 职责：加载 JSON 数据，创建国家边界线和标签数据结构。

import * as THREE from '../assets/js/three.module.js';
import { convertLatLonToVec3 } from './geography.js';
import { EARTH_RADIUS, globeAssembly } from './scene.js';

// --- 导出数据容器 --- //
export const labels = [];
export const bordersGroup = new THREE.Group();
export const fillsGroup = new THREE.Group();
export const fillCache = new Map();
export let extraData = {};
export let geoFeatures = [];
export const propsByCode = Object.create(null);

// --- 初始化函数 --- //
export async function loadData(scene) {
  globeAssembly.add(bordersGroup);
  globeAssembly.add(fillsGroup);

  const [extra, geo] = await Promise.all([
    fetch('./assets/country_data.json').then(r => r.json()),
    fetch('./assets/countries.geojson').then(r => r.json())
  ]);

  extraData = extra;
  geoFeatures = geo.features || [];

  geoFeatures.forEach(f => {
    const props = f.properties || {};
    const code = props.ADM0_A3 || props.ISO_A3;

    if (code && code !== '-99') {
      propsByCode[code] = props;
    }

    const g = f.geometry;
    if (g) {
      if (g.type === 'Polygon') {
        if (g.coordinates[0]) createLine(g.coordinates[0], props);
      } else if (g.type === 'MultiPolygon') {
        g.coordinates.forEach(poly => { if (poly[0]) createLine(poly[0], props); });
      }
    }
    createLabel(props);
  });
}

// --- 内部辅助函数 --- //
function createLine(points, props) {
  const vectors = points.map(p => convertLatLonToVec3(p[1], p[0]));
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(vectors);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const line = new THREE.Line(lineGeometry, lineMaterial);

  line.material.depthWrite = false;
  line.material.depthTest = true;
  line.renderOrder = 2;

  line.userData = { countryCode: props.ADM0_A3 || props.ISO_A3, countryData: props };
  bordersGroup.add(line);
}

function createLabel(props) {
  // ▼▼▼ 核心修改：在此处添加过滤逻辑 ▼▼▼
  const code = props.ADM0_A3 || props.ISO_A3 || null;
  // 如果国家代码是 'TWN'，则直接返回，不创建标签。
  if (code === 'TWN') {
    return;
  }
  // ▲▲▲ 核心修改 ▲▲▲

  const nameEn = props.NAME_EN || props.NAME;
  const nameZh = props.NAME_ZH;
  const lat = props.LABEL_Y;
  const lon = props.LABEL_X;

  if ((nameEn || nameZh) && typeof lat === 'number' && typeof lon === 'number') {
    const el = document.createElement('div');
    el.className = 'label';
    el.textContent = nameEn;
    document.getElementById('labels-container').appendChild(el);
    const pos = convertLatLonToVec3(lat, lon, EARTH_RADIUS + 0.004);

    const TOP_COUNTRIES = ['CHN', 'RUS', 'USA', 'CAN', 'BRA', 'AUS', 'IND'];
    const importance = TOP_COUNTRIES.includes(code) ? 2 : 1;

    labels.push({
        element: el,
        position: pos,
        code: code,
        type: 'country',
        importance: importance,
        name_en: nameEn,
        name_zh: nameZh || nameEn
    });
  }
}