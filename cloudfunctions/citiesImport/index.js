const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 云函数：citiesImport
 * 用途：批量写入/更新集合 `cities`（用于无法通过控制台导入时的应急路径）。
 * 入口：type='bulkUpsert', items=[...]
 */
exports.main = async (event, context) => {
  const type = String(event?.type || 'bulkUpsert');

  const normalizeCity = (x) => ({
    name_en: String(x?.name_en || x?.en || x?.name || ''),
    name_zh: String(x?.name_zh || x?.zh || ''),
    lat: Number(x?.lat),
    lon: Number(x?.lon),
    country_code: String(x?.country_code || x?.cc || '').toUpperCase(),
    importance: typeof x?.importance === 'number' ? x.importance : (typeof x?.score === 'number' ? x.score : 1),
  });

  const makeId = (c) => {
    const base = (c.name_en || c.name_zh || 'CITY').replace(/\s+/g, '_');
    const cc = c.country_code || 'UNK';
    return `CITY_${cc}_${base}`.slice(0, 100);
  };

  if (type === 'bulkUpsert') {
    try {
      const items = Array.isArray(event?.items) ? event.items : [];
      if (!items.length) return { success: false, error: 'items required' };
      const coll = db.collection('cities');
      const tasks = [];
      for (const x of items) {
        const c = normalizeCity(x);
        if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue;
        const _id = makeId(c);
        const data = { _id, ...c };
        tasks.push((async () => {
          try { await coll.doc(_id).update({ data }); return { ok: 1, id: _id, mode: 'update' }; }
          catch (_) { await coll.add({ data }); return { ok: 1, id: _id, mode: 'add' }; }
        })());
        if (tasks.length >= 20) { await Promise.all(tasks); tasks.length = 0; }
      }
      if (tasks.length) await Promise.all(tasks);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  return { success: false, error: 'unknown type' };
};