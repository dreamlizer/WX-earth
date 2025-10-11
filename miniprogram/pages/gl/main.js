// 交互/渲染/检索（入口）
// 拆分：geoindex（数据索引/候选集） + layers（场景/图层/渲染）

import { 
  convertLatLonToVec3,
  convertVec3ToLatLon,
  featureContains,
  normalizeLon
} from './geography.js';
import { loadCountries, buildIndex, gatherCandidates } from './geoindex.js';
import { createScene, makeBorder, highlight as highlightLayer, updateCameraDistance as updateCamDist } from './layers.js';

// 常量参数
const RADIUS = 1;
const MARGIN = 1.02;
const OFFSET_Y = -0.55;
const DEBUG = { lonSameSign: false };

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
    const { THREE, renderer, scene, camera, dirLight, globeGroup, baseDist } = createScene(canvas, dpr, width, height);

    // 统一缩放因子：通过调节相机与原点的距离来实现缩放
    let zoom = 1.0; // 1=默认视距，>1 更近（放大），<1 更远（缩小）
    const minZoom = 0.6, maxZoom = 2.2;
    const clampZoom = (z) => Math.max(minZoom, Math.min(maxZoom, z));
    updateCamDist(camera, baseDist, zoom);

    // PC 端滚轮缩放（DevTools/Windows/Mac 尝试绑定）
    if (typeof canvas.addEventListener === 'function') {
      const onWheel = (e) => {
        const dy = (typeof e.deltaY === 'number') ? e.deltaY : (typeof e.wheelDelta === 'number' ? -e.wheelDelta : 0);
        const step = dy > 0 ? -0.08 : 0.08;
        zoom = clampZoom(zoom + step);
        updateCamDist(camera, baseDist, zoom);
        if (e.preventDefault) e.preventDefault();
      };
      try {
        canvas.addEventListener('wheel', onWheel);
        canvas.addEventListener('mousewheel', onWheel);
      } catch (err) {
        console.warn('[wheel] attach failed:', err);
      }
    }

    // 触控状态：在 boot 作用域中维护，供渲染与事件逻辑使用
    const touch = {
      isPC: ['windows','mac','devtools'].includes(sys.platform),
      rotX: 0,
      rotY: 0,
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
      if (newZoom !== zoom) { zoom = newZoom; updateCamDist(camera, baseDist, zoom); }
    };
    if (typeof wx !== 'undefined') wx.__earthSetZoom = setZoom;

    // 资源与数据
    const raycaster = new THREE.Raycaster();
    let earthMesh = null;
    let COUNTRY_FEATURES = null;
    let BORDER_GROUP = null;
    let HIGHLIGHT_GROUP = null;
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

    // 纹理与数据加载
    new THREE.TextureLoader().load('../../assets/textures/earth.jpg', (tex) => {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 1;
      earthMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 48, 48), new THREE.MeshPhongMaterial({ map: tex, shininess: 8 }));
      earthMesh.name = 'EARTH'; globeGroup.add(earthMesh);
      loadCountries().then((features) => {
        COUNTRY_FEATURES = features;
        BORDER_GROUP = makeBorder(THREE, globeGroup, COUNTRY_FEATURES);
        search = buildIndex(features);
        // 通知页面国家数据已加载，便于构建标签基础数据
        try { page?.onCountriesLoaded?.(features); } catch (e) { /* noop */ }
      });
    });

    // 触控事件
    const onTouchStart = e => {
      const ts = e.touches || [];
      if (ts.length >= 2) {
        const d = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y);
        touch.pinch = true; touch.pinchStartDist = d; touch.pinchStartZoom = zoom;
        touch.isDragging = false;
        return;
      }
      const t = ts[0];
      touch.isDragging = true; touch.lastX = t.x; touch.lastY = t.y; touch.downX = t.x; touch.downY = t.y; touch.downTime = Date.now();
    };

    const onTouchMove = e => {
      const ts = e.touches || [];
      if (ts.length >= 2 && touch.pinch && typeof touch.pinchStartDist === 'number') {
        const d = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y);
        if (d > 0) {
          const ratio = d / touch.pinchStartDist;
          zoom = clampZoom(touch.pinchStartZoom * ratio);
          updateCamDist(camera, baseDist, zoom);
        }
        return;
      }
      const t = ts[0]; if (!t || !touch.isDragging) return;
      const dx = t.x - touch.lastX, dy = t.y - touch.lastY; touch.lastX = t.x; touch.lastY = t.y;
      const dxFactor = touch.isPC ? -1 : 1; const dyFactor = touch.isPC ? 1 : -1;
      touch.rotY -= dxFactor * dx * 0.005; touch.rotX += dyFactor * dy * 0.005; touch.rotX = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, touch.rotX));
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
      if (DEBUG.lonSameSign) lon = normalizeLon(-lon);

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

      setHighlight(hit);
      if (hit) {
        const name = hit.props?.NAME || hit.props?.ADMIN || '(unknown)';
        console.log('[select] country:', name, 'at', lon.toFixed(4), lat.toFixed(4));
        // 查询并显示 IANA 时区（先尝试国家覆盖，再回退 geo-tz）
        try {
          const override = getCountryOverride(hit);
          const tzName = (override !== null && override !== undefined)
            ? override // 如果覆盖返回的是分钟偏移，需映射到 IANA 名称；这里直接改为覆盖返回 IANA 名称更稳妥
            : (page.tzlookup?.(lat, lon));
          page.selectedTimezone = tzName ?? null;
          const tzLabel = (typeof tzName === 'string') ? tzName : '';
          page.setData({ hoverText: `${name || ''}${tzLabel ? ' ('+tzLabel+')' : ''}` });
          const now = Date.now();
          page.lastTimeUpdate = now;
          const timeStr = page.formatTime(new Date(now), tzName);
          if (timeStr && timeStr !== page.data.currentTime) {
            page.setData({ currentTime: timeStr });
          }
        } catch (err) {
          console.warn('[tzlookup] failed:', err);
          page.selectedTimezone = null;
          page.setData({ hoverText: `${name || ''}` });
          page.lastTimeUpdate = 0;
        }
      } else {
        console.log(`[select] no country at lon=${lon.toFixed(4)}, lat=${lat.toFixed(4)}`);
        page.selectedTimezone = null;
        page.setData({ hoverText: '' });
        page.lastTimeUpdate = 0; // 下一帧刷新中央经线时区
      }
    };

    // 渲染循环
    const render = () => {
      const now = Date.now();

      // 每帧计算当前应显示的时区：优先选中国家；否则使用屏幕中央经线时区（带稳定门槛）
      let activeTZ = page.selectedTimezone ?? null;
      if (!activeTZ && earthMesh) {
        try {
          const v = new THREE.Vector3(0, 0, RADIUS);
          v.applyEuler(new THREE.Euler(-touch.rotX, -touch.rotY, 0, 'XYZ'));
          const [clon, clat] = convertVec3ToLatLon(v.x, v.y, v.z);
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

      dirLight.position.copy(camera.position);
      globeGroup.rotation.set(touch.rotX, touch.rotY, 0);
      renderer.render(scene, camera);
      try { page?.onRenderTick?.() } catch (e) {}
      canvas.requestAnimationFrame(render);
    };
    render();

    state = { THREE, scene, renderer, globeGroup, camera, dirLight, earthMesh, COUNTRY_FEATURES, search, width, height, handlers: { onTouchStart, onTouchMove, onTouchEnd, setZoom }, page };
  });
}

export function teardown() {
  if (!state) return;
  state.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  state.renderer.dispose?.();
  state = null;
}

// 适配层直接调用以下导出以触发交互逻辑
export function onTouchStart(e){ state?.handlers?.onTouchStart?.(e); }
export function onTouchMove(e){ state?.handlers?.onTouchMove?.(e); }
export function onTouchEnd(e){ state?.handlers?.onTouchEnd?.(e); }
export function setZoom(z){ state?.handlers?.setZoom?.(z); }

// 调试开关导出：便于在 DevTools/控制台或适配层调用
export function setDebugFlags(flags){
  if (!flags || typeof flags !== 'object') return;
  if (typeof flags.lonSameSign === 'boolean') DEBUG.lonSameSign = flags.lonSameSign;
}
// 在小程序环境下挂到 wx 以便在控制台快速调用：wx.__earthSetDebugFlags({ lonSameSign: true/false })

export function getRenderContext() {
  if (!state) return null;
  return { THREE: state.THREE, camera: state.camera, width: state.width, height: state.height, globeGroup: state.globeGroup };
}