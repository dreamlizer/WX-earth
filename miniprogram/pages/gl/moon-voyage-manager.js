
import { MoonOrbitSequence } from './moon-orbit-sequence.js';
import { VoyageEncounters } from './moon-voyage-encounters.js';
import { ZodiacSystem } from './moon-voyage-zodiac.js';
import { detectEnvironment } from './platform-manager.js';

import { 
  applyEarthNearAnchor, 
  setGlobeWorldPosition, 
  clampGlobeToViewport, 
  forceGroupVisible, 
  ensureEarthVisibleInVoyage, 
  findEarthMesh,
  syncEarthShaderUniforms
} from './moon-voyage-earth-utils.js';

import { 
  rebuildMilkyWay, 
  rebuildStarDust, 
  refreshMainStarfieldMesh, 
  createMoon 
} from './moon-voyage-scene-setup.js';

import { 
  startMoonLyrics, 
  stopMoonLyrics 
} from './moon-voyage-lyrics.js';

import { 
  playAudio, 
  stopZenAudio 
} from './moon-voyage-audio.js';

import { 
  uiMaskFadeIn, 
  uiMaskFadeOut, 
  prepareUiForLaunch, 
  pauseZenPoetryAndUi 
} from './moon-voyage-ui.js';

import { 
  preloadAssets, 
  refreshAssets 
} from './moon-voyage-assets.js';
import { getSystemInfo } from './sys-info.js';

import {
  ASSETS,
  enterVoyage,
  exitVoyage,
  restoreState
} from './moon-voyage-lifecycle.js';

export class MoonVoyageManager {
  constructor() {
    this.THREE = null;
    this.scene = null;
    this.globeGroup = null;
    this.camera = null;
    this.moonGroup = null;
    this.moonMesh = null;
    this.fader = null;
    this.page = null;
    
    this.active = false;
    this.loaded = false;
    this.audioContext = null;

    this._speedMult = 1.0;
    this._exiting = false;
    this._exitFadeToken = 0;
    
    // Timeline state
    this.startTime = 0;
    this.timer = null;
    this.phase = 'IDLE'; 
    
    // Original state backup
    this._originalLights = {};

    // Internal state
    this._milkyWayFadeSec = 1.2;
    this._voyageTargetRotY = 0.85;
    this._milkyWayScrollTime = 0.0;
    this._milkyWayBaseSizeScale = null;
    this._milkyWayBaseBrightnessGain = null;
    this._mainStarfieldMesh = null;
    this._dustSlowMesh = null;
    this._dustFastMesh = null;
    this._dustBgMesh = null;
    this._dustSlowTime = 0.0;
    this._dustFastTime = 0.0;
    this._dustBgTime = 0.0;
    this._companionFx = null;
    this._zodiacSys = null;
    this._dustLocalZ = null;
    this._tmpDustForward = null;
    this._tmpDustRight = null;
    this._tmpDustPos = null;
    this._tmpMoonForward = null;
    this._tmpMoonLeft = null;
    this._tmpMoonStart = null;
    this._tEarthGone = null;
    this._tEarthFadeStart = null;
    this._tmpEarthWorld = null;
    this._moonStartWorld = null;
    this._moonStartReady = false;
    this._moonUiNextUpdate = 0;
    this.__bgDiagNext = 0;
    this.__cutDiagNext = 0;
    this.__starResolveNext = 0;
    this._orbitSeq = null;
    this._tmpEarthBetweenPos = null;

    this._earthMaterialBackup = null;
    this._earthMaterialBackupMesh = null;
    this._earthVoyageMaterial = null;
    this._earthFallbackMesh = null;

    this._moonTexReady = false;
    this._moonShowT0 = null;
    this._corridorRollApplied = false;
    this._moonShowPos0 = null;
    this._moonShowScale0 = null;
    this._tmpMoonWorldNow = null;

    this._earthNearOffset = null;
    this._earthNearSig = '';
    this._tmpEarthNearPos = null;
    this._earthNearBlend = 1.0;
    this._earthNearBlendPos0 = null;
    this._earthNearBlendScale0 = null;
    this._tmpEarthNearTargetWorld = null;
    this._tmpEarthNearFromWorld = null;
    this._tmpEarthNearSmoothedWorld = null;
    this._tmpGlobeWorldToLocal = null;
    this._tmpClampCenterWorld = null;
    this._tmpClampCenterNdc = null;
    this._tmpClampPointNdc = null;
    this._tmpClampRightWorld = null;
    this._tmpClampUpWorld = null;
    this._tmpClampScaleWorld = null;
    this._tmpClampWorld = null;
    this._tmpEarthCenterWorld = null;
    this._tmpEarthLightDir = null;

    this._lyricTimers = [];
    this._lyricToken = 0;
    this._startState = null;
    this._lifecycleToken = 0;
    this._disposed = false;
    this._timers = new Set();
    this._pendingCancels = new Set();
    this._preloadPromise = null;
    this._entering = false;
  }

