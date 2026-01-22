
import { APP_CFG } from './config.js';
import { 
  rebuildMilkyWay, 
  rebuildStarDust, 
  refreshMainStarfieldMesh 
} from './moon-voyage-scene-setup.js';
import { 
  uiMaskFadeIn, 
  uiMaskFadeOut, 
  prepareUiForLaunch, 
  pauseZenPoetryAndUi 
} from './moon-voyage-ui.js';
import { 
  stopZenAudio, 
  playAudio 
} from './moon-voyage-audio.js';
import { 
  stopMoonLyrics 
} from './moon-voyage-lyrics.js';
import { 
  findEarthMesh 
} from './moon-voyage-earth-utils.js';
import { 
  updateTimeline 
} from './moon-voyage-timeline.js';
import { 
  preloadAssets 
} from './moon-voyage-assets.js';

export const ASSETS = {
  TEXTURE: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/Moon/2k_moon.jpg',
  AUDIO: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/Moon/Zen-moon.mp3'
};

export const restoreState = (mgr) => {
  if (mgr.timer) {
    try { clearInterval(mgr.timer); } catch (_) {}
    mgr.timer = null;
  }
  try { stopMoonLyrics(mgr); } catch(_) {}
  try { mgr.page?.setData?.({ moonVoyageActive: false, moonTimerText: '', moonPhaseText: '', moonLyricA: { text: '', visible: false }, moonLyricB: { text: '', visible: false } }); } catch(_) {}
  try { mgr._companionFx?.dispose?.(); } catch (_) {}

  if (mgr.milkyWayMesh) {
    try {
      const u = mgr.milkyWayMesh.material?.uniforms;
      if (u?.uOpacity) u.uOpacity.value = 0.0;
    } catch (_) {}
    mgr.milkyWayMesh.visible = false;
  }

  [mgr._dustBgMesh, mgr._dustSlowMesh, mgr._dustFastMesh].forEach((m) => {
    if (!m) return;
    try {
      const u = m.material?.uniforms;
      if (u?.uOpacity) u.uOpacity.value = 0.0;
    } catch (_) {}
    m.visible = false;
  });

  try { mgr._orbitSeq?.dispose?.(); } catch (_) {}

  if (mgr.page) mgr.page.__zenPoetryPaused = false;

  try {
    if (mgr.page?.__getLabelsMgr) {
      const lblMgr = mgr.page.__getLabelsMgr();
      if (lblMgr && lblMgr.restore) {
        const restoreVal = mgr._prevLabelQty || 'default';
        lblMgr.restore(restoreVal);
      } else if (lblMgr && lblMgr.onSetLabelQty) {
        const restoreVal = mgr._prevLabelQty || 'default';
        lblMgr.onSetLabelQty({ detail: { value: restoreVal } });
      }
    }
  } catch(_) {}

  if (mgr.globeGroup) {
    if (mgr._originalLights.globeScale) mgr.globeGroup.scale.copy(mgr._originalLights.globeScale);
    if (mgr._originalLights.globePos) mgr.globeGroup.position.copy(mgr._originalLights.globePos);
    if (mgr._originalLights.globeRot) mgr.globeGroup.rotation.copy(mgr._originalLights.globeRot);
    mgr.globeGroup.visible = true;
    try {
      const earthMesh = findEarthMesh(mgr.globeGroup);
      if (earthMesh) earthMesh.visible = true;
    } catch (_) {}
    try {
      const wantCloud = !!(mgr.page && mgr.page.data && mgr.page.data.showCloud);
      let cloudMesh = null;
      if (typeof mgr.globeGroup.getObjectByName === 'function') {
        cloudMesh = mgr.globeGroup.getObjectByName('CLOUD') || null;
      }
      if (!cloudMesh && typeof mgr.globeGroup.traverse === 'function') {
        mgr.globeGroup.traverse((o) => {
          if (cloudMesh) return;
          if (o && o.name === 'CLOUD') cloudMesh = o;
        });
      }
      if (cloudMesh) cloudMesh.visible = wantCloud;
    } catch (_) {}
  }

  try {
    if (mgr._earthFallbackMesh && mgr._earthFallbackMesh.parent) {
      mgr._earthFallbackMesh.parent.remove(mgr._earthFallbackMesh);
    }
  } catch (_) {}
  mgr._earthFallbackMesh = null;

  try {
    const earthMesh = findEarthMesh(mgr.globeGroup);
    if (earthMesh && mgr._earthMaterialBackup && earthMesh === mgr._earthMaterialBackupMesh) {
      earthMesh.material = mgr._earthMaterialBackup;
      try { earthMesh.material.needsUpdate = true; } catch (_) {}
    }
  } catch (_) {}
  mgr._earthMaterialBackup = null;
  mgr._earthMaterialBackupMesh = null;
  try { mgr._earthVoyageMaterial?.dispose?.(); } catch (_) {}
  mgr._earthVoyageMaterial = null;

  mgr._moonShowT0 = null;

  if (mgr.camera) {
    if (mgr._originalLights.cameraRot) mgr.camera.rotation.copy(mgr._originalLights.cameraRot);
    if (mgr._originalLights.cameraPos) mgr.camera.position.copy(mgr._originalLights.cameraPos);
  }
  mgr._corridorRollApplied = false;
  try {
    if (mgr._mainStarfieldMesh && mgr._originalLights.starfieldRot) {
      mgr._mainStarfieldMesh.rotation.copy(mgr._originalLights.starfieldRot);
      // Restore brightness gain
      if (mgr._mainStarfieldMesh.material?.uniforms?.uBrightnessGain) {
        mgr._mainStarfieldMesh.material.uniforms.uBrightnessGain.value = 2.2;
      }
    }
  } catch (_) {}

  if (mgr.moonMesh) mgr.moonMesh.visible = false;

  const ambient = mgr.scene?.children?.find?.(c => c.type === 'AmbientLight');
  const dir = mgr.scene?.children?.find?.(c => c.type === 'DirectionalLight');
  if (ambient && mgr._originalLights.ambient !== undefined) ambient.intensity = mgr._originalLights.ambient;
  if (dir && mgr._originalLights.dir !== undefined) {
    dir.intensity = mgr._originalLights.dir;
    if (mgr._originalLights.dirPos) dir.position.copy(mgr._originalLights.dirPos);
  }

  if (mgr.audioContext) {
    try { mgr.audioContext.stop(); } catch (_) {}
    try { mgr.audioContext.destroy(); } catch (_) {}
    mgr.audioContext = null;
  }
};

