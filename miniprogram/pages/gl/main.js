// 交互/渲染/检索（入口）
// 拆分：geoindex（数据索引/候选集） + layers（场景/图层/渲染）

import { 
  convertLatLonToVec3,
  convertVec3ToLatLon,
  featureContains,
  normalizeLon
} from './geography.js';
import { loadCountries, buildIndex, gatherCandidates } from './geoindex.js';
import { getTextureUrl, prefetchTextureUrls } from './texture-source.js';
import { createScene, makeBorder, makeEquatorAndTropics, highlight as highlightLayer, updateCameraDistance as updateCamDist } from './layers.js';
import { INTERACTION_DEBUG_LOG } from './label-constants.js';
import { createDayNightMaterial } from './shaders/dayNightMix.glsl.js';
import { APP_CFG } from './config.js';
// 兼容旧引用名：保持 LIGHT_CFG 的别名，避免到处改动
const LIGHT_CFG = APP_CFG;

// 常量参数
const RADIUS = 1;
const MARGIN = 1.02;
const OFFSET_Y = -0.55;
const DEBUG = { lonSameSign: true, invertLon: false, invertLat: false, logFly: true, calibLonDeg: 0, calibLatDeg: 15 };
// 选择诊断：在点击命中时输出候选格子、首个命中、可能的多重命中
const DEBUG_SELECT = true; // 仅在 INTERACTION_DEBUG_LOG 开启时实际打印

// 状态容器
let state = null;

