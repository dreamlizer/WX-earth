// labels.js  —— 仅此文件，无需改动其他文件
// 目标：标签只在前半球可见、靠近地平线渐隐；屏幕边缘渐隐；网格碰撞与预算；矩阵每帧刷新。
// 依赖：main.js 导出 getRenderContext()；项目内已存在 THREE、globeGroup、camera 等。

import { getRenderContext, getCountries } from './main.js';
import { getHighlightedWorldPositions } from './city-markers.js';
import { convertLatLonToVec3, featureContains } from './geography.js';
import { makeTextSprite } from './text-sprite.js';


// 尝试读取你项目中已有的常量；不存在则给安全默认值（不影响你已有配置）
import * as _const from './label-constants.js';

const LABEL_ALTITUDE   = _const?.LABEL_ALTITUDE   ?? 0.02;  // 标签相对球面抬升
const GRID_SIZE        = _const?.GRID_SIZE        ?? 64;    // 屏幕碰撞网格像素
let LABELS_BUDGET = _const?.MAX_LABELS_BUDGET ?? 22;        // 单帧最多渲染标签数（可动态调整）
export function setLabelsBudget(n){
  const v = Number(n);
  if (!isNaN(v) && v >= 0) LABELS_BUDGET = v;
}
// 新增：性能模式（拖动中）开关，仅影响本模块内部预算与降频，易回滚
let __perfDrag = false;
export function setPerfMode(on){ __perfDrag = !!on; }
const SCORE_THRESHOLD  = _const?.SCORE_THRESHOLD  ?? 0.0;   // 过滤低分项（保守取 0）
const LABEL_CUTOFF     = _const?.LABEL_CUTOFF     ?? 0.00;  // 前半球淡入阈值（点积）
const LABEL_FADEIN     = _const?.LABEL_FADEIN     ?? 0.35;  // 从 CUTOFF->FADEIN 线性淡入
const EDGE_FADE_PX     = _const?.EDGE_FADE_PX     ?? 28;    // 屏幕四边像素淡出
const OPACITY_FOLLOW   = _const?.OPACITY_FOLLOW   ?? 0.25;  // 简单平滑系数（0~1）- 更平滑
const SCALE_FOLLOW     = _const?.SCALE_FOLLOW     ?? 0.22;  // 缩放跟随系数（0~1）- 平滑“呼吸感”（作为回退默认）
const SCALE_TAU_MS     = _const?.SCALE_TAU_MS     ?? 85;    // 指数平滑时间常数（毫秒），按帧自适应
const CENTER_PRIORITY  = _const?.CENTER_PRIORITY  ?? 1.2;   // 居中优先权重
const AREA_WEIGHT      = _const?.AREA_WEIGHT      ?? 1.0;   // 面积权重
const DYNAMIC_FONT_BY_DISTANCE = _const?.DYNAMIC_FONT_BY_DISTANCE ?? true; // 距离缩放
const FAR_FONT_STABLE_DIST      = _const?.FAR_FONT_STABLE_DIST ?? 8.0; // 远距字体稳定阈值
const FAR_COUNTRY_ONLY_DIST     = _const?.FAR_COUNTRY_ONLY_DIST ?? 7.8; // 远距仅国家阈值
  const FAR_CENTER_WEIGHT_MIN     = _const?.FAR_CENTER_WEIGHT_MIN ?? 0.70; // 远距中心权重阈值
  const FAR_DISTANCE_RATIO        = _const?.FAR_DISTANCE_RATIO ?? 1.25; // 相机距离相对初始的比例阈值
  const CITY_WORLD_HEIGHT = _const?.CITY_WORLD_HEIGHT ?? 0.09; // 城市标签世界高度（相对半径）
const FONT_COUNTRY_PX = _const?.FONT_COUNTRY_BASE ? Math.max(18, Math.round(_const.FONT_COUNTRY_BASE * 1.6)) : 36; // 国家字体（像素）
const FONT_CITY_PX = _const?.FONT_CITY_BASE ? Math.max(16, Math.round((_const.FONT_CITY_BASE + 2) * 1.6)) : 30;            // 城市字体（像素，+2px）
const COUNTRY_MIN_WINNERS = _const?.COUNTRY_MIN_WINNERS ?? 12; // 国家保底预算（与常量文件默认值对齐）
const COUNTRY_TEXT_COLOR = _const?.COUNTRY_TEXT_COLOR ?? '#ffffff';
  const CITY_TEXT_COLOR = _const?.CITY_TEXT_COLOR ?? '#d7e1ea';
  const CITY_STROKE_WIDTH = _const?.CITY_STROKE_WIDTH ?? 2;
  // 选中国家时的城市动态预算：近距多、远距少
  const CITY_BUDGET_NEAR = _const?.CITY_BUDGET_NEAR ?? 14;
  const CITY_BUDGET_MID  = _const?.CITY_BUDGET_MID  ?? 8;
  const CITY_BUDGET_FAR  = _const?.CITY_BUDGET_FAR  ?? 3;
// 新增：城市标签字体可配置（粗细/字体族）——默认 400（Regular）
const CITY_FONT_WEIGHT = _const?.CITY_FONT_WEIGHT ?? 400; // 取值：100/200/300/400/500/600/700...
const CITY_FONT_FAMILY = _const?.CITY_FONT_FAMILY ?? 'sans-serif';
// 城市标签的 LOD（相机距离阈值），参考 Win 版策略
const LOD_CITIES_START_APPEAR = _const?.LOD_CITIES_START_APPEAR ?? 8.0; // 开始显示城市
const LOD_CITIES_ALL_APPEAR   = _const?.LOD_CITIES_ALL_APPEAR   ?? 5.5; // 显示更多级别城市
// 屏幕像素级字号上下限（最终钳制）
const FONT_MAX_SCREEN_PX_COUNTRY = _const?.FONT_MAX_SCREEN_PX_COUNTRY ?? 40;
const FONT_MAX_SCREEN_PX_CITY    = _const?.FONT_MAX_SCREEN_PX_CITY    ?? 26;
const FONT_MIN_SCREEN_PX_COUNTRY = _const?.FONT_MIN_SCREEN_PX_COUNTRY ?? 26;
const FONT_MIN_SCREEN_PX_CITY    = _const?.FONT_MIN_SCREEN_PX_CITY    ?? 20;
// 记录初始相机距离，用于比例型远距判定（适配不同屏幕纵横比）
let INIT_CAM_DIST = null;

