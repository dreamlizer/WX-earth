// 交互/渲染/检索（入口）
// 拆分：geoindex（数据索引/候选集） + layers（场景/图层/渲染）

import { 
  convertLatLonToVec3,
  convertVec3ToLatLon,
  featureContains,
  normalizeLon
} from './geography.js';
import { loadCountries, buildIndex, gatherCandidates } from './geoindex.js';
import { getTextureUrl, prefetchTextureUrls, ensureOfflineTextures, clearTextureCache, clearTextureSaved } from './texture-source.js';
import { createScene, makeBorder, makeEquatorAndTropics, highlight as highlightLayer, updateCameraDistance as updateCamDist, makeCountryColliders, applyZenOverlayFactors, restoreOverlayFactors } from './layers.js';
import { INTERACTION_DEBUG_LOG, PERF_HIDE_STAR_ON_ON_DRAG, INERTIA_NONLINEAR, INERTIA_POWER, INERTIA_DAMP_MIN, INERTIA_DAMP_MAX, INERTIA_SPEED_MIN, INERTIA_SPEED_MAX, INERTIA_GAIN_BASE, INERTIA_GAIN_SCALE, INERTIA_LOG_DETAIL, INERTIA_LOG_THROTTLE_MS, INERTIA_APPLY_LOG_THROTTLE_MS, FRONT_DOT_MIN_EDGE, HIT_CENTER_MAX_DEG, DEBUG_SELECT, PERF_DIAG_LOG } from './label-constants.js';
import { createDayNightMaterial } from './shaders/dayNightMix.glsl.js';
import { APP_CFG } from './config.js';
import { getZenStarOpacityTarget, getNormalStarOpacityTarget, createStarfieldController } from './starfield.glsl.js';
import { createPoetry3D } from './poetry3d.js';
import { applyTheme, applyZenMaterial, restoreZenMaterial, tuneZenMaterialUniforms, createThemeState, applyThemeWithState } from './theme-manager.js';
import { renderWithBloom } from './bloom-manager.js';
import { createRenderLoop } from './render-loop.js';
import { createViewportManager } from './viewport-manager.js';
import { createInputManager } from './input-manager.js';
import { createTimezoneManager } from './timezone-manager.js';
import { getCountryOverride as getCountryOverrideExtern } from './tz-overrides.js';
import { createHighlightManager } from './highlight-manager.js';
import { createLightingManager } from './lighting-manager.js';
import { createColliderManager } from './collider-manager.js';
import { createFlyManager } from './fly-manager.js';
import { applyZenAutoRotate, applyZenBrake, advanceZenAnimation, advanceRotationFrame, zenState } from './zen-mode-manager.js';
import { clearZenAudioSaved } from './zen-audio.js';
import { createTweenManager } from './tween-manager.js';
import { createFadeOverlay } from './fade-overlay.js';
// 兼容旧引用名：保持 LIGHT_CFG 的别名，避免到处改动
const LIGHT_CFG = APP_CFG;

// 常量参数
const RADIUS = 1;
const MARGIN = 1.02;
const OFFSET_Y = -0.55;
const DEBUG = { lonSameSign: true, invertLon: false, invertLat: false, logFly: true, calibLonDeg: 0, calibLatDeg: 15 };
// 选择诊断：在点击命中时输出候选格子、首个命中、可能的多重命中

// 星光诊断日志总开关（如需静默可改为 false）
const STAR_LOG = false; // 关闭星空调试日志，避免控制台刷屏

// 状态容器
let state = null;

