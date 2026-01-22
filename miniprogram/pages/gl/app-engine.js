
// app-engine.js —— 核心引擎 (AppEngine)
// 职责：负责 3D 环境初始化、Manager 组装、状态管理及核心业务逻辑
// 替代原 main.js 的上帝对象模式，改为类封装

import { 
  convertVec3ToLatLon
} from './geography.js';
import { loadCountries, buildIndex } from './geoindex.js';
import { prefetchTextureUrls, ensureOfflineTextures } from './texture-source.js';
import { createScene, makeBorder, highlight as highlightLayer, updateCameraDistance as updateCamDist, applyZenOverlayFactors, restoreOverlayFactors } from './layers.js';
import { INTERACTION_DEBUG_LOG, INERTIA_LOG_DETAIL, INERTIA_LOG_THROTTLE_MS, FRONT_DOT_MIN_EDGE, HIT_CENTER_MAX_DEG, DEBUG_SELECT, PERF_DIAG_LOG } from './label-constants.js';
import { APP_CFG } from './config.js';
import {
  getZenStarOpacityTarget,
  getNormalStarOpacityTarget,
  createStarfieldController
} from './starfield.glsl.js';
import { createPoetry3D } from './poetry3d.js';
import { applyZenMaterial, restoreZenMaterial, createThemeController } from './theme-manager.js';
import { renderWithBloom } from './bloom-manager.js';
import { createRenderLoop } from './render-loop.js';
import { createSceneUpdater } from './scene-updater.js';
import { createViewportManager } from './viewport-manager.js';
import { createInputManager } from './input-manager.js';
import { createTimezoneManager } from './timezone-manager.js';
import { getCountryOverride as getCountryOverrideExtern } from './tz-overrides.js';
import { createHighlightManager } from './highlight-manager.js';
import { createLightingManager } from './lighting-manager.js';
import { createColliderManager } from './collider-manager.js';
import { createFlyManager } from './fly-manager.js';
import { ZenModeManager, applyZenAutoRotate, applyZenBrake, advanceZenAnimation, advanceRotationFrame, zenState, enterZenMode, exitZenMode, resetZenState, createZenController } from './zen-mode-manager.js';
import { MoonVoyageManager } from './moon-voyage-manager.js';
import { clearZenAudioSaved } from './zen-audio.js';
import { createTweenManager } from './tween-manager.js';
import { createFadeOverlay } from './fade-overlay.js';
import { fixTexture, loadTextureWithRetry, reloadAllTextures, dumpTextureInfo } from './asset-manager.js';
import { loadTexturesSequentially } from './scene-loader.js';
import { createPerfMonitor } from './perf-monitor.js';
import { dumpRendererInfo, exposeDebugTools } from './debug-manager.js';
import { createTouchState, updateInertiaParams } from './touch-state.js';
import { detectEnvironment, applyPlatformHacks, shouldPrefetchTextures } from './platform-manager.js';
import { getSystemInfo } from './sys-info.js';
import { TWEEN } from './threejs-miniprogram.js';

// 兼容旧引用名
const LIGHT_CFG = APP_CFG;

// 常量参数
const RADIUS = 1;
const MARGIN = 1.02;
const OFFSET_Y = -0.55;
const DEBUG = { lonSameSign: true, invertLon: false, invertLat: false, logFly: true, calibLonDeg: 0, calibLatDeg: 15 };
const STAR_LOG = false;

export class AppEngine {
  constructor() {
    this.sys = getSystemInfo();
    this.state = null; // 核心状态容器 (THREE, scene, etc.)
    this.moonMgr = null;
    this.managers = {}; // 存放 input, fly, lighting 等管理器
    
    // 配置相关
    this.cfg = {
      APP_CFG,
      LIGHT_CFG,
      RADIUS,
      DEBUG
    };

    // 内部变量
    this.earthMesh = null;
    this.cloudMesh = null;
    this.earthDayTex = null;
    this.earthPureDayTex = null;
    this.earthNightTex = null;
    this.earthOldMat = null;
    this.countryFeatures = null;
    this.searchIndex = null;
    this.tropicGroup = null;
    this.borderGroup = null;
    this.colliderGroup = null;
    this.earthReady = false;
    this.cloudVisibleTarget = null; // [State] Track user intent for cloud visibility (null = unset)
    
    this.composer = null;
    this.bloomPass = null;
    this.poetry3d = null;
    this.themeController = null;
    this.starCtl = null;
    this.loop = null;
    
    this.touch = createTouchState(this.sys);
    
    // 灯光基准值
    this.ambientBase = 0;
    this.dirLightBase = 0;
    this.brightnessScale = Number(APP_CFG?.brightness?.default ?? 0.85);
  }