// 基础标签数据（由页面 or onCountriesLoaded 设置）：
// 每项结构约定：{ name, lon, lat, baseVec3?, score? ... }
let BASE_LABELS = [];
const BASE_LABEL_MAP = new Map(); // id -> 原始元数据
export function setBaseLabels(list) {
  BASE_LABELS = Array.isArray(list) ? list : [];
}
// 管理 3D 文本网格
const LABEL_MESHES = new Map(); // id -> Sprite
const LABEL_STATES = new Map(); // id -> { alpha, lastWinAt }
const STICKY_MS = 900; // 失去入选后，维持可见的粘性时间（旋转更稳）
const DEFAULT_WORLD_HEIGHT = 0.12; // 以球半径=1为基准的世界单位高度
// 新增：城市强制高亮的自动清除时间（毫秒）
const CITY_FORCED_AUTO_CLEAR_MS = _const?.CITY_FORCED_AUTO_CLEAR_MS ?? 5000;

// 页面层：强制显示某一标签（选中国家时）
let FORCED_ID = null;
let FORCED_SINCE = 0; // 记录强制高亮开始时间，用于短暂“缩放冻结”
let FORCED_CLEAR_TIMER = null; // 自动清除的计时器句柄（仅城市）
export function setForcedLabel(id, opt = {}){
  // 若为城市且尚未存在标签，允许通过 opt.lat/opt.lon 即时注入一个临时标签
  try {
    const ident = id || null;
    const isCity = (typeof ident === 'string') && /^CITY_/i.test(ident);
    const notExists = !!ident && !BASE_LABEL_MAP.has(ident);
    const hasPos = Number.isFinite(opt?.lat) && Number.isFinite(opt?.lon);
    if (isCity && notExists && hasPos) {
      const ctx = getRenderContext();
      const { THREE, globeGroup } = ctx || {};
      const textFromId = (() => {
        try {
          const m = /^CITY_([A-Z]{2,3})_(.+)$/i.exec(String(ident));
          return m ? m[2] : String(ident);
        } catch(_) { return String(ident); }
      })();
      const baseVec3 = convertLatLonToVec3(Number(opt.lon), Number(opt.lat), 1.0);
      const meta = {
        id: ident,
        text: String(opt.text || textFromId),
        isCity: true,
        lon: Number(opt.lon),
        lat: Number(opt.lat),
        score: 1.0,
        importance: 1,
        country: (() => { const m=/^CITY_([A-Z]{2,3})_/i.exec(String(ident)); return m?m[1].toUpperCase():null; })(),
        baseVec3
      };
      // 创建 Sprite 文本对象并加入球体分组
      if (ctx && THREE && globeGroup && baseVec3) {
        const px = FONT_CITY_PX;
        const wh = CITY_WORLD_HEIGHT;
        const color = CITY_TEXT_COLOR;
        const strokeWidth = CITY_STROKE_WIDTH;
        const fontWeight = CITY_FONT_WEIGHT;
        const mesh = makeTextSprite(THREE, meta.text, { worldHeight: wh, padding: 14, strokeWidth, font: `${fontWeight} ${px}px ${CITY_FONT_FAMILY}` , color });
        if (mesh) {
          mesh.visible = false;
          const local = new THREE.Vector3(baseVec3.x, baseVec3.y, baseVec3.z).multiplyScalar(1 + LABEL_ALTITUDE);
          mesh.position.set(local.x, local.y, local.z);
          mesh.userData.baseScaleX = mesh.scale.x;
          mesh.userData.baseScaleY = mesh.scale.y;
          if (mesh.material) { mesh.material.depthTest = false; mesh.material.depthWrite = false; }
          mesh.renderOrder = 999;
          globeGroup.add(mesh);
          LABEL_MESHES.set(ident, mesh);
          LABEL_STATES.set(ident, { alpha: 0, lastWinAt: 0 });
        }
      }
      BASE_LABEL_MAP.set(ident, meta);
    }
  } catch(_){ /* 注入失败则保持原逻辑 */ }

  // 若标签已存在且传入了新的文本，执行就地更新（重建该 Sprite）
  try {
    const ident2 = id || null;
    const has = !!ident2 && LABEL_MESHES.has(ident2);
    const hasText = (opt && typeof opt.text === 'string' && opt.text.length > 0);
    if (has && hasText) {
      const ctx = getRenderContext();
      const { THREE, globeGroup } = ctx || {};
      const prev = BASE_LABEL_MAP.get(ident2) || {};
      const baseVec3 = prev.baseVec3 || (Number.isFinite(opt.lon) && Number.isFinite(opt.lat) ? convertLatLonToVec3(Number(opt.lon), Number(opt.lat), 1.0) : null);
      const old = LABEL_MESHES.get(ident2);
      try {
        if (old) {
          globeGroup?.remove(old);
          old.material?.map?.dispose?.();
          old.material?.dispose?.();
        }
      } catch(_){ }
      if (ctx && THREE && globeGroup && baseVec3) {
        const isCity = !!prev.isCity || ((typeof ident2 === 'string') && /^CITY_/i.test(ident2));
        const px = isCity ? FONT_CITY_PX : FONT_COUNTRY_PX;
        const wh = isCity ? CITY_WORLD_HEIGHT : DEFAULT_WORLD_HEIGHT;
        const color = isCity ? CITY_TEXT_COLOR : COUNTRY_TEXT_COLOR;
        const strokeWidth = isCity ? CITY_STROKE_WIDTH : 3;
        const fontWeight = isCity ? CITY_FONT_WEIGHT : 600;
        const mesh = makeTextSprite(THREE, String(opt.text), { worldHeight: wh, padding: 14, strokeWidth, font: `${fontWeight} ${px}px ${CITY_FONT_FAMILY}` , color });
        if (mesh) {
          mesh.visible = false;
          const local = new THREE.Vector3(baseVec3.x, baseVec3.y, baseVec3.z).multiplyScalar(1 + LABEL_ALTITUDE);
          mesh.position.set(local.x, local.y, local.z);
          mesh.userData.baseScaleX = mesh.scale.x;
          mesh.userData.baseScaleY = mesh.scale.y;
          if (mesh.material) { mesh.material.depthTest = false; mesh.material.depthWrite = false; }
          mesh.renderOrder = 999;
          globeGroup.add(mesh);
          LABEL_MESHES.set(ident2, mesh);
        }
      }
      // 同步更新元数据中的文本
      const nextMeta = { ...prev, text: String(opt.text) };
      BASE_LABEL_MAP.set(ident2, nextMeta);
    }
  } catch(_){ }

  FORCED_ID = id || null;
  FORCED_SINCE = Date.now();
  // 取消脉动：选中仅做简单放大；不再设置任何脉动相关状态
  if (FORCED_ID) {
    const st = LABEL_STATES.get(FORCED_ID) || { alpha: 0, lastWinAt: 0 };
    // 清理历史脉动字段以避免旧状态影响
    delete st.pulsePending;
    delete st.pulseStart;
    delete st.pulseDur;
    LABEL_STATES.set(FORCED_ID, st);
  }
  // 自动清除（仅城市）：约5秒后移除强制，使其恢复为普通城市标签
  try { if (FORCED_CLEAR_TIMER) { clearTimeout(FORCED_CLEAR_TIMER); FORCED_CLEAR_TIMER = null; } } catch(_){}
  try {
    const isCity2 = (typeof FORCED_ID === 'string') && /^CITY_/i.test(FORCED_ID);
    if (isCity2) {
      FORCED_CLEAR_TIMER = setTimeout(() => {
        // 仅当强制目标仍是该城市时才清除，防止后续操作误清
        if ((typeof FORCED_ID === 'string') && /^CITY_/i.test(FORCED_ID)) {
          clearForcedLabel();
        }
        FORCED_CLEAR_TIMER = null;
      }, Math.max(2000, CITY_FORCED_AUTO_CLEAR_MS));
    }
  } catch(_){}
}
export function clearForcedLabel(){ FORCED_ID = null; }

