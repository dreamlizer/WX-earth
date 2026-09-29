import { createMoonTrialScene } from './moon-trial-scene.js';
import { APP_CFG } from './config.js';
import { playPoetry } from './zen-poetry.js';
import { loadPoetryPresets } from './content-loader.js';

export class MoonTrial {
  constructor(THREE, page, Audio = MoonTrialAudio) {
    this.Audio = Audio;
    this.THREE = THREE;
    this.page = page;
    this.view = null;
    this.active = false;
    this.playing = false;
    this.token = 0;
    this.disposed = false;
    this.audio = null;
    this.previewTime = null;
    this.zenSnapshot = null;
    this.lastTime = 0;
    this.lastAdvanceAt = 0;
  }

  isActive() { return this.active; }

  async enter() {
    if (this.disposed || this.active || !this.page?.data?.zenMode) return;
    const token = ++this.token;
    this.active = true;
    this.page.__getZenModeMgr?.()?.closeList?.();
    const zen = this.page.__getZenMgr?.();
    const poetry = this.page.__getPoetryMgr?.();
    this.zenSnapshot = { zen, index: poetry?.getIndex?.() || 0, preset: this.page.__zenPreset || 1 };
    this.page.__zenPoetryPaused = true;
    zen?.suspend?.();
    poetry?.stop?.();
    this.page.setData({ moonTrialActive: true, moonTrialLoading: true, trialLyric: '', moonTrialReview: !!this.page.__isDevtools });
    try {
      this.view = createMoonTrialScene(this.THREE, !!this.page.data.isPC);
      this.audio = new this.Audio((error) => {
        if (token !== this.token) return;
        this.exit();
        this.page?.showMoonToast?.(error.message);
      }, () => { if (token === this.token) this.exit(); });
      this.lyrics = [];
      this.lyricIndex = -1;
      // 内容读取不阻塞开场；晚到的数据按音频当前位置显示。
      const cached = this.page.__poetryPresets?.[999];
      if (Array.isArray(cached) && cached.length) this.lyrics = cached;
      else if (typeof loadPoetryPresets === 'function') loadPoetryPresets(APP_CFG, console).then(({ map }) => {
        if (token === this.token && !this.disposed) this.lyrics = map?.[999] || [];
      }).catch(() => {});
      await this.view.ready;
      if (token !== this.token || this.disposed) return;
      await this.audio.start();
      if (token !== this.token || this.disposed) return;
      this.playing = true;
      this.lastTime = 0;
      this.lastAdvanceAt = 0;
      this.page.setData({ moonTrialLoading: false });
    } catch (error) {
      if (token !== this.token || this.disposed) return;
      console.warn('[MoonTrial]', error.message);
      this.exit();
      this.page?.showMoonToast?.(error.message || '试航暂未准备好，请重试');
    }
  }

  render(renderer, aspect, now) {
    if (!this.active || !this.view) return false;
    const elapsed = this.previewTime != null ? this.previewTime : (this.playing ? this.audio.getTime() : 0);
    if (this.playing && this.previewTime == null) {
      if (!this.lastAdvanceAt || elapsed > this.lastTime) this.lastAdvanceAt = now;
      this.lastTime = elapsed;
      if (now - this.lastAdvanceAt > 15000) {
        this.exit();
        this.page?.showMoonToast?.('音乐缓冲过久，已返回禅定');
        return false;
      }
      const duration = this.audio.getDuration?.() || 0;
      if (duration > 3) this.audio.fadeOut((elapsed - (duration - 3)) / 3);
      this.updateLyrics(elapsed);
    }
    if (this.previewTime == null && this.audio?.getDuration?.() > 0 && elapsed >= this.audio.getDuration()) {
      this.exit();
      return false;
    }
    try {
      this.view.update(elapsed, aspect);
      this.view.render(renderer);
      return true;
    } catch (error) {
      console.warn('[MoonTrial] Render failed:', error.message);
      this.exit();
      this.page?.showMoonToast?.('试航已返回');
      return false;
    }
  }

  // 仅开发者工具显示关键帧检查入口，复用实际场景，不另画效果图。
  previewAt(seconds) {
    if (!this.page?.__isDevtools || !this.active || !this.playing) return;
    if (seconds == null) {
      this.previewTime = null;
      this.lastAdvanceAt = 0;
      this.audio.ctx?.play();
      return;
    }
    if (![156, 188, 245].includes(seconds)) return;
    this.previewTime = seconds;
    this.audio.ctx?.pause();
    this.audio.ctx?.seek(seconds);
    this.page.setData({ trialLyric: '' });
    this.lyricIndex = -1;
  }

