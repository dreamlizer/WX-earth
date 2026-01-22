// 布局管理器：统一计算国家面板的顶部位置（考虑安全区、顶栏、提示条）
// 说明：纯计算委托给 layout-utils 的函数，这里负责从页面拿到必要状态并 setData。
import { computeCountryPanelTop, computeSafeTopFromSystemInfo, computeSettingsPanelFrame, computeEggSensorFrame, computeBrightnessSensorFrame } from './layout-utils.js';
import { getSystemInfo } from './sys-info.js';
import { APP_CFG } from './config.js';

export class LayoutManager {
  constructor(page){
    this.page = page; // 引用页面实例，用于读取 data 与 setData
  }

  // 根据系统安全区与页面状态，更新国家面板顶部位置
  updateTopOffsets(){
    try {
      const sys = getSystemInfo() || {};
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
        const sys = getSystemInfo() || {};
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
  updateSettingsPanelFrame(){
    try {
      const q = wx.createSelectorQuery().in(this.page);
      q.select('#timePill').boundingClientRect();
      q.select('.settings-btn').boundingClientRect();
      q.exec(res => {
        try {
          const timeRect = res && res[0];
          const settingsRect = res && res[1];
          const fr = computeSettingsPanelFrame(timeRect, settingsRect);
          this.page?.setData?.({ settingsPanelLeft: fr.left, settingsPanelWidth: fr.width });
        } catch(_){ }
      });
    } catch(_){ }
  }
  updateEggSensor(){
    try {
      const q = wx.createSelectorQuery().in(this.page);
      q.select('#timePill').boundingClientRect();
      q.select('.cut-btn').boundingClientRect();
      q.select('.zen-btn').boundingClientRect();
      q.exec(res => {
        try {
          const pill = res && res[0];
          const cutRect = res && res[1];
          const zenRect = res && res[2];
          const sys = getSystemInfo() || {};
          const safeTop = computeSafeTopFromSystemInfo(sys);
          const opts = { margin: 6, tapTolerancePx: Number(APP_CFG?.poetry?.special?.tapTolerancePx || 22), safeTop };
          const fr = computeEggSensorFrame(pill, cutRect, zenRect, opts);
          this.page?.setData?.({ eggSensorLeft: fr.left, eggSensorTop: fr.top, eggSensorWidth: fr.width, eggSensorHeight: fr.height, eggSensorVisible: !!fr.visible });
        } catch(_){ }
      });
    } catch(_){ }
  }

  updateBrightnessSensor(){
    try {
      const q = wx.createSelectorQuery().in(this.page);
      q.select('.zen-btn').boundingClientRect();
      q.exec(res => {
        try {
          const zenRect = res && res[0];
          const win = getSystemInfo() || {};
          const fr = computeBrightnessSensorFrame(zenRect, win, { margin: 6, widthPx: 28, heightRatio: 0.33 });
          const visible = !!fr.visible && !this.page?.data?.zenMode;
          this.page?.setData?.({ brightnessSensorLeft: fr.left, brightnessSensorTop: fr.top, brightnessSensorWidth: fr.width, brightnessSensorHeight: fr.height, brightnessSensorVisible: visible });
        } catch(_){ }
      });
    } catch(_){ }
  }

  // —— 通用测量工具 ——
  measure(id){
    return new Promise(resolve => {
      try {
        let done = false;
        const fallback = { width: 80, height: 160 };
        const timer = setTimeout(() => {
          if (done) return;
          done = true;
          try {
            const now = Date.now();
            if (!this.__measureWarnAt || (now - this.__measureWarnAt) >= 5000) {
              this.__measureWarnAt = now;
              console.warn('[layout:measure] timeout', String(id || ''));
            }
          } catch(_){ }
          resolve(fallback);
        }, 120);
        const q = wx.createSelectorQuery().in(this.page);
        q.select(`#${id}`).boundingClientRect(rect => {
          if (done) return;
          done = true;
          try { clearTimeout(timer); } catch(_){ }
          resolve(rect || fallback);
        }).exec();
      } catch(_) { resolve({ width: 80, height: 160 }); }
    });
  }

  getViewport(){
    try {
      return getSystemInfo();
    } catch(_) {
      return { windowWidth: 360, windowHeight: 640, safeArea: null };
    }
  }
}