// 新增：选中国家特征缓存（减少每帧查找开销）
let __selectedFeature = null;
function __resolveSelectedFeature(){
  try {
    if (!FORCED_ID) { __selectedFeature = null; return null; }
    // 已缓存且代码未变化时直接返回
    const lastCode = __resolveSelectedFeature.__lastCode || null;
    if (lastCode === FORCED_ID && __selectedFeature) return __selectedFeature;
    const feats = getCountries() || [];
    const codeUp = String(FORCED_ID || '').toUpperCase();
    const f = feats.find(feat => {
      const p = feat?.props || {};
      const a3 = String(p.ISO_A3 || '').toUpperCase();
      const a2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
      return codeUp && (a3 === codeUp || a2 === codeUp);
    }) || null;
    __selectedFeature = f;
    __resolveSelectedFeature.__lastCode = FORCED_ID;
    return f;
  } catch(_) { __selectedFeature = null; return null; }
}

// 新增：将给定经纬从选中国家中心沿径向“推”到边界之外
function __pushOutsideSelected(lon, lat, feature) {
  try {
    if (!feature) return null;
    // 若原本不在该国范围内，直接不处理
    if (!featureContains(lon, lat, feature)) return null;
    const b = feature.bbox || [-180,-90,180,90];
    const cLon = (b[0] + b[2]) * 0.5;
    const cLat = (b[1] + b[3]) * 0.5;
    let dLon = lon - cLon;
    let dLat = lat - cLat;
    // 退化情况：中心与标签几乎重合，给一个固定方向
    if (Math.abs(dLon) < 1e-3 && Math.abs(dLat) < 1e-3) { dLon = 0.6; dLat = 0.0; }
    // 逐步沿中心->标签方向外推，直到 featureContains 为 false
    const steps = 24;          // 最多尝试 24 次
    const stepMul = 0.12;      // 每步放大 12%
    const marginDeg = 0.25;    // 走出边界后的额外边距（度）
    let outLon = lon, outLat = lat;
    let k = 1.0;
    for (let i = 0; i < steps; i++) {
      const testLon = cLon + dLon * (k + stepMul);
      const testLat = cLat + dLat * (k + stepMul);
      if (!featureContains(testLon, testLat, feature)) {
        // 已在边界外：再沿同方向增加少许边距
        outLon = testLon + (dLon >= 0 ? marginDeg : -marginDeg);
        outLat = testLat + (dLat >= 0 ? marginDeg * 0.2 : -marginDeg * 0.2);
        break;
      }
      k += stepMul;
    }
    // 经纬度钳制，避免极点和经度越界
    const clampLat = v => Math.max(-85, Math.min(85, v));
    const normLon = v => { let x = v; while (x <= -180) x += 360; while (x > 180) x -= 360; return x; };
    outLon = normLon(outLon); outLat = clampLat(outLat);
    return convertLatLonToVec3(outLon, outLat, 1.0);
  } catch(_) { return null; }
}

// 新增：强制显示某些国家内的所有城市（点击国家后）
let FORCED_CITY_CODES = new Set();
export function setForcedCityCountries(list){
  try {
    const arr = Array.isArray(list) ? list : [list];
    FORCED_CITY_CODES = new Set(arr.map(x => String(x || '').toUpperCase()).filter(Boolean));
  } catch(_){ FORCED_CITY_CODES = new Set(); }
}
export function clearForcedCityCountries(){ FORCED_CITY_CODES = new Set(); }

