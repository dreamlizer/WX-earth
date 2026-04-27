// 极薄适配层：页面生命周期与事件绑定，只转交给 main.js
import { boot, teardown, onTouchStart, onTouchMove, onTouchEnd, setZoom, setNightMode, setTheme, setCloudVisible, getCountries, setPaused, flyTo, setDebugFlags, selectCountryByCode, setZenMode, startPoetry3D, stopPoetry3D, setInertia, setPerfMode as setGlPerfMode, nudgeCenter, enterMoonVoyage, exitMoonVoyage, setMoonVoyageSpeed, isMoonVoyageActive } from './main.js';
import { APP_CFG, isDevtools, LOG } from './config.js';
import { formatTime as formatTimeUtil } from './time-utils.js';
import { ZenAudio } from './zen-audio.js';
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
import tzlookup from '../../libs/tz-lookup.js';
import { setLabelsBudget } from './labels.js';
import { PoetryManager } from './poetry-manager.js';
import { SearchManager } from './search-manager.js';
import { ZenModeManager } from './zen-mode-manager.js';
import { LayoutManager } from './layout-manager.js';
import { PerfManager } from './perf-manager.js';
import { SettingsManager } from './settings-manager.js';
import { formatThousandsInt, formatThousandsFixed } from './format-utils.js';
import { getInitialData } from './page-state.js';
import { getSystemInfo } from './sys-info.js';

