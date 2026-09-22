
// 禅定模式 - 音频管理模块
// 职责：控制背景音、白噪音的播放、暂停与淡出

export class ZenAudio {
  constructor({ fileIds, appCfg }) {
    this.fileIds = fileIds || {};
    this.appCfg = appCfg;
    this.ctx = null;
    this._listeners = { ended: new Set(), play: new Set() };
    this._fadeTimer = null;
    this._fadeInTimer = null;
    this._delayTimer = null;
    this._disposed = false;
    this._suspended = false;
    this._resumeAfterSuspend = false;
  }

  updateFileIds(ids) {
    this.fileIds = { ...this.fileIds, ...ids };
  }

  ensureOffline() {
    // Optional: Pre-download logic can be added here
  }

  start(preset, localUrl) {
    if (this._disposed) return;
    this.stop(); // Stop previous
    
    // Create new context
    // Using InnerAudioContext for now to match project consistency
    // (BackgroundAudioManager requires app.json config)
    this.ctx = wx.createInnerAudioContext();
    const ctx = this.ctx;
    
    // Determine source
    const cloudId = this.fileIds[preset] || this.fileIds[1];
    this.ctx.src = localUrl || cloudId;
    
    // Settings
    this.ctx.autoplay = !this._suspended;
    if (this._suspended) this._resumeAfterSuspend = true;
    this.ctx.loop = false; // Manager handles loop logic
    
    // Volume
    const vol = Number(this.appCfg?.audio?.zenVolume ?? 1.0);
    this.ctx.volume = vol;

    // Listeners
    ctx.onPlay(() => {
      if (this.ctx !== ctx) return;
      if (this._suspended) { try { ctx.pause(); } catch (_) {} return; }
      // console.log('[ZenAudio] Playing preset:', preset);
      const event = { preset, currentTime: Number(ctx.currentTime || 0) };
      this._listeners.play.forEach(cb => { try { cb(event); } catch(_){} });
    });
    ctx.onEnded(() => {
      if (this.ctx !== ctx) return;
      // console.log('[ZenAudio] Ended preset:', preset);
      const event = { preset, currentTime: Number(ctx.currentTime || 0) };
      this._listeners.ended.forEach(cb => { try { cb(event); } catch(_){} });
    });
    ctx.onError((res) => {
      if (this.ctx !== ctx) return;
      console.error('[ZenAudio] Error:', res);
    });

    // Explicit play to ensure start
    try { if (!this._suspended) this.ctx.play(); } catch(_){}
  }

  suspend() {
    if (this._disposed || this._suspended) return;
    this._resumeAfterSuspend = !!this._delayTimer || (!!this.ctx && this.ctx.paused !== true);
    this._suspended = true;
    try { this.ctx?.pause(); } catch (_) {}
  }

  resume() {
    if (this._disposed || !this._suspended) return;
    this._suspended = false;
    const play = this._resumeAfterSuspend;
    this._resumeAfterSuspend = false;
    try { if (play) this.ctx?.play(); } catch (_) {}
  }
  
  startWithDelayFadeIn(preset, localUrl, delayMs, fadeMs) {
    if (this._disposed) return;
    if (this._delayTimer) clearTimeout(this._delayTimer);
    if (this._fadeInTimer) clearInterval(this._fadeInTimer);
    this._delayTimer = setTimeout(() => {
      this._delayTimer = null;
      if (this._disposed) return;
      this.start(preset, localUrl);
      if (this.ctx) {
        this.ctx.volume = 0;
        const targetVol = Number(this.appCfg?.audio?.zenVolume ?? 1.0);
        const steps = 10;
        const stepMs = Math.max(16, Number(fadeMs || 0) / steps);
        let i = 0;
        this._fadeInTimer = setInterval(() => {
           i++;
           if (!this.ctx) {
             clearInterval(this._fadeInTimer);
             this._fadeInTimer = null;
             return;
           }
           this.ctx.volume = (i / steps) * targetVol;
           if (i >= steps) {
             clearInterval(this._fadeInTimer);
             this._fadeInTimer = null;
           }
        }, stepMs);
      }
    }, Math.max(0, Number(delayMs) || 0));
  }

  stop() {
    if (this._delayTimer) {
      clearTimeout(this._delayTimer);
      this._delayTimer = null;
    }
    if (this._fadeTimer) {
      clearInterval(this._fadeTimer);
      this._fadeTimer = null;
    }
    if (this._fadeInTimer) {
      clearInterval(this._fadeInTimer);
      this._fadeInTimer = null;
    }
    if (this.ctx) {
      try { this.ctx.stop(); } catch(_){}
      try { this.ctx.destroy(); } catch(_){}
      this.ctx = null;
    }
  }
  
  fadeOutStop(ms) {
     if (!this.ctx) return;
     if (this._fadeTimer) clearInterval(this._fadeTimer);
     
     const steps = 10;
     const dt = Math.max(16, Number(ms || 0) / steps);
     const startVol = this.ctx.volume;
     let i = 0;
     
     this._fadeTimer = setInterval(() => {
        i++;
        if (i >= steps) {
           clearInterval(this._fadeTimer);
           this._fadeTimer = null;
           this.stop();
        } else {
           if (this.ctx) this.ctx.volume = startVol * (1 - i/steps);
        }
     }, dt);
  }

  onEnded(cb) {
    if (typeof cb !== 'function') return () => {};
    this._listeners.ended.add(cb);
    return () => this._listeners.ended.delete(cb);
  }

  onPlay(cb) {
    if (typeof cb !== 'function') return () => {};
    this._listeners.play.add(cb);
    return () => this._listeners.play.delete(cb);
  }

  dispose() {
    this._disposed = true;
    this.stop();
    this._listeners.ended.clear();
    this._listeners.play.clear();
  }
  
  getCurrentTime() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
  
  get audio() { return this.ctx; }
}


// --- Helper Functions ---

export function resolveAudioPresetForLang(preset, isEn) {
  try {
    const value = Number(preset || (isEn ? 101 : 1));
    return value >= 101 ? Math.max(1, value - 100) : Math.max(1, value);
  } catch(_){ return 1; }
}

export const clearZenAudioSaved = () => {
  try { wx.removeStorageSync('zen_audio_cache'); } catch(_){}
};