// 新增：与页面层对齐的初始化方法（预计算 baseVec3）
export function initLabels(list){
  // --- 保留并继续执行原有的标签创建逻辑（改为 Sprite） ---
  const ctx = getRenderContext();
  const { THREE, globeGroup } = ctx || {};
  const arr = Array.isArray(list) ? list : [];

  // 清空旧的标签，避免重复创建
  LABEL_MESHES.forEach(mesh => {
    globeGroup?.remove(mesh);
    try { mesh.material?.map?.dispose?.(); mesh.material?.dispose?.(); } catch(_) {}
  });
  LABEL_MESHES.clear();

  BASE_LABELS = arr.map((lb, i) => {
    const lon = lb.lon;
    const lat = lb.lat;
    let baseVec3 = lb.baseVec3;
    if ((!baseVec3) && typeof lon === 'number' && typeof lat === 'number') {
      baseVec3 = convertLatLonToVec3(lon, lat, 1.0);
    }
    const id = lb.id ?? lb.text ?? String(i);
    const text = lb.text ?? lb.name ?? String(i);

    // 创建 Sprite 文本对象并加入球体分组
    if (ctx && THREE && globeGroup && baseVec3) {
      const isCity = !!lb.isCity;
      const px = isCity ? FONT_CITY_PX : FONT_COUNTRY_PX;
      const wh = isCity ? CITY_WORLD_HEIGHT : DEFAULT_WORLD_HEIGHT;
      const color = isCity ? CITY_TEXT_COLOR : COUNTRY_TEXT_COLOR;
      const strokeWidth = isCity ? CITY_STROKE_WIDTH : 3;
      // 根据 isCity 使用可配置的字体粗细，国家仍保持较粗以便辨识
      const fontWeight = isCity ? CITY_FONT_WEIGHT : 600; // 国家近似 Semibold
      const mesh = makeTextSprite(THREE, text, { worldHeight: wh, padding: 14, strokeWidth, font: `${fontWeight} ${px}px ${CITY_FONT_FAMILY}` , color });
      if (mesh) {
        mesh.visible = false;
        const local = new THREE.Vector3(baseVec3.x, baseVec3.y, baseVec3.z).multiplyScalar(1 + LABEL_ALTITUDE);
        mesh.position.set(local.x, local.y, local.z);
        // 记录基础缩放，便于按相机距离动态调整
        mesh.userData.baseScaleX = mesh.scale.x;
        mesh.userData.baseScaleY = mesh.scale.y;
        // 为避免在部分机型上被地球深度遮挡，关闭深度测试，仅保持透明度排序
        if (mesh.material) { mesh.material.depthTest = false; mesh.material.depthWrite = false; }
        mesh.renderOrder = 999;
        globeGroup.add(mesh);
        LABEL_MESHES.set(id, mesh);
        LABEL_STATES.set(id, { alpha: 0, lastWinAt: 0 });
      }
    }

    const meta = { ...lb, id, text, baseVec3 };
    BASE_LABEL_MAP.set(id, meta);
    return meta;
  });

  try { if (_const?.LABELS_DEBUG_LOG) console.info('[labels:init] meshes=', LABEL_MESHES.size, 'ctxReady=', !!ctx); } catch(_){}
}

// 可选：供外部查看当前 winners
let LAST_WINNERS = [];
export function getLastWinners() { return LAST_WINNERS; }

// —— 工具：将“世界坐标”投影为屏幕坐标（仅做视图-投影；不负责局部→世界转换）
function worldToScreen(worldPos, ctx) {
  const { THREE, camera, width, height } = ctx;

  // 裁剪坐标
  const clip = new THREE.Vector4(worldPos.x, worldPos.y, worldPos.z, 1.0);
  clip.applyMatrix4(camera.matrixWorldInverse);
  clip.applyMatrix4(camera.projectionMatrix);

  // w<=0 在相机背后；z 不在 [-w, w] 则在视锥外
  if (clip.w <= 0) return null;
  const ndcX = clip.x / clip.w, ndcY = clip.y / clip.w, ndcZ = clip.z / clip.w;
  if (ndcZ < -1 || ndcZ > 1) return null;

  // NDC -> 像素
  const x = (ndcX * 0.5 + 0.5) * width;
  const y = (-ndcY * 0.5 + 0.5) * height;

  return { x, y, ndcX, ndcY };
}

// —— 简单评分：可按需要替换（面积/人口/重要性）
function scoreLabel(lb) {
  // 优先使用外部提供的 score，其次用名称长度/人口/面积等自定义权重
  if (typeof lb.score === 'number') return lb.score;
  const base = 1.0;
  const bonus = (lb.population ? Math.log10(lb.population + 1) : 0)
              + (lb.area ? Math.log10(lb.area + 1) * 0.5 : 0);
  return base + bonus;
}

// —— 稳定伪随机：基于 id 产生 [0,1) 常数，避免每帧抖动
function stableRand(id){
  let h = 2166136261;
  const s = String(id);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24); }
  // 32位溢出处理
  h = h >>> 0;
  return (h % 1000) / 1000; // 0..0.999
}

// —— 估算屏幕像素尺寸：通过投影世界高度得到像素高度，宽度按比例
function estimatePixelSize(mesh, worldPos, normal, ctx){
  const { camera } = ctx;
  // 使用相机的世界“上/右”方向来估算 Sprite 的屏幕高度/宽度，避免法线方向误差
  const upW = new ctx.THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
  const rightW = new ctx.THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();

  const p2 = worldPos.clone().add(upW.multiplyScalar(mesh.scale.y));
  const p3 = worldPos.clone().add(rightW.multiplyScalar(mesh.scale.x));

  const sp1 = worldToScreen(worldPos, ctx);
  const sp2 = worldToScreen(p2, ctx);
  const sp3 = worldToScreen(p3, ctx);
  if (!sp1 || !sp2 || !sp3) return { w: GRID_SIZE, h: GRID_SIZE };
  const hpx = Math.abs(sp2.y - sp1.y);
  const wpx = Math.abs(sp3.x - sp1.x);
  return { w: Math.max(1, wpx), h: Math.max(1, hpx) };
}

// —— 网格碰撞
function makeGrid(width, height, cell) {
  const cols = Math.max(1, Math.ceil(width  / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const occ  = new Array(rows * cols).fill(0);
  return { cols, rows, cell, occ };
}
function tryOccupy(grid, x, y, w=1, h=1) {
  const { cols, rows, cell, occ } = grid;
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const gx = cx + dx, gy = cy + dy;
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return false;
      if (occ[gy * cols + gx]) return false;
    }
  }
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const gx = cx + dx, gy = cy + dy;
      occ[gy * cols + gx] = 1;
    }
  }
  return true;
}

// 预占一块圆形邻域：以高亮点屏幕坐标为中心，按照半径像素近似占用若干网格单元
function occupyAround(grid, x, y, radiusPx = GRID_SIZE) {
  if (!grid) return;
  const { cols, rows, cell, occ } = grid;
  // 至少占 1 单元；按半径转换为网格半径
  const r = Math.max(1, Math.round(radiusPx / Math.max(1, cell)));
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const gx = cx + dx, gy = cy + dy;
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
      occ[gy * cols + gx] = 1;
    }
  }
}