  // 初始化入口
  init(page) {
    wx.createSelectorQuery().select('#gl').fields({ node: true, size: true }).exec(res => {
      this._setup(res, page);
    });
  }

  _setup(res, page) {
    const self = this;
    const hit = res && res[0];
    if (!hit || !hit.node) { console.error('[FAIL] canvas 节点未取到'); return; }

    const canvas = hit.node;
    const width = Math.max(1, Math.min(hit.width, this.sys.windowWidth || hit.width));
    const height = Math.max(1, Math.min(hit.height, this.sys.windowHeight || hit.height));
    const dpr = this.sys.pixelRatio;

    // 1. 创建核心场景
    const env = createScene(canvas, dpr, width, height);
    const { THREE, renderer, scene, camera, dirLight, ambientLight, globeGroup, baseDist } = env;

    // 2. 基础管理器
    const tweener = createTweenManager();
    const fader = createFadeOverlay(THREE, camera, tweener);

    try { globeGroup.rotation.order = 'XYZ'; } catch(_){}

    const minZoom = (APP_CFG?.camera?.minZoom ?? 0.6);
    const maxZoom = (APP_CFG?.camera?.maxZoom ?? 2.86);
    const clampZoom = (z) => Math.max(minZoom, Math.min(maxZoom, z));

    resetZenState();

    // 3. Moon Manager
    this.moonMgr = new MoonVoyageManager();
    this.moonMgr.init(THREE, scene, globeGroup, camera, page, fader);

    updateCamDist(camera, baseDist, zenState.zoom);

    // 4. 灯光初始化
    const __useZenLights = !!(APP_CFG?.normal?.useZenLighting);
    const __clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const __normalAmbient = __useZenLights
      ? (__clamp(LIGHT_CFG?.zen?.ambientIntensity ?? LIGHT_CFG.normal.ambientIntensity, 0.0, 1.0))
      : (__clamp(LIGHT_CFG.normal.ambientIntensity, 0.0, 1.0));
    const __normalDir = __useZenLights
      ? (__clamp(LIGHT_CFG?.zen?.dirLightIntensityRight ?? LIGHT_CFG.normal.dirLightIntensity, 0.2, 2.4))
      : (__clamp(LIGHT_CFG.normal.dirLightIntensity, 0.2, 2.4));

    this.ambientBase = __normalAmbient;
    this.dirLightBase = __normalDir;

    const lighting = createLightingManager({ THREE, globeGroup, camera, dirLight, ambientLight, LIGHT_CFG, tweener });
    lighting.applyNormalIntensity(__normalAmbient * this.brightnessScale, __normalDir * this.brightnessScale);
    this.managers.lighting = lighting;

    // 5. Highlight Manager (Moved up for ZenController dependency)
    const highlight = createHighlightManager({ 
      THREE, globeGroup, camera, APP_CFG, highlightLayer, RADIUS, 
      onAutoCleared: () => { try { page?.onCountryPicked?.(null); } catch(_){} } 
    });
    this.managers.highlight = highlight;

    // 6. 辅助系统 (Starfield, Perf, etc.)
    const perfMonitor = createPerfMonitor();
    dumpRendererInfo(THREE, renderer);

    // 初始视角
    this._initCameraView();

    try {
      this.starCtl = createStarfieldController(THREE, scene, LIGHT_CFG?.normal);
      const starOp = (LIGHT_CFG?.normal?.starOpacity ?? 0.0);
      this.starCtl?.setTargetOpacity?.(starOp);
      this.starCtl?.enableBreathDiagnostics?.(12000);
    } catch(e){ console.error('[star] init error', e); }

    const setZoom = (z) => {
      this.setZoom(z);
      try { if (INTERACTION_DEBUG_LOG) console.log('[setZoom]', 'z=', Number(z).toFixed(3)); } catch(_){}
    };
    
    // 7. 其他 Managers
    const raycaster = new THREE.Raycaster();
    const collider = createColliderManager({ THREE, globeGroup });
    const flyMgr = createFlyManager({ THREE, globeGroup, camera, RADIUS, touch: this.touch, DEBUG });
    this.managers.flyMgr = flyMgr;

    exposeDebugTools(typeof wx !== 'undefined' ? wx : undefined, { 
      setZoom, touch: this.touch, flyMgr, RADIUS, convertVec3ToLatLon, THREE, INTERACTION_DEBUG_LOG 
    });

    applyPlatformHacks(this.sys);
    const { isPCClient: __isPCClient } = detectEnvironment(this.sys);
    const TEX_FLIP_Y = true;

    try {
      if (shouldPrefetchTextures(this.sys, getApp()?.globalData)) {
        prefetchTextureUrls();
        ensureOfflineTextures();
      }
    } catch(_){ }

    // 8. Scene Context 构建
    const sceneCtx = {
      THREE,
      globeGroup,
      config: {
        APP_CFG,
        LIGHT_CFG,
        RADIUS,
        TEX_FLIP_Y,
        isPCClient: __isPCClient
      },
      checkState: () => !!this.state,
      refs: {
        earthMesh: () => this.earthMesh,
        earthDayTex: () => this.earthDayTex,
        earthPureDayTex: () => this.earthPureDayTex,
        earthNightTex: () => this.earthNightTex,
        cloudMesh: () => this.cloudMesh,
        tropicGroup: () => this.tropicGroup,
        borderGroup: () => this.borderGroup,
        zenActive: () => zenState.active,
        zoom: () => zenState.zoom,
        currentTheme: () => this.themeController?.currentTheme || 'default',
        themeState: () => this.themeController?.themeState,
        tweener: () => tweener,
        page: () => page,
        composer: () => this.composer,
        bloomPass: () => this.bloomPass,
        poetry3d: () => this.poetry3d,
        earthOldMat: () => this.earthOldMat
      },
      setters: {
        setEarthMesh: (v) => { this.earthMesh = v; },
        setEarthDayTex: (v) => { this.earthDayTex = v; },
        setEarthPureDayTex: (v) => { this.earthPureDayTex = v; },
        setEarthNightTex: (v) => { this.earthNightTex = v; },
        setCloudMesh: (v) => { 
          this.cloudMesh = v;
          // Apply saved visibility intent if set (Sync race condition)
          if (v && this.cloudVisibleTarget !== null) {
             try { v.visible = this.cloudVisibleTarget; } catch(_){}
          }
        },
        setTropicGroup: (v) => { this.tropicGroup = v; },
        setEarthReady: (v) => { this.earthReady = v; },
        setComposer: (v) => { this.composer = v; },
        setBloomPass: (v) => { this.bloomPass = v; },
        setPoetry3d: (v) => { this.poetry3d = v; },
        setEarthOldMat: (v) => { this.earthOldMat = v; }
      }
    };
    this.sceneCtx = sceneCtx;

    // 9. 高级控制器 (Theme, Zen)
    this.themeController = createThemeController({
      refs: sceneCtx.refs,
      APP_CFG,
      THREE,
      debugLog: INTERACTION_DEBUG_LOG
    });

    const zenController = createZenController({
      ...sceneCtx,
      APP_CFG, LIGHT_CFG, touch: this.touch, flyMgr, highlight, page, starCtl: this.starCtl, lighting,
      themeController: this.themeController, scene, camera, width, height, sysInfo: this.sys, RADIUS,
      dirLightBase: this.dirLightBase, ambientLight, dirLight,
      ambientBase: this.ambientBase,
      brightnessScale: () => this.brightnessScale,
      createPoetry3D, applyZenOverlayFactors, restoreOverlayFactors,
      applyZenMaterial, restoreZenMaterial,
      getZenStarOpacityTarget, getNormalStarOpacityTarget,
      TROPIC_GROUP_REF: sceneCtx.refs.tropicGroup,
      BORDER_GROUP_REF: sceneCtx.refs.borderGroup,
      earthMeshRef: sceneCtx.refs.earthMesh,
      earthDayTexRef: sceneCtx.refs.earthDayTex,
      earthPureDayTexRef: sceneCtx.refs.earthPureDayTex,
      earthNightTexRef: sceneCtx.refs.earthNightTex,
    });
    this.managers.zenController = zenController;
    const setZenMode = zenController.setMode;

    // 10. 资源加载
    loadTexturesSequentially(sceneCtx).then(() => {
       if (this.moonMgr) {
         // Delay moon assets preload to avoid network contention with Cloud/Night textures
         // which are loaded shortly after the initial Day texture.
         // Giving it 8s ensures the Earth is fully ready and smooth before starting background downloads.
         setTimeout(() => {
            console.log('[AppEngine] Triggering Moon preload (delayed)...');
            this.moonMgr.preload().catch(e => console.warn('[AppEngine] Moon preload bg fail', e));
         }, 8000);
       }
    });

    // 11. 数据加载
    const getCountryOverride = (f) => getCountryOverrideExtern(f);
    const tzMgr = createTimezoneManager({
      THREE,
      RADIUS,
      page,
      getCountryOverride,
      searchRef: () => this.searchIndex,
      countriesRef: () => this.countryFeatures,
      tzlookup: (lat, lon) => page.tzlookup?.(lat, lon),
      computeGmtOffsetStr: (tzName) => page.computeGmtOffsetStr?.(tzName),
      formatTime: (date, tzName) => page.formatTime?.(date, tzName),
      touchRef: () => this.touch,
    });
    this.managers.tzMgr = tzMgr;

    loadCountries().then((features) => {
      this.countryFeatures = features;
      this.borderGroup = makeBorder(THREE, globeGroup, this.countryFeatures);
      try { if (this.borderGroup) this.borderGroup.visible = false; } catch(_){}
      if (this.earthReady) {
        setTimeout(() => { try { if (this.borderGroup) this.borderGroup.visible = true; } catch(_){} }, 1000);
      }
      try { collider.build(this.countryFeatures); this.colliderGroup = collider.getGroup(); } catch(_){ this.colliderGroup = null; }
      this.searchIndex = buildIndex(features);
      try { page?.onCountriesLoaded?.(features); } catch (e) { }
    });

    // 12. 输入管理
    const input = createInputManager({
      THREE,
      touch: this.touch,
      zoomRef: () => zenState.zoom,
      setZoom: (z) => { zenState.zoom = z },
      clampZoom,
      updateCamDist,
      camera,
      baseDist,
      zenActiveRef: () => zenState.active,
      raycaster,
      width,
      height,
      globeGroup,
      earthMeshRef: () => this.earthMesh,
      colliderGroupRef: () => this.colliderGroup,
      RADIUS,
      countryFeaturesRef: () => this.countryFeatures,
      searchRef: () => this.searchIndex,
      highlight,
      page,
      tzMgr,
      debugLog: INTERACTION_DEBUG_LOG,
      debugDetail: INERTIA_LOG_DETAIL,
      logThrottleMs: INERTIA_LOG_THROTTLE_MS,
      debugSelect: DEBUG_SELECT,
      lonSameSign: DEBUG.lonSameSign,
      isInteractionBlocked: () => this.isMoonVoyageActive()
    });
    this.managers.input = input;

    // 13. 渲染循环
    this.loop = createRenderLoop(() => canvas);
    
    const sceneUpdater = createSceneUpdater({
      perfMonitor, tweener, highlight, page, flyMgr, starCtl: this.starCtl, tzMgr,
      lighting, touch: this.touch, globeGroup, camera, baseDist, clampZoom, updateCamDist,
      APP_CFG, LIGHT_CFG, setZenMode,
      THREE, renderer, scene, width, height,
      refs: { ...sceneCtx.refs, ...sceneCtx.setters },
      getState: () => this.state,
      isMoonVoyageActive: () => this.moonMgr && this.moonMgr.isActive()
    });

    const render = () => { sceneUpdater.update(); };
    this.loop.start(render);

    const viewport = createViewportManager({ wx, renderer, camera, state: { width, height } }); 
    const onWinResize = (evt) => { viewport.update(); };
    try { wx.onWindowResize(onWinResize); } catch(_){ }

    // 14. 保存最终状态到实例
    this.state = { 
        THREE, scene, renderer, globeGroup, camera, dirLight, 
        width, height, page, baseDist,
        onWinResizeCb: onWinResize,
        // Helper accessors for compatibility
        get earthMesh() { return self.earthMesh },
        get COUNTRY_FEATURES() { return self.countryFeatures },
        get search() { return self.searchIndex }
    };
  }
  
