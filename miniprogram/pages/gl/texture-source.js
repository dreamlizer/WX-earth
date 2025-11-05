// 云端贴图 URL 提供器（稳定、可回退、可缓存）
// 用途：通过云存储 fileID -> 临时 HTTPS URL（CDN），失败则回退到本地图片。

const CACHE_KEY = '__texture_urls_cache_v1';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 小时：临时链接有效期通常较短，定期刷新

// 从你的截图复制的 fileID（如环境迁移请按需更新）
const FILE_ID_MAP = {
  earth: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/earth.jpg',
  earth_night: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/earth_night.webp',
  cloud: 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/cloud.webp',
};

// 本地兜底图片（放置在 miniprogram/assets/textures/ 下，确保打包到小程序）
const FALLBACK_MAP = {
  earth: '/assets/textures/earth.jpg',
  earth_night: '/assets/textures/earth_night.webp',
  cloud: '/assets/textures/cloud.webp',
};

function now() { return Date.now(); }

function readCache() {
  try { return wx.getStorageSync(CACHE_KEY) || {}; } catch(_) { return {}; }
}

function writeCache(obj) {
  try { wx.setStorageSync(CACHE_KEY, obj || {}); } catch(_) {}
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

  // 开发者工具默认走本地，避免 403 噪声；真机保持云端优先
  if (isDevtools && !forceCloud) {
    try { console.info('[texture] devtools 环境，使用本地兜底:', name, fallback); } catch(_){}
    return { url: fallback, fallback };
  }

  // 命中缓存且未过期
  const cache = readCache();
  const hit = cache[name];
  if (hit && typeof hit.url === 'string' && hit.exp > now()) {
    return { url: hit.url, fallback };
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
    // 记录但不打扰用户
    try { console.warn('[texture] getTempFileURL 失败:', name, e); } catch(_){}
  }
  // 失败回退
  return { url: fallback, fallback };
}

// 预取若干纹理，提升首帧稳定性
export async function prefetchTextureUrls(names = ['earth','earth_night','cloud']){
  for (const n of names) { try { await getTextureUrl(n); } catch(_){} }
}