export function boot(page) {
  const sys = wx.getSystemInfoSync();
  wx.createSelectorQuery().select('#gl').fields({ node: true, size: true }).exec(res => {
    const hit = res && res[0];
    if (!hit || !hit.node) { console.error('[FAIL] canvas 节点未取到'); return; }

    const canvas = hit.node;
    const width = hit.width, height = hit.height;
    const dpr = sys.pixelRatio;

    // 创建场景/渲染器/相机/光照/球组
    const { THREE, renderer, scene, camera, dirLight, ambientLight, globeGroup, baseDist } = createScene(canvas, dpr, width, height);
    // 默认旋转顺序为 'XYZ'；禅模式将切换为 'ZXY'（先 Z 倾斜、后 Y 旋转）
    try { globeGroup.rotation.order = 'XYZ'; } catch(_){}

    // 统一缩放因子：通过调节相机与原点的距离来实现缩放
    let zoom = 1.0; // 1=默认视距，>1 更近（放大），<1 更远（缩小）
    const minZoom = 0.6, maxZoom = 2.86; // 放大极限提升约 30%
    const clampZoom = (z) => Math.max(minZoom, Math.min(maxZoom, z));
    updateCamDist(camera, baseDist, zoom);

    // 禅定模式状态：倾斜角、进入/退出动画、交互约束
    let zenActive = false;            // 当前是否处于禅定模式
    let tiltZ = 0;                    // 地球绕 Z 轴的倾斜角（弧度）
    let __zenAnim = null;             // { t0, dur, from:{rotX,zoom,tiltZ}, to:{rotX,zoom,tiltZ} }
    const ZEN_TILT_RAD = 23 * Math.PI / 180;  // 北极向左倾斜约 23°
    const ZEN_ZOOM = 0.74;                    // 更明显的 zoom-out（可按需微调）
    let __restore = { rotX: 0, rotY: 0, zoom: 1.0 }; // 退出禅定时恢复的视角
    // 应用集中配置的普通模式强度，并以此作为恢复基线
    try { if (ambientLight) ambientLight.intensity = LIGHT_CFG.normal.ambientIntensity; } catch(_){}
    try { if (dirLight) dirLight.intensity = LIGHT_CFG.normal.dirLightIntensity; } catch(_){}
    const ambientBase = LIGHT_CFG.normal.ambientIntensity; // 退出禅模式时恢复到此值
    const dirLightBase = LIGHT_CFG.normal.dirLightIntensity; // 退出禅模式时恢复到此值
    // 禅定稳定时间戳与上一帧时间（用于自动旋转）
    let zenStableSince = 0;
    let __prevRenderTime = 0;

    // PC 端滚轮缩放（DevTools/Windows/Mac）：优先绑到 canvas；不支持时回退到 document/window
    const wheelHandlers = [];
    const attachWheel = (target) => {
      if (!target || typeof target.addEventListener !== 'function') return false;
      const onWheel = (e) => {
        const dy = (typeof e.deltaY === 'number') ? e.deltaY : (typeof e.wheelDelta === 'number' ? -e.wheelDelta : 0);
        const step = dy > 0 ? -0.08 : 0.08;
        // 禅定模式下锁定缩放，忽略滚轮
        if (zenActive) { if (e.preventDefault) e.preventDefault(); return; }
        const newZoom = clampZoom(zoom + step);
        if (newZoom !== zoom) { zoom = newZoom; updateCamDist(camera, baseDist, zoom); }
        // 标记：该次滚轮已在渲染层处理，页面层的 scroll-view 事件应忽略，避免双触发
        try { page?.__markWheelHandled?.(); } catch(_){}
        if (e.preventDefault) e.preventDefault();
      };
      target.addEventListener('wheel', onWheel, { passive: false });
      target.addEventListener('mousewheel', onWheel, { passive: false });
      wheelHandlers.push(() => {
        try { target.removeEventListener('wheel', onWheel); } catch(_) {}
        try { target.removeEventListener('mousewheel', onWheel); } catch(_) {}
      });
      return true;
    };
    let wheelAttached = attachWheel(canvas);
    if (!wheelAttached) {
      wheelAttached = attachWheel(globalThis?.document);
    }
    if (!wheelAttached) {
      wheelAttached = attachWheel(globalThis?.window);
    }

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
    let earthNightTex = null;
    let __earthOldMat = null; // 禅模式切换材质时记录旧材质，退出恢复
    let __dayNightMat = null; // 昼夜混合 ShaderMaterial 引用（每帧更新 uniform）
    let COUNTRY_FEATURES = null;
    let BORDER_GROUP = null;
    let HIGHLIGHT_GROUP = null;
    let TROPIC_GROUP = null;
    let search = null; // { grid, cellSize, lonBuckets, latBuckets }

    const disposeGroup = (grp) => {
      if (!grp) return;
      grp.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    };
    const setHighlight = (f) => {
      if (HIGHLIGHT_GROUP) { disposeGroup(HIGHLIGHT_GROUP); globeGroup.remove(HIGHLIGHT_GROUP); HIGHLIGHT_GROUP = null; }
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
            tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 1; earthDayTex = tex;
          earthMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 48), new THREE.MeshPhongMaterial({ map: earthDayTex, shininess: (LIGHT_CFG.earthMaterial?.shininess ?? 8) }));
          earthMesh.name = 'EARTH'; globeGroup.add(earthMesh);
          // 普通模式装饰：赤道与南北回归线（淡金色）
          try { if (!TROPIC_GROUP) TROPIC_GROUP = makeEquatorAndTropics(THREE, globeGroup); } catch(_){}

          // 预加载夜景纹理（云端优先，失败回本地）
          getTextureUrl('earth_night').then(({ url: nightUrl, fallback: nightFb }) => {
            logSrc('earth_night', nightUrl, nightFb, 'start');
            loader.load(nightUrl, (night) => {
              night.minFilter = THREE.LinearFilter; night.magFilter = THREE.LinearFilter; earthNightTex = night;
            }, undefined, () => {
              try {
                const local = '/assets/textures/earth_night.webp';
                logSrc('earth_night', local, local, 'fallback');
                loader.load(local, t => { earthNightTex = t; });
              } catch(_){}
            });
          });
          // 预创建云层球（默认隐藏；云端优先，失败回本地）
          getTextureUrl('cloud').then(({ url: cloudUrl, fallback: cloudFb }) => {
            logSrc('cloud', cloudUrl, cloudFb, 'start');
            loader.load(cloudUrl, (cloudTex) => {
              cloudTex.minFilter = THREE.LinearFilter; cloudTex.magFilter = THREE.LinearFilter;
              const cloudMat = new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.42, depthWrite: false });
              cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS + 0.012, 64, 64), cloudMat);
              cloudMesh.name = 'CLOUD'; cloudMesh.visible = false; globeGroup.add(cloudMesh);
            }, undefined, () => {
              try {
                const local = '/assets/textures/cloud.webp';
                logSrc('cloud', local, local, 'fallback');
                loader.load(local, tex => { const cloudMat = new THREE.MeshPhongMaterial({ map: tex, transparent: true, opacity: 0.42, depthWrite: false }); cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS + 0.012, 64, 64), cloudMat); cloudMesh.name = 'CLOUD'; cloudMesh.visible = false; globeGroup.add(cloudMesh); });
              } catch(_){}
            });
          });

          loadCountries().then((features) => {
            COUNTRY_FEATURES = features;
            BORDER_GROUP = makeBorder(THREE, globeGroup, COUNTRY_FEATURES);
            search = buildIndex(features);
            // 通知页面国家数据已加载，便于构建标签基础数据
            try { page?.onCountriesLoaded?.(features); } catch (e) { /* noop */ }
          });
        }, undefined, () => {
          try {
            const local = '/assets/textures/earth.jpg';
            logSrc('earth_day', local, local, 'fallback');
            loader.load(local, (tex) => {
              tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 1; earthDayTex = tex;
              earthMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 48), new THREE.MeshPhongMaterial({ map: earthDayTex, shininess: 8 }));
              earthMesh.name = 'EARTH'; globeGroup.add(earthMesh);
              try { if (!TROPIC_GROUP) TROPIC_GROUP = makeEquatorAndTropics(THREE, globeGroup); } catch(_){}
              // 回退路径：同样加载国家特征并通知页面，保证标签重建
              try {
                loadCountries().then((features) => {
                  COUNTRY_FEATURES = features;
                  BORDER_GROUP = makeBorder(THREE, globeGroup, COUNTRY_FEATURES);
                  search = buildIndex(features);
                  try { page?.onCountriesLoaded?.(features); } catch (e) { /* noop */ }
                });
              } catch(_){ }
            });
          } catch(_){}
        });
      })
      .catch(() => {
        // getTextureUrl 失败时的兜底（本地）
        try {
          const local = '/assets/textures/earth.jpg';
          logSrc('earth_day', local, local, 'fallback');
          loader.load(local, (tex) => {
            tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 1; earthDayTex = tex;
            earthMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 48), new THREE.MeshPhongMaterial({ map: earthDayTex, shininess: 8 }));
            earthMesh.name = 'EARTH'; globeGroup.add(earthMesh);
            try { if (!TROPIC_GROUP) TROPIC_GROUP = makeEquatorAndTropics(THREE, globeGroup); } catch(_){}
            // 兜底路径也加载国家特征，保持与正常路径一致
            try {
              loadCountries().then((features) => {
                COUNTRY_FEATURES = features;
                BORDER_GROUP = makeBorder(THREE, globeGroup, COUNTRY_FEATURES);
                search = buildIndex(features);
                try { page?.onCountriesLoaded?.(features); } catch (e) { /* noop */ }
              });
            } catch(_){ }
          });
        } catch(_) {}
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
      touch.velY = Math.max(-touch.maxSpeed, Math.min(touch.maxSpeed, touch.velY * 0.8 + stepY * 0.2));
      touch.velX = Math.max(-touch.maxSpeed, Math.min(touch.maxSpeed, zenActive ? 0 : (touch.velX * 0.8 + stepX * 0.2)));
      touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, zenActive ? 0 : touch.rotX));
    };

    const onTouchEnd = () => {
      if (touch.pinch) { touch.pinch = false; return; }
      const isTap = (Date.now()-touch.downTime)<=250 && Math.hypot(touch.lastX-touch.downX, touch.lastY-touch.downY)<=6;
      touch.isDragging = false; if (!isTap || !earthMesh || !search) return;
      raycaster.setFromCamera({ x: (touch.downX / width) * 2 - 1, y: -(touch.downY / height) * 2 + 1 }, camera);
      const inter = raycaster.intersectObject(earthMesh, true)[0];
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

      const steps = [12, 24, 48, 80];
      let hit = null;
      for (const k of steps) {
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
      }
      if (!hit) {
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
      const render = () => {
        if (__paused) return; // 暂停时不继续渲染与调度
        const now = Date.now();
        const dtSec = __prevRenderTime ? Math.max(0, Math.min(0.12, (now - __prevRenderTime) / 1000)) : 0;
        // 暴露飞行状态给标签系统（用于控制脉冲动画的启动时机）
        try { if (state) state.isFlying = !!__fly; } catch(_){}

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
          const computedTZ = (tzByCountry !== null && tzByCountry !== undefined)
            ? tzByCountry
            : (page.tzlookup?.(clat, clon) ?? null);
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
        dirLight.position.set(Math.max(1, d), 0, 0); // 禅模式：阳光从屏幕右侧照来（右白左黑）
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
          if (Math.abs(touch.velX) > 0.0002 || Math.abs(touch.velY) > 0.0002) {
            touch.rotX += zenActive ? 0 : touch.velX; touch.rotY += touch.velY;
            touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, touch.rotX));
            touch.velX *= touch.damping; touch.velY *= touch.damping;
          } else {
            // 速度极小时归零，避免长尾抖动
            touch.velX = 0; touch.velY = 0;
          }
        }
      }
      globeGroup.rotation.set(touch.rotX, touch.rotY, tiltZ);
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
          // 诊断：每帧同步 exposure/daySideGain（若在配置中调整，刷新即可观察是否生效）
          try {
            const cfg = LIGHT_CFG.zen || {};
            if (__dayNightMat.uniforms.uExposure && typeof cfg.exposure === 'number') {
              __dayNightMat.uniforms.uExposure.value = Math.min(2.5, Math.max(0.7, cfg.exposure));
            }
            if (__dayNightMat.uniforms.uDaySideGain && typeof cfg.daySideGain === 'number') {
              __dayNightMat.uniforms.uDaySideGain.value = Math.min(3.0, Math.max(0.7, cfg.daySideGain));
            }
          } catch(_){}
        }
      } catch(_){}
      renderer.render(scene, camera);
      try { page?.onRenderTick?.() } catch (e) {}
      __prevRenderTime = now;
      __rafId = canvas.requestAnimationFrame(render);
    };
    render();

    const setNightMode = (on) => {
      try {
        if (!earthMesh) return; const m = earthMesh.material; if (!m) return;
        if (on && earthNightTex) { m.map = earthNightTex; }
        else if (earthDayTex) { m.map = earthDayTex; }
        m.needsUpdate = true;
      } catch(_){}
    };
    const setCloudVisible = (on) => { try { if (cloudMesh) cloudMesh.visible = !!on; } catch(_){} };

      // 禅定模式：进入/退出（动画+交互约束）
      const setZenMode = (on) => {
        const next = !!on;
        if (next === zenActive) return;
        if (next) {
          __restore = { rotX: touch.rotX, rotY: touch.rotY, zoom };
          __fly = null; // 关闭飞行动画以避免冲突
          __zenAnim = { t0: Date.now(), dur: 1000, from: { rotX: touch.rotX, zoom, tiltZ }, to: { rotX: 0, zoom: ZEN_ZOOM, tiltZ: ZEN_TILT_RAD } };
          // 确保“先倾斜再按赤道旋转”：进入时切换旋转顺序为 ZXY
          try { globeGroup.rotation.order = 'ZXY'; } catch(_){}
          zenActive = true;
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
              __dayNightMat = createDayNightMaterial(THREE, earthDayTex, earthNightTex, softness, gamma);
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
                  // 诊断：输出关键 uniform 值与材质类型，确认是否为 ShaderMaterial 且参数生效
                  try {
                    const u = __dayNightMat.uniforms || {};
                    console.info('[ZEN uniforms]', {
                      matType: earthMesh?.material?.type,
                      isShader: (earthMesh?.material instanceof THREE.ShaderMaterial),
                      exposure: Number(u.uExposure?.value || 0).toFixed(3),
                      daySideGain: Number(u.uDaySideGain?.value || 0).toFixed(3),
                      nightDarkness: Number(u.uNightDarkness?.value || 0).toFixed(3),
                      dayContrast: Number(u.uDayContrast?.value || 0).toFixed(3),
                    });
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
              } catch(_){}
            }
          } catch(_){}
        } else {
          // 退出禅模式分两段：先缩回默认（保持倾斜），再把倾斜回正
          __zenAnim = {
            t0: Date.now(), dur: 500,
            from: { rotX: touch.rotX, zoom, tiltZ },
            to:   { rotX: 0,          zoom: 1.0, tiltZ },
            next: {
              dur: 700,
              from: { rotX: 0, zoom: 1.0, tiltZ },
              to:   { rotX: 0, zoom: 1.0, tiltZ: 0 },
              after: () => {
                // 恢复普通模式旋转顺序与环境光
                try { globeGroup.rotation.order = 'XYZ'; } catch(_){}
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
          const w = s.width, h = s.height;
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

      state = { THREE, scene, renderer, globeGroup, camera, dirLight, earthMesh, COUNTRY_FEATURES, search, width, height, handlers: { onTouchStart, onTouchMove, onTouchEnd, setZoom, setNightMode, setCloudVisible, setPaused, flyTo, nudgeCenter, setZenMode }, page, wheelHandlers, onWinResizeCb: onWinResize, __cancelRaf: () => { try { canvas.cancelAnimationFrame(__rafId); } catch(_){ } __rafId = 0; }, __pauseFlagRef: () => __paused, __setHighlight: setHighlight };
  });
}

export function teardown() {
  if (!state) return;
  // 移除滚轮监听，避免侧栏/页面残留
  const arr = state.wheelHandlers || [];
  for (const fn of arr) { try { fn(); } catch(_) {} }
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
export function setCloudVisible(on){ state?.handlers?.setCloudVisible?.(on); }
export function setPaused(on){ state?.handlers?.setPaused?.(on); }
export function flyTo(lat, lon, duration){ state?.handlers?.flyTo?.(lat, lon, duration); }
export function setZenMode(on){ state?.handlers?.setZenMode?.(on); }
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