  _initCameraView() {
    try {
      const init = APP_CFG?.camera?.initialCenterDeg;
      if (init && typeof init.lat === 'number' && typeof init.lon === 'number') {
        const rad = Math.PI / 180;
        const latRad = (init.lat || 0) * rad;
        const lonRad = (init.lon || 0) * rad;
        const tLat = DEBUG.invertLat ? -latRad : latRad;
        const tLon = DEBUG.invertLon ? -lonRad : lonRad;
        const lonRotTarget = (-(tLon) - Math.PI/2) - ((DEBUG.calibLonDeg||0) * rad);
        this.touch.rotX = 0; this.touch.rotY = lonRotTarget;
        zenState.restore.rotX = 0; zenState.restore.rotY = lonRotTarget;
      }
    } catch(_){ }
  }

  // —— Public API ——

  teardown() {
    if (!this.state) return;
    try { if (this.state.onWinResizeCb) wx.offWindowResize(this.state.onWinResizeCb); } catch(_){ }
    try { this.loop?.stop(); } catch(_){ }
    if (this.state.scene) {
        this.state.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    this.state.renderer?.dispose?.();
    this.state = null;
    this.managers = {};
  }
  
  flyTo(lat, lon, duration = 800) {
    try { this.managers.flyMgr?.flyTo(lat, lon, duration); } catch(_){ }
  }
  
  setTheme(kind = 'default') {
    this.themeController?.setTheme(kind);
  }
  
  setNightMode(on) {
    try { this.setTheme(on ? 'night' : 'default'); } catch(_){}
  }
  
  setCloudVisible(on) {
          try {
            const isVisible = !!on;
            this.cloudVisibleTarget = isVisible; // 1. Save intent
            
            // 2. Try standard update
            if (this.cloudMesh) {
              this.cloudMesh.visible = isVisible;
              // Force material update to ensure transparency/texture state is applied
              if (this.cloudMesh.material) this.cloudMesh.material.needsUpdate = true;
              return;
            }
            
            // 3. Fallback: Search in scene (Recover lost reference)
      // Sometimes mesh exists in globeGroup but this.cloudMesh is null
      if (this.sceneCtx && this.sceneCtx.globeGroup) {
         const mesh = this.sceneCtx.globeGroup.getObjectByName('CLOUD');
         if (mesh) {
            this.cloudMesh = mesh;
            mesh.visible = isVisible;
         }
      }
    } catch(e){ console.warn('[AppEngine] setCloudVisible error', e); }
  }
  
  setPerfMode(mode) {
    try {
      const dragging = (mode === 'drag');
      this.starCtl?.setDragging?.(dragging);
    } catch(_){ }
  }
  
  setPaused(on) {
    const p = !!on;
    if (p) this.loop?.stop(); else this.loop?.start(); 
  }
  
  setZenMode(on) {
    this.managers.zenController?.setMode(on);
  }
  
  enterMoonVoyage() {
    try { TWEEN?.removeAll?.(); } catch(e){ console.warn('[Moon] Tween clear fail', e); }
    if (this.moonMgr) this.moonMgr.enter();
  }
  
  exitMoonVoyage() {
    if (this.moonMgr) this.moonMgr.exit();
  }
  
  setMoonVoyageSpeed(mult) {
    if (this.moonMgr) this.moonMgr.setSpeed(mult);
  }
  
  isMoonVoyageActive() {
    return this.moonMgr && this.moonMgr.isActive();
  }
  
  startPoetry3D(lines, conf) {
    try {
      if (!this.poetry3d && this.earthMesh && this.state) {
        const { THREE, scene, camera, width, height } = this.state;
        this.poetry3d = createPoetry3D(THREE, scene, camera, this.earthMesh, width, height, APP_CFG?.poetry || {});
        if (this.sceneCtx && this.sceneCtx.setters) this.sceneCtx.setters.setPoetry3d(this.poetry3d);
      }
      this.poetry3d?.setEnabled?.(true);
      this.poetry3d?.start?.(lines, conf || (APP_CFG?.poetry || {}));
    } catch(_){}
  }
  
  stopPoetry3D() {
    try { this.poetry3d?.stop?.(); this.poetry3d?.setEnabled?.(false); } catch(_){}
  }
  
  async refreshTextures() {
    try {
      const { THREE } = this.state;
      const loader = new THREE.TextureLoader();
      const success = await reloadAllTextures({
           loader,
           THREE,
           isPC: this.cfg.DEBUG.isPCClient,
           state: this.state,
           cloudMesh: this.cloudMesh,
           fixTexture, 
           updateTheme: () => this.themeController.refresh(),
           setEarthDayTex: (tex) => { this.earthDayTex = tex; },
           setEarthNightTex: (tex) => { this.earthNightTex = tex; },
           setEarthPureDayTex: (tex) => { this.earthPureDayTex = tex; }
      });

      try { await this.moonMgr?.refreshAssets?.({ preload: true }); } catch(_){ }
      
      if (success) {
          try { clearZenAudioSaved(); /* console.info('[assets] 音乐缓存已清除'); */ } catch(_){}
      }
      return success;
    } catch(e){
      console.error('[AppEngine] refreshTextures error', e);
      return false;
    }
  }
  
  setInertia(pct) {
    try { updateInertiaParams(this.touch, pct); } catch(e) { }
  }
  
  setBrightnessScale(s) {
    try {
      const minV = Number(APP_CFG?.brightness?.min ?? 0.5);
      const maxV = Number(APP_CFG?.brightness?.max ?? 1.4);
      const v = Math.max(minV, Math.min(maxV, Number(s) || APP_CFG?.brightness?.default || 1));
      this.brightnessScale = v;
      if (!zenState.active && this.managers.lighting) {
        const tr3 = (APP_CFG?.ui?.transitions) || {};
        const lm = Number(tr3.lightSmoothMs || 200);
        this.managers.lighting.applyNormalIntensitySmooth(
          this.ambientBase * this.brightnessScale, 
          this.dirLightBase * this.brightnessScale, 
          lm
        );
      }
    } catch(_){}
  }
  
  // Event Handlers
  onTouchStart(e) { this.managers.input?.onTouchStart(e); }
  onTouchMove(e) { this.managers.input?.onTouchMove(e); }
  onTouchEnd(e) { this.managers.input?.onTouchEnd(); }
  
  nudgeCenter(latDeg, lonDeg) {
     // Placeholder
  }

  getRenderContext() {
    if (!this.state) return null;
    return { 
      THREE: this.state.THREE, 
      scene: this.state.scene, 
      camera: this.state.camera, 
      width: this.state.width, 
      height: this.state.height, 
      globeGroup: this.state.globeGroup, 
      isFlying: !!(this.managers.flyMgr && this.managers.flyMgr.isFlying) 
    };
  }

  getCountries() {
    return this.countryFeatures || null;
  }

  setDebugFlags(flags) {
    try { Object.assign(this.cfg.DEBUG, flags||{}); } catch(_){ }
  }

  nudgeCenter(latDeg, lonDeg) {
    // 直接设置旋转目标（无动画）
    try {
      const rad = Math.PI / 180;
      const latRad = (latDeg || 0) * rad;
      const lonRad = (lonDeg || 0) * rad;
      const tLat = this.cfg.DEBUG.invertLat ? -latRad : latRad;
      const tLon = this.cfg.DEBUG.invertLon ? -lonRad : lonRad;
      // 保持赤道水平
      const lonRotTarget = (-(tLon) - Math.PI/2) - ((this.cfg.DEBUG.calibLonDeg||0) * rad);
      this.touch.rotX = 0; 
      this.touch.rotY = lonRotTarget;
    } catch(e) { console.error('[nudge] error', e); }
  }

  selectCountryByCode(code) {
    try {
      if (!this.countryFeatures) return false;
      const codeUp = String(code || '').toUpperCase();
      
      const findFeat = (c) => this.countryFeatures.find(feat => {
        const p = feat?.props || {};
        const a3 = String(p.ISO_A3 || '').toUpperCase();
        const a2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
        return a3 === c || a2 === c;
      }) || null;

      if (codeUp === 'TWN' || codeUp === 'TW') {
        const fTW = findFeat('TWN') || findFeat('TW');
        const fCN = findFeat('CHN') || findFeat('CN');
        const targets = [];
        if (fCN) targets.push(fCN);
        if (fTW) targets.push(fTW);
        
        this.managers.highlight?.setHighlight(targets.length ? targets : null);
        try { this.state.page?.onCountryPicked?.(fTW || null); } catch(_){}
        return !!(fTW || fCN);
      }
      
      const target = findFeat(codeUp);
      if (target) {
        this.managers.highlight?.setHighlight(target);
        return true;
      }
    } catch(e) { console.error(e); }
    return false;
  }

  setZoom(z) {
    if (typeof z !== 'number' || !isFinite(z)) return;
    const minZoom = (this.cfg.APP_CFG?.camera?.minZoom ?? 0.6);
    const maxZoom = (this.cfg.APP_CFG?.camera?.maxZoom ?? 2.86);
    const clampZoom = (v) => Math.max(minZoom, Math.min(maxZoom, v));
    
    const newZoom = clampZoom(z);
    if (newZoom !== zenState.zoom) {
      zenState.zoom = newZoom;
      if (this.state && this.state.camera && this.state.baseDist !== undefined) {
         updateCamDist(this.state.camera, this.state.baseDist, zenState.zoom);
      }
    }
  }
}