  _isLifecycleCurrent(token) {
    return !this._disposed && token === this._lifecycleToken;
  }

  _schedule(callback, delayMs, token = this._lifecycleToken) {
    if (!this._isLifecycleCurrent(token)) return null;
    const timer = setTimeout(() => {
      this._timers.delete(timer);
      if (!this._isLifecycleCurrent(token)) return;
      callback();
    }, delayMs);
    this._timers.add(timer);
    return timer;
  }

  _clearTimer(timer) {
    if (timer == null) return;
    try { clearTimeout(timer); } catch (_) {}
    this._timers.delete(timer);
  }

  _clearTimers() {
    for (const timer of this._timers) {
      try { clearTimeout(timer); } catch (_) {}
    }
    this._timers.clear();
  }

  _trackPendingCancel(cancel) {
    if (typeof cancel !== 'function') return () => {};
    if (this._disposed) {
      try { cancel(); } catch (_) {}
      return () => {};
    }
    this._pendingCancels.add(cancel);
    return () => this._pendingCancels.delete(cancel);
  }

  _disposeOwnedMesh(mesh) {
    if (!mesh) return;
    try { mesh.parent?.remove?.(mesh); } catch (_) {
      try { this.scene?.remove?.(mesh); } catch (_) {}
    }
    try { mesh.geometry?.dispose?.(); } catch (_) {}
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const textures = new Set();
    for (const material of materials) {
      if (!material) continue;
      const disposeTexture = (texture) => {
        if (!texture?.isTexture || textures.has(texture)) return;
        textures.add(texture);
        try { texture.dispose?.(); } catch (_) {}
      };
      for (const value of Object.values(material)) disposeTexture(value);
      for (const uniform of Object.values(material.uniforms || {})) disposeTexture(uniform?.value);
      try { material.dispose?.(); } catch (_) {}
    }
  }

  // Delegated methods
  _applyEarthNearAnchor(opts) { applyEarthNearAnchor({ ...opts, mgrState: this }); }
  _setGlobeWorldPosition(worldPos) { setGlobeWorldPosition(this.THREE, this.globeGroup, worldPos); }
  _clampGlobeToViewport(marginNdc) { clampGlobeToViewport(this.THREE, this.globeGroup, this.camera, marginNdc, this); }
  _uiMaskFadeIn(fadeInMs, token) { uiMaskFadeIn(this.page, fadeInMs, token, this); }
  _uiMaskFadeOut(fadeOutMs, token) { uiMaskFadeOut(this.page, fadeOutMs, token, this); }
  refreshAssets(opts) { return refreshAssets(this, opts, ASSETS); }
  _findEarthMesh() { return findEarthMesh(this.globeGroup); }
  _forceGroupVisible(group) { forceGroupVisible(group); }
  _ensureEarthVisibleInVoyage() { ensureEarthVisibleInVoyage(this.THREE, this.globeGroup, this); }
  _prepareUiForLaunch() { prepareUiForLaunch(this.page); }
  _pauseZenPoetryAndUi() { pauseZenPoetryAndUi(this); }
  _stopZenAudio() { stopZenAudio(this.page); }
  _stopMoonLyrics() { stopMoonLyrics(this); }
  _startMoonLyrics(baseTimeMs) { startMoonLyrics(this, baseTimeMs); }
  _playAudio() { playAudio(this, ASSETS); }
  _rebuildMilkyWay() { rebuildMilkyWay(this.THREE, this.scene, this); }
  _rebuildStarDust() { rebuildStarDust(this.THREE, this.scene, this); }
  _refreshMainStarfieldMesh() { refreshMainStarfieldMesh(this.scene, this); }
  createMoon() { createMoon(this.THREE, this.scene, this); }
  preload() { return preloadAssets(this, ASSETS); }
  _syncEarthShaderUniforms() { syncEarthShaderUniforms(this.THREE, this.globeGroup, this.camera, this.scene, this._findEarthMesh(), this._moonDebug); }
  _restoreState() { restoreState(this); }

