
// 禅定模式 - 诗词管理模块
// 职责：诗词的加载、播放、特殊彩蛋文本处理

import { APP_CFG, LOG } from './config.js';
import { loadPoetryPresets, loadPoetryLabelsFromDB, loadSpecialTexts } from './content-loader.js';
import { computeStartNearCenter, computeMove } from './poetry-motion.js';

export async function preloadPoetryCloud(page) {
  const { map, labels, source } = await loadPoetryPresets(APP_CFG, LOG);
  if (Object.keys(map).length) {
    page.__poetryPresets = { ...(page.__poetryPresets || {}), ...map };
    if (Object.keys(labels).length) { page.__presetLabels = { ...(page.__presetLabels || {}), ...labels }; }
    page.__poetrySource = source || page.__poetrySource || 'unknown';
    console.info(`[poetry] 载入 ${Object.keys(map).length} 组，来源：${page.__poetrySource}`);
    try {
      if (!Array.isArray(page.__poetryPresets[3]) || page.__poetryPresets[3].length === 0) {
        console.warn('[poetry] 未发现 preset_3，请检查云函数部署/数据库权限/环境ID');
      }
    } catch(_){}
  }
}

export async function pushPoetryPresetToCloud(page, preset) {
  try {
    const lines = page.__poetryPresets[preset] || [];
    const { result } = await wx.cloud.callFunction({ name: 'poetrySets', data: { type: 'upsert', preset, lines } });
    try { console.log('[poetry upsert]', result); } catch(_){}
  } catch(e){ try { console.warn('[poetry upsert] 失败：', e); } catch(_){} }
}

export async function preloadPresetLabelsCloud(page) {
  if (APP_CFG?.cloud?.enabled === false || !(wx && wx.cloud)) { return; }
  if (!page.__poetryPresets || !Object.keys(page.__poetryPresets).length) {
    await preloadPoetryCloud(page);
  }
  const dbLabels = await loadPoetryLabelsFromDB();
  if (Object.keys(dbLabels).length) {
    page.__presetLabels = { ...(page.__presetLabels || {}), ...dbLabels };
  }
}

export async function preloadSpecialCloud(page) {
  const items = await loadSpecialTexts(APP_CFG, LOG);
  page._specialItems = items;
  LOG.info('[special] 加载', page._specialItems.length, '条');
}

export async function playPoetry(page, preset, startIdx, opts) {
  try {
    if (page?.__zenPoetryPaused) {
      try {
        const now = Date.now();
        // Use page property to debounce warning
        if (!page.__poetryPausedWarnAt || (now - page.__poetryPausedWarnAt) >= 5000) {
          page.__poetryPausedWarnAt = now;
          console.warn('[poetry] paused, skip start');
        }
      } catch(_){ }
      return; 
    }
    const p = Number(preset) || 1;
    
    // Lazy Load
    const map = page?.__poetryPresets;
    const has = Array.isArray(map?.[p]) && map[p].length > 0;
    if (!has) {
      try { await preloadPoetryCloud(page); } catch(_){ }
    }

    const isEn = (page.data?.lang === 'en');
    const presetsMap = page?.__poetryPresets || {};
    let useMap = presetsMap;
    if (isEn) {
      try {
        const sanitized = { ...presetsMap };
        const enKeys = Object.keys(presetsMap).map(k=>Number(k)).filter(n=>n>=101).sort((a,b)=>a-b);
        enKeys.forEach(k => {
          const arr = Array.isArray(presetsMap[k]) ? presetsMap[k] : [];
          sanitized[k] = arr.map(line => ({
            ...line,
            text: String(line?.text || '')
              .replace(/[，,]+/g, '\n')
              .replace(/那/g, '')
          }));
        });
        useMap = sanitized;
      } catch(_){ useMap = presetsMap; }
    }
    page?.__getPoetryMgr?.().start(p, useMap, Number(startIdx || 0), opts || {});
  } catch(_){ }
}

export function stopPoetry(page) {
  try { page?.__getPoetryMgr?.().stop(); } catch(_){ }
}

