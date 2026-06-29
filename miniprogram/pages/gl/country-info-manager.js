// 国家信息管理器：负责点选国家后的数据整合与面板展示，以及标题时区后缀更新
import { setForcedLabel, setForcedCityCountries, clearForcedCityCountries } from './labels.js';
import { buildCountryTitleSuffix } from './title-utils.js';
import { getCountryOverride } from './tz-overrides.js';
import countryMeta from './country_data.js';

const formatThousandsInt = (n) => {
  try {
    const v = Math.round(Number(n) || 0);
    if (!Number.isFinite(v)) return '--';
    // 统一使用正则，避免 Android/iOS toLocaleString 差异
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  } catch(_) { return '--'; }
};

const formatThousandsFixed = (n, digits = 2) => {
  try {
    const v = Number(n);
    if (!Number.isFinite(v)) return '--';
    // 保留小数位
    const fixed = v.toFixed(digits);
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  } catch(_) { return '--'; }
};

export class CountryInfoManager {
  constructor(page){
    this.page = page;
  }

  async onCountryPicked(hit, forceUpdate = false){
    const page = this.page;
    try {
      // 任何点击（无论是空白还是国家）都先尝试取消正在进行的关闭倒计时
      // 防止“旧面板关闭动画”在“新面板打开后”意外触发，导致新面板自动消失
      try { page.cancelPanelCloseTimer?.(); } catch(_){}
      if (!hit) {
              setForcedLabel(null);
              try { page.__lastForcedId = null; page.__keepCityForcedUntil = 0; } catch(_){}
              try { clearForcedCityCountries(); } catch(_){}
              try { page.onCloseCountryPanel?.(); }
              catch(_){ try { page.setData({ countryPanelOpen: false, hoverText: '' }); } catch(__){} }
              page.setData({ countryInfo: null });
              return;
            }
            // 核心修复：一旦确认选中了有效国家，必须清除“待关闭”标记
            // 防止 index.js 的 onTouchEnd -> panelMgr.closePendingPanels 误关闭面板
            try { page.__pendingPanelsClose = false; } catch(_){}
            
            const p = hit?.props || {};
      const codeRaw = p.ISO_A3 || p.ISO_A2 || p.ISO || p.CC || p.ISO2 || null;
      const code = (codeRaw ? String(codeRaw).toUpperCase() : null);

      // —— 特殊处理：台湾点击等同于中国；同时关闭面板
      if (code === 'TWN' || code === 'TW') {
        try { setForcedLabel('CHN'); page.__lastForcedId = 'CHN'; } catch(_){}
        // 仅保留台北城市：强制台湾的城市（结合下游过滤仅保留台北）
        try { setForcedCityCountries(['TWN']); } catch(_){}
        // 关闭面板，不显示台湾专属信息
        try { page.onCloseCountryPanel?.(); }
        catch(_){ try { page.setData({ countryPanelOpen: false, hoverText: '' }); } catch(__){} }
        page.setData({ countryInfo: null });
        return;
      }

      // 若搜索城市触发了“保持城市高亮”的锁，则暂不覆盖强制标签，避免城市变小；否则正常高亮国家
      const lastForced = page.__lastForcedId || null;
      const keepCity = (Number(page.__keepCityForcedUntil || 0) > Date.now()) && (typeof lastForced === 'string') && /^CITY_/i.test(lastForced);
      if (!keepCity) {
        setForcedLabel(code || null);
        try { page.__lastForcedId = code || null; } catch(_){}
      }
      // 强制显示该国所有城市（兼容 A3/A2）
      try { setForcedCityCountries([code, p.ISO_A3, p.ISO_A2].filter(Boolean)); } catch(_){}

      // 禅定模式：允许点击国家，但不弹面板、不显示时区胶囊
      if (page.data.zenMode) {
        page.setData({ countryPanelOpen: false, hoverText: '' });
        return;
      }

      // 组装展示数据（完全使用本地 Assets 数据）
      const lang = page.data.lang;
      const meta = code ? (this.fetchCountryMeta(code)) : null;
      const sourceLabel = (lang === 'zh' ? '本地' : 'Local');
      const nameEn = meta?.NAME_EN || p.NAME_EN || p.ADMIN_EN || p.NAME_LONG_EN || p.NAME || p.ADMIN || '';
      const nameZh = meta?.NAME_ZH || p.NAME_ZH || p.ADMIN_ZH || p.NAME || p.ADMIN || '';
      const displayName = lang === 'zh' ? (nameZh || nameEn) : (nameEn || nameZh || (code || '未知'));
      const capital = lang === 'zh' ? (meta?.CAPITAL_ZH || '') : (meta?.CAPITAL_EN || '');
      const areaKm2 = meta?.AREA_KM2 ? formatThousandsInt(meta.AREA_KM2) : (p.AREA ? formatThousandsInt(Math.round(p.AREA)) : '--');
      const population = meta?.POPULATION ? formatThousandsInt(meta.POPULATION) : '--';
      const gdpVal = (typeof meta?.GDP_USD_TRILLION === 'number') ? meta.GDP_USD_TRILLION : null;
      const gdp = (gdpVal !== null) ? formatThousandsFixed(gdpVal, 2) : '--';

      let tzName = '';
      try {
        tzName = getCountryOverride({ ...(hit || {}), props: { ...(hit?.props || {}), ...p } }) || '';
      } catch(_){ tzName = ''; }
      if (!tzName) tzName = page.selectedTimezone || '';
      try {
        if (!tzName) {
          const bb = hit?.bbox || null;
          if (Array.isArray(bb) && bb.length >= 4) {
            const [minLon, minLat, maxLon, maxLat] = bb;
            const cLon = (minLon + maxLon) / 2;
            const cLat = (minLat + maxLat) / 2;
            tzName = page.tzlookup?.(cLat, cLon) || '';
          }
        }
      } catch(_){ }
      const tzOffsetStr = page.computeGmtOffsetStr(tzName);
      const timeStr = page.formatTime(new Date(), tzName);
      
      const nextInfo = { 
        code: code || '', 
        name: displayName, 
        capital, 
        areaKm2, 
        population, 
        gdp, 
        tzName, 
        tzOffsetStr, 
        time: timeStr, 
        source: sourceLabel 
      };

      const doUpdate = () => {
        page.setData({
          countryInfo: nextInfo,
          countryPanelOpen: true,
          countryPanelFading: false,
          hoverText: '' // 确保清除时区胶囊
        });
        // 不再调用 updateTopOffsets，位置已由 CSS 固定
        this.updateCountryTitleSuffix();
      };

      // 优化切换逻辑：
      // 1. 如果是同一国家，保持面板显示（若正在淡出则恢复）
      // 2. 如果是不同国家且面板已打开，先淡出再更新数据淡入
      const currentCode = page.data.countryInfo?.code;
      if (page.data.countryPanelOpen) {
        if (!forceUpdate && currentCode && code && currentCode === code) {
          // 同一国家重复点击：保持显示，如果正在淡出则立即恢复
          if (page.data.countryPanelFading) {
            page.setData({ countryPanelFading: false });
          }
          try { page.__pendingPanelsClose = false; } catch(_){}
          return;
        }
        // 不同国家（或强制刷新）：淡出 -> 切换 -> 淡入
        // 若是强制刷新（同国家），则不需要淡出动画，直接更新
        if (forceUpdate && currentCode === code) {
           doUpdate();
           return;
        }
        
        page.setData({ countryPanelFading: true });
        // 等待淡出动画（约 250ms）后更新
        setTimeout(() => { doUpdate(); }, 250);
      } else {
        // 面板未打开：直接显示
        doUpdate();
      }
    } catch(_){ setForcedLabel(null); }
  }