  init(THREE, scene, globeGroup, camera, page, fader = null) {
    this._disposed = false;
    ++this._lifecycleToken;
    this.THREE = THREE;
    this.scene = scene;
    this.globeGroup = globeGroup;
    this.camera = camera;
    this.page = page;
    this.fader = fader;

    this._isDevtools = false;
    // PC 微信客户端会忽略 texture.flipY，需要像地球那样对月球/机器人贴图做纹理矩阵翻转。
    // 这里判定一次，传给月球与机器人贴图创建处（非 PC 平台下 fixTexture 为 no-op）。
    this._isPCClient = false;
    try {
      const info = getSystemInfo();
      const envInfo = detectEnvironment(info);
      this._isDevtools = !!envInfo.isDevtools;
      this._isPCClient = !!envInfo.isPCClient;
    } catch (_) {}
    this._moonDebug = !!this.page?.__moonDebug;
    
    this._rebuildMilkyWay();
    this._rebuildStarDust();
    this._refreshMainStarfieldMesh();
    this._orbitSeq = this._orbitSeq || new MoonOrbitSequence();
    try { this._orbitSeq.init(THREE, scene); } catch (_) {}
    this._companionFx = this._companionFx || new VoyageEncounters();
    try { this._companionFx.setContext({ THREE, scene, camera, isDevtools: this._isDevtools, isPCClient: this._isPCClient }); } catch (_) {}
    this._zodiacSys = this._zodiacSys || new ZodiacSystem();
    try { 
      this._zodiacSys.setContext({ THREE, scene, isDevtools: this._isDevtools }); 
      this._zodiacSys.init();
    } catch (_) {}
    
  }

  isActive() {
    return this.active;
  }

  setSpeed(mult) {
    const v = Number(mult);
    if (!isFinite(v)) return;
    this._speedMult = Math.max(0.1, Math.min(20.0, v));
  }

  enter() {
    enterVoyage(this);
  }

  exit() {
    exitVoyage(this);
  }

  dispose() {
    if (this._disposed) return;
    const wasEntering = this._entering;
    this._disposed = true;
    ++this._lifecycleToken;
    ++this._exitFadeToken;
    this.active = false;
    this.phase = 'IDLE';
    this._entering = false;
    this._exiting = false;

    this._clearTimers();
    for (const cancel of this._pendingCancels) {
      try { cancel(); } catch (_) {}
    }
    this._pendingCancels.clear();
    if (this.timer) {
      try { clearInterval(this.timer); } catch (_) {}
      this.timer = null;
    }

    const page = this.page;
    this.page = null;
    try { stopMoonLyrics(this); } catch (_) {}
    if (this.audioContext) {
      try { this.audioContext.stop?.(); } catch (_) {}
      try { this.audioContext.destroy?.(); } catch (_) {}
      this.audioContext = null;
    }
    try { this._companionFx?.dispose?.(); } catch (_) {}
    try { this._orbitSeq?.dispose?.(); } catch (_) {}
    try { this._zodiacSys?.dispose?.(); } catch (_) {}

    try {
      const earthMesh = findEarthMesh(this.globeGroup);
      if (earthMesh && this._earthMaterialBackup && earthMesh === this._earthMaterialBackupMesh) {
        earthMesh.material = this._earthMaterialBackup;
      }
    } catch (_) {}
    if (this._earthVoyageMaterial && this._earthVoyageMaterial !== this._earthMaterialBackup) {
      try { this._earthVoyageMaterial.dispose?.(); } catch (_) {}
    }
    this._earthVoyageMaterial = null;
    this._earthMaterialBackup = null;
    this._earthMaterialBackupMesh = null;

    const ownedMeshes = [
      this.moonMesh,
      this.milkyWayMesh,
      this._dustBgMesh,
      this._dustSlowMesh,
      this._dustFastMesh,
      this._earthFallbackMesh
    ];
    for (const mesh of new Set(ownedMeshes)) this._disposeOwnedMesh(mesh);

    if (page?.__moonVoyageMgr === this) {
      page.__moonVoyageMgr = null;
      page.debugSpeedUp = null;
    }
    try { if (wasEntering) wx.hideLoading?.(); } catch (_) {}

    this.moonMesh = null;
    this.milkyWayMesh = null;
    this._dustBgMesh = null;
    this._dustSlowMesh = null;
    this._dustFastMesh = null;
    this._earthFallbackMesh = null;
    this._mainStarfieldMesh = null;
    this._companionFx = null;
    this._orbitSeq = null;
    this._zodiacSys = null;
    this._preloadPromise = null;
    this.loaded = false;
    this.texPath = null;
    this.normPath = null;
    this.audioPath = null;
    this.THREE = null;
    this.scene = null;
    this.globeGroup = null;
    this.camera = null;
    this.fader = null;
  }
}
