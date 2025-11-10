// 云函数：poetrySets
// 职责：提供诗句预设的读取（list）与更新（upsert），存储于云数据库 `poetry_sets`
// 部署：微信开发者工具 → 云开发 → 上传并部署（云端安装依赖）

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function normalizeLines(lines){
  const arr = Array.isArray(lines) ? lines : [];
  return arr.map(l => ({
    text: String(l && l.text ? l.text : ''),
    duration: Number(l && l.duration != null ? l.duration : 7000)
  })).filter(x => x.text.length > 0);
}

exports.main = async (event, context) => {
  const db = cloud.database();
  const coll = db.collection('poetry_sets');
  const type = event && event.type ? event.type : 'list';
  const now = Date.now();
  try {
    if (type === 'list') {
      const res = await coll.limit(100).get();
      return { data: Array.isArray(res && res.data) ? res.data : [] };
    }
    if (type === 'upsert') {
      const preset = Number(event && event.preset != null ? event.preset : 1);
      const lines = normalizeLines(event && event.lines);
      const id = `preset_${preset}`;
      const doc = { _id: id, preset, lines, updatedAt: now };
      try {
        await coll.doc(id).set({ data: doc });
      } catch (e) {
        try { await coll.doc(id).update({ data: doc }); }
        catch (e2) { await coll.add({ data: doc }); }
      }
      return { ok: true, id, count: lines.length };
    }
    return { ok: false, error: 'unknown type' };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
};