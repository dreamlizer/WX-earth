// 轻量城市点标记（淡淡的若隐若现效果）
// 注意：不直接 import THREE；由 main.js 的 createScopedThreejs(canvas) 提供上下文
import { convertLatLonToVec3 } from './geography.js';

const MARKER_RADIUS = 0.002; // 光点半径（可调）
const MARKER_COLOR = 0x66ccff; // 光点颜色
const HIGHLIGHT_COLOR = 0xffdd66; // 高亮颜色（偏暖黄）
const MARKER_OPACITY = 0.18; // 基础透明度（可调）
const MARKER_HEIGHT = 0.006; // 抬升高度：略高于国家高亮填充，避免被遮罩覆盖
const RENDER_ORDER_MARKERS = 50; // 渲染顺序：确保绘制在高亮填充/描边之后
const HIGHLIGHT_SCALE = 1.35; // 被选中城市点的放大比例
const BASE_SCALE = 1.0;       // 默认缩放
const HIGHLIGHT_OPACITY_BOOST = 1.25; // 高亮时透明度提升系数（上限 0.95）

const MARKER_DEBUG_LOG = true; // 临时诊断开关

let markerGroup = null;
let THREE_CTX = null; // 由 init 注入的 THREE
let citiesData = [];
let lastUpdateTime = 0;
// 额外：高亮控制
const markersById = new Map(); // id -> Mesh
const highlightUntil = new Map(); // id -> timestamp(ms)

// 初始化城市标记：传入 THREE 与 globeGroup，避免与小程序 Canvas 绑定失配
export function initCityMarkers(THREE, globeGroup, cities) {
  if (!globeGroup) return;
  if (MARKER_DEBUG_LOG) console.log(`[markers] initCityMarkers with ${cities?.length ?? 0} cities.`);
  THREE_CTX = THREE;

  if (markerGroup) {
    globeGroup.remove(markerGroup);
    markerGroup = null;
  }

  markerGroup = new THREE_CTX.Group();
  markerGroup.name = 'city_markers';
  globeGroup.add(markerGroup);

  citiesData = cities || [];
  markersById.clear();
  highlightUntil.clear();
  createMarkers();
}

function createMarkers() {
  // 安全清理旧节点
  markerGroup.children.forEach(child => {
    try { child.geometry?.dispose?.(); child.material?.dispose?.(); } catch(_){}
  try { markerGroup.remove(child); } catch(_){}
  });

  // 为每个点创建独立材质，以便分别控制透明度
  const geometry = new THREE_CTX.SphereGeometry(MARKER_RADIUS, 8, 8);

  citiesData.forEach(city => {
    const { lon, lat } = city;
    if (typeof lon === 'number' && typeof lat === 'number') {
      const position = convertLatLonToVec3(lon, lat, 1.0 + MARKER_HEIGHT);
      // Bug 修复：必须 clone material，否则所有点共享一个透明度，导致只有最后一个点的状态生效
      const material = new THREE_CTX.MeshBasicMaterial({
        color: MARKER_COLOR,
        transparent: true,
        opacity: MARKER_OPACITY,
        depthWrite: false,
        blending: THREE_CTX.AdditiveBlending,
      });
      const marker = new THREE_CTX.Mesh(geometry, material);
      marker.position.copy(position);
      // 确保在黄色遮罩之上绘制
      try { marker.renderOrder = RENDER_ORDER_MARKERS; } catch(_){}
      // 默认缩放
      try { marker.scale.set(BASE_SCALE, BASE_SCALE, BASE_SCALE); } catch(_){}
      // 与搜索建议一致的ID：CITY_<A3>_<name_en>
      const id = `CITY_${String(city.country_code || 'UNK').toUpperCase()}_${city.name_en || city.name_zh || ''}`;
      marker.userData.cityId = id;
      try { markersById.set(id, marker); } catch(_){}
      markerGroup.add(marker);
    }
  });
}