export function boot(page) {
  const sys = wx.getSystemInfoSync();
  wx.createSelectorQuery().select('#gl').fields({ node: true, size: true }).exec(res => {
    const hit = res && res[0];
    if (!hit || !hit.node) { console.error('[FAIL] canvas 节点未取到'); return; }

    const canvas = hit.node;
    // 初始化时使用系统窗口尺寸进行限幅，避免某些安卓设备上 vw/vh 误差导致初始宽高异常
    const width = Math.max(1, Math.min(hit.width, sys.windowWidth || hit.width));
    const height = Math.max(1, Math.min(hit.height, sys.windowHeight || hit.height));
    const dpr = sys.pixelRatio;

    // 创建场景/渲染器/相机/光照/球组
    const { THREE, renderer, scene, camera, dirLight, ambientLight, globeGroup, baseDist } = createScene(canvas, dpr, width, height);
    
    // —— 动画补间与转场遮罩 ——
    const tweener = createTweenManager();
    const fader = createFadeOverlay(THREE, camera, tweener);

    // 默认旋转顺序为 'XYZ'；禅模式将切换为 'ZXY'（先 Z 倾斜、后 Y 旋转）
    try { globeGroup.rotation.order = 'XYZ'; } catch(_){}
    // 3D 诗句层实例（按需创建）
    let poetry3d = null;

    // 统一缩放因子：通过调节相机与原点的距离来实现缩放
    let zoom = 1.0; // 1=默认视距，>1 更近（放大），<1 更远（缩小）
    const minZoom = (APP_CFG?.camera?.minZoom ?? 0.6);
    const maxZoom = (APP_CFG?.camera?.maxZoom ?? 2.86);
    const clampZoom = (z) => Math.max(minZoom, Math.min(maxZoom, z));
    updateCamDist(camera, baseDist, zoom);

    // 禅定模式状态：倾斜角、进入/退出动画、交互约束
    let zenActive = false;            // 当前是否处于禅定模式
    let tiltZ = 0;                    // 地球绕 Z 轴的倾斜角（弧度）
    let __zenAnim = null;             // { t0, dur, from:{rotX,zoom,tiltZ}, to:{rotX,zoom,tiltZ} }
    let __zenBrake = null;            // 进入禅定前的“平滑刹车”阶段：{ t0, dur }
    let __zenDelayEnter = false;      // 刹车结束后自动进入禅定
    // 禅定倾角与缩放来源统一到配置（提供默认值，避免魔法数散落）
    const ZEN_TILT_RAD = ((APP_CFG?.zen?.tiltDeg ?? 23) * Math.PI / 180);
    zenState.zoom = zoom; zenState.active = zenActive; zenState.tiltZ = tiltZ; zenState.anim = __zenAnim; zenState.brake = __zenBrake; zenState.delayEnter = __zenDelayEnter;
    const ZEN_ZOOM = (APP_CFG?.zen?.zoom ?? 0.74);
    let __restore = { rotX: 0, rotY: 0, zoom: 1.0 }; // 退出禅定时恢复的视角
    // 应用集中配置的普通模式强度；可选采用“禅定灯光”作为普通模式灯光（仅强度，不引入禅材质）
    const __useZenLights = !!(APP_CFG?.normal?.useZenLighting);
    const __clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const __normalAmbient = __useZenLights
      ? (__clamp(LIGHT_CFG?.zen?.ambientIntensity ?? LIGHT_CFG.normal.ambientIntensity, 0.0, 1.0))
      : (__clamp(LIGHT_CFG.normal.ambientIntensity, 0.0, 1.0));
    const __normalDir = __useZenLights
      ? (__clamp(LIGHT_CFG?.zen?.dirLightIntensityRight ?? LIGHT_CFG.normal.dirLightIntensity, 0.2, 2.4))
      : (__clamp(LIGHT_CFG.normal.dirLightIntensity, 0.2, 2.4));
    let __brightnessScale = Number(APP_CFG?.brightness?.default ?? 0.85);
    try { lighting.applyNormalIntensity(__normalAmbient * __brightnessScale, __normalDir * __brightnessScale); } catch(_){}
    try { console.info('[lights] normal profile', { useZenLights: __useZenLights, ambient: __normalAmbient, dir: __normalDir }); } catch(_){}
  const ambientBase = __normalAmbient; // 退出禅模式时恢复到此值（可为禅灯光）
  const dirLightBase = __normalDir;    // 退出禅模式时恢复到此值（可为禅灯光）
  // —— Bloom 管线（UnrealBloomPass 优先，回退到内置 ApproxPass） ——
  let composer = null;
  let __bloomPass = null; // UnrealBloomPass 或回退

    // 禅定稳定时间戳与上一帧时间（用于自动旋转）
    let zenStableSince = 0;
    zenState.stableSince = zenStableSince;
    let __prevRenderTime = 0;
    // 星空：目标透明度与实例对象（渲染循环中平滑逼近）
    let __starTargetOpacity = 0.0;
    let __perfDrag = false; // 新增：性能模式标记（拖动中）
    let starCtl = null;
    let __starLogNext = 0;
  let __starLogNextMiss = 0;
  let __starUniformWarned = false;
    let __fpsWindow = [];
    let __fpsLogNext = 0;
    let __shaderSyncNext = 0;

    // 调试工具：统一输出渲染器与贴图、着色器参数，便于对齐 PC 端
    const _tmName = (THREE, v) => {
      try {
        const names = ['NoToneMapping','LinearToneMapping','ReinhardToneMapping','CineonToneMapping','ACESFilmicToneMapping'];
        for (const n of names) { if (THREE?.[n] === v) return n; }
      } catch(_){}
      return String(v);
    };
    const dumpRendererInfo = () => {
      try {
        const colorSpace = (renderer.outputColorSpace ?? renderer.outputEncoding);
        const tone = renderer.toneMapping;
        const exposure = (renderer.toneMappingExposure ?? 1.0);
        console.info('[PIPELINE]', {
          pixelRatio: (typeof renderer.getPixelRatio === 'function' ? renderer.getPixelRatio() : undefined),
          size: (typeof renderer.getSize === 'function' ? renderer.getSize(new THREE.Vector2()).toArray() : undefined),
          outputColorSpace: (colorSpace && colorSpace.name) ? colorSpace.name : colorSpace,
          toneMapping: _tmName(THREE, tone),
          toneMappingExposure: Number(exposure).toFixed(3),
        });
      } catch(_){}
    };
    const dumpTextureInfo = (name, tex) => {
      try {
        if (!tex) { console.info('[TEX]', name, 'not loaded'); return; }
        const cs = (tex.colorSpace ?? tex.encoding);
        console.info('[TEX]', name, {
          colorSpace: (cs && cs.name) ? cs.name : cs,
          min: tex.minFilter, mag: tex.magFilter, aniso: tex.anisotropy,
          flipY: tex.flipY,
        });
      } catch(_){}
    };

    // 已移除：PC 端鼠标滚轮缩放绑定（不再支持）
    // 启动后立即输出一次渲染管线配置（色彩空间 / tone mapping / 曝光）
    dumpRendererInfo();

    // 触控状态：在 boot 作用域中维护，供渲染与事件逻辑使用
    const touch = {
      isPC: ['windows','mac','devtools'].includes(sys.platform),
      rotX: 0,
      rotY: 0,
      // 惯性旋转（借鉴桌面版 OrbitControls 思路）
      velX: 0,
      velY: 0,
      damping: 0.92, // 阻尼系数（0.85~0.95 区间可调）
      maxSpeed: 0.06, // 单帧最大角速度，避免过快
      inertiaGain: 0, // 惯性增益（0-1.5），高惯性时提高速度敏感度
      // 诊断辅助：记录松手瞬间速度与时间，用于计算衰减“年龄”
      releaseVelX: 0,
      releaseVelY: 0,
      releaseAt: 0,
      __lastDragLogAt: 0,
      isDragging: false,
      lastX: 0,
      lastY: 0,
      downX: 0,
      downY: 0,
      downTime: 0,
      pinch: false,
      pinchStartDist: 0,
      pinchStartZoom: zoom,
    };

    // 初始视觉中心：根据配置将视角设置到北京（或指定城市）
    // 公式与 flyTo 的目标角度计算一致，避免符号与校准偏差。
    try {
      const init = APP_CFG?.camera?.initialCenterDeg;
      if (init && typeof init.lat === 'number' && typeof init.lon === 'number') {
        const rad = Math.PI / 180;
        const latRad = (init.lat || 0) * rad;
        const lonRad = (init.lon || 0) * rad;
        const tLat = DEBUG.invertLat ? -latRad : latRad;
        const tLon = DEBUG.invertLon ? -lonRad : lonRad;
        // 保持赤道水平：不引入 X 轴旋转（rotX=0），仅按经度对齐北京
        const lonRotTarget = (-(tLon) - Math.PI/2) - ((DEBUG.calibLonDeg||0) * rad);
        touch.rotX = 0; touch.rotY = lonRotTarget;
        // 退出禅定或恢复时使用相同初始视角
        __restore.rotX = 0; __restore.rotY = lonRotTarget;
      }
    } catch(_){ }

    // 创建星空背景：置于场景后方，初始隐藏（禅定模式淡入）
    if (STAR_LOG) { try { console.log('[star] create: begin'); } catch(_){} }
    if (STAR_LOG) { try { console.info('[star] factory type:', typeof createStarfield); } catch(_){} }
    try {
      starCtl = createStarfieldController(THREE, scene);
      if (starCtl && starCtl.mesh) {
        try {
          const cnt = starCtl.mesh.geometry?.attributes?.position?.count ?? 0;
          const uniforms = starCtl.mesh.material?.uniforms || {};
          if (STAR_LOG) { try { console.log('[star] created:', { count: cnt, hasTime: !!uniforms.time, hasOpacity: !!uniforms.uOpacity }); } catch(_){} }
          const ncfg = LIGHT_CFG?.normal || {};
          if (uniforms.uSizeScale && typeof ncfg.starSizeScale === 'number') uniforms.uSizeScale.value = ncfg.starSizeScale;
          if (uniforms.uBrightnessGain && typeof ncfg.starBrightnessGain === 'number') uniforms.uBrightnessGain.value = ncfg.starBrightnessGain;
          if (uniforms.uBreathSpeed && typeof ncfg.starBreathSpeed === 'number') uniforms.uBreathSpeed.value = ncfg.starBreathSpeed;
          if (uniforms.uBreathStrength && typeof ncfg.starBreathStrength === 'number') uniforms.uBreathStrength.value = ncfg.starBreathStrength;
          if (STAR_LOG) { try { console.info('[star] uniforms:init', { sizeScale: uniforms.uSizeScale?.value, gain: uniforms.uBrightnessGain?.value }); } catch(_){} }
        } catch(_){ }
      } else {
        if (STAR_LOG) { try { console.info('[star] factory return:', starCtl); } catch(_){} }
      }
    } catch(e){ try { if (STAR_LOG) console.error('[star] create: error', e?.message || e); } catch(_){} }

    // 初始目标透明度：使用普通模式配置（便于在非禅模式下也看到极弱星空）
          try { __starTargetOpacity = (LIGHT_CFG?.normal?.starOpacity ?? 0.0); starCtl?.setTargetOpacity?.(__starTargetOpacity); if (STAR_LOG) console.log('[star] init target from config:', __starTargetOpacity); } catch(_){}
    // 启动后：开启 12 秒的星呼吸诊断窗口
    try { __breathDiagUntil = Date.now() + 12000; } catch(_){}

    // 控制台缩放方法（便于在 PC/DevTools 验证）
    const setZoom = (z) => {
      if (typeof z !== 'number' || !isFinite(z)) return;
      const newZoom = clampZoom(z);
      if (newZoom !== zoom) {
        zoom = newZoom; updateCamDist(camera, baseDist, zoom);
        try { if (INTERACTION_DEBUG_LOG) console.log('[setZoom]', 'z=', Number(newZoom).toFixed(3)); } catch(_){}
      }
    };
    if (typeof wx !== 'undefined') wx.__earthSetZoom = setZoom;

    // 诊断工具：直接在当前视角上“推”中心，经纬各偏移若干度，排查是否被其他逻辑覆盖
    const nudgeCenter = (dLatDeg = 0, dLonDeg = 0) => {
      try {
        const rad = Math.PI / 180;
        const nx = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, touch.rotX + dLatDeg * rad));
        const ny = touch.rotY + dLonDeg * rad;
        touch.rotX = nx; touch.rotY = ny; // 直接赋值，绕过飞行动画
        touch.velX = 0; touch.velY = 0; try { flyMgr?.cancel?.(); } catch(_){ }
        const v = new THREE.Vector3(0, 0, RADIUS);
        v.applyEuler(new THREE.Euler(nx, ny, 0, 'XYZ'));
        const [clon, clat] = convertVec3ToLatLon(v.x, v.y, v.z);
        try { console.log('[nudgeCenter]', 'dLatDeg=', dLatDeg, 'dLonDeg=', dLonDeg, 'center lon=', clon.toFixed(4), 'lat=', clat.toFixed(4)); } catch(_){}
      } catch(_){ }
    };
    if (typeof wx !== 'undefined') wx.nudgeCenter = (cfg) => {
      try { const dLat = Number(cfg?.lat || 0), dLon = Number(cfg?.lon || 0); nudgeCenter(dLat, dLon); } catch(_){}
    };

    // 资源与数据
    const raycaster = new THREE.Raycaster();
    let earthMesh = null;
    let cloudMesh = null;
    let earthDayTex = null;
    let earthPureDayTex = null; // 纯白昼贴图
    let earthNightTex = null;
    let __earthOldMat = null;
    const themeState = createThemeState();
    let COUNTRY_FEATURES = null;
    let BORDER_GROUP = null;
    let COLLIDER_GROUP = null;
    let __startupClearSelection = (APP_CFG?.startup?.clearDefaultSelection ?? true);
    
    let TROPIC_GROUP = null;
    let __earthReady = false;
  // 移除：国际日期线（按需可在未来重新引入单独模块）
    let search = null; // { grid, cellSize, lonBuckets, latBuckets }

    

    

    const getCountryOverride = (f) => getCountryOverrideExtern(f);

    const tzMgr = createTimezoneManager({
      THREE,
      RADIUS,
      page,
      getCountryOverride: (f) => getCountryOverride(f),
      searchRef: () => search,
      countriesRef: () => COUNTRY_FEATURES,
      tzlookup: (lat, lon) => page.tzlookup?.(lat, lon),
      computeGmtOffsetStr: (tzName) => page.computeGmtOffsetStr?.(tzName),
      formatTime: (date, tzName) => page.formatTime?.(date, tzName),
      touchRef: () => touch,
    });
    const highlight = createHighlightManager({ THREE, globeGroup, camera, APP_CFG, highlightLayer, RADIUS, onAutoCleared: () => { try { page?.onCountryPicked?.(null); } catch(_){} } });
    const lighting = createLightingManager({ THREE, globeGroup, camera, dirLight, ambientLight, LIGHT_CFG, tweener });
    const collider = createColliderManager({ THREE, globeGroup });
    const flyMgr = createFlyManager({ THREE, globeGroup, camera, RADIUS, touch, DEBUG });

    // 纹理与数据加载
    const loader = new THREE.TextureLoader();
    // --- 平台探测与兼容性设置 ---
    // 复用 boot 开头的 sys (wx.getSystemInfoSync)
    const sysInfo = sys || {};
    const sysPlatform = (sysInfo.platform || '').toLowerCase();
    const __isIOS = sysPlatform === 'ios';
    // 针对 HarmonyOS 及特定华为机型 (如 Mate X3) 的兼容性判定
    // Mate X3 可能在 system 字段不返回 Harmony，需补充 model 检测
    const __isHarmony = /Harmony/i.test(sysInfo.system || '') || /Mate\s*X3/i.test(sysInfo.model || '');
    
    // 判定是否为开发工具：检查 environment, brand, 或 platform 为 devtools
    const __isDevtools = String(sysInfo.environment || '').toLowerCase() === 'devtools' || 
                         String(sysInfo.brand || '').toLowerCase() === 'devtools' || 
                         sysPlatform === 'devtools';
                         
    // 判定是否为 PC 客户端 (Windows/Mac) 且非 DevTools
    // PC 客户端的 WebGL 纹理坐标系常与移动端相反，导致贴图倒置
    const __isPCClient = (sysPlatform === 'windows' || sysPlatform === 'mac') && !__isDevtools;
    
    // 修复贴图倒置：PC 客户端需要特殊处理
    // 注意：flipY 属性在 PC 客户端可能被忽略，因此我们使用 repeat/offset 和 shader uniform 双重保险
    const TEX_FLIP_Y = true; // 保持默认 true，PC 端通过 repeat.y = -1 修正

    // 辅助函数：针对 PC 客户端修正纹理
    const fixTexture = (tex) => {
      if (__isPCClient && tex) {
        try {
          // 方案变更：用户反馈 repeat/offset 依然反向。
          // 尝试直接关闭 flipY。通常 WebGL 纹理默认 flipY=true，如果 PC 端反了，可能是因为不需要 flipY。
          tex.flipY = false;
          
          // 暂时移除 repeat/offset 修正，避免冲突
          // tex.wrapS = THREE.RepeatWrapping;
          // tex.wrapT = THREE.RepeatWrapping;
          // tex.repeat.set(1, -1);
          // tex.offset.set(0, 1);
          
          tex.needsUpdate = true;
          console.warn('[texture] PC Fix: set flipY=false');
        } catch(e) { console.warn('[texture] fixTexture failed', e); }
      }
    };
    
    try {
      if (__isPCClient) console.log('[main] PC Client detected, applying texture fix (repeat/offset)');
      // 复用判定结果
      const isDevtools = __isDevtools;
      const forceCloud = !!getApp()?.globalData?.forceCloudTextures;
      if (!isDevtools || forceCloud) {
        prefetchTextureUrls();
        ensureOfflineTextures();
      } else {
        try { console.warn('[tex] skip cloud prefetch/ensure in devtools'); } catch(_){}
      }
    } catch(_){ }

    // 调试：在控制台标注贴图来源
    const logSrc = (name, url, fallback, phase = 'load') => {
      try {
        const src = (url === fallback) ? 'local_fallback' : 'cloud_temp';
        const m = String(url || '').match(/\.([a-z0-9]+)(?:\?|$)/i);
        const ext = m ? ('.' + m[1].toLowerCase()) : '';
        console.info(`[texture] ${name} 来源(${phase}):`, src, url, ext);
      } catch(_){ }
    };
    
    // 串行加载纹理，避免iOS并发压力导致失败
    const loadTexturesSequentially = async () => {
      try {
        // 1. 优先加载默认白昼（最关键）
        const dayRes = await getTextureUrl('earth');
        await new Promise((resolve) => {
          logSrc('earth', dayRes.url, dayRes.fallback, 'start');
          loader.load(dayRes.url, (tex) => {
            if (!state) return; // 页面已销毁，中止
            tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 1;
            try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} }
            try { tex.flipY = TEX_FLIP_Y; tex.needsUpdate = true; } catch(_){}
            fixTexture(tex); // 针对 PC 端修正
            earthDayTex = tex;
            dumpTextureInfo('earth', earthDayTex);
            
            // 立即初始化地球网格（初始不可见，避免空心地球闪现）
            if (!earthMesh) {
              const mat = new THREE.MeshPhongMaterial({ 
                map: earthDayTex, 
                shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8),
                transparent: true, // 开启透明以支持淡入
                opacity: 0,        // 初始透明度为 0
              });
              earthMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 48), mat);
              earthMesh.name = 'EARTH'; 
              earthMesh.visible = false; // 初始完全隐藏
              globeGroup.add(earthMesh);
            } else if (currentTheme === 'default') {
              earthMesh.material.map = earthDayTex;
              earthMesh.material.needsUpdate = true;
            }

            try {
              applyThemeWithState({
                THREE,
                earthMesh,
                earthDayTex,
                earthPureDayTex,
                earthNightTex,
                APP_CFG,
                zenActive,
                kind: currentTheme,
                themeState,
                // flipY: __isPCClient // 已在纹理层面修正，Shader 不需再翻转
              });
            } catch(_){ }
            try { if (!TROPIC_GROUP) { TROPIC_GROUP = makeEquatorAndTropics(THREE, globeGroup); TROPIC_GROUP.visible = false; } } catch(_){}
            
            // 贴图就绪，开始淡入地球并隐藏 Loading 提示
            if (earthMesh) {
                earthMesh.visible = true;
                // 使用 tweener 淡入 opacity 0 -> 1
                tweener.to(earthMesh.material, { opacity: 1 }, 1200, t => t * (2 - t), null, () => {
                    __earthReady = true;
                    setTimeout(() => {
                      try { if (TROPIC_GROUP) TROPIC_GROUP.visible = true; } catch(_){}
                      try { if (BORDER_GROUP) BORDER_GROUP.visible = true; } catch(_){}
                    }, 1000);
                });
                // 通知页面隐藏 loading
                try { page.setData({ loading: false }); } catch(_){}
            }

            resolve();
          }, undefined, () => {
            // 失败时的兜底逻辑：创建一个灰色球体
            if (!earthMesh) {
              earthMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 48), new THREE.MeshPhongMaterial({ color: 0x888888, shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8) }));
              earthMesh.name = 'EARTH'; globeGroup.add(earthMesh);
            }
            try { if (!TROPIC_GROUP) { TROPIC_GROUP = makeEquatorAndTropics(THREE, globeGroup); TROPIC_GROUP.visible = false; } } catch(_){}
            resolve();
          });
        });

        // 2. 加载夜景
        const nightRes = await getTextureUrl('earth_night');
        await new Promise((resolve) => {
          logSrc('earth_night', nightRes.url, nightRes.fallback, 'start');
          loader.load(nightRes.url, (tex) => {
            tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} }
            try { tex.flipY = TEX_FLIP_Y; tex.needsUpdate = true; } catch(_){}
            fixTexture(tex); // 针对 PC 端修正
            earthNightTex = tex;
            dumpTextureInfo('earth_night', earthNightTex);
            applyThemeWithState({ THREE, earthMesh, earthDayTex, earthPureDayTex, earthNightTex, APP_CFG, zenActive, kind: currentTheme, themeState });
            resolve();
          }, undefined, () => resolve());
        });

        // 3. 延迟加载纯白昼和云层（非关键路径）
        setTimeout(async () => {
          // 纯白昼
          try {
            const pureDayRes = await getTextureUrl('earth_day');
            // iOS 强校验：如果拿到了路径但文件可能损坏，增加一次重试逻辑
            const loadPureDay = (url, retry = 0) => {
               loader.load(url, (tex) => {
                  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 1;
                  try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} }
                  try { tex.flipY = TEX_FLIP_Y; tex.needsUpdate = true; } catch(_){}
                  fixTexture(tex); // 针对 PC 端修正
                  earthPureDayTex = tex;
                  dumpTextureInfo('earth_day (纯白昼)', earthPureDayTex);
                  try { console.log('[texture] earth_day 加载成功！', { uuid: tex.uuid, width: tex.image?.width, retry }); } catch(_){}
                  // 加载成功后，立即刷新一次主题，确保如果当前是 Day8k 模式能立即生效
                  try {
                    applyThemeWithState({ THREE, earthMesh, earthDayTex, earthPureDayTex, earthNightTex, APP_CFG, zenActive, kind: currentTheme, themeState });
                  } catch(_){}
               }, undefined, (err) => {
                  try { console.error('[texture] earth_day 加载失败', err, 'retry=', retry); } catch(_){}
                  // 如果是 iOS 且还有重试机会，尝试清除缓存并重新获取
                  // 增加重试次数到 3 次，并更激进地清理缓存
                  if (__isIOS && retry < 3) {
                      try { 
                          console.warn('[texture] iOS retry: clearing ALL caches for earth_day, retry=', retry);
                          // 彻底清除内存缓存和本地文件
                          clearTextureCache(); 
                          clearTextureSaved(['earth_day']);
                          
                          // 稍作延迟后重试
                          setTimeout(() => {
                              // 关键修改：重试时强制走网络 (preferNetwork=true)，绕过可能损坏的本地文件系统缓存
                              getTextureUrl('earth_day', true).then(res2 => {
                                  console.warn('[texture] retrying with NETWORK url:', res2.url);
                                  loadPureDay(res2.url, retry + 1);
                              });
                          }, 300 + retry * 200); // 递增延迟
                      } catch(e){ console.error('[texture] retry failed', e); }
                  } else if (__isIOS) {
                      // 最终失败提示
                      wx.showToast({ title: '白昼图加载失败', icon: 'none', duration: 2000 });
                  }
               });
            };
            loadPureDay(pureDayRes.url);
          } catch(e){ console.error(e); }

          // 云层
          try {
            const cloudRes = await getTextureUrl('cloud');
            if (cloudRes && cloudRes.url) {
              logSrc('cloud', cloudRes.url, cloudRes.fallback, 'start');
              loader.load(cloudRes.url, (tex) => {
                tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} }
                try { tex.flipY = false; tex.needsUpdate = true; } catch(_){}
                fixTexture(tex); // 针对 PC 端修正 (云层通常不需要 flipY=true，但 PC 端如果整体反了，云层可能也反了)
                
                if (!cloudMesh) {
                    cloudMat = new THREE.MeshPhongMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false, depthTest: true });
                    cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS + 0.012, 64, 64), cloudMat);
                    cloudMesh.name = 'CLOUD';
                    try { cloudMesh.visible = !!(page && page.data && page.data.showCloud); } catch(_){ cloudMesh.visible = false; }
                    globeGroup.add(cloudMesh);
                } else {
                    cloudMesh.material.map = tex;
                    cloudMesh.material.needsUpdate = true;
                }
                dumpTextureInfo('cloud', tex);
              });
            }
          } catch(e){}
        }, 500); // 500ms 延迟

      } catch(e) {
        console.error('[texture] 序列加载失败', e);
      }
    };
    loadTexturesSequentially();

    // 加载国家数据
    loadCountries().then((features) => {
      COUNTRY_FEATURES = features;
      BORDER_GROUP = makeBorder(THREE, globeGroup, COUNTRY_FEATURES);
      try { if (BORDER_GROUP) BORDER_GROUP.visible = false; } catch(_){}
      if (__earthReady) {
        setTimeout(() => { try { if (BORDER_GROUP) BORDER_GROUP.visible = true; } catch(_){} }, 1000);
      }
      // 构建不可见的国家碰撞网格，稳定点击命中
      try { collider.build(COUNTRY_FEATURES); COLLIDER_GROUP = collider.getGroup(); } catch(_){ COLLIDER_GROUP = null; }
      search = buildIndex(features);
      // 通知页面国家数据已加载，便于构建标签基础数据
      try { page?.onCountriesLoaded?.(features); } catch (e) { /* noop */ }
    });

    // 触控事件
    const input = createInputManager({
      THREE,
      touch,
      zoomRef: () => zoom,
      setZoom: (z) => { zoom = z },
      clampZoom,
      updateCamDist,
      camera,
      baseDist,
      zenActiveRef: () => zenActive,
      raycaster,
      width,
      height,
      globeGroup,
      earthMeshRef: () => earthMesh,
      colliderGroupRef: () => COLLIDER_GROUP,
      RADIUS,
      countryFeaturesRef: () => COUNTRY_FEATURES,
      searchRef: () => search,
      highlight,
      page,
      tzMgr,
      debugLog: INTERACTION_DEBUG_LOG,
      debugDetail: INERTIA_LOG_DETAIL,
      logThrottleMs: INERTIA_LOG_THROTTLE_MS,
      debugSelect: DEBUG_SELECT,
      lonSameSign: DEBUG.lonSameSign,
    });
    const onTouchStart = e => { input.onTouchStart(e); };

    const onTouchMove = e => { input.onTouchMove(e); };

    const onTouchEnd = () => { input.onTouchEnd(); };

    // 渲染循环（可暂停）
    const loop = createRenderLoop(() => canvas);
    // 飞行动画状态：在指定时长内将 rotX/rotY 平滑过渡到目标
    
    // 星呼吸诊断窗口：进入/切换模式后 15 秒内每 1.5 秒采样一次
    let __breathDiagUntil = 0;
    let __breathLogNext = 0;
      const render = () => {
        
        const now = Date.now();
        tweener.update(now);
        try {
          if (__startupClearSelection) {
            __startupClearSelection = false;
            highlight.setHighlight(null);
            page.selectedTimezone = null;
            page.setData({ hoverText: '' });
            page.lastTimeUpdate = 0;
            try { page?.onCountryPicked?.(null); } catch(_){}
          }
        } catch(_){}
        const dtSec = __prevRenderTime ? Math.max(0, Math.min(0.12, (now - __prevRenderTime) / 1000)) : 0;
        if (__prevRenderTime) {
          const fps = dtSec > 0 ? (1 / dtSec) : 0;
          const dtMs = now - __prevRenderTime;
          __fpsWindow.push({ fps, dtMs });
          if (__fpsWindow.length > 240) __fpsWindow.shift();
        }
        // 暴露飞行状态给标签系统（用于控制脉冲动画的启动时机）
        try { if (state) state.isFlying = !!flyMgr?.isFlying?.(); } catch(_){}

        // 星空背景：更新时间与淡入淡出（柔和不抢眼）
        try {
          if (starCtl && starCtl.mesh && starCtl.mesh.material) {
            const mat = starCtl.mesh.material;
            if ((!mat.uniforms || !mat.uniforms.uOpacity) && !__starUniformWarned && STAR_LOG) {
              __starUniformWarned = true;
          if (STAR_LOG) { try { console.warn('[star] warn: uOpacity uniform missing on material'); } catch(_){} }
            }
            const target = __starTargetOpacity;
            const resStar = starCtl.tick(now, dtSec);
            if (now >= __starLogNext) { __starLogNext = now + 1000; if (STAR_LOG) { try { console.log('[star] tick:', { target: Number(target.toFixed?.(3) || target), cur: Number(resStar.opacity?.toFixed?.(3) || resStar.opacity || 0), visible: !!resStar.visible }); } catch(_){} } }
            // 诊断：在窗口期内采样“呼吸乘子”，确认是否随时间波动
            if (now <= __breathDiagUntil && now >= __breathLogNext) {
              __breathLogNext = now + 1500;
              try {
                const speed = mat.uniforms?.uBreathSpeed?.value ?? 0;
                const strength = mat.uniforms?.uBreathStrength?.value ?? 0;
                const t = mat.uniforms?.time?.value ?? 0;
                const breathMul = 1.0 + strength * Math.sin(t * speed);
                console.info('[star breath]', {
                  speed: Number(speed).toFixed(3), strength: Number(strength).toFixed(3),
                  time: Number(t).toFixed(3), mul: Number(breathMul).toFixed(3), opacity: Number(mat.uniforms?.uOpacity?.value ?? 0).toFixed(3),
                  visible: !!starCtl.mesh.visible,
                });
              } catch(_){}
            }
          } else {
            if (STAR_LOG && now >= __starLogNextMiss) {
              __starLogNextMiss = now + 2000;
              if (STAR_LOG) { try { console.warn('[star] not ready:', { hasObj: !!starCtl?.mesh, hasMat: !!(starCtl && starCtl.mesh && starCtl.mesh.material) }); } catch(_){} }
            }
          }
        } catch(_){}

      // 每帧计算当前应显示的时区：优先选中国家；否则使用屏幕中央经线时区（带稳定门槛）
      let activeTZ = page.selectedTimezone ?? null;
      if (!activeTZ && earthMesh) {
        try {
          const computed = tzMgr.computeCenterTZ(touch.rotX, touch.rotY);
          activeTZ = computed ?? page.currentTZ ?? null;
        } catch (e) { console.warn('[center tz] compute failed:', e); }
      }

      try { tzMgr.updatePerFrame(now); } catch(_){}

    lighting.updateDirLight(zenActive);
      // —— 惯性旋转：在非拖拽时，继续以衰减速度旋转
      if (!touch.isDragging && !touch.pinch) {
        const rot = advanceRotationFrame({ touch, dtSec, now, LIGHT_CFG, zenActive, globeGroup, camera, baseDist, clampZoom, updateCamDist, flyMgr, INTERACTION_DEBUG_LOG, render, setZenMode, tiltZ, zoom, __zenAnim, __zenBrake, zenStableSince, __zenDelayEnter });
        tiltZ = rot.tiltZ; zoom = rot.zoom; __zenAnim = rot.__zenAnim; __zenBrake = rot.__zenBrake; zenStableSince = rot.zenStableSince; __zenDelayEnter = rot.__zenDelayEnter; zenState.tiltZ = tiltZ; zenState.zoom = zoom; zenState.anim = __zenAnim; zenState.brake = __zenBrake; zenState.stableSince = zenStableSince; zenState.delayEnter = __zenDelayEnter;
      }
      globeGroup.rotation.set(touch.rotX, touch.rotY, tiltZ);
      // 云层独立慢速旋转（可选）：不依赖整体自动旋转
      try {
        const spinDegSec = Number(APP_CFG?.cloud?.spinDegPerSec ?? 0);
        if (cloudMesh && cloudMesh.visible && spinDegSec !== 0) {
          cloudMesh.rotation.y += (spinDegSec * Math.PI / 180) * dtSec;
        }
      } catch(_){ }
      try { flyMgr.updateFx(now); } catch(_){ }
      try { if (now >= __shaderSyncNext) { lighting.syncDayNightShader(themeState.get()?.dayNightMat); __shaderSyncNext = now + 33; } } catch(_){}
      try { poetry3d?.update?.(now); } catch(_){}
      try { highlight.updatePerFrame(now); } catch(_){ }
      
      // —— 应用 Bloom ——
      try {
        const res = renderWithBloom({
          THREE,
          renderer,
          scene,
          camera,
          width,
          height,
          composer,
          bloomPass: __bloomPass,
          zenActive,
          APP_CFG
        });
        composer = res.composer;
        __bloomPass = res.bloomPass;
      } catch(_){ }
      try { page?.onRenderTick?.() } catch (e) {}
      if (PERF_DIAG_LOG && now >= __fpsLogNext) {
        __fpsLogNext = now + 3000;
        const arr = __fpsWindow.slice();
        if (arr.length >= 10) {
          const fpsVals = arr.map(x => x.fps).filter(x => isFinite(x) && x > 0).sort((a,b)=>a-b);
          const dtVals = arr.map(x => x.dtMs).filter(x => isFinite(x) && x > 0).sort((a,b)=>a-b);
          const avg = fpsVals.reduce((s,v)=>s+v,0)/fpsVals.length;
          const p95 = fpsVals[Math.min(fpsVals.length-1, Math.floor(fpsVals.length*0.95))];
          const min = fpsVals[0];
          const max = fpsVals[fpsVals.length-1];
          const slow33 = arr.filter(x => x.dtMs > 33).length;
          const slow50 = arr.filter(x => x.dtMs > 50).length;
          try { console.info('[perf] fps', { avg: Number(avg.toFixed(1)), p95: Number(p95.toFixed(1)), min: Number(min.toFixed(1)), max: Number(max.toFixed(1)), frames: arr.length, slow33, slow50 }) } catch(_){ }
        }
        __fpsWindow = [];
      }
      __prevRenderTime = now;
    };
    loop.start(render);

    // 主题切换：default（默认白昼）/ day8k（纯白昼）/ night（夜景）
    let currentTheme = 'default';

    // 统一的主题应用辅助函数，自动收集当前闭包内的状态
    const _refreshThemeCommon = () => {
      try {
        applyThemeWithState({
          THREE,
          earthMesh,
          earthDayTex,
          earthPureDayTex,
          earthNightTex,
          APP_CFG,
          zenActive,
          kind: currentTheme,
          themeState
        });
      } catch(e){ console.error('[_refreshThemeCommon]', e); }
    };

    const _applyThemeSync = (kind) => {
      try {
        currentTheme = (kind === 'day8k' || kind === 'night') ? kind : 'default';
        themeState.setTheme(currentTheme);
        
        if (INTERACTION_DEBUG_LOG) {
             try { console.log('[theme:set]', { kind: currentTheme, zenActive, hasDay: !!earthDayTex }); } catch(_){}
        }
        
        _refreshThemeCommon();
        
        if (INTERACTION_DEBUG_LOG) {
             try { console.log('[theme:applied]', { kind: currentTheme }); } catch(_){}
        }
      } catch(err){ console.error('[theme:set] 异常', err); }
    };

    const setTheme = (kind = 'default') => {
        const next = (kind === 'day8k' || kind === 'night') ? kind : 'default';
        if (next === currentTheme) return;
        
        const tr = (APP_CFG?.ui?.transitions) || {};
        const outMs = Number(tr.themeFadeOutMs || 500);
        const inMs = Number(tr.themeFadeInMs || 600);
        fadeEarthOpacity(0.0, outMs, () => {
            _applyThemeSync(next);
            fadeEarthOpacity(1.0, inMs);
        });
    };
    // 兼容旧接口：保留 setNightMode（映射到主题）
    const setNightMode = (on) => { try { setTheme(on ? 'night' : 'default'); } catch(_){} };
    const setCloudVisible = (on) => { try { if (cloudMesh) cloudMesh.visible = !!on; } catch(_){} };
    // 新增：性能模式切换（拖动中/静止）——仅影响星空目标不透明度
    const setPerfMode = (mode) => {
      try {
        const dragging = (mode === 'drag');
        __perfDrag = dragging;
        if (dragging) {
          if (PERF_HIDE_STAR_ON_ON_DRAG) {
            __starTargetOpacity = 0.0;
            try { starCtl?.setTargetOpacity?.(__starTargetOpacity); } catch(_){ }
          }
        } else {
          // 恢复普通模式配置中的星空目标透明度
          try { __starTargetOpacity = (LIGHT_CFG?.normal?.starOpacity ?? 0.0); } catch(_){ __starTargetOpacity = 0.0; }
          try { starCtl?.setTargetOpacity?.(__starTargetOpacity); } catch(_){ }
        }
      } catch(_){ }
    };

      // 禅定模式：进入/退出（动画+交互约束）
      const setZenMode = (on) => {
        const next = !!on;
        if (next === zenActive) return;
        
        const _doTransition = () => {
          if (next) {
            try { highlight.setHighlight(null); } catch(_){}
            try { page?.onCountryPicked?.(null); } catch(_){}
            try { page.selectedTimezone = null; page.setData?.({ hoverText: '' }); page.lastTimeUpdate = 0; } catch(_){}

            __restore = { rotX: touch.rotX, rotY: touch.rotY, zoom, posY: globeGroup?.position?.y || 0 };
            try { flyMgr?.cancel?.(); } catch(_){ }
            
            const offR = (LIGHT_CFG?.zen?.globeYOffsetR ?? -0.35);
            const targetY = (__restore.posY || 0) + (offR * RADIUS);
            
            __zenAnim = { t0: (__prevRenderTime || Date.now()), dur: (APP_CFG?.zen?.animMs ?? 1000), from: { rotX: touch.rotX, zoom, tiltZ, posY: __restore.posY }, to: { rotX: 0, zoom: ZEN_ZOOM, tiltZ: ZEN_TILT_RAD, posY: targetY } };
            zenState.anim = __zenAnim;
            
            try {
              const use3D = !!(APP_CFG?.poetry?.use3D);
              if (use3D && __zenAnim) {
                __zenAnim.after = () => {
                  try {
                    if (!poetry3d && earthMesh) {
                      poetry3d = createPoetry3D(THREE, scene, camera, earthMesh, width, height, APP_CFG?.poetry || {});
                    }
                    poetry3d?.setEnabled?.(true);
                  } catch(_){ }
                };
              }
            } catch(_){ }
            
            try {
              globeGroup.rotation.order = 'ZXY';
              const q = globeGroup.quaternion.clone();
              const e = new THREE.Euler().setFromQuaternion(q, 'ZXY');
              globeGroup.rotation.set(e.x, e.y, e.z);
            } catch(_){}
            
            zenActive = true;
            zenState.active = zenActive;
            
            try { __starTargetOpacity = getZenStarOpacityTarget(LIGHT_CFG?.zen || {}); } catch(_){ __starTargetOpacity = 0.18; }
            try { starCtl?.setTargetOpacity?.(__starTargetOpacity); } catch(_){}
            try { starCtl?.applyZen?.(LIGHT_CFG?.zen || {}); } catch(_){}
            try { __breathDiagUntil = Date.now() + 15000; __breathLogNext = 0; } catch(_){}
            try { lighting.applyZenIntensity(); } catch(_){}
            
            zenStableSince = 0;
            zenState.stableSince = zenStableSince;
            
            try { if (TROPIC_GROUP) TROPIC_GROUP.visible = true; } catch(_){}
            try { applyZenOverlayFactors(BORDER_GROUP, TROPIC_GROUP, LIGHT_CFG.zen?.overlays || {}); } catch(_){}
            
            try {
              if (earthMesh && earthMesh.material) {
                const hasDay = !!earthDayTex;
                const hasNight = !!earthNightTex;
                const hasPureDay = !!earthPureDayTex;
              try { console.log('[zen:material]', { hasDay, hasNight, hasPureDay, currentTheme, isIOS: __isIOS, isHarmony: __isHarmony, model: sysInfo.model }); } catch(_){}
              const useShader = (APP_CFG?.zen?.useShaderMaterial !== false);
                let shaderApplied = false;
                if (useShader && hasDay && hasNight) {
                  try {
                    const dayTexForZen = (currentTheme === 'day8k' && hasPureDay) ? earthPureDayTex : earthDayTex;
                    const res0 = applyZenMaterial({ THREE, earthMesh, earthDayTex: dayTexForZen, earthPureDayTex: earthPureDayTex, earthNightTex, currentTheme, LIGHT_CFG, dirLightBase, camera, ambientLight, dirLight, useSimpleShader: (__isIOS || __isHarmony), workaroundTransparent: __isHarmony });
                    __earthOldMat = res0.earthOldMat;
                    themeState.setMat(res0.dayNightMat);
                    earthMesh.material = res0.dayNightMat;
                    earthMesh.material.needsUpdate = true;
                    shaderApplied = true;
                  } catch(e){ shaderApplied = false; }
                }
                if (!shaderApplied) {
                    const dayTexForTheme = (currentTheme === 'day8k' && hasPureDay) ? earthPureDayTex : earthDayTex;
                    const mapTex = (currentTheme === 'night' && earthNightTex) ? earthNightTex : dayTexForTheme;
                    earthMesh.material = new THREE.MeshPhongMaterial({ map: mapTex, shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8) });
                    earthMesh.material.needsUpdate = true;
                    try { themeState.setMat(null); } catch(_){}
                  }
                }
            } catch(e){ try { console.error('[zen:material] Critical error', e); } catch(_){} }
          } else {
            try { __starTargetOpacity = getNormalStarOpacityTarget(LIGHT_CFG?.normal || {}); } catch(_){}
            try { starCtl?.setTargetOpacity?.(__starTargetOpacity); } catch(_){}
            try { starCtl?.applyNormal?.(LIGHT_CFG?.normal || {}); } catch(_){}
            __zenAnim = {
              t0: Date.now(), dur: 500,
              from: { rotX: touch.rotX, zoom, tiltZ, posY: globeGroup?.position?.y || 0 },
              to:   { rotX: 0,          zoom: 1.0, tiltZ, posY: (__restore?.posY || 0) },
              next: {
                dur: (APP_CFG?.zen?.exitMs ?? 700),
                from: { rotX: 0, zoom: 1.0, tiltZ, posY: (__restore?.posY || 0) },
                to:   { rotX: 0, zoom: 1.0, tiltZ: 0, posY: (__restore?.posY || 0) },
                after: () => {
                  try {
                    globeGroup.rotation.order = 'XYZ';
                    const q = globeGroup.quaternion.clone();
                    const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
                    globeGroup.rotation.set(e.x, e.y, e.z);
                  } catch(_){}
                  try { lighting.applyNormalIntensitySmooth(ambientBase * __brightnessScale, dirLightBase * __brightnessScale, 300); } catch(_){}
                  try { restoreOverlayFactors(BORDER_GROUP, TROPIC_GROUP); } catch(_){ }
                  try {
                    const res2 = restoreZenMaterial({ earthMesh, earthOldMat: __earthOldMat });
                    try { themeState.setMat(res2.dayNightMat); } catch(_){ }
                    __earthOldMat = res2.earthOldMat;
                  } catch(_){}
                  try { _refreshThemeCommon(); } catch(_){}
                }
              }
            };
            zenState.anim = __zenAnim;
            zenActive = false;
            zenState.active = zenActive;
            try { poetry3d?.setEnabled?.(false); poetry3d?.stop?.(); } catch(_){}
            try { if (TROPIC_GROUP) TROPIC_GROUP.visible = true; } catch(_){}
          }
        };

        if (next) {
          const moving = (Math.abs(touch.velX) > 0.0002) || (Math.abs(touch.velY) > 0.0002) || !!touch.isDragging;
          if (moving && !__zenAnim) {
            __restore = { rotX: touch.rotX, rotY: touch.rotY, zoom, posY: globeGroup?.position?.y || 0 };
            try { flyMgr?.cancel?.(); } catch(_){ }
            __zenBrake = { t0: (__prevRenderTime || Date.now()), dur: (APP_CFG?.zen?.preStopMs ?? 1000) };
            __zenDelayEnter = true;
            zenState.brake = __zenBrake; zenState.delayEnter = __zenDelayEnter;
            return;
          }
        }

        const tr2 = (APP_CFG?.ui?.transitions) || {};
        const out2 = Number(tr2.zenFadeOutMs || 600);
        const in2 = Number(tr2.zenFadeInMs || 700);
        fadeEarthOpacity(0.0, out2, () => {
            _doTransition();
            fadeEarthOpacity(1.0, in2);
        });
      };

    // 渲染暂停/恢复控制与窗口尺寸适配
    const setPaused = (on) => { const p = !!on; if (p) loop.stop(); else loop.start(render); };
    // 向外暴露飞行动画：将视角旋转到指定的纬度/经度
    const flyTo = (lat, lon, duration = 800) => {
      try { flyMgr.flyTo(lat, lon, duration); return; } catch(_){ }
      try {
        if (typeof lat !== 'number' || typeof lon !== 'number') return;
        // 可选符号调整（仅用于排查）：某些环境下经度方向可能与旋转相反
        const tLat = DEBUG.invertLat ? -lat : lat;
        const tLon = DEBUG.invertLon ? -lon : lon;
        // 目标旋转角：与渲染中 convertVec3ToLatLon 的逆映射一致
        const deg2rad = (d) => (d||0) * Math.PI / 180;
        const rawTx = tLat;
        const tx = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, tLat - deg2rad(DEBUG.calibLatDeg)));
        // 选择最短路径的经度差（包裹到 [-π, π]）
        const wrap = (a) => {
          let x = a; while (x > Math.PI) x -= Math.PI*2; while (x < -Math.PI) x += Math.PI*2; return x;
        };
        const rawLonRotTarget = (-(tLon) - Math.PI/2);
        const lonRotTarget = (rawLonRotTarget - ((DEBUG.calibLonDeg||0) * Math.PI/180));
        const dy = wrap(lonRotTarget - touch.rotY);
        const ty = touch.rotY + dy;
        __fly = { sx: touch.rotX, sy: touch.rotY, tx, ty, t0: Date.now(), dur: Math.max(200, Math.min(3000, duration)) };
        // ——— 轨迹线特效：从当前中心到目标中心的球面大圆弧
        try {
          // 1) 当前中心经纬（弧度）
          const v0 = new THREE.Vector3(0, 0, RADIUS);
          v0.applyEuler(new THREE.Euler(touch.rotX, touch.rotY, 0, 'XYZ'));
          const [curLon, curLat] = convertVec3ToLatLon(v0.x, v0.y, v0.z);
          // 2) 球面单位向量
          const s0 = convertLatLonToVec3(curLon, curLat, 1);
          const e0 = convertLatLonToVec3(tLon, tLat, 1);
          const s = new THREE.Vector3(s0.x, s0.y, s0.z).normalize();
          const e = new THREE.Vector3(e0.x, e0.y, e0.z).normalize();
          const dot = Math.max(-1, Math.min(1, s.dot(e)));
          const omega = Math.acos(dot);
          const segs = Math.max(48, Math.min(160, Math.round(96 * (1 + Math.abs(omega) / (Math.PI/2)))));
          const pos = new Float32Array((segs + 1) * 3);
          const radius = RADIUS * 1.015; // 略高于表面，避免深度穿插
          for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            // 球面线性插值（SLERP）
            const a = Math.sin((1 - t) * omega) / Math.sin(Math.max(1e-6, omega));
            const b = Math.sin(t * omega) / Math.sin(Math.max(1e-6, omega));
            const p = new THREE.Vector3(
              s.x * a + e.x * b,
              s.y * a + e.y * b,
              s.z * a + e.z * b
            ).multiplyScalar(radius);
            pos[i*3+0] = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z;
          }
          // 使用 TubeGeometry 替代细线，提升可见度
          const pts = [];
          for (let i = 0; i <= segs; i++) {
            const idx = i * 3;
            pts.push(new THREE.Vector3(pos[idx+0], pos[idx+1], pos[idx+2]));
          }
          const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.6);
          const tubularSegments = Math.max(80, Math.min(360, segs * 2));
          const tubeRadius = 0.006;
          const radialSegments = 8;
          const geo = new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, radialSegments, false);
          const mat = new THREE.MeshBasicMaterial({ color: 0x99ddff, transparent: true, opacity: 0.0 });
          mat.depthTest = false; mat.depthWrite = false;
          const mesh = new THREE.Mesh(geo, mat);
          mesh.renderOrder = 998; // 略低于标签，但高于地球
          try { if (__pathFx && __pathFx.mesh) { globeGroup.remove(__pathFx.mesh); __pathFx.mesh.geometry?.dispose?.(); __pathFx.mesh.material?.dispose?.(); } } catch(_){}
          globeGroup.add(mesh);
          __pathFx = { mesh, t0: Date.now(), dur: Math.max(duration + 1000, 2400) };
          try { console.info('[fx:path:tube] segs=', segs, 'omega(rad)=', omega.toFixed(4)); } catch(_){}
        } catch(_){ }
        // 诊断：记录目标与当前参数
        if (INTERACTION_DEBUG_LOG && DEBUG.logFly) {
          try {
            const v = new THREE.Vector3(0, 0, RADIUS);
            v.applyEuler(new THREE.Euler(tx, ty, 0, 'XYZ'));
            const [expLon, expLat] = convertVec3ToLatLon(v.x, v.y, v.z);
            const dTxDeg = (tx - rawTx) * 180 / Math.PI;
            const dTyDeg = (lonRotTarget - rawLonRotTarget) * 180 / Math.PI;
            console.log('[flyTo]', 'in(rad) lat=', lat.toFixed(4), 'lon=', lon.toFixed(4), 'tLat=', tLat.toFixed(4), 'tLon=', tLon.toFixed(4), 'tx=', tx.toFixed(4), 'ty=', ty.toFixed(4), 'calibLonDeg=', DEBUG.calibLonDeg, 'calibLatDeg=', DEBUG.calibLatDeg, 'dTx(deg)=', dTxDeg.toFixed(3), 'dTy(deg)=', dTyDeg.toFixed(3), 'expCenter lon=', expLon.toFixed(4), 'lat=', expLat.toFixed(4), 'from rotX=', __fly.sx.toFixed(4), 'rotY=', __fly.sy.toFixed(4));
          } catch(_){}
          __flyProbeUntil = Date.now() + Math.max(800, Math.min(2000, duration + 400));
          __flyProbeLast = 0;
        }
      } catch(_){ }
    };
    const viewport = createViewportManager({ wx, renderer, camera, state });
    const onWinResize = (evt) => { viewport.update(); };
    try { wx.onWindowResize(onWinResize); } catch(_){ }

    const startPoetry3D = (lines, conf) => {
      try {
        if (!poetry3d && earthMesh) {
          poetry3d = createPoetry3D(THREE, scene, camera, earthMesh, width, height, APP_CFG?.poetry || {});
        }
        poetry3d?.setEnabled?.(true);
        poetry3d?.start?.(lines, conf || (APP_CFG?.poetry || {}));
      } catch(_){}
    };
    const stopPoetry3D = () => { try { poetry3d?.stop?.(); poetry3d?.setEnabled?.(false); } catch(_){} };

    const refreshTextures = async () => {
      try {
        console.info('[assets] 开始刷新贴图和音乐缓存...');
        clearTextureCache();
        clearTextureSaved(['earth','earth_night','earth_day','cloud']);
        
        // 重新加载贴图
        const day = await getTextureUrl('earth');
        const night = await getTextureUrl('earth_night');
        const pureDay = await getTextureUrl('earth_day');
        const cloudRes = await getTextureUrl('cloud');
        
        const updateTheme = () => {
            _refreshThemeCommon();
        };

        loader.load(day.url, (tex) => {  
          if (!state) return;
          try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} } 
          try { tex.flipY = TEX_FLIP_Y; tex.needsUpdate = true; } catch(_){} 
          fixTexture(tex);
          earthDayTex = tex; 
          updateTheme();
          console.info('[assets] earth 贴图已刷新');
        });
        
        loader.load(night.url, (tex) => { 
          if (!state) return;
          try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} } 
          try { tex.flipY = TEX_FLIP_Y; tex.needsUpdate = true; } catch(_){} 
          fixTexture(tex);
          earthNightTex = tex; 
          updateTheme();
          console.info('[assets] earth_night 贴图已刷新');
        });
        
        loader.load(pureDay.url, (tex) => { 
          if (!state) return;
          try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} } 
          try { tex.flipY = TEX_FLIP_Y; tex.needsUpdate = true; } catch(_){} 
          fixTexture(tex);
          earthPureDayTex = tex; 
          updateTheme();
          console.info('[assets] earth_day (纯白昼) 贴图已刷新');
        });
        
        if (cloudMesh && cloudRes && cloudRes.url) {
          loader.load(cloudRes.url, (tex) => {
            if (!state) return;
            try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} }
            try { tex.flipY = false; tex.needsUpdate = true; } catch(_){}
            fixTexture(tex);
            const mat = new THREE.MeshPhongMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0.28 });
            mat.depthWrite = false; mat.depthTest = true;
            cloudMesh.material = mat; cloudMesh.material.needsUpdate = true;
            console.info('[assets] cloud 贴图已刷新');
          });
        }
        
        // 清除音乐缓存
        try { clearZenAudioSaved(); console.info('[assets] 音乐缓存已清除'); } catch(_){}
        
        wx.showToast({ title: '资源已刷新', icon: 'success', duration: 1500 });
      } catch(e){ 
        console.error('[assets] 刷新失败', e);
        wx.showToast({ title: '刷新失败', icon: 'error', duration: 1500 });
      }
    };

    // 设置：惯性滑条映射（0-100）
    const setInertia = (pct) => {
      const v = Math.max(0, Math.min(100, Number(pct) || 0));
      // 修复：用户反馈“无”选项依然有惯性。
      // 修正：当 pct 为 0 时，强制 damping 为 0，使惯性立即停止。
      if (v === 0) {
          touch.damping = 0.0;
          touch.inertiaGain = 0.0;
          try { if (INTERACTION_DEBUG_LOG) console.log('[inertia:set] zero inertia enforced'); } catch(_){}
          return;
      }
      const norm = v / 100; // 0..1
      // 非线性映射：增强中高档位差异（可在 label-constants.js 关闭回滚为线性）
      const useNL = !!INERTIA_NONLINEAR;
      const t = useNL ? Math.pow(norm, Math.max(1.0, Number(INERTIA_POWER) || 2.2)) : norm;
      const minD = Number(INERTIA_DAMP_MIN ?? 0.60);
      const maxD = Number(INERTIA_DAMP_MAX ?? 0.998);
      touch.damping = minD + (maxD - minD) * t;
      const minS = Number(INERTIA_SPEED_MIN ?? 0.05);
      const maxS = Number(INERTIA_SPEED_MAX ?? 0.22);
      touch.maxSpeed = minS + (maxS - minS) * t;
      const baseG = Number(INERTIA_GAIN_BASE ?? 0.30);
      const scaleG = Number(INERTIA_GAIN_SCALE ?? 2.4);
      touch.inertiaGain = baseG + scaleG * t; // 增益更陡，使 70-90 档更有感
      // 诊断日志：观察滑条映射是否生效（含非线性 t）
      try { if (INTERACTION_DEBUG_LOG) console.log('[inertia:set]', { pct: v, norm: Number(norm.toFixed(3)), t: Number(t.toFixed(3)), damping: Number(touch.damping.toFixed(3)), maxSpeed: Number(touch.maxSpeed.toFixed(3)), gain: Number(touch.inertiaGain.toFixed(2)), nonlinear: useNL }); } catch(_){}
    };

      const setBrightnessScale = (s) => {
        try {
          const minV = Number(APP_CFG?.brightness?.min ?? 0.5);
          const maxV = Number(APP_CFG?.brightness?.max ?? 1.4);
          const v = Math.max(minV, Math.min(maxV, Number(s) || APP_CFG?.brightness?.default || 1));
          __brightnessScale = v;
          if (!zenActive) {
            const tr3 = (APP_CFG?.ui?.transitions) || {};
            const lm = Number(tr3.lightSmoothMs || 200);
            lighting.applyNormalIntensitySmooth(ambientBase * __brightnessScale, dirLightBase * __brightnessScale, lm);
          }
        } catch(_){}
      };
      state = { THREE, scene, renderer, globeGroup, camera, dirLight, earthMesh, COUNTRY_FEATURES, search, width, height, handlers: { onTouchStart, onTouchMove, onTouchEnd, setZoom, setNightMode, setTheme, setCloudVisible, setPaused, flyTo, nudgeCenter, setZenMode, startPoetry3D, stopPoetry3D, setInertia, setPerfMode, refreshTextures, setBrightnessScale }, page, onWinResizeCb: onWinResize, __cancelRaf: () => { try { loop.stop(); } catch(_){ } }, __pauseFlagRef: () => { try { return !!loop.isPaused?.(); } catch(_){ return false; } }, __setHighlight: (f) => { try { highlight.setHighlight(f); } catch(_){ } } };
  });
}

