// 负责：语言切换、标签数量与城市级别、标签重建与城市淡点初始化
import { getCountries, getRenderContext } from './main.js';
import { initLabels, setLabelsBudget } from './labels.js';
import { initCityMarkers } from './city-markers.js';
import { ENABLE_CITY_LABELS, INTERACTION_DEBUG_LOG, LABELS_DEBUG_LOG } from './label-constants.js';
import { cities } from '../../assets/data/cities_data.js';

export class LabelsManager {
  constructor(page){ this.page = page; }

  onSetLabelQty(e){
    const v = e?.currentTarget?.dataset?.val || e?.detail?.value || 'default';
    let n = 22; // 默认
    if (v === 'none') n = 0; else if (v === 'few') n = 10; else if (v === 'many') n = 60; else n = 22;
    this.page.setData({ labelQty: v }); setLabelsBudget(n);
  }

  onSetCityTier(e){
    const v = e?.currentTarget?.dataset?.val || e?.detail?.value || 'more';
    this.page.setData({ cityTier: v });
    this.rebuildLabelsByLang(this.page.data.lang);
  }

  onToggleLang(){
    const next = this.page.data.lang === 'zh' ? 'en' : 'zh';
    const labels = this.page.data.uiLabels[next] || this.page.data.uiLabels.zh;
    this.page.setData({ lang: next, labels });
    try { this.page.updateCountryTitleSuffix && this.page.updateCountryTitleSuffix(); } catch(_){}
    this.rebuildLabelsByLang(next);
  }

  rebuildLabelsByLang(lang, featuresArg){
    try {
      if (Array.isArray(featuresArg) && featuresArg.length) { this.page._features = featuresArg; }
      const features = (Array.isArray(featuresArg) && featuresArg.length)
        ? featuresArg
        : (Array.isArray(this.page._features) && this.page._features.length ? this.page._features : getCountries());
      if (Array.isArray(features) && features.length) {
        if (!this.page._countryDict) {
          try { this.page._countryDict = require('./country_data.js').default || require('./country_data.js'); } catch(_) { this.page._countryDict = null; }
        }
        const dict = this.page._countryDict || {};
        const POS_OVERRIDES = {
          US: { lon: -98.8433, lat: 38.2847 },
          USA: { lon: -98.8433, lat: 38.2847 },
          RU: { lon: 105.0, lat: 61.0 },
          RUS: { lon: 105.0, lat: 61.0 },
          FR: { lon: 2.8, lat: 49.0 },
          FRA: { lon: 2.8, lat: 49.0 },
        };
        const baseLabels = features.map((f, idx) => {
          const p = f.props || {};
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

        let cityLabels = [];
        const cloudCities = Array.isArray(this.page._citiesCloud) && this.page._citiesCloud.length ? this.page._citiesCloud : null;
        const srcCities = cloudCities || (Array.isArray(cities) ? cities : []);
        if (ENABLE_CITY_LABELS && Array.isArray(srcCities) && srcCities.length) {
          const tier = this.page.data.cityTier || 'more';
          let filtered = srcCities;
          if (tier === 'none') {
            filtered = [];
          } else if (tier === 'key') {
            filtered = srcCities.filter(c => Math.round(Number(c.importance || 0)) === 1);
          } else {
            filtered = srcCities.filter(c => Number(c.importance || 0) >= 1);
          }
          cityLabels = filtered.map((c, i) => {
            const text = (lang === 'zh') ? (c.name_zh || c.name_en || `City#${i}`) : (c.name_en || c.name_zh || `City#${i}`);
            const id = `CITY_${c.country_code || 'UNK'}_${c.name_en || text}`;
            const score = (typeof c.importance === 'number') ? (1.0 + c.importance) : 1.0;
            const importance = (typeof c.importance === 'number') ? Math.round(c.importance) : 1;
            return { id, text, isCity: true, lon: c.lon, lat: c.lat, score, importance, country: c.country_code || null };
          });
          try { if (INTERACTION_DEBUG_LOG) console.log(`[settings] 城市显示: ${tier}, labels=${cityLabels.length}`); } catch(_){}

          const ctx = getRenderContext();
          if (ctx && ctx.THREE && ctx.globeGroup) {
            initCityMarkers(ctx.THREE, ctx.globeGroup, filtered);
          }
        }
        const total = baseLabels.length + cityLabels.length;
        initLabels(baseLabels.concat(cityLabels));
        try { if (LABELS_DEBUG_LOG) console.info(`[labels rebuild] base=${baseLabels.length}, city=${cityLabels.length}, total=${total}`); } catch(_){}
      } else {
        if (!this.page.__rebuildWarnedOnce) {
          try { if (LABELS_DEBUG_LOG) console.warn('[labels rebuild] features not ready yet; will rebuild after load'); } catch(_){ }
          this.page.__rebuildWarnedOnce = true;
        }
      }
    } catch (e) { console.warn('[labels rebuild] failed:', e); }
  }

  // 国家数据加载完成后统一入口：缓存 features 并依当前语言重建标签
  onCountriesLoaded(features){
    try {
      if (Array.isArray(features) && features.length) {
        this.page._features = features;
      }
    } catch(_) {}
    return this.rebuildLabelsByLang(this.page?.data?.lang || 'zh', features);
  }

  async preloadCitiesCloud(){
    if (!(wx && wx.cloud && typeof wx.cloud.callFunction === 'function')) {
      try { if (INTERACTION_DEBUG_LOG) console.warn('[cities] 云能力不可用，跳过预加载'); } catch(_){}
      this.page._citiesCloud = null;
      return;
    }
    try {
      const { result } = await wx.cloud.callFunction({ name: 'citiesFetch', data: { type: 'list' } });
      const arr = result && Array.isArray(result.data) ? result.data : [];
      if (arr.length) {
        this.page._citiesCloud = arr.map(x => ({
          name_en: x.name_en || '',
          name_zh: x.name_zh || '',
          lat: Number(x.lat),
          lon: Number(x.lon),
          country_code: String(x.country_code || '').toUpperCase(),
          importance: typeof x.importance === 'number' ? x.importance : 1,
        })).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon));
        try { if (INTERACTION_DEBUG_LOG) console.log(`[cities] 云端加载 ${this.page._citiesCloud.length} 条`); } catch(_){}
        this.rebuildLabelsByLang(this.page.data.lang);
      }
    } catch (e) {
      try { if (INTERACTION_DEBUG_LOG) console.warn('[cities] 云端读取失败，回退本地：', e); } catch(_){}
      this.page._citiesCloud = null;
    }
  }
}