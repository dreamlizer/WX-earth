// 交互/渲染/检索（入口）
// 拆分：geoindex（数据索引/候选集） + layers（场景/图层/渲染）

import { 
  convertLatLonToVec3,
  convertVec3ToLatLon,
  featureContains,
  normalizeLon
} from './geography.js';
import { loadCountries, buildIndex, gatherCandidates } from './geoindex.js';
import { getTextureUrl, prefetchTextureUrls, ensureOfflineTextures } from './texture-source.js';
import { createScene, makeBorder, makeEquatorAndTropics, highlight as highlightLayer, updateCameraDistance as updateCamDist, makeCountryColliders } from './layers.js';
import { INTERACTION_DEBUG_LOG, PERF_HIDE_STAR_ON_ON_DRAG, INERTIA_NONLINEAR, INERTIA_POWER, INERTIA_DAMP_MIN, INERTIA_DAMP_MAX, INERTIA_SPEED_MIN, INERTIA_SPEED_MAX, INERTIA_GAIN_BASE, INERTIA_GAIN_SCALE, INERTIA_LOG_DETAIL, INERTIA_LOG_THROTTLE_MS, INERTIA_APPLY_LOG_THROTTLE_MS } from './label-constants.js';
import { createDayNightMaterial } from './shaders/dayNightMix.glsl.js';
import { createAtmosphereShellMaterial } from './shaders/atmosphereShell.glsl.js';
import { APP_CFG } from './config.js';
import { createStarfield } from './starfield.glsl.js';
import { createPoetry3D } from './poetry3d.js';
// 兼容旧引用名：保持 LIGHT_CFG 的别名，避免到处改动
const LIGHT_CFG = APP_CFG;

// 常量参数
const RADIUS = 1;
const MARGIN = 1.02;
const OFFSET_Y = -0.55;
const DEBUG = { lonSameSign: true, invertLon: false, invertLat: false, logFly: true, calibLonDeg: 0, calibLatDeg: 15 };
// 选择诊断：在点击命中时输出候选格子、首个命中、可能的多重命中
const DEBUG_SELECT = true; // 仅在 INTERACTION_DEBUG_LOG 开启时实际打印

// 星光诊断日志总开关（如需静默可改为 false）
  const STAR_LOG = false; // 关闭星空调试日志，避免控制台刷屏

