
import { APP_CFG } from './config.js';
import { createMoon } from './moon-voyage-scene-setup.js';

const mergeCompanionRobotCfg = (baseCfg, tuneCfg) => {
  const b = baseCfg || {};
  const t = tuneCfg || {};
  const b1 = b?.robot1 || {};
  const b2 = b?.robot2 || {};
  const t1 = t?.robot1 || {};
  const t2 = t?.robot2 || {};
  return {
    ...b,
    ...t,
    robot1: { ...b1, ...t1 },
    robot2: { ...b2, ...t2 }
  };
};

const downloadFile = (fileID) => {
  return new Promise((resolve, reject) => {
    // 30s Timeout
    const timer = setTimeout(() => {
      reject(new Error(`Download timeout (30s): ${fileID}`));
    }, 30000);

    const finishOk = (tempFilePath) => {
      clearTimeout(timer);
      resolve(tempFilePath);
    };
    const finishErr = (err) => {
      clearTimeout(timer);
      reject(err);
    };

    try {
      if (String(fileID || '').startsWith('cloud://') && wx?.cloud?.getTempFileURL) {
        wx.cloud.getTempFileURL({
          fileList: [fileID],
          success: (r) => {
            try {
              const url0 = r?.fileList?.[0]?.tempFileURL;
              const ok = !!url0 && typeof url0 === 'string';
              if (!ok) throw new Error(`getTempFileURL failed: ${fileID}`);
              const sep = url0.includes('?') ? '&' : '?';
              const url = `${url0}${sep}__v=${Date.now()}`;
              wx.downloadFile({
                url,
                success: (res) => {
                  if (res.statusCode === 200 && res.tempFilePath) {
                    try { console.log('[Moon] Downloaded (tempURL):', fileID); } catch (_) {}
                    finishOk(res.tempFilePath);
                  } else {
                    finishErr(new Error(`downloadFile failed with status ${res.statusCode}`));
                  }
                },
                fail: (e) => finishErr(e)
              });
            } catch (e) {
              finishErr(e);
            }
          },
          fail: (e) => finishErr(e)
        });
        return;
      }
    } catch (_) {}

    wx.cloud.downloadFile({
      fileID,
      success: (res) => {
        if (res.statusCode === 200) {
          try { console.log('[Moon] Downloaded (cloud):', fileID); } catch (_) {}
          finishOk(res.tempFilePath);
        } else {
          finishErr(new Error(`Download failed with status ${res.statusCode}`));
        }
      },
      fail: (err) => {
        try { console.error('[Moon] Download API fail', err); } catch (_) {}
        finishErr(err);
      }
    });
  });
};

export const preloadAssets = async (mgrState, ASSETS) => {
  if (mgrState.loaded) return Promise.resolve();
  if (mgrState._preloadPromise) return mgrState._preloadPromise;

  console.log('[Moon] Preloading assets...');

  // 检查云资源是否有效
  if (!ASSETS.TEXTURE.startsWith('cloud://') && !ASSETS.TEXTURE.startsWith('http')) {
    return Promise.reject(new Error('Invalid cloud path'));
  }

  const companionBase = (APP_CFG?.moonVoyage?.starCorridor?.effects?.companionRobot) || {};
  const companionTune = (APP_CFG?.moonVoyage?.timeline?.companionRobot) || {};
  const companionCfg = mergeCompanionRobotCfg(companionBase, companionTune);
  mgrState._preloadPromise = Promise.all([
    downloadFile(ASSETS.TEXTURE),
    downloadFile(ASSETS.AUDIO),
    Promise.resolve().then(() => mgrState._companionFx?.preload?.(companionCfg)).catch(() => null)
  ]).then(([texPath, audioPath]) => {
    mgrState.texPath = texPath;
    mgrState.normPath = null;
    mgrState.audioPath = audioPath;
    console.log('[Moon] Assets downloaded');
    
    // Create moon mesh now (invisible) so it's ready
    createMoon(mgrState.THREE, mgrState.scene, mgrState);
    mgrState.loaded = true;
  }).catch(err => {
    console.error('[Moon] Preload failed', err);
    mgrState._preloadPromise = null; // Allow retry
    throw err; // Re-throw to catch in enter()
  });

  return mgrState._preloadPromise;
};

export const refreshAssets = async (mgrState, opts = {}, ASSETS) => {
  const preload = (opts && typeof opts === 'object') ? !!opts.preload : false;
  try {
    if (mgrState.active) mgrState.exit();
  } catch (_) {}
  try {
    if (mgrState.audioContext) {
      try { mgrState.audioContext.stop(); } catch (_) {}
      try { mgrState.audioContext.destroy(); } catch (_) {}
    }
  } catch (_) {}
  mgrState.audioContext = null;

  try {
    if (mgrState.moonMesh) {
      try { if (mgrState.scene) mgrState.scene.remove(mgrState.moonMesh); } catch (_) {}
      try { mgrState.moonMesh.geometry?.dispose?.(); } catch (_) {}
      try {
        const m = mgrState.moonMesh.material;
        if (m && m.map) { try { m.map.dispose?.(); } catch (_) {} }
        try { m?.dispose?.(); } catch (_) {}
      } catch (_) {}
    }
  } catch (_) {}
  mgrState.moonMesh = null;
  try { mgrState._companionFx?.dispose?.(); } catch (_) {}

  mgrState._moonTexReady = false;
  mgrState.loaded = false;
  mgrState._preloadPromise = null;
  mgrState.texPath = null;
  mgrState.normPath = null;
  mgrState.audioPath = null;

  if (!preload) return true;
  try {
    await preloadAssets(mgrState, ASSETS);
    return true;
  } catch (_) {
    return false;
  }
};
