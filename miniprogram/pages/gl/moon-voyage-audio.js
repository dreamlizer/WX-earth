
import { APP_CFG } from './config.js';
import { startMoonLyrics } from './moon-voyage-lyrics.js';

export const playAudio = (mgrState, ASSETS) => {
  if (mgrState.audioContext) mgrState.audioContext.destroy();
  
  const ctx = wx.createInnerAudioContext();
  ctx.src = mgrState.audioPath || ASSETS.AUDIO;
  ctx.autoplay = true;
  ctx.loop = false;
  try {
    const zenVol = Math.max(0, Math.min(1, Number(APP_CFG?.audio?.zenVolume ?? 1.0) || 0));
    const mul = Math.max(0, Math.min(1, Number(APP_CFG?.audio?.moonVolumeMul ?? 1.0) || 0));
    ctx.volume = zenVol * mul;
  } catch(_) { ctx.volume = 0.65; }
  
  ctx.onPlay(() => {
    console.log('[Moon] Audio playing');
    let baseTimeMs = Date.now();
    try { baseTimeMs = baseTimeMs - Math.max(0, Number(ctx.currentTime || 0) * 1000); } catch(_){ }
    try { startMoonLyrics(mgrState, baseTimeMs); } catch(_){ }
  });
  ctx.onError((res) => console.error('[Moon] Audio error', res));
  ctx.onEnded(() => {
     console.log('[Moon] Audio ended, triggering exit');
     if (typeof mgrState.exit === 'function') mgrState.exit();
  });
  
  mgrState.audioContext = ctx;
};

export const stopZenAudio = (page) => {
  if (!page || !page.__getZenMgr) return;
  try {
    const zenMgr = page.__getZenMgr();
    if (zenMgr) {
      zenMgr.stop();
      if (zenMgr.audio) {
        try { zenMgr.audio.stop(); } catch (_) {}
        try { zenMgr.audio.destroy(); } catch (_) {}
        zenMgr.audio = null;
      }
    }
  } catch (_) {}
};
