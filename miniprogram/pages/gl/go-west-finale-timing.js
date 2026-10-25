// The approved finale now begins five seconds earlier. Keep the source audio
// and source lyric timestamps; stop their display one second before the foil.
export const GO_WEST_FINALE = {start:244,duration:15,first:4.1,gap:.75};
export const GO_WEST_LYRIC_CUTOFF=GO_WEST_FINALE.start+GO_WEST_FINALE.first-1;
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{const p=clamp(x);return p*p*p*(p*(p*6-15)+10);};
const progress=(t,a,b)=>ease((t-a)/Math.max(.01,b-a));
const pulse=(t,at,decay)=>t<at?0:(1-Math.exp(-(t-at)*85))*Math.exp(-(t-at)/decay);

export function goWestFinaleFrame(time){
  if(!Number.isFinite(time)||time<GO_WEST_FINALE.start)return null;
  // An ended audio context holds its last sample: retain the lit finale until
  // the song is restarted, changed or disabled, rather than dimming the ball.
  const t=Math.min(GO_WEST_FINALE.duration,time-GO_WEST_FINALE.start);
  const hits=[GO_WEST_FINALE.first,GO_WEST_FINALE.first+GO_WEST_FINALE.gap,
    GO_WEST_FINALE.first+2*GO_WEST_FINALE.gap];
  const charge=progress(t,.8,hits[0]);
  const shock=hits.reduce((sum,at,i)=>sum+pulse(t,at,.27+i*.055)*(i===2?1:.48+i*.16),0);
  const flash=hits.reduce((sum,at,i)=>sum+pulse(t,at,.065)*(i===2?.65:.12+i*.05),0);
  return {time,t,hits,final:hits[2],charge,shock,flash,
    lampGain:(1+.35*progress(t,0,.8))*(1+.23*charge+.64*shock),
    title:progress(t,hits[2]+.05,hits[2]+.95),kick:shock*.65};
}
