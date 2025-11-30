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
export function computeSettingsPanelFrame(timeRect, settingsRect){
  if (!timeRect || !settingsRect) return { left: 0, width: 0 };
  const left = Math.round(timeRect.left);
  const right = Math.round(settingsRect.right);
  const width = Math.max(200, right - left);
  return { left, width };
}
export function computeEggSensorFrame(pill, cutRect, zenRect, { margin = 6, tapTolerancePx = 22, safeTop = 0 } = {}){
  if (!pill) return { left: 0, top: 0, width: 0, height: 0, visible: false };
  const zenRight = zenRect ? Math.round(zenRect.right) : Math.round(pill.left);
  const cutLeft = cutRect ? Math.round(cutRect.left) : Math.round(pill.right);
  const leftBound = Math.max(0, zenRight + margin);
  const rightBound = Math.max(leftBound, cutLeft - margin);
  const width = Math.max(0, rightBound - leftBound);
  const top = Math.max(0, Math.round(safeTop));
  const stripBottom = Math.min(
    cutRect ? Math.round(cutRect.bottom) : top + 80,
    zenRect ? Math.round(zenRect.bottom) : top + 80
  ) - margin;
  const height = Math.max(16, stripBottom - top);
  if (width < 20) {
    const tol = Number(tapTolerancePx) || 22;
    const pillLeft = Math.max(0, Math.round(pill.left) - tol);
    const pillRight = Math.round(pill.right) + tol;
    const leftSafe = Math.max(pillLeft, leftBound);
    const rightSafe = Math.min(pillRight, rightBound);
    const w2 = Math.max(0, rightSafe - leftSafe);
    const h2 = Math.max(16, (stripBottom - top));
    return { left: leftSafe, top, width: w2, height: h2, visible: true };
  }
  return { left: leftBound, top, width, height, visible: true };
}

// 亮度调节竖条：位于“禅”按钮下方，垂直长度约为屏幕高度的 1/3
// 目的：在普通模式下用于调节光照亮度（环境光/方向光的整体缩放）
export function computeBrightnessSensorFrame(zenRect, win, { margin = 6, widthPx = 28, heightRatio = 0.33 } = {}){
  if (!zenRect || !win) return { left: 0, top: 0, width: 0, height: 0, visible: false };
  const h = Math.max(60, Math.round((win.windowHeight || 600) * heightRatio));
  const w = Math.max(16, Math.round(widthPx));
  const cx = Math.round((zenRect.left + zenRect.right) * 0.5);
  const left = Math.max(0, cx - Math.round(w / 2));
  const topRaw = Math.round(zenRect.bottom + margin);
  const top = Math.min(Math.max(0, topRaw), Math.max(0, (win.windowHeight || 600) - h - margin));
  return { left, top, width: w, height: h, visible: true };
}