  updateLyrics(seconds) {
    const ms = seconds * 1000;
    const offset = Number(APP_CFG?.moonVoyage?.lyrics?.offsetMs || 0);
    let index = -1;
    for (let i = 0; i < (this.lyrics || []).length; i++) {
      const line = this.lyrics[i];
      const start = Number(line['start-time'] ?? line.startTime ?? line.start_time);
      if (Number.isFinite(start) && ms >= start + offset && ms < start + offset + Number(line.duration || 7000)) index = i;
    }
    if (index === this.lyricIndex) return;
    this.lyricIndex = index;
    const text = index < 0 ? '' : String(this.lyrics[index].text || '').replace(/\./g, '').replace(/[，,]/g, '\n');
    this.page.setData({ trialLyric: text });
  }

  exit(updatePage = true, resume = true) {
    if (!this.active) return;
    ++this.token;
    this.active = false;
    this.playing = false;
    this.previewTime = null;
    this.view?.dispose();
    this.view = null;
    this.audio?.dispose();
    this.audio = null;
    if (updatePage) this.page?.setData?.({ moonTrialActive: false, moonTrialLoading: false, trialLyric: '' });
    if (updatePage && resume) this.resumeZen();
  }

  resumeZen() {
    const saved = this.zenSnapshot;
    this.zenSnapshot = null;
    if (!saved || this.disposed || !this.page?.data?.zenMode) return;
    this.page.__zenPoetryPaused = false;
    playPoetry(this.page, saved.preset, saved.index, { keepBaseTime: true });
    saved.zen?.resume?.();
  }

  dispose() {
    this.disposed = true;
    this.exit(false);
    this.zenSnapshot = null;
    this.page = null;
    this.THREE = null;
  }
}


const AUDIO_FILE = 'cloud://cloud1-1g6316vt2769d82c.636c-cloud1-1g6316vt2769d82c-1380715696/assets/Moon/Zen-moon.mp3';
let cachedPath = '';

export class MoonTrialAudio {
  constructor(onFailure, onEnded) {
    this.ctx = null;
    this.disposed = false;
    this.onFailure = onFailure;
    this.onEnded = onEnded;
    this.cancel = null;
    this.volume = Math.max(0, Math.min(1, Number(APP_CFG?.audio?.zenVolume ?? 1) * Number(APP_CFG?.audio?.moonVolumeMul ?? 1)));
  }

  start() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        error ? reject(error) : resolve();
      };
      const timer = setTimeout(() => finish(new Error('登月音乐加载超时')), 30000);
      this.cancel = () => finish(new Error('试航已取消'));
      const play = (src) => {
        if (this.disposed || settled) return;
        try {
          const ctx = wx.createInnerAudioContext();
          this.ctx = ctx;
          ctx.autoplay = false;
          ctx.loop = false;
          ctx.volume = this.volume;
          ctx.onPlay(() => { if (!this.disposed) finish(); });
          ctx.onError(() => {
            if (this.disposed) return;
            const error = new Error('登月音乐播放失败');
            if (!settled) finish(error); else this.onFailure(error);
          });
          ctx.onEnded(() => { if (!this.disposed) this.onEnded(); });
          ctx.src = src;
          ctx.play();
        } catch (error) { finish(error); }
      };
      try {
        if (cachedPath) {
          try { wx.getFileSystemManager().accessSync(cachedPath); } catch (_) { cachedPath = ''; }
        }
        if (cachedPath) { play(cachedPath); return; }
        wx.cloud.downloadFile({
          fileID: AUDIO_FILE,
          success: (result) => {
            if (this.disposed || settled) return;
            if (!result.tempFilePath) { finish(new Error('登月音乐下载失败')); return; }
            cachedPath = result.tempFilePath;
            play(cachedPath);
          },
          fail: () => finish(new Error('登月音乐下载失败'))
        });
      } catch (error) { finish(error); }
    });
  }

  getDuration() { return Math.max(0, Number(this.ctx?.duration || 0)); }
  getTime() { return Math.max(0, Number(this.ctx?.currentTime || 0)); }
  fadeOut(progress) { if (this.ctx) this.ctx.volume = this.volume * (1 - Math.max(0, Math.min(1, progress))); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel?.();
    try { this.ctx?.stop(); } catch (_) {}
    try { this.ctx?.destroy(); } catch (_) {}
    this.ctx = null;
  }
}
