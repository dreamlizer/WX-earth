// Smooth native audio samples for per-frame camera motion, including waiting and resume.
export function moonPlaybackTime(mgr,now=Date.now()) {
  if(!mgr.audioContext||mgr._speedMult!==1)return null;
  const raw=Number(mgr.audioContext.currentTime);
  if(!Number.isFinite(raw)||raw<0)return null;
  let c=mgr._moonPlaybackClock;
  if(!c){c=mgr._moonPlaybackClock={sample:raw,sampleAt:now,output:raw,updatedAt:now};return raw;}
  if(raw!==c.sample){c.sample=raw;c.sampleAt=now;}
  const dt=Math.max(0,(now-c.updatedAt)/1000);c.updatedAt=now;
  if(mgr._moonAudioWaiting){c.output=raw;c.sampleAt=now;return c.output;}
  const estimate=raw+Math.min(.3,Math.max(0,(now-c.sampleAt)/1000));
  // A large discrepancy is a seek/foreground catch-up, rather than accumulated lost dt.
  if(Math.abs(c.output-estimate)>.6)c.output=estimate;
  else c.output+=dt+Math.max(-dt*.5,Math.min(dt*.5,estimate-(c.output+dt)));
  return Math.max(0,c.output);
}
