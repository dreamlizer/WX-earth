// 极薄适配层：页面生命周期与事件绑定，只转交给 main.js
import { boot, teardown, onTouchStart, onTouchMove, onTouchEnd, getRenderContext, setZoom, setNightMode, setTheme, setCloudVisible, getCountries, setPaused, flyTo, setDebugFlags, selectCountryByCode, setZenMode, startPoetry3D, stopPoetry3D, setInertia, setPerfMode as setGlPerfMode } from './main.js';
import { computeStartNearCenter, computeMove, nearbyFrom } from './poetry-motion.js';
import { APP_CFG } from './config.js';
import { formatTime as formatTimeUtil } from './time-utils.js';
import { ZenAudio } from './zen-audio.js';
import { POETRY_PRESETS } from './poetry-presets.js';
import { computeGmtOffsetStr as computeGmtOffsetStrUtil, buildCountryTitleSuffix } from './title-utils.js';
// 已迁移到 SearchManager：不再在页面层直接使用 buildSearchSuggestions
import { ZoomManager } from './zoom-manager.js';
import { normalizeToCanvasTouches } from './touch-utils.js';
import { PanelManager } from './panel-manager.js';
import { LabelsManager } from './labels-manager.js';
import { CountryInfoManager } from './country-info-manager.js';
import { computeCountryPanelTop, computeSafeTopFromSystemInfo } from './layout-utils.js';
// 预处理方案：不在小程序端做任何拼音转换（数据中已提供 pinyin_full / pinyin_initial）
// 避免直接 import JSON 在小程序里不被当作模块，改为 JS 导出
import countryMeta from './country_data.js';
import tzlookup from '../../libs/tz-lookup.js';
import { initLabels, updateLabels, setLabelsBudget, setForcedLabel, setForcedCityCountries, clearForcedCityCountries, setPerfMode as setLabelPerfMode } from './labels.js';
import { initCityMarkers, updateCityMarkers, disposeCityMarkers, highlightCityMarker, setCityMarkersVisible } from './city-markers.js';
import { ENABLE_CITY_LABELS, INTERACTION_DEBUG_LOG, LABELS_DEBUG_LOG, PERF_HIDE_MARKERS_ON_DRAG, PERF_HIDE_STAR_ON_ON_DRAG, PERF_DRAG_RESTORE_IDLE_MS } from './label-constants.js';
import { cities } from '../../assets/data/cities_data.js';
import { PoetryManager } from './poetry-manager.js';
import { SearchManager } from './search-manager.js';
import { ZenModeManager } from './zen-mode-manager.js';
import { LayoutManager } from './layout-manager.js';
import { SettingsManager } from './settings-manager.js';

