// 职责：集中管理“禅定模式”的进入/退出与页面层淡出联动，
// 解释：将原本散落在页面的状态更新、渲染层调用（setZenMode）、音频与诗句启停汇总到管理器，降低 index.js 复杂度。

import { setZenMode } from './main.js';

export class ZenModeManager {
  constructor(page){
    this.page = page; // 引用页面实例以便 setData 与调用页面已有的音频/诗句方法
  }

  // 切换：根据当前状态决定进入或退出
  toggle(){
    try { return (!this.page?.data?.zenMode) ? this.enter() : this.exit(); } catch(_){ }
  }

  // 进入禅定：面板淡出关闭 + 渲染层倾斜缩放 + 启动音乐与诗句
  enter(){
    try {
      const fadeMs = Number(this.page?.data?.panelFadeMs || 500);
      const updates = { zenMode: true, searchOpen: false };
      if (this.page?.data?.settingsOpen) updates.settingsFading = true;
      if (this.page?.data?.countryPanelOpen) updates.countryPanelFading = true;
      // 禁止时区胶囊：清空 hover 文本
      updates.hoverText = '';
      this.page?.setData?.(updates);
      // 到达淡出时间后真正关闭面板
      if (this.page?.data?.settingsOpen || this.page?.data?.countryPanelOpen) {
        setTimeout(() => {
          try {
            this.page?.setData?.({ settingsOpen: false, countryPanelOpen: false, settingsFading: false, countryPanelFading: false });
          } catch(_){ }
        }, fadeMs);
      }
      // 页面层调用渲染层进入禅定：动画倾斜与缩小，锁定交互
      try { setZenMode(true); } catch(_){ }
      // 音频与诗句：进入禅定时启动 preset（中文1，英文4）
      const isEn = (this.page?.data?.lang === 'en');
      const current = this.page?.__zenPreset || (isEn ? 101 : 1);
      const preset = this._resolvePresetForLang(current, isEn);
      this.page.__zenPreset = preset;
      const audioPreset = this._resolveAudioPresetForLang(preset, isEn);
      try { this.page?._startZenAudio?.(audioPreset); } catch(_){ }
      // 中文模式下用户反馈慢了 0.5s，因此将启动延迟从 1000ms 调整为 500ms
      const startDelay = isEn ? 1000 : 500;
      try { this.page?.__startPoetryViaMgr?.(preset, 0, { firstDelayMs: startDelay }); } catch(_){ }
      try { this._ensureAudioListeners(); } catch(_){ }
    } catch(_){ }
  }

  // 退出禅定：恢复渲染状态 + 淡出音乐 + 停止诗句循环
  exit(){
    try {
      this.page?.setData?.({ zenMode: false });
      try { setZenMode(false); } catch(_){ }
      // 禅定退出：关闭音乐与诗句循环（音乐淡出 2 秒）
      try { this.page?._stopZenAudio?.(2000); } catch(_){ }
      try { this.page?.__stopPoetryViaMgr?.(); } catch(_){ }
    } catch(_){ }
  }

  // 切换预设：与页面“切”按钮同等行为，统一到管理器
  toggleCut(){
    try {
      const isEn = (this.page?.data?.lang === 'en');
      const current = Number(this.page?.__zenPreset || (isEn ? 101 : 1));
      const nextPreset = this._resolveNextPreset(current, isEn);
      this.page.__zenPreset = nextPreset;
      const pmgr = this.page?.__getPoetryMgr?.();
      if (pmgr && typeof pmgr.resetImmediate === 'function') { pmgr.resetImmediate(); } else { if (pmgr && typeof pmgr.stop === 'function') { pmgr.stop(); } }
      // 先处理：旧音乐 2 秒淡出、当前诗句强制 2 秒淡出
      try { this.page?._stopZenAudio?.(2000); } catch(_){ }
      try {
        // 诗句淡出时长固定为 2000ms，无论已显示多久
        this.page?.setData?.({ poetryFadeMs: 2000, 'poetryA.visible': false, 'poetryB.visible': false });
      } catch(_){ }
      // 新音乐：等待 1 秒后开始淡入（淡入 1 秒），新诗句：靠近淡出末尾切入（总淡出 2 秒，1 秒后启动，内部首句再延迟 1 秒 = 2 秒）
      try {
        const mgr = this.page?.__getZenMgr?.();
        const audioPreset = this._resolveAudioPresetForLang(nextPreset, isEn);
        const localUrl = this.page?._getLocalAudio?.(audioPreset) || '';
        // 1s 延迟 + 1s 淡入
        if (mgr && typeof mgr.startWithDelayFadeIn === 'function') { mgr.startWithDelayFadeIn(audioPreset, localUrl, 1000, 1000); }
        else { this.page?._startZenAudio?.(audioPreset); }
      } catch(_){ }
      try { this._ensureAudioListeners(); } catch(_){ }
      // 诗句：立即切换到新预设并强制从头开始（首句不延迟）
      try { this.page?.__startPoetryViaMgr?.(nextPreset, 0, { firstDelayMs: 0 }); } catch(_){ }
      // 需求调整：切换时不再显示“切到预设X”的提示
      // 为保持整洁，不设置 hoverText。
    } catch(_){ }
  }

