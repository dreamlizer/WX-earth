
import { APP_CFG } from './config.js';
import { startMoonLyrics } from './moon-voyage-lyrics.js';
import { traceMoon } from './moon-voyage-trace.js';

export const playAudio = (mgrState, ASSETS) => {
  if (mgrState.audioContext) mgrState.audioContext.destroy();
  
  const lifecycleToken = mgrState._lifecycleToken;
  const isCurrent = () => (
    (typeof mgrState._isLifecycleCurrent !== 'function' ||
      mgrState._isLifecycleCurrent(lifecycleToken)) &&
    mgrState.audioContext === ctx
  );
  const ctx = wx.createInnerAudioContext();
  mgrState._moonPlaybackClock=null;
  mgrState._moonAudioWaiting=true;
  ctx.src = mgrState.audioPath || ASSETS.AUDIO;
  ctx.autoplay = true;
  ctx.loop = false;
  try {
    const zenVol = Math.max(0, Math.min(1, Number(APP_CFG?.audio?.zenVolume ?? 1.0) || 0));
    const mul = Math.max(0, Math.min(1, Number(APP_CFG?.audio?.moonVolumeMul ?? 1.0) || 0));
    ctx.volume = zenVol * mul;
  } catch(_) { ctx.volume = 0.65; }
  
  ctx.onPlay(() => {
    if (!isCurrent()) return;
    mgrState._moonAudioWaiting=false;
    traceMoon(mgrState,'audio-play');
    console.log('[Moon] Audio playing');
    let baseTimeMs = Date.now();
    try { baseTimeMs = baseTimeMs - Math.max(0, Number(ctx.currentTime || 0) * 1000); } catch(_){ }
    try { startMoonLyrics(mgrState, baseTimeMs); } catch(_){ }
  });
  ctx.onWaiting?.(()=>{if(isCurrent()){mgrState._moonAudioWaiting=true;traceMoon(mgrState,'audio-waiting');}});
  ctx.onCanplay?.(()=>{if(isCurrent()){mgrState._moonAudioWaiting=false;traceMoon(mgrState,'audio-canplay');}});
  ctx.onPause?.(()=>{if(isCurrent()){mgrState._moonAudioWaiting=true;traceMoon(mgrState,'audio-pause');}});
  ctx.onError((res) => {
    if (!isCurrent()) return;
    traceMoon(mgrState,'audio-error',{error:res.errCode});
    console.error('[Moon] Audio error', res);
  });
  ctx.onEnded(() => {
     if (!isCurrent()) return;
     traceMoon(mgrState,'audio-ended');
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
