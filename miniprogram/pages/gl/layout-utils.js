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

  // 1. 基础区域：围绕时间胶囊扩大点击范围
  const tol = Number(tapTolerancePx) || 22;
  let left = Math.max(0, Math.round(pill.left) - tol);
  let right = Math.round(pill.right) + tol;
  let top = Math.max(0, Math.round(safeTop)); // 顶部通常贴顶
  let bottom = Math.round(pill.bottom) + tol;

  // 2. 避让活跃按钮 (Cut/Zen)，防止遮挡导致无法操作
  // 活跃按钮通常在 Zen Mode 下是可见的，且层级在 Sensor 之下（DOM 顺序 Sensor 在后，故覆盖）
  const buttons = [];
  if (cutRect) buttons.push(cutRect);
  if (zenRect) buttons.push(zenRect);

  buttons.forEach(btn => {
    // 简单判定：按钮在左边还是右边？
    // 如果按钮中心在胶囊中心左侧，则视为左侧障碍
    const pillCx = (pill.left + pill.right) / 2;
    const btnCx = (btn.left + btn.right) / 2;
    
    if (btnCx < pillCx) {
      // 左侧按钮：Sensor 左边界不能小于按钮右边界 + margin
      left = Math.max(left, Math.round(btn.right) + margin);
    } else {
      // 右侧按钮：Sensor 右边界不能大于按钮左边界 - margin
      right = Math.min(right, Math.round(btn.left) - margin);
    }
  });

  // 3. 校验最终尺寸
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  
  // 如果宽度过小（比如左右按钮夹得太紧），则强制不可见或最小尺寸（视需求）
  // 这里允许稍微小一点，只要大于 0
  if (width < 10 || height < 10) {
    return { left: 0, top: 0, width: 0, height: 0, visible: false };
  }

  return { left, top, width, height, visible: true };
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
