const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{const p=clamp(x);return p*p*p*(p*(p*6-15)+10);};

export function goWestOpeningSpin(time,normalSpeed=3,firstLyricMs=36020){
  const gone=firstLyricMs/1000-4.8;
  // Five seconds earlier than the former 31.22s start, with the same normal
  // speed arrival. The braking curve now spans 8.6s rather than 3.6s.
  const slowAt=gone-5,normalAt=firstLyricMs/1000-1.2;
  const rise=ease((time-1)/2),fall=ease((time-slowAt)/(normalAt-slowAt));
  return {active:time>=1&&time<normalAt,speed:normalSpeed+(180-normalSpeed)*rise*(1-fall),slowAt,normalAt};
}

// Original video paths, in glyph units. Eighteen independently delayed real
// metal pieces converge to the exact six glyphs; no randomness per frame.
export function goWestOpeningFragment(time,letterIndex,partIndex){
  const k=letterIndex*3+partIndex,order=[0,.87,.24,1.28,.54,1.06];
  const at=5.5+order[letterIndex]+partIndex*.21;
  const length=4.8+((letterIndex+partIndex*2)%4)*.23;
  const u=clamp((time-at)/length),p=ease(u),remaining=1-p;
  const angle=[2.7,-.35,-2.2,.70,1.65,-1.25][letterIndex]+partIndex*1.91;
  const arc=Math.sin(Math.PI*p),waver=Math.sin(3*Math.PI*p)*remaining;
  return {alpha:ease((time-at)/.95),
    x:remaining*Math.cos(angle)*(4.6+.35*(k%5))+arc*(partIndex-1)*1.15,
    y:remaining*Math.sin(angle)*(2.5+.28*(k%4))+arc*(letterIndex%2?-.95:1.15)+waver*.23,
    z:remaining*(-2-.55*(k%4))+arc*(k%2?1.25:-.8),
    rx:remaining*(k%2?1:-1)*(Math.PI*2.1+.27*(k%3)),
    ry:remaining*(k%3?1:-1)*(Math.PI*1.7+.30*(k%4)),
    rz:remaining*(k%2?-1:1)*(Math.PI*.9+.40*partIndex),scale:.32+.68*p};
}
