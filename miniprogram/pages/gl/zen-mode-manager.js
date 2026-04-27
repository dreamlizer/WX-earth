
// 职责：集中管理“禅定模式”的进入/退出与页面层淡出联动，
// 解释：将原本散落在页面的状态更新、渲染层调用（setZenMode）、音频与诗句启停汇总到管理器，降低 index.js 复杂度。

import { setZenMode } from './main.js';
import { zenState } from './zen-scene.js';

import * as ZenAudio from './zen-audio.js';
import * as ZenUI from './zen-ui.js';
import * as ZenPoetry from './zen-poetry.js';

// Re-export scene logic for external use (main.js)
export * from './zen-scene.js';

export class ZenModeManager {
  constructor(page){
    this.page = page; // 引用页面实例以便 setData 与调用页面已有的音频/诗句方法
  }

  // 切换：根据当前状态决定进入或退出
  toggle(){
    try { if (this.page?.data?.moonVoyageActive || this.page?.__zenPoetryPaused) return; } catch(_){ }
    try { return (!this.page?.data?.zenMode) ? this.enter() : this.exit(); } catch(_){ }
  }

  // 进入禅定：面板淡出关闭 + 渲染层倾斜缩放 + 启动音乐与诗句
  enter(){
    try {
      if (this.page?.data?.moonVoyageActive || this.page?.__zenPoetryPaused) return;
      const fadeMs = Number(this.page?.data?.panelFadeMs || 500);
      const updates = { 
        zenMode: true, 
        zenBtnVisible: false,
        searchOpen: false,
        specialScale: 1,
        specialFontSizePx: 16,
        specialText: '',
        specialVisible: false
      };
      if (this.page?.data?.settingsOpen) updates.settingsFading = true;
      if (this.page?.data?.countryPanelOpen) updates.countryPanelFading = true;
      
      updates.hoverText = '';
      this.page?.setData?.(updates);
      
      setTimeout(() => {
        try {
          this.page?.setData?.({ 
            settingsOpen: false, 
            countryPanelOpen: false, 
            settingsFading: false, 
            countryPanelFading: false,
            countryInfo: null
          });
        } catch(_){ }
      }, fadeMs);

      // 额外延迟显示右下角按钮 (1.5s)
      setTimeout(() => {
        try { if (this.page?.data?.zenMode) this.page.setData({ zenBtnVisible: true }); } catch(_){}
      }, 1500);

      try { setZenMode(true); } catch(_){ }
      
      const isEn = (this.page?.data?.lang === 'en');
      const current = this.page?.__zenPreset || (isEn ? 101 : 1);
      const preset = ZenPoetry.resolvePresetForLang(this.page, current, isEn);
      this.page.__zenPreset = preset;
      const audioPreset = ZenAudio.resolveAudioPresetForLang(preset, isEn);
      this._playAudio(audioPreset);
      
      const startDelay = isEn ? 1000 : 500;
      try { ZenPoetry.playPoetry(this.page, preset, 0, { firstDelayMs: startDelay }); } catch(_){ }
      this._ensureAudioListeners(() => this._onAudioEnded());
      ZenUI.updateSensors(this.page);
    } catch(_){ }
  }

  // 退出禅定：恢复渲染状态 + 淡出音乐 + 停止诗句循环
  exit(){
    try {
      if (this.page?.data?.moonVoyageActive) return;
      this.closeList();
      this.page?.setData?.({ zenMode: false, zenBtnVisible: false });
      try { setZenMode(false); } catch(_){ }
      try { zenState.delayEnter = false; } catch(_){ }
      try { zenState.brake = null; } catch(_){ }
      
      this._stopAudio(2000);
      try { ZenPoetry.stopPoetry(this.page); } catch(_){ }
      try { ZenPoetry.stopSpecial(this.page); } catch(_){ }
      ZenUI.updateSensors(this.page);
    } catch(_){ }
  }

  // 触发页面布局感应区刷新（时间胶囊与亮度条）
  _updateSensors(){
    ZenUI.updateSensors(this.page);
  }

  // 切换下一首
  switchNextPreset(){
    try {
      const isEn = (this.page?.data?.lang === 'en');
      const current = Number(this.page?.__zenPreset || (isEn ? 101 : 1));
      const nextPreset = ZenPoetry.resolveNextPreset(this.page, current, isEn);

      // 显示歌名 Toast (覆盖在按钮上)
      const labels = this.page.__presetLabels || {};
      const label = labels[nextPreset] || (isEn ? 'Track ' + nextPreset : '曲目 ' + nextPreset);

      this.page.setData({
        zenToastVisible: true,
        zenToastText: label
      });

      clearTimeout(this.page._zenToastTimer);
      this.page._zenToastTimer = setTimeout(() => {
        this.page.setData({ zenToastVisible: false });
      }, 3000); // 3秒后恢复显示“定”

      this.switchToPreset(nextPreset);
    } catch(_){ }
  }

  // —— 列表 UI 逻辑 ——
  
  async toggleList(){
    await ZenUI.toggleList(this.page, this);
  }

  pickPreset(id){
    ZenUI.pickPreset(this.page, this, id, (tid) => this.switchToPreset(tid));
  }

