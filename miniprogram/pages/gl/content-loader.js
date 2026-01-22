import { isDevtools } from './config.js';

// —— 诗句预设加载器 ——
export const loadPoetryPresets = async (APP_CFG, LOG) => {
  const __isDev = isDevtools();
  const __cloudDisabled = (APP_CFG?.cloud?.enabled === false);
  const __canCallFn = !!(!__cloudDisabled && wx && wx.cloud && typeof wx.cloud.callFunction === 'function');
  const __canDb = !!(!__cloudDisabled && wx && wx.cloud && typeof wx.cloud.database === 'function');

  const normalize = (arr) => {
    const map = {};
    const labels = {};
    for (const doc of (Array.isArray(arr) ? arr : [])) {
      const preset = Number(doc?.preset || 1);
      // 保留空文本行：用于调度时间，不做过滤
      const lines = Array.isArray(doc?.lines) ? doc.lines
        .map(l => ({ 
          text: String(l?.text ?? ''), 
          duration: Number(l?.duration || 7000), 
          ['start-time']: Number.isFinite(Number(l?.['start-time'])) ? Number(l?.['start-time']) : undefined 
        })) : [];
      if (lines.length) map[preset] = lines;
      if (typeof doc?._id === 'string') labels[preset] = doc._id;
    }
    return { map, labels };
  };

  // 更稳健的错误处理：任何一步失败都继续尝试后续来源
  const safeCallFn = async (fnName) => {
    try {
      const { result } = await wx.cloud.callFunction({ name: fnName, data: { type: 'list' } });
      const arr = result && Array.isArray(result.data) ? result.data : [];
      return normalize(arr);
    } catch (e) {
      try { console.warn('[poetry] 云函数调用失败：', fnName, e); } catch(_){}
      return { map: {}, labels: {} };
    }
  };

  let source = '';
  let res = { map: {}, labels: {} };

  // 1) 主云函数
  if (__canCallFn && !__isDev) {
    res = await safeCallFn('poetrySets');
    if (Object.keys(res.map).length) { source = 'cloud-fn:poetrySets'; }
  }

  // 2) 备用云函数名
  if (__canCallFn && !__isDev && !Object.keys(res.map).length) {
    const r2 = await safeCallFn('poetrySetsV2');
    if (Object.keys(r2.map).length) { res = r2; source = 'cloud-fn:poetrySetsV2'; }
  }

  // 3) 直接读取数据库（无需云函数权限）
  if (!Object.keys(res.map).length && __canDb) {
    try {
      const db = wx.cloud.database();
      const r = await db.collection('poetry_sets').limit(100).get();
      const arr = Array.isArray(r?.data) ? r.data : [];
      res = normalize(arr);
      if (Object.keys(res.map).length) { source = 'db:poetry_sets'; console.info('[poetry] 直接从数据库读取成功'); }
    } catch(dbErr){ try { console.warn('[poetry] 数据库直接读取失败：', dbErr); } catch(_){} }
  }

  // 4) 本地兜底 JSON
  if (!Object.keys(res.map).length) {
    try {
      const local = require('../../assets/data/poetry_sets.json');
      res = normalize(local);
      source = 'local:poetry_sets.json';
      console.warn('[poetry] 使用本地回退 JSON');
    } catch(_){ }
  }

  return { map: res.map, labels: res.labels, source: source || 'unknown' };
};

export const loadPoetryLabelsFromDB = async () => {
  if (wx.cloud && typeof wx.cloud.database === 'function') {
    try {
      const db = wx.cloud.database();
      const r = await db.collection('poetry_sets').limit(100).field({ _id: true, preset: true }).get();
      const arr = Array.isArray(r?.data) ? r.data : [];
      const labels = {};
      for (const d of arr) { 
        const p = Number(d?.preset || NaN); 
        if (!isNaN(p) && typeof d?._id === 'string') labels[p] = d._id; 
      }
      return labels;
    } catch(_){ }
  }
  return {};
};

// —— Special (彩蛋) 文本加载器 ——
export const loadSpecialTexts = async (APP_CFG, LOG) => {
  const fallback = ['你好，宇宙'];
  if (isDevtools() || APP_CFG?.cloud?.enabled === false || !(wx && wx.cloud)) {
    return fallback;
  }
  try {
    // 直接读取数据库集合：Special
    const db = wx.cloud.database();
    const r = await db.collection('Special').limit(50).get();
    const arr = Array.isArray(r?.data) ? r.data : [];
    const texts = arr.map(d => String(d?.slogan || d?.string || d?.text || '')).filter(s => s.length > 0);
    const items = texts.length ? texts : fallback;
    LOG.info('[special] 加载', items.length, '条');
    return items;
  } catch(e){ return fallback; }
};