export function resolvePresetForLang(page, current, isEn) {
  try {
    let preset = Number(current) || (isEn ? 101 : 1);
    if (isEn) {
      try {
        const map = page?.__poetryPresets || {};
        const keys = Object.keys(map).map(k=>Number(k)).filter(n=>n>=101).sort((a,b)=>a-b);
        const valid = (preset===1||preset===2||preset===3) ? (keys[0]||101) : preset;
        return valid;
      } catch(_){ return (preset===1||preset===2||preset===3) ? 101 : preset; }
    } else {
      if (preset===101||preset===102||preset===103||preset>=104) return 1;
      return preset;
    }
  } catch(_){ return isEn ? 101 : 1; }
}

export function resolveNextPreset(page, current, isEn) {
  try {
    const cur = Number(current) || (isEn ? 101 : 1);
    if (isEn) {
      try {
        const map = page?.__poetryPresets || {};
        const keys = Object.keys(map).map(k=>Number(k)).filter(n=>n>=101).sort((a,b)=>a-b);
        const idx = Math.max(0, keys.indexOf(cur));
        return keys.length ? keys[(idx+1) % keys.length] : (cur===101?102:(cur===102?103:101));
      } catch(_){ return (cur === 101 ? 102 : (cur === 102 ? 103 : 101)); }
    } else {
      return (cur === 1 ? 2 : (cur === 2 ? 3 : 1));
    }
  } catch(_){ return isEn ? 102 : 2; }
}

// —— 彩蛋逻辑 ——

export function onEggTap(page, triggerSpecialCallback) {
  try {
    if (!page.data.zenMode) return;
    page.__eggTapCount = (page.__eggTapCount || 0) + 1;
    
    clearTimeout(page.__eggTapTimer);
    page.__eggTapTimer = setTimeout(() => { try { page.__eggTapCount = 0; } catch(_){} }, 2000);
    
    if (page.__eggTapCount >= 8) {
      page.__eggTapCount = 0;
      clearTimeout(page.__eggTapTimer);
      if (typeof triggerSpecialCallback === 'function') triggerSpecialCallback();
    }
  } catch(e){ console.error('[ZenMode] Egg tap error:', e); }
}

export async function triggerSpecial(page, mgr) {
  try {
    if (page.data.specialVisible) return;

    let text = '你好，宇宙';
    if (Array.isArray(page._specialItems) && page._specialItems.length > 0) {
      const idx = Math.floor(Math.random() * page._specialItems.length);
      text = page._specialItems[idx];
    }

    if (!Array.isArray(page._specialItems) || !page._specialItems.length) { await preloadSpecialCloud(page); }
    // const items = Array.isArray(page._specialItems) && page._specialItems.length ? page._specialItems : ['你好，宇宙'];
    
    page.__specialIdx = (page.__specialIdx || 0) + 1;
    
    try { page.setData({ poetryFadeMs: Math.max(200, Number(APP_CFG?.poetry?.special?.fadeOutMs || 2000)), 'poetryA.visible': false, 'poetryB.visible': false }); } catch(_){}
    
    let resumeIdx = 0;
    try {
      const pmgr = page.__getPoetryMgr();
      resumeIdx = pmgr ? pmgr.getIndex() : 0;
    } catch(e) { }
    
    page.__poetryResumeIdx = resumeIdx + 1;
    
    try { stopPoetry(page); } catch(_){}
    
    const delayMs = Math.max(0, Number(APP_CFG?.poetry?.special?.fadeOutMs || 2000));
    setTimeout(() => { try { showSpecial(page, mgr, text); } catch(_){} }, delayMs);
  } catch(_){ }
}