  updateCountryTitleSuffix(){
    const page = this.page;
    try {
      const info = page.data.countryInfo;
      if (!info) return;
      const offset = info.tzOffsetStr || '';
      const suffix = buildCountryTitleSuffix(page.data.lang || 'zh', offset);
      page.setData({ countryInfo: { ...info, titleTzSuffix: suffix } });
    } catch(_){ }
  }

  fetchCountryMeta(code){
    if (!code) return null;
    try {
      // 优先从本地 JS 数据获取
      const data = countryMeta?.[code] || null;
      if (data) {
        return { ...data, __source: 'local_js' };
      }
    } catch(e){ }
    return null;
  }

  // 云端拉取 + 本地回退 + 结果缓存
  async fetchCountryMetaCloud(code){
    try {
      if (!code) return null;
      // 使用 Page 实例上的缓存对象（如果有）或管理器内部缓存
      this._cloudMeta = this._cloudMeta || {};
      if (this._cloudMeta[code]) return this._cloudMeta[code];
      
      if (wx.cloud) {
        const { result } = await wx.cloud.callFunction({ name: 'countryMeta', data: { type: 'get', code } });
        const data = result && (result.data || null);
        if (data) {
          const mergedCloud = { ...data, __source: 'cloud' };
          this._cloudMeta[code] = mergedCloud;
          try { console.log('[meta] 云端数据', code, mergedCloud); } catch(_){}
          return mergedCloud;
        }
      }
    } catch(e){ /* ignore and fallback */ }
    
    // 回退到本地
    const local = countryMeta?.[code] || null;
    if (local) {
      const mergedLocal = { code, ...local, __source: 'local' };
      this._cloudMeta = this._cloudMeta || {};
      this._cloudMeta[code] = mergedLocal;
      try { console.log('[meta] 本地数据', code, mergedLocal); } catch(_){}
      return mergedLocal;
    }
    return null;
  }
}