export const captureStartState = (mgr) => {
  mgr._originalLights.globeScale = mgr.globeGroup.scale.clone();
  mgr._originalLights.globePos = mgr.globeGroup.position.clone();
  mgr._originalLights.globeRot = mgr.globeGroup.rotation.clone();
  mgr._originalLights.cameraRot = mgr.camera.rotation.clone();
  mgr._originalLights.cameraPos = mgr.camera.position.clone();
  try {
    if (mgr._mainStarfieldMesh?.rotation?.clone) {
      mgr._originalLights.starfieldRot = mgr._mainStarfieldMesh.rotation.clone();
    }
  } catch (_) {}

  const amb = mgr.scene.children.find(c => c.type === 'AmbientLight');
  const dir = mgr.scene.children.find(c => c.type === 'DirectionalLight');
  if (amb) mgr._originalLights.ambient = amb.intensity;
  if (dir) {
    mgr._originalLights.dir = dir.intensity;
    mgr._originalLights.dirPos = dir.position.clone();
  }

  mgr._startState = {
    camPos: mgr.camera.position.clone(),
    camRot: mgr.camera.rotation.clone(),
    globePos: mgr.globeGroup.position.clone(),
    globeScale: mgr.globeGroup.scale.clone(),
    ambInt: amb ? amb.intensity : 0.6,
    dirInt: dir ? dir.intensity : 1.2,
    dirPos: dir ? dir.position.clone() : new mgr.THREE.Vector3(1, 1, 1)
  };
};

