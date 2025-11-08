// 云端贴图 URL 提供器（稳定、可回退、可缓存）
// 用途：通过云存储 fileID -> 临时 HTTPS URL（CDN），失败则回退到本地图片。

const CACHE_KEY = '__texture_urls_cache_v1';
const SAVED_PATHS_KEY = '__texture_saved_paths_v1';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 小时：临时链接有效期通常较短，定期刷新

// 从你的截图复制的 fileID（如环境迁移请按需更新）
const FILE_ID_MAP = {
  earth: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/earth.jpg',
  earth_night: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/earth_night.webp',
  cloud: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/cloud.webp',
  // 新增：地球白昼 8K 贴图（webp）
  earth_day8k: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/earth_day8k.webp',
};

// 本地兜底图片（放置在 miniprogram/assets/textures/ 下，确保打包到小程序）
const FALLBACK_MAP = {
  earth: '/assets/textures/earth.jpg',
  earth_night: '/assets/textures/earth_night.webp',
  cloud: '/assets/textures/cloud.webp',
  earth_day8k: '/assets/textures/earth_day8k.webp',
};

function now() { return Date.now(); }

function readCache() {
  try { return wx.getStorageSync(CACHE_KEY) || {}; } catch(_) { return {}; }
}

function writeCache(obj) {
  try { wx.setStorageSync(CACHE_KEY, obj || {}); } catch(_) {}
}

function readSavedPaths(){
  try { return wx.getStorageSync(SAVED_PATHS_KEY) || {}; } catch(_) { return {}; }
}
function writeSavedPaths(obj){
  try { wx.setStorageSync(SAVED_PATHS_KEY, obj || {}); } catch(_) {}
}

function ensureDir(path){
  try {
    const fs = wx.getFileSystemManager();
    fs.mkdir({ dirPath: path, recursive: true, success(){}, fail(){} });
  } catch(_){}
}
function extOf(path){
  const m = String(path||'').match(/\.(\w+)$/); return m ? ('.'+m[1]) : '';
}
function targetPathFor(name, fallback){
  const root = (wx.env && wx.env.USER_DATA_PATH) ? wx.env.USER_DATA_PATH : ''; 
  const dir = root ? (root + '/textures') : '';
  const ext = extOf(fallback) || '.dat';
  return dir ? (dir + '/' + name + ext) : '';
}
function hasFile(p){
  try { wx.getFileSystemManager().accessSync(p); return true; } catch(_) { return false; }
}
async function savePermanentFromTemp(tempPath, name, fallback){
  try {
    const target = targetPathFor(name, fallback);
    if (!target) return '';
    ensureDir(target.replace(/\/[^\/]*$/, ''));
    const fs = wx.getFileSystemManager();
    await new Promise((resolve,reject)=>{
      fs.saveFile({ tempFilePath: tempPath, filePath: target, success(){ resolve(); }, fail(e){ reject(e); } });
    });
    const map = readSavedPaths(); map[name] = target; writeSavedPaths(map);
    return target;
  } catch(e) { try { console.warn('[texture] savePermanent失败', name, e); } catch(_){}; return ''; }
}

export function clearTextureCache(){ writeCache({}); }

