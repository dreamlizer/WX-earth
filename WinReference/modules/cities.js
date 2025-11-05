// modules/cities.js
// 职责：读取城市数据，并在地球上创建标记点（Sprite）和文本标签

import * as THREE from '../assets/js/three.module.js';
import { cities as citiesData } from '../assets/cities_data.js';
import { convertLatLonToVec3 } from './geography.js';
import { labels } from './data.js';
import { EARTH_RADIUS, globeAssembly } from './scene.js';

let cityMarkersMaterial;
const cityMarkers = [];
const MARKER_VISIBILITY_THRESHOLD = 7.0;

function createMarkerTexture(color, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const radius = size / 2;
    const gradient = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.4, color);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

export function initCities(scene) {
  const citiesGroup = new THREE.Group();
  citiesGroup.name = 'cities_group';

  const markerTexture = createMarkerTexture('rgba(255, 255, 255, 0.9)', 128);
  cityMarkersMaterial = new THREE.SpriteMaterial({
    map: markerTexture,
    blending: THREE.AdditiveBlending,
    depthTest: false,
  });

  citiesData.forEach(city => {
    const marker = new THREE.Sprite(cityMarkersMaterial);
    const markerPos = convertLatLonToVec3(city.lat, city.lon, EARTH_RADIUS);
    marker.position.copy(markerPos);
    citiesGroup.add(marker);
    cityMarkers.push(marker);

    const el = document.createElement('div');
    el.className = 'label city-label';
    el.textContent = city.name_en;
    document.getElementById('labels-container').appendChild(el);

    const labelPos = convertLatLonToVec3(city.lat, city.lon, EARTH_RADIUS + 0.005);

    labels.push({
      element: el,
      position: labelPos,
      code: null,
      type: 'city',
      importance: city.importance,
      name_en: city.name_en,
      name_zh: city.name_zh || city.name_en,
      country_code: city.country_code
    });
  });

  globeAssembly.add(citiesGroup);
}

// --- ★ 核心修正 #1: 新增用于计算的临时变量 ---
const cameraVector = new THREE.Vector3();
const markerWorldPosition = new THREE.Vector3();

export function updateCities(camera) {
  const camDistance = camera.position.length();

  cityMarkers.forEach(marker => {
    if (camDistance > MARKER_VISIBILITY_THRESHOLD) {
        marker.visible = false;
        return;
    }

    // --- ★ 核心修正 #2: 使用 marker 的世界坐标进行可见性判断 ---
    // 1. 获取标记点在世界坐标系中的真实位置
    marker.getWorldPosition(markerWorldPosition);

    // 2. 将其标准化，得到从地球中心指向该点的方向向量
    const markerNormal = markerWorldPosition.normalize();

    // 3. 与相机世界方向进行比较（现在两个向量都在同一个坐标系中）
    camera.getWorldDirection(cameraVector);
    const dot = markerNormal.dot(cameraVector);

    if (dot < -0.1) {
        marker.visible = true;
    } else {
        marker.visible = false;
    }

    const baseScale = 0.02;
    const scale = (camDistance / EARTH_RADIUS - 1) * baseScale;
    const clampedScale = Math.max(0.008, Math.min(scale, 0.03));
    marker.scale.set(clampedScale, clampedScale, 1.0);
  });
}