// 场景/图层/渲染循环
// 提供：createScene(canvas, dpr, width, height), makeBorder, highlight, updateCameraDistance

import { createScopedThreejs } from 'threejs-miniprogram';
import { convertLatLonToVec3 } from './geography.js';

const RADIUS = 1;
const OFFSET_Y = -0.55;
const LIGHT_MAIN = 1.15;
const LIGHT_AMBI = 0.30;
const MARGIN = 1.02;
const BORDER_DECIMATE = 3; // 采样步长（每隔 N 个点取一个），以降低边界几何复杂度

export function createScene(canvas, dpr, width, height) {
  const THREE = createScopedThreejs(canvas);
  const pr = Math.min(2, dpr);
  canvas.width = Math.floor(width * pr);
  canvas.height = Math.floor(height * pr);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(pr);
  renderer.setSize(width, height, false);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 1000);

  const vFov  = camera.fov * Math.PI / 180;
  const distV = RADIUS / Math.tan(vFov/2);
  const distH = RADIUS / (Math.tan(vFov/2) * camera.aspect);
  const baseDist = Math.max(distV, distH) * MARGIN;

  scene.add(new THREE.AmbientLight(0xffffff, LIGHT_AMBI));
  const dirLight = new THREE.DirectionalLight(0xffffff, LIGHT_MAIN);
  scene.add(dirLight);

  const globeGroup = new THREE.Group();
  globeGroup.position.y = OFFSET_Y;
  scene.add(globeGroup);

  return { THREE, renderer, scene, camera, dirLight, globeGroup, baseDist };
}

export function updateCameraDistance(camera, baseDist, zoom) {
  camera.position.set(0, 0, baseDist / zoom);
}

function makeLineMat(THREE, color, ro=30) {
  const m = new THREE.LineBasicMaterial({ color, depthTest: true });
  m.depthWrite = true; m.userData = { ro }; return m;
}
function setRO(obj){ obj.renderOrder = obj.material?.userData?.ro ?? 0 }

function makeFillMat(THREE, color=0xffcc33, alpha=0.26, ro=35) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, side: THREE.DoubleSide, depthTest: true });
  m.depthWrite = false;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -1;
  m.userData = { ro };
  return m;
}

function decimateRing(ring, step){
  if (!Array.isArray(ring) || ring.length <= step) return ring;
  const out = [];
  for (let i = 0; i < ring.length; i += step) out.push(ring[i]);
  // 确保闭合：首尾一致
  const a = out[0], b = out[out.length - 1];
  if (!b || a[0] !== b[0] || a[1] !== b[1]) out.push([a[0], a[1]]);
  return out;
}

export function makeBorder(THREE, globeGroup, COUNTRY_FEATURES) {
  // 生成国家边界线层
  const BORDER_GROUP = new THREE.Group();
  const lineMat = makeLineMat(THREE, 0xffffff, 20);
  COUNTRY_FEATURES.forEach(f => {
    const addRing = (ring) => {
      const r = decimateRing(ring, BORDER_DECIMATE);
      const pts = r.map(([lon, lat]) => {
        const v = convertLatLonToVec3(lon, lat, RADIUS + 0.0015);
        return new THREE.Vector3(v.x, v.y, v.z);
      });
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.LineLoop(g, lineMat); setRO(line);
      BORDER_GROUP.add(line);
    };
    if (f.type === 'Polygon') f.coords.forEach(addRing);
    else if (f.type === 'MultiPolygon') f.coords.forEach(poly => poly.forEach(addRing));
  });
  globeGroup.add(BORDER_GROUP);
  return BORDER_GROUP;
}