Page({
  data: {
    ...getInitialData(),
    // Moon Toast (Custom fade-in/out)
    moonToastVisible: false,
    moonToastText: '',
    moonToastOpacity: 0,
  },

  __isMoonLocked(){
    try { if (isMoonVoyageActive()) return true; } catch(_){ }
    try { if (this.__zenPoetryPaused) return true; } catch(_){ }
    return !!this.data?.moonVoyageActive;
  },

  // Expose stopPoetry3D to page instance so MoonVoyageManager can call it
  stopPoetry3D() {
    stopPoetry3D();
  },

  // 页面滚动事件：用于 PC 端鼠标滚轮触发缩放
  onPageScroll(e) {
    return this.__getZoomMgr().pageScroll(e);
  },

  // 接受 IANA 名称时，将时间格式化为 YYYY/MM/DD HH:mm:ss（24小时制）
  formatTime(date, timeZone) {
    try { return formatTimeUtil(date, timeZone, this.data?.lang === 'zh' ? 'zh' : 'en'); }
    catch(e){ try { console.warn('[formatTime wrapper] failed:', e); } catch(_){} }
    return '--:--:--';
  },

  // 启动登月模式
  onEnterMoonVoyage() {
    try {
      if (isMoonVoyageActive()) {
        exitMoonVoyage();
        return;
      }
    } catch(_){ }
    try { if (this.__isMoonLocked()) return; } catch(_){ }
    enterMoonVoyage();
  },

  // Custom Moon Toast (Smoother Fade)
  showMoonToast(text, duration = 2500) {
    if (this._moonToastTimer) clearTimeout(this._moonToastTimer);
    
    // 1. Show (start invisible)
    this.setData({
      moonToastVisible: true,
      moonToastText: text,
      moonToastOpacity: 0
    });

    // 2. Trigger Fade In (next tick)
    setTimeout(() => {
      this.setData({ moonToastOpacity: 1 });
    }, 50);

    // 3. Fade Out after duration
    this._moonToastTimer = setTimeout(() => {
      this.setData({ moonToastOpacity: 0 });
      
      // 4. Hide completely after fade transition (800ms)
      setTimeout(() => {
        this.setData({ moonToastVisible: false });
      }, 800);
    }, duration);
  },

  // —— 登月模式：右上角时间显示长按逻辑 (4s 切换显隐) ——
  onMoonTimerTouchStart() {
    try {
      if (!isMoonVoyageActive()) return;
      this._moonTimerLongPressTimer = setTimeout(() => {
        this.setData({ moonTimeVisible: !this.data.moonTimeVisible });
        wx.vibrateShort({ type: 'light' });
      }, 4000);
    } catch(_){ }
  },
  onMoonTimerTouchEnd() {
    if (this._moonTimerLongPressTimer) {
      clearTimeout(this._moonTimerLongPressTimer);
      this._moonTimerLongPressTimer = null;
    }
  },

  // —— 登月模式：左下角长按 10 倍速 ——
  onSpeedTouchStart() {
    if (!isMoonVoyageActive()) return;
    this._speedPressed = true;
    setMoonVoyageSpeed(10.0);
    wx.showToast({ title: '速度：10x', icon: 'none', duration: 1000 });
  },
  onSpeedTouchEnd() {
    if (this._speedPressed) {
      this._speedPressed = false;
      setMoonVoyageSpeed(1.0);
      wx.showToast({ title: '速度：1x', icon: 'none', duration: 1000 });
    }
  },

  onLoad() {
    // 拦截 setData 以彻底阻断诗句（当 __zenPoetryPaused 为 true 时）
    const originalSetData = this.setData;
    this.setData = (data, cb) => {
      try {
        if (this.__zenPoetryPaused && data && typeof data === 'object') {
          const hasPoetryKeys =
            Object.prototype.hasOwnProperty.call(data, 'poetryA.visible') ||
            Object.prototype.hasOwnProperty.call(data, 'poetryB.visible') ||
            Object.prototype.hasOwnProperty.call(data, 'specialVisible');
          if (hasPoetryKeys) {
            const safeData = { ...data };
            if (safeData['poetryA.visible']) delete safeData['poetryA.visible'];
            if (safeData['poetryB.visible']) delete safeData['poetryB.visible'];
            if (safeData['specialVisible']) delete safeData['specialVisible'];
            return originalSetData.call(this, safeData, cb);
          }
        }
      } catch(_){ }
      return originalSetData.call(this, data, cb);
    };

    // 1. 环境检测与基础设置
    const sys = getSystemInfo();
    const isPC = /windows|mac/i.test(sys.platform || '') || sys.deviceType === 'pc' || sys.environment === 'devtools';
    this.__isDevtools = (sys && sys.environment === 'devtools');
    
    // PC端滚动兼容
    const anchor = 200;
    this.setData({ isPC, lastPageScrollTop: anchor, pageScrollAnchor: anchor });
    if (isPC) { wx.pageScrollTo({ scrollTop: anchor, duration: 0 }); }

    // 2. 启动 3D 引擎
    boot(this);

    // 3. UI 布局与测量
    wx.createSelectorQuery().select('#gl').boundingClientRect().exec(res => {
      this.__canvasRect = res && res[0] ? res[0] : null;
    });

    // 标签预算动态调整
    const dpr = sys.pixelRatio || 1;
    const budget = dpr >= 3 ? 14 : (dpr >= 2 ? 16 : 22);
    setLabelsBudget(budget);

    // 4. 初始化管理器与状态
    this.tzlookup = tzlookup;
    this.selectedTimezone = null;
    this.lastTimeUpdate = 0;
    this._lastLabelsUpdate = 0;

    // 标签管理器初始化
    try { this.__getLabelsMgr().initOnce(this.data.lang); } catch(e){ console.warn('LabelsMgr init failed', e); }

    // 5. 云端数据预加载 (非开发环境)
    if (!this.__isDevtools) {
      this.preloadCitiesCloud();
      try { this.__getZenModeMgr().preloadPoetryCloud(); } catch(_){}
      try { this.__getZenModeMgr().preloadSpecialCloud(); } catch(_){}
      try { this.__getZenMgr().ensureOffline(); } catch(_){}
    }
    try { this.__resolveMoonBtnUrl(); } catch(_){ }

    // 6. 布局更新与传感器
    this.updateTopOffsets();
    setTimeout(() => this.updateSettingsPanelFrame(), 50);

    const layoutMgr = this.__getLayoutMgr();
    const updateSensors = () => {
      layoutMgr.updateEggSensor();
      layoutMgr.updateBrightnessSensor();
    };
    [120, 260].forEach(ms => setTimeout(updateSensors, ms));
    
    if (typeof wx.onWindowResize === 'function') {
      wx.onWindowResize(updateSensors);
    }

    // 7. 分享菜单
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    }
  },
  onReady(){
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
  // 发送给朋友（右上角“转发”或 button open-type=share 触发）
  onShareAppMessage(res){
    try {
      const title = '行星物语-此刻此情此景';
      const path = '/pages/gl/index?from=share'; // 可按需追加参数
      return { title, path };
    } catch(_){ return { title: '行星物语', path: '/pages/gl/index' }; }
  },
  // 分享到朋友圈（Android 支持；需基础库>=2.11.3）
  onShareTimeline(){
    try {
      const title = '行星物语-此刻此情此景';
      // 朋友圈使用 query 传参
      const query = 'from=timeline';
      return { title, query };
    } catch(_){ return { title: '行星物语' }; }
  },
  // 拖动丝滑：一旦检测到拖动，自动关闭所有面板（国家/搜索/设置），避免重绘与事件干扰
  onTouchStart(e){
    try { this.__dragClosedPanels = false; } catch(_){}
    // 拖动优先：若有面板打开，仅记录“待关闭”标记，不在本帧 setData
    try {
      this.__pendingPanelsClose = !!(this.data.countryPanelOpen || this.data.searchOpen || this.data.settingsOpen);
    } catch(_){}
    const ev = this.__normalizeToCanvasTouches(e);
    onTouchStart(ev);
    try { this.__getPerfMgr().dragStart(); } catch(_){}
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
    try { this.__getPerfMgr().dragEnd(); } catch(_){}
    try { this.__getPanelMgr()?.closePendingPanels?.(); } catch(_){}
  },

  __resolveMoonBtnUrl() {
    try {
      const fileID = String(this.data?.cloudMoonButtonFileId || '');
      if (!fileID || !fileID.startsWith('cloud://')) return;
      const cloud = wx?.cloud;
      if (!cloud || typeof cloud.getTempFileURL !== 'function') return;

      cloud.getTempFileURL({
        fileList: [fileID],
        success: (r) => {
          try {
            const url0 = r?.fileList?.[0]?.tempFileURL;
            if (!url0) return;
            const sep = url0.includes('?') ? '&' : '?';
            const url = `${url0}${sep}__v=${Date.now()}`;
            this.setData({ moonBtnUrl: url });
          } catch(_){ }
        },
        fail: () => {}
      });
    } catch(_){ }
  },

  // —— 工具：把任意组件的触摸事件统一转换为 canvas 坐标系（x/y）
  __normalizeToCanvasTouches(e){
    try { return normalizeToCanvasTouches(e, this.__canvasRect); } catch(_){ return e; }
  },

  // —— 搜索：打开/关闭 & 输入/候选
  onToggleSearch(){
    try { if (this.__isMoonLocked()) return; } catch(_){ }
    try { this.__getPanelMgr()?.fadeOutOpenPanels?.(); } catch(_){ }
    try { this.__getSearchMgr().toggle(!this.data.searchOpen); } catch(_){ }
  },
  onCloseSearch(){
    try { if (this.__isMoonLocked()) return; } catch(_){ }
    // 已迁移：委托 SearchManager 关闭搜索并清理（删除旧页面逻辑）
    try { this.__getSearchMgr().close(); } catch(_){}
  },
  onSearchInput(e){
    try { if (this.__isMoonLocked()) return; } catch(_){ }
    // 已迁移：委托 SearchManager 处理输入与候选生成（删除旧页面逻辑）
    try { this.__getSearchMgr().input(e?.detail?.value || '', { features: this._features, citiesCloud: this._citiesCloud }); } catch(_){}
  },
  onPickSuggestion(e){
    try { if (this.__isMoonLocked()) return; } catch(_){ }
    // 已迁移：委托 SearchManager 执行飞行与联动（删除旧页面逻辑）
    try { const ds = e?.currentTarget?.dataset || {}; this.__getSearchMgr().pick({ lat: ds.lat, lon: ds.lon, type: ds.type, id: ds.id }); } catch(_){}
  },
  // 新增：选择后直接选中国家并打开面板，同时更新顶栏时区提示
  onPickSuggestionOpen(e){
    try { if (this.__isMoonLocked()) return; } catch(_){ }
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

  // 原 slider 交互：拖动预览与释放确认（双向同步）
  onZoomChanging(e){ return this.__getZoomMgr().changing(e); },
  onZoomChange(e){ return this.__getZoomMgr().change(e); },
  onZoomPlus(){ return this.__getZoomMgr().plus(); },
  onZoomMinus(){ return this.__getZoomMgr().minus(); },

  // —— UI 交互：设置面板
  // 点击顶部“设定”按钮
  onToggleSettings(){ try { if (this.__isMoonLocked()) return; } catch(_){ } return this.__getPanelMgr().toggleSettings(); },
  onCloseSettings(){ try { if (this.__isMoonLocked()) return; } catch(_){ } return this.__getPanelMgr().closeSettings(); },
  onTapTimePill(){
    try { if (this.__isMoonLocked()) return; } catch(_){ }
    try { return this.__getSettingsMgr().onTimePillTap(); } catch(_){ }
  },
  
  // 切换“禅定模式”按钮：进入/退出，仅控制 UI 显隐与面板关闭
  onToggleZenMode(){
    try { if (this.__isMoonLocked()) return; } catch(_){ }
    // 委托给禅定管理器：统一处理面板淡出、渲染层切换与音频/诗句
    try { return this.__getZenModeMgr().toggle(); } catch(_){}
  },

  // “定”按钮：展开/收起预设列表
  async onToggleCut(){
    try { if (this.__isMoonLocked()) return; } catch(_){ }
    // 旧逻辑：return this.__getZenModeMgr().toggleList();
    // 新逻辑：直接切歌
    try { return this.__getZenModeMgr().switchNextPreset(); } catch(_){ }
  },
  onPickPreset(e){
    try { if (this.__isMoonLocked()) return; } catch(_){ }
    try {
      const id = Number(e?.currentTarget?.dataset?.id || 0);
      this.__getZenModeMgr().pickPreset(id);
    } catch(_){}
  },
  onToggleNight(e){ const on = !!(e?.detail?.value); this.setData({ nightMode: on }); setNightMode(on); },
  // 新增：主题三选按钮事件（白昼/默认/夜景）
  onSetTheme(e){
    const val = String(e?.currentTarget?.dataset?.val || 'default');
    let theme = (val === 'daylight') ? 'day8k' : (val === 'night' ? 'night' : 'default');
    let applyTheme = theme;
    this.setData({ theme, nightMode: (applyTheme === 'night') });
    try { setTheme(applyTheme); } catch(_) { setNightMode(applyTheme === 'night'); }
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
  // 状态由 ZenModeManager 管理，此处保留默认值定义
  __zenPreset: 1,

  // —— 禅音频：模块化管理器（保持原有外部方法名） ——
  __zenAudioMgr: null,
  __getZenMgr(){
    if (!this.__zenAudioMgr) {
      this.__zenAudioMgr = new ZenAudio({ fileIds: { 1: this.data.cloudZen1FileId, 2: this.data.cloudZen2FileId, 3: this.data.cloudZen3FileId, 4: this.data.cloudZen4FileId }, appCfg: APP_CFG });
    } else {
      // 每次调用时刷新 fileIDs，避免 data 改动后不一致
      this.__zenAudioMgr.updateFileIds({ 1: this.data.cloudZen1FileId, 2: this.data.cloudZen2FileId, 3: this.data.cloudZen3FileId, 4: this.data.cloudZen4FileId });
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
      this.__settingsMgr = new SettingsManager(this);
    }
    return this.__settingsMgr;
  },
  // —— 布局管理器：统一计算顶部偏移，减少页面内联逻辑 ——
  __layoutMgr: null,
  __getLayoutMgr(){
    if (!this.__layoutMgr) { this.__layoutMgr = new LayoutManager(this); }
    return this.__layoutMgr;
  },
  __perfMgr: null,
  __getPerfMgr(){
    if (!this.__perfMgr) { this.__perfMgr = new PerfManager(this); }
    return this.__perfMgr;
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
        getViewport: () => this.__getLayoutMgr().getViewport(),
        getCanvasRect: () => this.__canvasRect,
        measure: (id) => this.__getLayoutMgr().measure(id),
        setData: (obj) => {
          // [Global Interceptor] 
          // If Zen Poetry is paused (Moon Mode), block any attempt to show poetry
          if (this.__zenPoetryPaused) {
            const safeObj = {};
            let hasSafeUpdates = false;
            Object.keys(obj).forEach(key => {
              // Allow hiding, disallow showing
              if (key.includes('visible')) {
                safeObj[key] = false;
                hasSafeUpdates = true;
              }
              // Block text updates or motion updates to save performance
              // But allow resetting if needed
            });
            if (hasSafeUpdates) {
               this.setData(safeObj);
            }
            return;
          }
          this.setData(obj);
        },
        startPoetry3D,
        stopPoetry3D,
        getLang: () => this.data?.lang || 'zh'
      });
    }
    return this.__poetryMgr;
  },
  // —— 彩蛋：时间胶囊感应区测量 ——
  // 已移除：updateEggSensor/updateBrightnessSensor（已改为 direct calls to LayoutManager）
  // —— 亮度竖条触控：映射到主引擎的 setBrightnessScale ——
  onBrightnessTouchStart(e){
    try { return this.__getSettingsMgr().onBrightnessTouchStart(e); } catch(_){ }
  },
  onBrightnessTouchMove(e){
    try { return this.__getSettingsMgr().onBrightnessTouchMove(e); } catch(_){ }
  },
  onBrightnessTouchEnd(){
    try { return this.__getSettingsMgr().onBrightnessTouchEnd(); } catch(_){ }
  },
  // —— 彩蛋：8 次点击触发 Special 字符串展示 ——
  onEggTap(){
    try { 
       // Moon Mode Speed Up Easter Egg
       if (this.__moonVoyageMgr && this.__moonVoyageMgr.active) {
          this.__moonTapCount = (this.__moonTapCount || 0) + 1;
          clearTimeout(this.__moonTapTimer);
          this.__moonTapTimer = setTimeout(() => { this.__moonTapCount = 0; }, 500);
          if (this.__moonTapCount >= 3) {
             this.__moonTapCount = 0;
             if (this.debugSpeedUp) this.debugSpeedUp();
             return;
          }
       }
       return this.__getZenModeMgr().onEggTap(); 
    } catch(_){ }
  },
  // 委托给 PoetryManager 的包装方法（逐步迁移使用）
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
  // 设置面板：惯性按钮（无/默认/快/无限）
  onSetInertiaBtn(e){
    const val = Number(e?.currentTarget?.dataset?.val ?? e?.detail?.value ?? 0);
    const pct = Math.max(0, Math.min(100, Math.round(val)));
    this.__getSettingsMgr().setInertia(pct);
  },
  onToggleLang(){
    // try { this.__getPanelMgr()?.fadeOutOpenPanels?.(); } catch(_){ }
    try { this.__getZenModeMgr()?.closeList?.(); } catch(_){ }
    return this.__getLabelsMgr().onToggleLang();
  },

  async preloadPresetLabelsCloud(){
    try { return this.__getZenModeMgr().preloadPresetLabelsCloud(); } catch(_){ }
  },
  rebuildLabelsByLang(lang, featuresArg){
    return this.__getLabelsMgr().rebuildLabelsByLang(lang, featuresArg);
  },
  // 云端拉取城市数据（一次性缓存 + 回退）
  async preloadCitiesCloud(){
    return this.__getLabelsMgr().preloadCitiesCloud();
  },
  // 开发者工具控制台调用：将本地 cities 数据分批写入云数据库（应急）
  async pushCitiesToCloudLocal(chunkSize = 200){
    try { return this.__getLabelsMgr().pushCitiesToCloudLocal(chunkSize); } catch(_){ }
  },
  onCountriesLoaded(features){
    // 改为统一委托 LabelsManager，集中管理标签重建
    return this.__getLabelsMgr().onCountriesLoaded(features);
  },
  // main.js 点选国家后触发：强行显示该国家的标签（直到用户取消选中）
  async onCountryPicked(hit){
    return this.__getCountryMgr().onCountryPicked(hit);
  },
  // 已改为 CSS 等宽：不再需要测量时间胶囊宽度
  // 计算指定 IANA 时区的 GMT 偏移字符串（如 'GMT+4'）
  computeGmtOffsetStr(tzName){
    try { return computeGmtOffsetStrUtil(tzName); } catch(_){ return ''; }
  },
  // 动态测量设置面板的 left 与 width，使其左对齐时间胶囊、右对齐设定按钮
  updateSettingsPanelFrame(){
    try { return this.__getLayoutMgr()?.updateSettingsPanelFrame(); } catch(_){ }
  },
  // —— 布局：根据安全区/顶栏/提示条，统一委托给 LayoutManager
  updateTopOffsets(){
    try { return this.__getLayoutMgr()?.updateTopOffsets(); } catch(_){ }
  },
  onCloseCountryPanel(){
    try { return this.__getPanelMgr().closeCountryPanel(); } catch(_){ }
  },
  // 取消正在进行的面板关闭倒计时（用于在关闭动画未结束时强行重新打开面板）
  cancelPanelCloseTimer(){
    try { return this.__getPanelMgr().cancelCloseTimer(); } catch(_){ }
  },
  async __refreshAssets(){
    try { return this.__getSettingsMgr().refreshAssets(); } catch(_){ }
  },
});
