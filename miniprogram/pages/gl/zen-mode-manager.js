// 职责：集中管理“禅定模式”的进入/退出与页面层淡出联动，
// 解释：将原本散落在页面的状态更新、渲染层调用（setZenMode）、音频与诗句启停汇总到管理器，降低 index.js 复杂度。

import { setZenMode } from './main.js';

export class ZenModeManager {
  constructor(page){
    this.page = page; // 引用页面实例以便 setData 与调用页面已有的音频/诗句方法
  }

  // 切换：根据当前状态决定进入或退出
  toggle(){
    try { return (!this.page?.data?.zenMode) ? this.enter() : this.exit(); } catch(_){ }
  }

  // 进入禅定：面板淡出关闭 + 渲染层倾斜缩放 + 启动音乐与诗句
  enter(){
    try {
      const fadeMs = Number(this.page?.data?.panelFadeMs || 500);
      const updates = { zenMode: true, searchOpen: false };
      if (this.page?.data?.settingsOpen) updates.settingsFading = true;
      if (this.page?.data?.countryPanelOpen) updates.countryPanelFading = true;
      // 禁止时区胶囊：清空 hover 文本
      updates.hoverText = '';
      this.page?.setData?.(updates);
      // 到达淡出时间后真正关闭面板
      if (this.page?.data?.settingsOpen || this.page?.data?.countryPanelOpen) {
        setTimeout(() => {
          try {
            this.page?.setData?.({ settingsOpen: false, countryPanelOpen: false, settingsFading: false, countryPanelFading: false });
          } catch(_){ }
        }, fadeMs);
      }
      // 页面层调用渲染层进入禅定：动画倾斜与缩小，锁定交互
      try { setZenMode(true); } catch(_){ }
      // 音频与诗句：进入禅定时启动 preset（默认1）
      const preset = this.page?.__zenPreset || 1;
      try { this.page?._startZenAudio?.(preset); } catch(_){ }
      try { this.page?.__startPoetryViaMgr?.(preset); } catch(_){ }
    } catch(_){ }
  }

  // 退出禅定：恢复渲染状态 + 淡出音乐 + 停止诗句循环
  exit(){
    try {
      this.page?.setData?.({ zenMode: false });
      try { setZenMode(false); } catch(_){ }
      // 禅定退出：关闭音乐与诗句循环（音乐淡出 2 秒）
      try { this.page?._stopZenAudio?.(2000); } catch(_){ }
      try { this.page?.__stopPoetryViaMgr?.(); } catch(_){ }
    } catch(_){ }
  }

  // 切换预设：与页面“切”按钮同等行为，统一到管理器
  toggleCut(){
    try {
      const current = Number(this.page?.__zenPreset || 1);
      // 循环：1 → 2 → 3 → 1
      const nextPreset = (current === 1) ? 2 : (current === 2 ? 3 : 1);
      this.page.__zenPreset = nextPreset;
      // 先处理：旧音乐 2 秒淡出、当前诗句强制 2 秒淡出
      try { this.page?._stopZenAudio?.(2000); } catch(_){ }
      try {
        // 诗句淡出时长固定为 2000ms，无论已显示多久
        this.page?.setData?.({ poetryFadeMs: 2000, 'poetryA.visible': false, 'poetryB.visible': false });
      } catch(_){ }
      // 新音乐：等待 1 秒后开始淡入（淡入 1 秒），新诗句：靠近淡出末尾切入（总淡出 2 秒，1 秒后启动，内部首句再延迟 1 秒 = 2 秒）
      try {
        const mgr = this.page?.__getZenMgr?.();
        const localUrl = this.page?._getLocalAudio?.(nextPreset) || '';
        // 1s 延迟 + 1s 淡入
        if (mgr && typeof mgr.startWithDelayFadeIn === 'function') { mgr.startWithDelayFadeIn(nextPreset, localUrl, 1000, 1000); }
        else { this.page?._startZenAudio?.(nextPreset); }
      } catch(_){ }
      // 诗句：在淡出开始 1 秒时触发新的预设（PoetryManager 首句自带 1 秒延迟，恰好 2 秒总长度）
      try { setTimeout(() => { try { this.page?.__startPoetryViaMgr?.(nextPreset); } catch(_){ } }, 1000); } catch(_){ }
      // 需求调整：切换时不再显示“切到预设X”的提示
      // 为保持整洁，不设置 hoverText。
    } catch(_){ }
  }
}