export function teardown() {
  if (!state) return;
  // 滚轮逻辑已移除：无需额外清理滚轮监听
  // 取消窗口尺寸监听
  try { if (state.onWinResizeCb) wx.offWindowResize(state.onWinResizeCb); } catch(_){ }
  // 取消 RAF，避免销毁后仍在渲染导致报错或日志刷屏
  try { state.__cancelRaf?.(); } catch(_){ }
  state.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  state.renderer.dispose?.();
  state = null;
}

// 适配层直接调用以下导出以触发交互逻辑
export function onTouchStart(e){ state?.handlers?.onTouchStart?.(e); }
export function onTouchMove(e){ state?.handlers?.onTouchMove?.(e); }
export function onTouchEnd(e){ state?.handlers?.onTouchEnd?.(e); }
export function setZoom(z){ state?.handlers?.setZoom?.(z); }
export function setNightMode(on){ state?.handlers?.setNightMode?.(on); }
export function setTheme(kind){ state?.handlers?.setTheme?.(kind); }
export function setCloudVisible(on){ state?.handlers?.setCloudVisible?.(on); }
export function setInertia(pct){ state?.handlers?.setInertia?.(pct); }
export function setPaused(on){ state?.handlers?.setPaused?.(on); }
export function flyTo(lat, lon, duration){ state?.handlers?.flyTo?.(lat, lon, duration); }
export function setZenMode(on){ state?.handlers?.setZenMode?.(on); }
export function setBrightnessScale(s){ state?.handlers?.setBrightnessScale?.(s); }
export function setPerfMode(mode){ try { state?.handlers?.setPerfMode?.(mode); } catch(_){ } }
export function startPoetry3D(lines, conf){ try { state?.handlers?.startPoetry3D?.(lines, conf); } catch(_){} }
export function stopPoetry3D(){ try { state?.handlers?.stopPoetry3D?.(); } catch(_){} }
export function refreshTextures(){ try { state?.handlers?.refreshTextures?.(); } catch(_){} }
export function setDebugFlags(flags){ try { Object.assign(DEBUG, flags||{}); } catch(_){ } }
// 直接推动中心：页面层可调用（无动画，立即生效）
export function nudgeCenter(latDeg, lonDeg){ try { state?.handlers?.nudgeCenter?.(latDeg, lonDeg); } catch(_){ } }
// 在小程序环境下可由适配层暴露 wx.setGlDebug(flags) 调用

