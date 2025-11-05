const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 云函数：countryMeta
 * 用途：按国家代码（ISO_A3/ISO_A2）返回国家信息；后续可在云数据库更新。
 * 约定：集合名 `country_meta`，推荐每条记录 _id=国家代码（如 'USA'）。
 */
exports.main = async (event, context) => {
  const type = String(event?.type || 'get');
  if (type === 'get') {
    const code = String(event?.code || '').toUpperCase();
    if (!code) return { success: false, error: 'code required' };
    try {
      // 优先按 _id 命中
      try {
        const r = await db.collection('country_meta').doc(code).get();
        if (r && r.data) return { success: true, data: r.data };
      } catch (_) {}
      // 其次按字段 code 命中
      const q = await db.collection('country_meta').where({ code }).limit(1).get();
      if (q.data && q.data.length) return { success: true, data: q.data[0] };
      // 兼容：如果集合中保存为“单条文档包含所有国家的字典”，则读取该文档并取键
      try {
        const s = await db.collection('country_meta').limit(1).get();
        const one = (s && s.data && s.data.length) ? s.data[0] : null;
        const fromDict = one && typeof one[code] === 'object' ? one[code] : null;
        if (fromDict) return { success: true, data: { code, ...fromDict } };
      } catch (_) {}
      return { success: true, data: null };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  if (type === 'upsert') {
    const payload = event?.data || {};
    const code = String(payload?.code || payload?._id || '').toUpperCase();
    if (!code) return { success: false, error: 'code required' };
    const data = { _id: code, code, ...payload };
    try {
      // 先尝试更新（若存在）
      await db.collection('country_meta').doc(code).update({ data });
      return { success: true, data };
    } catch (_) {
      // 不存在则新增（携带 _id）
      await db.collection('country_meta').add({ data });
      return { success: true, data };
    }
  }

  return { success: false, error: 'unknown type' };
};