export const resetVoyageVisuals = (mgr) => {
  rebuildMilkyWay(mgr.THREE, mgr.scene, mgr);
  rebuildStarDust(mgr.THREE, mgr.scene, mgr);
  refreshMainStarfieldMesh(mgr.scene, mgr);
  try { mgr._zodiacSys?.init?.(); } catch (_) {}

  if (mgr.moonMesh) {
    mgr.moonMesh.visible = false;
    mgr.moonMesh.scale.set(1e-6, 1e-6, 1e-6);
    mgr.moonMesh.position.set(-14, -2, -10);
  }

  if (mgr.milkyWayMesh) {
    mgr.milkyWayMesh.visible = true;
    const u = mgr.milkyWayMesh.material?.uniforms;
    if (u?.uOpacity) u.uOpacity.value = 0.0;
    if (mgr._milkyWayBaseSizeScale == null && u?.uSizeScale) mgr._milkyWayBaseSizeScale = u.uSizeScale.value;
    if (mgr._milkyWayBaseBrightnessGain == null && u?.uBrightnessGain) mgr._milkyWayBaseBrightnessGain = u.uBrightnessGain.value;
    if (mgr.milkyWayMesh.material && typeof mgr.milkyWayMesh.material.opacity === 'number') {
      mgr.milkyWayMesh.material.opacity = 1.0;
    }
    mgr.milkyWayMesh.rotation.set(0, 0, 0);
  }

  if (mgr._dustSlowMesh) {
    mgr._dustSlowMesh.visible = true;
    const u = mgr._dustSlowMesh.material?.uniforms;
    if (u?.uOpacity) u.uOpacity.value = 0.0;
  }
  if (mgr._dustFastMesh) {
    mgr._dustFastMesh.visible = true;
    const u = mgr._dustFastMesh.material?.uniforms;
    if (u?.uOpacity) u.uOpacity.value = 0.0;
  }
  if (mgr._dustBgMesh) {
    mgr._dustBgMesh.visible = true;
    const u = mgr._dustBgMesh.material?.uniforms;
    if (u?.uOpacity) u.uOpacity.value = 0.0;
  }
};

export const resetVoyageRuntimeState = (mgr) => {
  mgr._lightingSwitched = false;

  mgr.active = true;
  mgr.phase = 'VOYAGE';
  mgr.startTime = Date.now();
  mgr._accumTime = 0;
  mgr._lastTickTime = Date.now();
  mgr._speedMult = 1.0;
  mgr._milkyWayScrollTime = 0.0;
  mgr._dustSlowTime = 0.0;
  mgr._dustFastTime = 0.0;
  mgr._dustBgTime = 0.0;
  mgr._tEarthGone = null;
  mgr._tEarthFadeStart = null;
  mgr._corridorRollApplied = false;
  mgr._moonShowT0 = null;
  mgr._moonShowPos0 = null;
  mgr._moonShowScale0 = null;
  mgr._moonStartReady = false;
  mgr._moonStartWorld = null;
  mgr._moonUiNextUpdate = 0;
  mgr.__orbitEnteredOnce = false;
  mgr.__orbitDiagNext = 0;
  mgr.__companionNode2Logged = false;
  mgr.__companionNode3Logged = false;
  try { mgr._companionFx?.reset?.(); } catch (_) {}
  try { mgr._zodiacSys?.reset?.(); } catch (_) {}
  try { mgr._orbitSeq?.dispose?.(); } catch (_) {}
  mgr._earthNearOffset = null;
  mgr._earthNearSig = '';
  try { mgr.page?.setData?.({ moonVoyageActive: true, moonTimerText: '00:00', moonPhaseText: '', presetListOpen: false, presetListOpacity: 0, hoverText: '' }); } catch (_) {}
};

const bindMoonDebugHooks = (mgr) => {
  mgr._speedMult = 1.0;
  if (!mgr.page) return;
  mgr.page.__moonVoyageMgr = mgr;
  mgr.page.debugSpeedUp = () => {
    mgr._speedMult = 10.0;
    wx.showToast({ title: '10x Speed', icon: 'none' });
  };
};

const startTimeline = (mgr) => {
  if (mgr.timer) clearInterval(mgr.timer);
  const TICK_RATE = 1000 / 30; 
  
  mgr.timer = setInterval(() => {
    if (!mgr.active) {
      clearInterval(mgr.timer);
      mgr.timer = null;
      return;
    }
    
    const now = Date.now();
    let dt = (now - mgr._lastTickTime) / 1000;
    mgr._lastTickTime = now;
    if (dt > 0.1) dt = 0.1;
    const dtScaled = dt * mgr._speedMult;
    mgr._accumTime += dtScaled;
    
    updateTimeline(mgr, mgr._accumTime, dtScaled);
  }, TICK_RATE);
};