  switchToPreset(nextPreset){
    try {
      const isEn = (this.page?.data?.lang === 'en');
      const p = Number(nextPreset) || (isEn ? 101 : 1);
      this.page.__zenPreset = p;
      const pmgr = this.page?.__getPoetryMgr?.();
      if (pmgr && typeof pmgr.resetImmediate === 'function') { pmgr.resetImmediate(); } else { if (pmgr && typeof pmgr.stop === 'function') { pmgr.stop(); } }
      try { this.page?._stopZenAudio?.(2000); } catch(_){ }
      try { this.page?.setData?.({ poetryFadeMs: 2000, 'poetryA.visible': false, 'poetryB.visible': false }); } catch(_){ }
      try {
        const mgr = this.page?.__getZenMgr?.();
        const audioPreset = this._resolveAudioPresetForLang(p, isEn);
        const localUrl = this.page?._getLocalAudio?.(audioPreset) || '';
      if (mgr && typeof mgr.startWithDelayFadeIn === 'function') { mgr.startWithDelayFadeIn(audioPreset, localUrl, 1000, 1000); }
      else { this.page?._startZenAudio?.(audioPreset); }
    } catch(_){ }
    try { this._ensureAudioListeners(); } catch(_){ }
    try { this.page?.__startPoetryViaMgr?.(p, 0, { firstDelayMs: 0 }); } catch(_){ }
    } catch(_){ }
  }

  _onAudioEnded(){
    try {
      const pmgr = this.page?.__getPoetryMgr?.();
      if (!pmgr) return;
      if (typeof pmgr.resetImmediate === 'function') { pmgr.resetImmediate(); } else { pmgr.stop(); }
      try { this.page?.__startPoetryViaMgr?.(this.page.__zenPreset || 1, 0, { firstDelayMs: 0 }); } catch(_){ }
    } catch(_){ }
  }

  _ensureEndedListener(){
    try {
      const zmgr = this.page?.__getZenMgr?.();
      if (zmgr && typeof zmgr.onEnded === 'function') {
        zmgr.onEnded(() => this._onAudioEnded());
      }
    } catch(_){ }
  }

  _onAudioPlay(){
    try {
      const zmgr = this.page?.__getZenMgr?.();
      if (!zmgr) return;
      const delay = 2500;
      setTimeout(() => {
        try {
          const pmgr = this.page?.__getPoetryMgr?.();
          const posSec = Number(zmgr.getCurrentTime?.() || 0);
          const posMs = Math.max(0, Math.floor(posSec * 1000));
          pmgr?.forceAlignToAudioPosition?.(posMs);
        } catch(_){ }
      }, delay);
    } catch(_){ }
  }

  _ensurePlayListener(){
    try {
      const zmgr = this.page?.__getZenMgr?.();
      if (zmgr && typeof zmgr.onPlay === 'function') {
        zmgr.onPlay(() => this._onAudioPlay());
      }
    } catch(_){ }
  }

  _ensureAudioListeners(){
    try { this._ensureEndedListener(); } catch(_){ }
    try { this._ensurePlayListener(); } catch(_){ }
  }

