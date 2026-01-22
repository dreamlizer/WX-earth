
import { convertLatLonToVec3 } from './geography.js';
import * as _const from './label-constants.js';

// 常量定义 (保留原有默认值逻辑)
const SCORE_THRESHOLD = _const?.SCORE_THRESHOLD ?? 0.0;
const COUNTRY_MIN_WINNERS = _const?.COUNTRY_MIN_WINNERS ?? 6;
const CITY_FORCED_AUTO_CLEAR_MS = _const?.CITY_FORCED_AUTO_CLEAR_MS ?? 5000;

// 数据状态
let BASE_LABELS = [];
const BASE_LABEL_MAP = new Map(); // id -> Meta
let FORCED_ID = null;
let FORCED_SINCE = 0;
let FORCED_CLEAR_TIMER = null;
let FORCED_CITY_CODES = new Set();

// 评分函数
function scoreLabel(lb) {
  if (typeof lb.score === 'number') return lb.score;
  const base = 1.0;
  const bonus = (lb.population ? Math.log10(lb.population + 1) : 0)
              + (lb.area ? Math.log10(lb.area + 1) * 0.5 : 0);
  return base + bonus;
}

// 稳定随机
export function stableRand(id){
  let h = 2166136261;
  const s = String(id);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24); }
  h = h >>> 0;
  return (h % 1000) / 1000;
}

// 核心数据管理类
export const LabelsData = {
  get BASE_LABELS() { return BASE_LABELS; },
  get BASE_LABEL_MAP() { return BASE_LABEL_MAP; },
  get FORCED_ID() { return FORCED_ID; },
  get FORCED_SINCE() { return FORCED_SINCE; },
  get FORCED_CITY_CODES() { return FORCED_CITY_CODES; },

  init(list) {
    const arr = Array.isArray(list) ? list : [];
    BASE_LABEL_MAP.clear();
    arr.forEach((lb, i) => {
      const lon = lb.lon;
      const lat = lb.lat;
      let baseVec3 = lb.baseVec3;
      if ((!baseVec3) && typeof lon === 'number' && typeof lat === 'number') {
        baseVec3 = convertLatLonToVec3(lon, lat, 1.0);
      }
      const id = lb.id ?? lb.text ?? String(i);
      const text = lb.text ?? lb.name ?? String(i);
      const meta = { 
        ...lb, id, text, baseVec3,
        isCity: !!lb.isCity,
        _score: scoreLabel(lb) // 缓存分数
      };
      BASE_LABEL_MAP.set(id, meta);
    });
    BASE_LABELS = Array.from(BASE_LABEL_MAP.values());
  },

  setForcedCityCountries(list) {
    try {
      const arr = Array.isArray(list) ? list : [list];
      FORCED_CITY_CODES = new Set(arr.map(x => String(x || '').toUpperCase()).filter(Boolean));
    } catch(_){ FORCED_CITY_CODES = new Set(); }
  },

  clearForcedCityCountries() {
    FORCED_CITY_CODES = new Set();
  },

  setForcedId(id) {
    FORCED_ID = id || null;
    FORCED_SINCE = Date.now();
    
    // 自动清除计时器
    try { if (FORCED_CLEAR_TIMER) { clearTimeout(FORCED_CLEAR_TIMER); FORCED_CLEAR_TIMER = null; } } catch(_){}
    try {
      const isCity2 = (typeof FORCED_ID === 'string') && /^CITY_/i.test(FORCED_ID);
      if (isCity2) {
        FORCED_CLEAR_TIMER = setTimeout(() => {
          if ((typeof FORCED_ID === 'string') && /^CITY_/i.test(FORCED_ID)) {
            FORCED_ID = null;
          }
          FORCED_CLEAR_TIMER = null;
        }, Math.max(2000, CITY_FORCED_AUTO_CLEAR_MS));
      }
    } catch(_){}
  },

  clearForcedLabel() {
    FORCED_ID = null;
  },

  // 尝试注入临时标签（如果是城市且不存在）
  ensureTempLabel(ident, opt) {
    const isCity = (typeof ident === 'string') && /^CITY_/i.test(ident);
    const notExists = !!ident && !BASE_LABEL_MAP.has(ident);
    const hasPos = Number.isFinite(opt?.lat) && Number.isFinite(opt?.lon);

    if (isCity && notExists && hasPos) {
      const textFromId = (() => {
        try {
          const m = /^CITY_([A-Z]{2,3})_(.+)$/i.exec(String(ident));
          return m ? m[2] : String(ident);
        } catch(_) { return String(ident); }
      })();
      const baseVec3 = convertLatLonToVec3(Number(opt.lon), Number(opt.lat), 1.0);
      const meta = {
        id: ident,
        text: String(opt.text || textFromId),
        isCity: true,
        lon: Number(opt.lon),
        lat: Number(opt.lat),
        score: 1.0,
        _score: 1.0,
        importance: 1,
        country: (() => { const m=/^CITY_([A-Z]{2,3})_/i.exec(String(ident)); return m?m[1].toUpperCase():null; })(),
        baseVec3
      };
      BASE_LABEL_MAP.set(ident, meta);
      // 重新同步 list
      BASE_LABELS.push(meta); 
      return true; // 表示发生了注入
    }
    return false;
  },

  // 更新现有标签文本
  updateLabelText(id, text) {
    const meta = BASE_LABEL_MAP.get(id);
    if (meta) {
      meta.text = String(text);
      return true;
    }
    return false;
  },
  
  getMeta(id) {
    return BASE_LABEL_MAP.get(id);
  }
};