export function highlight(THREE, globeGroup, f) {
  // 创建高亮填充与描边
  if (!f) return null;
  const HIGHLIGHT_GROUP = new THREE.Group();
  const edgeMat = makeLineMat(THREE, 0xffcc33, 40);
  const fillMat = makeFillMat(THREE, 0xffcc33, 0.26, 35);

  const processPolygon = (rings) => {
    rings.forEach(ring => {
      const pts = ring.map(([lon, lat]) => {
        const v = convertLatLonToVec3(lon, lat, RADIUS + 0.002);
        return new THREE.Vector3(v.x, v.y, v.z);
      });
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), edgeMat);
      setRO(line);
      HIGHLIGHT_GROUP.add(line);
    });
  };

  const addFill = (polyRings) => {
    if (!polyRings || !polyRings.length || !polyRings[0] || polyRings[0].length < 3) return;
    const deg2rad = Math.PI / 180;
    const ensureClosed2D = (arr) => {
      if (arr.length < 2) return arr;
      const a = arr[0], b = arr[arr.length - 1];
      if (a.x !== b.x || a.y !== b.y) arr.push(new THREE.Vector2(a.x, a.y));
      return arr;
    };
    const unwrapRing = (ring, baseLon) => {
      const out = [];
      let prev = baseLon;
      for (let i = 0; i < ring.length; i++) {
        let lon = ring[i][0], lat = ring[i][1];
        // 调整到接近上一点的经度，避免跨 ±180 度的长跳跃
        const n = Math.round((prev - lon) / 360);
        const adj = lon + n * 360;
        out.push([adj, lat]);
        prev = adj;
      }
      // 闭合
      if (out.length >= 2) {
        const a = out[0], b = out[out.length - 1];
        if (a[0] !== b[0] || a[1] !== b[1]) out.push([a[0], a[1]]);
      }
      return out;
    };

    // 以外环首点经度作为展开参考
    const baseLon = polyRings[0][0][0];
    const outerUnwrapped = unwrapRing(polyRings[0], baseLon);
    const meanLat = outerUnwrapped.reduce((s, p) => s + p[1], 0) / outerUnwrapped.length;
    const lonScale = Math.max(0.2, Math.cos(meanLat * deg2rad)); // 避免在极区 scale 过小

    const toV2Scaled = ([lon, lat]) => new THREE.Vector2(lon * lonScale, lat);
    const outer2D = outerUnwrapped.map(toV2Scaled);
    ensureClosed2D(outer2D);
    const holesUnwrapped = polyRings.slice(1)
      .filter(r => r && r.length >= 3)
      .map(r => unwrapRing(r, baseLon));
    const holes2D = holesUnwrapped.map(h => {
      const arr = h.map(toV2Scaled); ensureClosed2D(arr); return arr;
    });

    // 使用三角化生成索引（在展开+缩放后的 2D 平面进行）
    let triangles;
    if (THREE.ShapeUtils && typeof THREE.ShapeUtils.triangulateShape === 'function') {
      triangles = THREE.ShapeUtils.triangulateShape(outer2D, holes2D);
    } else {
      // 回退：若三角化不可用，使用外环的扇形三角化（忽略洞），保证至少能绘制填充
      triangles = [];
      for (let i = 1; i < outer2D.length - 2; i++) {
        triangles.push([0, i, i + 1]);
      }
    }
    // 将 3D 顶点按相同的拼接顺序展开
    const flatten3D = (triangles.length && triangles[0][1] < outer2D.length && holes2D.length === 0)
      ? outerUnwrapped.map(([lon, lat]) => {
          let normLon = ((lon + 180) % 360 + 360) % 360 - 180;
          const v = convertLatLonToVec3(normLon, lat, RADIUS + 0.02);
          return new THREE.Vector3(v.x, v.y, v.z);
        })
      : outerUnwrapped.concat(...holesUnwrapped).map(([lon, lat]) => {
          let normLon = ((lon + 180) % 360 + 360) % 360 - 180;
          const v = convertLatLonToVec3(normLon, lat, RADIUS + 0.02);
          return new THREE.Vector3(v.x, v.y, v.z);
        });

    const positions = new Float32Array(triangles.length * 9);
    for (let i = 0; i < triangles.length; i++) {
      const [a, b, c] = triangles[i];
      const va = flatten3D[a], vb = flatten3D[b], vc = flatten3D[c];
      positions.set([va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z], i * 9);
    }
    const shpGeo = new THREE.BufferGeometry();
    const PosAttr = THREE.Float32BufferAttribute || THREE.BufferAttribute;
    if (typeof shpGeo.setAttribute === 'function') {
      shpGeo.setAttribute('position', new PosAttr(positions, 3));
    } else if (typeof shpGeo.addAttribute === 'function') {
      shpGeo.addAttribute('position', new PosAttr(positions, 3));
    } else {
      // 兼容极老版本：直接赋值到 attributes
      shpGeo.attributes = shpGeo.attributes || {};
      shpGeo.attributes.position = new PosAttr(positions, 3);
    }

    const mesh = new THREE.Mesh(shpGeo, fillMat);
    setRO(mesh);
    HIGHLIGHT_GROUP.add(mesh);
  };

  if (f.type === 'Polygon') {
    processPolygon(f.coords);
    addFill(f.coords);
  } else if (f.type === 'MultiPolygon') {
    f.coords.forEach(poly => { processPolygon(poly); addFill(poly); });
  }
  globeGroup.add(HIGHLIGHT_GROUP);
  return HIGHLIGHT_GROUP;
}