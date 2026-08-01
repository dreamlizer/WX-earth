
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
    this._timers = new Set();
    this._audioListenerManager = null;
    this._audioUnsubscribers = [];
    this._pendingPoetry = null;
    this._poetrySyncVersion = 0;
    this._audioSyncTimer = null;
    this._disposed = false;
  }

  _schedule(fn, delayMs){
    if (this._disposed) return null;
    const timer = setTimeout(() => {
      this._timers.delete(timer);
      if (!this._disposed) fn();
    }, Math.max(0, Number(delayMs) || 0));
    this._timers.add(timer);
    return timer;
  }

  _clearTimers(){
    for (const timer of this._timers) {
      try { clearTimeout(timer); } catch(_){ }
    }
    this._timers.clear();
    this._audioSyncTimer = null;
  }

  _cancelPendingPoetry(){
    this._pendingPoetry = null;
    this._poetrySyncVersion++;
    if (this._audioSyncTimer) {
      try { clearTimeout(this._audioSyncTimer); } catch(_){ }
      this._timers.delete(this._audioSyncTimer);
      this._audioSyncTimer = null;
    }
  }

  _queuePoetryForAudio(preset, audioPreset, opts){
    this._cancelPendingPoetry();
    this._pendingPoetry = {
      preset: Number(preset) || 1,
      audioPreset: Number(audioPreset) || 1,
      opts: opts || {},
      version: this._poetrySyncVersion
    };
  }

  async _startPoetryFromAudio(event, zmgr){
    try {
      if (this._disposed || !this.page?.data?.zenMode || this.page?.__zenPoetryPaused) return;
      const pending = this._pendingPoetry;
      const playedPreset = Number(event?.preset);
      if (pending && Number.isFinite(playedPreset) && playedPreset !== pending.audioPreset) return;

      const version = pending ? pending.version : this._poetrySyncVersion;
      if (pending) {
        this._pendingPoetry = null;
        await ZenPoetry.playPoetry(this.page, pending.preset, 0, pending.opts);
      }
      if (this._disposed || version !== this._poetrySyncVersion || !this.page?.data?.zenMode) return;

      const alignToAudio = () => {
        const eventPos = Number(event?.currentTime || 0);
        const livePos = Number(zmgr?.getCurrentTime?.() || 0);
        const posMs = Math.max(0, Math.floor(Math.max(eventPos, livePos) * 1000));
        this.page?.__getPoetryMgr?.()?.forceAlignToAudioPosition?.(posMs);
      };
      alignToAudio();
      this._audioSyncTimer = this._schedule(() => {
        this._audioSyncTimer = null;
        if (version !== this._poetrySyncVersion || !this.page?.data?.zenMode || this.page?.__zenPoetryPaused) return;
        alignToAudio();
      }, 1500);
    } catch(_){ }
  }

  // 切换：根据当前状态决定进入或退出
  toggle(){
    try { if (this.page?.data?.moonVoyageActive || this.page?.__zenPoetryPaused) return; } catch(_){ }
    try { return (!this.page?.data?.zenMode) ? this.enter() : this.exit(); } catch(_){ }
  }

  // 进入禅定：面板淡出关闭 + 渲染层倾斜缩放 + 启动音乐与诗句
  enter(){
    try {
      if (this._disposed) return;
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
      
      this._schedule(() => {
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
      this._schedule(() => {
        try { if (this.page?.data?.zenMode) this.page.setData({ zenBtnVisible: true }); } catch(_){}
      }, 1500);

      try { setZenMode(true); } catch(_){ }
      
      const isEn = (this.page?.data?.lang === 'en');
      const current = this.page?.__zenPreset || (isEn ? 101 : 1);
      const preset = ZenPoetry.resolvePresetForLang(this.page, current, isEn);
      this.page.__zenPreset = preset;
      const audioPreset = ZenAudio.resolveAudioPresetForLang(preset, isEn);
      const startDelay = isEn ? 1000 : 500;
      this._ensureAudioListeners();
      this._queuePoetryForAudio(preset, audioPreset, { firstDelayMs: startDelay });
      this._playAudio(audioPreset);
      ZenUI.updateSensors(this.page);
    } catch(_){ }
  }

  // 退出禅定：恢复渲染状态 + 淡出音乐 + 停止诗句循环
  exit(){
    try {
      if (this.page?.data?.moonVoyageActive) return;
      this._cancelPendingPoetry();
      this._clearTimers();
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
  async switchNextPreset(){
    try {
      const isEn = (this.page?.data?.lang === 'en');
      const current = Number(this.page?.__zenPreset || (isEn ? 101 : 1));
      const nextPreset = ZenPoetry.resolveNextPreset(this.page, current, isEn);
      try {
        const map = this.page?.__poetryPresets || {};
        const labels = this.page?.__presetLabels || {};
        if (!Array.isArray(map[nextPreset]) || !map[nextPreset].length || !labels[nextPreset]) {
          await this.preloadPoetryCloud();
        }
      } catch(_){ }

      // 显示歌名 Toast（锚定在按钮左侧）
      const labels = this.page.__presetLabels || {};
      const label = labels[nextPreset] || (isEn ? 'Track ' + nextPreset : '曲目 ' + nextPreset);

      this.page.setData({
        zenToastVisible: true,
        zenToastText: label
      });

      clearTimeout(this.page._zenToastTimer);
      this.page._zenToastTimer = this._schedule(() => {
        this.page.setData({ zenToastVisible: false });
      }, 3000); // 3 秒后隐藏歌名提示

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
      this._stopAudio(2000);
      try { this.page?.setData?.({ poetryFadeMs: 2000, 'poetryA.visible': false, 'poetryB.visible': false }); } catch(_){ }
      const audioPreset = ZenAudio.resolveAudioPresetForLang(p, isEn);
      this._ensureAudioListeners();
      this._queuePoetryForAudio(p, audioPreset, { firstDelayMs: 0 });
      try {
        const mgr = this.page?.__getZenMgr?.();
        const localUrl = this.page?._getLocalAudio?.(audioPreset) || '';
        if (mgr && typeof mgr.startWithDelayFadeIn === 'function') { mgr.startWithDelayFadeIn(audioPreset, localUrl, 1000, 1000); }
        else { this._playAudio(audioPreset); }
      } catch(_){ }
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
  
  _ensureAudioListeners(){
      try {
        const zmgr = this.page?.__getZenMgr?.();
        if (!zmgr || this._audioListenerManager === zmgr) return;
        this._removeAudioListeners();
        this._audioListenerManager = zmgr;
        // Ended Listener
        if (typeof zmgr.onEnded === 'function') {
          const unsubscribe = zmgr.onEnded(() => {
            if (this.page?.__zenPoetryPaused) return; 
            this._onAudioEnded();
          });
          if (typeof unsubscribe === 'function') this._audioUnsubscribers.push(unsubscribe);
        }
        // Play Listener (Alignment Check)
        if (typeof zmgr.onPlay === 'function') {
          const unsubscribe = zmgr.onPlay((event) => {
            this._startPoetryFromAudio(event, zmgr);
          });
          if (typeof unsubscribe === 'function') this._audioUnsubscribers.push(unsubscribe);
        }
      } catch(_){ }
  }

  _removeAudioListeners(){
    for (const unsubscribe of this._audioUnsubscribers) {
      try { unsubscribe(); } catch(_){ }
    }
    this._audioUnsubscribers = [];
    this._audioListenerManager = null;
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

  dispose(){
    if (this._disposed) return;
    this._disposed = true;
    this._cancelPendingPoetry();
    this._clearTimers();
    this._removeAudioListeners();
    try { clearTimeout(this.page?._zenToastTimer); } catch(_){ }
    try { ZenPoetry.stopPoetry(this.page); } catch(_){ }
    try { ZenPoetry.stopSpecial(this.page); } catch(_){ }
    try { this.page?.__zenAudioMgr?.stop?.(); } catch(_){ }
    this.page = null;
  }
}
