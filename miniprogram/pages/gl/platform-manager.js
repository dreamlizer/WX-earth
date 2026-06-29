/**
 * 平台与环境管理器
 * 职责：检测运行环境（iOS/Harmony/PC/DevTools），应用平台特定的兼容性补丁，以及提供环境相关的配置策略。
 */

export const detectEnvironment = (sys) => {
  const sysInfo = sys || {};
  const sysPlatform = (sysInfo.platform || '').toLowerCase();
  
  // 针对 HarmonyOS 及特定华为机型 (如 Mate X3) 的兼容性判定
  const isHarmony = /Harmony/i.test(sysInfo.system || '') || /Mate\s*X3/i.test(sysInfo.model || '');
  
  // 判定是否为开发工具
  const isDevtools = String(sysInfo.environment || '').toLowerCase() === 'devtools' || 
                       String(sysInfo.brand || '').toLowerCase() === 'devtools' || 
                       sysPlatform === 'devtools';
                       
  // 判定是否为 PC 客户端
  const isPCClient = !isDevtools && (
    sysPlatform === 'windows' || 
    sysPlatform === 'mac' || 
    /Windows/i.test(sysInfo.system || '') || 
    /macOS/i.test(sysInfo.system || '')
  );

  return {
    isIOS: sysPlatform === 'ios',
    isHarmony,
    isDevtools,
    isPCClient,
    sysPlatform
  };
};

/**
 * 应用平台兼容性补丁
 * @param {Object} sys - 系统信息
 * @param {Object} globalScope - 全局作用域 (window/global)
 */
export const applyPlatformHacks = (sys, globalScope) => {
  const { isHarmony, isPCClient } = detectEnvironment(sys);
  
  // 鸿蒙系统兼容性修复：禁用 ImageBitmap，强制使用 Image 加载纹理
  // 解决 Mate X3 等设备上地球贴图可能为空白（空心）的问题
  if (isHarmony) {
    try {
      console.warn('[HarmonyOS] Compatibility Mode: Disabling ImageBitmap');
      const g = globalScope || (typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {}));
      // 强制移除全局 createImageBitmap，使 Three.js 回退到标准 Image 加载
      if (g.createImageBitmap) g.createImageBitmap = undefined;
    } catch(e) { console.warn('[HarmonyOS] Failed to disable ImageBitmap', e); }
  }

};

/**
 * 判断是否应该启用云端纹理预加载
 * @param {Object} sys - 系统信息
 * @param {Object} appGlobalData - 小程序 App.globalData
 */
export const shouldPrefetchTextures = (sys, appGlobalData) => {
  const { isDevtools, isPCClient } = detectEnvironment(sys);
  const forceCloud = !!(appGlobalData?.forceCloudTextures);
  
  // 在开发工具/PC 客户端中默认跳过云端预加载（节省流量），除非强制开启。
  if (!(isDevtools || isPCClient) || forceCloud) {
    return true;
  } else {
    return false;
  }
};
