// modules/features.js
// 职责：在地球上绘制所有具体的、大型的地理“视觉特征”，如国际日期变更线、回归线等。

import * as THREE from '../assets/js/three.module.js';
import { globeAssembly, EARTH_RADIUS } from './scene.js';
import { convertLatLonToVec3 } from './geography.js';

// --- 导入用于绘制高级线条的模块 ---
import { Line2 } from '../assets/js/lines/Line2.js';
import { LineGeometry } from '../assets/js/lines/LineGeometry.js';
import { LineMaterial } from '../assets/js/lines/LineMaterial.js';

const updatableLineMaterials = [];
export const geoLinesGroup = new THREE.Group();
geoLinesGroup.name = 'geo_lines';

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const material of updatableLineMaterials) {
    material.resolution.set(width, height);
  }
});


function createCircularLine(lat, style) {
    const points = [];
    const segments = 128;
    const radius = EARTH_RADIUS + 0.005;

    for (let i = 0; i <= segments; i++) {
        const lon = -180 + (360 * i / segments);
        points.push(convertLatLonToVec3(lat, lon, radius));
    }

    const positions = points.flatMap(p => [p.x, p.y, p.z]);
    const geometry = new LineGeometry();
    geometry.setPositions(positions);

    const material = new LineMaterial({
        color: style.color,
        linewidth: style.linewidth,
        dashed: style.dashed,
        dashSize: style.dashSize,
        gapSize: style.gapSize,
        transparent: style.transparent || false,
        opacity: style.opacity || 1.0,
        blending: THREE.AdditiveBlending,
    });

    const line = new Line2(geometry, material);
    if (style.dashed) {
      line.computeLineDistances();
    }
    line.renderOrder = 3;

    updatableLineMaterials.push(material);

    return line;
}

function createStyledIDL() {
  const idlPathPoints = [
    [180, 90], [180, 66], [-169, 66], [-169, 60], [180, 60], [180, 51],
    [-172, 51], [-172, 45], [180, 45], [180, 5], [-150, 5], [-150, -10],
    [-171, -10], [-171, -15], [180, -15], [180, -55], [170, -55], [170, -60],
    [180, -60], [180, -90]
  ];

  const vectors = [];
  const radius = EARTH_RADIUS + 0.006;

  for (let i = 0; i < idlPathPoints.length - 1; i++) {
    const start = idlPathPoints[i];
    const end = idlPathPoints[i+1];
    let startLon = start[0], endLon = end[0];

    if (endLon - startLon > 180) endLon -= 360;
    if (endLon - startLon < -180) endLon += 360;

    vectors.push(convertLatLonToVec3(start[1], start[0], radius));
    const dist = Math.sqrt(Math.pow(endLon-startLon, 2) + Math.pow(end[1]-start[1], 2));
    const segments = Math.max(2, Math.floor(dist / 5));

    for (let j = 1; j < segments; j++) {
      const lat = start[1] + (end[1] - start[1]) * j / segments;
      const lon = startLon + (endLon - startLon) * j / segments;
      vectors.push(convertLatLonToVec3(lat, lon, radius));
    }
  }
  vectors.push(convertLatLonToVec3(idlPathPoints[idlPathPoints.length-1][1], idlPathPoints[idlPathPoints.length-1][0], radius));

  const positions = vectors.flatMap(v => [v.x, v.y, v.z]);
  const geometry = new LineGeometry();
  geometry.setPositions(positions);

  const material = new LineMaterial({
    color: 0x87CEEB,
    linewidth: 1.0,
    dashed: true,
    dashSize: 0.12,
    gapSize: 0.08,
    dashScale: 0.5,
    blending: THREE.AdditiveBlending,
  });

  updatableLineMaterials.push(material);

  const idlLine = new Line2(geometry, material);
  idlLine.computeLineDistances();
  idlLine.name = 'interactive_idl_line';
  idlLine.renderOrder = 3;
  geoLinesGroup.add(idlLine);
}

export function drawGeoFeatures() {
  globeAssembly.add(geoLinesGroup);

  const equatorStyle = {
    color: 0xDAA520,
    linewidth: 1.5,
    dashed: false,
    // ★ 核心修改: 补充上这两个参数以消除警告
    dashSize: 0,
    gapSize: 0,
  };

  const tropicStyle = {
    color: 0xDAA520,
    linewidth: 1.0,
    dashed: true,
    dashSize: 0.04,
    gapSize: 0.04,
    transparent: true,
    opacity: 0.6
  };

  const equator = createCircularLine(0, equatorStyle);
  const tropicOfCancer = createCircularLine(23.5, tropicStyle);
  const tropicOfCapricorn = createCircularLine(-23.5, tropicStyle);

  geoLinesGroup.add(equator, tropicOfCancer, tropicOfCapricorn);

  createStyledIDL();

  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const material of updatableLineMaterials) {
    material.resolution.set(width, height);
  }
}