// modules/geography.js
// 职责：提供基础的地理计算和几何构建功能。

import * as THREE from '../assets/js/three.module.js';
import { EARTH_RADIUS } from './scene.js';

// --- 经纬度与三维向量转换 ---
export function convertLatLonToVec3(lat, lon, r = EARTH_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(r * Math.sin(phi) * Math.cos(theta));
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

export function convertVec3ToLatLon(vector, radius = EARTH_RADIUS) {
  const yclamped = THREE.MathUtils.clamp(vector.y / radius, -1, 1);
  const phi = Math.acos(yclamped);
  const theta = Math.atan2(vector.z, -vector.x);
  let lon = THREE.MathUtils.radToDeg(theta) - 180;
  lon = ((lon + 180) % 360 + 360) % 360 - 180;
  const lat = 90 - THREE.MathUtils.radToDeg(phi);
  return { lat, lon };
}

// --- 国家高亮填充 ---
const HIGHLIGHT_MAT = new THREE.MeshBasicMaterial({
  color: 0xffff00, transparent: true, opacity: 0.22,
  depthTest: false, depthWrite: false, side: THREE.FrontSide
});

function meshFromPolygon(poly) {
  const shape = shapeFromPolygon(poly);
  if (!shape) return null;
  const geom = new THREE.ShapeGeometry(shape);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = convertLatLonToVec3(pos.getY(i), pos.getX(i), EARTH_RADIUS + 0.0008);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, HIGHLIGHT_MAT);
  mesh.renderOrder = 1;
  return mesh;
}

function shapeFromPolygon(poly) {
  if (!poly || !poly.length) return null;
  const outer = unwrapRing(poly[0]).slice();
  ensureWindingCCW(outer);
  const shape = new THREE.Shape();
  movePath(shape, outer);
  for (let i = 1; i < poly.length; i++) {
    const hole = unwrapRing(poly[i]).slice();
    ensureWindingCW(hole);
    const path = new THREE.Path();
    movePath(path, hole);
    shape.holes.push(path);
  }
  return shape;
}

function movePath(path, ring) {
  if (!ring.length) return;
  path.moveTo(ring[0][0], ring[0][1]);
  for (let i = 1; i < ring.length; i++) path.lineTo(ring[i][0], ring[i][1]);
}

function unwrapRing(ring) {
  if (!ring || ring.length === 0) return [];
  const out = [ ring[0].slice() ];
  for (let i = 1; i < ring.length; i++) {
    const prev = out[i - 1][0];
    let L = ring[i][0];
    while (L - prev > 180)  L -= 360;
    while (L - prev < -180) L += 360;
    out.push([L, ring[i][1]]);
  }
  return out;
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    sum += (ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]);
  }
  return sum / 2;
}

function ensureWindingCCW(ring) { if (ringArea(ring) < 0) ring.reverse(); }
function ensureWindingCW (ring) { if (ringArea(ring) > 0) ring.reverse(); }

export function buildCountryFillGroup(feature) {
  const g = feature.geometry;
  const group = new THREE.Group();
  if (!g) return group;
  if (g.type === 'Polygon') {
    const mesh = meshFromPolygon(g.coordinates);
    if (mesh) group.add(mesh);
  } else if (g.type === 'MultiPolygon') {
    for (const poly of g.coordinates) {
      const mesh = meshFromPolygon(poly);
      if (mesh) group.add(mesh);
    }
  }
  group.traverse(o => { if (o.isMesh) o.renderOrder = 1; });
  return group;
}