export async function showSpecial(page, mgr, text) {
  try {
    if (!page?.data?.zenMode) return;
    if (page?.__zenPoetryPaused) return;
    const cfg = (APP_CFG && APP_CFG.poetry && APP_CFG.poetry.special) ? APP_CFG.poetry.special : {};
    const fadeInMs = Number(cfg.fadeInMs || 1000);
    const displayMs = Number(cfg.displayMs || 10000);
    const fadeOutMs = Number(cfg.fadeOutMs || 2000);
    const moveSpeed = Number(cfg.movePxPerSec || 12);
    const margin = Number(APP_CFG?.poetry?.safeMarginPx || 18);
    
    const pmgr = page.__getPoetryMgr();
    if (typeof page.__poetryResumeIdx === 'undefined') {
      page.__poetryResumeIdx = pmgr ? pmgr.getIndex() : 0;
      stopPoetry(page);
    }

    const layoutMgr = page.__getLayoutMgr();
    const vp = layoutMgr ? layoutMgr.getViewport() : { windowWidth: 360, windowHeight: 640 };
    const gl = page.__canvasRect;
    
    const fontSize = Math.min(32, Math.max(20, Math.floor(vp.windowWidth * 0.08)));
    page.setData({ 
      specialText: String(text || '你好，宇宙'),
      specialVisible: false, 
      specialMoveMs: 0,
      specialFontSizePx: fontSize,
      specialScale: 1 
    });
    await new Promise(r => setTimeout(r, 50));
    
    let rect = null;
    try {
      rect = layoutMgr ? await layoutMgr.measure('specialText') : null;
    } catch(e) { }

    if (!rect || !rect.width) { rect = { width: Math.min(vp.windowWidth * 0.8, 300), height: 40 }; }
    
    const itemW = Math.max(1, rect.width);
    const itemH = Math.max(1, rect.height);
    const halfCanvasBottom = (gl && typeof gl.top === 'number' && typeof gl.height === 'number')
      ? (gl.top + gl.height * 0.5)
      : (vp.windowHeight * 0.5);
    const bounds = { minX: margin, minY: margin, maxX: vp.windowWidth - margin, maxY: Math.max(margin, Math.min(vp.windowHeight - margin, halfCanvasBottom)) };
    
    let start = computeStartNearCenter(vp.windowWidth, vp.windowHeight, itemW, itemH, bounds, (typeof cfg.upperCenterYRatio === 'number') ? cfg.upperCenterYRatio : 0.35);
    start.x = Math.max(bounds.minX, Math.min(bounds.maxX - itemW, start.x - itemW * 0.5));
    start.y = Math.max(bounds.minY, Math.min(bounds.maxY - itemH, start.y - itemH * 0.5));
    start.y = Math.min(start.y, bounds.maxY - itemH * 0.5);
    
    const move = computeMove(start, itemW, itemH, moveSpeed, displayMs, bounds);
    
    page.setData({ 
      specialX: start.x, specialY: start.y, 
      specialTx: 0, specialTy: 0, 
      specialMoveMs: 0, 
      specialFadeMs: fadeInMs, 
      specialScale: 1.08, 
      specialVisible: false 
    });
    await new Promise(r => setTimeout(r, 20));
    if (!page.data.zenMode) return;
    
    page.setData({ specialVisible: true });
    await new Promise(r => setTimeout(r, 20));
    
    page.setData({ specialMoveMs: displayMs });
    await new Promise(r => setTimeout(r, 20));
    page.setData({ specialTx: move.tx, specialTy: move.ty });
    
    page.__specialTimer = setTimeout(() => {
      if (!page.data.zenMode) return;
      page.setData({ specialFadeMs: fadeOutMs, specialVisible: false });
      
      page.__specialTimer = setTimeout(async () => {
        if (!page.data.zenMode) return;
        const rIdx = page.__poetryResumeIdx || 0;
        const rPreset = page.__zenPreset || (page.data.lang === 'en' ? 101 : 1);
        
        await playPoetry(page, rPreset, 0);
        
        const pmgr = page.__getPoetryMgr?.();
        const zmgr = page.__getZenMgr?.();
        const audioPos = zmgr ? (zmgr.getCurrentTime?.() || 0) * 1000 : 0;
        
        let aligned = false;
        if (pmgr && typeof pmgr.forceAlignToAudioPosition === 'function') {
           aligned = pmgr.forceAlignToAudioPosition(audioPos);
        }
        
        if (!aligned) {
           playPoetry(page, rPreset, rIdx, { keepBaseTime: true });
        }
        
        page.__poetryResumeIdx = undefined;
      }, fadeOutMs + 100);
      
    }, displayMs);
    
  } catch(err){ 
    try { playPoetry(page, page.__zenPreset || 1, 0); } catch(_){}
  }
}

export function stopSpecial(page) {
  try {
    clearTimeout(page?.__specialTimer);
    page?.setData?.({ specialVisible: false });
  } catch(_){ }
}
