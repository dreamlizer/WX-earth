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

// Local bitmap lettering: final glyphs and their arriving pixels share cells.
// All positions are functions of song time so scrubbing is repeatable.
const glyphs={
  A:['01110','10001','10001','11111','10001','10001','10001'],
  B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01111','10000','10000','10000','10000','10000','01111'],
  D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','11110','10000','10000','11111'],
  F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01111','10000','10000','10111','10001','10001','01111'],
  H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['11111','00100','00100','00100','00100','00100','11111'],
  J:['00111','00010','00010','00010','10010','10010','01100'],
  K:['10001','10010','10100','11000','10100','10010','10001'],
  L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'],
  N:['10001','11001','10101','10011','10001','10001','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],
  P:['11110','10001','10001','11110','10000','10000','10000'],
  Q:['01110','10001','10001','10001','10101','10010','01101'],
  R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'],
  T:['11111','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','01110'],
  V:['10001','10001','10001','10001','10001','01010','00100'],
  W:['10001','10001','10001','10101','10101','10101','01010'],
  X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'],
  Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00001','01110'],
  '-':['00000','00000','00000','11111','00000','00000','00000'],
  '?':['01110','10001','00001','00010','00100','00000','00100']
};
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const smooth=n=>{const p=clamp(n);return p*p*(3-2*p);};

export function pixelArtistLayout(text,size,tracking){
  const pitch=size/7,grain=pitch/2,cell=grain*.74,cells=[];
  let x=0;
  for(const [letter,char] of Array.from(text.toUpperCase()).entries()){
    if(char===' '){x+=pitch*3+tracking;continue;}
    (glyphs[char] || glyphs['?']).forEach((row,y)=>Array.from(row).forEach((on,column)=>{
      if(on!=='1')return;
      for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++){
        const seed=letter*701+y*97+column*17+sy*7+sx+1;
        // Small gaps and jitter roughen the grain without losing the glyph.
        if(hash(seed+801)<.055)continue;
        cells.push({x:x+(column+.25+sx*.5)*pitch+(hash(seed+32)-.5)*grain*.28,
          y:(y-3.25+sy*.5)*pitch+(hash(seed+53)-.5)*grain*.28,
          size:grain*(.52+.39*hash(seed+98)),letter,index:cells.length});
      }
    }));
    x+=pitch*5+tracking+pitch;
  }
  const width=Math.max(0,x-tracking-pitch);
  cells.forEach(c=>{c.x-=width/2;});
  return {cells,width,height:size,cell,pitch};
}

export function pixelArtistCell(cell,age,layout){
  const n=cell.index+1,a=hash(n),b=hash(n+37),c=hash(n+93);
  const delay=.15+1.15*a+.30*(cell.x/Math.max(1,layout.width)+.5);
  const duration=1.55+1.05*b,p=clamp((age-delay)/duration),r=1-p;
  // Decelerating cells bend through a blocky current and snap to the bitmap.
  const settle=1-r*r*r,side=a<.5?-1:1;
  let x=cell.x+side*(80+170*b)*r*r+Math.sin(p*Math.PI*2+c*6)*28*r;
  let y=cell.y+(b-.5)*260*r*r-Math.sin(p*Math.PI)*(28+65*c)*r;
  const grid=layout.pitch*(.25+1.5*r),snap=smooth(p/.88);
  x=x*(snap)+Math.round(x/grid)*grid*(1-snap);
  y=y*(snap)+Math.round(y/grid)*grid*(1-snap);
  const alpha=smooth((age-delay)/.19);
  const flash=Math.sin(Math.PI*clamp((p-.82)/.18))**2;
  return {x,y,alpha,scale:.7+.3*settle+flash*.18,rotation:side*Math.PI*.5*r*r,
    trail:r*smooth(p*5),flash,progress:p};
}

export function pixelArtistColour(cell,layout){
  const palette=[[253,183,208],[221,117,159],[182,104,145],[246,151,183],[204,151,201],[255,207,218]];
  const rgb=palette[Math.floor(hash(cell.index+218)*palette.length)],shade=.68+.32*hash(cell.index+12);
  return rgb.map(v=>Math.round(v*shade));
}

// Camera-space path: a readable outward burst precedes the dive. Opacity
// stays solid; the globe's depth buffer hides each pixel on contact.
export function pixelArtistScatter(index,start,earth,radius,progress){
  const p=clamp((progress-hash(index+41)*.075)/(1-hash(index+41)*.075));
  const angle=hash(index+85)*Math.PI*2,distance=radius*(.15+.26*hash(index+130));
  const scattered={x:start.x+Math.cos(angle)*distance,
    y:start.y+Math.sin(angle)*distance*.78+radius*.06,
    z:start.z+radius*(.06+.16*hash(index+271))};
  const scatter=1-Math.pow(1-clamp(p/.30),3),fall=smooth((p-.32)/.68);
  let point;
  if(p<.32)point={x:start.x+(scattered.x-start.x)*scatter,
    y:start.y+(scattered.y-start.y)*scatter,z:start.z+(scattered.z-start.z)*scatter};
  else {
    const target={x:earth.x+(hash(index+307)-.5)*radius*.32,
      y:earth.y+(hash(index+351)-.5)*radius*.25,z:earth.z-radius*1.35};
    const control={x:scattered.x*.55+earth.x*.45,
      y:Math.max(scattered.y,earth.y+radius*.65),z:earth.z+radius*.95};
    const a=(1-fall)*(1-fall),b=2*fall*(1-fall),c=fall*fall;
    point={x:a*scattered.x+b*control.x+c*target.x,
      y:a*scattered.y+b*control.y+c*target.y,
      z:scattered.z+(target.z-scattered.z)*fall*fall};
  }
  return {...point,scale:(1+1.7*smooth(p/.24))*(1-.38*fall),
    rotation:p*(hash(index+471)-.5)*Math.PI*3,alpha:1,progress:p,fall};
}
