
// 禅定模式 - 音频管理模块
// 职责：控制背景音、白噪音的播放、暂停与淡出

export class ZenAudio {
  constructor({ fileIds, appCfg }) {
    this.fileIds = fileIds || {};
    this.appCfg = appCfg;
    this.ctx = null;
    this._listeners = { ended: [], play: [] };
    this._fadeTimer = null;
  }

  updateFileIds(ids) {
    this.fileIds = { ...this.fileIds, ...ids };
  }

  ensureOffline() {
    // Optional: Pre-download logic can be added here
  }

  start(preset, localUrl) {
    this.stop(); // Stop previous
    
    // Create new context
    // Using InnerAudioContext for now to match project consistency
    // (BackgroundAudioManager requires app.json config)
    this.ctx = wx.createInnerAudioContext();
    
    // Determine source
    const cloudId = this.fileIds[preset] || this.fileIds[1];
    this.ctx.src = localUrl || cloudId;
    
    // Settings
    this.ctx.autoplay = true;
    this.ctx.loop = false; // Manager handles loop logic
    
    // Volume
    const vol = Number(this.appCfg?.audio?.zenVolume ?? 1.0);
    this.ctx.volume = vol;

    // Listeners
    this.ctx.onPlay(() => {
      // console.log('[ZenAudio] Playing preset:', preset);
      this._listeners.play.forEach(cb => { try { cb(); } catch(_){} });
    });
    this.ctx.onEnded(() => {
      // console.log('[ZenAudio] Ended preset:', preset);
      this._listeners.ended.forEach(cb => { try { cb(); } catch(_){} });
    });
    this.ctx.onError((res) => {
      console.error('[ZenAudio] Error:', res);
    });

    // Explicit play to ensure start
    try { this.ctx.play(); } catch(_){}
  }
  
  startWithDelayFadeIn(preset, localUrl, delayMs, fadeMs) {
    setTimeout(() => {
      this.start(preset, localUrl);
      if (this.ctx) {
        this.ctx.volume = 0;
        const targetVol = Number(this.appCfg?.audio?.zenVolume ?? 1.0);
        const steps = 10;
        const stepMs = fadeMs / steps;
        let i = 0;
        const t = setInterval(() => {
           i++;
           if (!this.ctx) { clearInterval(t); return; }
           this.ctx.volume = (i / steps) * targetVol;
           if (i >= steps) clearInterval(t);
        }, stepMs);
      }
    }, delayMs);
  }

  stop() {
    if (this._fadeTimer) clearInterval(this._fadeTimer);
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
     const dt = ms / steps;
     const startVol = this.ctx.volume;
     let i = 0;
     
     this._fadeTimer = setInterval(() => {
        i++;
        if (i >= steps) {
           clearInterval(this._fadeTimer);
           this.stop();
        } else {
           if (this.ctx) this.ctx.volume = startVol * (1 - i/steps);
        }
     }, dt);
  }

  onEnded(cb) { this._listeners.ended.push(cb); }
  onPlay(cb) { this._listeners.play.push(cb); }
  
  getCurrentTime() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
  
  get audio() { return this.ctx; }
}


// --- Helper Functions ---

export function resolveAudioPresetForLang(preset, isEn) {
  try { return isEn ? Math.max(1, Number(preset||101) - 100) : Number(preset||1); } catch(_){ return isEn ? 1 : 1; }
}

export const clearZenAudioSaved = () => {
  try { wx.removeStorageSync('zen_audio_cache'); } catch(_){}
};
