// 兼容层：统一获取系统信息，屏蔽废弃 API 警告
// 优先使用新 API，回退到 getSystemInfoSync
// 增加缓存机制：系统信息（如宽高、设备型号）在运行期间基本不变，避免高频调用触发警告

let __cachedInfo = null;

/**
 * 获取系统信息
 * @param {boolean} forceRefresh - 是否强制刷新（例如在 onWindowResize 时）
 */
export function getSystemInfo(forceRefresh = false) {
  if (__cachedInfo && !forceRefresh) return __cachedInfo;

  // 1. 尝试使用新 API 组合对象
  const info = {};
  
  try {
    // 基础库 2.20.1+
    if (typeof wx.getSystemSetting === 'function') Object.assign(info, wx.getSystemSetting());
    if (typeof wx.getAppAuthorizeSetting === 'function') Object.assign(info, wx.getAppAuthorizeSetting());
    if (typeof wx.getDeviceInfo === 'function') Object.assign(info, wx.getDeviceInfo());
    if (typeof wx.getWindowInfo === 'function') Object.assign(info, wx.getWindowInfo());
    if (typeof wx.getAppBaseInfo === 'function') Object.assign(info, wx.getAppBaseInfo());
    
    // 如果成功获取了关键字段，则视为成功
    // 注意：windowWidth/Height 在 getWindowInfo 中
    // pixelRatio 在 getWindowInfo 或 getSystemSetting 中
    if (info.windowWidth && info.pixelRatio) {
       // 兼容性修补：部分旧代码依赖 safeArea 对象，而新 API 提供 safeAreaInsets
       if (!info.safeArea && info.safeAreaInsets) {
         info.safeArea = {
           top: info.safeAreaInsets.top,
           bottom: info.windowHeight - info.safeAreaInsets.bottom,
           left: info.safeAreaInsets.left,
           right: info.windowWidth - info.safeAreaInsets.right,
           width: info.windowWidth - info.safeAreaInsets.left - info.safeAreaInsets.right,
           height: info.windowHeight - info.safeAreaInsets.top - info.safeAreaInsets.bottom
         };
       }
       __cachedInfo = info;
       return info;
    }
  } catch (e) {
    // 静默失败，回退
  }

  // 2. 回退到旧 API
  try {
    // 仅在明确无法使用新 API 时才调用旧 API
    // 缓存机制能保证整个生命周期只警告一次
    const legacy = wx.getSystemInfoSync();
    __cachedInfo = Object.assign(info, legacy);
    return __cachedInfo;
  } catch (e) {
    console.error('[SysInfo] All failed', e);
    // 最后的保底
    const fallback = {
      windowWidth: 375,
      windowHeight: 667,
      pixelRatio: 2,
      platform: 'devtools',
      system: 'iOS 14.0.1',
      safeArea: { top: 20, bottom: 667, left: 0, right: 375, width: 375, height: 647 }
    };
    __cachedInfo = fallback;
    return fallback;
  }
}