export function getRenderContext() {
  if (!state) return null;
  // 暴露 isFlying 供标签系统决定脉冲动画的启动时机
  return { THREE: state.THREE, scene: state.scene, camera: state.camera, width: state.width, height: state.height, globeGroup: state.globeGroup, isFlying: !!(state && state.isFlying) };
}

// 新增：读取已加载的国家特征，供页面层重建标签时使用
export function getCountries(){
  return state?.COUNTRY_FEATURES || null;
}

// 新增：根据国家代码选中并高亮（供搜索飞行后调用）
export function selectCountryByCode(code){
  try {
    const s = state;
    if (!s || !s.COUNTRY_FEATURES) return false;
    const codeUp = String(code || '').toUpperCase();
    // 特殊处理：TW/TWN 点击等同于 CHN 高亮，但页面命中保留台湾以触发关闭面板/仅台北的逻辑
    if (codeUp === 'TWN' || codeUp === 'TW') {
      const fTW = s.COUNTRY_FEATURES.find(feat => {
        const p = feat?.props || {};
        const a3 = String(p.ISO_A3 || '').toUpperCase();
        const a2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
        return a3 === 'TWN' || a2 === 'TW';
      }) || null;
      const fCN = s.COUNTRY_FEATURES.find(feat => {
        const p = feat?.props || {};
        const a3 = String(p.ISO_A3 || '').toUpperCase();
        const a2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
        return a3 === 'CHN' || a2 === 'CN';
      }) || null;
      // 同时高亮中国与台湾
      const targets = [];
      if (fCN) targets.push(fCN);
      if (fTW) targets.push(fTW);
      s.__setHighlight?.(targets.length ? targets : null);
      try { s.page?.onCountryPicked?.(fTW || null); } catch(_){}
      return !!(fTW || fCN);
    }
    const f = s.COUNTRY_FEATURES.find(feat => {
      const p = feat?.props || {};
      const a3 = String(p.ISO_A3 || '').toUpperCase();
      const a2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
      return codeUp && (a3 === codeUp || a2 === codeUp);
    }) || null;
    s.__setHighlight?.(f || null);
    try { s.page?.onCountryPicked?.(f || null); } catch(_){}
    return !!f;
  } catch(_) { return false; }
}
    const fadeEarthOpacity = (to = 1.0, dur = 600, cb) => {
      try {
        if (!earthMesh || !earthMesh.material) { if (cb) cb(); return; }
        const mat = earthMesh.material;
        const ease = (t) => t * (2 - t);
        if (mat.type === 'ShaderMaterial' && mat.uniforms && mat.uniforms.uOpacity) {
          mat.transparent = true;
          const u = mat.uniforms.uOpacity;
          const from = Number(u.value || 1);
          tweener.to(u, { value: to }, dur, ease, null, () => { if (to >= 0.999) { try { mat.transparent = true; } catch(_){} } if (cb) cb(); });
        } else {
          mat.transparent = true;
          const from = Number(mat.opacity || 1);
          tweener.to(mat, { opacity: to }, dur, ease, null, () => { if (to >= 0.999) { try { /*保留透明以支持后续淡入*/ mat.transparent = true; } catch(_){} } if (cb) cb(); });
        }
      } catch(_) { if (cb) cb(); }
    };
