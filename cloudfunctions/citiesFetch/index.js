const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 云函数：citiesFetch
 * 用途：从云数据库集合 `cities` 读取城市数据；支持全量或按国家代码筛选。
 * 兼容两种存储方式：
 * 1) 每条文档是一座城市（推荐），字段示例：
 *    { name_en, name_zh, lat, lon, country_code, importance }
 * 2) 单条文档包含数组字段 `list` 或 `cities`，元素结构同上。
 */
exports.main = async (event, context) => {
  const type = String(event?.type || 'list');
  const coll = db.collection('cities');

  // 统一结果字段的归一化
  const normalizeCity = (x) => ({
    name_en: String(x?.name_en || x?.en || x?.name || ''),
    name_zh: String(x?.name_zh || x?.zh || ''),
    lat: Number(x?.lat),
    lon: Number(x?.lon),
    country_code: String(x?.country_code || x?.cc || x?.ISO_A2 || x?.ISO_A3 || '').toUpperCase(),
    importance: typeof x?.importance === 'number' ? x.importance : (typeof x?.score === 'number' ? x.score : 1),
  });

  // 读取单文档数组形态
  const tryReadSingleDocArray = async () => {
    try {
      const s = await coll.limit(1).get();
      const one = (s && s.data && s.data.length) ? s.data[0] : null;
      if (!one) return null;
      const arr = Array.isArray(one.list) ? one.list : (Array.isArray(one.cities) ? one.cities : null);
      if (Array.isArray(arr)) {
        return arr.map(normalizeCity).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon));
      }
    } catch (_) {}
    return null;
  };

  if (type === 'list') {
    try {
      // 先尝试单文档数组形态
      const fromSingle = await tryReadSingleDocArray();
      if (Array.isArray(fromSingle)) {
        return { success: true, data: fromSingle };
      }

      // 常规：逐批分页读取所有文档
      const batch = 100;
      let skip = 0;
      let all = [];
      while (true) {
        const r = await coll.skip(skip).limit(batch).get();
        const arr = (r && r.data) ? r.data : [];
        if (!arr.length) break;
        all = all.concat(arr);
        if (arr.length < batch) break;
        skip += batch;
        // 安全上限，避免误读超大集合导致长时间阻塞
        if (skip > 10000) break;
      }
      const normalized = all.map(normalizeCity).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon));
      return { success: true, data: normalized };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  if (type === 'byCountry') {
    const code = String(event?.code || '').toUpperCase();
    if (!code) return { success: false, error: 'code required' };
    try {
      // 优先常规文档形态
      const r = await coll.where({ country_code: code }).limit(1000).get();
      const arr = (r && r.data) ? r.data : [];
      if (arr.length) {
        return { success: true, data: arr.map(normalizeCity).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon)) };
      }
      // 其次单文档数组形态
      const fromSingle = await tryReadSingleDocArray();
      const filtered = Array.isArray(fromSingle) ? fromSingle.filter(c => c.country_code === code) : [];
      return { success: true, data: filtered };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  return { success: false, error: 'unknown type' };
};