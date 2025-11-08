// 抽离：布局计算工具（纯函数）
// 作用：统一国家面板顶部位置的计算；页面层负责读取系统信息与 setData

/**
 * 从系统信息计算安全区顶部（status bar / safeArea.top）
 * @param {object} sys - wx.getSystemInfoSync() 返回对象
 * @returns {number} safeTop 像素
 */
export function computeSafeTopFromSystemInfo(sys = {}) {
  const safeAreaTop = (sys.safeArea && typeof sys.safeArea.top === 'number') ? sys.safeArea.top : null;
  const statusBarHeight = typeof sys.statusBarHeight === 'number' ? sys.statusBarHeight : 0;
  return (safeAreaTop ?? statusBarHeight ?? 0) || 0;
}

/**
 * 计算国家面板顶部位置（像素）
 * 与 gl/index.js 原逻辑等价：safeTop + 顶栏间距 + 时间胶囊高度 + （时区胶囊块/或间距）
 */
export function computeCountryPanelTop({
  safeTop = 0,
  hasHoverText = false,
  topBarGap = 8,
  timeHeight = 40,
  tipTopGap = 6,
  tipHeight = 26,
  marginWithTip = 2,
  marginNoTip = 3,
} = {}) {
  const margin = hasHoverText ? marginWithTip : marginNoTip;
  const tipBlock = hasHoverText ? (tipTopGap + tipHeight + margin) : margin;
  const panelTop = Math.round((safeTop || 0) + topBarGap + timeHeight + tipBlock);
  return panelTop;
}