  _resolvePresetForLang(current, isEn){
    try {
      let preset = Number(current) || (isEn ? 101 : 1);
      if (isEn) {
        try {
          const map = this.page?.__poetryPresets || {};
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

  _resolveNextPreset(current, isEn){
    try {
      const cur = Number(current) || (isEn ? 101 : 1);
      if (isEn) {
        try {
          const map = this.page?.__poetryPresets || {};
          const keys = Object.keys(map).map(k=>Number(k)).filter(n=>n>=101).sort((a,b)=>a-b);
          const idx = Math.max(0, keys.indexOf(cur));
          return keys.length ? keys[(idx+1) % keys.length] : (cur===101?102:(cur===102?103:101));
        } catch(_){ return (cur === 101 ? 102 : (cur === 102 ? 103 : 101)); }
      } else {
        return (cur === 1 ? 2 : (cur === 2 ? 3 : 1));
      }
    } catch(_){ return isEn ? 102 : 2; }
  }

  _resolveAudioPresetForLang(preset, isEn){
    try { return isEn ? Math.max(1, Number(preset||101) - 100) : Number(preset||1); } catch(_){ return isEn ? 1 : 1; }
  }
}

export function applyZenAutoRotate(touch, dtSec, now, cfg, zenActive, animating, zenStableSince){
  try {
    if (zenActive && !animating) {
      if (zenStableSince === 0) zenStableSince = now;
      if (cfg?.enabled && (now - zenStableSince) >= (cfg.startDelayMs || 0)) {
        const w = (cfg.degPerSec || 0) * Math.PI / 180;
        touch.rotY += w * dtSec;
      }
    }
  } catch(_){ }
  return zenStableSince;
}

export function applyZenBrake(brake, touch, now, logFlag, onBrakeCompleted){
  try {
    if (!brake) return brake;
    const t = Math.max(0, Math.min(1, (now - brake.t0) / Math.max(1, brake.dur)));
    const easeOut = 1 - Math.pow(1 - t, 3);
    const scale = Math.max(0, 1 - easeOut);
    touch.velX *= scale; touch.velY *= scale;
    if (t >= 1) {
      brake = null; touch.velX = 0; touch.velY = 0;
      try { if (logFlag) console.log('[zen] pre-stop done'); } catch(_){ }
      try { if (typeof onBrakeCompleted === 'function') onBrakeCompleted(); } catch(_){ }
    }
  } catch(_){ }
  return brake;
}

export function advanceZenAnimation(anim, now, ctx){
  try {
    if (!anim) return { anim, tiltZ: ctx.tiltZ, zoom: ctx.zoom, zenStableSince: ctx.zenStableSince };
    const { t0, dur, from, to } = anim;
    const t = Math.max(0, Math.min(1, (now - t0) / Math.max(1, dur)));
    const ease = (x) => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2;
    const k = ease(t);
    const tiltZ = from.tiltZ + (to.tiltZ - from.tiltZ) * k;
    const nx = from.rotX + (to.rotX - from.rotX) * k;
    const nzm = from.zoom + (to.zoom - from.zoom) * k;
    if (ctx.globeGroup && from.posY !== undefined && to.posY !== undefined) {
      const ny = from.posY + (to.posY - from.posY) * k;
      ctx.globeGroup.position.y = ny;
    }
    ctx.touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, nx));
    const newZoom = ctx.clampZoom(nzm);
    if (Math.abs(newZoom - ctx.zoom) > 1e-6) { ctx.zoom = newZoom; ctx.updateCamDist(ctx.camera, ctx.baseDist, ctx.zoom); }
    ctx.touch.velX = 0; ctx.touch.velY = 0;
    if (t >= 1) {
      const next = anim.next;
      const after = anim.after;
      if (next && next.from && next.to && next.dur) {
        next.t0 = Date.now();
        anim = next;
      } else {
        anim = null;
        ctx.zenStableSince = now;
        try { if (typeof after === 'function') after(); } catch(_){ }
      }
    }
    return { anim, tiltZ, zoom: ctx.zoom, zenStableSince: ctx.zenStableSince };
  } catch(_){ }
  return { anim, tiltZ: ctx.tiltZ, zoom: ctx.zoom, zenStableSince: ctx.zenStableSince };
}

export function advanceRotationFrame(ctx){
  try {
    const { touch, dtSec, now, LIGHT_CFG, zenActive, globeGroup, camera, baseDist, clampZoom, updateCamDist, flyMgr, INTERACTION_DEBUG_LOG, render, setZenMode } = ctx;
    let tiltZ = ctx.tiltZ;
    let zoom = ctx.zoom;
    let anim = ctx.__zenAnim;
    let brake = ctx.__zenBrake;
    let zenStableSince = ctx.zenStableSince;
    let __zenDelayEnter = ctx.__zenDelayEnter;
    if (!touch.isDragging && !touch.pinch) {
      if (anim) {
        const res = advanceZenAnimation(anim, now, { touch, globeGroup, camera, baseDist, clampZoom, updateCamDist, tiltZ, zoom, zenStableSince });
        anim = res.anim; tiltZ = res.tiltZ; zoom = res.zoom; zenStableSince = res.zenStableSince;
      } else if (flyMgr.advanceFlight(now)) {
      } else {
        if (zenActive && !anim) {
          const targetTilt = ((LIGHT_CFG?.zen?.tiltDeg ?? 23) * Math.PI / 180);
          const targetZoom = Number(LIGHT_CFG?.zen?.zoom ?? 0.74);
          const offR = Number(LIGHT_CFG?.zen?.globeYOffsetR ?? -0.35);
          const baseY0 = -0.55;
          const targetY = baseY0 + offR;
          const curY = globeGroup?.position?.y || 0;
          const needTilt = Math.abs(tiltZ - targetTilt) > 1e-3;
          const needZoom = Math.abs(zoom - targetZoom) > 1e-3;
          const needPos = Math.abs(curY - targetY) > 1e-3;
          if (needTilt || needZoom || needPos) {
            anim = { t0: now, dur: Number(LIGHT_CFG?.zen?.animMs ?? 1000), from: { rotX: touch.rotX, zoom, tiltZ, posY: curY }, to: { rotX: 0, zoom: targetZoom, tiltZ: targetTilt, posY: targetY } };
          }
        }
        if (!anim) {
          zenStableSince = applyZenAutoRotate(touch, dtSec, now, LIGHT_CFG.zen?.autoRotate, zenActive, !!anim, zenStableSince);
        }
        brake = applyZenBrake(brake, touch, now, INTERACTION_DEBUG_LOG, () => { if (__zenDelayEnter) { __zenDelayEnter = false; try { setZenMode(true); } catch(_){ } } });
        if (Math.abs(touch.velX) > 0.0002 || Math.abs(touch.velY) > 0.0002) {
          touch.rotX += zenActive ? 0 : touch.velX; touch.rotY += touch.velY;
          touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, touch.rotX));
          touch.velX *= touch.damping; touch.velY *= touch.damping;
          try {
            if (INTERACTION_DEBUG_LOG) {
              if (!render.__lastInertiaLog || (now - render.__lastInertiaLog) > 300) {
                console.log('[inertia:apply]', {
                  velX: Number(touch.velX.toFixed(5)),
                  velY: Number(touch.velY.toFixed(5)),
                  damping: Number(touch.damping.toFixed(3)),
                  maxSpeed: Number(touch.maxSpeed.toFixed(3))
                });
                render.__lastInertiaLog = now;
              }
            }
          } catch(_){ }
        } else { touch.velX = 0; touch.velY = 0; }
      }
    }
    return { tiltZ, zoom, __zenAnim: anim, __zenBrake: brake, zenStableSince, __zenDelayEnter };
  } catch(_){ }
  return { tiltZ: ctx.tiltZ, zoom: ctx.zoom, __zenAnim: ctx.__zenAnim, __zenBrake: ctx.__zenBrake, zenStableSince: ctx.zenStableSince, __zenDelayEnter: ctx.__zenDelayEnter };
}

export const zenState = { active: false, tiltZ: 0, zoom: 1.0, anim: null, brake: null, delayEnter: false, stableSince: 0, restore: null };