// 状态容器
 let state = null;
 // 新增：独立大气壳体 mesh（Additive 混合，避免被地表覆盖）
 let atmosphereMesh = null;

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
    try { if (ambientLight) ambientLight.intensity = __normalAmbient; } catch(_){}
    try { if (dirLight) dirLight.intensity = __normalDir; } catch(_){}
    try { console.info('[lights] normal profile', { useZenLights: __useZenLights, ambient: __normalAmbient, dir: __normalDir }); } catch(_){}
    const ambientBase = __normalAmbient; // 退出禅模式时恢复到此值（可为禅灯光）
    const dirLightBase = __normalDir;    // 退出禅模式时恢复到此值（可为禅灯光）
    // 禅定稳定时间戳与上一帧时间（用于自动旋转）
    let zenStableSince = 0;
    let __prevRenderTime = 0;
    // 星空：目标透明度与实例对象（渲染循环中平滑逼近）
    let __starTargetOpacity = 0.0;
    let __perfDrag = false; // 新增：性能模式标记（拖动中）
    let starfield = null;
    let __starLogNext = 0;
  let __starLogNextMiss = 0;
  let __starUniformWarned = false;

    // 调试工具：统一输出渲染器与贴图、着色器参数，便于对齐 PC 端
    const _tmName = (THREE, v) => {
      try {
        const names = ['NoToneMapping','LinearToneMapping','ReinhardToneMapping','CineonToneMapping','ACESFilmicToneMapping'];
        for (const n of names) { if (THREE?.[n] === v) return n; }
      } catch(_){}

      // 特例修正：若法国与科索沃同时命中且当前命中为科索沃，优先改为法国
      try {
        let frFeat = null, xkFeat = null;
        for (let i = 0; i < COUNTRY_FEATURES.length; i++) {
          const f = COUNTRY_FEATURES[i];
          if (!featureContains(lon, lat, f)) continue;
          const p = f?.props || {};
          const codeA3 = String(p.ISO_A3 || '').toUpperCase();
          const codeA2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
          const nm = p.NAME || p.ADMIN || '';
          const isFR = (codeA3 === 'FRA' || codeA2 === 'FR');
          const isXK = (codeA3 === 'XKX' || codeA2 === 'XK' || /KOSOVO/i.test(nm));
          if (isFR) frFeat = f;
          if (isXK) xkFeat = f;
        }
        if (frFeat && xkFeat && hit) {
          const hp = hit?.props || {};
          const hA3 = String(hp.ISO_A3 || '').toUpperCase();
          const hA2 = String(hp.ISO_A2 || hp.ISO || hp.ISO2 || hp.CC || '').toUpperCase();
          const hNm = hp.NAME || hp.ADMIN || '';
          const hitIsXK = (hA3 === 'XKX' || hA2 === 'XK' || /KOSOVO/i.test(hNm));
          if (hitIsXK) {
            if (INTERACTION_DEBUG_LOG && DEBUG_SELECT) {
              try { console.warn('[hit-test] override XK -> FR (special case)'); } catch(_){}
            }
            hit = frFeat;
          }
        }
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
      starfield = createStarfield(THREE);
      if (starfield) {
        starfield.renderOrder = -1; starfield.visible = false; scene.add(starfield);
        try {
          const cnt = starfield.geometry?.attributes?.position?.count ?? 0;
          const uniforms = starfield.material?.uniforms || {};
          if (STAR_LOG) { try { console.log('[star] created:', { count: cnt, hasTime: !!uniforms.time, hasOpacity: !!uniforms.uOpacity }); } catch(_){} }
          // 创建后同步 normal 模式的星点大小与亮度增益（配置化）
          const ncfg = LIGHT_CFG?.normal || {};
          if (uniforms.uSizeScale && typeof ncfg.starSizeScale === 'number') {
            uniforms.uSizeScale.value = ncfg.starSizeScale;
          }
          if (uniforms.uBrightnessGain && typeof ncfg.starBrightnessGain === 'number') {
            uniforms.uBrightnessGain.value = ncfg.starBrightnessGain;
          }
          if (uniforms.uBreathSpeed && typeof ncfg.starBreathSpeed === 'number') {
            uniforms.uBreathSpeed.value = ncfg.starBreathSpeed;
          }
          if (uniforms.uBreathStrength && typeof ncfg.starBreathStrength === 'number') {
            uniforms.uBreathStrength.value = ncfg.starBreathStrength;
          }
          if (STAR_LOG) { try { console.info('[star] uniforms:init', { sizeScale: uniforms.uSizeScale?.value, gain: uniforms.uBrightnessGain?.value }); } catch(_){} }
        } catch(_){}
      } else {
        if (STAR_LOG) { try { console.info('[star] factory return:', starfield); } catch(_){} }
      }
    } catch(e){ try { if (STAR_LOG) console.error('[star] create: error', e?.message || e); } catch(_){} }

    // 初始目标透明度：使用普通模式配置（便于在非禅模式下也看到极弱星空）
          try { __starTargetOpacity = (LIGHT_CFG?.normal?.starOpacity ?? 0.0); if (STAR_LOG) console.log('[star] init target from config:', __starTargetOpacity); } catch(_){}
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
        touch.velX = 0; touch.velY = 0; __fly = null; // 清除惯性与飞行状态
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
    let earthDay8kTex = null; // 8K 白昼贴图（webp）
    let earthNightTex = null;
    let __earthOldMat = null; // 禅模式切换材质时记录旧材质，退出恢复
    let __dayNightMat = null; // 昼夜混合 ShaderMaterial 引用（每帧更新 uniform）
    let __nightThemeActive = false; // 普通模式 Shader 下是否处于“纯夜视图”
    let __savedDayTexForShader = null; // 纯夜视图进入前的白天纹理（用于回退）
    let COUNTRY_FEATURES = null;
    let BORDER_GROUP = null;
    let COLLIDER_GROUP = null;
    let HIGHLIGHT_GROUP = null;
    let TROPIC_GROUP = null;
  // 移除：国际日期线（按需可在未来重新引入单独模块）
    let search = null; // { grid, cellSize, lonBuckets, latBuckets }

    const disposeGroup = (grp) => {
      if (!grp) return;
      grp.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    };
    // 自动取消选中：记录当前高亮的国家特征，并在渲染循环中基于“前半球可见比例”做判定
    let __highlightFeature = null;
    let __lastAutoClearCheck = 0;
    let __belowThresholdCount = 0;
    const __estimateFeatureFrontRatio = (f) => {
      if (!f || !globeGroup || !camera) return 1.0;
      try {
        const center = new THREE.Vector3();
        globeGroup.getWorldPosition(center);
        const camPos = camera.position.clone();
        let total = 0, front = 0;
        const addPoint = (lon, lat) => {
          const v = convertLatLonToVec3(lon, lat, RADIUS + 0.001);
          const p = new THREE.Vector3(v.x, v.y, v.z);
          try { p.applyQuaternion(globeGroup.quaternion); } catch(_){ }
          const worldP = p.add(center);
          const normal = worldP.clone().sub(center).normalize();
          const viewDir = camPos.clone().sub(worldP).normalize();
          const dot = normal.dot(viewDir);
          if (dot > 0) front++;
          total++;
        };
        const cs = f.coords || [];
        if (f.type === 'Polygon') {
          for (let i = 0; i < cs.length; i++) {
            const ring = cs[i] || [];
            for (let j = 0; j < ring.length; j++) {
              const p = ring[j]; if (!p || p.length < 2) continue;
              addPoint(p[0], p[1]);
            }
          }
        } else if (f.type === 'MultiPolygon') {
          for (let k = 0; k < cs.length; k++) {
            const poly = cs[k] || [];
            for (let i = 0; i < poly.length; i++) {
              const ring = poly[i] || [];
              for (let j = 0; j < ring.length; j++) {
                const p = ring[j]; if (!p || p.length < 2) continue;
                addPoint(p[0], p[1]);
              }
            }
          }
        }
        return (total > 0) ? (front / total) : 1.0;
      } catch(_){ return 1.0; }
    };
    // 高亮淡出管理（避免“闪消失”）
    let __highlightFadingGroup = null;
    let __highlightFadeEnd = 0;
    const setHighlight = (f) => {
      // 若存在当前高亮且即将清除，先触发淡出动画
      if (HIGHLIGHT_GROUP && !f) {
        try {
          const fadeMs = Math.max(0, Number(APP_CFG?.highlight?.fadeOutMs || 500));
          __highlightFadingGroup = HIGHLIGHT_GROUP;
          __highlightFadeEnd = Date.now() + fadeMs;
          // 准备材质为可透明并记录初始不透明度
          __highlightFadingGroup.traverse(obj => {
            const m = obj?.material; if (!m) return;
            try {
              m.transparent = true; m.opacity = (typeof m.opacity === 'number') ? m.opacity : 1.0; m.needsUpdate = true;
            } catch(_){ }
          });
        } catch(_){ }
        HIGHLIGHT_GROUP = null; // 允许下一次高亮立即创建
      } else if (HIGHLIGHT_GROUP) {
        // 没有淡出需求（例如替换为另一个高亮），直接清除旧组
        disposeGroup(HIGHLIGHT_GROUP); globeGroup.remove(HIGHLIGHT_GROUP); HIGHLIGHT_GROUP = null;
      }
      __highlightFeature = f || null;
      __belowThresholdCount = 0;
      if (!f) return;
      HIGHLIGHT_GROUP = highlightLayer(THREE, globeGroup, f);
    };

    // 统一封装：在禅定模式下调低叠加线亮度（国家边境颜色/赤道与回归线透明度）
    const applyZenOverlayDimming = () => {
      if (!zenActive) return;
      try {
        const ov = LIGHT_CFG.zen?.overlays || {};
        // 国家边境线：降低颜色强度（保留原色以便退出时恢复）
        if (BORDER_GROUP) {
          const handled = new Set();
          BORDER_GROUP.traverse(obj => {
            const m = obj?.material; if (!m || handled.has(m)) return; handled.add(m);
            if (m.color) {
              if (!m.userData.__origColor) m.userData.__origColor = m.color.clone();
              const k = (ov.bordersColorFactor ?? 0.65);
              const orig = m.userData.__origColor.clone();
              m.color.copy(orig).multiplyScalar(Math.max(0, Math.min(2, k)));
            }
          });
        }
        // 赤道/回归线：降低透明度（分别使用赤道/回归线系数）
        if (TROPIC_GROUP) {
          TROPIC_GROUP.children.forEach((mesh, idx) => {
            const m = mesh?.material; if (!m) return;
            if (typeof m.opacity === 'number') {
              if (m.userData.__origOpacity == null) m.userData.__origOpacity = m.opacity;
              m.transparent = true;
              const isEquator = (idx === 0);
              const k = isEquator ? (ov.equatorOpacityFactor ?? 0.65) : (ov.tropicsOpacityFactor ?? 0.65);
              const base = (m.userData.__origOpacity ?? m.opacity);
              m.opacity = Math.max(0, Math.min(1, base * Math.max(0, Math.min(2, k))));
            }
          });
        }
      } catch(_){ }
    };

    // 国家级单时区覆盖：返回 IANA 名称字符串；包含半小时/45分钟等特殊国家
    const getCountryOverride = (f) => {
      const p = f?.props || {};
      const code = (p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toString().toUpperCase();
      const name = (p.ADMIN || p.NAME || p.NAME_LONG || '').toString();
      const rules = [
        { codes: ['CN'], names: [/China|中国/i], tz: 'Asia/Shanghai' },
        { codes: ['IN'], names: [/India|印度/i], tz: 'Asia/Kolkata' },
        { codes: ['LK'], names: [/Sri\s*Lanka|斯里兰卡/i], tz: 'Asia/Colombo' },
        { codes: ['MM'], names: [/Myanmar|缅甸/i], tz: 'Asia/Yangon' },
        { codes: ['NP'], names: [/Nepal|尼泊尔/i], tz: 'Asia/Kathmandu' },
        { codes: ['IR'], names: [/Iran|伊朗/i], tz: 'Asia/Tehran' },
        { codes: ['AF'], names: [/Afghanistan|阿富汗/i], tz: 'Asia/Kabul' },
      ];
      for (const r of rules) {
        if ((r.codes && r.codes.includes(code)) || (r.names && r.names.some(re => re.test(name)))) {
          return r.tz;
        }
      }
      return null;
    };

    // 中央经线时区稳定器：避免在边界附近来回切换导致的闪烁
    const centerTZStable = { last: null, stable: null, count: 0, stableSince: 0 };

    // 纹理与数据加载（白天与夜景、云层）—— 改为云端优先、本地回退
    const loader = new THREE.TextureLoader();
    // 预取临时 URL，提升首帧稳定性（失败不影响）
    try { prefetchTextureUrls(); } catch(_){}
    // 首次加载时尝试离线持久化纹理（不影响正常加载）
    try { ensureOfflineTextures(); } catch(_){}
    // 调试：在控制台标注贴图来源（云端临时链接 or 本地兜底）
    const logSrc = (name, url, fallback, phase = 'load') => {
      try {
        const src = (url === fallback) ? 'local_fallback' : 'cloud_temp';
        console.info(`[texture] ${name} 来源(${phase}):`, src, url);
      } catch(_){}
    };
    // 地球白天贴图（云端优先，失败回本地）
    getTextureUrl('earth')
      .then(({ url, fallback }) => {
        logSrc('earth_day', url, fallback, 'start');
          loader.load(url, (tex) => {
            tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 1; try { tex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { tex.encoding = THREE.sRGBEncoding; } catch(__){} } earthDayTex = tex; dumpTextureInfo('earth_day', earthDayTex);
          earthMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 48), new THREE.MeshPhongMaterial({ map: earthDayTex, shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8) }));
          earthMesh.name = 'EARTH'; globeGroup.add(earthMesh);
          // 大气壳体：在地球创建后挂载（独立 ShaderMaterial）
          try {
            const a = (APP_CFG?.normal?.atmosphere || {});
            const shellEnabled = (a.enabled !== false);
            if (shellEnabled && !atmosphereMesh) {
              const deltaR = Number(a.shellDeltaR ?? 0.018); // 外壳半径增量（相对 R）
              const mat = createAtmosphereShellMaterial(THREE);
              // 参数同步（颜色/强度/幂次）
              try {
                if (mat.uniforms.uColor) {
                  const c = a.color || { r: 0.5, g: 0.8, b: 1.0 };
                  const r = (typeof c.r === 'number') ? c.r : (Array.isArray(c) ? c[0] : 0.5);
                  const g = (typeof c.g === 'number') ? c.g : (Array.isArray(c) ? c[1] : 0.8);
                  const b = (typeof c.b === 'number') ? c.b : (Array.isArray(c) ? c[2] : 1.0);
                  mat.uniforms.uColor.value.set(r, g, b);
                }
                if (mat.uniforms.uIntensity) mat.uniforms.uIntensity.value = Math.max(0.0, Math.min(2.0, (a.intensity ?? 0.12)));
                if (mat.uniforms.uPower) mat.uniforms.uPower.value = Math.max(0.1, Math.min(8.0, (a.power ?? 2.0)));
              } catch(_){}
              const geo = new THREE.SphereGeometry(RADIUS + Math.max(0.001, deltaR), 48, 48);
              atmosphereMesh = new THREE.Mesh(geo, mat);
              atmosphereMesh.name = 'ATMOS_SHELL';
              atmosphereMesh.renderOrder = 999; // 置后渲染，叠加到外缘
              globeGroup.add(atmosphereMesh);
              console.info('[ATMOS(shell) created]', { deltaR, intensity: mat.uniforms.uIntensity.value, power: mat.uniforms.uPower.value });
            }
          } catch(_){}
          // 普通模式装饰：赤道与南北回归线（淡金色）
          try { if (!TROPIC_GROUP) TROPIC_GROUP = makeEquatorAndTropics(THREE, globeGroup); } catch(_){}

          // 预加载夜景纹理（云端-only，失败不再回本地）
          getTextureUrl('earth_night').then(({ url: nightUrl, fallback: nightFb }) => {
            logSrc('earth_night', nightUrl, nightFb, 'start');
          loader.load(nightUrl, (night) => {
            night.minFilter = THREE.LinearFilter; night.magFilter = THREE.LinearFilter; try { night.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { night.encoding = THREE.sRGBEncoding; } catch(__){} } earthNightTex = night; dumpTextureInfo('earth_night', earthNightTex);
            // 普通模式：可选切换到“禅定材质”（昼夜混合），保持与禅模式一致的观感（不引入倾斜/自动旋转）
            try {
              const useZenMat = !!(APP_CFG?.normal?.useZenMaterial);
              if (useZenMat && !zenActive && earthMesh && earthDayTex) {
                __earthOldMat = earthMesh.material; // 记录以便必要时回退
                const softness = (LIGHT_CFG.zen?.mixSoftness ?? 0.20);
                const gamma = (LIGHT_CFG.zen?.gamma ?? 1.0);
                // 根据当前主题选择普通模式的“白天纹理”：day8k 优先，否则默认
                const dayTexForNormal = (currentTheme === 'day8k' && earthDay8kTex) ? earthDay8kTex : earthDayTex;
                __dayNightMat = createDayNightMaterial(THREE, dayTexForNormal, earthNightTex, softness, gamma);
                // 同步禅定下的曝光/白天侧增益等参数，以尽可能一致
                try {
                  const u = __dayNightMat.uniforms || {};
                  if (u.uNightDarkness) u.uNightDarkness.value = (LIGHT_CFG.zen?.nightDarkness ?? 0.85);
                  if (u.uDayContrast) u.uDayContrast.value = (LIGHT_CFG.zen?.dayContrast ?? 1.0);
                  if (u.uMixPower) u.uMixPower.value = (LIGHT_CFG.zen?.mixPower ?? 1.0);
                  if (u.uDayNightContrast) u.uDayNightContrast.value = (LIGHT_CFG.zen?.dayNightContrast ?? 1.0);
                  if (u.uDaySideGain) {
                    const base = (dirLightBase || 1);
                    const target = (LIGHT_CFG.zen?.dirLightIntensityRight ?? base);
                    const fallbackGain = Math.max(1.0, Math.min(3.0, target / base));
                    const cfgGain = LIGHT_CFG.zen?.daySideGain;
                    u.uDaySideGain.value = (cfgGain !== undefined) ? Math.min(3.0, Math.max(0.7, cfgGain)) : fallbackGain;
                  }
                  if (u.uExposure) {
                    const base = (dirLightBase || 1);
                    const target = (LIGHT_CFG.zen?.dirLightIntensityRight ?? base);
                    const ratio = target / base;
                    const fallbackExposure = Math.max(1.0, Math.min(2.2, ratio * 1.15));
                    const cfgExposure = LIGHT_CFG.zen?.exposure;
                    u.uExposure.value = (cfgExposure !== undefined) ? Math.min(2.5, Math.max(0.7, cfgExposure)) : fallbackExposure;
                  }
                  if (u.uHighlightsRoll) u.uHighlightsRoll.value = Math.max(0.0, Math.min(1.0, (LIGHT_CFG.zen?.highlightsRoll ?? 0.0)));
                  // 高光参数：与禅模式一致
                  const shininess = (LIGHT_CFG.earthMaterial?.shininess ?? 8);
                  if (u.uShininess) u.uShininess.value = Math.max(1.0, shininess);
                  if (u.uSpecularStrength) u.uSpecularStrength.value = Math.max(0.0, Math.min(2.0, (LIGHT_CFG?.zen?.specularStrength ?? 0.95)));
                  if (u.uSpecularColor) { u.uSpecularColor.value.set(1,1,1); }
                  if (u.uSpecularUseTex) { u.uSpecularUseTex.value = 0.0; }
                  // 初始相机位置
                  if (u.uCameraPosWorld) { u.uCameraPosWorld.value.copy(camera.position); }
                } catch(_){}
                earthMesh.material = __dayNightMat;
                earthMesh.material.needsUpdate = true;
                // 更新：普通模式下的大气辉光（Fresnel）参数
                try {
                  const u = __dayNightMat.uniforms || {};
                  const a = (APP_CFG?.normal?.atmosphere || {});
                  const enabled = (a.enabled !== false);
                  if (u.uAtmosphereIntensity) u.uAtmosphereIntensity.value = enabled ? Math.max(0.0, Math.min(2.0, (a.intensity ?? 0.12))) : 0.0;
                  if (u.uAtmospherePower) u.uAtmospherePower.value = Math.max(0.1, Math.min(8.0, (a.power ?? 2.0)));
                  if (u.uAtmosphereDebugOnly) u.uAtmosphereDebugOnly.value = (a.debugOnly === true) ? 1.0 : 0.0;
                  if (u.uAtmosphereColor) {
                    const c = a.color || { r: 0.5, g: 0.8, b: 1.0 };
                    const r = (typeof c.r === 'number') ? c.r : (Array.isArray(c) ? c[0] : 0.5);
                    const g = (typeof c.g === 'number') ? c.g : (Array.isArray(c) ? c[1] : 0.8);
                    const b = (typeof c.b === 'number') ? c.b : (Array.isArray(c) ? c[2] : 1.0);
                    u.uAtmosphereColor.value.set(r, g, b);
                  }
                  // 诊断：确认辉光参数已写入
                  try {
                    console.info('[ATMOS(normal) uniforms set]', {
                      enabled,
                      cfgIntensity: a.intensity,
                      cfgPower: a.power,
                      debugOnly: !!a.debugOnly,
                      setIntensity: Number(u.uAtmosphereIntensity?.value || 0).toFixed(3),
                      setPower: Number(u.uAtmospherePower?.value || 0).toFixed(3),
                      setDebugOnly: Number(u.uAtmosphereDebugOnly?.value || 0).toFixed(3),
                      setColor: {
                        r: Number(u.uAtmosphereColor?.value?.r ?? NaN).toFixed(3),
                        g: Number(u.uAtmosphereColor?.value?.g ?? NaN).toFixed(3),
                        b: Number(u.uAtmosphereColor?.value?.b ?? NaN).toFixed(3),
                      },
                    });
                    if (enabled && (Number(u.uAtmosphereIntensity?.value || 0) < 0.001)) {
                      console.warn('[ATMOS(normal)] intensity very small or zero, effect likely invisible');
                    }
                  } catch(_){ }
                } catch(_){ }
                try {
                  console.info('[NORMAL-ZEN uniforms]', {
                    matType: earthMesh?.material?.type,
                    isShader: (earthMesh?.material instanceof THREE.ShaderMaterial),
                    exposure: Number(__dayNightMat?.uniforms?.uExposure?.value || 0).toFixed(3),
                    atmosIntensity: Number(__dayNightMat?.uniforms?.uAtmosphereIntensity?.value || 0).toFixed(3),
                    atmosPower: Number(__dayNightMat?.uniforms?.uAtmospherePower?.value || 0).toFixed(3),
                    atmosColor: {
                      r: Number(__dayNightMat?.uniforms?.uAtmosphereColor?.value?.r ?? NaN).toFixed(3),
                      g: Number(__dayNightMat?.uniforms?.uAtmosphereColor?.value?.g ?? NaN).toFixed(3),
                      b: Number(__dayNightMat?.uniforms?.uAtmosphereColor?.value?.b ?? NaN).toFixed(3),
                    },
                    daySideGain: Number(__dayNightMat?.uniforms?.uDaySideGain?.value || 0).toFixed(3),
                  });
                } catch(_){}
              }
            } catch(_){ }
          }, undefined, () => { try { console.warn('[texture] 夜景贴图云端加载失败（保持云端-only，不使用本地回退）'); } catch(_){} });
          });
          // 预加载 8K 白昼贴图（云端优先，失败回本地）
          getTextureUrl('earth_day8k').then(({ url: day8kUrl, fallback: day8kFb }) => {
            logSrc('earth_day8k', day8kUrl, day8kFb, 'start');
            loader.load(day8kUrl, (day8k) => {
              day8k.minFilter = THREE.LinearFilter; day8k.magFilter = THREE.LinearFilter; day8k.anisotropy = 1;
              try { day8k.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { day8k.encoding = THREE.sRGBEncoding; } catch(__){} }
              earthDay8kTex = day8k; dumpTextureInfo('earth_day8k', earthDay8kTex);
            }, undefined, () => {
              try { console.warn('[texture] 8K 白昼贴图加载失败（将保持默认白昼贴图）'); } catch(_){}
            });
          });
          // 云层：按配置开关加载（避免不必要的资源与逻辑交叉）
          const wantCloud = !!(APP_CFG?.cloud?.enabled);
          if (wantCloud) {
            getTextureUrl('cloud').then(({ url: cloudUrl, fallback: cloudFb }) => {
              logSrc('cloud', cloudUrl, cloudFb, 'start');
              loader.load(cloudUrl, (cloudTex) => {
                cloudTex.minFilter = THREE.LinearFilter; cloudTex.magFilter = THREE.LinearFilter;
                try { cloudTex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { cloudTex.encoding = THREE.sRGBEncoding; } catch(__){} }
                const cloudMat = new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.42, depthWrite: false });
                cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS + 0.012, 64, 64), cloudMat);
                cloudMesh.name = 'CLOUD';
                // 初始可见性：跟随页面数据（默认关闭，但若用户已点“云层”则立即显示）
                try { cloudMesh.visible = !!(page && page.data && page.data.showCloud); } catch(_){ cloudMesh.visible = false; }
                globeGroup.add(cloudMesh);
                dumpTextureInfo('cloud', cloudTex);
              }, undefined, () => {
                // 云端失败：尝试使用本地兜底贴图（如存在）
                if (cloudFb) {
                  try {
                    logSrc('cloud-fallback', cloudUrl, cloudFb, 'fallback');
                    loader.load(cloudFb, (fbTex) => {
                      fbTex.minFilter = THREE.LinearFilter; fbTex.magFilter = THREE.LinearFilter;
                      try { fbTex.colorSpace = THREE.SRGBColorSpace; } catch(_){ try { fbTex.encoding = THREE.sRGBEncoding; } catch(__){} }
                      const cloudMat = new THREE.MeshPhongMaterial({ map: fbTex, transparent: true, opacity: 0.42, depthWrite: false });
                      cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS + 0.012, 64, 64), cloudMat);
                      cloudMesh.name = 'CLOUD';
                      try { cloudMesh.visible = !!(page && page.data && page.data.showCloud); } catch(_){ cloudMesh.visible = false; }
                      globeGroup.add(cloudMesh);
              dumpTextureInfo('cloud-fallback', fbTex);
            }, undefined, () => { try { console.warn('[texture] 云层贴图本地兜底也加载失败'); } catch(_){} });
          } catch(_){ try { console.warn('[texture] 云层贴图回退流程异常'); } catch(__){} }
        } else {
          try { console.warn('[texture] 云层贴图云端加载失败（无兜底）'); } catch(_){}
        }
      });
    });
  }

          loadCountries().then((features) => {
            COUNTRY_FEATURES = features;
            BORDER_GROUP = makeBorder(THREE, globeGroup, COUNTRY_FEATURES);
            // 构建不可见的国家碰撞网格，稳定点击命中
            try { COLLIDER_GROUP = makeCountryColliders(THREE, globeGroup, COUNTRY_FEATURES); } catch(_){ COLLIDER_GROUP = null; }
            search = buildIndex(features);
            // 通知页面国家数据已加载，便于构建标签基础数据
            try { page?.onCountriesLoaded?.(features); } catch (e) { /* noop */ }
          });
        }, undefined, () => {
          // 云端加载失败：保持云端-only，不再使用本地图片；以占位材质降级
          try {
            console.warn('[texture] 地球白天贴图云端加载失败（云端-only）——使用占位材质，功能可用但无贴图');
            earthDayTex = null;
            earthMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 48), new THREE.MeshPhongMaterial({ color: 0x888888, shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8) }));
            earthMesh.name = 'EARTH'; globeGroup.add(earthMesh);
            try { if (!TROPIC_GROUP) TROPIC_GROUP = makeEquatorAndTropics(THREE, globeGroup); } catch(_){}
            // 继续加载国家数据，保证其他功能正常
            try {
              loadCountries().then((features) => {
                COUNTRY_FEATURES = features;
                BORDER_GROUP = makeBorder(THREE, globeGroup, COUNTRY_FEATURES);
                search = buildIndex(features);
                try { page?.onCountriesLoaded?.(features); } catch (e) { /* noop */ }
              });
            } catch(_){ }
          } catch(_){}
        });
      })
      .catch(() => {
        // getTextureUrl 失败：保持云端-only，不使用本地兜底；以占位材质降级
        try {
          console.warn('[texture] getTextureUrl(earth) 失败（云端-only）——使用占位材质，功能可用但无贴图');
          earthDayTex = null;
          earthMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 48), new THREE.MeshPhongMaterial({ color: 0x888888, shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8) }));
          earthMesh.name = 'EARTH'; globeGroup.add(earthMesh);
          try { if (!TROPIC_GROUP) TROPIC_GROUP = makeEquatorAndTropics(THREE, globeGroup); } catch(_){}
          // 保持其他功能可用：继续加载国家特征并通知页面
          try {
            loadCountries().then((features) => {
              COUNTRY_FEATURES = features;
              BORDER_GROUP = makeBorder(THREE, globeGroup, COUNTRY_FEATURES);
              try { COLLIDER_GROUP = makeCountryColliders(THREE, globeGroup, COUNTRY_FEATURES); } catch(_){ COLLIDER_GROUP = null; }
              search = buildIndex(features);
              try { page?.onCountriesLoaded?.(features); } catch (e) { /* noop */ }
            });
          } catch(_){ }
        } catch(_){ }
      });

    // 触控事件
    const onTouchStart = e => {
      const ts = e.touches || [];
      if (ts.length >= 2) {
        // 禅定模式下禁止捏合缩放
        if (zenActive) { touch.pinch = false; return; }
        const d = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y);
        touch.pinch = true; touch.pinchStartDist = d; touch.pinchStartZoom = zoom;
        touch.isDragging = false; touch.velX = 0; touch.velY = 0; // 捏合时清零惯性
        return;
      }
      const t = ts[0];
      // 坐标防护：若 x/y 缺失或非法，忽略本次事件，避免 NaN 传入渲染
      if (!t || typeof t.x !== 'number' || typeof t.y !== 'number' || !isFinite(t.x) || !isFinite(t.y)) {
        return;
      }
      // 触碰即暂停（优化）：若当前存在惯性旋转，单指再次触碰立即清零速度
      try {
        const moving = (Math.abs(touch.velX) > 0.0002) || (Math.abs(touch.velY) > 0.0002);
        if (moving && !touch.pinch) {
          touch.velX = 0; touch.velY = 0;
          if (INTERACTION_DEBUG_LOG) console.log('[inertia:stop-by-touch]');
        }
      } catch(_){}
      touch.isDragging = true; touch.lastX = t.x; touch.lastY = t.y; touch.downX = t.x; touch.downY = t.y; touch.downTime = Date.now();
    };

    const onTouchMove = e => {
      const ts = e.touches || [];
      if (ts.length >= 2 && touch.pinch && typeof touch.pinchStartDist === 'number') {
        if (zenActive) { return; }
        const d = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y);
        if (d > 0) {
          const ratio = d / touch.pinchStartDist;
          zoom = clampZoom(touch.pinchStartZoom * ratio);
          updateCamDist(camera, baseDist, zoom);
        }
        return;
      }
      const t = ts[0]; if (!t || !touch.isDragging) return;
      if (typeof t.x !== 'number' || typeof t.y !== 'number' || !isFinite(t.x) || !isFinite(t.y)) { return; }
      const dx = t.x - touch.lastX, dy = t.y - touch.lastY; touch.lastX = t.x; touch.lastY = t.y;
      // 平台独立的方向映射：PC 与手机可分别配置
      // 经验值：PC 鼠标拖动向右 -> 地球向右转；手机手指拖动同样向右 -> 地球向右转
      const MAP = touch.isPC
        ? { dx: -1, dy:  1 }   // PC：与桌面版一致
        : { dx: -1, dy:  1 };  // Mobile：与 PC 同向，避免“相反”感
      // 旋转步长与缩放解耦：zoom 越大角速度越小，屏幕位移更稳定
      const baseStep = 0.005;
      const speedScale = Math.pow(Math.max(0.6, zoom), -0.9) * 1.08; // 略微加速但整体随 zoom 反比
      const stepY = -MAP.dx * dx * baseStep * speedScale; // 水平拖动映射到 yaw
      const stepX =  MAP.dy * dy * baseStep * speedScale; // 垂直拖动映射到 pitch
      touch.rotY += stepY;
      // 禅定模式：只允许绕赤道旋转（固定 rotX=0）
      if (!zenActive) {
        touch.rotX += stepX;
      }
      // 记录当前瞬时速度，并做一点低通滤波，减抖动
      const gain = 1 + (touch.inertiaGain || 0);
      touch.velY = Math.max(-touch.maxSpeed, Math.min(touch.maxSpeed, touch.velY * 0.8 + stepY * 0.2 * gain));
      touch.velX = Math.max(-touch.maxSpeed, Math.min(touch.maxSpeed, zenActive ? 0 : (touch.velX * 0.8 + stepX * 0.2 * gain)));
      touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, zenActive ? 0 : touch.rotX));
      // 诊断日志：拖动阶段的步长/速度/限幅/增益/缩放（节流）
      try {
        if (INTERACTION_DEBUG_LOG && INERTIA_LOG_DETAIL) {
          const now = Date.now();
          if (!touch.__lastDragLogAt || (now - touch.__lastDragLogAt) > (INERTIA_LOG_THROTTLE_MS || 120)) {
            console.log('[inertia:drag]', {
              dx: Number(dx.toFixed(2)), dy: Number(dy.toFixed(2)),
              stepX: Number(stepX.toFixed(5)), stepY: Number(stepY.toFixed(5)),
              velX: Number(touch.velX.toFixed(5)), velY: Number(touch.velY.toFixed(5)),
              gain: Number(gain.toFixed(3)), maxSpeed: Number(touch.maxSpeed.toFixed(3)),
              damping: Number(touch.damping.toFixed(5)), zoom: Number(zoom.toFixed(3))
            });
            touch.__lastDragLogAt = now;
          }
        }
      } catch(_){}
    };

    const onTouchEnd = () => {
      if (touch.pinch) { touch.pinch = false; return; }
      // 记录松手瞬间速度（不论是否点击命中国家，便于后续惯性阶段诊断）
      try {
        if (INTERACTION_DEBUG_LOG && INERTIA_LOG_DETAIL) {
          touch.releaseVelX = touch.velX; touch.releaseVelY = touch.velY; touch.releaseAt = Date.now();
          console.log('[inertia:release]', {
            velX: Number(touch.releaseVelX.toFixed(5)), velY: Number(touch.releaseVelY.toFixed(5)),
            speed: Number(Math.hypot(touch.releaseVelX, touch.releaseVelY).toFixed(5)),
            damping: Number(touch.damping.toFixed(5)), maxSpeed: Number(touch.maxSpeed.toFixed(3)),
            gain: Number((1 + (touch.inertiaGain || 0)).toFixed(3)), zoom: Number(zoom.toFixed(3))
          });
        }
      } catch(_){}
      const isTap = (Date.now()-touch.downTime)<=250 && Math.hypot(touch.lastX-touch.downX, touch.lastY-touch.downY)<=6;
      touch.isDragging = false; if (!isTap || !earthMesh || !search) return;
      raycaster.setFromCamera({ x: (touch.downX / width) * 2 - 1, y: -(touch.downY / height) * 2 + 1 }, camera);
      // 优先使用国家碰撞网格命中（只取最近，并剔除明显背面）
      let inter = null; let interCountry = null;
      try { if (COLLIDER_GROUP) interCountry = raycaster.intersectObject(COLLIDER_GROUP, true)[0]; } catch(_){ }
      if (interCountry) {
        try {
          const globeCenter = new THREE.Vector3(); globeGroup.getWorldPosition(globeCenter);
          const normalP = interCountry.point.clone().sub(globeCenter).normalize();
          const viewP = camera.position.clone().sub(interCountry.point).normalize();
          const dotP = normalP.dot(viewP);
          if (dotP > -0.08) inter = interCountry; // 允许轻微边缘
        } catch(_){ inter = interCountry; }
      }
      if (!inter) { inter = raycaster.intersectObject(earthMesh, true)[0]; }
      if (!inter) {
        setHighlight(null);
        // 取消选中，但不清空时间（改为显示中央经线时区）
        page.selectedTimezone = null;
        page.setData({ hoverText: '' });
        page.lastTimeUpdate = 0; // 强制下一帧刷新中央经线时间
        return;
      }
      const pLocal = globeGroup.worldToLocal(inter.point.clone());
      let [lon, lat] = convertVec3ToLatLon(pLocal.x, pLocal.y, pLocal.z);
      // 修正：保持与 convertVec3ToLatLon 默认同号，不再额外取负
      // 若需调试同号行为，仅归一化，不翻转符号
      if (DEBUG.lonSameSign) lon = normalizeLon(lon);

      // 点击蓝点可视化
      const v = convertLatLonToVec3(lon, lat, RADIUS + 0.003);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.006, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x33ccff })
      );
      dot.position.set(v.x, v.y, v.z);
      globeGroup.add(dot);
      setTimeout(() => { globeGroup.remove(dot); dot.geometry.dispose(); dot.material.dispose(); }, 800);
      // Mesh-only 选择：若命中碰撞网格则直接作为候选；若无网格命中则禁用二维回退
      let meshHit = null;
      const fidFromCollider = inter?.object?.userData?.fid;
      const isColliderHit = (typeof fidFromCollider === 'number');
      if (isColliderHit && COUNTRY_FEATURES && COUNTRY_FEATURES[fidFromCollider]) {
        const f0 = COUNTRY_FEATURES[fidFromCollider];
        if (featureContains(lon, lat, f0)) { meshHit = f0; }
      }
      const disable2DSearch = !isColliderHit;

      const steps = [12, 24, 48, 80];
      let hit = null;
      if (meshHit) hit = meshHit;
      if (!hit && !disable2DSearch) { for (const k of steps) {
        const candIds = gatherCandidates(search, lon, lat, k);
        if (INTERACTION_DEBUG_LOG && DEBUG_SELECT) {
          try {
            const sample = candIds.slice(0, Math.min(10, candIds.length)).map(fid => {
              const f = COUNTRY_FEATURES[fid];
              const p = f?.props || {};
              const a3 = String(p.ISO_A3||'').toUpperCase();
              const name = p.NAME || p.ADMIN || a3 || `#${fid}`;
              return `${a3}:${name}`;
            });
            console.log('[hit-test] step', k, 'lon=', lon.toFixed(4), 'lat=', lat.toFixed(4), 'cand=', candIds.length, sample.join(', '));
          } catch(_){}
        }
        for (const fid of candIds) {
          const f = COUNTRY_FEATURES[fid];
          if (featureContains(lon, lat, f)) { hit = f; break; }
        }
        if (hit) break;
      } }
      // 若碰撞网格已命中，直接映射到对应国家（并用 featureContains 复核洞/边界）
      if (!hit && !disable2DSearch && interCountry && COUNTRY_FEATURES) {
        try {
          const fid = interCountry?.object?.userData?.fid;
          if (typeof fid === 'number' && COUNTRY_FEATURES[fid]) {
            const f = COUNTRY_FEATURES[fid];
            if (featureContains(lon, lat, f)) hit = f; // 洞内会被否决
          }
        } catch(_){ }
      }
      if (!hit && !disable2DSearch) {
        for (let i = 0; i < COUNTRY_FEATURES.length; i++) {
          const f = COUNTRY_FEATURES[i];
          if (featureContains(lon, lat, f)) { hit = f; break; }
        }
      }

      // 保护性修正：若存在多候选同时命中，优先选择“点击点更接近其地理中心”的国家
      // 这可缓解因个别数据环方向/展开导致的误命中（例如法国附近误命中科索沃）
      try {
        const deg2rad = (d) => d * Math.PI / 180;
        const rad2deg = (r) => r * 180 / Math.PI;
        const distDeg = (aLon, aLat, bLon, bLat) => {
          // 近似球面距离（度）：使用球面余弦公式再转度
          const A = convertLatLonToVec3(aLon, aLat, 1);
          const B = convertLatLonToVec3(bLon, bLat, 1);
          const va = new THREE.Vector3(A.x, A.y, A.z).normalize();
          const vb = new THREE.Vector3(B.x, B.y, B.z).normalize();
          const dot = Math.max(-1, Math.min(1, va.dot(vb)));
          const ang = Math.acos(dot);
          return rad2deg(ang);
        };
        const nearby = [];
        for (let i = 0; i < COUNTRY_FEATURES.length; i++) {
          const f = COUNTRY_FEATURES[i];
          if (!featureContains(lon, lat, f)) continue;
          const b = f.bbox || [-180,-90,180,90];
          const cLon = (b[0] + b[2]) * 0.5;
          const cLat = (b[1] + b[3]) * 0.5;
          const d = distDeg(lon, lat, cLon, cLat);
          nearby.push({ f, d });
        }
        if (nearby.length >= 2) {
          nearby.sort((a,b) => a.d - b.d);
          const pick = nearby[0]?.f || null;
          if (pick && pick !== hit) {
            const pA = hit?.props || {}, pB = pick?.props || {};
            const nameA = pA.NAME || pA.ADMIN || pA.ISO_A3 || '(A)';
            const nameB = pB.NAME || pB.ADMIN || pB.ISO_A3 || '(B)';
            if (INTERACTION_DEBUG_LOG && DEBUG_SELECT) {
              try { console.warn('[hit-test] override to nearest center:', nameA, '->', nameB); } catch(_){}
            }
            hit = pick;
          }
        }
      } catch(_){}

      // 诊断：检查是否存在“多重命中”，帮助定位重叠或坐标展开问题
      if (INTERACTION_DEBUG_LOG && DEBUG_SELECT) {
        try {
          const multi = [];
          for (let i = 0; i < COUNTRY_FEATURES.length; i++) {
            const f = COUNTRY_FEATURES[i];
            if (featureContains(lon, lat, f)) {
              const p = f?.props || {};
              const a3 = String(p.ISO_A3||'').toUpperCase();
              const name = p.NAME || p.ADMIN || a3 || `#${i}`;
              multi.push(`${a3}:${name}`);
              if (multi.length >= 6) break;
            }
          }
          if (multi.length > 1) {
            console.warn('[hit-test] multi-matches@', lon.toFixed(4), lat.toFixed(4), '=>', multi.join(' | '));
          } else if (multi.length === 1) {
            console.log('[hit-test] single-match@', lon.toFixed(4), lat.toFixed(4), '=>', multi[0]);
          } else {
            console.log('[hit-test] no-match@', lon.toFixed(4), lat.toFixed(4));
          }
        } catch(_){}
      }

      // 前半球可见性门槛：改为以“点击点”为准，允许轻微边缘（更贴近直觉）
      if (hit && inter) {
        try {
          const globeCenter = new THREE.Vector3();
          globeGroup.getWorldPosition(globeCenter);
          const worldP = inter.point.clone();
          const normalP = worldP.clone().sub(globeCenter).normalize();
          const viewP = camera.position.clone().sub(worldP).normalize();
          const dotP = normalP.dot(viewP);
          // 允许轻微负值（边缘），仅当“明显在背面”才视为未命中
          if (dotP <= -0.08) { hit = null; }
        } catch(_){ /* 忽略可见性判定失败，走原逻辑 */ }
      }

      setHighlight(hit);
      try { page?.onCountryPicked?.(hit || null); } catch(_){ }
      if (hit) {
        const name = hit.props?.NAME || hit.props?.ADMIN || '(unknown)';
        if (INTERACTION_DEBUG_LOG) {
          console.log('[select] country:', name, 'at', lon.toFixed(4), lat.toFixed(4));
        }
        // 查询并显示 IANA 时区（先尝试国家覆盖，再回退 geo-tz）
        try {
          const override = getCountryOverride(hit);
          const tzName = (override !== null && override !== undefined)
            ? override // 如果覆盖返回的是分钟偏移，需映射到 IANA 名称；这里直接改为覆盖返回 IANA 名称更稳妥
            : (page.tzlookup?.(lat, lon));
          page.selectedTimezone = tzName ?? null;
          const tzLabel = (typeof tzName === 'string') ? tzName : '';
          // 改为仅显示 GMT 偏移或 IANA 名称，去掉国家名，避免文本过长
          let hoverText = '';
          try {
            const offsetStr = page.computeGmtOffsetStr?.(tzName);
            hoverText = offsetStr || tzLabel;
          } catch(_){ hoverText = tzLabel; }
          page.setData({ hoverText });
          try { page.updateTopOffsets && page.updateTopOffsets(); } catch(_){}
          const now = Date.now();
          page.lastTimeUpdate = now;
          // 禅定模式：强制清空 hover 文本，避免出现时区胶囊
          try { if (page?.data?.zenMode) { page.setData({ hoverText: '' }); } } catch(_){ }
          const timeStr = page.formatTime(new Date(now), tzName);
          if (timeStr && timeStr !== page.data.currentTime) {
            page.setData({ currentTime: timeStr });
          }
        } catch (err) {
          console.warn('[tzlookup] failed:', err);
          page.selectedTimezone = null;
          page.setData({ hoverText: '' });
          page.lastTimeUpdate = 0;
        }
      } else {
        if (INTERACTION_DEBUG_LOG) {
          console.log(`[select] no country at lon=${lon.toFixed(4)}, lat=${lat.toFixed(4)}`);
        }
        page.selectedTimezone = null;
        page.setData({ hoverText: '' });
        try { page.updateTopOffsets && page.updateTopOffsets(); } catch(_){}
        page.lastTimeUpdate = 0; // 下一帧刷新中央经线时区
        try { page?.onCountryPicked?.(null); } catch(_){ }
      }
    };

    // 渲染循环（可暂停）
    let __paused = false;
    let __rafId = 0;
    // 飞行动画状态：在指定时长内将 rotX/rotY 平滑过渡到目标
    let __fly = null; // { sx, sy, tx, ty, t0, dur }
    // 飞行路径特效：在球面上绘制半透明弧线并随时间淡出
    let __pathFx = null; // { mesh, t0, dur }
    // 诊断：在飞行期间限速打印中心经纬，帮助定位偏差
    let __flyProbeUntil = 0;
    let __flyProbeLast = 0;
    // 星呼吸诊断窗口：进入/切换模式后 15 秒内每 1.5 秒采样一次
    let __breathDiagUntil = 0;
    let __breathLogNext = 0;
      const render = () => {
        if (__paused) return; // 暂停时不继续渲染与调度
        const now = Date.now();
        const dtSec = __prevRenderTime ? Math.max(0, Math.min(0.12, (now - __prevRenderTime) / 1000)) : 0;
        // 暴露飞行状态给标签系统（用于控制脉冲动画的启动时机）
        try { if (state) state.isFlying = !!__fly; } catch(_){}

        // 星空背景：更新时间与淡入淡出（柔和不抢眼）
        try {
          if (starfield && starfield.material) {
            const mat = starfield.material;
            if ((!mat.uniforms || !mat.uniforms.uOpacity) && !__starUniformWarned && STAR_LOG) {
              __starUniformWarned = true;
          if (STAR_LOG) { try { console.warn('[star] warn: uOpacity uniform missing on material'); } catch(_){} }
            }
            if (mat.uniforms && mat.uniforms.time) { mat.uniforms.time.value = now * 0.001; }
            const target = __starTargetOpacity;
            const cur = (mat.uniforms && mat.uniforms.uOpacity) ? (mat.uniforms.uOpacity.value || 0.0) : 0.0;
            const lerpK = Math.min(1.0, dtSec * 2.8);
            const next = cur + (target - cur) * lerpK;
            // 提升上限到 1.0，并降低可见阈值，强调可见性
            if (mat.uniforms && mat.uniforms.uOpacity) mat.uniforms.uOpacity.value = Math.max(0.0, Math.min(1.0, next));
            starfield.visible = next > 0.01;
            if (now >= __starLogNext) {
              __starLogNext = now + 1000;
              if (STAR_LOG) { try { console.log('[star] tick:', { target: target.toFixed(3), cur: next.toFixed(3), visible: starfield.visible }); } catch(_){} }
            }
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
                  visible: !!starfield.visible,
                });
              } catch(_){}
            }
          } else {
            if (STAR_LOG && now >= __starLogNextMiss) {
              __starLogNextMiss = now + 2000;
              if (STAR_LOG) { try { console.warn('[star] not ready:', { hasObj: !!starfield, hasMat: !!(starfield && starfield.material) }); } catch(_){} }
            }
          }
        } catch(_){}

      // 每帧计算当前应显示的时区：优先选中国家；否则使用屏幕中央经线时区（带稳定门槛）
      let activeTZ = page.selectedTimezone ?? null;
      if (!activeTZ && earthMesh) {
        try {
          const v = new THREE.Vector3(0, 0, RADIUS);
          // 修正符号：与 globeGroup.rotation.set(touch.rotX, touch.rotY, 0) 保持一致
          v.applyEuler(new THREE.Euler(touch.rotX, touch.rotY, 0, 'XYZ'));
          const [clon, clat] = convertVec3ToLatLon(v.x, v.y, v.z);
          // —— 诊断：飞行期间采样中心经纬，观察是否按预期接近目标
          if (INTERACTION_DEBUG_LOG && now <= __flyProbeUntil) {
            if (now - __flyProbeLast >= 200) {
              __flyProbeLast = now;
              try { console.log('[probe center]', 'lon=', clon.toFixed(4), 'lat=', clat.toFixed(4), 'rotX=', touch.rotX.toFixed(4), 'rotY=', touch.rotY.toFixed(4)); } catch(_){}
            }
          }
          let tzByCountry = null;
          if (search && COUNTRY_FEATURES) {
            const candIds = gatherCandidates(search, clon, clat, 24);
            for (const fid of candIds) {
              const f = COUNTRY_FEATURES[fid];
              if (featureContains(clon, clat, f)) { tzByCountry = getCountryOverride(f); break; }
            }
          }
          let computedTZ = (tzByCountry !== null && tzByCountry !== undefined)
            ? tzByCountry
            : (page.tzlookup?.(clat, clon) ?? null);
          // 兜底：在大洋等无国家覆盖区域，按经度推导 Etc/GMT±N（保证跨日期线能变化）
          if (!computedTZ || typeof computedTZ !== 'string') {
            const off = Math.round(normalizeLon(clon) / 15); // 东经为正，约每15°一小时
            const sign = off >= 0 ? '-' : '+'; // Etc/GMT-8 表示 GMT+8（Etc 号反向约定）
            const abs = Math.abs(off);
            computedTZ = `Etc/GMT${sign}${abs}`;
          }
          if (computedTZ === centerTZStable.last) {
            centerTZStable.count++;
          } else {
            centerTZStable.last = computedTZ;
            centerTZStable.count = 1;
            centerTZStable.stableSince = now;
          }
          const frameThreshold = touch.isDragging ? 2 : 3;
          const timeThreshold = touch.isDragging ? 250 : 400;
          if (centerTZStable.count >= frameThreshold || (now - centerTZStable.stableSince) >= timeThreshold) {
            centerTZStable.stable = computedTZ;
          }
          activeTZ = centerTZStable.stable ?? computedTZ;
        } catch (e) { console.warn('[center tz] compute failed:', e); }
      }

      const committed = page.currentTZ ?? null;
      if (activeTZ !== committed) {
        page.currentTZ = activeTZ;
        page.lastTimeUpdate = 0; // 触发立即刷新
      }

      // 显示层的“小时位”稳定器：
      // 原则：
      // 1) 拖动时，仅显示到分钟（例如 12:20），避免小时位在边界来回跳动；
      // 2) 静止时，若小时发生变化仅在该时区稳定超过 600ms 或跨分钟更新时提交；
      const throttle = touch.isDragging ? 150 : 1000;
      if ((now - page.lastTimeUpdate > throttle) || page.lastTimeUpdate === 0) {
        page.lastTimeUpdate = now;
        const dt = new Date(now);
        // 基于当前时区格式化字符串，提供“仅到分钟”的格式在拖动时使用
        const timeStrFull = page.formatTime(dt, page.currentTZ ?? activeTZ); // 假定返回 HH:mm:ss 或 HH:mm
        const timeStrMinute = page.formatTime(dt, page.currentTZ ?? activeTZ)?.replace(/^(\d{2}:\d{2}).*$/, '$1');

        let nextStr = timeStrFull;
        if (touch.isDragging) {
          nextStr = timeStrMinute; // 拖动时固定到分钟
        } else {
          // 静止时的小时位稳定：如果小时变化但秒/分钟变化未跨界，延迟到 600ms 稳定后再显示
          const prev = page.data.currentTime;
          if (prev && timeStrFull && prev.slice(0,2) !== timeStrFull.slice(0,2)) {
            // 仅在稳定期后允许小时变化显示
            if ((now - (page._lastHourChangeAt || 0)) < 600) {
              nextStr = prev.slice(0,5); // 维持旧小时，显示到分钟
            } else {
              page._lastHourChangeAt = now;
            }
          }
        }

        if (nextStr && nextStr !== page.data.currentTime) {
          page.setData({ currentTime: nextStr });
        }
      }

      // 光照方向：普通模式从相机正面打光；禅模式从屏幕右侧打太阳光
      if (zenActive) {
        const d = camera.position.length();
        // 关键调整：将光源位置的 Y/Z 锚定到“地球球心”（世界坐标），只在 +X 方向偏移。
        // 这样 lightDir = dirLight.position - center 的纵向分量为 0，实现“与地心水平一致”。
        const center = new THREE.Vector3();
        globeGroup.getWorldPosition(center);
        dirLight.position.set(center.x + Math.max(1, d), center.y, center.z);
      } else {
        dirLight.position.copy(camera.position); // 普通模式：从相机正面打光
      }
      // —— 惯性旋转：在非拖拽时，继续以衰减速度旋转
      if (!touch.isDragging && !touch.pinch) {
        // 若存在飞行/禅定动画，优先按照动画推进角度；动画期间抑制惯性
        if (__zenAnim) {
          const { t0, dur, from, to } = __zenAnim;
          const t = Math.max(0, Math.min(1, (now - t0) / Math.max(1, dur)));
          const ease = (x) => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2; // easeInOutCubic
          const k = ease(t);
          tiltZ = from.tiltZ + (to.tiltZ - from.tiltZ) * k;
          const nx = from.rotX + (to.rotX - from.rotX) * k;
          const nzm = from.zoom + (to.zoom - from.zoom) * k;
          // 禅定位移：按补间推进 Y 位置
          if (globeGroup && from.posY !== undefined && to.posY !== undefined) {
            const ny = from.posY + (to.posY - from.posY) * k;
            globeGroup.position.y = ny;
          }
          touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, nx));
          const newZoom = clampZoom(nzm);
          if (Math.abs(newZoom - zoom) > 1e-6) { zoom = newZoom; updateCamDist(camera, baseDist, zoom); }
          touch.velX = 0; touch.velY = 0;
          if (t >= 1) {
            const next = __zenAnim.next;
            const after = __zenAnim.after;
            if (next && next.from && next.to && next.dur) {
              next.t0 = Date.now();
              __zenAnim = next;
            } else {
              __zenAnim = null;
              // 禅定动画完全结束：打点稳定时间戳
              zenStableSince = now;
              try { if (typeof after === 'function') after(); } catch(_){}
            }
          }
        } else if (__fly) {
          const { sx, sy, tx, ty, t0, dur } = __fly;
          const t = Math.max(0, Math.min(1, (now - t0) / Math.max(1, dur)));
          // easeInOutCubic（更优雅的缓动）
          const ease = (x) => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2;
          const k = ease(t);
          const nx = sx + (tx - sx) * k;
          const ny = sy + (ty - sy) * k;
          touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, nx));
          touch.rotY = ny;
          touch.velX = 0; touch.velY = 0; // 动画期间清零惯性
          if (t >= 1) { __fly = null; }
        } else {
          // 禅定模式稳定后自动缓慢转动：从左往右（增加 rotY）
          if (zenActive && !__zenAnim) {
            if (zenStableSince === 0) zenStableSince = now; // 首次进入稳定态打点
            const cfg = LIGHT_CFG.zen?.autoRotate;
            if (cfg?.enabled && (now - zenStableSince) >= (cfg.startDelayMs || 0)) {
              const w = (cfg.degPerSec || 0) * Math.PI / 180; // rad/s
              touch.rotY += w * dtSec;
            }
          }
          // 禅定前刹车（若存在请求）：在 1s 内平滑将速度衰减到 0，再进入禅定
          if (__zenBrake) {
            const t = Math.max(0, Math.min(1, (now - __zenBrake.t0) / Math.max(1, __zenBrake.dur)));
            const easeOut = 1 - Math.pow(1 - t, 3); // easeOutCubic
            const scale = Math.max(0, 1 - easeOut);
            touch.velX *= scale; touch.velY *= scale;
            if (t >= 1) {
              __zenBrake = null; touch.velX = 0; touch.velY = 0;
              try { if (INTERACTION_DEBUG_LOG) console.log('[zen] pre-stop done'); } catch(_){}
              if (__zenDelayEnter) { __zenDelayEnter = false; setZenMode(true); }
            }
          }
          if (Math.abs(touch.velX) > 0.0002 || Math.abs(touch.velY) > 0.0002) {
            touch.rotX += zenActive ? 0 : touch.velX; touch.rotY += touch.velY;
            touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, touch.rotX));
            touch.velX *= touch.damping; touch.velY *= touch.damping;
            // 诊断日志（节流）：观察惯性衰减过程是否执行
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
            } catch(_){}
          } else {
            // 速度极小时归零，避免长尾抖动
            touch.velX = 0; touch.velY = 0;
          }
        }
      }
      globeGroup.rotation.set(touch.rotX, touch.rotY, tiltZ);
      // 云层独立慢速旋转（可选）：不依赖整体自动旋转
      try {
        const spinDegSec = Number(APP_CFG?.cloud?.spinDegPerSec ?? 0);
        if (cloudMesh && cloudMesh.visible && spinDegSec !== 0) {
          cloudMesh.rotation.y += (spinDegSec * Math.PI / 180) * dtSec;
        }
      } catch(_){ }
      // 更新“飞行轨迹”透明度并在结束后清理（含淡入）
      try {
        if (__pathFx && __pathFx.mesh && __pathFx.mesh.material) {
          const age = now - (__pathFx.t0 || 0);
          const dur = Math.max(400, __pathFx.dur || 1000);
          const fadeStart = Math.min(dur * 0.6, dur - 220);
          let alpha = 0.6; // 常态显示透明度
          // 前 220ms 淡入
          if (age < 220) {
            const k = Math.max(0, Math.min(1, age / 220));
            alpha = 0.12 + 0.48 * k; // 0.12 → 0.6
          }
          if (age >= fadeStart) {
            const t = Math.max(0, Math.min(1, (age - fadeStart) / Math.max(1, (dur - fadeStart + 300))));
            alpha = 0.6 * (1 - t);
          }
          __pathFx.mesh.material.opacity = Math.max(0, Math.min(0.75, alpha));
          __pathFx.mesh.visible = alpha > 0.02;
          if (age > dur + 800) {
            try { globeGroup.remove(__pathFx.mesh); __pathFx.mesh.geometry?.dispose?.(); __pathFx.mesh.material?.dispose?.(); } catch(_){ }
            __pathFx = null;
          }
        }
      } catch(_){ }
      // 每帧向昼夜混合材质传入光线方向与球心世界坐标，保证终止线与地球倾角一致
      try {
        if (__dayNightMat) {
          const lightDir = new THREE.Vector3();
          if (dirLight) {
            // 使用“光源位置 - 地球球心”的方向（指向太阳），确保右侧为白天、左侧为夜晚
            const center = new THREE.Vector3();
            globeGroup.getWorldPosition(center);
            lightDir.copy(dirLight.position).sub(center).normalize();
          } else {
            lightDir.set(1, 0, 0);
          }
          __dayNightMat.uniforms.uLightDirWorld.value.copy(lightDir);

          const center = new THREE.Vector3();
          globeGroup.getWorldPosition(center);
          __dayNightMat.uniforms.uGlobeCenterWorld.value.copy(center);
          // 同步相机世界坐标，驱动 Shader 中的观察方向 V
          try { __dayNightMat.uniforms.uCameraPosWorld.value.copy(camera.position); } catch(_){}
          // 诊断：每帧同步 exposure/daySideGain（若在配置中调整，刷新即可观察是否生效）
          try {
            const cfg = LIGHT_CFG.zen || {};
            if (__dayNightMat.uniforms.uExposure && typeof cfg.exposure === 'number') {
              __dayNightMat.uniforms.uExposure.value = Math.min(2.5, Math.max(0.7, cfg.exposure));
            }
            if (__dayNightMat.uniforms.uDaySideGain && typeof cfg.daySideGain === 'number') {
              __dayNightMat.uniforms.uDaySideGain.value = Math.min(3.0, Math.max(0.7, cfg.daySideGain));
            }
            if (__dayNightMat.uniforms.uHighlightsRoll && typeof cfg.highlightsRoll === 'number') {
              __dayNightMat.uniforms.uHighlightsRoll.value = Math.max(0.0, Math.min(1.0, cfg.highlightsRoll));
            }
          } catch(_){}
        }
      } catch(_){}
      // 每帧更新大气壳体的球心/相机与参数（当前模式 normal/zen）
      try {
        if (atmosphereMesh && atmosphereMesh.material && atmosphereMesh.material.uniforms) {
          const u = atmosphereMesh.material.uniforms;
          const center = new THREE.Vector3(); globeGroup.getWorldPosition(center);
          try { u.uGlobeCenterWorld.value.copy(center); } catch(_){}
          try { u.uCameraPosWorld.value.copy(camera.position); } catch(_){}
          // 动态跟随当前主题参数（两种模式可对比）
          const a = (zenActive ? (APP_CFG?.zen?.atmosphere || {}) : (APP_CFG?.normal?.atmosphere || {}));
          const enabled = (a.enabled !== false);
          atmosphereMesh.visible = !!enabled;
          try {
            if (u.uIntensity) u.uIntensity.value = Math.max(0.0, Math.min(2.0, (a.intensity ?? (zenActive ? 0.18 : 0.12))));
            if (u.uPower) u.uPower.value = Math.max(0.1, Math.min(8.0, (a.power ?? (zenActive ? 2.2 : 2.0))));
            if (u.uColor) {
              const c = a.color || { r: 0.5, g: 0.8, b: 1.0 };
              const r = (typeof c.r === 'number') ? c.r : (Array.isArray(c) ? c[0] : 0.5);
              const g = (typeof c.g === 'number') ? c.g : (Array.isArray(c) ? c[1] : 0.8);
              const b = (typeof c.b === 'number') ? c.b : (Array.isArray(c) ? c[2] : 1.0);
              u.uColor.value.set(r, g, b);
            }
          } catch(_){}
        }
      } catch(_){}
      try { poetry3d?.update?.(now); } catch(_){}
      // 高亮淡出动画（0.5s）：逐帧降低不透明度，到期后移除并释放资源
      try {
        if (__highlightFadingGroup) {
          const fadeMs = Math.max(0, Number(APP_CFG?.highlight?.fadeOutMs || 500));
          const rest = Math.max(0, __highlightFadeEnd - now);
          const t = fadeMs > 0 ? (rest / fadeMs) : 0;
          __highlightFadingGroup.traverse(obj => {
            const m = obj?.material; if (!m) return;
            try {
              m.transparent = true;
              const base = (typeof m.opacity === 'number') ? m.opacity : 1.0;
              m.opacity = Math.max(0, Math.min(1, t * base));
              m.needsUpdate = true;
            } catch(_){ }
          });
          if (rest <= 0) {
            try { globeGroup.remove(__highlightFadingGroup); disposeGroup(__highlightFadingGroup); } catch(_){ }
            __highlightFadingGroup = null;
            __highlightFadeEnd = 0;
          }
        }
      } catch(_){ }
      // 自动取消选中：当选中国家在背面（前半球可见比例低于阈值）时，取消选中以避免穿模
      try {
        const ac = (APP_CFG?.highlight?.autoClearOnBackside || {});
        const enabled = !!ac.enabled;
        const interval = Math.max(200, Number(ac.checkIntervalMs || 500));
        const minVisible = Math.max(0.0, Math.min(1.0, Number(ac.minVisibleRatio || 0.10))); // 10% 可见 => 90% 背面
        if (enabled && __highlightFeature) {
          if ((now - __lastAutoClearCheck) >= interval) {
            __lastAutoClearCheck = now;
            const ratio = __estimateFeatureFrontRatio(__highlightFeature);
            if (ratio <= minVisible) { __belowThresholdCount++; } else { __belowThresholdCount = 0; }
            const requireStreak = Math.max(1, Number(ac.requireConsecutive || 2));
            if (__belowThresholdCount >= requireStreak) {
              setHighlight(null);
              try { page?.onCountryPicked?.(null); } catch(_){}
            }
          }
        }
      } catch(_){ }
      renderer.render(scene, camera);
      try { page?.onRenderTick?.() } catch (e) {}
      __prevRenderTime = now;
      __rafId = canvas.requestAnimationFrame(render);
    };
    render();

    // 主题切换：default（默认白昼）/ day8k（8K白昼）/ night（夜景）
    let currentTheme = 'default';
    const setTheme = (kind = 'default') => {
      try {
        currentTheme = (kind === 'day8k' || kind === 'night') ? kind : 'default';
        // 诊断日志：点击来源与贴图可用性
        try { console.log('[theme:set]', { kind, zenActive, hasDay: !!earthDayTex, hasDay8k: !!earthDay8kTex, hasNight: !!earthNightTex }); } catch(_){}
        // 禅模式期间不改变贴图（保持默认），退出后再应用
        if (zenActive) { try { console.warn('[theme:set] 在禅定模式中，保持默认贴图'); } catch(_){} return; }
        // 普通模式启用“禅材质”时：更新 Shader 的纹理/参数（含夜景纯夜策略）
        try {
          const wantShader = !!(APP_CFG?.normal?.useZenMaterial);
          const isShader = !!(earthMesh?.material && (earthMesh.material instanceof THREE.ShaderMaterial));
          if (wantShader && isShader && __dayNightMat && __dayNightMat.uniforms?.uDayTex) {
            const pureNight = !!(APP_CFG?.normal?.nightThemePure);
            if (currentTheme === 'night' && pureNight && earthNightTex) {
              // 进入纯夜视图：两侧都使用夜景纹理；暂存原白天纹理以便回退
              if (!__savedDayTexForShader) __savedDayTexForShader = __dayNightMat.uniforms.uDayTex.value || earthDayTex || earthDay8kTex;
              __dayNightMat.uniforms.uDayTex.value = earthNightTex;
              if (__dayNightMat.uniforms.uNightTex) __dayNightMat.uniforms.uNightTex.value = earthNightTex;
              // 夜景下曝光/增益微调（可选，避免过暗/过亮）
              try {
                const ncfg = APP_CFG?.normal || {};
                if (__dayNightMat.uniforms.uExposure && typeof ncfg.nightExposure === 'number') {
                  __dayNightMat.uniforms.uExposure.value = Math.min(2.5, Math.max(0.7, ncfg.nightExposure));
                }
                if (__dayNightMat.uniforms.uDaySideGain && typeof ncfg.nightDaySideGain === 'number') {
                  __dayNightMat.uniforms.uDaySideGain.value = Math.min(3.0, Math.max(0.7, ncfg.nightDaySideGain));
                }
              } catch(_){}
              __nightThemeActive = true;
              earthMesh.material.needsUpdate = true;
              try { console.info('[theme:set] shader night (pure)'); } catch(_){}
              return;
            }
            // 非夜景或关闭纯夜：恢复混合逻辑并按主题更新白天纹理
            const dayTexForTheme = (currentTheme === 'day8k' && earthDay8kTex) ? earthDay8kTex : earthDayTex;
            if (__nightThemeActive) {
              // 从纯夜回退：恢复夜景纹理为夜侧，白天纹理回到保存值或当前主题
              if (__dayNightMat.uniforms.uNightTex) __dayNightMat.uniforms.uNightTex.value = earthNightTex || __dayNightMat.uniforms.uNightTex.value;
              const restoreDay = dayTexForTheme || __savedDayTexForShader || __dayNightMat.uniforms.uDayTex.value;
              __dayNightMat.uniforms.uDayTex.value = restoreDay;
              __nightThemeActive = false;
              __savedDayTexForShader = null;
            } else {
              if (dayTexForTheme) {
                __dayNightMat.uniforms.uDayTex.value = dayTexForTheme;
                try { console.info('[theme:set] shader dayTex=', (currentTheme === 'day8k' ? '8k' : 'default')); } catch(_){}
              } else {
                try { console.warn('[theme:set] shader dayTex 缺失，保持原值'); } catch(_){}
              }
            }
            earthMesh.material.needsUpdate = true;
            return;
          }
        } catch(_){}
        if (!earthMesh) return; const m = earthMesh.material; if (!m) return;
        if (currentTheme === 'night' && earthNightTex) { m.map = earthNightTex; try { console.log('[theme:set] 使用夜景贴图'); } catch(_){} }
        else if (currentTheme === 'day8k' && earthDay8kTex) { m.map = earthDay8kTex; try { console.log('[theme:set] 使用 8K 白昼贴图'); } catch(_){} }
        else if (earthDayTex) { m.map = earthDayTex; try { console.log('[theme:set] 使用默认白昼贴图'); } catch(_){} }
        m.needsUpdate = true;
      } catch(err){ try { console.error('[theme:set] 异常', err); } catch(_){} }
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
            __starTargetOpacity = 0.0; // 拖动中隐藏星空以减负载
          }
        } else {
          // 恢复普通模式配置中的星空目标透明度
          try { __starTargetOpacity = (LIGHT_CFG?.normal?.starOpacity ?? 0.0); } catch(_){ __starTargetOpacity = 0.0; }
        }
      } catch(_){ }
    };

      // 禅定模式：进入/退出（动画+交互约束）
      const setZenMode = (on) => {
        const next = !!on;
        if (next === zenActive) return;
        if (next) {
          // 若当前存在惯性旋转，先进行 1s 刹车，再进入禅定
          const moving = (Math.abs(touch.velX) > 0.0002) || (Math.abs(touch.velY) > 0.0002) || !!touch.isDragging;
          if (moving && !__zenAnim) {
            __restore = { rotX: touch.rotX, rotY: touch.rotY, zoom, posY: globeGroup?.position?.y || 0 };
            __fly = null; // 关闭飞行动画以避免冲突
            __zenBrake = { t0: (__prevRenderTime || Date.now()), dur: (APP_CFG?.zen?.preStopMs ?? 1000) };
            __zenDelayEnter = true;
            try { if (INTERACTION_DEBUG_LOG) console.log('[zen] pre-stop start', __zenBrake.dur, 'ms'); } catch(_){}
            return;
          }
          __restore = { rotX: touch.rotX, rotY: touch.rotY, zoom, posY: globeGroup?.position?.y || 0 };
          __fly = null; // 关闭飞行动画以避免冲突
          // 目标 Y：在当前基础位置上叠加配置的向下偏移（比例相对 RADIUS）
          const offR = (LIGHT_CFG?.zen?.globeYOffsetR ?? -0.35);
          const targetY = (__restore.posY || 0) + (offR * RADIUS);
          // 使用上帧时间作为动画起点，避免刷新后首次进入因时间戳抖动导致补间跳跃
          __zenAnim = { t0: (__prevRenderTime || Date.now()), dur: (APP_CFG?.zen?.animMs ?? 1000), from: { rotX: touch.rotX, zoom, tiltZ, posY: __restore.posY }, to: { rotX: 0, zoom: ZEN_ZOOM, tiltZ: ZEN_TILT_RAD, posY: targetY } };
          // 延后启用 3D 诗句层：在动画结束时进行创建/启用，避免首帧阻塞
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
          // 确保“先倾斜再按赤道旋转”：进入时切换旋转顺序为 ZXY
          try {
            globeGroup.rotation.order = 'ZXY';
            // 旋转顺序切换后，基于当前四元数重建欧拉角，避免首帧“姿态跳变”
            const q = globeGroup.quaternion.clone();
            const e = new THREE.Euler().setFromQuaternion(q, 'ZXY');
            globeGroup.rotation.set(e.x, e.y, e.z);
          } catch(_){}
          zenActive = true;
          // 禅定进入：诗句层创建延后到动画完成，避免首帧阻塞（见 __zenAnim.after）
          // 禅定进入：星空淡入目标透明度（可在配置 LIGHT_CFG.zen.starOpacity 调整）
          try { __starTargetOpacity = (LIGHT_CFG?.zen?.starOpacity ?? 0.18); } catch(_){ __starTargetOpacity = 0.18; }
          if (STAR_LOG) { try { console.log('[star] zen enter: target', __starTargetOpacity); } catch(_){} }
          // 禅定：同步星点大小与亮度增益
          try {
            const zcfg = LIGHT_CFG?.zen || {};
            const u = starfield?.material?.uniforms || {};
            if (u.uSizeScale && typeof zcfg.starSizeScale === 'number') u.uSizeScale.value = zcfg.starSizeScale;
            if (u.uBrightnessGain && typeof zcfg.starBrightnessGain === 'number') u.uBrightnessGain.value = zcfg.starBrightnessGain;
            if (u.uBreathSpeed && typeof zcfg.starBreathSpeed === 'number') u.uBreathSpeed.value = zcfg.starBreathSpeed;
            if (u.uBreathStrength && typeof zcfg.starBreathStrength === 'number') u.uBreathStrength.value = zcfg.starBreathStrength;
            if (STAR_LOG) { try { console.info('[star] uniforms:zen', { sizeScale: u.uSizeScale?.value, gain: u.uBrightnessGain?.value }); } catch(_){} }
          } catch(_){}
          // 开启 15 秒的星呼吸诊断窗口（更容易观察禅模式下是否在呼吸）
          try { __breathDiagUntil = Date.now() + 15000; __breathLogNext = 0; } catch(_){}
          // 禅模式降低环境光以增强夜侧对比：如果想更强对比，把 0.4 改为 0.3
          // 禅模式强度：使用集中配置
          try { if (ambientLight) ambientLight.intensity = LIGHT_CFG.zen.ambientIntensity; } catch(_){}
          try { if (dirLight) dirLight.intensity = LIGHT_CFG.zen.dirLightIntensityRight; } catch(_){}
          // 禅定进入：重置稳定计时，等待动画结束后再开始自动旋转
          zenStableSince = 0;
          // 可选：如果仍觉得右侧不够亮，可在此提高太阳光强度，例如：dirLight.intensity = 1.6（如需恢复请在 after 回调中还原）
          // 禅模式保留赤道/回归线可见
          try { if (TROPIC_GROUP) TROPIC_GROUP.visible = true; } catch(_){}
          // 禅定下：边境线与赤道/回归线亮度调低（按配置乘因子）
          try {
            const ov = LIGHT_CFG.zen?.overlays || {};
            // 1) 国家边境线：降低颜色强度
            if (BORDER_GROUP) {
              const handled = new Set();
              BORDER_GROUP.traverse(obj => {
                const m = obj?.material; if (!m || handled.has(m)) return;
                handled.add(m);
                if (m.color) {
                  if (!m.userData.__origColor) m.userData.__origColor = m.color.clone();
                  const k = (ov.bordersColorFactor ?? 0.65);
                  const orig = m.userData.__origColor.clone();
                  m.color.copy(orig).multiplyScalar(Math.max(0, Math.min(2, k)));
                }
              });
            }
            // 2) 赤道/回归线：降低透明度（单独系数）
            if (TROPIC_GROUP) {
              TROPIC_GROUP.children.forEach((mesh, idx) => {
                const m = mesh?.material; if (!m) return;
                if (typeof m.opacity === 'number') {
                  if (m.userData.__origOpacity == null) m.userData.__origOpacity = m.opacity;
                  m.transparent = true;
                  const isEquator = (idx === 0);
                  const k = isEquator ? (ov.equatorOpacityFactor ?? 0.65) : (ov.tropicsOpacityFactor ?? 0.65);
                  const base = (m.userData.__origOpacity ?? m.opacity);
                  m.opacity = Math.max(0, Math.min(1, base * Math.max(0, Math.min(2, k))));
                }
              });
            }
          } catch(_){ }
          // 切换到昼夜平滑混合 ShaderMaterial（避免双球体导致空心）
          try {
            if (earthMesh && earthMesh.material) {
              __earthOldMat = earthMesh.material; // 记录旧材质以便退出时恢复
              const softness = (LIGHT_CFG.zen?.mixSoftness ?? 0.20);
              const gamma = (LIGHT_CFG.zen?.gamma ?? 1.0);
              // 根据当前主题选择禅模式右侧的“白天纹理”：day8k 优先，否则使用默认
              const dayTexForZen = (currentTheme === 'day8k' && earthDay8kTex) ? earthDay8kTex : earthDayTex;
              try { console.info('[zen] dayTexForZen=', (currentTheme === 'day8k' ? '8k' : 'default'), { hasDay: !!earthDayTex, hasDay8k: !!earthDay8kTex }); } catch(_){}
              __dayNightMat = createDayNightMaterial(THREE, dayTexForZen, earthNightTex, softness, gamma);
              // 进一步设置夜暗度、白天对比与混合曲线
              try {
                if (__dayNightMat?.uniforms) {
                  if (__dayNightMat.uniforms.uNightDarkness) __dayNightMat.uniforms.uNightDarkness.value = (LIGHT_CFG.zen?.nightDarkness ?? 0.85);
                  if (__dayNightMat.uniforms.uDayContrast) __dayNightMat.uniforms.uDayContrast.value = (LIGHT_CFG.zen?.dayContrast ?? 1.0);
                  if (__dayNightMat.uniforms.uMixPower) __dayNightMat.uniforms.uMixPower.value = (LIGHT_CFG.zen?.mixPower ?? 1.0);
                  if (__dayNightMat.uniforms.uDayNightContrast) __dayNightMat.uniforms.uDayNightContrast.value = (LIGHT_CFG.zen?.dayNightContrast ?? 1.0);
                  // 将“右侧太阳光强度”映射为白天侧增益，确保禅定右侧更亮
                  if (__dayNightMat.uniforms.uDaySideGain) {
                    const cfgGain = LIGHT_CFG.zen?.daySideGain;
                    const base = (dirLightBase || 1);
                    const target = (LIGHT_CFG.zen?.dirLightIntensityRight ?? base);
                    const fallbackGain = Math.max(1.0, Math.min(3.0, target / base));
                    __dayNightMat.uniforms.uDaySideGain.value = (cfgGain !== undefined)
                      ? Math.min(3.0, Math.max(0.7, cfgGain))
                      : fallbackGain;
                  }
                  // 整体曝光：优先使用配置项（更直接），否则按与普通模式的相对强度估算
                  if (__dayNightMat.uniforms.uExposure) {
                    const cfgExposure = LIGHT_CFG.zen?.exposure;
                    const base = (dirLightBase || 1);
                    const target = (LIGHT_CFG.zen?.dirLightIntensityRight ?? base);
                    const ratio = target / base;
                    const fallbackExposure = Math.max(1.0, Math.min(2.2, ratio * 1.15));
                    __dayNightMat.uniforms.uExposure.value = (cfgExposure !== undefined)
                      ? Math.min(2.5, Math.max(0.7, cfgExposure))
                      : fallbackExposure;
                  }
                  // 高光压缩：初始化设置（避免右侧“冲白”）；0 表示关闭
                  if (__dayNightMat.uniforms.uHighlightsRoll) {
                    __dayNightMat.uniforms.uHighlightsRoll.value = Math.max(0.0, Math.min(1.0, (LIGHT_CFG.zen?.highlightsRoll ?? 0.0)));
                  }
                  // 高光（Blinn-Phong）：同步 shininess/强度/颜色，并初始化相机位置
                  try {
                    const shininess = (LIGHT_CFG.earthMaterial?.shininess ?? 8);
                    if (__dayNightMat.uniforms.uShininess) __dayNightMat.uniforms.uShininess.value = Math.max(1.0, shininess);
                    if (__dayNightMat.uniforms.uSpecularStrength) __dayNightMat.uniforms.uSpecularStrength.value = Math.max(0.0, Math.min(2.0, (LIGHT_CFG?.zen?.specularStrength ?? 0.95)));
                    if (__dayNightMat.uniforms.uSpecularColor) { __dayNightMat.uniforms.uSpecularColor.value.set(1,1,1); }
                    if (__dayNightMat.uniforms.uSpecularUseTex) { __dayNightMat.uniforms.uSpecularUseTex.value = 0.0; }
                  if (__dayNightMat.uniforms.uCameraPosWorld) { __dayNightMat.uniforms.uCameraPosWorld.value.copy(camera.position); }
                  } catch(_){ }
                  // 诊断：确认禅定模式下辉光参数写入
                  try {
                    const a = (APP_CFG?.zen?.atmosphere || APP_CFG?.normal?.atmosphere || {});
                    const u = __dayNightMat.uniforms || {};
                    if (u.uAtmosphereDebugOnly) u.uAtmosphereDebugOnly.value = (a.debugOnly === true) ? 1.0 : 0.0;
                    console.info('[ATMOS(zen) uniforms set]', {
                      cfgIntensity: a.intensity,
                      cfgPower: a.power,
                      debugOnly: !!a.debugOnly,
                      setIntensity: Number(u.uAtmosphereIntensity?.value || 0).toFixed(3),
                      setPower: Number(u.uAtmospherePower?.value || 0).toFixed(3),
                      setDebugOnly: Number(u.uAtmosphereDebugOnly?.value || 0).toFixed(3),
                      setColor: {
                        r: Number(u.uAtmosphereColor?.value?.r ?? NaN).toFixed(3),
                        g: Number(u.uAtmosphereColor?.value?.g ?? NaN).toFixed(3),
                        b: Number(u.uAtmosphereColor?.value?.b ?? NaN).toFixed(3),
                      },
                    });
                  } catch(_){ }
                  // 更新：禅定模式下的大气辉光（Fresnel）参数
                  try {
                    const u = __dayNightMat.uniforms || {};
                    const a = (APP_CFG?.zen?.atmosphere || APP_CFG?.normal?.atmosphere || {});
                    const enabled = (a.enabled !== false);
                    if (u.uAtmosphereIntensity) u.uAtmosphereIntensity.value = enabled ? Math.max(0.0, Math.min(2.0, (a.intensity ?? 0.12))) : 0.0;
                    if (u.uAtmospherePower) u.uAtmospherePower.value = Math.max(0.1, Math.min(8.0, (a.power ?? 2.0)));
                    if (u.uAtmosphereColor) {
                      const c = a.color || { r: 0.5, g: 0.8, b: 1.0 };
                      const r = (typeof c.r === 'number') ? c.r : (Array.isArray(c) ? c[0] : 0.5);
                      const g = (typeof c.g === 'number') ? c.g : (Array.isArray(c) ? c[1] : 0.8);
                      const b = (typeof c.b === 'number') ? c.b : (Array.isArray(c) ? c[2] : 1.0);
                      u.uAtmosphereColor.value.set(r, g, b);
                    }
                  } catch(_){ }
                  // 诊断：输出关键 uniform 值与材质类型，确认是否为 ShaderMaterial 且参数生效
                  try {
                    const u = __dayNightMat.uniforms || {};
                    console.info('[ZEN uniforms]', {
                      matType: earthMesh?.material?.type,
                      isShader: (earthMesh?.material instanceof THREE.ShaderMaterial),
                      exposure: Number(u.uExposure?.value || 0).toFixed(3),
                      atmosIntensity: Number(u.uAtmosphereIntensity?.value || 0).toFixed(3),
                      atmosPower: Number(u.uAtmospherePower?.value || 0).toFixed(3),
                      atmosColor: {
                        r: Number(u.uAtmosphereColor?.value?.r ?? NaN).toFixed(3),
                        g: Number(u.uAtmosphereColor?.value?.g ?? NaN).toFixed(3),
                        b: Number(u.uAtmosphereColor?.value?.b ?? NaN).toFixed(3),
                      },
                      daySideGain: Number(u.uDaySideGain?.value || 0).toFixed(3),
                      nightDarkness: Number(u.uNightDarkness?.value || 0).toFixed(3),
                      dayContrast: Number(u.uDayContrast?.value || 0).toFixed(3),
                      highlightsRoll: Number(u.uHighlightsRoll?.value || 0).toFixed(3),
                      dayNightContrast: Number(u.uDayNightContrast?.value || 0).toFixed(3),
                      shininess: Number(u.uShininess?.value || 0).toFixed(3),
                      specularStrength: Number(u.uSpecularStrength?.value || 0).toFixed(3),
                    });
                    console.info('[ZEN lights]', {
                      dirLightIntensity: Number(dirLight?.intensity ?? NaN).toFixed(3),
                      ambientLightIntensity: Number(ambientLight?.intensity ?? NaN).toFixed(3),
                    });
                    dumpRendererInfo();
                  } catch(_){}
                }
              } catch(_){}
              earthMesh.material = __dayNightMat;
              earthMesh.material.needsUpdate = true;
              // 诊断：赋值后再打印一次，确认材质已切换为 ShaderMaterial
              try {
                console.info('[ZEN uniforms:postSwitch]', {
                  matType: earthMesh?.material?.type,
                  isShader: (earthMesh?.material instanceof THREE.ShaderMaterial),
                  exposure: Number(__dayNightMat?.uniforms?.uExposure?.value || 0).toFixed(3),
                  daySideGain: Number(__dayNightMat?.uniforms?.uDaySideGain?.value || 0).toFixed(3),
                });
                console.info('[ZEN lights:postSwitch]', {
                  dirLightIntensity: Number(dirLight?.intensity ?? NaN).toFixed(3),
                  ambientLightIntensity: Number(ambientLight?.intensity ?? NaN).toFixed(3),
                });
                dumpRendererInfo();
              } catch(_){}
            }
          } catch(_){}
        } else {
          // 禅定退出：星空淡出目标透明度
          try { __starTargetOpacity = (LIGHT_CFG?.normal?.starOpacity ?? 0.0); } catch(_){}
          if (STAR_LOG) { try { console.log('[star] zen exit: target', __starTargetOpacity); } catch(_){} }
          // 退出禅定：恢复 normal 配置下的星点大小与亮度增益
          try {
            const ncfg = LIGHT_CFG?.normal || {};
            const u = starfield?.material?.uniforms || {};
            if (u.uSizeScale && typeof ncfg.starSizeScale === 'number') u.uSizeScale.value = ncfg.starSizeScale;
            if (u.uBrightnessGain && typeof ncfg.starBrightnessGain === 'number') u.uBrightnessGain.value = ncfg.starBrightnessGain;
            if (u.uBreathSpeed && typeof ncfg.starBreathSpeed === 'number') u.uBreathSpeed.value = ncfg.starBreathSpeed;
            if (u.uBreathStrength && typeof ncfg.starBreathStrength === 'number') u.uBreathStrength.value = ncfg.starBreathStrength;
            if (STAR_LOG) { try { console.info('[star] uniforms:normal', { sizeScale: u.uSizeScale?.value, gain: u.uBrightnessGain?.value }); } catch(_){} }
          } catch(_){}
          // 退出禅模式分两段：先缩回默认（保持倾斜），再把倾斜回正
          __zenAnim = {
            t0: Date.now(), dur: 500,
            from: { rotX: touch.rotX, zoom, tiltZ, posY: globeGroup?.position?.y || 0 },
            to:   { rotX: 0,          zoom: 1.0, tiltZ, posY: (__restore?.posY || 0) },
            next: {
              dur: (APP_CFG?.zen?.exitMs ?? 700),
              from: { rotX: 0, zoom: 1.0, tiltZ, posY: (__restore?.posY || 0) },
              to:   { rotX: 0, zoom: 1.0, tiltZ: 0, posY: (__restore?.posY || 0) },
              after: () => {
                // 恢复普通模式旋转顺序与环境光
                try {
                  globeGroup.rotation.order = 'XYZ';
                  // 切回普通顺序时同理保持连续：按当前四元数重建欧拉角
                  const q = globeGroup.quaternion.clone();
                  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
                  globeGroup.rotation.set(e.x, e.y, e.z);
                } catch(_){}
                try { if (ambientLight) ambientLight.intensity = ambientBase; } catch(_){} // 恢复环境光
                try { if (dirLight) dirLight.intensity = dirLightBase; } catch(_){} // 恢复太阳光强度
                // 恢复边境线与赤道/回归线亮度（按进入时记录的原值）
                try {
                  if (BORDER_GROUP) {
                    const handled = new Set();
                    BORDER_GROUP.traverse(obj => {
                      const m = obj?.material; if (!m || handled.has(m)) return; handled.add(m);
                      if (m.color && m.userData.__origColor) { m.color.copy(m.userData.__origColor); }
                    });
                  }
                  if (TROPIC_GROUP) {
                    TROPIC_GROUP.children.forEach(mesh => {
                      const m = mesh?.material; if (!m) return;
                      if (m.userData.__origOpacity != null) { m.opacity = m.userData.__origOpacity; }
                    });
                  }
                } catch(_){ }
                // 恢复旧材质，关闭昼夜混合
                try {
                  if (earthMesh && __earthOldMat) {
                    earthMesh.material = __earthOldMat;
                    earthMesh.material.needsUpdate = true;
                    __dayNightMat = null;
                    __earthOldMat = null;
                  }
                } catch(_){}
              }
            }
          };
          // 退出后恢复自由旋转（立即解除禅限制）
          zenActive = false;
          // 禅定退出：关闭 3D 诗句层
          try { poetry3d?.setEnabled?.(false); poetry3d?.stop?.(); } catch(_){}
          try { if (TROPIC_GROUP) TROPIC_GROUP.visible = true; } catch(_){}
        }
      };

    // 渲染暂停/恢复控制与窗口尺寸适配
    const setPaused = (on) => { __paused = !!on; if (!__paused) { render(); } };
    // 向外暴露飞行动画：将视角旋转到指定的纬度/经度
    const flyTo = (lat, lon, duration = 800) => {
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
    const onWinResize = (evt) => {
      try {
        // 重新读取画布尺寸（避免仅依赖 windowWidth/Height）
        wx.createSelectorQuery().select('#gl').fields({ size: true }).exec(r => {
          const s = r && r[0];
          if (!s) return;
          // 加强健壮性：按系统窗口宽高进行限幅，规避视口单位异常引起的拉伸
          const sys2 = wx.getSystemInfoSync() || {};
          const wRaw = s.width, hRaw = s.height;
          const w = Math.max(1, Math.min(wRaw, sys2.windowWidth || wRaw));
          const h = Math.max(1, Math.min(hRaw, sys2.windowHeight || hRaw));
          if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
            try { renderer.setSize(w, h); } catch(_){ }
            try { camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); } catch(_){ }
            width = w; height = h; // 更新闭包变量
            if (state) { state.width = w; state.height = h; }
          }
        });
      } catch(_){ }
    };
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

    // 设置：惯性滑条映射（0-100）
    const setInertia = (pct) => {
      const v = Math.max(0, Math.min(100, Number(pct) || 0));
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

      state = { THREE, scene, renderer, globeGroup, camera, dirLight, earthMesh, COUNTRY_FEATURES, search, width, height, handlers: { onTouchStart, onTouchMove, onTouchEnd, setZoom, setNightMode, setTheme, setCloudVisible, setPaused, flyTo, nudgeCenter, setZenMode, startPoetry3D, stopPoetry3D, setInertia, setPerfMode }, page, onWinResizeCb: onWinResize, __cancelRaf: () => { try { canvas.cancelAnimationFrame(__rafId); } catch(_){ } __rafId = 0; }, __pauseFlagRef: () => __paused, __setHighlight: setHighlight };
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
export function setPerfMode(mode){ try { state?.handlers?.setPerfMode?.(mode); } catch(_){ } }
export function startPoetry3D(lines, conf){ try { state?.handlers?.startPoetry3D?.(lines, conf); } catch(_){} }
export function stopPoetry3D(){ try { state?.handlers?.stopPoetry3D?.(); } catch(_){} }
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