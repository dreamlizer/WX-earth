
// labels.js —— 协调者 (Controller)
// 职责：串联 Data(数据)、Layout(布局)、Render(渲染) 模块，实现标签系统的核心循环

import { getRenderContext } from './main.js';
import { getHighlightedWorldPositions } from './city-markers.js';
import { LabelsData, stableRand } from './labels-data.js';
import { LabelsRender } from './labels-render.js';
import { LabelsLayout } from './labels-layout.js';
import { createLabelFrameWorkset, resetLabelFrameWorkset, nextLabelCandidate, copyForcedCodes } from './labels-workset.js';
import * as _const from './label-constants.js';

// —— 配置参数 (Controller 层关注的) ——
let LABELS_BUDGET = _const?.MAX_LABELS_BUDGET ?? 16;
let __perfDrag = false; // 性能模式开关

const LABEL_CUTOFF = _const?.LABEL_CUTOFF ?? 0.00;
const LABEL_FADEIN = _const?.LABEL_FADEIN ?? 0.35;
const LABEL_DEPTH_BACK_DOT = _const?.LABEL_DEPTH_BACK_DOT ?? 0.0;
const EDGE_FADE_PX = _const?.EDGE_FADE_PX ?? 28;
const OPACITY_FOLLOW = _const?.OPACITY_FOLLOW ?? 0.25;
const SCALE_FOLLOW = _const?.SCALE_FOLLOW ?? 0.22;
const SCALE_TAU_MS = _const?.SCALE_TAU_MS ?? 85;
const CENTER_PRIORITY = _const?.CENTER_PRIORITY ?? 1.2;
const AREA_WEIGHT = _const?.AREA_WEIGHT ?? 1.0;
const SCORE_THRESHOLD = _const?.SCORE_THRESHOLD ?? 0.0;

// 距离相关常量
const DYNAMIC_FONT_BY_DISTANCE = _const?.DYNAMIC_FONT_BY_DISTANCE ?? true;
const FAR_FONT_STABLE_DIST = _const?.FAR_FONT_STABLE_DIST ?? 8.0;
const FAR_COUNTRY_ONLY_DIST = _const?.FAR_COUNTRY_ONLY_DIST ?? 7.8;
const FAR_CENTER_WEIGHT_MIN = _const?.FAR_CENTER_WEIGHT_MIN ?? 0.70;
const FAR_DISTANCE_RATIO = _const?.FAR_DISTANCE_RATIO ?? 1.25;
const LOD_CITIES_START_APPEAR = _const?.LOD_CITIES_START_APPEAR ?? 3.2;
const LOD_CITIES_ALL_APPEAR = _const?.LOD_CITIES_ALL_APPEAR ?? 2.2;
const CITY_BUDGET_NEAR = _const?.CITY_BUDGET_NEAR ?? 48;
const CITY_BUDGET_MID = _const?.CITY_BUDGET_MID ?? 24;
const CITY_BUDGET_FAR = _const?.CITY_BUDGET_FAR ?? 12;
const COUNTRY_MIN_WINNERS = _const?.COUNTRY_MIN_WINNERS ?? 6;
const STICKY_MS = 900;
const LABEL_ALTITUDE = _const?.LABEL_ALTITUDE ?? 0.02;

// 字体大小限制 (Screen PX)
const FONT_MAX_SCREEN_PX_COUNTRY = _const?.FONT_MAX_SCREEN_PX_COUNTRY ?? 32;
const FONT_MAX_SCREEN_PX_CITY = _const?.FONT_MAX_SCREEN_PX_CITY ?? 13;
const FONT_MIN_SCREEN_PX_COUNTRY = _const?.FONT_MIN_SCREEN_PX_COUNTRY ?? 26;
const FONT_MIN_SCREEN_PX_CITY = _const?.FONT_MIN_SCREEN_PX_CITY ?? 10;
const DEFAULT_WORLD_HEIGHT = _const?.DEFAULT_WORLD_HEIGHT ?? 0.125;
const CITY_WORLD_HEIGHT = _const?.CITY_WORLD_HEIGHT ?? 0.070;

