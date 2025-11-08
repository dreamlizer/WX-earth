// 国家信息管理器：负责点选国家后的数据整合与面板展示，以及标题时区后缀更新
import { setForcedLabel, setForcedCityCountries, clearForcedCityCountries } from './labels.js';
import { buildCountryTitleSuffix } from './title-utils.js';
import countryMeta from './country_data.js';

const formatThousandsInt = (n) => {
  try {
    const v = Math.round(Number(n) || 0);
    return Number.isFinite(v) ? v.toLocaleString('en-US') : '--';
  } catch(_) { return '--'; }
};

const formatThousandsFixed = (n, digits = 2) => {
  try {
    const v = Number(n);
    if (!Number.isFinite(v)) return '--';
    return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  } catch(_) { return '--'; }
};

export class CountryInfoManager {
  constructor(page){
    this.page = page;
  }

  async onCountryPicked(hit){
    const page = this.page;
    try {
      // 空白点击：直接关闭面板并清除强制标签
      if (!hit) {
        setForcedLabel(null);
        try { page.__lastForcedId = null; page.__keepCityForcedUntil = 0; } catch(_){}
        try { clearForcedCityCountries(); } catch(_){}
        page.setData({ countryPanelOpen: false, countryInfo: null });
        return;
      }
      const p = hit?.props || {};
      const codeRaw = p.ISO_A3 || p.ISO_A2 || p.ISO || p.CC || p.ISO2 || null;
      const code = (codeRaw ? String(codeRaw).toUpperCase() : null);

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

      // 组装展示数据（优先使用云端元信息，其次本地）
      const lang = page.data.lang;
      const meta = code ? (await this.fetchCountryMetaCloud(code)) : null;
      const sourceLabel = (meta?.__source === 'cloud') ? (lang === 'zh' ? '云' : 'Cloud') : (lang === 'zh' ? '本地' : 'Local');
      const nameEn = meta?.NAME_EN || p.NAME_EN || p.ADMIN_EN || p.NAME_LONG_EN || p.NAME || p.ADMIN || '';
      const nameZh = meta?.NAME_ZH || p.NAME_ZH || p.ADMIN_ZH || p.NAME || p.ADMIN || '';
      const displayName = lang === 'zh' ? (nameZh || nameEn) : (nameEn || nameZh || (code || '未知'));
      const capital = lang === 'zh' ? (meta?.CAPITAL_ZH || '') : (meta?.CAPITAL_EN || '');
      const areaKm2 = meta?.AREA_KM2 ? formatThousandsInt(meta.AREA_KM2) : (p.AREA ? formatThousandsInt(Math.round(p.AREA)) : '--');
      const population = meta?.POPULATION ? formatThousandsInt(meta.POPULATION) : '--';
      const gdpVal = (typeof meta?.GDP_USD_TRILLION === 'number') ? meta.GDP_USD_TRILLION : null;
      const gdp = (gdpVal !== null) ? formatThousandsFixed(gdpVal, 2) : '--';

      const tzName = page.selectedTimezone || '';
      const tzOffsetStr = page.computeGmtOffsetStr(tzName);
      const timeStr = page.formatTime(new Date(), tzName);

      page.setData({
        countryInfo: { code: code || '', name: displayName, capital, areaKm2, population, gdp, tzName, tzOffsetStr, time: timeStr, source: sourceLabel },
        countryPanelOpen: true
      });

      // 打开面板后刷新顶部位置，并更新标题后缀
      try { page.updateTopOffsets(); } catch(_){ }
      this.updateCountryTitleSuffix();
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

  async fetchCountryMetaCloud(code){
    try {
      if (!code) return null;
      const page = this.page;
      page._cloudMeta = page._cloudMeta || {};
      if (page._cloudMeta[code]) return page._cloudMeta[code];
      const { result } = await wx.cloud.callFunction({ name: 'countryMeta', data: { type: 'get', code } });
      const data = result && (result.data || null);
      if (data) {
        const mergedCloud = { ...data, __source: 'cloud' };
        page._cloudMeta[code] = mergedCloud;
        try { console.log('[meta] 云端数据', code, mergedCloud); } catch(_){}
        return mergedCloud;
      }
    } catch(e){ /* ignore and fallback */ }
    const local = countryMeta?.[code] || null;
    if (local) {
      const mergedLocal = { code, ...local, __source: 'local' };
      this.page._cloudMeta[code] = mergedLocal;
      try { console.log('[meta] 本地数据', code, mergedLocal); } catch(_){}
      return mergedLocal;
    }
    return null;
  }
}