// —— 数字格式化：跨端一致的千分位（避免部分手机不支持 toLocaleString 分组）
const formatThousandsInt = (n) => {
  try {
    const v = Math.round(Number(n));
    if (!isFinite(v)) return '--';
    // 优先 Intl，失败则回退正则分组
    try { return new Intl.NumberFormat('en-US').format(v); } catch(_){}
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  } catch(_){ return '--'; }
};
const formatThousandsFixed = (n, digits = 2) => {
  try {
    const v = Number(n);
    if (!isFinite(v)) return '--';
    const fixed = v.toFixed(digits);
    const parts = fixed.split('.');
    const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${int}.${parts[1]}` : int;
  } catch(_){ return '--'; }
};

Page({
  data: {
    currentTime: '--:--:--',
    hoverText: '',
    countryPanelTop: 0,
    // PC 端滚轮代理：scroll-view 的滚动位置维持为 0，避免视觉滚动
    scrollTop: 0,
    // UI 可见缩放值（与原 slider 双向同步）
    uiZoom: 1.0,
    // 由配置驱动的缩放边界，供底部 slider 使用
    uiZoomMin: (APP_CFG?.camera?.minZoom ?? 0.6),
    uiZoomMax: (APP_CFG?.camera?.maxZoom ?? 2.86),
    // PC 端判断与页面滚动锚点
    isPC: false,
    lastPageScrollTop: 0,
    pageScrollAnchor: 0,
    // 移除原有 DOM 标签数组，改为 Three.js 文本渲染
    // labels: [],
    // 语言与设置
    lang: 'zh', // zh/en
    settingsOpen: false,
    nightMode: false,
    theme: 'default', // default/day8k/night
    showCloud: false,
    labelQty: 'default', // none/few/default/many
    cityTier: 'key',
    // 设置面板运行时定位与尺寸（左对齐语言按钮、右对齐时间胶囊）
    settingsPanelLeft: 0,
    settingsPanelWidth: 320,
    // 惯性（0-100）：控制旋转阻尼与速度上限，默认 75%
  inertiaPct: 30,
    // 国家信息面板
    countryPanelOpen: false,
    countryInfo: null,
    // 面板淡出控制（禅定模式进入时 0.5s 退场）
    settingsFading: false,
    countryPanelFading: false,
    panelFadeMs: (APP_CFG?.ui?.panelFadeMs ?? 500),
    // 底部缩放条：可见性开关（不可见则不可用）
    showZoomBar: (APP_CFG?.ui?.showZoomBar ?? true),
    // 小标题多语言映射与当前标签集
    uiLabels: {
      zh: { capital: '首都', area: '面积', population: '人口', gdp: 'GDP' },
      en: { capital: 'Capital', area: 'Area', population: 'Population', gdp: 'GDP' }
    },
    labels: { capital: '首都', area: '面积', population: '人口', gdp: 'GDP' },
    // 与时间胶囊严格等宽：运行时测量得到的像素宽度
    countryPanelWidth: null,
    // 搜索面板
    searchOpen: false,
    searchQuery: '',
    suggestions: [],
    // 禅定模式开关（仅UI显隐与面板关闭，不改变渲染逻辑）
    zenMode: false,
    // 禅定诗句当前文本（进入禅定后循环显示）
    poetryFadeMs: 600,
    // 诗句字号（来自配置）
    poetryFontSizePx: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.fontSizePx)) ? Number(APP_CFG.poetry.fontSizePx) : 16,
    // 诗句移动与交替配置（从 config.js 读取并缓存，便于绑定与逻辑使用）
    poetryCrossfadeMs: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.crossfadeMs)) ? Number(APP_CFG.poetry.crossfadeMs) : 1000,
    poetryMovePxPerSec: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.movePxPerSec)) ? Number(APP_CFG.poetry.movePxPerSec) : 36,
    poetrySafeMarginPx: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.safeMarginPx)) ? Number(APP_CFG.poetry.safeMarginPx) : 18,
    // 下一句首字贴近上一句首字的最大距离（px）
    poetryNextStartMaxDistancePx: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.nextStartMaxDistancePx)) ? Number(APP_CFG.poetry.nextStartMaxDistancePx) : 20,
    poetryInitialCenterRatio: (APP_CFG && APP_CFG.poetry && Number(APP_CFG.poetry.initialCenterRatio)) ? Number(APP_CFG.poetry.initialCenterRatio) : 0.35,
    // 双层容器（A/B）用于句间交替与位移
    poetryA: { text: '', x: 0, y: 0, tx: 0, ty: 0, moveMs: 0, visible: false },
    poetryB: { text: '', x: 0, y: 0, tx: 0, ty: 0, moveMs: 0, visible: false },
    // 诗句残影层：由 _startPoetry 按配置生成，按偏移/透明度渲染
  // 移除拖影层：保留纯文字项以降低资源消耗
    // 云端音频 FileID（只走云端，不再回退本地）
    // 与贴图保持一致的 fileID 格式：cloud://<env>.<bucket>/path
    cloudZen1FileId: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/zen-1.aac',
    // 新上传的禅定音乐（preset2）：Zen-2.mp3 的云文件ID
    cloudZen2FileId: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/Zen-2.mp3',
    // 新增第三首禅定音乐（preset3）：Zen-3.mp3 的云文件ID（来自你的截图）
    cloudZen3FileId: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/Zen-3.mp3',
    // —— 彩蛋：时间胶囊感应区与 Special 文本展示 ——
    eggSensorVisible: false,
    eggSensorLeft: 0,
    eggSensorTop: 0,
    eggSensorWidth: 80,
    eggSensorHeight: 40,
    // Special 展示状态（水平排布、轻微放大、淡入/缓慢移动/淡出）
    specialVisible: false,
    specialText: '',
    specialFontSizePx: (APP_CFG && APP_CFG.poetry && APP_CFG.poetry.special && Number(APP_CFG.poetry.special.fontSizePx)) ? Number(APP_CFG.poetry.special.fontSizePx) : 36,
    // 淡入默认 1 秒（进入时）；淡出默认 2 秒（离开时）
    specialFadeMs: (APP_CFG && APP_CFG.poetry && APP_CFG.poetry.special && Number(APP_CFG.poetry.special.fadeInMs)) ? Number(APP_CFG.poetry.special.fadeInMs) : 1000,
    specialMoveMs: (APP_CFG && APP_CFG.poetry && APP_CFG.poetry.special && Number(APP_CFG.poetry.special.displayMs)) ? Number(APP_CFG.poetry.special.displayMs) : 10000,
    specialScale: 1.08,
    specialX: 0,
    specialY: 0,
    specialTx: 0,
    specialTy: 0,
  },

  // 页面滚动事件：用于 PC 端鼠标滚轮触发缩放
  onPageScroll(e) {
    if (!this.data.isPC) return;
    const dy = e.scrollTop - this.data.lastPageScrollTop;
    if (!dy) return;
    const k = -0.002; // 灵敏度：向下滚动缩小
    const next = this.data.uiZoom + dy * k;
    setZoom(next);
    this.setData({ uiZoom: next, lastPageScrollTop: e.scrollTop });
    // 重置回锚点，避免页面实际滚动
    wx.pageScrollTo({ scrollTop: this.data.pageScrollAnchor, duration: 0 });
  },

  // 接受 IANA 名称时，将时间格式化为 YYYY/MM/DD HH:mm:ss（24小时制）
  // 迁移至纯函数：保留包装方法以兼容 page.formatTime 调用
  formatTime(date, timeZone) {
    try { return formatTimeUtil(date, timeZone, this.data?.lang === 'zh' ? 'zh' : 'en'); }
    catch(e){ try { console.warn('[formatTime wrapper] failed:', e); } catch(_){} }
    return '--:--:--';
  },

  onLoad() {
    // 检测是否为 PC 端，初始化页面滚动锚点（用于滚轮兼容）
    try {
      const sys = wx.getSystemInfoSync();
      const isPC = /windows|mac/i.test(sys.platform || '') || sys.deviceType === 'pc' || sys.environment === 'devtools';
      try { this.__isDevtools = (sys && sys.environment === 'devtools'); } catch(_){}
      const anchor = 200;
      this.setData({ isPC, lastPageScrollTop: anchor, pageScrollAnchor: anchor });
      if (isPC) wx.pageScrollTo({ scrollTop: anchor, duration: 0 });
    } catch (e) {}
    boot(this);
    // 记录 canvas 在页面中的位置用于坐标转换（把 pageX/pageY 转成 canvas 内的 x/y）
    try {
      wx.createSelectorQuery().select('#gl').boundingClientRect().exec(res => {
        this.__canvasRect = res && res[0] ? res[0] : null;
      });
    } catch(_){ }
    // 依据设备像素比轻调标签预算，兼顾清晰度与性能
    try {
      const dpr = wx.getSystemInfoSync()?.pixelRatio || 1;
      // DPR 高则预算略降；保持保守值，避免突然卡顿
      const base = 22;
      const adjusted = dpr >= 3 ? Math.max(12, base - 8) : (dpr >= 2 ? Math.max(14, base - 6) : base);
      setLabelsBudget(adjusted);
    } catch(_){ }
    // 初始化时区查询器（geo-tz 返回 IANA 名称）
    this.tzlookup = tzlookup;
    this.selectedTimezone = null;
    this.lastTimeUpdate = 0;

    // 初始标签：等待渲染上下文就绪后再构建，避免早期 ctx 不存在导致不创建 Mesh
    const waitInit = () => {
      try {
        const ctx = getRenderContext();
        if (ctx && ctx.globeGroup && ctx.camera) {
          this.rebuildLabelsByLang(this.data.lang);
          // 首页默认强制显示中国国家标签（CHN），稍作延迟以确保标签 Mesh 已构建
          try { setTimeout(() => { try { setForcedLabel('CHN'); } catch(_){ } }, 80); } catch(_){ }
          return; // 完成一次构建
        }
      } catch(_){ }
      setTimeout(waitInit, 100);
    };
    waitInit();
    this._lastLabelsUpdate = 0;
    // 预加载云端数据：城市仍在 DevTools 跳过；诗句改为始终加载以支持 preset_3
    if (!this.__isDevtools) { this.preloadCitiesCloud(); }
    this.preloadPoetryCloud();
    // 预加载云端 Special 文本（彩蛋字符串）
    try { this.preloadSpecialCloud(); } catch(_){}
    // 首次加载：尝试将禅音频持久化保存到本地（管理器负责）
    try { this.__getZenMgr().ensureOffline(); } catch(_){}
    try { this.updateTopOffsets(); } catch(_){ }
    // 初始加载后测量一次设置面板左右边界
    try { setTimeout(() => { try { this.updateSettingsPanelFrame(); } catch(_){ } }, 50); } catch(_){ }
    // 首次测量时间胶囊感应区（并在窗口变化时刷新）
    try {
      setTimeout(() => { try { this.updateEggSensor(); } catch(_){ } }, 120);
      if (typeof wx.onWindowResize === 'function') {
        wx.onWindowResize(() => { try { this.updateEggSensor(); } catch(_){ } });
      }
    } catch(_){}
  },
  onReady(){
    // 首次渲染完成后测量时间胶囊宽度，确保国家面板等宽
    /* 已改为纯 CSS 等宽，无需测量 */
    // 始终暴露诊断/控制接口：避免受调试开关影响
    try {
      wx.setGlDebug = (flags) => { try { setDebugFlags(flags); console.log('[debug flags]', flags); } catch(_){ } };
      wx.nudgeCenter = (cfg) => { try { const dLat = Number(cfg?.lat||0), dLon = Number(cfg?.lon||0); nudgeCenter(dLat, dLon); console.log('[nudgeCenter call]', cfg); } catch(_){ } };
    } catch(_){}
    // 初始应用惯性滑条默认值，确保一进入就生效
    try { this.__getSettingsMgr().setInertia(this.data.inertiaPct); } catch(_){}
  },
  onUnload() { teardown(); },
  onShow() { try { setPaused(false); } catch(_){ } },
  onHide() { try { setPaused(true); } catch(_){ } },
  // 拖动丝滑：一旦检测到拖动，自动关闭所有面板（国家/搜索/设置），避免重绘与事件干扰
  onTouchStart(e){
    try { this.__dragClosedPanels = false; } catch(_){}
    // 拖动优先：若有面板打开，仅记录“待关闭”标记，不在本帧 setData
    try {
      this.__pendingPanelsClose = !!(this.data.countryPanelOpen || this.data.searchOpen || this.data.settingsOpen);
    } catch(_){}
    const ev = this.__normalizeToCanvasTouches(e);
    onTouchStart(ev);
    // 性能模式：拖动开始立即降载（标签预算下降、星空/城市光点按需隐藏）
    try {
      this.__perfDrag = true;
      setLabelPerfMode('drag');
      setGlPerfMode('drag');
      if (PERF_HIDE_MARKERS_ON_DRAG) setCityMarkersVisible(false);
    } catch(_){}
    try { clearTimeout(this.__perfRestoreTimer); } catch(_){}
  },
  onTouchMove(e){
    // 不在 move 阶段关闭面板，避免同步重排造成的顿挫
    // 仅把事件转交到渲染层，保持地球旋转的最高优先级
    const ev = this.__normalizeToCanvasTouches(e);
    onTouchMove(ev);
  },
  onTouchEnd(e){
    try { this.__dragClosedPanels = false; } catch(_){}
    const ev = this.__normalizeToCanvasTouches(e);
    onTouchEnd(ev);
    // 性能模式：拖动结束延时恢复，避免惯性尾段抖动
    try {
      const delay = Math.max(100, Number(PERF_DRAG_RESTORE_IDLE_MS || 500));
      clearTimeout(this.__perfRestoreTimer);
      this.__perfRestoreTimer = setTimeout(() => {
        try {
          this.__perfDrag = false;
          setLabelPerfMode('normal');
          setGlPerfMode('normal');
          if (PERF_HIDE_MARKERS_ON_DRAG) setCityMarkersVisible(true);
        } catch(_){}
      }, delay);
    } catch(_){}
    // 在本次交互结束后统一关闭已打开的面板（若标记存在），避免影响拖动流畅度
    try {
      if (this.__pendingPanelsClose) {
        this.setData({ countryPanelOpen: false, searchOpen: false, settingsOpen: false, hoverText: '' });
        try { this.updateTopOffsets(); } catch(_){}
        this.__pendingPanelsClose = false;
      }
    } catch(_){}
  },

  // —— 工具：把任意组件的触摸事件统一转换为 canvas 坐标系（x/y）
  __normalizeToCanvasTouches(e){
    try { return normalizeToCanvasTouches(e, this.__canvasRect); } catch(_){ return e; }
  },

  // —— 搜索：打开/关闭 & 输入/候选
  onToggleSearch(){
    // 已迁移：委托 SearchManager 管理搜索开关（删除旧页面逻辑）
    try { this.__getSearchMgr().toggle(!this.data.searchOpen); } catch(_){}
  },
  onCloseSearch(){
    // 已迁移：委托 SearchManager 关闭搜索并清理（删除旧页面逻辑）
    try { this.__getSearchMgr().close(); } catch(_){}
  },
  onSearchInput(e){
    // 已迁移：委托 SearchManager 处理输入与候选生成（删除旧页面逻辑）
    try { this.__getSearchMgr().input(e?.detail?.value || '', { features: this._features, citiesCloud: this._citiesCloud }); } catch(_){}
  },
  onPickSuggestion(e){
    // 已迁移：委托 SearchManager 执行飞行与联动（删除旧页面逻辑）
    try { const ds = e?.currentTarget?.dataset || {}; this.__getSearchMgr().pick({ lat: ds.lat, lon: ds.lon, type: ds.type, id: ds.id }); } catch(_){}
  },
  // 新增：选择后直接选中国家并打开面板，同时更新顶栏时区提示
  onPickSuggestionOpen(e){
    // 已迁移：委托 SearchManager 执行飞行与打开国家面板（删除旧页面逻辑）
    try { const ds = e?.currentTarget?.dataset || {}; this.__getSearchMgr().pickOpen({ lat: ds.lat, lon: ds.lon, type: ds.type, id: ds.id }); } catch(_){}
  },
  // —— 生成候选（已迁移到 SearchManager）
  // 搜索遮罩透传：与国家面板相同策略
  onSearchMaskTouchStart(e){
    return this.__getSearchMgr().maskTouchStart(e);
  },
  onSearchMaskTouchMove(e){
    return this.__getSearchMgr().maskTouchMove(e);
  },
  // —— 删除：__zhInitials / __toPinyinFull / __pinyinInitials（改为读取预处理字段）

  // 国家面板触摸：立即关闭面板，并把事件转交给渲染层（不阻挡旋转）
  onPanelTouchStart(e){
    return this.__getPanelMgr().panelTouchStart(e);
  },
  onPanelTouchMove(e){
    return this.__getPanelMgr().panelTouchMove(e);
  },

  // 遮罩层触摸：同样立即关闭并把事件转交到渲染层
  onMaskTouchStart(e){
    return this.__getPanelMgr().maskTouchStart(e);
  },
  onMaskTouchMove(e){
    return this.__getPanelMgr().maskTouchMove(e);
  },

  // 吃掉底部缩放条的触摸事件，避免冒泡到 WebGL canvas
  onCatchTouchMove(){ /* 吃掉事件即可 */ },

  // 已移除：PC 端滚轮缩放与滚轮处理标记（不再支持）

  // 原 slider 交互：拖动预览与释放确认（双向同步）
  onZoomChanging(e){ return this.__getZoomMgr().changing(e); },
  onZoomChange(e){ return this.__getZoomMgr().change(e); },
  onZoomPlus(){ return this.__getZoomMgr().plus(); },
  onZoomMinus(){ return this.__getZoomMgr().minus(); },

  // 每帧钩子：由 main.js 的 render 调用
  onRenderTick(){
    try {
      // 改为仅驱动 3D 文本文字可见性/透明度更新，不再 setData 到 WXML
      const now = Date.now();
      if (this.__perfDrag) {
        const last = this.__lastLabelUpdateAt || 0;
        const intervalMs = 80; // 拖动中：约 12.5fps 的降频
        if (!last || (now - last) >= intervalMs) {
          updateLabels();
          this.__lastLabelUpdateAt = now;
        }
      } else {
        updateLabels();
        this.__lastLabelUpdateAt = now;
      }
      // 城市淡点每帧更新：拖动时按需跳过（已通过 setCityMarkersVisible 隐藏）
      const ctx = getRenderContext();
      if (ctx && ctx.camera) {
        if (!this.__perfDrag || !PERF_HIDE_MARKERS_ON_DRAG) {
          updateCityMarkers(ctx.camera, now);
        }
      }
      // 动态线宽：根据缩放值让边境线在屏幕上保持纤细
      try {
        const z = Number(this.data.uiZoom || 1);
        const base = 0.003; // 可调基准宽度
        const newWidth = base / Math.max(0.001, z);
        if (typeof this.__lastBorderWidth !== 'number' || Math.abs(this.__lastBorderWidth - newWidth) > 1e-4) {
          const group = ctx && ctx.globeGroup;
          if (group) {
            group.traverse(obj => {
              const mat = obj && obj.material;
              const ro = mat && mat.userData && mat.userData.ro;
              // ro=20：普通边境线；ro=40：高亮描边
              if ((obj && obj.isLine) && mat && (ro === 20 || ro === 40)) {
                try { mat.linewidth = newWidth; } catch(_){ }
              }
            });
          }
          this.__lastBorderWidth = newWidth;
        }
      } catch(_){ }
    } catch (e) { /* noop */ }
  },
  // —— UI 交互：设置面板
  // 点击顶部“设定”按钮：关闭国家面板，打开设定面板（不再切换为关闭）
  onToggleSettings(){ return this.__getPanelMgr().toggleSettings(); },
  onCloseSettings(){ return this.__getPanelMgr().closeSettings(); },
  
  // 切换“禅定模式”按钮：进入/退出，仅控制 UI 显隐与面板关闭
  onToggleZenMode(){
    // 委托给禅定管理器：统一处理面板淡出、渲染层切换与音频/诗句
    try { return this.__getZenModeMgr().toggle(); } catch(_){}
    // 进入/退出后刷新感应区（若进入禅定则显示）
    try { setTimeout(() => { try { this.updateEggSensor(); } catch(_){} }, 80); } catch(_){}
  },

  // “切”按钮：后续用于切换音乐与诗句组合，这里先占位
  onToggleCut(){
    // 委托给禅定管理器：统一预设切换、音频/诗句启动与轻提示
    try { return this.__getZenModeMgr().toggleCut(); } catch(_){}
  },
  onToggleNight(e){ const on = !!(e?.detail?.value); this.setData({ nightMode: on }); setNightMode(on); },
  // 新增：主题三选按钮事件（白昼/默认/夜景）
  onSetTheme(e){
    const val = String(e?.currentTarget?.dataset?.val || 'default');
    const theme = (val === 'daylight') ? 'day8k' : (val === 'night' ? 'night' : 'default');
    this.setData({ theme, nightMode: (theme === 'night') });
    try { setTheme(theme); } catch(_) { setNightMode(theme === 'night'); }
  },
  onToggleCloud(e){ const on = !!(e?.detail?.value); return this.__getSettingsMgr().toggleCloud(on); },
  // 主题行右侧的云层按钮：单键切换（显示/隐藏与缓慢旋转）
  onTapCloudBtn(){
    try {
      const next = !this.data.showCloud;
      return this.__getSettingsMgr().toggleCloud(next);
    } catch(_){ }
  },
  // 小型开关按钮统一入口
  onToggleOption(e){
    const key = e?.currentTarget?.dataset?.key;
    const valStr = e?.currentTarget?.dataset?.val;
    const on = String(valStr) === 'true';
    return this.__getSettingsMgr().toggleOption({ key, on });
  },
  // ===== 禅定：音频播放（云端优先，本地回退）与诗句循环 =====
  __zenPreset: 1,
  __zenAudio: null,
  __poetryPresets: POETRY_PRESETS,
  /* 旧内联诗句预设保留参考，不再使用
    // poetry-1：先准备好（与 zen-1 搭配）。可按需调整显示顺序和时长。
    1: [
      // 原有六句：去除尾部句号
      { text: '天体运行，周而复始', duration: 7000 },
      { text: '星汉灿烂，若出其里', duration: 7000 },
      { text: '日月之行，若出其中', duration: 7000 },
      { text: '俯察品类之盛，仰观宇宙之大', duration: 8000 },
      { text: '寄蜉蝣于天地，渺沧海之一粟', duration: 8000 },
      { text: '此中有真意，欲辨已忘言', duration: 7000 },
      // 新增诗句（zen-1 对应），已移除尾部句号（保留问号）
      { text: '天地玄黄，宇宙洪荒', duration: 7000 },
      { text: '日月盈昃，辰宿列张', duration: 7000 },
      { text: '北辰高悬，众星共之', duration: 7000 },
      { text: '列星随旋，日月递炤', duration: 7000 },
      { text: '天高地迥，觉宇宙之无穷', duration: 7000 },
      { text: '日月安属，列星安陈？', duration: 7000 },
      { text: '星垂平野阔，月涌大江流', duration: 7000 },
      { text: '银汉迢迢，星河欲转', duration: 7000 },
      { text: '寥廓苍天，斗转星移', duration: 7000 },
      { text: '上下未形，何由考之？', duration: 7000 },
      { text: '冥昭瞢暗，谁能极之？', duration: 7000 },
      { text: '角宿未旦，曜灵安藏？', duration: 7000 },
      { text: '乾坤浩荡，日月昭昭', duration: 7000 },
      { text: '天旋地转，万物萧然', duration: 7000 },
      { text: '云汉昭回，日月光华', duration: 7000 },
      { text: '巡天遥看，一千河', duration: 7000 },
      { text: '浩浩乎，如冯虚御风', duration: 8000 },
      { text: '茫茫宇宙，渺渺太虚', duration: 7000 },
      { text: '周流六虚，无有止息', duration: 7000 },
      { text: '四方上下，谓之宇也', duration: 7000 }
    ],
    // poetry-2：占位（后续你上传 zen-2 后可替换具体诗句）
    2: [
      { text: '风起于青萍之末。', duration: 7000 },
      { text: '水落而石出。', duration: 7000 },
      { text: '山高月小，水落石出。', duration: 7000 }
    ]
  */

  // 云端拉取诗句集（按 preset 分组），存在则覆盖本地 __poetryPresets
  async preloadPoetryCloud(){
    // 本地预览或云能力不可用时直接跳过，避免控制台噪声
    if (APP_CFG?.cloud?.enabled === false || !(wx && wx.cloud && typeof wx.cloud.callFunction === 'function')) {
      try { console.warn('[poetry] 云能力不可用，跳过预加载'); } catch(_){}
      return;
    }
    const normalize = (arr) => {
      const map = {};
      for (const doc of (Array.isArray(arr) ? arr : [])) {
        const preset = Number(doc?.preset || 1);
        const lines = Array.isArray(doc?.lines) ? doc.lines
          .map(l => ({ text: String(l?.text || ''), duration: Number(l?.duration || 7000) }))
          .filter(x => x.text.length > 0) : [];
        if (lines.length) map[preset] = lines;
      }
      return map;
    };
    // 更稳健的错误处理：任何一步失败都继续尝试后续来源
    const safeCallFn = async (fnName) => {
      try {
        const { result } = await wx.cloud.callFunction({ name: fnName, data: { type: 'list' } });
        const arr = result && Array.isArray(result.data) ? result.data : [];
        return normalize(arr);
      } catch (e) {
        try { console.warn('[poetry] 云函数调用失败：', fnName, e); } catch(_){}
        return {};
      }
    };
    let source = '';
    let map = {};
    // 1) 主云函数
    map = await safeCallFn('poetrySets');
    if (Object.keys(map).length) { source = 'cloud-fn:poetrySets'; }
    // 2) 备用云函数名
    if (!Object.keys(map).length) {
      const m2 = await safeCallFn('poetrySetsV2');
      if (Object.keys(m2).length) { map = m2; source = 'cloud-fn:poetrySetsV2'; }
    }
    // 3) 直接读取数据库（无需云函数权限）
    if (!Object.keys(map).length && wx.cloud && wx.cloud.database) {
      try {
        const db = wx.cloud.database();
        const r = await db.collection('poetry_sets').limit(100).get();
        const arr = Array.isArray(r?.data) ? r.data : [];
        map = normalize(arr);
        if (Object.keys(map).length) { source = 'db:poetry_sets'; console.info('[poetry] 直接从数据库读取成功'); }
      } catch(dbErr){ try { console.warn('[poetry] 数据库直接读取失败：', dbErr); } catch(_){} }
    }
    // 4) 本地兜底 JSON
    if (!Object.keys(map).length) {
      try {
        const local = require('../../assets/data/poetry_sets.json');
        map = normalize(local);
        source = 'local:poetry_sets.json';
        console.warn('[poetry] 使用本地回退 JSON');
      } catch(_){ }
    }
    if (Object.keys(map).length) {
      this.__poetryPresets = { ...this.__poetryPresets, ...map };
      this.__poetrySource = source || this.__poetrySource || 'unknown';
      console.info(`[poetry] 载入 ${Object.keys(map).length} 组，来源：${this.__poetrySource}`);
      // 若仍缺少第三套，给出提示
      try {
        if (!Array.isArray(this.__poetryPresets[3]) || this.__poetryPresets[3].length === 0) {
          console.warn('[poetry] 未发现 preset_3，请检查云函数部署/数据库权限/环境ID');
        }
      } catch(_){}
    }
  },

  // 开发者工具辅助：将当前预设写入云端，便于从控制台快速更新
  async pushPoetryPresetToCloud(preset){
    try {
      const lines = this.__poetryPresets[preset] || [];
      const { result } = await wx.cloud.callFunction({ name: 'poetrySets', data: { type: 'upsert', preset, lines } });
      try { console.log('[poetry upsert]', result); } catch(_){}
    } catch(e){ try { console.warn('[poetry upsert] 失败：', e); } catch(_){} }
  },

  // —— 诗句移动/交替工具函数 ——
  __rand(min, max){ return min + Math.random() * (max - min); },
  __clamp(v, a, b){ return Math.max(a, Math.min(b, v)); },
  __getViewport(){
    try {
      // 减少弃用警告：优先使用新 API（存在时）
      if (typeof wx.getWindowInfo === 'function') return wx.getWindowInfo();
      // 次优：异步版本（保持同步返回需求，改用 Sync 回退）
      return wx.getSystemInfoSync();
    } catch(_) {
      return { windowWidth: 360, windowHeight: 640, safeArea: null };
    }
  },
  __measure(id){
    return new Promise(resolve => {
      try {
        const q = wx.createSelectorQuery();
        q.select(`#${id}`).boundingClientRect(rect => { resolve(rect || { width: 80, height: 160 }); }).exec();
      } catch(_) { resolve({ width: 80, height: 160 }); }
    });
  },
  _getLocalAudio(preset){
    // 策略调整：云端不可用则不播放，不再使用本地兜底
    return '';
    // 如需恢复本地兜底：
    // return preset === 1 ? '/assets/zen-1.aac' : '/assets/zen-2.mp3';
  },
  // —— 禅音频：模块化管理器（保持原有外部方法名） ——
  __zenAudioMgr: null,
  __getZenMgr(){
    if (!this.__zenAudioMgr) {
      this.__zenAudioMgr = new ZenAudio({ fileIds: { 1: this.data.cloudZen1FileId, 2: this.data.cloudZen2FileId, 3: this.data.cloudZen3FileId }, appCfg: APP_CFG });
    } else {
      // 每次调用时刷新 fileIDs，避免 data 改动后不一致
      this.__zenAudioMgr.updateFileIds({ 1: this.data.cloudZen1FileId, 2: this.data.cloudZen2FileId, 3: this.data.cloudZen3FileId });
    }
    return this.__zenAudioMgr;
  },
  // —— 搜索：模块化管理器（页面事件委托） ——
  __searchMgr: null,
  __getSearchMgr(){
    if (!this.__searchMgr) {
      this.__searchMgr = new SearchManager({
        setData: (obj) => this.setData(obj),
        updateTopOffsets: () => this.updateTopOffsets(),
        tzlookup: (lat, lon) => this.tzlookup?.(lat, lon),
        computeGmtOffsetStr: (tzName) => this.computeGmtOffsetStr(tzName),
        onCountryPicked: (feature) => this.onCountryPicked(feature),
        getFeatures: () => this._features || getCountries() || [],
        getLang: () => this.data?.lang || 'zh',
        normalizeToCanvasTouches: (e) => this.__normalizeToCanvasTouches(e),
        onTouchStart: (evt) => onTouchStart(evt),
        onTouchMove: (evt) => onTouchMove(evt),
        markPanelsPendingClose: () => { if (this.data.searchOpen) this.__pendingPanelsClose = true; },
        // 新增：提供保持城市强制高亮的时间窗口设置与最后强制ID记录
        setKeepCityForcedUntil: (ms) => { try { const d = Math.max(0, Number(ms||0)); this.__keepCityForcedUntil = (d > 0) ? (Date.now() + d) : 0; } catch(_){} },
        setLastForcedId: (id) => { try { this.__lastForcedId = id || null; } catch(_){} },
      });
    }
    return this.__searchMgr;
  },
  // —— 缩放：模块化管理器（页面事件委托） ——
  __zoomMgr: null,
  __getZoomMgr(){
    if (!this.__zoomMgr) {
      this.__zoomMgr = new ZoomManager(this);
    }
    return this.__zoomMgr;
  },
  // —— 面板：国家/设置面板与遮罩触控 ——
  __panelMgr: null,
  __getPanelMgr(){
    if (!this.__panelMgr) { this.__panelMgr = new PanelManager(this); }
    return this.__panelMgr;
  },
  // —— 设置管理器：统一处理夜间模式与云层显示 ——
  __settingsMgr: null,
  __getSettingsMgr(){
    if (!this.__settingsMgr) {
      this.__settingsMgr = new SettingsManager({
        setData: (obj) => this.setData(obj),
        updateTopOffsets: () => this.updateTopOffsets(),
        setNightMode: (on) => setNightMode(on),
        setCloudVisible: (on) => setCloudVisible(on),
        setInertia: (pct) => setInertia(pct),
      });
    }
    return this.__settingsMgr;
  },
  // —— 布局管理器：统一计算顶部偏移，减少页面内联逻辑 ——
  __layoutMgr: null,
  __getLayoutMgr(){
    if (!this.__layoutMgr) { this.__layoutMgr = new LayoutManager(this); }
    return this.__layoutMgr;
  },
  // —— 禅定模式管理器：负责进入/退出与面板淡出
  __zenModeMgr: null,
  __getZenModeMgr(){
    if (!this.__zenModeMgr) { this.__zenModeMgr = new ZenModeManager(this); }
    return this.__zenModeMgr;
  },
  __labelsMgr: null,
  __getLabelsMgr(){
    if (!this.__labelsMgr) { this.__labelsMgr = new LabelsManager(this); }
    return this.__labelsMgr;
  },
  __countryMgr: null,
  __getCountryMgr(){
    if (!this.__countryMgr) { this.__countryMgr = new CountryInfoManager(this); }
    return this.__countryMgr;
  },
  // —— 诗句播放：模块化管理器（保持原有外部方法名） ——
  __poetryMgr: null,
  __getPoetryMgr(){
    if (!this.__poetryMgr) {
      this.__poetryMgr = new PoetryManager({
        appCfg: APP_CFG,
        getViewport: () => this.__getViewport(),
        getCanvasRect: () => this.__canvasRect,
        measure: (id) => this.__measure(id),
        setData: (obj) => this.setData(obj),
        startPoetry3D,
        stopPoetry3D,
        computeStartNearCenterImpl: computeStartNearCenter,
        computeMoveImpl: computeMove,
        nearbyFromImpl: nearbyFrom
      });
    }
    return this.__poetryMgr;
  },
  // —— 彩蛋：时间胶囊感应区测量 ——
  updateEggSensor(){
    try {
      // 需求：可点击区域设置为“定”与“禅”两个按钮之间，且不越过它们的底边之上（一个长方形），保证不影响点击按钮。
      const margin = 6; // 与按钮保留最小间距
      const q = wx.createSelectorQuery();
      q.select('#timePill').boundingClientRect();
      q.select('.cut-btn').boundingClientRect();
      q.select('.zen-btn').boundingClientRect();
      q.exec(res => {
        try {
          const pill = res[0];
          const cutRect = res[1];
          const zenRect = res[2];
          if (!pill) return;
          // 左右边界：严格在“定”与“禅”按钮之间
          const leftBound = cutRect ? Math.round(cutRect.right) + margin : Math.round(pill.left);
          const rightBound = zenRect ? Math.round(zenRect.left) - margin : Math.round(pill.right);
          const width = Math.max(0, rightBound - leftBound);
          // 垂直边界：从工具栏上缘（用时间胶囊 top 近似）到两个按钮的底边之上
          const top = Math.max(0, Math.round(pill.top) - 4);
          const bottomEdge = Math.min(cutRect ? Math.round(cutRect.bottom) : top + 80, zenRect ? Math.round(zenRect.bottom) : top + 80) - margin;
          const height = Math.max(16, bottomEdge - top);
          // 若宽度过小（极端设备布局），回退为围绕时间胶囊但仍裁掉按钮左右区
          if (width < 20) {
            const tol = Number(APP_CFG?.poetry?.special?.tapTolerancePx) || 22;
            const left = Math.max(0, Math.round(pill.left) - tol);
            const right = Math.round(pill.right) + tol;
            const cutRight = cutRect ? Math.round(cutRect.right) + margin : left;
            const zenLeft = zenRect ? Math.round(zenRect.left) - margin : right;
            const leftSafe = Math.max(left, cutRight);
            const rightSafe = Math.min(right, zenLeft);
            const w2 = Math.max(0, rightSafe - leftSafe);
            const h2 = Math.max(16, (bottomEdge - top));
            return this.setData({ eggSensorLeft: leftSafe, eggSensorTop: top, eggSensorWidth: w2, eggSensorHeight: h2, eggSensorVisible: true });
          }
          // 应用：扩大为按钮之间且不覆盖按钮本身
          this.setData({ eggSensorLeft: leftBound, eggSensorTop: top, eggSensorWidth: width, eggSensorHeight: height, eggSensorVisible: true });
        } catch(_){ }
      });
    } catch(_){ }
  },
  // —— 彩蛋：8 次点击触发 Special 字符串展示 ——
  __eggTapCount: 0,
  __eggTapTimer: 0,
  __specialItems: null,
  __specialIdx: 0,
  async preloadSpecialCloud(){
    // 云端不可用时回退到单条本地字符串
    const fallback = ['你好，宇宙'];
    if (APP_CFG?.cloud?.enabled === false || !(wx && wx.cloud)) {
      this._specialItems = fallback; return;
    }
    try {
      // 直接读取数据库集合：Special
      const db = wx.cloud.database();
      const r = await db.collection('Special').limit(50).get();
      const arr = Array.isArray(r?.data) ? r.data : [];
      const texts = arr.map(d => String(d?.slogan || d?.string || d?.text || '')).filter(s => s.length > 0);
      this._specialItems = texts.length ? texts : fallback;
      try { console.info('[special] 加载', this._specialItems.length, '条'); } catch(_){}
    } catch(e){ this._specialItems = fallback; }
  },
  onEggTap(){
    try {
      if (!this.data.zenMode) return; // 仅禅定模式生效
      // 连续点击 8 次触发；超过 2 秒未继续点击则自动清零
      const now = Date.now();
      this.__eggTapCount = (this.__eggTapCount || 0) + 1;
      clearTimeout(this.__eggTapTimer);
      this.__eggTapTimer = setTimeout(() => { try { this.__eggTapCount = 0; } catch(_){} }, 2000);
      if (this.__eggTapCount >= 8) {
        this.__eggTapCount = 0;
        clearTimeout(this.__eggTapTimer);
        this.__triggerSpecial();
      }
    } catch(_){ }
  },
  async __triggerSpecial(){
    try {
      if (!Array.isArray(this._specialItems) || !this._specialItems.length) { await this.preloadSpecialCloud(); }
      const items = Array.isArray(this._specialItems) && this._specialItems.length ? this._specialItems : ['你好，宇宙'];
      const text = items[this.__specialIdx % items.length];
      this.__specialIdx++;
      // 旧诗句 1 秒淡出并停止循环计时器
      // 旧诗句淡出 2 秒（默认），随后停止循环计时器
      try { this.setData({ poetryFadeMs: Math.max(200, Number(APP_CFG?.poetry?.special?.fadeOutMs || 2000)), 'poetryA.visible': false, 'poetryB.visible': false }); } catch(_){}
      try { this.__poetryResumeIdx = (this.__getPoetryMgr().getIndex() || 0) + 1; } catch(_){ this.__poetryResumeIdx = 0; }
      try { this.__stopPoetryViaMgr(); } catch(_){}
      // 1 秒后展示 Special（与淡出长度对齐）
      const delayMs = Math.max(0, Number(APP_CFG?.poetry?.special?.fadeOutMs || 2000));
      setTimeout(() => { try { this.__showSpecial(text); } catch(_){} }, delayMs);
    } catch(_){ }
  },
  async __showSpecial(text){
    try {
      const cfg = (APP_CFG && APP_CFG.poetry && APP_CFG.poetry.special) ? APP_CFG.poetry.special : {};
      const fadeInMs = Number(cfg.fadeInMs || 1000);
      const displayMs = Number(cfg.displayMs || 10000);
      const moveSpeed = Number(cfg.movePxPerSec || 12);
      const margin = Number(APP_CFG?.poetry?.safeMarginPx || 18);
      const vp = this.__getViewport();
      const gl = this.__canvasRect;
      // 初始：设置文本、重置过渡为 0、不可见
      this.setData({ specialText: String(text || ''), specialVisible: false, specialMoveMs: 0 });
      // 等一帧以确保文本渲染后可测量尺寸
      await new Promise(r => setTimeout(r, 16));
      const rect = await this.__measure('specialText');
      const itemW = Math.max(1, rect?.width || 120);
      const itemH = Math.max(1, rect?.height || 40);
      const halfCanvasBottom = (gl && typeof gl.top === 'number' && typeof gl.height === 'number')
        ? (gl.top + gl.height * 0.5)
        : (vp.windowHeight * 0.5);
      const bounds = { minX: margin, minY: margin, maxX: vp.windowWidth - margin, maxY: Math.max(margin, Math.min(vp.windowHeight - margin, halfCanvasBottom)) };
      let start = computeStartNearCenter(vp.windowWidth, vp.windowHeight, itemW, itemH, bounds, (typeof cfg.upperCenterYRatio === 'number') ? cfg.upperCenterYRatio : 0.35);
      // 修正：computeStartNearCenter 返回的是“左上角”坐标；为让文本整体围绕中心，需将起始点左移 itemW/2、上移 itemH/2
      start.x = Math.max(bounds.minX, Math.min(bounds.maxX - itemW, start.x - itemW * 0.5));
      start.y = Math.max(bounds.minY, Math.min(bounds.maxY - itemH, start.y - itemH * 0.5));
      // 保持在上半区的“中间偏上”
      start.y = Math.min(start.y, bounds.maxY - itemH * 0.5);
      const move = computeMove(start, itemW, itemH, moveSpeed, displayMs, bounds);
      // Phase1：定位到起点，先应用过渡但不立即可见，避免首帧“闪出”
      this.setData({ specialX: start.x, specialY: start.y, specialTx: 0, specialTy: 0, specialMoveMs: 0, specialFadeMs: fadeInMs, specialScale: 1.08, specialVisible: false });
      await new Promise(r => setTimeout(r, 16));
      // Phase1.5：单独切换为可见，让淡入更自然
      this.setData({ specialVisible: true });
      await new Promise(r => setTimeout(r, 16));
      // Phase2：开启移动过渡时长
      this.setData({ specialMoveMs: displayMs });
      await new Promise(r => setTimeout(r, 16));
      // Phase3：设置目标位移与轻微缩放（保持视觉张力）
      this.setData({ specialTx: move.tx, specialTy: move.ty });
      // 显示期结束后淡出，并在淡出完成后恢复诗句循环
      clearTimeout(this.__specialTimer);
      this.__specialTimer = setTimeout(() => {
        try {
          const outMs = Number(cfg.fadeOutMs || 2000);
          // 先更新过渡时长，下一帧再切不可见，避免“闪没”
          this.setData({ specialFadeMs: outMs });
          setTimeout(() => { try { this.setData({ specialVisible: false }); } catch(_){ } }, 16);
          // 淡出完成后接续播放
          setTimeout(() => { try { this.__startPoetryViaMgr(this.__zenPreset || 1, this.__poetryResumeIdx || 0); } catch(_){} }, outMs);
        } catch(_){ }
      }, displayMs);
    } catch(_){ }
  },
  async _startZenAudio(preset){
    try { await this.__getZenMgr().ensureOffline(); } catch(_){}
    try { await this.__getZenMgr().start(preset || 1, this._getLocalAudio(preset || 1)); } catch(_){}
  },
  _stopZenAudio(fadeMs){
    try {
      const mgr = this.__getZenMgr();
      const ms = Number(fadeMs || 0);
      if (ms > 0 && typeof mgr.fadeOutStop === 'function') { mgr.fadeOutStop(ms); }
      else { mgr.stop(); }
    } catch(_){}
  },
  // 委托给 PoetryManager 的包装方法（逐步迁移使用）
  async __startPoetryViaMgr(preset, startIdx){
    try {
      const p = Number(preset) || 1;
      // 惰性拉取：若目标预设不存在或为空，先尝试云端加载一次
      const has = Array.isArray(this.__poetryPresets?.[p]) && this.__poetryPresets[p].length > 0;
      if (!has) {
        try { await this.preloadPoetryCloud(); } catch(_){ }
      }
      this.__getPoetryMgr().start(p, this.__poetryPresets, Number(startIdx || 0));
    } catch(_){ }
  },
  __stopPoetryViaMgr(){ try { this.__getPoetryMgr().stop(); } catch(_){ } },
  _startPoetry(preset){
    try { this.__startPoetryViaMgr(preset); } catch(_){}
  },
  // 已移除：拖影与描边样式的动态生成（避免运行时开销）
  _stopPoetry(){
    try { this.__stopPoetryViaMgr(); } catch(_){}
  },
  onSetLabelQty(e){
    return this.__getLabelsMgr().onSetLabelQty(e);
  },
  // 设置面板：惯性滑条事件（0-100）
  onSetInertia(e){
    const val = Number(e?.detail?.value ?? e?.detail ?? 0);
    const pct = Math.max(0, Math.min(100, Math.round(val)));
    this.__getSettingsMgr().setInertia(pct);
  },
  // 拖动中即时更新惯性，便于“边拖边感受”
  onInertiaChanging(e){
    const val = Number(e?.detail?.value ?? e?.detail ?? 0);
    const pct = Math.max(0, Math.min(100, Math.round(val)));
    this.__getSettingsMgr().setInertia(pct);
  },
  onSetCityTier(e){
    return this.__getLabelsMgr().onSetCityTier(e);
  },
  onToggleLang(){
    return this.__getLabelsMgr().onToggleLang();
  },
  rebuildLabelsByLang(lang, featuresArg){
    return this.__getLabelsMgr().rebuildLabelsByLang(lang, featuresArg);
    try {
      // 读取缓存或传入的国家特征，避免偶发 state 读取为空
      if (Array.isArray(featuresArg) && featuresArg.length) { this._features = featuresArg; }
      const features = (Array.isArray(featuresArg) && featuresArg.length)
        ? featuresArg
        : (Array.isArray(this._features) && this._features.length ? this._features : getCountries());
      if (Array.isArray(features) && features.length) {
        // 懒加载国家名映射（包含中英文），按 ISO_A3/A2 取值
        if (!this._countryDict) {
          try { this._countryDict = require('./country_data.js').default || require('./country_data.js'); } catch(_) { this._countryDict = null; }
        }
        const dict = this._countryDict || {};
        // 特例：修正美国/俄罗斯的标签放置坐标为本土中心
        const POS_OVERRIDES = {
          US: { lon: -98.8433, lat: 38.2847 },
          USA: { lon: -98.8433, lat: 38.2847 },
          RU: { lon: 105.0, lat: 61.0 },
          RUS: { lon: 105.0, lat: 61.0 },
          // 法国：将标签锚点上移到比利时下方（法国北部），避免与中部城市/山脉冲突
          FR: { lon: 2.8, lat: 49.0 },
          FRA: { lon: 2.8, lat: 49.0 },
        };
        const baseLabels = features.map((f, idx) => {
          const p = f.props || {};
          // 更稳的中英文选择：优先 *_EN/*_ZH，其次查字典，最后回退
          const code = String(p.ISO_A3 || p.ISO_A2 || p.ISO || '').toUpperCase();
          const fromDict = dict && code ? (dict[code] || dict[code.padStart(3,'0')]) : null;
          const nameEn = p.NAME_EN || p.ADMIN_EN || p.NAME_LONG_EN || (fromDict ? (fromDict.NAME_EN || fromDict.CAPITAL_EN) : null) || p.NAME || p.ADMIN || `#${idx}`;
          const nameZh = p.NAME_ZH || p.ADMIN_ZH || (fromDict ? (fromDict.NAME_ZH || fromDict.CAPITAL_ZH) : '');
          const name = (lang === 'zh') ? (nameZh || nameEn) : (nameEn || nameZh || `#${idx}`);
          const [minLon, minLat, maxLon, maxLat] = f.bbox || [-10,-10,10,10];
          let lon = (minLon + maxLon) / 2;
          let lat = (minLat + maxLat) / 2;
          if (POS_OVERRIDES[code]) { lon = POS_OVERRIDES[code].lon; lat = POS_OVERRIDES[code].lat; }
          const id = p.ISO_A3 || p.ISO_A2 || p.ISO || String(idx);
          return { id, text: name, isCity: false, lon, lat, area: Math.max(1, Math.log10((p.AREA || 5000))) };
        });
        // 可选：加入城市标签（基于 assets/cities_data.js）
        let cityLabels = [];
        // 优先使用云端城市数据；失败时回退到本地 assets
        const cloudCities = Array.isArray(this._citiesCloud) && this._citiesCloud.length ? this._citiesCloud : null;
        const srcCities = cloudCities || (Array.isArray(cities) ? cities : []);
        if (ENABLE_CITY_LABELS && Array.isArray(srcCities) && srcCities.length) {
          // 根据设定面板的三档过滤：none / key(仅1级) / more(1级+2级)
          const tier = this.data.cityTier || 'more';
          let filtered = srcCities;
          if (tier === 'none') {
            filtered = [];
          } else if (tier === 'key') {
            filtered = srcCities.filter(c => Math.round(Number(c.importance || 0)) === 1);
          } else {
            // more：包含 1 与 2，排除 0.5 等次要项
            filtered = srcCities.filter(c => Number(c.importance || 0) >= 1);
          }
          cityLabels = filtered.map((c, i) => {
            const text = (lang === 'zh') ? (c.name_zh || c.name_en || `City#${i}`) : (c.name_en || c.name_zh || `City#${i}`);
            const id = `CITY_${c.country_code || 'UNK'}_${c.name_en || text}`;
            const score = (typeof c.importance === 'number') ? (1.0 + c.importance) : 1.0;
            // 同步 Win 版策略：保留 importance 以便 LOD 逐级放开
            const importance = (typeof c.importance === 'number') ? Math.round(c.importance) : 1;
            return { id, text, isCity: true, lon: c.lon, lat: c.lat, score, importance, country: c.country_code || null };
          });
          try { if (INTERACTION_DEBUG_LOG) console.log(`[settings] 城市显示: ${tier}, labels=${cityLabels.length}`); } catch(_){}

          // 初始化城市淡点（与标签同源的过滤集）
          const ctx = getRenderContext();
          if (ctx && ctx.THREE && ctx.globeGroup) {
            initCityMarkers(ctx.THREE, ctx.globeGroup, filtered);
          }
        }
        const total = baseLabels.length + cityLabels.length;
        initLabels(baseLabels.concat(cityLabels));
        try { if (LABELS_DEBUG_LOG) console.info(`[labels rebuild] base=${baseLabels.length}, city=${cityLabels.length}, total=${total}`); } catch(_){}
      } else {
        // 特征未加载时仅提示一次，避免日志刷屏；等待 onCountriesLoaded 回调统一重建
        if (!this.__rebuildWarnedOnce) {
          try { if (LABELS_DEBUG_LOG) console.warn('[labels rebuild] features not ready yet; will rebuild after load'); } catch(_){ }
          this.__rebuildWarnedOnce = true;
        }
      }
    } catch (e) { console.warn('[labels rebuild] failed:', e); }
  },
  // 云端拉取城市数据（一次性缓存 + 回退）
  async preloadCitiesCloud(){
    return this.__getLabelsMgr().preloadCitiesCloud();
    if (!(wx && wx.cloud && typeof wx.cloud.callFunction === 'function')) {
      try { if (INTERACTION_DEBUG_LOG) console.warn('[cities] 云能力不可用，跳过预加载'); } catch(_){}
      this._citiesCloud = null;
      return;
    }
    try {
      const { result } = await wx.cloud.callFunction({ name: 'citiesFetch', data: { type: 'list' } });
      const arr = result && Array.isArray(result.data) ? result.data : [];
      if (arr.length) {
        // 归一化与缓存
        this._citiesCloud = arr.map(x => ({
          name_en: x.name_en || '',
          name_zh: x.name_zh || '',
          lat: Number(x.lat),
          lon: Number(x.lon),
          country_code: String(x.country_code || '').toUpperCase(),
          importance: typeof x.importance === 'number' ? x.importance : 1,
        })).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon));
        try { if (INTERACTION_DEBUG_LOG) console.log(`[cities] 云端加载 ${this._citiesCloud.length} 条`); } catch(_){}
        // 若标签已初始化，则按当前语言重建以纳入城市数据
        this.rebuildLabelsByLang(this.data.lang);
      }
    } catch (e) {
      // 云端不可用时静默回退至本地 cities
      try { if (INTERACTION_DEBUG_LOG) console.warn('[cities] 云端读取失败，回退本地：', e); } catch(_){}
      this._citiesCloud = null;
    }
  },
  // 开发者工具控制台调用：将本地 cities 数据分批写入云数据库（应急）
  async pushCitiesToCloudLocal(chunkSize = 200){
    try {
      const arr = (Array.isArray(cities) ? cities : []).map(x => ({
        name_en: x.name_en || '',
        name_zh: x.name_zh || '',
        lat: Number(x.lat),
        lon: Number(x.lon),
        country_code: String(x.country_code || '').toUpperCase(),
        importance: typeof x.importance === 'number' ? x.importance : 1,
      })).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon));
      let done = 0;
      for (let i = 0; i < arr.length; i += chunkSize) {
        const batch = arr.slice(i, i + chunkSize);
        const { result } = await wx.cloud.callFunction({ name: 'citiesImport', data: { type: 'bulkUpsert', items: batch } });
        done += batch.length;
        try { console.log(`[import] 已写入 ${done}/${arr.length}`, result); } catch(_){}
      }
      try { console.log('[import] 完成'); } catch(_){}
    } catch (e) { console.warn('[import] 失败：', e); }
  },
  onCountriesLoaded(features){
    // 改为统一委托 LabelsManager，集中管理标签重建
    return this.__getLabelsMgr().onCountriesLoaded(features);
  },
  // main.js 点选国家后触发：强行显示该国家的标签（直到用户取消选中）
  async onCountryPicked(hit){
    try { const mgr = this.__getCountryMgr(); if (mgr) return await mgr.onCountryPicked(hit); } catch(_){}
    try {
      // 空白点击：直接关闭面板并清除强制标签
      if (!hit) {
        setForcedLabel(null);
        try { this.__lastForcedId = null; this.__keepCityForcedUntil = 0; } catch(_){}
        try { clearForcedCityCountries(); } catch(_){}
        // 单一机制：国家面板关闭 → 时区胶囊也关闭
        try { this.onCloseCountryPanel?.(); }
        catch(_){ try { this.setData({ countryPanelOpen: false, hoverText: '' }); } catch(__){} }
        this.setData({ countryInfo: null });
        return;
      }
      const p = hit?.props || {};
      const codeRaw = p.ISO_A3 || p.ISO_A2 || p.ISO || p.CC || p.ISO2 || null;
      const code = (codeRaw ? String(codeRaw).toUpperCase() : null);
      // 若搜索城市触发了“保持城市高亮”的锁，则暂不覆盖强制标签，避免城市变小；否则正常高亮国家
      const lastForced = this.__lastForcedId || null;
      const keepCity = (Number(this.__keepCityForcedUntil || 0) > Date.now()) && (typeof lastForced === 'string') && /^CITY_/i.test(lastForced);
      if (!keepCity) {
        setForcedLabel(code || null);
        try { this.__lastForcedId = code || null; } catch(_){}
      }
      // 强制显示该国所有城市（兼容 A3/A2）
      try { setForcedCityCountries([code, p.ISO_A3, p.ISO_A2].filter(Boolean)); } catch(_){}
      // 禅定模式：允许点击国家，但不弹面板、不显示时区胶囊
      if (this.data.zenMode) {
        this.setData({ countryPanelOpen: false, hoverText: '' });
        return;
      }
      // 组装展示数据（优先使用 country_data.json 中的元信息）
      const lang = this.data.lang;
      const meta = code ? (await this.fetchCountryMetaCloud(code)) : null;
      // 数据源标记：云/本地
      const sourceLabel = (meta?.__source === 'cloud') ? (lang === 'zh' ? '云' : 'Cloud') : (lang === 'zh' ? '本地' : 'Local');
      const nameEn = meta?.NAME_EN || p.NAME_EN || p.ADMIN_EN || p.NAME_LONG_EN || p.NAME || p.ADMIN || '';
      const nameZh = meta?.NAME_ZH || p.NAME_ZH || p.ADMIN_ZH || p.NAME || p.ADMIN || '';
      const displayName = lang === 'zh' ? (nameZh || nameEn) : (nameEn || nameZh || (code || '未知'));
      const capital = lang === 'zh' ? (meta?.CAPITAL_ZH || '') : (meta?.CAPITAL_EN || '');
      const areaKm2 = meta?.AREA_KM2 ? formatThousandsInt(meta.AREA_KM2) : (p.AREA ? formatThousandsInt(Math.round(p.AREA)) : '--');
      const population = meta?.POPULATION ? formatThousandsInt(meta.POPULATION) : '--';
      const gdpVal = (typeof meta?.GDP_USD_TRILLION === 'number') ? meta.GDP_USD_TRILLION : null;
      const gdp = (gdpVal !== null) ? formatThousandsFixed(gdpVal, 2) : '--';
      const tzName = this.selectedTimezone || '';
      const tzOffsetStr = this.computeGmtOffsetStr(tzName); // 例如 GMT+4 / GMT-3
      const timeStr = this.formatTime(new Date(), tzName);
      this.setData({
        countryInfo: { code: code || '', name: displayName, capital, areaKm2, population, gdp, tzName, tzOffsetStr, time: timeStr, source: sourceLabel },
        countryPanelOpen: true
      });
      // 打开面板后立即刷新顶部位置，使其紧贴时区胶囊
      try { this.updateTopOffsets(); } catch(_){ }
      // 根据当前语言生成标题后缀：中文全角括号/英文半角括号
      this.updateCountryTitleSuffix();
    } catch(_){ setForcedLabel(null); }
  },
  // 云端拉取 + 本地回退 + 结果缓存
  async fetchCountryMetaCloud(code){
    try { const mgr = this.__getCountryMgr(); if (mgr) return await mgr.fetchCountryMetaCloud(code); } catch(_){}
    try {
      if (!code) return null;
      this._cloudMeta = this._cloudMeta || {};
      if (this._cloudMeta[code]) return this._cloudMeta[code];
      const { result } = await wx.cloud.callFunction({ name: 'countryMeta', data: { type: 'get', code } });
      const data = result && (result.data || null);
      if (data) {
        const mergedCloud = { ...data, __source: 'cloud' };
        this._cloudMeta[code] = mergedCloud;
        try { console.log('[meta] 云端数据', code, mergedCloud); } catch(_){}
        return mergedCloud;
      }
    } catch(e){ /* ignore and fallback */ }
    const local = countryMeta?.[code] || null;
    if (local) {
      const mergedLocal = { code, ...local, __source: 'local' };
      this._cloudMeta[code] = mergedLocal;
      try { console.log('[meta] 本地数据', code, mergedLocal); } catch(_){}
      return mergedLocal;
    }
    return null;
  },
  // 已改为 CSS 等宽：不再需要测量时间胶囊宽度
  // 计算指定 IANA 时区的 GMT 偏移字符串（如 'GMT+4'）
  computeGmtOffsetStr(tzName){
    try { return computeGmtOffsetStrUtil(tzName); } catch(_){ return ''; }
  },
  // 根据当前语言与偏移字符串，生成标题后缀
  updateCountryTitleSuffix(){
    try { const mgr = this.__getCountryMgr(); if (mgr) return mgr.updateCountryTitleSuffix(); } catch(_){}
    try {
      const info = this.data.countryInfo;
      if (!info) return;
      const offset = info.tzOffsetStr || '';
      const suffix = buildCountryTitleSuffix(this.data.lang || 'zh', offset);
      this.setData({ countryInfo: { ...info, titleTzSuffix: suffix } });
    } catch(_){ }
  },
  // 动态测量设置面板的 left 与 width，使其左对齐语言按钮、右对齐时间胶囊
  updateSettingsPanelFrame(){
    try {
      const q = wx.createSelectorQuery().in(this);
      q.select('#langBtn').boundingClientRect();
      q.select('#timePill').boundingClientRect();
      q.exec(res => {
        try {
          const langRect = res && res[0];
          const timeRect = res && res[1];
          if (!langRect || !timeRect) return;
          const left = Math.round(langRect.left);
          const right = Math.round(timeRect.right);
          const width = Math.max(200, right - left);
          const next = { settingsPanelLeft: left, settingsPanelWidth: width };
          this.setData(next);
        } catch(e){ try { console.warn('[settingsPanelFrame] exec failed', e); } catch(_){} }
      });
    } catch(e){ try { console.warn('[settingsPanelFrame] query failed', e); } catch(_){} }
  },
  // —— 布局：根据安全区/顶栏/提示条，统一委托给 LayoutManager
  updateTopOffsets(){
    try { return this.__getLayoutMgr()?.updateTopOffsets(); } catch(_){ }
  },
  onCloseCountryPanel(){ this.setData({ countryPanelOpen: false, hoverText: '' }); try { this.updateTopOffsets(); } catch(_){} },
  // 按你的要求：不再提供“取消选中”按钮；若需要清空可通过遮罩点击关闭或重新点击地图
});