// 返回：{ url, fallback } —— url 可能是云端临时链接，也可能直接是本地兜底
export async function getTextureUrl(name) {
  // 开发者工具（Windows/macOS）的网络环境对临时 CDN 链接常出现 403（no referrer），
  // 为保证本地预览“无红色错误”，默认在 DevTools 环境走本地兜底。
  // 如需强制走云端，可在 app.globalData.forceCloudTextures = true。
  let forceCloud = false;
  try { forceCloud = !!getApp()?.globalData?.forceCloudTextures; } catch(_){}
  const isDevtools = (() => {
    try {
      const info = wx.getSystemInfoSync();
      // WeChat DevTools 下 platform 会是 'windows' 或 'devtools'
      const p = (info?.platform || '').toLowerCase();
      return p === 'windows' || p === 'devtools' || p === 'mac';
    } catch(_) { return false; }
  })();

  const fallback = FALLBACK_MAP[name];
  // 非法键直接回退
  if (!FILE_ID_MAP[name]) return { url: fallback, fallback };

  // 强制云端：即使在 DevTools 也走云端临时链接（不再默认回本地）

  // 若已有持久化文件，直接使用离线路径
  try {
    const saved = readSavedPaths()[name];
    if (saved && hasFile(saved)) {
      try { console.log('[texture] use offline saved', name, saved); } catch(_){}
      return { url: saved, fallback };
    }
  } catch(_){}

  // 命中缓存且未过期
  const cache = readCache();
  const hit = cache[name];
  if (hit && typeof hit.url === 'string' && hit.exp > now()) {
    return { url: hit.url, fallback };
  }

  // 开发者工具：直接使用 downloadFile 的临时路径，避免 403(no referrer)
  if (isDevtools) {
    try {
      const df0 = await wx.cloud.downloadFile({ fileID: FILE_ID_MAP[name] });
      const p0 = df0?.tempFilePath || '';
      try { console.log('[texture] devtools downloadFile', name, { path: p0 }); } catch(_){ }
      if (p0) {
        // 保存为持久化文件
        const saved = await savePermanentFromTemp(p0, name, fallback);
        if (saved) {
          cache[name] = { url: saved, exp: now() + TTL_MS };
          writeCache(cache);
          return { url: saved, fallback };
        } else {
          cache[name] = { url: p0, exp: now() + TTL_MS };
          writeCache(cache);
          return { url: p0, fallback };
        }
      }
    } catch(e){ try { console.warn('[texture] devtools downloadFile 失败', name, e); } catch(_){ } }
  }

  // 拉取临时 URL（显式指定 env，增强可观测性）
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    const env = app?.globalData?.env;
    const res = await wx.cloud.getTempFileURL({
      fileList: [{ fileID: FILE_ID_MAP[name], maxAge: Math.floor(TTL_MS / 1000) }],
      ...(env ? { config: { env } } : {})
    });
    const item = res?.fileList?.[0];
    const url = item?.tempFileURL;
    try { console.log('[texture] tempURL', name, { status: item?.status, errMsg: item?.errMsg, url }); } catch(_){}
    if (typeof url === 'string' && url.startsWith('http')) {
      cache[name] = { url, exp: now() + TTL_MS };
      writeCache(cache);
      return { url, fallback };
    }
  } catch (e) {
    try { console.warn('[texture] getTempFileURL 异常:', name, e); } catch(_){}
    // 不抛出，改为在下方尝试 downloadFile 兜底
  }
  // 兜底：下载为临时路径，规避 CDN/Referer 问题
  try {
    const df1 = await wx.cloud.downloadFile({ fileID: FILE_ID_MAP[name] });
    const p1 = df1?.tempFilePath || '';
    try { console.log('[texture] fallback downloadFile', name, { path: p1 }); } catch(_){ }
    if (p1) {
      const saved = await savePermanentFromTemp(p1, name, fallback);
      if (saved) {
        cache[name] = { url: saved, exp: now() + TTL_MS };
        writeCache(cache);
        return { url: saved, fallback };
      } else {
        cache[name] = { url: p1, exp: now() + TTL_MS };
        writeCache(cache);
        return { url: p1, fallback };
      }
    }
  } catch(e) { try { console.error('[texture] downloadFile 失败', name, e); } catch(_){ } }
  // 未拿到有效云端 URL：显式抛错，避免返回本地路径
  throw new Error('TEMP_URL_UNAVAILABLE');
}

// 预取若干纹理，提升首帧稳定性
export async function prefetchTextureUrls(names = ['earth','earth_night','cloud']){
  for (const n of names) { try { await getTextureUrl(n); } catch(_){} }
}

// 首次打开时确保纹理持久化到本地（离线可用）
export async function ensureOfflineTextures(names = ['earth','earth_night','cloud']){
  for (const n of names) {
    try {
      const fallback = FALLBACK_MAP[n];
      const saved = readSavedPaths()[n];
      if (saved && hasFile(saved)) { continue; }
      const df = await wx.cloud.downloadFile({ fileID: FILE_ID_MAP[n] });
      const temp = df?.tempFilePath || '';
      if (temp) await savePermanentFromTemp(temp, n, fallback);
    } catch(e) { try { console.warn('[texture] ensureOffline失败', n, e); } catch(_){} }
  }
}