// —— 主过程：选择并计算本帧的标签（供页面调用）


// 可选：页面层每帧调用的更新方法
export function updateLabels(){
  const ctx = getRenderContext();
  if (!ctx) return;
  // 帧间隔（dt）与按帧自适应 alpha：alpha = 1 - exp(-dt/tau)
  const __now = Date.now();
  const __last = typeof updateLabels.__lastTime === 'number' ? updateLabels.__lastTime : __now;
  let __dt = __now - __last;
  // 防止极端卡顿或超高帧导致不稳定，做轻微钳制
  __dt = Math.max(8, Math.min(48, __dt));
  updateLabels.__lastTime = __now;
  const __alphaScale = 1 - Math.exp(-__dt / Math.max(10, SCALE_TAU_MS));
  // 避免日志刷屏：仅提示一次“尚未创建 Mesh”，后续静默
  if (LABEL_MESHES.size === 0 && !updateLabels.__warnedNoMeshes) {
    try { console.warn('[labels:update] no label meshes yet'); } catch(_){}
    updateLabels.__warnedNoMeshes = true;
  }
  const { THREE, camera, scene, globeGroup, width, height } = ctx;

  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  scene?.updateMatrixWorld?.(true);

  const globeCenter = new THREE.Vector3();
  globeGroup.getWorldPosition(globeCenter);
  // LOD 计算使用独立变量名，避免与后续动态缩放的 camDist 重复声明
  const camDistLOD = Math.max(0.1, camera.position.length());
  if (INIT_CAM_DIST === null) { INIT_CAM_DIST = camDistLOD; }
  const isFarByRatio = INIT_CAM_DIST ? (camDistLOD / INIT_CAM_DIST) >= FAR_DISTANCE_RATIO : false;

  // 城市强制高亮的短暂“缩放冻结”窗口：防止其他标签在2秒内出现突增导致的闪动
  const __forcedCityFreeze = (typeof FORCED_ID === 'string' && /^CITY_/i.test(FORCED_ID) && (Date.now() - FORCED_SINCE) < 2000);

  // 1) 预计算候选集及其评分/屏幕位置/尺寸
  const grid = makeGrid(width, height, GRID_SIZE);
  // 高亮城市点的避让：预先占用其周围若干网格，防止标签压住高亮光点
  try {
    const highlights = getHighlightedWorldPositions() || [];
    for (const h of highlights) {
      const sp = worldToScreen(h.world, ctx);
      if (sp) occupyAround(grid, sp.x, sp.y, Math.round(GRID_SIZE * 0.9)); // 约一格半径
    }
  } catch(_){ }
  const candidates = [];
  let maxScore = 0;
  for (const [id, mesh] of LABEL_MESHES.entries()) {
    // 诊断：若渲染上下文宽高为 0，则可能是未初始化尺寸或 canvas 查询失败
    if (!width || !height) {
      try { if (!globalThis.__labelsWarnedInvalidSizeOnce) { console.warn('[labels:update] width/height invalid:', width, height); globalThis.__labelsWarnedInvalidSizeOnce = true; } } catch(_){}
      return; // 退出以避免除以 0 导致异常
    }
    const meta = BASE_LABEL_MAP.get(id) || {};
    const world = new THREE.Vector3();
    mesh.getWorldPosition(world);

    const normal = world.clone().sub(globeCenter).normalize();
    const view   = camera.position.clone().sub(world).normalize();
    const dot    = normal.dot(view);
    if (dot <= LABEL_CUTOFF) { continue; }

    // 城市标签按距离分级显示（LOD）：远时不显示，近时逐步放开
    if (meta.isCity) {
      // 全局开关：允许关闭城市标签以提升整洁度或性能
      if (_const?.ENABLE_CITY_LABELS === false) { continue; }
      const imp = Number(meta.importance || 1);
      if (camDistLOD > LOD_CITIES_START_APPEAR) { continue; }
      if (imp < 2 && camDistLOD > LOD_CITIES_ALL_APPEAR) { continue; }
    }

    const sp = worldToScreen(world, ctx);
    if (!sp) { continue; }

    // 中心优先（0~1）：越靠近屏幕中心得分越高
    const centerWeight = Math.max(0, 1 - Math.hypot(sp.ndcX, sp.ndcY));
    // 远距限制：仅保留靠近中心的国家进入候选集（城市按 LOD 已过滤）
    if (isFarByRatio || camDistLOD > FAR_COUNTRY_ONLY_DIST) {
      if (meta.isCity) { continue; }
      if (centerWeight < FAR_CENTER_WEIGHT_MIN) { continue; }
    }

    // 基础得分（面积/人口等）+ 中心优先 + 稳定噪声 + 强制国家加成（不保证全部显示）
    const base = scoreLabel(meta) * AREA_WEIGHT;
    const noise = stableRand(id) * 0.35; // 稳定随机，提供“概率”感
    const isForcedCity = (meta.isCity && meta.country && FORCED_CITY_CODES.has(String(meta.country).toUpperCase()));
    const forcedBoost = isForcedCity ? 1.6 : 0; // 被选中国家城市加成更强
    let s = base + centerWeight * CENTER_PRIORITY + noise + forcedBoost;
    // 最中心区域的被选中国家城市“强保底”：避免被阈值淘汰
    if (isForcedCity && centerWeight >= 0.92) {
      s = Math.max(s, SCORE_THRESHOLD + 0.8);
    }
    if (s < SCORE_THRESHOLD) { continue; }
    if (s > maxScore) maxScore = s;

    // 估算屏幕尺寸，用于网格占位与碰撞规避
    const size = estimatePixelSize(mesh, world, normal, ctx);

    // 边缘淡出（简单按像素距离四边缘）
    const edgeFade = Math.min(
      sp.x / EDGE_FADE_PX,
      (width  - sp.x) / EDGE_FADE_PX,
      sp.y / EDGE_FADE_PX,
      (height - sp.y) / EDGE_FADE_PX
    );
    const edgeAlpha = Math.max(0, Math.min(1, edgeFade));

    candidates.push({ id, mesh, world, normal, sp, size, score: s, edgeAlpha, dot, centerWeight });
  }

  // 2) 分组排序：国家优先 + 预算保底 + 网格去重
  const countryCands = [];
  const cityCands = [];
  for (const c of candidates) {
    const meta = BASE_LABEL_MAP.get(c.id) || {};
    if (meta.isCity) cityCands.push(c); else countryCands.push(c);
  }
  countryCands.sort((a,b) => b.score - a.score);
  cityCands.sort((a,b) => b.score - a.score);

  // 动态城市预算（选中国家优先）：根据视距限制城市数量，避免密集拥挤
  let cityCandsFiltered = cityCands;
  let __showAllCitiesMode = false; // 少量城市时全部显示的模式
  try {
    const forcedCodes = new Set([...FORCED_CITY_CODES].map(s => String(s).toUpperCase()));
    const forcedCities = cityCands.filter(c => {
      const m = BASE_LABEL_MAP.get(c.id) || {};
      return m.isCity && m.country && forcedCodes.has(String(m.country).toUpperCase());
    });
    const forcedIds = new Set(forcedCities.map(c => c.id));
    const otherCities = cityCands.filter(c => !forcedIds.has(c.id));
    // 被选中国家：优先给到更大的预算（占总预算的 80%），近距离进一步扩充
    let budgetForced = CITY_BUDGET_MID;
    const effBudget = Math.max(0, Math.min(LABELS_BUDGET, Math.round(LABELS_BUDGET * 0.8)));
    if (camDistLOD >= FAR_COUNTRY_ONLY_DIST) {
      budgetForced = Math.min(CITY_BUDGET_FAR, effBudget);
    } else if (camDistLOD <= LOD_CITIES_ALL_APPEAR) {
      budgetForced = Math.max(CITY_BUDGET_NEAR, effBudget);
    }
    cityCandsFiltered = [
      ...forcedCities.slice(0, Math.max(0, budgetForced)),
      ...(camDistLOD <= LOD_CITIES_ALL_APPEAR ? otherCities : [])
    ];
    // 若城市候选数量不多，则开启“全部显示”模式（保留所有城市）
    const thr = _const?.CITY_SHOW_ALL_THRESHOLD ?? 12;
    if (Array.isArray(cityCands) && cityCands.length > 0 && cityCands.length <= thr && camDistLOD <= LOD_CITIES_START_APPEAR) {
      cityCandsFiltered = cityCands;
      __showAllCitiesMode = true;
    }
  } catch(_){ /* 容错：缺省仍按原逻辑 */ }

  const winners = new Set();
  let used = 0;
  // 2.0 居中城市硬保底：被选中国家且中心权重超过阈值的城市，先行放置
  let __mustCentral = [];
  try {
    const forcedCodes = new Set([...FORCED_CITY_CODES].map(s => String(s).toUpperCase()));
    const thrCenter = _const?.MUST_CENTER_WEIGHT_CITY ?? 0.94;
    __mustCentral = candidates.filter(c => {
      const m = BASE_LABEL_MAP.get(c.id) || {};
      const isForcedCity = m.isCity && m.country && forcedCodes.has(String(m.country).toUpperCase());
      return isForcedCity && (c.centerWeight || 0) >= thrCenter;
    });
    // 先尝试占位；如网格拥挤也直接加入 winners（允许少量重叠，保证稳定可见）
    for (const c of __mustCentral) {
      if (winners.has(c.id)) continue;
      let wCells = Math.max(1, Math.ceil(c.size.w / GRID_SIZE));
      let hCells = Math.max(1, Math.ceil(c.size.h / GRID_SIZE));
      wCells = Math.max(1, Math.floor(wCells * 0.6));
      hCells = Math.max(1, Math.floor(hCells * 0.6));
      if (!tryOccupy(grid, c.sp.x, c.sp.y, wCells, hCells)) {
        // 放弃占位但仍强制加入，稍后由透明度/边缘淡出缓冲
      }
      winners.add(c.id); used++;
      const st = LABEL_STATES.get(c.id) || { alpha: 0, lastWinAt: 0 };
      st.lastWinAt = Date.now();
      LABEL_STATES.set(c.id, st);
    }
  } catch(_){ /* 容错：保持原逻辑 */ }
  // 拖动中动态缩减预算（不改变外部设置），降低排序与网格冲突的压力
  const __budgetEff = __perfDrag ? Math.max(12, Math.round(LABELS_BUDGET * (_const?.PERF_DRAG_LABEL_BUDGET_SCALE ?? 0.7))) : LABELS_BUDGET;
  // 在“全部显示城市”模式下，为城市预留预算；同时预留居中保底城市数量
  const reserveCentral = (__mustCentral?.length || 0);
  const cityReserve = (__showAllCitiesMode ? Math.min(__budgetEff, cityCandsFiltered.length) : 0) + reserveCentral;
  const countryBudget = Math.max(0, Math.min(__budgetEff - cityReserve, COUNTRY_MIN_WINNERS));
  // 2.1 先放国家
  // 预计算：被选中国家代码集合（用于占位缩放）
  const __forcedCodesSet = new Set([...FORCED_CITY_CODES].map(s => String(s).toUpperCase()));
  for (const c of countryCands) {
    if (used >= countryBudget) break;
    const meta = BASE_LABEL_MAP.get(c.id) || {};
    let wCells = Math.max(1, Math.ceil(c.size.w / GRID_SIZE));
    let hCells = Math.max(1, Math.ceil(c.size.h / GRID_SIZE));
    // 被选中国家城市：占位略缩小，允许更密集显示
    if (meta.isCity && meta.country && __forcedCodesSet.has(String(meta.country).toUpperCase())) {
      wCells = Math.max(1, Math.floor(wCells * 0.7));
      hCells = Math.max(1, Math.floor(hCells * 0.7));
    }
    if (tryOccupy(grid, c.sp.x, c.sp.y, wCells, hCells)) {
      winners.add(c.id); used++;
      const st = LABEL_STATES.get(c.id) || { alpha: 0, lastWinAt: 0 };
      st.lastWinAt = Date.now();
      LABEL_STATES.set(c.id, st);
    }
  }
  // 2.2 剩余预算给城市 + 未放下的国家（若保底不足）
  // 在“全部显示城市”模式下，优先放城市；否则保持国家优先
  // 去掉已保底的居中城市，避免重复加入
  const __mustIds = new Set((__mustCentral||[]).map(c => c.id));
  const __cityTail = cityCandsFiltered.filter(c => !__mustIds.has(c.id));
  const tailOrder = __showAllCitiesMode ? [...__cityTail, ...countryCands.slice(used)] : [...countryCands.slice(used), ...__cityTail];
  for (const c of tailOrder) {
    if (used >= LABELS_BUDGET) break;
    const meta = BASE_LABEL_MAP.get(c.id) || {};
    let wCells = Math.max(1, Math.ceil(c.size.w / GRID_SIZE));
    let hCells = Math.max(1, Math.ceil(c.size.h / GRID_SIZE));
    // 被选中国家城市：占位略缩小，允许更密集显示
    if (meta.isCity && meta.country && __forcedCodesSet.has(String(meta.country).toUpperCase())) {
      wCells = Math.max(1, Math.floor(wCells * 0.7));
      hCells = Math.max(1, Math.floor(hCells * 0.7));
    }
    if (tryOccupy(grid, c.sp.x, c.sp.y, wCells, hCells)) {
      winners.add(c.id); used++;
      const st = LABEL_STATES.get(c.id) || { alpha: 0, lastWinAt: 0 };
      st.lastWinAt = Date.now();
      LABEL_STATES.set(c.id, st);
    }
  }

  // 2.3 远距模式：仅保留一个“中心国家”标签（在候选集中得分最高）
  if ((isFarByRatio || camDistLOD > FAR_COUNTRY_ONLY_DIST) && !FORCED_ID) {
    let best = null;
    for (const c of candidates) {
      const meta = BASE_LABEL_MAP.get(c.id) || {};
      if (meta.isCity) continue;
      if (!best || c.score > best.score) best = c;
    }
    if (best) {
      const only = new Set();
      only.add(best.id);
      // 覆盖 winners 为唯一中心国家
      winners.clear();
      winners.add(best.id);
    }
  }

  // 2.4 移除“无条件加入强制城市”的逻辑，改为前面评分加成，仍受预算与网格密度限制

  // 额外加入被强制的标签（不受预算与网格限制）
  if (FORCED_ID && LABEL_MESHES.has(FORCED_ID)) {
    winners.add(FORCED_ID);
    const st = LABEL_STATES.get(FORCED_ID) || { alpha: 0, lastWinAt: 0 };
    st.lastWinAt = Date.now();
    LABEL_STATES.set(FORCED_ID, st);
  }

  // 节流调试日志：避免每帧刷屏，仅每 1.5 秒输出一次
  try {
    if (_const?.LABELS_DEBUG_LOG) {
      const now = Date.now();
      const last = updateLabels.__lastDebug || 0;
      if (now - last >= 1500) {
        console.debug('[labels:update] candidates=', candidates.length, 'winners=', winners.size, 'budget=', __budgetEff, 'drag=', __perfDrag);
        updateLabels.__lastDebug = now;
      }
    }
  } catch(_){}

  LAST_WINNERS = candidates.filter(c => winners.has(c.id)).map(c => ({ id: c.id, x: c.sp.x, y: c.sp.y }));

  // 3) 更新可见性、透明度、按距离动态缩放
  const camDist = Math.max(0.1, camera.position.length());
  // 调整为“放大（靠近）时字体缩小、缩小时字体略变大”以提升密集区域可读性
  // 经验映射：near≈4→0.7，mid≈6→1.0，far≈8→1.3
  // 远距不再缩小：超过 FAR_FONT_STABLE_DIST，固定为 1.0；近距线性过渡到 0.7
  let distScale = 1.0;
  if (DYNAMIC_FONT_BY_DISTANCE) {
    const isFarNowByRatio = INIT_CAM_DIST ? (camDist / INIT_CAM_DIST) >= FAR_DISTANCE_RATIO : false;
    const near = _const?.NEAR_FONT_DIST ?? 4.0, far = FAR_FONT_STABLE_DIST;
    if (isFarNowByRatio || camDist >= far) {
      // 远距：按距离比例放大，保持屏幕字号基本恒定
      const base = INIT_CAM_DIST || camDist;
      distScale = Math.max(1.0, camDist / base);
    } else if (camDist <= near) {
      // 近距：适度缩小，缓解重叠
      distScale = _const?.NEAR_FONT_SCALE_MIN ?? 0.75; // 可由常量调节近距最小比例
    } else {
      // 中距：平滑过渡到 1.0
      const t = Math.max(0, Math.min(1, (camDist - near) / Math.max(1e-6, (far - near))));
      const nearMin = _const?.NEAR_FONT_SCALE_MIN ?? 0.75;
      distScale = nearMin + (1.0 - nearMin) * t; // nearMin ~ 1.0
    }
  }

  for (const [id, mesh] of LABEL_MESHES.entries()) {
    const isWin = winners.has(id);
    const meta = BASE_LABEL_MAP.get(id) || {};
    // 仅将被明确强制的标签视为高亮（国家被点击或搜索项）
    const isForced = (id === FORCED_ID);
    // 不再“推挤”周边国家的标签位置：选中某国时，其他标签保持原始位置与大小
    try {
      if (meta?.baseVec3) {
        const pos = meta.baseVec3;
        const local = new ctx.THREE.Vector3(pos.x, pos.y, pos.z).multiplyScalar(1 + LABEL_ALTITUDE);
        mesh.position.set(local.x, local.y, local.z);
      }
    } catch(_){ }
    const world = new THREE.Vector3();
    mesh.getWorldPosition(world);
    const normal = world.clone().sub(globeCenter).normalize();
    const view   = camera.position.clone().sub(world).normalize();
    const dot    = normal.dot(view);
    let alpha = (dot - LABEL_CUTOFF) / Math.max(1e-6, (LABEL_FADEIN - LABEL_CUTOFF));
    if (isForced) { alpha = 1; }
    if (alpha <= 0) { mesh.visible = false; continue; }
    if (alpha > 1) alpha = 1;

    const sp = worldToScreen(world, ctx);
    if (!sp) { mesh.visible = false; continue; }
    const edgeFade = Math.min(
      sp.x / EDGE_FADE_PX,
      (width  - sp.x) / EDGE_FADE_PX,
      sp.y / EDGE_FADE_PX,
      (height - sp.y) / EDGE_FADE_PX
    );
    const target = isForced
      ? 1
      : alpha * Math.max(0, Math.min(1, edgeFade)) * (isWin ? 1 : 0);

    // 粘性与透明度平滑：失去入选后在 STICKY_MS 内缓慢淡出
    const st = LABEL_STATES.get(id) || { alpha: 0, lastWinAt: 0 };
    const sticky = (Date.now() - (st.lastWinAt || 0)) < STICKY_MS;
    const targetAlpha = isForced ? 1 : (isWin ? target : (sticky ? Math.max(0, st.alpha * 0.85) : 0));
    const nextAlpha = st.alpha * (1 - OPACITY_FOLLOW) + targetAlpha * OPACITY_FOLLOW;
    st.alpha = nextAlpha; LABEL_STATES.set(id, st);

    const finalAlpha = nextAlpha;
    const vis = finalAlpha > 0.02;
    mesh.visible = vis;
      if (mesh.material) {
        mesh.material.transparent = true;
        mesh.material.opacity = finalAlpha;
        // 选中高亮：把文字整体轻微着色并加一点放大
        // 说明：SpriteMaterial 的 color 会对纹理乘色，不影响原始贴图；
        // 强制标签颜色策略：
        // 城市→保持原来的城市文字颜色（白/淡蓝），只放大；国家→琥珀色以示选中。
        try {
          if (isForced) {
            const forcedColor = (meta && meta.isCity) ? (CITY_TEXT_COLOR || '#d7e1ea') : '#ffd54f';
            if (!mesh.material.color || typeof mesh.material.color.set !== 'function') {
              mesh.material.color = new ctx.THREE.Color(forcedColor);
            } else {
              mesh.material.color.set(forcedColor);
            }
          } else {
            const defaultColor = meta.isCity ? CITY_TEXT_COLOR : COUNTRY_TEXT_COLOR;
            if (!mesh.material.color || typeof mesh.material.color.set !== 'function') {
              mesh.material.color = new ctx.THREE.Color(defaultColor);
            } else {
              mesh.material.color.set(defaultColor);
            }
          }
        } catch(_){ /* 容错：不同平台材质对象差异 */ }
      }
    // 跟随相机距离动态缩放，提升缩放体验（靠近时减小字体，远离时略增大）
    if (mesh.userData && typeof mesh.userData.baseScaleX === 'number') {
      // 高亮基准放大：仅在强制高亮时生效。取消脉动，改为“稳定增大”。
      // 保留原有放大比例以维持辨识度：城市≈+90%，国家≈+20%。
      const highlightBase = isForced ? (meta.isCity ? 2.00 : 1.20) : 1.0;
      const scaleMul = highlightBase;
      // 平滑缩放：使用指数跟随，避免每帧硬跳造成“卡顿感”
      const targetX = mesh.userData.baseScaleX * distScale * scaleMul;
      const targetY = mesh.userData.baseScaleY * distScale * scaleMul;
      const st2 = LABEL_STATES.get(id) || {};
      const prevX = typeof st2.scaleX === 'number' ? st2.scaleX : targetX;
      const prevY = typeof st2.scaleY === 'number' ? st2.scaleY : targetY;
      const nextX = prevX * (1 - __alphaScale) + targetX * __alphaScale;
      const nextY = prevY * (1 - __alphaScale) + targetY * __alphaScale;
      mesh.scale.set(nextX, nextY, 1);
      // 像素级最大/最小字号钳制：根据当前屏幕投影的像素高度调整
      const sizeNow = estimatePixelSize(mesh, world, normal, ctx);
      const isCity = !!meta.isCity;
      const baseMaxPxFar = isCity ? FONT_MAX_SCREEN_PX_CITY : FONT_MAX_SCREEN_PX_COUNTRY;
      const minPx = isCity ? FONT_MIN_SCREEN_PX_CITY : FONT_MIN_SCREEN_PX_COUNTRY;
      // 随相机距离动态上限：越近上限越接近 minPx，越远上限越接近 baseMaxPxFar
      const nearDist = _const?.NEAR_FONT_DIST ?? 4.0;
      const farDist  = FAR_FONT_STABLE_DIST;
      const tZoom = Math.max(0, Math.min(1, (camDist - nearDist) / Math.max(1e-6, (farDist - nearDist))));
      const baseMaxPxDyn = Math.round(minPx + (baseMaxPxFar - minPx) * tZoom);
      let maxPx = baseMaxPxDyn;
      if (isForced) {
        if (meta && meta.isCity) {
          // 城市选中：仅放大，不改变颜色。放宽上限，确保“更大”。
          maxPx = Math.round(baseMaxPxDyn * 2.0);
        } else {
          // 国家选中：保持上限为动态值。
          maxPx = baseMaxPxDyn;
        }
      }
      const h = sizeNow.h;
      // 冻结策略：在城市被强制高亮的短窗口期，非强制标签不允许“向上增大”，仅允许按需减小
      if (!isForced && __forcedCityFreeze && h > 0) {
        maxPx = Math.min(maxPx, h);
      }
      if (h > maxPx && h > 0) {
        const r = maxPx / h;
        const clampedX = mesh.scale.x * r;
        const clampedY = mesh.scale.y * r;
        // 软钳制：用按帧 alpha 缓慢趋近，避免硬剪切导致的视觉抖动
        mesh.scale.set(
          mesh.scale.x * (1 - __alphaScale) + clampedX * __alphaScale,
          mesh.scale.y * (1 - __alphaScale) + clampedY * __alphaScale,
          1
        );
      } else if (h < minPx && h > 0) {
        const r = minPx / h;
        const clampedX = mesh.scale.x * r;
        const clampedY = mesh.scale.y * r;
        mesh.scale.set(
          mesh.scale.x * (1 - __alphaScale) + clampedX * __alphaScale,
          mesh.scale.y * (1 - __alphaScale) + clampedY * __alphaScale,
          1
        );
      }
      // 记录当前缩放用于下一帧的平滑跟随
      st2.scaleX = mesh.scale.x;
      st2.scaleY = mesh.scale.y;
      LABEL_STATES.set(id, st2);
    }
  }
}
