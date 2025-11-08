// 布局管理器：统一计算国家面板的顶部位置（考虑安全区、顶栏、提示条）
// 说明：纯计算委托给 layout-utils 的函数，这里负责从页面拿到必要状态并 setData。
import { computeCountryPanelTop, computeSafeTopFromSystemInfo } from './layout-utils.js';

export class LayoutManager {
  constructor(page){
    this.page = page; // 引用页面实例，用于读取 data 与 setData
  }

  // 根据系统安全区与页面状态，更新国家面板顶部位置
  updateTopOffsets(){
    try {
      const sys = wx.getSystemInfoSync() || {};
      const safeTop = computeSafeTopFromSystemInfo(sys);
      const hasHover = !!this.page?.data?.hoverText;

      // 统一参数（与页面原逻辑保持一致），方便后续集中到 APP_CFG.zen
      const params = {
        safeTop,
        hasHoverText: hasHover,
        topBarGap: 8,
        timeHeight: 40,
        tipTopGap: 6,
        tipHeight: 26,
        marginWithTip: 2,
        marginNoTip: 3,
      };

      // 纯函数计算
      const panelTop = computeCountryPanelTop(params);
      if (panelTop !== this.page?.data?.countryPanelTop) this.page?.setData?.({ countryPanelTop: panelTop });
    } catch(_) {
      // 回退：保持与旧逻辑等价，避免异常中断
      try {
        const sys = wx.getSystemInfoSync() || {};
        const safeTop = computeSafeTopFromSystemInfo(sys);
        const hasHover = !!this.page?.data?.hoverText;
        const topBarGap = 8, timeHeight = 40, tipTopGap = 6;
        const tipHeight = hasHover ? 26 : 0;
        const margin = hasHover ? 2 : 3;
        const panelTop = Math.round((safeTop || 0) + topBarGap + timeHeight + (hasHover ? (tipTopGap + tipHeight + margin) : margin));
        if (panelTop !== this.page?.data?.countryPanelTop) this.page?.setData?.({ countryPanelTop: panelTop });
      } catch(__){}
    }
  }
}