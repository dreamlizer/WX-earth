// Fast-forward is a visual review gesture. On release, seek the same player to
// the reviewed position before giving its native samples ownership again.
export function setMoonPlaybackSpeed(mgr, value) {
  if(mgr._moonPhotoHold)return;
  const speed = Math.max(.1, Math.min(20, Number(value)));
  if (!Number.isFinite(speed) || speed === mgr._speedMult) return;
  if (speed === 1 && mgr._speedMult !== 1 && mgr.audioContext) {
    const duration = Number(mgr.audioContext.duration);
    const target = Math.max(0, Math.min(mgr._accumTime,
      duration > 0 ? Math.max(0, duration - .05) : Infinity));
    mgr._moonPlaybackSeek = target;
    mgr._moonPlaybackClock = null;
    try { mgr.audioContext.seek(target); }
    catch (error) { mgr._moonPlaybackSeek = null; console.warn('[Moon] Review seek failed', error); return; }
  }
  mgr._speedMult = speed;
}

// Smooth native audio samples for per-frame camera motion, including waiting and resume.
export function moonPlaybackTime(mgr,now=Date.now()) {
  const hold=mgr._moonPhotoHold;
  if(hold)return hold.time+(hold.paused?0:Math.max(0,now-hold.at)/1000);
  if(!mgr.audioContext||mgr._speedMult!==1)return null;
  const raw=Number(mgr.audioContext.currentTime);
  if(!Number.isFinite(raw)||raw<0)return null;
  if (mgr._moonPlaybackSeek != null) {
    const target = mgr._moonPlaybackSeek;
    // seek() completes asynchronously; the old native sample is still readable.
    if (raw < target - .1 || raw > target + 2) return target;
    mgr._moonPlaybackSeek = null;
    mgr._moonPlaybackClock = null;
  }
  let c=mgr._moonPlaybackClock;
  if(!c){c=mgr._moonPlaybackClock={sample:raw,sampleAt:now,output:raw,updatedAt:now};return raw;}
  // This voyage has no backwards seek. Native zero/stale samples (including at
  // ended) must not replay the departure or clamp an active tail to its first frame.
  if (raw < c.sample - .5) { c.updatedAt = now; return c.output; }
  if(raw!==c.sample){c.sample=raw;c.sampleAt=now;}
  const dt=Math.max(0,(now-c.updatedAt)/1000);c.updatedAt=now;
  if(mgr._moonAudioWaiting){c.output=raw;c.sampleAt=now;return c.output;}
  const estimate=raw+Math.min(.3,Math.max(0,(now-c.sampleAt)/1000));
  // A large discrepancy is a seek/foreground catch-up, rather than accumulated lost dt.
  if(Math.abs(c.output-estimate)>.6)c.output=estimate;
  else c.output+=dt+Math.max(-dt*.5,Math.min(dt*.5,estimate-(c.output+dt)));
  return Math.max(0,c.output);
}