const startVoyage = (mgr) => {
  try {
    console.log('[Moon] Starting voyage sequence');
    try { mgr.page?.showMoonToast?.('登月启动'); } catch(_) { wx.showToast({ title: '登月启动', icon: 'success' }); }
    try { prepareUiForLaunch(mgr.page); } catch (_) {}

    try { bindMoonDebugHooks(mgr); } catch (_) {}
    try { pauseZenPoetryAndUi(mgr); } catch (_) {}
    try { stopZenAudio(mgr.page); } catch (_) {}
    try { captureStartState(mgr); } catch (_) {}
    try { resetVoyageVisuals(mgr); } catch (_) {}
    try { resetVoyageRuntimeState(mgr); } catch (_) {}

    playAudio(mgr, ASSETS);

    // 启动时初始化 Zodiac System (Phase 1)
  try { mgr._zodiacSys?.init?.(); } catch(e) { console.error('[Zodiac] Init failed', e); }

  mgr.fader.fadeOutBlack(2000, () => {
    // End of fade
  });
  
  startTimeline(mgr);
    
  } catch (err) {
    console.error('[Moon] _startVoyage critical error:', err);
    try { restoreState(mgr); } catch (_) {}
    mgr.active = false;
    mgr.phase = 'IDLE';
  }
};

const playExitZoomEffect = (mgr, durationMs) => {
  if (!mgr.camera || durationMs <= 0) return;
  
  const token = mgr._exitFadeToken;
  const start = Date.now();
  // 速度：每秒后退多少单位（根据场景尺度调整）
  const speedPerSec = 1.8; 
  
  const tick = () => {
    // 1. 安全检查：如果退出流程已变或已结束，停止
    if (mgr._exitFadeToken !== token) return;
    if (!mgr._exiting) return;
    
    const now = Date.now();
    const elapsed = now - start;
    if (elapsed >= durationMs) return;

    // 2. 计算 dt (简单起见使用固定帧率估算或实时差)
    const dt = 0.016; 

    // 3. 移动相机 (沿着当前视线后退 = 局部 Z 轴正向)
    try {
      mgr.camera.translateZ(dt * speedPerSec);
    } catch (_) {}

    // 4. 循环
    // 优先尝试使用 canvas 的 RAF，否则降级到 setTimeout
    try {
      if (mgr.page?.canvas?.requestAnimationFrame) {
        mgr.page.canvas.requestAnimationFrame(tick);
        return;
      }
    } catch (_) {}

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(tick);
    } else {
      setTimeout(tick, 16);
    }
  };
  tick();
};

export const enterVoyage = (mgr) => {
  // Toggle: If active, exit immediately
  if (mgr.active) {
    exitVoyage(mgr);
    return;
  }

  try { prepareUiForLaunch(mgr.page); } catch (_) {}
  
  // Ensure assets are loaded
  if (!mgr.loaded) {
    wx.showLoading({ title: '登船准备中...' });
    const pAssets = preloadAssets(mgr, ASSETS);
    const pZodiac = mgr._zodiacSys ? mgr._zodiacSys.preload() : Promise.resolve();
    Promise.all([pAssets, pZodiac]).then(() => {
      wx.hideLoading();
      startVoyage(mgr);
    }).catch((err) => {
      wx.hideLoading();
      console.error('[Moon] Launch failed:', err);
      try { restoreState(mgr); } catch (_) {}
      wx.showToast({ title: '资源加载失败', icon: 'none' });
    });
    return;
  }
  
  startVoyage(mgr);
};

