// 抽离：搜索建议构建工具（纯函数）
// 说明：保持与 gl/index.js 原逻辑一致，支持中文/英文/拼音匹配，优先城市、后国家，最多 10 条
// 依赖：countryMeta（国家中文/英文名及拼音）、cities（本地城市数据）、getCountries（国家要素）

import { getCountries } from './main.js';
import countryMeta from './country_data.js';
import { cities } from '../../assets/data/cities_data.js';

/**
 * 构建搜索候选列表（纯函数）
 * @param {string} q - 输入关键词
 * @param {object} options - 可选上下文
 * @param {string} options.lang - 语言：'zh' 或 'en'（默认 'zh'）
 * @param {Array} options.features - 预加载的国家要素（可选，默认内部 getCountries()）
 * @param {Array} options.citiesCloud - 云端预载城市（可选，默认使用本地 cities）
 * @returns {Array<{type:string, display:string, lat:number, lon:number, id:string}>}
 */
export function buildSearchSuggestions(q, { lang = 'zh', features, citiesCloud } = {}) {
  const isZh = /[\u4e00-\u9fa5]/.test(q);
  const lower = String(q || '').toLowerCase();
  const maxN = 10;

  // 国家数据（使用传入 features 或回退至 getCountries）
  const fea = Array.isArray(features) && features.length ? features : (getCountries() || []);
  const CONTINENT_TRANSLATIONS = {
    'North America': '北美洲', 'South America': '南美洲', 'Europe': '欧洲', 'Asia': '亚洲',
    'Africa': '非洲', 'Oceania': '大洋洲', 'Antarctica': '南极洲'
  };
  const countries = (fea || []).map(f => {
    const p = f?.props || {};
    const isoA3 = String(p.ISO_A3 || '').toUpperCase();
    const isoA2 = String(p.ISO_A2 || p.ISO || p.ISO2 || p.CC || '').toUpperCase();
    const metaKey = isoA2 || isoA3 || '';
    const meta = (metaKey && countryMeta && countryMeta[metaKey]) ? countryMeta[metaKey] : {};
    const nameEn = p.NAME_EN || p.ADMIN_EN || meta?.NAME_EN || p.NAME || p.ADMIN || '';
    const nameZh = p.NAME_ZH || p.ADMIN_ZH || meta?.NAME_ZH || p.NAME || p.ADMIN || '';
    const continent = p.CONTINENT || '';
    const zhCont = CONTINENT_TRANSLATIONS[continent] || continent || '';
    const cx = (f.bbox[0] + f.bbox[2]) * 0.5; // 经度中心
    const cy = (f.bbox[1] + f.bbox[3]) * 0.5; // 纬度中心
    const pyFull = meta?.PINYIN_FULL || '';
    const pyIni = meta?.PINYIN_INITIAL || '';
    return {
      type: 'country',
      name_en: nameEn,
      name_zh: nameZh,
      continent_zh: zhCont,
      lon: cx, lat: cy,
      key_en: String(nameEn).toLowerCase(),
      key_zh_pinyin: pyFull,
      key_zh_pinyin_ini: pyIni,
      id: (isoA3 || isoA2 || p.ISO || '')
    };
  });

  // 城市数据：优先云端预载，回退本地 assets
  const arrCities = Array.isArray(citiesCloud) && citiesCloud.length ? citiesCloud : cities;
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
      key_zh_pinyin: String(c.pinyin_full || ''),
      key_zh_pinyin_ini: String(c.pinyin_initial || ''),
      id: `CITY_${c.country_code || 'UNK'}_${c.name_en || nameZh || ''}`
    };
  });

  // 过滤规则：中文按中文名包含；英文/拼音按英文包含 + 拼音全拼包含 + 拼音首字母前缀
  const matchItem = (it) => {
    if (isZh) {
      return (it.name_zh || '').includes(q);
    } else {
      const hitEn = String(it.key_en || '').includes(lower);
      const hitPyFull = String(it.key_zh_pinyin || '').includes(lower);
      const hitPyIni  = String(it.key_zh_pinyin_ini || '').startsWith(lower);
      return hitEn || hitPyFull || hitPyIni;
    }
  };

  const pickLabel = (it) => {
    if (it.type === 'city') {
      const nm = (lang === 'zh' ? (it.name_zh || it.name_en) : (it.name_en || it.name_zh));
      const cn = (lang === 'zh' ? (it.country_zh || it.country_en) : (it.country_en || it.country_zh));
      return `${nm}（${cn || '--'}）`;
    } else {
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

  return list;
}