// 云端贴图 URL 提供器（稳定、可回退、可缓存）
// 用途：通过云存储 fileID -> 临时 HTTPS URL（CDN），失败则回退到本地图片。

import { getSystemInfo } from './sys-info.js';

const CACHE_KEY = '__texture_urls_cache_v1';
const SAVED_PATHS_KEY = '__texture_saved_paths_v1';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 小时：临时链接有效期通常较短，定期刷新
const textureUrlInflight = Object.create(null);
const offlineTextureInflight = Object.create(null);

// 从你的截图复制的 fileID（如环境迁移请按需更新）
// 精简版：只保留 3 张核心贴图，兼容所有设备
const FILE_ID_MAP = {
  earth: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/earth.jpg',
  earth_night: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/earth_night_2K.jpg', 
  earth_day: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/earth_daymap_2K.jpg',
  cloud: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/cloud.webp',
};

// 本地兜底图片（放置在 miniprogram/assets/textures/ 下，确保打包到小程序）
const FALLBACK_MAP = {
  // 1x1 PNG 占位（浅色），避免 DevTools 下无云贴图时报错
  earth: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/WWy3XQAAAAASUVORK5CYII=',
  // 1x1 PNG 占位（同上，夜景仅作占位）
  earth_night: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/WWy3XQAAAAASUVORK5CYII=',
  // 1x1 PNG 占位（纯白昼）
  earth_day: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/WWy3XQAAAAASUVORK5CYII=',
  // 1x1 透明 PNG，占位云层纹理（GIF 在 DevTools 的 WebGL 可能不兼容）
  cloud: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/WWy3XQAAAAASUVORK5CYII=',
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
function targetPathFor(name, sourceOrFallback){
  const root = (wx.env && wx.env.USER_DATA_PATH) ? wx.env.USER_DATA_PATH : ''; 
  const dir = root ? (root + '/textures') : '';
  const ext = extOf(sourceOrFallback) || '.dat';
  return dir ? (dir + '/' + name + ext) : '';
}
function hasFile(p){
  try { wx.getFileSystemManager().accessSync(p); return true; } catch(_) { return false; }
}
async function savePermanentFromTemp(tempPath, name, fallback){
  try {
    const target = targetPathFor(name, tempPath || fallback);
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

function textureInflightKey(name, preferNetwork){
  return `${String(name || '')}:${preferNetwork ? 'network' : 'normal'}`;
}

function getAnyTextureUrlInflight(name){
  const n = String(name || '');
  return textureUrlInflight[textureInflightKey(n, false)] || textureUrlInflight[textureInflightKey(n, true)] || null;
}

export function clearTextureCache(){ writeCache({}); }

export function clearTextureSaved(names = ['earth','earth_night','cloud','earth_day8k']){
  try {
    const map = readSavedPaths();
    const fs = wx.getFileSystemManager && wx.getFileSystemManager();
    for (const n of names) {
      const p = map[n];
      if (p) {
        try { fs && fs.accessSync(p); try { fs.unlinkSync(p); } catch(_){} } catch(_){}
        delete map[n];
      }
    }
    writeSavedPaths(map);
  } catch(_){ }
}

// 返回：{ url, fallback } —— url 可能是云端临时链接，也可能直接是本地兜底
async function resolveTextureUrl(name, preferNetwork = false) {
  // 开发者工具（Windows/macOS）的网络环境对临时 CDN 链接常出现 403（no referrer），
  // 为保证本地预览“无红色错误”，默认在 DevTools 环境走本地兜底。
  // 如需强制走云端，可在 app.globalData.forceCloudTextures = true。
  let forceCloud = false;
  try { forceCloud = !!getApp()?.globalData?.forceCloudTextures; } catch(_){ }
  const isDevtools = (() => {
    try {
      const info = getSystemInfo();
      // WeChat DevTools 下 platform 会是 'windows' 或 'devtools'
      const p = (info?.platform || '').toLowerCase();
      return p === 'windows' || p === 'devtools' || p === 'mac';
    } catch(_) { return false; }
  })();
  const isIOS = (() => {
    try { const info = getSystemInfo(); const p = (info?.platform || '').toLowerCase(); return p === 'ios'; } catch(_) { return false; }
  })();

  let fallback = FALLBACK_MAP[name];
  try {
    if (!fallback && (name === 'earth_night' || name === 'earth_day8k')) {
      const savedDay = readSavedPaths()['earth'];
      if (savedDay && hasFile(savedDay)) fallback = savedDay;
    }
  } catch(_){ }
  // 非法键直接回退
  if (!FILE_ID_MAP[name]) return { url: fallback, fallback };

  // 强制云端：即使在 DevTools 也走云端临时链接（不再默认回本地）

  // 若已有持久化文件，直接使用离线路径 (仅在非网络优先模式下)
  if (!preferNetwork) {
    try {
      const saved = readSavedPaths()[name];
      if (saved && hasFile(saved)) {
        return { url: saved, fallback };
      }
    } catch(_){}
  }

  // 命中缓存且未过期 (仅在非网络优先模式下)
  if (!preferNetwork) {
    const cache = readCache();
    const hit = cache[name];
    if (hit && typeof hit.url === 'string' && hit.exp > now()) {
      return { url: hit.url, fallback };
    }
  }

  // 开发者工具：为避免云初始化与下载失败，此处直接返回本地兜底或离线缓存
  if (isDevtools && !forceCloud) {
    try {
      const saved = readSavedPaths()[name];
      if (saved && hasFile(saved)) { return { url: saved, fallback }; }
    } catch(_){}
    return { url: fallback || '', fallback };
  }

  // iOS：优先使用 downloadFile 并持久化到本地，规避远程 URL 加载限制
  // (仅在非网络优先模式下启用此策略)
  if (isIOS && !preferNetwork) {
    try {
      const df0 = await wx.cloud.downloadFile({ fileID: FILE_ID_MAP[name] });

      const p0 = df0?.tempFilePath || '';
      if (p0) {
        const saved = await savePermanentFromTemp(p0, name, fallback);
        if (saved) {
          const cache = readCache(); cache[name] = { url: saved, exp: now() + TTL_MS }; writeCache(cache);
          return { url: saved, fallback };
        } else {
          const cache = readCache(); cache[name] = { url: p0, exp: now() + TTL_MS }; writeCache(cache);
          return { url: p0, fallback };
        }
      }
    } catch(_){ }
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
    if (typeof url === 'string' && url.startsWith('http')) {
      const cache = readCache();
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
    if (p1) {
      const saved = await savePermanentFromTemp(p1, name, fallback);
      const cache = readCache();
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
  } catch(e) { 
    try { console.error('[texture] downloadFile 失败', name, e); } catch(_){ }
    // 如果是 DevTools 且云调用失败，尝试返回 fallback（即使可能为空，避免 crash）
    if (isDevtools && fallback) {
        return { url: fallback, fallback };
    }
  }
  // 云端不可用：返回 fallback（可能为空），由上层处理占位
  return { url: fallback || '', fallback };
}

export async function getTextureUrl(name, preferNetwork = false) {
  const active = getAnyTextureUrlInflight(name);
  if (active) return active;
  const key = textureInflightKey(name, preferNetwork);
  const task = resolveTextureUrl(name, preferNetwork)
    .finally(() => {
      if (textureUrlInflight[key] === task) delete textureUrlInflight[key];
    });
  textureUrlInflight[key] = task;
  return task;
}

// 预取若干纹理，提升首帧稳定性
export async function prefetchTextureUrls(names = ['earth','earth_night','cloud']){
  // DevTools 跳过云预取，除非显式开启 forceCloudTextures
  try {
    const info = getSystemInfo() || {};
    const isDev = String(info.environment || '').toLowerCase() === 'devtools';
    const forceCloud = !!getApp()?.globalData?.forceCloudTextures;
    if (isDev && !forceCloud) return;
  } catch(_){ }
  // 确保云能力初始化
  try { if (!wx.cloud) console.error('wx.cloud not available'); } catch(_){ }
  
  for (const n of names) { try { await getTextureUrl(n); } catch(_){} }
}

// 首次打开时确保纹理持久化到本地（离线可用）
export async function ensureOfflineTextures(names = ['earth','earth_night','cloud']){
  // DevTools 跳过云下载持久化，除非显式开启 forceCloudTextures
  try {
    const info = getSystemInfo() || {};
    const isDev = String(info.environment || '').toLowerCase() === 'devtools';
    const forceCloud = !!getApp()?.globalData?.forceCloudTextures;
    if (isDev && !forceCloud) return;
  } catch(_){ }
  for (const n of names) {
    await ensureOneTextureOffline(n);
  }
}

async function ensureOneTextureOffline(name){
  const n = String(name || '');
  if (!FILE_ID_MAP[n]) return;
  if (offlineTextureInflight[n]) return offlineTextureInflight[n];
  const task = (async () => {
    try {
      const fallback = FALLBACK_MAP[n];
      let saved = readSavedPaths()[n];
      if (saved && hasFile(saved)) return;

      // If the foreground loader is already resolving this texture, wait for it
      // instead of starting a competing download/save of the same file.
      const active = getAnyTextureUrlInflight(n);
      if (active) {
        try { await active; } catch(_){}
        saved = readSavedPaths()[n];
        if (saved && hasFile(saved)) return;
      }

      try {
        const df = await wx.cloud.downloadFile({ fileID: FILE_ID_MAP[n] });
        const temp = df?.tempFilePath || '';
        if (temp) await savePermanentFromTemp(temp, n, fallback);
      } catch(err) {
        try { console.warn('[texture] ensureOffline单个失败', n, err); } catch(_){}
      }
    } catch(e) { try { console.warn('[texture] ensureOffline失败', n, e); } catch(_){} }
  })().finally(() => {
    if (offlineTextureInflight[n] === task) delete offlineTextureInflight[n];
  });
  offlineTextureInflight[n] = task;
  return task;
}