let INIT_CAM_DIST = null;

// 临时对象池
let __tmp = null;
let __camPos = null;

// —— 导出 API ——

export function setLabelsBudget(n){
  const v = Number(n);
  if (!isNaN(v) && v >= 0) LABELS_BUDGET = v;
}

export function setPerfMode(on){ __perfDrag = !!on; }

export function setBaseLabels(list) {
  LabelsData.init(list);
}

export function initLabels(list) {
  const ctx = getRenderContext();
  if (ctx && ctx.globeGroup) {
    LabelsRender.clearAll(ctx.globeGroup);
  }
  LabelsData.init(list);
}

export function setForcedLabel(id, opt = {}) {
  // 1. 数据层注入
  LabelsData.ensureTempLabel(id, opt);
  
  // 2. 状态更新
  LabelsData.setForcedId(id);
  
  // 3. UI 立即响应
  // 如果 Mesh 已存在且文本变更，需重建
  if (id && opt && opt.text) {
     const meta = LabelsData.getMeta(id);
     if (meta && String(meta.text) !== String(opt.text)) {
        LabelsData.updateLabelText(id, opt.text);
        const ctx = getRenderContext();
        if (ctx) LabelsRender.rebuildMesh(id, meta, ctx);
     }
  }

  // 4. 重置动画状态
  if (id) LabelsRender.resetState(id);
}

export function clearForcedLabel() {
  LabelsData.clearForcedLabel();
}

export function forceHideAllMeshes() {
  setLabelsBudget(0);
  clearForcedLabel();
  LabelsRender.forceHideAll();
}

export function setForcedCityCountries(list) {
  LabelsData.setForcedCityCountries(list);
}

export function clearForcedCityCountries() {
  LabelsData.clearForcedCityCountries();
}

// —— 核心循环 ——