export function updateCityMarkers(camera, currentTime) {
  if (!markerGroup || !camera) return;

  const delta = currentTime - lastUpdateTime;
  lastUpdateTime = currentTime;

  const cameraPosition = camera.position;

  // 清理过期高亮
  if (highlightUntil.size) {
    const now = currentTime;
    for (const [id, ts] of highlightUntil) { if (!ts || ts <= now) highlightUntil.delete(id); }
  }

  markerGroup.children.forEach(marker => {
    const worldPosition = new THREE_CTX.Vector3();
    marker.getWorldPosition(worldPosition);
    const distance = cameraPosition.distanceTo(worldPosition);

    // 根据距离调整透明度：远时更淡，近时略显
    const baseOpacity = MARKER_OPACITY;
    const distFactor = Math.min(1, Math.max(0, (distance - 1.6) / 4.5)); // 距离越远越淡

    // 背面弱化：当相机与点的向量点积为负时，进一步降低（避免穿透球体的误感）
    const facingDot = worldPosition.clone().normalize().dot(cameraPosition.clone().normalize());
    const backFade = facingDot < 0 ? 0.35 : 1.0; // 背面仅保留微弱闪烁

    // 呼吸效果：低幅度慢速，保持“若隐若现”
    const breathe = 0.85 + 0.15 * Math.sin(currentTime / 900);
    let currentOpacity = baseOpacity * (1 - distFactor) * breathe * backFade;

    // 颜色：处于高亮集合则切换为高亮色（不改变尺寸）
    const id = marker.userData?.cityId;
    const shouldHighlight = id && highlightUntil.has(id);
    const targetColor = shouldHighlight ? HIGHLIGHT_COLOR : MARKER_COLOR;
    try {
      if (marker.material.color?.getHex && marker.material.color.getHex() !== targetColor) {
        marker.material.color.setHex(targetColor);
      }
    } catch(_){}

    // 高亮：放大并略微提升不透明度（上限 0.95，避免过曝）
    const targetScale = shouldHighlight ? HIGHLIGHT_SCALE : BASE_SCALE;
    if (Math.abs(marker.scale.x - targetScale) > 0.001) {
      try { marker.scale.set(targetScale, targetScale, targetScale); } catch(_){}
    }
    const finalOpacity = shouldHighlight ? Math.min(0.95, currentOpacity * HIGHLIGHT_OPACITY_BOOST) : currentOpacity;
    if (Math.abs(marker.material.opacity - finalOpacity) > 0.001) {
      marker.material.opacity = finalOpacity;
    }
  });
}

export function disposeCityMarkers() {
  if (markerGroup) {
    markerGroup.children.forEach(child => {
      try { child.geometry?.dispose?.(); child.material?.dispose?.(); } catch(_){}
    });
    markerGroup.parent?.remove(markerGroup);
    markerGroup = null;
  }
  citiesData = [];
  lastUpdateTime = 0;
  THREE_CTX = null;
  try { markersById.clear(); } catch(_){}
  try { highlightUntil.clear(); } catch(_){}
}

// 外部调用：让某城市点在一段时间内“变色高亮”（不变大）
export function highlightCityMarker(id, durationMs = 3000) {
  if (!id || !markersById.has(id)) return false;
  const until = Date.now() + Math.max(500, Number(durationMs || 0));
  highlightUntil.set(id, until);
  // 立即切色一次，避免等待下一帧
  const m = markersById.get(id);
  try { m?.material?.color?.setHex?.(HIGHLIGHT_COLOR); } catch(_){}
  return true;
}

// 外部调用：清除所有城市高亮
export function clearCityHighlights() {
  highlightUntil.clear();
  for (const m of markersById.values()) {
    try { m?.material?.color?.setHex?.(MARKER_COLOR); } catch(_){}
  }
}

// 提供当前处于高亮状态的城市的世界坐标，供标签系统做“避让”
export function getHighlightedWorldPositions() {
  const res = [];
  try {
    const now = Date.now();
    for (const [id, until] of highlightUntil) {
      if (!until || until <= now) continue;
      const m = markersById.get(id);
      if (!m) continue;
      const wp = new THREE_CTX.Vector3();
      try { m.getWorldPosition(wp); } catch(_){ continue; }
      res.push({ id, world: wp });
    }
  } catch(_){ }
  return res;
}