const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function isAdmin(openid){
  try { const r = await db.collection('admins').doc(openid).get(); if (r && r.data) return true; } catch(_){ }
  try { const q = await db.collection('admins').where({ openid }).limit(1).get(); return !!(q.data && q.data.length); } catch(_){ }
  return false;
}

async function latestPublished(preset, lang){
  const q = await db.collection('poetry_overrides').where({ preset, lang, published: true }).orderBy('version','desc').limit(1).get();
  return (q.data && q.data[0]) || null;
}

async function latestDraft(preset, lang){
  const q = await db.collection('poetry_overrides').where({ preset, lang, published: false }).orderBy('updatedAt','desc').limit(1).get();
  return (q.data && q.data[0]) || null;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const type = String(event?.op || event?.type || 'get');
  const preset = Number(event?.preset || 1);
  const lang = String(event?.lang || 'zh');

  if (type === 'get') {
    try {
      const pub = await latestPublished(preset, lang);
      if (pub) return { success: true, data: pub };
      const draft = await latestDraft(preset, lang);
      if (draft) return { success: true, data: draft };
      return { success: true, data: null };
    } catch(e){ return { success: false, error: String(e) }; }
  }

  if (type === 'list') {
    try {
      const q = await db.collection('poetry_overrides').where({ preset, lang, published: true }).orderBy('version','desc').get();
      return { success: true, data: q.data || [] };
    } catch(e){ return { success: false, error: String(e) }; }
  }

  if (type === 'patch') {
    try {
      const admin = await isAdmin(OPENID);
      if (!admin) return { success: false, error: 'forbidden' };
      let draft = await latestDraft(preset, lang);
      const pub = await latestPublished(preset, lang);
      const nextVer = (pub && typeof pub.version === 'number') ? (pub.version + 1) : 1;
      if (!draft) {
        const base = pub || { globalOffsetMs: 0, lines: {} };
        const addRes = await db.collection('poetry_overrides').add({ data: { preset, lang, version: nextVer, published: false, globalOffsetMs: Number(base.globalOffsetMs || 0), lines: base.lines || {}, updatedBy: OPENID, updatedAt: Date.now() } });
        draft = { _id: addRes._id, preset, lang, version: nextVer, published: false, globalOffsetMs: Number(base.globalOffsetMs || 0), lines: base.lines || {} };
      }
      const delta = event?.delta || {};
      let global = Number(draft.globalOffsetMs || 0);
      const lines = { ...(draft.lines || {}) };
      if (delta && Object.prototype.hasOwnProperty.call(delta,'globalOffsetMs')) global = Number(delta.globalOffsetMs || 0);
      if (delta && Object.prototype.hasOwnProperty.call(delta,'deltaGlobalMs')) global = global + Number(delta.deltaGlobalMs || 0);
      if (delta && Object.prototype.hasOwnProperty.call(delta,'lines') && typeof delta.lines === 'object') {
        Object.keys(delta.lines).forEach(k => { const idx = Number(k); lines[idx] = Number(delta.lines[k] || 0); });
      }
      if (delta && Object.prototype.hasOwnProperty.call(delta,'lineIdx')) {
        const idx = Number(delta.lineIdx);
        const cur = Number(lines[idx] || 0);
        if (Object.prototype.hasOwnProperty.call(delta,'setMs')) { lines[idx] = Number(delta.setMs || 0); }
        else { lines[idx] = cur + Number(delta.deltaMs || 0); }
      }
      await db.collection('poetry_overrides').doc(draft._id).update({ data: { globalOffsetMs: global, lines, updatedBy: OPENID, updatedAt: Date.now() } });
      const r = await db.collection('poetry_overrides').doc(draft._id).get();
      return { success: true, data: r.data };
    } catch(e){ return { success: false, error: String(e) }; }
  }

  if (type === 'publish') {
    try {
      const admin = await isAdmin(OPENID);
      if (!admin) return { success: false, error: 'forbidden' };
      const draft = await latestDraft(preset, lang);
      const pub = await latestPublished(preset, lang);
      const nextVer = (pub && typeof pub.version === 'number') ? (pub.version + 1) : 1;
      if (!draft) return { success: false, error: 'no draft' };
      await db.collection('poetry_overrides').doc(draft._id).update({ data: { published: true, version: nextVer, updatedBy: OPENID, updatedAt: Date.now() } });
      const r = await db.collection('poetry_overrides').doc(draft._id).get();
      return { success: true, data: r.data };
    } catch(e){ return { success: false, error: String(e) }; }
  }

  if (type === 'rollback') {
    try {
      const admin = await isAdmin(OPENID);
      if (!admin) return { success: false, error: 'forbidden' };
      const toVersion = Number(event?.version || 0);
      if (!toVersion) return { success: false, error: 'version required' };
      const q = await db.collection('poetry_overrides').where({ preset, lang, published: true, version: toVersion }).limit(1).get();
      const base = (q.data && q.data[0]) || null;
      if (!base) return { success: false, error: 'version not found' };
      const curPub = await latestPublished(preset, lang);
      const nextVer = (curPub && typeof curPub.version === 'number') ? (curPub.version + 1) : (toVersion + 1);
      const res = await db.collection('poetry_overrides').add({ data: { preset, lang, version: nextVer, published: true, globalOffsetMs: Number(base.globalOffsetMs || 0), lines: base.lines || {}, updatedBy: OPENID, updatedAt: Date.now() } });
      const r = await db.collection('poetry_overrides').doc(res._id).get();
      return { success: true, data: r.data };
    } catch(e){ return { success: false, error: String(e) }; }
  }

  return { success: false, error: 'unknown op' };
}