  closeList(){
    ZenUI.closeList(this.page, this);
  }

  switchToPreset(nextPreset){
    try {
      const isEn = (this.page?.data?.lang === 'en');
      const p = Number(nextPreset) || (isEn ? 101 : 1);
      this.page.__zenPreset = p;
      const pmgr = this.page?.__getPoetryMgr?.();
      if (pmgr && typeof pmgr.resetImmediate === 'function') { pmgr.resetImmediate(); } else { if (pmgr && typeof pmgr.stop === 'function') { pmgr.stop(); } }
      try { ZenAudio.stopAudio(this.page, 2000); } catch(_){ }
      try { this.page?.setData?.({ poetryFadeMs: 2000, 'poetryA.visible': false, 'poetryB.visible': false }); } catch(_){ }
      try {
        const mgr = this.page?.__getZenMgr?.();
        const audioPreset = ZenAudio.resolveAudioPresetForLang(p, isEn);
        const localUrl = this.page?._getLocalAudio?.(audioPreset) || '';
        if (mgr && typeof mgr.startWithDelayFadeIn === 'function') { mgr.startWithDelayFadeIn(audioPreset, localUrl, 1000, 1000); }
        else { this._playAudio(audioPreset); }
      } catch(_){ }
      this._ensureAudioListeners(() => this._onAudioEnded());
      try { ZenPoetry.playPoetry(this.page, p, 0, { firstDelayMs: 0 }); } catch(_){ }
    } catch(_){ }
  }

  _onAudioEnded(){
    try {
      const pmgr = this.page?.__getPoetryMgr?.();
      if (!pmgr) return;
      if (typeof pmgr.resetImmediate === 'function') { pmgr.resetImmediate(); } else { pmgr.stop(); }
      try { ZenPoetry.playPoetry(this.page, this.page.__zenPreset || 1, 0, { firstDelayMs: 0 }); } catch(_){ }
    } catch(_){ }
  }

  // —— 音频与诗句控制 ——
  playAudio(preset){
    this._playAudio(preset);
  }

  stopAudio(fadeMs){
    this._stopAudio(fadeMs);
  }

  // —— 数据加载 ——
  
  async preloadPoetryCloud(){
    await ZenPoetry.preloadPoetryCloud(this.page);
  }

  async pushPoetryPresetToCloud(preset){
    await ZenPoetry.pushPoetryPresetToCloud(this.page, preset);
  }

  async preloadPresetLabelsCloud(){
    await ZenPoetry.preloadPresetLabelsCloud(this.page);
  }

  async preloadSpecialCloud(){
    await ZenPoetry.preloadSpecialCloud(this.page);
  }

  // —— 彩蛋 ——
  
  onEggTap(){
    ZenUI.onEggTap(this.page, () => this._triggerSpecial());
  }

  async _triggerSpecial(){
    ZenPoetry.triggerSpecial(this.page, this);
  }

  // 保持兼容性，允许外部直接调用 stopPoetry
  stopPoetry(){
    ZenPoetry.stopPoetry(this.page);
  }
  
  stopSpecial(){
    ZenPoetry.stopSpecial(this.page);
  }
  
  playPoetry(preset, startIdx, opts){
      ZenPoetry.playPoetry(this.page, preset, startIdx, opts);
  }
  
  _ensureAudioListeners(onEndedCallback){
      try {
        const zmgr = this.page?.__getZenMgr?.();
        // Ended Listener
        if (zmgr && typeof zmgr.onEnded === 'function') {
          zmgr.onEnded(() => {
            if (this.page?.__zenPoetryPaused) return; 
            if (typeof onEndedCallback === 'function') onEndedCallback();
          });
        }
        // Play Listener (Alignment Check)
        if (zmgr && typeof zmgr.onPlay === 'function') {
          zmgr.onPlay(() => {
            try {
              if (this.page?.__zenPoetryPaused) return;
              const delay = 2500;
              setTimeout(() => {
                try {
                  if (this.page?.__zenPoetryPaused) return;
                  const pmgr = this.page?.__getPoetryMgr?.();
                  const posSec = Number(zmgr.getCurrentTime?.() || 0);
                  const posMs = Math.max(0, Math.floor(posSec * 1000));
                  pmgr?.forceAlignToAudioPosition?.(posMs);
                } catch(_){ }
              }, delay);
            } catch(_){ }
          });
        }
      } catch(_){ }
  }

  _playAudio(preset) {
    try {
      const mgr = this.page?.__getZenMgr?.();
      if (!mgr) return;
      try { mgr.ensureOffline?.(); } catch(_){}
      const url = this.page?._getLocalAudio?.(preset || 1);
      try { mgr.start?.(preset || 1, url); } catch(_){}
    } catch(_){ }
  }

  _stopAudio(fadeMs) {
    try {
      const mgr = this.page?.__getZenMgr?.();
      if (!mgr) return;
      const ms = Number(fadeMs || 0);
      if (ms > 0 && typeof mgr.fadeOutStop === 'function') { mgr.fadeOutStop(ms); }
      else { mgr.stop(); }
    } catch(_){ }
  }
}
