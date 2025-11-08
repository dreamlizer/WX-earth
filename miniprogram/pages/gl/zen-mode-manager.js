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
      const nextPreset = (current === 1) ? 2 : 1;
      this.page.__zenPreset = nextPreset;
      // 启动新预设对应的音乐与诗句
      try { this.page?._startZenAudio?.(nextPreset); } catch(_){ }
      try { this.page?.__startPoetryViaMgr?.(nextPreset); } catch(_){ }
      // 轻提示：与原页面一致，1200ms 消退
      const msg = (this.page?.data?.lang === 'zh') ? `切到预设${nextPreset}` : `Preset ${nextPreset}`;
      try {
        this.page?.setData?.({ hoverText: msg });
        setTimeout(() => { try { this.page?.setData?.({ hoverText: '' }); } catch(_){ } }, 1200);
      } catch(_){ }
    } catch(_){ }
  }
}