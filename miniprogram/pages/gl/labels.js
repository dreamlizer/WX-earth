// labels.js  —— 仅此文件，无需改动其他文件
// 目标：标签只在前半球可见、靠近地平线渐隐；屏幕边缘渐隐；网格碰撞与预算；矩阵每帧刷新。
// 依赖：main.js 导出 getRenderContext()；项目内已存在 THREE、globeGroup、camera 等。

import { getRenderContext } from './main.js';
import { convertLatLonToVec3 } from './geography.js';
// 引入 troika-three-text，并在小程序环境禁用 WebWorker（否则无法工作）
// 移除原有的 require 代码块，只保留变量声明
let Text, configureTextBuilder;
let isTroikaInitialized = false; // 新增一个标志位，确保只初始化一次


// 尝试读取你项目中已有的常量；不存在则给安全默认值（不影响你已有配置）
import * as _const from './label-constants.js';

const LABEL_ALTITUDE   = _const?.LABEL_ALTITUDE   ?? 0.02;  // 标签相对球面抬升
const GRID_SIZE        = _const?.GRID_SIZE        ?? 64;    // 屏幕碰撞网格像素
const MAX_LABELS_BUDGET= _const?.MAX_LABELS_BUDGET?? 220;   // 单帧最多渲染标签数
const SCORE_THRESHOLD  = _const?.SCORE_THRESHOLD  ?? 0.0;   // 过滤低分项（保守取 0）
const LABEL_CUTOFF     = _const?.LABEL_CUTOFF     ?? 0.00;  // 前半球淡入阈值（点积）
const LABEL_FADEIN     = _const?.LABEL_FADEIN     ?? 0.35;  // 从 CUTOFF->FADEIN 线性淡入
const EDGE_FADE_PX     = _const?.EDGE_FADE_PX     ?? 28;    // 屏幕四边像素淡出
const OPACITY_FOLLOW   = _const?.OPACITY_FOLLOW   ?? 0.35;  // 简单平滑系数（0~1）

// 基础标签数据（由页面 or onCountriesLoaded 设置）：
// 每项结构约定：{ name, lon, lat, baseVec3?, score? ... }
let BASE_LABELS = [];
export function setBaseLabels(list) {
  BASE_LABELS = Array.isArray(list) ? list : [];
}
// 管理 3D 文本网格
const LABEL_MESHES = new Map(); // id -> Text Mesh
const DEFAULT_FONT_URL = (typeof _const?.LABEL_FONT_URL === 'string') ? _const.LABEL_FONT_URL : '';
const DEFAULT_FONT_SIZE_WORLD = 0.06; // 以球半径=1为基准的世界单位大小

// 新增：与页面层对齐的初始化方法（预计算 baseVec3）
export function initLabels(list){
  // --- 新增：一次性初始化 Troika 库 ---
  if (!isTroikaInitialized) {
    const ctxInit = getRenderContext();
    if (!ctxInit || !ctxInit.THREE) {
      console.error('[labels] 无法初始化 Troika，因为 THREE context 尚未准备好。');
      return;
    }
    const { THREE: THREEInit } = ctxInit;

    // 在加载 UMD 模块前，临时将 THREE 暴露到全局作用域
    // UMD 若无法通过 require 获取依赖，会尝试从全局对象查找
    try {
      // 不同运行环境下全局对象可能是 globalThis/self/window，这里统一使用 globalThis
      globalThis.THREE = THREEInit;
      const troika = require('../../libs/troika-three-text.min.js');
      Text = troika.Text;
      configureTextBuilder = troika.configureTextBuilder;
      if (configureTextBuilder) {
        configureTextBuilder({ useWorker: false });
      }
      isTroikaInitialized = true;
    } catch(e) {
      console.error('[labels] 加载 troika-three-text 失败:', e);
      return; // 加载失败，直接返回
    } finally {
      // 无论成功与否，加载后都立即清理临时全局变量
      try { delete globalThis.THREE; } catch(_) {}
    }
  }
  // --- 初始化结束 ---

  // --- 保留并继续执行原有的标签创建逻辑 ---
  const ctx = getRenderContext();
  const { THREE, globeGroup } = ctx || {};
  const arr = Array.isArray(list) ? list : [];

  if (!Text) {
    console.warn('[labels] Troika Text 类不可用，初始化中止。');
    return;
  }

  // 清空旧的标签，避免重复创建
  LABEL_MESHES.forEach(mesh => {
    globeGroup?.remove(mesh);
    // 尝试释放资源（troika Text 有自身的内部材质/几何体）
    try { mesh.dispose?.(); } catch(_) {}
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

    // 创建 troika 文本对象并加入球体分组
    if (ctx && THREE && globeGroup && baseVec3 && Text) {
      const mesh = new Text();
      mesh.text = text;
      if (DEFAULT_FONT_URL) mesh.font = DEFAULT_FONT_URL;
      mesh.fontSize = DEFAULT_FONT_SIZE_WORLD;
      mesh.color = 0xffffff;
      mesh.anchorX = 'center';
      mesh.anchorY = 'middle';
      mesh.visible = false;
      const local = new THREE.Vector3(baseVec3.x, baseVec3.y, baseVec3.z).multiplyScalar(1 + LABEL_ALTITUDE);
      mesh.position.set(local.x, local.y, local.z);
      globeGroup.add(mesh);
      mesh.sync();
      LABEL_MESHES.set(id, mesh);
    }

    return { ...lb, id, text, baseVec3 };
  });
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

// —— 主过程：选择并计算本帧的标签（供页面调用）


// 可选：页面层每帧调用的更新方法
export function updateLabels(){
  const ctx = getRenderContext();
  if (!ctx) return;
  const { THREE, camera, scene, globeGroup, width, height } = ctx;

  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  scene?.updateMatrixWorld?.(true);

  const globeCenter = new THREE.Vector3();
  globeGroup.getWorldPosition(globeCenter);

  // 遍历所有文本网格，根据视角更新可见性与透明度
  for (const [id, mesh] of LABEL_MESHES.entries()) {
    // 计算世界坐标
    const world = new THREE.Vector3();
    mesh.getWorldPosition(world);

    // 前半球淡入逻辑（点积）
    const normal = world.clone().sub(globeCenter).normalize();
    const view   = camera.position.clone().sub(world).normalize();
    const dot    = normal.dot(view);
    if (dot <= LABEL_CUTOFF) { mesh.visible = false; continue; }
    let alpha = (dot - LABEL_CUTOFF) / Math.max(1e-6, (LABEL_FADEIN - LABEL_CUTOFF));
    if (alpha <= 0) { mesh.visible = false; continue; }
    if (alpha > 1) alpha = 1;

    // 视锥/投影与屏幕边缘淡出
    const sp = worldToScreen(world, ctx);
    if (!sp) { mesh.visible = false; continue; }
    const edgeFade = Math.min(
      sp.x / EDGE_FADE_PX,
      (width  - sp.x) / EDGE_FADE_PX,
      sp.y / EDGE_FADE_PX,
      (height - sp.y) / EDGE_FADE_PX
    );
    alpha *= Math.max(0, Math.min(1, edgeFade));
    if (alpha <= 0.02) { mesh.visible = false; continue; }

    // 更新朝向与透明度
    mesh.visible = true;
    // 让文本始终面向相机，避免侧向压扁
    if (mesh.material) {
      mesh.material.transparent = true;
      mesh.material.opacity = alpha;
    }
  }
}