export const exitVoyage = (mgr) => {
  const shouldRestore =
    !!mgr.active ||
    !!mgr.timer ||
    !!mgr.page?.__zenPoetryPaused ||
    !!mgr.milkyWayMesh?.visible ||
    !!mgr._dustBgMesh?.visible ||
    !!mgr._dustSlowMesh?.visible ||
    !!mgr._dustFastMesh?.visible ||
    !!mgr.moonMesh?.visible ||
    !!mgr._orbitSeq?.hasArtifacts?.();
  if (!shouldRestore) return;
  if (mgr._exiting) return;
  mgr._exiting = true;
  const token = ++mgr._exitFadeToken;

  console.log('[Moon] Aborting mission');
  mgr.active = false;
  mgr.phase = 'IDLE';
  try {
    if (mgr.audioContext) {
      try { mgr.audioContext.stop(); } catch (_) {}
      try { mgr.audioContext.destroy(); } catch (_) {}
      mgr.audioContext = null;
    }
  } catch (_) {}

  const fader = mgr.fader;
  // 1. 强制安全获取配置，避免读取报错
  let cfg = {};
  try { cfg = APP_CFG?.moonVoyage?.exit || {}; } catch(_) {}
  
  const fadeInMs = Math.max(0, Number(cfg.fadeInMs ?? 700) || 0);
  const fadeOutMs = Math.max(0, Number(cfg.fadeOutMs ?? 700) || 0);
  let holdMs = Math.max(0, Number(cfg.holdMs ?? 1500) || 0);
  
  // 禅模式额外停留时间
  try {
    const wasZenMode = !!mgr.page?.data?.zenMode;
    if (wasZenMode) {
      const zenExitMs = Math.max(0, Number(APP_CFG?.zen?.exitMs ?? 700) || 0);
      holdMs += (600 + zenExitMs);
    }
  } catch (_) {}

  console.log(`[Moon] Exit Sequence: FadeIn=${fadeInMs}, Hold=${holdMs}, FadeOut=${fadeOutMs}`);

  // ------------------------------------------------------------
  // STEP 1: 立即淡入黑屏 (镜头同时拉远)
  // ------------------------------------------------------------
  try {
    if (mgr.page && mgr.page.setData) {
      console.warn('[Moon] Starting Mask FadeIn. Duration:', fadeInMs);
      
      // 1. 设置淡入时间并显示组件 (但先全透明)
      mgr.page.setData({ 
        globalBlackMask: true,
        globalBlackMaskOpacity: 0,
        globalBlackMaskFadeMs: fadeInMs 
      }, () => {
         console.log('[Moon] setData callback: Mask enabled');
      });
      
      // 2. 强制下一帧执行 opacity=1，确保 transition 生效
      setTimeout(() => {
        try {
           console.warn('[Moon] Setting Opacity to 1');
           mgr.page.setData({ globalBlackMaskOpacity: 1 }, () => {
              console.log('[Moon] setData callback: Opacity set to 1');
           });
        } catch(e) { console.error(e); }
      }, 50); // 增加一点延时确保生效
    }
  } catch (e) { console.error('[Moon] Mask FadeIn failed:', e); }

  // 启动镜头拉远动画
  try {
    playExitZoomEffect(mgr, fadeInMs);
  } catch (e) { console.error('[Moon] Zoom effect failed:', e); }

  try {
    if (fader && typeof fader.fadeInBlack === 'function') {
      fader.fadeInBlack(fadeInMs);
    }
  } catch (e) { console.error('[Moon] Fader fade-in failed:', e); }

  // ------------------------------------------------------------
  // STEP 2: 黑屏完全覆盖后，重置场景 (Hold 期间)
  // ------------------------------------------------------------
  setTimeout(() => {
    // 再次检查是否被中断
    if (token !== mgr._exitFadeToken) return;
    
    console.warn('[Moon] Mask fully covered (FadeIn complete). Restoring state...');
    
    // A. 状态重置 (此时用户看不见)
    try { restoreState(mgr); } catch (_) {}
    try { mgr.page?.__getZenModeMgr?.()?.exit?.(); } catch (_) {}

    // B. 等待 Hold 时间结束，然后淡出
    setTimeout(() => {
      if (token !== mgr._exitFadeToken) return;
      
      console.warn('[Moon] Hold complete. Starting Mask FadeOut...');
      
      // ------------------------------------------------------------
      // STEP 3: 淡出黑屏
      // ------------------------------------------------------------
      try {
        if (mgr.page && mgr.page.setData) {
          mgr.page.setData({ 
            globalBlackMaskFadeMs: fadeOutMs,
            globalBlackMaskOpacity: 0 
          }, () => {
             console.log('[Moon] setData callback: Opacity set to 0 (FadeOut)');
          });
        }
      } catch(_) {}
      
      if (fader && typeof fader.fadeOutBlack === 'function') {
        fader.fadeOutBlack(fadeOutMs);
      }
      
      // 等待淡出彻底完成后，移除 DOM，防止遮挡
      setTimeout(() => {
        if (mgr.page && mgr.page.setData) {
          mgr.page.setData({ globalBlackMask: false });
        }
        mgr._exiting = false;
      }, fadeOutMs + 100);

    }, holdMs);

  }, fadeInMs + 100); // 多给 100ms 缓冲
};
