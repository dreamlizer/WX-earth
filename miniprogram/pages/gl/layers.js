// 场景/图层/渲染循环
// 提供：createScene(canvas, dpr, width, height), makeBorder, highlight, updateCameraDistance

import { createScopedThreejs } from 'threejs-miniprogram';
import { convertLatLonToVec3 } from './geography.js';

const RADIUS = 1;
const OFFSET_Y = -0.55;
const LIGHT_MAIN = 1.95; // 太阳光强度（调大更亮，建议 1.3–1.8；在普通/禅模式都会生效）
const LIGHT_AMBI = 0.10; // 环境光强度（调小更暗，建议 0.18–0.28；夜侧更黑、分界更清晰）
const MARGIN = 1.02;
const BORDER_DECIMATE = 1; // 取消抽样，使用完整点集以提升邻国边界重合度

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

  const ambientLight = new THREE.AmbientLight(0xffffff, LIGHT_AMBI); // 如需调整强度，优先改上面的 LIGHT_AMBI 常量
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, LIGHT_MAIN); // 如需调整“太阳光”强度，优先改上面的 LIGHT_MAIN 常量
  scene.add(dirLight);

  const globeGroup = new THREE.Group();
  globeGroup.position.y = OFFSET_Y;
  scene.add(globeGroup);

  return { THREE, renderer, scene, camera, dirLight, ambientLight, globeGroup, baseDist };
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
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, side: THREE.DoubleSide, depthTest: false });
  m.depthWrite = false;
  // 关闭或弱化偏移，避免与球体表面发生反向偏移导致的穿插
  m.polygonOffset = true;
  m.polygonOffsetFactor = -0.5;
  m.polygonOffsetUnits = -0.5;
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
        // 统一微抬升高度，避免不同数据集误差导致的双线错位感
        const v = convertLatLonToVec3(lon, lat, RADIUS + 0.0012);
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
    // 实心高亮：忽略洞（holes），仅对外环进行填充
    const holesUnwrapped = [];
    const holes2D = [];

    // 统一二维环的朝向：外环逆时针（CCW），洞顺时针（CW），并同步 3D 未展开坐标的顺序
    const signedArea = (arr) => {
      let A = 0; for (let i=0;i<arr.length-1;i++){ const a=arr[i], b=arr[i+1]; A += (a.x*b.y - a.y*b.x); } return A*0.5;
    };
    // 外环 -> CCW
    if (signedArea(outer2D) < 0) { outer2D.reverse(); ensureClosed2D(outer2D); outerUnwrapped.reverse(); }
    // 洞 -> CW（与外环相反）
    for (let i=0;i<holes2D.length;i++){
      const h2 = holes2D[i];
      if (signedArea(h2) > 0) { h2.reverse(); ensureClosed2D(h2); holesUnwrapped[i].reverse(); }
    }

    // 使用三角化生成索引（在展开+缩放后的 2D 平面进行）
    // 注意：三角化输入必须为“未闭合”的顶点序列，避免重复首尾点导致退化三角形
    const contour2D = outer2D.slice(0, Math.max(0, outer2D.length - 1));
    // 与 2D 同步构建未闭合的 3D 顶点序列（半径抬升 0.06，避免与地球贴图 Z 冲突）
    const flatten3DOpen = outerUnwrapped.slice(0, Math.max(0, outerUnwrapped.length - 1)).map(([lon, lat]) => {
      let normLon = ((lon + 180) % 360 + 360) % 360 - 180;
      const v = convertLatLonToVec3(normLon, lat, RADIUS + 0.001);//原来改的是0.02
      return new THREE.Vector3(v.x, v.y, v.z);
    });

    // 对齐简化：去除重复点与共线点，降低耳剪的数值病态与卡死风险
    const simplifyAligned = (pts2D, pts3D, eps = 1e-6) => {
      const out2 = []; const out3 = [];
      const isDup = (a, b) => Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
      for (let i = 0; i < pts2D.length; i++) {
        const p2 = pts2D[i]; const p3 = pts3D[i];
        if (out2.length > 0 && isDup(p2, out2[out2.length - 1])) continue;
        // 共线消除：若 (prev2 -> p2) 与 (prevprev2 -> prev2) 近似共线，则移除 prev
        if (out2.length >= 2) {
          const a = out2[out2.length - 2], b = out2[out2.length - 1], c = p2;
          const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
          const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
          if (Math.abs(cross) < eps && dot >= 0) { out2.pop(); out3.pop(); }
        }
        out2.push(p2); out3.push(p3);
      }
      return { pts2: out2, pts3: out3 };
    };
    const { pts2: contour2DSimpl, pts3: flatten3DSimpl } = simplifyAligned(contour2D, flatten3DOpen);

    // 强制使用耳剪法，绕过 THREE.ShapeUtils.triangulateShape 在复杂凹多边形上的不稳定性
    const earTriangulate = (pts) => {
      const n = pts.length;
      const idx = []; for (let i = 0; i < n; i++) idx.push(i);
      const area = (a,b,c)=> (b.x - a.x)*(c.y - a.y) - (b.y - a.y)*(c.x - a.x);
      const isClockwise = () => {
        let s=0; for (let i=0;i<n;i++){ const a=pts[i], b=pts[(i+1)%n]; s += (b.x-a.x)*(b.y+a.y); } return s>0;
      };
      if (isClockwise()) idx.reverse();
      const pointInTri = (p,a,b,c)=>{
        const ab = area(a,b,p), bc = area(b,c,p), ca = area(c,a,p);
        const hasNeg = (ab<0)||(bc<0)||(ca<0); const hasPos = (ab>0)||(bc>0)||(ca>0);
        return !(hasNeg && hasPos);
      };
      const isEar = (i)=>{
        const i0 = idx[(i-1+idx.length)%idx.length], i1 = idx[i], i2 = idx[(i+1)%idx.length];
        const a = pts[i0], b = pts[i1], c = pts[i2];
        if (area(a,b,c) <= 0) return false;
        for (let j=0;j<idx.length;j++){
          if (j===i || j===(i-1+idx.length)%idx.length || j===(i+1)%idx.length) continue;
          const p = pts[idx[j]];
          if (pointInTri(p,a,b,c)) return false;
        }
        return true;
      };
      const tris = [];
      let guard = 0;
      while (idx.length > 2 && guard++ < 10000){
        let cut = false;
        for (let i=0;i<idx.length;i++){
          if (isEar(i)){
            const i0 = idx[(i-1+idx.length)%idx.length], i1 = idx[i], i2 = idx[(i+1)%idx.length];
            tris.push([i0,i1,i2]);
            idx.splice(i,1);
            cut = true; break;
          }
        }
        if (!cut) {
          for (let i=1;i<idx.length-1;i++) tris.push([idx[0], idx[i], idx[i+1]]);
          break;
        }
      }
      return tris;
    };
    // 优先尝试 THREE.ShapeUtils.triangulateShape（更快），若索引非法或数量不足则回退耳剪
    const tryTriByThree = (pts) => {
      if (!(THREE.ShapeUtils && typeof THREE.ShapeUtils.triangulateShape === 'function')) return null;
      const tris = THREE.ShapeUtils.triangulateShape(pts, []);
      const valid = Array.isArray(tris) && tris.length >= Math.max(0, pts.length - 2) * 0.5 && tris.every(t => Array.isArray(t) && t.length === 3 && t.every(i => i >= 0 && i < pts.length));
      return valid ? tris : null;
    };
    const triangles = tryTriByThree(contour2DSimpl) || earTriangulate(contour2DSimpl);

    const positions = new Float32Array(triangles.length * 9);
    for (let i = 0; i < triangles.length; i++) {
      const [a, b, c] = triangles[i];
      const va = flatten3DSimpl[a], vb = flatten3DSimpl[b], vc = flatten3DSimpl[c];
      positions.set([va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z], i * 9);
    }
    const shpGeo = new THREE.BufferGeometry();
    const PosAttr = THREE.Float32BufferAttribute || THREE.BufferAttribute;
    if (typeof shpGeo.setAttribute === 'function') {
      shpGeo.setAttribute('position', new PosAttr(positions, 3));
    } else if (typeof shpGeo.addAttribute === 'function') {
      shpGeo.addAttribute('position', new PosAttr(positions, 3));
    } else {
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

// 金黄色赤道与南北回归线（淡淡可见，略微抬升避免穿插）
export function makeEquatorAndTropics(THREE, globeGroup) {
  // 使用薄型 TubeGeometry 提升精致度；开启深度测试避免背面穿模
  const group = new THREE.Group();
  const color = 0xffd24d; // 更亮的金黄色
  const opacity = 0.72;   // 适度提亮但不抢眼
  const ro = 28;          // 高于地球、低于标签
  const matBase = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: true });
  matBase.depthWrite = false; matBase.polygonOffset = true; matBase.polygonOffsetFactor = -1; matBase.polygonOffsetUnits = -1; matBase.userData = { ro };

  const buildLatTube = (latDeg) => {
    const ALT = 0.0013; // 轻微抬升，减少与地球贴图的 Z 冲突
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 3) {
      const v = convertLatLonToVec3(lon, latDeg, RADIUS + ALT);
      pts.push(new THREE.Vector3(v.x, v.y, v.z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.6);
    const tubularSegments = Math.max(120, Math.min(360, Math.floor(360/3) * 2));
    const tubeRadius = 0.0032; // 细圆管半径，略粗于线以提升可读性
    const radialSegments = 12;
    const geo = new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, radialSegments, true);
    const mat = matBase.clone();
    const mesh = new THREE.Mesh(geo, mat);
    setRO(mesh);
    group.add(mesh);
  };

  buildLatTube(0); // 赤道
  const TROPIC = 23.437; // 回归线约 23.437°
  buildLatTube(+TROPIC);
  buildLatTube(-TROPIC);
  globeGroup.add(group);
  return group;
}