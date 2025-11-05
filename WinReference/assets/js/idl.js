// assets/js/idl.js
// 依赖：three.module.js、Line2.js / LineMaterial.js / LineGeometry.js
import * as THREE from './three.module.js';
import { Line2 } from './lines/Line2.js';
import { LineMaterial } from './lines/LineMaterial.js';
import { LineGeometry } from './lines/LineGeometry.js';

// —— 可选：你也能把这份 segments 挪到独立 json ——
// 这是一条“带人文拐点”的日期变更线（绕开阿留申群岛、斐济/汤加等）
const IDL_SEGMENTS = [
  // 北段：楚科奇海—白令海—阿留申
  [
    { lat: 80, lon: 180 }, { lat: 65, lon: 180 },
    { lat: 62, lon: 172 }, { lat: 52, lon: 172 },
    { lat: 51, lon: 180 }, { lat: 45, lon: 180 }
  ],
  // 阿留申外海弯折
  [
    { lat: 45, lon: 180 }, { lat: 40, lon: 170 },
    { lat: 35, lon: 170 }, { lat: 30, lon: 180 }
  ],
  // 中太平洋直段
  [
    { lat: 30, lon: 180 }, { lat: 5, lon: 180 }
  ],
  // 斐济/汤加一带的人文“外凸”
  [
    { lat: 5, lon: 180 }, { lat: -5, lon: 170 },
    { lat: -10, lon: 170 }, { lat: -15, lon: 180 }
  ],
  // 南太平洋直段
  [
    { lat: -15, lon: 180 }, { lat: -50, lon: 180 }
  ],
  // 南极外海弯折
  [
    { lat: -50, lon: 180 }, { lat: -60, lon: 172 },
    { lat: -80, lon: 172 }, { lat: -90, lon: 180 }
  ]
];

// 经纬度 -> 球面坐标
function ll2v(lat, lon, R) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -R * Math.sin(phi) * Math.cos(theta),
     R * Math.cos(phi),
     R * Math.sin(phi) * Math.sin(theta)
  );
}

// 计算屏幕上点到线段的像素距离（用于 hover，可选）
function distPointToSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const ab2 = abx * abx + aby * aby || 1e-6;
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx, cy = ay + t * aby;
  const dx = px - cx, dy = py - cy;
  return Math.hypot(dx, dy);
}

/**
 * attachIDL
 * 在不改你现有代码的前提下，把国际日期变更线加到场景里。
 *
 * @param {object} cfg
 *   - scene: THREE.Scene （必填）
 *   - renderer: THREE.WebGLRenderer（必填，用于同步像素宽度）
 *   - radius: 地球半径（用你地球的半径，默认 2）
 *   - style: { color, widthPx, opacity, dashed, dashSizePx, gapSizePx, depthTest }
 *
 * @returns {object} API
 *   - group: THREE.Group（整条线）
 *   - update(): 每帧/resize 调一下，保持宽度清晰
 *   - handleResize(): window resize 调一下（可不调，update 已覆盖）
 *   - setVisible(v): 显隐
 *   - hitTestNDC(x, y, camera): 传 NDC（-1~1），返回是否“靠近线”（像素阈值内）
 *   - setHover(on): 手动设置 hover 效果
 */
export function attachIDL({
  scene,
  renderer,
  radius = 2,
  style = {}
} = {}) {
  if (!scene || !renderer) {
    throw new Error('[idl] scene/renderer 必填');
  }

  const {
    color = 0x00e5ff,   // 和纬线区分的湖蓝
    widthPx = 1.6,      // 以像素为单位（Line2 语义）
    opacity = 0.95,
    dashed = true,
    dashSizePx = 10,
    gapSizePx = 7,
    depthTest = true    // true: 背面被球体遮住（更真实）
  } = style;

  const group = new THREE.Group();
  group.name = 'IDL_Group';
  scene.add(group);

  // 注意：Line2 的 linewidth 是“像素”，分辨率必须随时同步
  const size = new THREE.Vector2();
  const dpr  = () => renderer.getPixelRatio();

  // 用 clone 的实例材质，避免一处改动影响所有线
  function makeMat() {
    renderer.getSize(size);
    const mat = new LineMaterial({
      color, transparent: true, opacity,
      linewidth: widthPx / (window.devicePixelRatio || 1), // 兼容某些浏览器取分辨率时机
      dashed, dashSize: dashSizePx / 10, gapSize: gapSizePx / 10, // 数值对 Line2 是“相对像素”，先给个经验比例
      depthTest, depthWrite: false
    });
    mat.resolution.set(size.x * dpr(), size.y * dpr());
    return mat;
  }

  const lift = 1.003;       // 轻微抬高，避免和球面 Z 冲突
  const renderOrder = 12;   // 比国界线略后渲染

  // 构建多段线
  IDL_SEGMENTS.forEach(seg => {
    const pts = seg.map(p => ll2v(p.lat, p.lon, radius * lift));
    const g = new LineGeometry();
    g.setPositions(pts.flatMap(v => [v.x, v.y, v.z]));

    const m = makeMat();
    const l = new Line2(g, m);
    l.frustumCulled = false;
    l.renderOrder = renderOrder;
    if (dashed && l.computeLineDistances) l.computeLineDistances();

    group.add(l);
  });

  // —— API —— //
  function update() {
    // 分辨率变化（窗口缩放、DPR 变化）时，同步像素宽度
    renderer.getSize(size);
    const px = size.x * dpr(), py = size.y * dpr();
    group.traverse(o => {
      const m = o && o.material;
      if (m && m.isLineMaterial && m.resolution) {
        m.resolution.set(px, py);
      }
    });
  }
  function handleResize() { update(); }
  function setVisible(v) { group.visible = !!v; }

  // hover（可选使用）
  function setHover(on) {
    group.traverse(o => {
      const m = o && o.material;
      if (m && m.isLineMaterial) {
        m.opacity   = on ? 1.0 : opacity;
        m.linewidth = on ? (widthPx * 1.8) / (window.devicePixelRatio || 1) : (widthPx / (window.devicePixelRatio || 1));
        m.needsUpdate = true;
      }
    });
  }

  // 命中测试（像素阈值 8px）
  function hitTestNDC(ndcX, ndcY, camera, thresholdPx = 8) {
    const w = renderer.domElement.width  / dpr();
    const h = renderer.domElement.height / dpr();

    // 把 NDC 转屏幕像素坐标
    const px = (ndcX * 0.5 + 0.5) * w;
    const py = (-ndcY * 0.5 + 0.5) * h;

    // 逐段做投影距离
    let min = Infinity;
    const v = new THREE.Vector3();
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const sa = new THREE.Vector2(), sb = new THREE.Vector2();

    for (const seg of IDL_SEGMENTS) {
      for (let i = 0; i < seg.length - 1; i++) {
        a.copy(ll2v(seg[i].lat,   seg[i].lon,   radius));
        b.copy(ll2v(seg[i+1].lat, seg[i+1].lon, radius));
        a.project(camera); b.project(camera);
        sa.set((a.x * 0.5 + 0.5) * w, (-a.y * 0.5 + 0.5) * h);
        sb.set((b.x * 0.5 + 0.5) * w, (-b.y * 0.5 + 0.5) * h);
        const d = distPointToSeg(px, py, sa.x, sa.y, sb.x, sb.y);
        if (d < min) min = d;
      }
    }
    return min <= thresholdPx;
  }

  // 首帧先同步一次
  update();

  return { group, update, handleResize, setVisible, hitTestNDC, setHover };
}