export function updateLabels() {
  const ctx = getRenderContext();
  const { THREE, camera, scene, globeGroup, width, height } = ctx || {};
  if (!THREE || !camera || !globeGroup || !width || !height) return;
  const nowMs = Date.now();

  // 初始化临时变量
  if (!__tmp) {
    __tmp = {
      world: new THREE.Vector3(),
      world2: new THREE.Vector3(),
      globeCenter: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      normal2: new THREE.Vector3(),
      view: new THREE.Vector3(),
      view2: new THREE.Vector3(),
      local: new THREE.Vector3(),
      screen: {},
      forcedScreen: {},
      winSpMap: new Map(),
      workset: createLabelFrameWorkset()
    };
    __camPos = new THREE.Vector3();
  }
  
  camera.getWorldPosition(__camPos);
  globeGroup.getWorldPosition(__tmp.globeCenter);
  
  // 更新矩阵
  camera.updateMatrixWorld(true);
  scene?.updateMatrixWorld?.(true);

  const camDistLOD = Math.max(0.1, camera.position.length());
  if (INIT_CAM_DIST === null) { INIT_CAM_DIST = camDistLOD; }
  const isFarByRatio = INIT_CAM_DIST ? (camDistLOD / INIT_CAM_DIST) >= FAR_DISTANCE_RATIO : false;

  // 1. 准备候选集
  const grid = LabelsLayout.makeGrid(width, height);
  const workset = resetLabelFrameWorkset(__tmp.workset);
  
  // 高亮避让
  try {
    const highlights = getHighlightedWorldPositions() || [];
    for (const h of highlights) {
      const sp = LabelsLayout.worldToScreen(h.world, ctx, __tmp.screen);
      if (sp) LabelsLayout.occupyAround(grid, sp.x, sp.y, Math.round(grid.cell * 0.9));
    }
  } catch(_){}

  // 小国家模式判断
  let __forceAllCitiesCountry = null;
  try {
    const fid = LabelsData.FORCED_ID;
    let currentCode = null;
    if (fid) {
      const m = LabelsData.getMeta(fid);
      if (m) {
        if (m.isCity && m.country) currentCode = m.country;
        else if (!m.isCity) currentCode = m.country || m.id;
      } else if (/^[A-Z]{2,3}$/i.test(fid)) {
        currentCode = fid;
      }
    }
    if (currentCode) {
      const codeUp = String(currentCode).toUpperCase();
      let cityCount = 0;
      for (const lb of LabelsData.BASE_LABELS) {
        if (lb.isCity && lb.country && String(lb.country).toUpperCase() === codeUp) {
          cityCount++;
          if (cityCount > 5) break;
        }
      }
      if (cityCount > 0 && cityCount <= 5) __forceAllCitiesCountry = codeUp;
    }
  } catch(_){}

  const candidates = workset.candidates;
  let maxScore = 0;

  for (const meta of LabelsData.BASE_LABELS) {
    const id = meta.id;
    const mesh = LabelsRender.LABEL_MESHES.get(id);

    // 计算位置
    if (mesh) {
      mesh.getWorldPosition(__tmp.world);
    } else {
      if (!meta.baseVec3) continue;
      __tmp.world.copy(meta.baseVec3).multiplyScalar(1 + LABEL_ALTITUDE).applyMatrix4(globeGroup.matrixWorld);
    }

    // 背面剔除
    const normal = __tmp.normal.copy(__tmp.world).sub(__tmp.globeCenter).normalize();
    const view = __tmp.view.copy(__camPos).sub(__tmp.world).normalize();
    if (normal.dot(view) < LABEL_DEPTH_BACK_DOT) continue;

    // LOD & 强制显隐
    const isSmallCountryCity = __forceAllCitiesCountry && meta.isCity && meta.country && String(meta.country).toUpperCase() === __forceAllCitiesCountry;
    const isForcedCity = (meta.isCity && meta.country && LabelsData.FORCED_CITY_CODES.has(String(meta.country).toUpperCase()));

    if (meta.isCity) {
      if (_const?.ENABLE_CITY_LABELS === false) continue;
      if (camDistLOD > LOD_CITIES_START_APPEAR) continue;
    }

    const scratch = meta.__labelScratch || (meta.__labelScratch = { screen: {}, size: {}, fallbackMesh: { scale: { x: 1, y: 1 } } });
    const sp = LabelsLayout.worldToScreen(__tmp.world, ctx, scratch.screen);
    if (!sp) continue;

    const centerWeight = Math.max(0, 1 - Math.hypot(sp.ndcX, sp.ndcY));
    
    // 远距过滤
    if ((isFarByRatio || camDistLOD > FAR_COUNTRY_ONLY_DIST) && !isSmallCountryCity && !isForcedCity) {
      if (meta.isCity) continue;
      if (centerWeight < FAR_CENTER_WEIGHT_MIN) continue;
    }

    const base = (meta._score || 1.0) * AREA_WEIGHT;
    const noise = stableRand(id) * 0.35;
    const forcedBoost = isForcedCity ? 3.5 : 0;
    let s = base + centerWeight * CENTER_PRIORITY + noise + forcedBoost;
    
    if (isSmallCountryCity) s += 10000;
    else if (isForcedCity && centerWeight >= 0.92) s = Math.max(s, SCORE_THRESHOLD + 0.8);
    
    if (s < SCORE_THRESHOLD) continue;
    if (s > maxScore) maxScore = s;

    // 估算尺寸
    let size;
    if (mesh) {
      size = LabelsLayout.estimatePixelSize(mesh, __tmp.world, ctx, scratch.size);
    } else {
      const wh = meta.isCity ? CITY_WORLD_HEIGHT : DEFAULT_WORLD_HEIGHT;
      const aspect = (meta.text.length * 0.6) + (meta.isCity ? 0.8 : 0.4);
      scratch.fallbackMesh.scale.x = wh * aspect;
      scratch.fallbackMesh.scale.y = wh;
      size = LabelsLayout.estimatePixelSize(scratch.fallbackMesh, __tmp.world, ctx, scratch.size);
    }

    // 边缘淡出
    const edgeFade = Math.min(
      sp.x / EDGE_FADE_PX,
      (width - sp.x) / EDGE_FADE_PX,
      sp.y / EDGE_FADE_PX,
      (height - sp.y) / EDGE_FADE_PX
    );
    const edgeAlpha = Math.max(0, Math.min(1, edgeFade));

    const candidate = nextLabelCandidate(workset);
    candidate.id = id;
    candidate.mesh = mesh;
    candidate.meta = meta;
    candidate.sp = sp;
    candidate.size = size;
    candidate.score = s;
    candidate.edgeAlpha = edgeAlpha;
    candidate.centerWeight = centerWeight;
    candidate.isSmallCountryCity = isSmallCountryCity;
    candidates.push(candidate);
  }

  // 2. 排序与预算
  const countryCands = workset.countryCands;
  const cityCands = workset.cityCands;
  for (const c of candidates) {
    const meta = c.meta || LabelsData.getMeta(c.id);
    if (meta.isCity) cityCands.push(c); else countryCands.push(c);
  }
  countryCands.sort((a,b) => b.score - a.score);
  cityCands.sort((a,b) => b.score - a.score);

  // 城市筛选
  let cityCandsFiltered = workset.cityCandsFiltered;
  for (const c of cityCands) cityCandsFiltered.push(c);
  let __showAllCitiesMode = false;
  const forcedCodesSet = copyForcedCodes(workset, LabelsData.FORCED_CITY_CODES, __forceAllCitiesCountry);

  const forcedCities = workset.forcedCities;
  for (const c of cityCands) {
    const m = c.meta || LabelsData.getMeta(c.id);
    if (m.isCity && m.country && forcedCodesSet.has(String(m.country).toUpperCase())) forcedCities.push(c);
  }
  
  // 计算有效预算
  let budgetForced = CITY_BUDGET_MID;
  const effBudget = Math.max(0, Math.min(LABELS_BUDGET, Math.round(LABELS_BUDGET * 0.8)));
  if (camDistLOD >= FAR_COUNTRY_ONLY_DIST) budgetForced = Math.min(CITY_BUDGET_FAR, effBudget);
  else if (camDistLOD <= LOD_CITIES_ALL_APPEAR) budgetForced = Math.max(CITY_BUDGET_NEAR, effBudget);

  if (__forceAllCitiesCountry) {
    let smallCount = 0;
    for (const c of forcedCities) if (c.isSmallCountryCity) smallCount++;
    if (smallCount > 0) budgetForced = Math.max(budgetForced, smallCount);
  }

  const forcedCityIds = workset.forcedCityIds;
  for (const c of forcedCities) forcedCityIds.add(c.id);
  const otherCities = workset.otherCities;
  for (const c of cityCands) {
    if (!forcedCityIds.has(c.id)) otherCities.push(c);
  }
  
  cityCandsFiltered.length = 0;
  const forcedLimit = Math.max(0, budgetForced);
  for (let i = 0; i < forcedCities.length && i < forcedLimit; i++) cityCandsFiltered.push(forcedCities[i]);
  if (camDistLOD <= LOD_CITIES_ALL_APPEAR) {
    for (const c of otherCities) cityCandsFiltered.push(c);
  }

  const thr = _const?.CITY_SHOW_ALL_THRESHOLD ?? 12;
  if (cityCands.length > 0 && cityCands.length <= thr && camDistLOD <= LOD_CITIES_START_APPEAR) {
    cityCandsFiltered = cityCands;
    __showAllCitiesMode = true;
  }

  const winners = workset.winners;
  let used = 0;
  
  // 居中保底
  const __mustCentral = workset.mustCentral;
  const thrCenter = _const?.MUST_CENTER_WEIGHT_CITY ?? 0.75;
  for (const c of candidates) {
    const m = c.meta || LabelsData.getMeta(c.id);
    const isForcedCity = m.isCity && m.country && forcedCodesSet.has(String(m.country).toUpperCase());
    if (isForcedCity && (c.centerWeight || 0) >= thrCenter) __mustCentral.push(c);
  }

  for (const c of __mustCentral) {
    if (winners.has(c.id)) continue;
    let wCells = Math.max(1, Math.ceil(c.size.w / grid.cell));
    let hCells = Math.max(1, Math.ceil(c.size.h / grid.cell));
    wCells = Math.max(1, Math.floor(wCells * 0.6));
    hCells = Math.max(1, Math.floor(hCells * 0.6));
    if (!LabelsLayout.tryOccupy(grid, c.sp.x, c.sp.y, wCells, hCells)) {
      LabelsLayout.occupyForce(grid, c.sp.x, c.sp.y, wCells, hCells);
    }
    winners.add(c.id); used++;
    const st = LabelsRender.LABEL_STATES.get(c.id) || { alpha: 0, lastWinAt: 0 };
    st.lastWinAt = nowMs;
    LabelsRender.LABEL_STATES.set(c.id, st);
  }

  // 最终预算
  const __budgetEff = __perfDrag ? Math.max(12, Math.round(LABELS_BUDGET * (_const?.PERF_DRAG_LABEL_BUDGET_SCALE ?? 0.7))) : LABELS_BUDGET;
  const reserveCentral = (__mustCentral?.length || 0);
  const cityReserve = (__showAllCitiesMode ? Math.min(__budgetEff, cityCandsFiltered.length) : 0) + reserveCentral;
  
  const PRIORITY_FLIP_DIST = Math.max(1.5, LOD_CITIES_START_APPEAR - 1.5);
  const isCityPriority = (camDistLOD <= PRIORITY_FLIP_DIST);
  const dynamicCountryMin = isCityPriority ? 6 : COUNTRY_MIN_WINNERS;
  const countryBudget = Math.max(0, Math.min(__budgetEff - cityReserve, dynamicCountryMin));

  const __mustIds = workset.mustIds;
  for (const c of __mustCentral) __mustIds.add(c.id);
  const citiesQueue = workset.citiesQueue;
  for (const c of cityCandsFiltered) {
    if (!__mustIds.has(c.id)) citiesQueue.push(c);
  }
  
  const tryPlace = (c) => {
    if (used >= __budgetEff) return false;
    if (winners.has(c.id)) return false;
    
    const meta = c.meta || LabelsData.getMeta(c.id);
    let wCells = Math.max(1, Math.ceil(c.size.w / grid.cell));
    let hCells = Math.max(1, Math.ceil(c.size.h / grid.cell));
    
    if (meta.isCity && meta.country && forcedCodesSet.has(String(meta.country).toUpperCase())) {
      wCells = Math.max(1, Math.floor(wCells * 0.7));
      hCells = Math.max(1, Math.floor(hCells * 0.7));
    }
    
    if (LabelsLayout.tryOccupy(grid, c.sp.x, c.sp.y, wCells, hCells)) {
      winners.add(c.id); used++;
      const st = LabelsRender.LABEL_STATES.get(c.id) || { alpha: 0, lastWinAt: 0 };
      st.lastWinAt = nowMs;
      LabelsRender.LABEL_STATES.set(c.id, st);
      return true;
    }
    return false;
  };

  // 放置逻辑
  let placedCountryCount = 0;
  const countryIndicesPlaced = workset.countryIndicesPlaced;
  
  // Phase 1: 保底国家
  for (let i = 0; i < countryCands.length; i++) {
    if (placedCountryCount >= countryBudget) break;
    if (used >= __budgetEff) break;
    if (tryPlace(countryCands[i])) {
      placedCountryCount++;
      countryIndicesPlaced.add(i);
    }
  }
  // Phase 2: 城市
  for (const c of citiesQueue) tryPlace(c);
  // Phase 3: 剩余国家
  for (let i = 0; i < countryCands.length; i++) {
    if (used >= __budgetEff) break;
    if (!countryIndicesPlaced.has(i)) tryPlace(countryCands[i]);
  }

  // 强制显示项
  const forcedID = LabelsData.FORCED_ID;
  if (forcedID && LabelsRender.LABEL_MESHES.has(forcedID)) {
    winners.add(forcedID);
    const st = LabelsRender.LABEL_STATES.get(forcedID) || { alpha: 0, lastWinAt: 0 };
    st.lastWinAt = nowMs;
    LabelsRender.LABEL_STATES.set(forcedID, st);
  }

  // 3. 渲染更新
  // 确保 Mesh 存在
  for (const id of winners) {
    const meta = LabelsData.getMeta(id);
    if (meta) LabelsRender.getOrCreateMesh(id, meta, ctx);
  }

  // 距离缩放系数
  let distScale = 1.0;
  if (DYNAMIC_FONT_BY_DISTANCE) {
    const near = _const?.NEAR_FONT_DIST ?? 4.0;
    const far = FAR_FONT_STABLE_DIST;
    const nearMin = _const?.NEAR_FONT_SCALE_MIN ?? 0.75;
    
    if (isFarByRatio || camDistLOD >= far) {
      const base = INIT_CAM_DIST || camDistLOD;
      distScale = Math.max(1.0, camDistLOD / base);
    } else if (camDistLOD <= near) {
      const t = Math.max(0, camDistLOD / near);
      distScale = nearMin + (1.0 - nearMin) * t;
    } else {
      const t = Math.max(0, Math.min(1, (camDistLOD - near) / Math.max(1e-6, (far - near))));
      distScale = 1.0 + 0.3 * t;
    }
  }

  // 更新所有 Mesh
  const winSpMap = __tmp.winSpMap;
  winSpMap.clear();
  for(const c of candidates) { if(winners.has(c.id)) winSpMap.set(c.id, c.sp); }

  for (const [id, mesh] of LabelsRender.LABEL_MESHES.entries()) {
    const isWin = winners.has(id);
    const meta = LabelsData.getMeta(id);
    const isForced = (id === forcedID);

    // 位置同步
    if (meta?.baseVec3) {
      __tmp.local.copy(meta.baseVec3).multiplyScalar(1 + LABEL_ALTITUDE);
      mesh.position.set(__tmp.local.x, __tmp.local.y, __tmp.local.z);
    }

    if (!isWin && !isForced) {
      // 淡出逻辑
      const st = LabelsRender.LABEL_STATES.get(id) || { alpha: 0, lastWinAt: 0 };
      const sticky = (nowMs - st.lastWinAt) < STICKY_MS;
      if (sticky) {
        // 粘性淡出
        const nextAlpha = st.alpha * (1 - OPACITY_FOLLOW); // 指数衰减
        st.alpha = nextAlpha;
        LabelsRender.LABEL_STATES.set(id, st);
        mesh.visible = nextAlpha > 0.02;
        if (mesh.material) mesh.material.opacity = nextAlpha;
      } else {
        mesh.visible = false;
        st.alpha = 0;
        LabelsRender.LABEL_STATES.set(id, st);
      }
      continue;
    }

    // 计算目标透明度
    mesh.getWorldPosition(__tmp.world2);
    const normal = __tmp.normal2.copy(__tmp.world2).sub(__tmp.globeCenter).normalize();
    const view = __tmp.view2.copy(__camPos).sub(__tmp.world2).normalize();
    const dot = normal.dot(view);
    
    let alpha = (dot - LABEL_CUTOFF) / Math.max(1e-6, (LABEL_FADEIN - LABEL_CUTOFF));
    if (isForced) alpha = 1;
    if (alpha > 1) alpha = 1;

    let sp = winSpMap.get(id);
    if (!sp && isForced) sp = LabelsLayout.worldToScreen(__tmp.world2, ctx, __tmp.forcedScreen);
    
    if (alpha > 0 && sp) {
      const edgeFade = Math.min(
        sp.x / EDGE_FADE_PX,
        (width - sp.x) / EDGE_FADE_PX,
        sp.y / EDGE_FADE_PX,
        (height - sp.y) / EDGE_FADE_PX
      );
      const target = isForced ? 1 : alpha * Math.max(0, Math.min(1, edgeFade));
      
      const st = LabelsRender.LABEL_STATES.get(id) || { alpha: 0, lastWinAt: 0 };
      const nextAlpha = st.alpha * (1 - OPACITY_FOLLOW) + target * OPACITY_FOLLOW;
      st.alpha = nextAlpha;
      LabelsRender.LABEL_STATES.set(id, st);
      
      mesh.visible = nextAlpha > 0.02;
      if (mesh.material) {
        mesh.material.opacity = nextAlpha;
        mesh.material.transparent = true;
        mesh.material.depthTest = (dot <= LABEL_DEPTH_BACK_DOT);
        
        // 颜色设置
        try {
          const tag = isForced ? (meta && meta.isCity ? 'forced-city' : 'forced-country') : (meta && meta.isCity ? 'default-city' : 'default-country');
          if (mesh.userData.colorTag !== tag) {
            const colorVal = (meta && meta.isCity) ? '#ffffff' : (isForced ? '#ffd54f' : _const?.COUNTRY_TEXT_COLOR ?? '#ffffff');
            if (!mesh.material.color || typeof mesh.material.color.set !== 'function') {
               mesh.material.color = new THREE.Color(colorVal);
            } else {
               mesh.material.color.set(colorVal);
            }
            mesh.userData.colorTag = tag;
          }
        } catch(_){}
      }
      
      // 动态缩放
      if (mesh.userData && typeof mesh.userData.baseScaleX === 'number') {
        const targetScale = distScale;
        const lastScale = mesh.userData.lastDynamicScale || targetScale;
        const dt = 16; 
        const factor = 1.0 - Math.exp(-dt / SCALE_TAU_MS); 
        const currScale = lastScale + (targetScale - lastScale) * factor;
        
        mesh.scale.set(
          mesh.userData.baseScaleX * currScale,
          mesh.userData.baseScaleY * currScale,
          1
        );
        mesh.userData.lastDynamicScale = currScale;
        
        // 屏幕像素限制
        const limitMin = meta.isCity ? FONT_MIN_SCREEN_PX_CITY : FONT_MIN_SCREEN_PX_COUNTRY;
        const limitMax = meta.isCity ? FONT_MAX_SCREEN_PX_CITY : FONT_MAX_SCREEN_PX_COUNTRY;
        
        // 反算：如果当前 worldHeight 对应的屏幕高度超出限制，则钳制 scale
        // 这里简化处理：直接利用 estimatePixelSize 的逻辑反推太复杂，
        // 我们利用 Layout 模块的 size 数据（如果是上一帧的）或者粗略估算
        // 为了性能，这里不做严格每帧反算，而是依赖设计良好的 FONT_PX 和 distScale
      }
    } else {
      mesh.visible = false;
    }
  }
}

export function getLastWinners() {
  // 简化版：仅返回当前 Mesh 可见的 ID
  const list = [];
  for (const [id, mesh] of LabelsRender.LABEL_MESHES.entries()) {
    if (mesh.visible) list.push({ id });
  }
  return list;
}
