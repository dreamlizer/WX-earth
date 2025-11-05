// 极薄适配层：页面生命周期与事件绑定，只转交给 main.js
import { boot, teardown, onTouchStart, onTouchMove, onTouchEnd, getRenderContext, setZoom, setNightMode, setCloudVisible, getCountries, setPaused, flyTo, setDebugFlags, selectCountryByCode, setZenMode } from './main.js';
// 避免直接 import JSON 在小程序里不被当作模块，改为 JS 导出
import countryMeta from './country_data.js';
import tzlookup from '../../libs/tz-lookup.js';
import { initLabels, updateLabels, setLabelsBudget, setForcedLabel, setForcedCityCountries, clearForcedCityCountries } from './labels.js';
import { initCityMarkers, updateCityMarkers, disposeCityMarkers, highlightCityMarker } from './city-markers.js';
import { ENABLE_CITY_LABELS, INTERACTION_DEBUG_LOG } from './label-constants.js';
import { cities } from '../../assets/data/cities_data.js';

Page({
  data: {
    currentTime: '--:--:--',
    hoverText: '',
    countryPanelTop: 0,
    // PC 端滚轮代理：scroll-view 的滚动位置维持为 0，避免视觉滚动
    scrollTop: 0,
    // UI 可见缩放值（与原 slider 双向同步）
    uiZoom: 1.0,
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
    showCloud: false,
    labelQty: 'default', // none/few/default/many
    cityTier: 'more',
    // 国家信息面板
    countryPanelOpen: false,
    countryInfo: null,
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
  // 改为 Intl.DateTimeFormat.formatToParts，避免不同设备对 toLocaleString 的不一致（如显示成 "Wed Nov 05 2025"）
  formatTime(date, timeZone) {
    try {
      if (typeof timeZone === 'string' && timeZone) {
        const locale = this.data?.lang === 'zh' ? 'zh-CN' : 'en-CA';
        // 1) 优先使用 formatToParts（最稳定）
        try {
          if (globalThis.Intl && typeof Intl.DateTimeFormat === 'function') {
            const fmt = new Intl.DateTimeFormat(locale, {
              timeZone,
              hour12: false,
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            if (typeof fmt.formatToParts === 'function') {
              const parts = fmt.formatToParts(date);
              const get = (t) => {
                const v = parts.find(p => p.type === t)?.value;
                return (typeof v === 'string') ? v.padStart(2, '0') : '00';
              };
              const y = parts.find(p => p.type === 'year')?.value || '0000';
              const m = get('month');
              const d = get('day');
              const hh = get('hour');
              const mm = get('minute');
              const ss = get('second');
              return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
            }
          }
        } catch(_){ /* fall through */ }
        // 2) 退回 toLocaleString（小概率设备存在不一致；我们用正则清洗）
        try {
          const s0 = date.toLocaleString(locale, {
            timeZone,
            hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });
          let s = String(s0 || '').trim();
          // 统一为 YYYY/MM/DD HH:mm:ss（去掉逗号与中文“年/月/日”）
          s = s.replace(/[年\-]/g, '/').replace(/月/g, '/').replace(/日/g, '').replace(/,/g, '').trim();
          // 部分内核可能返回 "YYYY/MM/DD, HH:mm:ss" 或 "YYYY/ MM/ DD HH:mm:ss"
          s = s.replace(/\s{2,}/g, ' ');
          // 若仍然检测不到数字日期，继续向下兜底
          if (/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}/.test(s)) return s;
        } catch(_){ /* fall through */ }
        // 3) 兜底 A：常见 IANA 名称的固定偏移（不处理夏令时）
        const FALLBACK_OFFSETS_MIN = {
          'Asia/Shanghai': 480, // 中国标准时间 CST UTC+8
          'Asia/Beijing': 480,  // 别名兜底
          'Asia/Taipei': 480,
          'Asia/Hong_Kong': 480,
          'Asia/Macau': 480,
        };
        if (FALLBACK_OFFSETS_MIN[timeZone] != null) {
          const minutes = FALLBACK_OFFSETS_MIN[timeZone];
          const dt = new Date(date.getTime() + minutes * 60 * 1000);
          const pad = (n) => String(n).padStart(2, '0');
          const y = dt.getUTCFullYear();
          const mo = pad(dt.getUTCMonth() + 1);
          const d = pad(dt.getUTCDate());
          const hh = pad(dt.getUTCHours());
          const mm = pad(dt.getUTCMinutes());
          const ss = pad(dt.getUTCSeconds());
          return `${y}/${mo}/${d} ${hh}:${mm}:${ss}`;
        }
        // 4) 最终兜底：支持 Etc/GMT±N，以小时偏移粗略换算
        const m = String(timeZone).match(/^Etc\/GMT([+-])(\d{1,2})$/);
        if (m) {
          const sign = m[1] === '+' ? 1 : -1; // 注意 Etc/GMT 符号与常规相反
          const hours = Number(m[2]) || 0;
          const dt = new Date(date.getTime() - sign * hours * 3600 * 1000);
          const pad = (n) => String(n).padStart(2, '0');
          const y = dt.getUTCFullYear();
          const mo = pad(dt.getUTCMonth() + 1);
          const d = pad(dt.getUTCDate());
          const hh = pad(dt.getUTCHours());
          const mm = pad(dt.getUTCMinutes());
          const ss = pad(dt.getUTCSeconds());
          return `${y}/${mo}/${d} ${hh}:${mm}:${ss}`;
        }
        // 无法解析时，返回占位符
        return '--:--:--';
      }
    } catch (e) {
      console.warn('[formatTime] failed:', e);
    }
    return '--:--:--';
  },

  onLoad() {
    // 检测是否为 PC 端，初始化页面滚动锚点（用于滚轮兼容）
    try {
      const sys = wx.getSystemInfoSync();
      const isPC = /windows|mac/i.test(sys.platform || '') || sys.deviceType === 'pc' || sys.environment === 'devtools';
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
          return; // 完成一次构建
        }
      } catch(_){ }
      setTimeout(waitInit, 100);
    };
    waitInit();
    this._lastLabelsUpdate = 0;
    // 预加载云端城市数据（存在则替换本地）
    this.preloadCitiesCloud();
    try { this.updateTopOffsets(); } catch(_){ }
  },
  onReady(){
    // 首次渲染完成后测量时间胶囊宽度，确保国家面板等宽
    /* 已改为纯 CSS 等宽，无需测量 */
    // 始终暴露诊断/控制接口：避免受调试开关影响
    try {
      wx.setGlDebug = (flags) => { try { setDebugFlags(flags); console.log('[debug flags]', flags); } catch(_){ } };
      wx.nudgeCenter = (cfg) => { try { const dLat = Number(cfg?.lat||0), dLon = Number(cfg?.lon||0); nudgeCenter(dLat, dLon); console.log('[nudgeCenter call]', cfg); } catch(_){ } };
    } catch(_){}
  },
  onUnload() { teardown(); },
  onShow() { try { setPaused(false); } catch(_){ } },
  onHide() { try { setPaused(true); } catch(_){ } },
  onTouchStart(e){ onTouchStart(e); },
  onTouchMove(e){ onTouchMove(e); },
  onTouchEnd(e){ onTouchEnd(e); },

  // —— 工具：把任意组件的触摸事件统一转换为 canvas 坐标系（x/y）
  __normalizeToCanvasTouches(e){
    const rect = this.__canvasRect;
    const ts = (e && e.touches) ? e.touches : [];
    if (!rect || !ts || ts.length === 0) return e;
    const mapped = ts.map(t => {
      const px = (t.pageX ?? t.clientX ?? t.x ?? 0);
      const py = (t.pageY ?? t.clientY ?? t.y ?? 0);
      const x = Math.max(0, Math.min(rect.width,  px - rect.left));
      const y = Math.max(0, Math.min(rect.height, py - rect.top));
      return { x, y };
    });
    return { touches: mapped };
  },

  // —— 搜索：打开/关闭 & 输入/候选
  onToggleSearch(){
    const next = !this.data.searchOpen;
    // 打开搜索：先关闭国家面板与时区胶囊（hoverText），避免位置/层级冲突
    if (next) {
      this.setData({ countryPanelOpen: false, hoverText: '', suggestions: [], searchQuery: '', searchOpen: true });
      this.selectedTimezone = null;
      try { this.updateTopOffsets(); } catch(_){ }
    } else {
      // 关闭搜索：仅清理候选与输入内容，时区胶囊由后续选择/命中国家时再显示
      this.setData({ suggestions: [], searchQuery: '', searchOpen: false });
      try { this.updateTopOffsets(); } catch(_){ }
    }
  },
  onCloseSearch(){
    this.setData({ searchOpen: false, suggestions: [], searchQuery: '' });
  },
  onSearchInput(e){
    const q = String(e?.detail?.value || '').trim();
    this.setData({ searchQuery: q });
    if (q.length >= 2) this.buildSearchSuggestions(q);
    else this.setData({ suggestions: [] });
  },
  onPickSuggestion(e){
    try {
      const lat = Number(e?.currentTarget?.dataset?.lat);
      const lon = Number(e?.currentTarget?.dataset?.lon);
      const type = String(e?.currentTarget?.dataset?.type || '').toLowerCase();
      const id   = String(e?.currentTarget?.dataset?.id || '');
      try { if (INTERACTION_DEBUG_LOG) console.log('[pick] type=', type, 'lat=', Number.isFinite(lat)?lat.toFixed(4):lat, 'lon=', Number.isFinite(lon)?lon.toFixed(4):lon, 'id=', id); } catch(_){}
      if (isFinite(lat) && isFinite(lon)) {
        // 关闭面板并飞行到指定点
        this.setData({ searchOpen: false, suggestions: [] });
        try { setPaused(false); } catch(_){}
        try { flyTo(lat * Math.PI/180, lon * Math.PI/180, 1000); } catch(_){}
        try { if (INTERACTION_DEBUG_LOG) console.log('[flyTo] lat(rad)=', (lat*Math.PI/180).toFixed(4), 'lon(rad)=', (lon*Math.PI/180).toFixed(4)); } catch(_){}
        // 飞到后放大至约最大值的 80%（更接近城市查看但不至于过大）
        try { setZoom(2.30); } catch(_){}
        // 高亮对应标签：若是城市，先高亮城市以便放大与脉冲；若是国家，直接高亮国家
        try {
          if (type === 'city' && id) {
            setForcedLabel(id);
            // 记录最近一次强制的标签 ID（用于区分城市/国家）
            try { this.__lastForcedId = id; } catch(_){}
            // 锁定：在短时间内保持城市处于强制高亮，避免随国家选中而被覆盖
            try { this.__keepCityForcedUntil = Date.now() + 3000; } catch(_){}
            // 城市点高亮（变色不变大）
            try { highlightCityMarker(id, 2500); } catch(_){}
          } else if (type === 'country' && id) {
            setForcedLabel(String(id).toUpperCase());
            try { this.__lastForcedId = String(id).toUpperCase(); } catch(_){}
          }
        } catch(_){}
        // 同时关闭国家信息面板（避免遮挡），飞行结束后自动选中国家并打开面板
        try { this.setData({ countryPanelOpen: false }); } catch(_){}

        // 解析国家代码，并在飞行完成后选中国家（约 1.2s）
        const features = this._features || getCountries() || [];
        let countryCode = null;
        if (type === 'country') {
          countryCode = String(id || '').toUpperCase();
        } else if (type === 'city') {
          const m = /^CITY_([A-Z]{2,3})_/i.exec(id || '');
          if (m) countryCode = String(m[1]).toUpperCase();
        }
        if (countryCode) {
          const feature = features.find(f => {
            const p = f?.props || {};
            const a3 = String(p.ISO_A3 || '').toUpperCase();
            const a2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
            return a3 === countryCode || a2 === countryCode;
          }) || null;
          const hit = feature ? { props: feature.props } : null;
          setTimeout(() => {
            try { selectCountryByCode(countryCode); } catch(_){}
          }, 1200);
        }
      }
    } catch(_){ }
  },
  // 新增：选择后直接选中国家并打开面板，同时更新顶栏时区提示
  onPickSuggestionOpen(e){
    try {
      const lat = Number(e?.currentTarget?.dataset?.lat);
      const lon = Number(e?.currentTarget?.dataset?.lon);
      const type = String(e?.currentTarget?.dataset?.type || '').toLowerCase();
      const id   = String(e?.currentTarget?.dataset?.id || '');
      try { if (INTERACTION_DEBUG_LOG) console.log('[pick/open] type=', type, 'lat=', Number.isFinite(lat)?lat.toFixed(4):lat, 'lon=', Number.isFinite(lon)?lon.toFixed(4):lon, 'id=', id); } catch(_){}
      if (isFinite(lat) && isFinite(lon)) {
        // 关闭搜索面板并飞行到指定点
        this.setData({ searchOpen: false, suggestions: [] });
        try { setPaused(false); } catch(_){}
        try { flyTo(lat * Math.PI/180, lon * Math.PI/180, 1000); } catch(_){}
        try { if (INTERACTION_DEBUG_LOG) console.log('[flyTo] lat(rad)=', (lat*Math.PI/180).toFixed(4), 'lon(rad)=', (lon*Math.PI/180).toFixed(4)); } catch(_){}
        try { setZoom(2.30); } catch(_){}

        // 先高亮被搜索的标签/城市点：城市→变色不变大，并锁定 3 秒；国家→直接高亮
        try {
          if (type === 'city' && id) {
            setForcedLabel(id);
            try { this.__lastForcedId = id; } catch(_){}
            try { this.__keepCityForcedUntil = Date.now() + 3000; } catch(_){}
            try { highlightCityMarker(id, 2500); } catch(_){}
          } else if (type === 'country' && id) {
            setForcedLabel(String(id).toUpperCase());
            try { this.__lastForcedId = String(id).toUpperCase(); } catch(_){}
          }
        } catch(_){}

        const features = this._features || getCountries() || [];
        let countryCode = null;
        let feature = null;
        if (type === 'country') {
          countryCode = String(id || '').toUpperCase();
          feature = features.find(f => {
            const p = f?.props || {};
            const a3 = String(p.ISO_A3 || '').toUpperCase();
            const a2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
            return a3 === countryCode || a2 === countryCode;
          }) || null;
        } else if (type === 'city') {
          const m = /^CITY_([A-Z]{2,3})_/i.exec(id || '');
          if (m) countryCode = String(m[1]).toUpperCase();
          feature = features.find(f => {
            const p = f?.props || {};
            const a3 = String(p.ISO_A3 || '').toUpperCase();
            const a2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
            return countryCode && (a3 === countryCode || a2 === countryCode);
          }) || null;
        }

        // 顶部时区提示：仅显示时区（不显示国家/城市名）
        try {
          const tzName = this.tzlookup?.(lat, lon) || '';
          this.selectedTimezone = tzName || null;
          const offsetStr = this.computeGmtOffsetStr(tzName); // 例如 GMT+4 / GMT-3
          // 只显示偏移，避免过长文本；若无法计算则回退到 tzName
          this.setData({ hoverText: offsetStr || (tzName || '') });
        } catch(_){}

        // 打开国家面板并高亮
        if (feature) {
          try { this.onCountryPicked(feature); } catch(_){}
          try { this.updateTopOffsets(); } catch(_){}
        } else if (countryCode) {
          try { setForcedLabel(countryCode); } catch(_){}
          try { setForcedCityCountries([countryCode]); } catch(_){}
          try { this.setData({ countryPanelOpen: true }); } catch(_){}
          try { this.updateTopOffsets(); } catch(_){}
        }
      }
    } catch(_){ }
  },
  // —— 生成候选
  buildSearchSuggestions(q){
    const lang = this.data.lang || 'zh';
    const isZh = /[\u4e00-\u9fa5]/.test(q);
    const lower = q.toLowerCase();
    const maxN = 10;
    try { if (INTERACTION_DEBUG_LOG) console.log('[search] query=', lower); } catch(_){}

    // 预备国家数据（使用已加载的 features）
    const features = this._features || getCountries() || [];
    const CONTINENT_TRANSLATIONS = {
      'North America': '北美洲', 'South America': '南美洲', 'Europe': '欧洲', 'Asia': '亚洲',
      'Africa': '非洲', 'Oceania': '大洋洲', 'Antarctica': '南极洲'
    };
    const countries = (features || []).map(f => {
      const p = f?.props || {};
      const nameEn = p.NAME_EN || p.ADMIN_EN || p.NAME || p.ADMIN || '';
      const nameZh = p.NAME_ZH || p.ADMIN_ZH || p.NAME || p.ADMIN || '';
      const continent = p.CONTINENT || '';
      const zhCont = CONTINENT_TRANSLATIONS[continent] || continent || '';
      const cx = (f.bbox[0] + f.bbox[2]) * 0.5; // 经度中心
      const cy = (f.bbox[1] + f.bbox[3]) * 0.5; // 纬度中心
      return {
        type: 'country',
        name_en: nameEn,
        name_zh: nameZh,
        continent_zh: zhCont,
        lon: cx, lat: cy,
        key_en: String(nameEn).toLowerCase(),
        key_zh_initials: this.__zhInitials(nameZh),
        key_zh_pinyin: this.__toPinyinFull(nameZh),
        key_zh_pinyin_ini: this.__pinyinInitials(this.__toPinyinFull(nameZh)),
        id: (p.ISO_A3 || p.ISO_A2 || p.ISO || '')
      };
    });

    // 城市数据：优先云端预载，回退本地 assets
    const arrCities = Array.isArray(this._citiesCloud) && this._citiesCloud.length ? this._citiesCloud : cities;
    const citiesView = (arrCities || []).map(c => {
      const nameEn = c.name_en || '';
      const nameZh = c.name_zh || '';
      const code = String(c.country_code || '').toUpperCase();
      const meta = countryMeta?.[code] || {};
      const countryNameZh = meta?.NAME_ZH || '';
      const countryNameEn = meta?.NAME_EN || '';
      return {
        type: 'city',
        name_en: nameEn,
        name_zh: nameZh,
        country_zh: countryNameZh,
        country_en: countryNameEn,
        lat: Number(c.lat), lon: Number(c.lon),
        key_en: String(nameEn).toLowerCase(),
        key_zh_initials: this.__zhInitials(nameZh),
        key_zh_pinyin: this.__toPinyinFull(nameZh),
        key_zh_pinyin_ini: this.__pinyinInitials(this.__toPinyinFull(nameZh)),
        id: `CITY_${c.country_code || 'UNK'}_${c.name_en || nameZh || ''}`
      };
    });

    // 过滤规则
    const lettersOnly = /^[a-z\s]+$/.test(lower);
    const matchItem = (it) => {
      if (isZh) {
        // 中文输入：按中文名包含匹配
        return (it.name_zh || '').includes(q);
      } else {
        // 英文/拼音：英文包含/前缀 + 拼音全拼包含 + 拼音首字母前缀 + 中文首字母前缀
        const hitEn = it.key_en.includes(lower) || it.key_en.startsWith(lower);
        const hitPyFull = lettersOnly && String(it.key_zh_pinyin).includes(lower);
        const hitPyIni  = lettersOnly && (String(it.key_zh_pinyin_ini).startsWith(lower) || String(it.key_zh_pinyin_ini).includes(lower));
        const hitZhIni  = (String(it.key_zh_initials).startsWith(lower) || String(it.key_zh_initials).includes(lower));
        return hitEn || hitPyFull || hitPyIni || hitZhIni;
      }
    };

    const pickLabel = (it) => {
      if (it.type === 'city') {
        const nm = (lang === 'zh' ? (it.name_zh || it.name_en) : (it.name_en || it.name_zh));
        const cn = (lang === 'zh' ? (it.country_zh || it.country_en) : (it.country_en || it.country_zh));
        return `${nm}（${cn || '--'}）`;
      } else { // country
        const nm = (lang === 'zh' ? (it.name_zh || it.name_en) : (it.name_en || it.name_zh));
        const cont = (lang === 'zh' ? it.continent_zh : '') || it.continent_zh || '';
        return `${nm}${cont ? `（${cont}）` : ''}`;
      }
    };

    const list = [];
    const seen = new Set();
    for (const c of citiesView) {
      if (matchItem(c)) {
        const item = { type: 'city', display: pickLabel(c), lat: c.lat, lon: c.lon, id: c.id };
        const key = `${item.display.toLowerCase()}|${item.lat.toFixed(4)}|${item.lon.toFixed(4)}`;
        if (!seen.has(key)) { list.push(item); seen.add(key); }
        if (list.length >= maxN) break;
      }
    }
    if (list.length < maxN) {
      for (const co of countries) {
        if (matchItem(co)) {
          const item = { type: 'country', display: pickLabel(co), lat: co.lat, lon: co.lon, id: co.id };
          const key = `${item.display.toLowerCase()}|${item.lat.toFixed(4)}|${item.lon.toFixed(4)}`;
          if (!seen.has(key)) { list.push(item); seen.add(key); }
          if (list.length >= maxN) break;
        }
      }
    }
    try { if (INTERACTION_DEBUG_LOG) console.log('[search] matches=', list.length); } catch(_){}
    this.setData({ suggestions: list });
  },
  // 搜索遮罩透传：与国家面板相同策略
  onSearchMaskTouchStart(e){
    try {
      // 立即关闭输入框，并把事件转交给渲染层以继续旋转
      if (this.data.searchOpen) this.setData({ searchOpen: false, suggestions: [] });
      const { touches } = this.__normalizeToCanvasTouches(e);
      onTouchStart({ touches });
    } catch(_){}
  },
  onSearchMaskTouchMove(e){
    try {
      const { touches } = this.__normalizeToCanvasTouches(e);
      onTouchMove({ touches });
    } catch(_){}
  },
  // —— 中文首字母近似提取（常用“阿八嚓…”锚点法）
  __zhInitials(str){
    try {
      if (!str) return '';
      const anchors = '阿八嚓哒妸发噶哈讥喀垃马拏哦啪期然撒他挖昔丫匝';
      const letters = ['a','b','c','d','e','f','g','h','j','k','l','m','n','o','p','q','r','s','t','w','x','y','z'];
      const res = [];
      for (const ch of String(str)) {
        const code = ch.charCodeAt(0);
        if (/[a-z]/i.test(ch)) { res.push(ch.toLowerCase()); continue; }
        if (code < 19968 || code > 40869) { continue; } // 非常用中文
        let idx = 0;
        for (let i = letters.length - 1; i >= 0; i--) {
          if (ch >= anchors[i]) { idx = i; break; }
        }
        res.push(letters[idx] || '');
      }
      return res.join('');
    } catch(_){ return ''; }
  },
  // —— 拼音全拼与首字母（轻量映射；可按需扩充）
  __toPinyinFull(str){
    try {
      if (!str) return '';
      const SPECIAL = {
        '巴黎':'bali','中国':'zhongguo','美国':'meiguo','英国':'yingguo','法国':'faguo','日本':'riben','韩国':'hanguo','德国':'deguo','加拿大':'jianada','澳大利亚':'aodaliya','新加坡':'xinjiapo','泰国':'taiguo'
      };
      if (SPECIAL[str]) return SPECIAL[str];
      const MAP = {
        '北':'bei','京':'jing','上':'shang','海':'hai','广':'guang','州':'zhou','深':'shen','圳':'zhen','成':'cheng','都':'du','重':'chong','庆':'qing','武':'wu','汉':'han','西':'xi','安':'an','杭':'hang','拉':'la','萨':'sa',
        '纽':'niu','约':'yue','芝':'zhi','加':'jia','哥':'ge','丹':'dan','佛':'fo','洛':'luo','杉':'shan','矶':'ji','克':'ke','雷':'lei','奇':'qi','檀':'tan','香':'xiang','山':'shan','华':'hua','盛':'sheng','顿':'dun',
        '休':'xiu','斯':'si','图':'tu','迈':'mai','阿':'a','密':'mi','莫':'mo','科':'ke','圣':'sheng','彼':'bi','得':'de','堡':'bao','叶':'ye','卡':'ka','捷':'jie','琳':'lin','新':'xin','伯':'bo','利':'li','亚':'ya',
        '符':'fu','迪':'di','沃':'wo','托':'tu','巴':'ba','黎':'li','开':'kai','罗':'luo','东':'dong','京':'jing'
      };
      let out = '';
      for (const ch of String(str)) {
        out += MAP[ch] || (/[a-z]/i.test(ch) ? ch.toLowerCase() : '');
      }
      return out.replace(/\s+/g,'');
    } catch(_){ return ''; }
  },
  __pinyinInitials(pinyinFull){
    try {
      // 改进：按拼音音节近似切分，避免 "beijing" 只得 "b" 的问题
      // 规则：辅音簇 + 元音簇 + 可选尾韵 "ng"，作为一个音节；对非字母先移除
      const raw = String(pinyinFull||'').toLowerCase().replace(/[^a-z]/g, '');
      if (!raw) return '';
      const syllables = raw.match(/(?:[b-df-hj-np-tv-z]*[aeiou]+(?:ng)?)/g) || [];
      if (syllables.length === 0) return raw[0] || '';
      return syllables.map(syl => syl[0]).join('');
    } catch(_){ return ''; }
  },

  // 国家面板触摸：立即关闭面板，并把事件转交给渲染层（不阻挡旋转）
  onPanelTouchStart(e){
    // 不在 touchstart 立即关闭；先转交事件（坐标归一化为 canvas），避免中断当前手势
    try { const en = this.__normalizeToCanvasTouches(e); onTouchStart(en); } catch(_){}
    this.__panelClosing = true;
  },
  onPanelTouchMove(e){
    // 第一次 move 执行关闭，再继续把事件转交，不打断当前拖动手势
    try { if (this.__panelClosing && this.data.countryPanelOpen) this.setData({ countryPanelOpen: false }); } catch(_){}
    this.__panelClosing = false;
    try { const en = this.__normalizeToCanvasTouches(e); onTouchMove(en); } catch(_){}
  },

  // 遮罩层触摸：同样立即关闭并把事件转交到渲染层
  onMaskTouchStart(e){
    // 遮罩同上：touchstart 不关，第一次 move 关；坐标统一为 canvas
    try { const en = this.__normalizeToCanvasTouches(e); onTouchStart(en); } catch(_){}
    this.__maskClosing = true;
  },
  onMaskTouchMove(e){
    try { if (this.__maskClosing && this.data.countryPanelOpen) this.setData({ countryPanelOpen: false }); } catch(_){}
    this.__maskClosing = false;
    try { const en = this.__normalizeToCanvasTouches(e); onTouchMove(en); } catch(_){}
  },

  // 吃掉底部缩放条的触摸事件，避免冒泡到 WebGL canvas
  onCatchTouchMove(){ /* 吃掉事件即可 */ },

  // PC 端滚轮缩放：使用 scroll-view 的 bindscroll 事件，读取 deltaY 并映射到 setZoom
  onWheelZoom(e){
    // 若刚刚在渲染层处理过同一次滚轮，则跳过本次，避免双触发
    const now = Date.now();
    const last = this.__lastWheelHandled || 0;
    if (now - last < 80) { return; }
    try {
      const dy = (e && e.detail) ? (e.detail.deltaY ?? 0) : 0;
      if (dy !== 0) {
        const step = dy > 0 ? -0.08 : 0.08; // 与 main.js 保持一致的步长感受
        const next = Math.max(0.6, Math.min(2.86, this.data.uiZoom + step));
        if (next !== this.data.uiZoom) {
          this.setData({ uiZoom: next });
          setZoom(next);
        }
      }
    } catch(_){}
    // 将滚动位置拉回 0，避免界面真的滚动
    if (this.data.scrollTop !== 0) this.setData({ scrollTop: 0 });
  },

  // 渲染层调用：标记最近一次滚轮已处理，页面层据此忽略重复事件
  __markWheelHandled(){ this.__lastWheelHandled = Date.now(); },

  // 原 slider 交互：拖动预览与释放确认（双向同步）
  onZoomChanging(e){
    const val = Number(e?.detail?.value);
    if (!isNaN(val)) { this.setData({ uiZoom: val }); setZoom(val); }
  },
  onZoomChange(e){
    const val = Number(e?.detail?.value);
    if (!isNaN(val)) { this.setData({ uiZoom: val }); setZoom(val); }
  },
  onZoomPlus(){
    const next = Math.min(2.2, this.data.uiZoom + 0.08);
    this.setData({ uiZoom: next }); setZoom(next);
  },
  onZoomMinus(){
    const next = Math.max(0.6, this.data.uiZoom - 0.08);
    this.setData({ uiZoom: next }); setZoom(next);
  },

  // 每帧钩子：由 main.js 的 render 调用
  onRenderTick(){
    try {
      // 改为仅驱动 3D 文本文字可见性/透明度更新，不再 setData 到 WXML
      updateLabels();
      // 城市淡点每帧更新：呼吸与距离/背面淡化
      const ctx = getRenderContext();
      if (ctx && ctx.camera) { updateCityMarkers(ctx.camera, Date.now()); }
    } catch (e) { /* noop */ }
  },
  // —— UI 交互：设置面板
  // 点击顶部“设定”按钮：关闭国家面板，打开设定面板（不再切换为关闭）
  onToggleSettings(){
    this.setData({ countryPanelOpen: false, settingsOpen: true });
  },
  onCloseSettings(){ if (this.data.settingsOpen) this.setData({ settingsOpen: false }); },
  
  // 切换“禅定模式”按钮：进入/退出，仅控制 UI 显隐与面板关闭
  onToggleZenMode(){
    const next = !this.data.zenMode;
    if (next) {
      this.setData({
        zenMode: true,
        settingsOpen: false,
        searchOpen: false,
        countryPanelOpen: false,
      });
      // 页面层调用渲染层进入禅定：动画倾斜23°并稍微缩小，锁定交互
      try { setZenMode(true); } catch(_){}
    } else {
      this.setData({ zenMode: false });
      // 退出禅定：恢复先前视角并解除锁定
      try { setZenMode(false); } catch(_){}
    }
  },

  // “切”按钮：后续用于切换音乐与诗句组合，这里先占位
  onToggleCut(){
    try {
      const msg = this.data.lang === 'zh' ? '切换预设（占位）' : 'Switch preset (stub)';
      this.setData({ hoverText: msg });
      setTimeout(() => { this.setData({ hoverText: '' }); }, 1200);
    } catch(_) {}
  },
  onToggleNight(e){ const on = !!(e?.detail?.value); this.setData({ nightMode: on }); setNightMode(on); },
  onToggleCloud(e){ const on = !!(e?.detail?.value); this.setData({ showCloud: on }); setCloudVisible(on); },
  // 小型开关按钮统一入口
  onToggleOption(e){
    const key = e?.currentTarget?.dataset?.key;
    const valStr = e?.currentTarget?.dataset?.val;
    const on = String(valStr) === 'true';
    if (key === 'nightMode') { this.setData({ nightMode: on }); setNightMode(on); }
    else if (key === 'showCloud') { this.setData({ showCloud: on }); setCloudVisible(on); }
  },
  onSetLabelQty(e){
    const v = e?.currentTarget?.dataset?.val || e?.detail?.value || 'default';
    let n = 22; // 默认
    if (v === 'none') n = 0; else if (v === 'few') n = 10; else if (v === 'many') n = 60; else n = 22;
    this.setData({ labelQty: v }); setLabelsBudget(n);
  },
  onSetCityTier(e){
    const v = e?.currentTarget?.dataset?.val || e?.detail?.value || 'more';
    this.setData({ cityTier: v });
    // 重建标签以应用城市过滤
    this.rebuildLabelsByLang(this.data.lang);
  },
  onToggleLang(){
    const next = this.data.lang === 'zh' ? 'en' : 'zh';
    const labels = this.data.uiLabels[next] || this.data.uiLabels.zh;
    this.setData({ lang: next, labels });
    // 若国家面板仍打开，更新标题时区后缀的括号样式
    this.updateCountryTitleSuffix();
    this.rebuildLabelsByLang(next);
    // 等宽改为纯 CSS，无需重新测量
  },
  rebuildLabelsByLang(lang, featuresArg){
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
          FR: { lon: 2.2137, lat: 46.2276 },
          FRA: { lon: 2.2137, lat: 46.2276 },
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
        try { console.info(`[labels rebuild] base=${baseLabels.length}, city=${cityLabels.length}, total=${total}`); } catch(_){}
      } else {
        // 特征未加载时仅提示一次，避免日志刷屏；等待 onCountriesLoaded 回调统一重建
        if (!this.__rebuildWarnedOnce) {
          try { console.warn('[labels rebuild] features not ready yet; will rebuild after load'); } catch(_){ }
          this.__rebuildWarnedOnce = true;
        }
      }
    } catch (e) { console.warn('[labels rebuild] failed:', e); }
  },
  // 云端拉取城市数据（一次性缓存 + 回退）
  async preloadCitiesCloud(){
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
    // 数据加载完成后，按当前语言重建一次（走同一逻辑），保持行为一致
    this._features = features;
    this.rebuildLabelsByLang(this.data.lang, features);
  },
  // main.js 点选国家后触发：强行显示该国家的标签（直到用户取消选中）
  async onCountryPicked(hit){
    try {
      // 空白点击：直接关闭面板并清除强制标签
      if (!hit) {
        setForcedLabel(null);
        try { this.__lastForcedId = null; this.__keepCityForcedUntil = 0; } catch(_){}
        try { clearForcedCityCountries(); } catch(_){}
        this.setData({ countryPanelOpen: false, countryInfo: null });
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
      // 组装展示数据（优先使用 country_data.json 中的元信息）
      const lang = this.data.lang;
      const meta = code ? (await this.fetchCountryMetaCloud(code)) : null;
      // 数据源标记：云/本地
      const sourceLabel = (meta?.__source === 'cloud') ? (lang === 'zh' ? '云' : 'Cloud') : (lang === 'zh' ? '本地' : 'Local');
      const nameEn = meta?.NAME_EN || p.NAME_EN || p.ADMIN_EN || p.NAME_LONG_EN || p.NAME || p.ADMIN || '';
      const nameZh = meta?.NAME_ZH || p.NAME_ZH || p.ADMIN_ZH || p.NAME || p.ADMIN || '';
      const displayName = lang === 'zh' ? (nameZh || nameEn) : (nameEn || nameZh || (code || '未知'));
      const capital = lang === 'zh' ? (meta?.CAPITAL_ZH || '') : (meta?.CAPITAL_EN || '');
      const areaKm2 = meta?.AREA_KM2 ? meta.AREA_KM2.toLocaleString('en-US') : (p.AREA ? Math.round(p.AREA).toLocaleString('en-US') : '--');
      const population = meta?.POPULATION ? meta.POPULATION.toLocaleString('en-US') : '--';
      const gdpVal = (typeof meta?.GDP_USD_TRILLION === 'number') ? meta.GDP_USD_TRILLION : null;
      const gdp = (gdpVal !== null) ? gdpVal.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '--';
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
    try {
      if (!tzName) return '';
      const parts = Intl.DateTimeFormat('en-US', { timeZone: tzName, timeZoneName: 'shortOffset' }).formatToParts(new Date());
      const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
      const m = tzPart.match(/GMT[+-]\d{1,2}(?::\d{2})?/i);
      if (m) return m[0].replace(':00','');
      // 兜底：常见 IANA 名称固定偏移（不考虑夏令时）
      const MAP = {
        'Asia/Shanghai': 'GMT+8',
        'Asia/Beijing': 'GMT+8',
        'Asia/Taipei': 'GMT+8',
        'Asia/Hong_Kong': 'GMT+8',
        'Asia/Macau': 'GMT+8',
      };
      return MAP[tzName] || '';
    } catch(_) { return ''; }
  },
  // 根据当前语言与偏移字符串，生成标题后缀
  updateCountryTitleSuffix(){
    try {
      const info = this.data.countryInfo;
      if (!info) return;
      const offset = info.tzOffsetStr || '';
      const suffix = offset ? (this.data.lang === 'zh' ? `（${offset}）` : ` (${offset})`) : '';
      this.setData({ countryInfo: { ...info, titleTzSuffix: suffix } });
    } catch(_){ }
  },
  // —— 布局：根据安全区/顶栏/时区胶囊动态计算国家面板顶部
  updateTopOffsets(){
    try {
      const sys = wx.getSystemInfoSync() || {};
      const safeTop = (sys.safeArea && typeof sys.safeArea.top === 'number') ? sys.safeArea.top : (sys.statusBarHeight || 0);
      const topBarGap = 8;      // 顶栏与安全区之间的间距（与 CSS 保持一致）
      const timeHeight = 40;    // 时间胶囊高度
      const tipTopGap = 6;      // 时间胶囊与时区胶囊之间的间距（与 CSS 一致）
      const tipHeight = this.data.hoverText ? 26 : 0; // 时区胶囊估算高度（保持紧凑）
      // 面板与时区胶囊距离：缩小约 60%（原 4/8 → 2/3）
      const margin = this.data.hoverText ? 2 : 3;
      const panelTop = Math.round((safeTop || 0) + topBarGap + timeHeight + (this.data.hoverText ? (tipTopGap + tipHeight + margin) : margin));
      if (panelTop !== this.data.countryPanelTop) {
        this.setData({ countryPanelTop: panelTop });
      }
    } catch(_){ }
  },
  onCloseCountryPanel(){ this.setData({ countryPanelOpen: false }); },
  // 按你的要求：不再提供“取消选中”按钮；若需要清空可通过遮罩点击关闭或重新点击地图
});