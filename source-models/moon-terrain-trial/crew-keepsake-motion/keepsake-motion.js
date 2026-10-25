export const START=193, END=271.7266666666667, REVIEW_START=263, SHUTTER=266.94;
export const KEYS=[263,266.90,267.04,267.28,268,270,END,276,289.7266666666667];
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const u=clamp(x);return u*u*(3-2*u);};
// Every visual property is a function of the same presentation time. No CSS
// animation clock: pause, seek and replay cannot leave the paper drifting alone.
export function keepsakeAt(t){
 const reveal=smooth((t-267.07)/.42),grow=smooth((t-267.07)/8.5),linger=Math.max(0,t-275.57);
 const drift=smooth(linger/2);
 const shutter=t<SHUTTER?0:t<267.05?smooth((t-SHUTTER)/.11):1-smooth((t-267.05)/.27);
 // Reveal opaque paper under the dark shutter. A translucent photograph would
 // show the old Earth through the new one and wash its black sky grey.
 return {time:t,opacity:t>=267.07?1:0,shutter,backgroundDim:.46*smooth((t-SHUTTER)/1.2),blur:1.25*reveal,
   heightRatio:.61+.235*grow,angleDegrees:-2.4+3.5*grow+.32*Math.sin(linger*.30)*drift,
   offsetX:1.4*Math.sin(linger*.24)*drift,offsetY:9*(1-grow)+1.8*Math.sin(linger*.33)*drift};
}
export function photoGeometry(state,image,width=540,height=960){
 const h=height*state.heightRatio,border=h*.013,bottom=h*.038,ih=h-border-bottom,iw=ih*image.width/image.height,w=iw+2*border;
 const cx=width/2+state.offsetX,cy=height/2+state.offsetY,a=state.angleDegrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>[cx+x*c-y*s,cy+x*s+y*c]);
 return {w,h,iw,ih,border,bottom,cx,cy,a,corners,inFrame:corners.every(([x,y])=>x>=0&&x<=width&&y>=0&&y<=height)};
}
export function drawKeepsake(ctx,world,image,t){
 const s=keepsakeAt(t),W=ctx.canvas.width,H=ctx.canvas.height;
 ctx.save();ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);ctx.filter=`brightness(${1-s.backgroundDim}) blur(${s.blur}px)`;ctx.drawImage(world,0,0,W,H);ctx.restore();
 const g=photoGeometry(s,image,W,H);
 if(s.opacity>0){
  ctx.save();ctx.translate(g.cx,g.cy);ctx.rotate(g.a);ctx.globalAlpha=s.opacity;
  ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=23;ctx.shadowOffsetY=12;
  ctx.fillStyle='#e8e5dc';ctx.fillRect(-g.w/2,-g.h/2,g.w,g.h);
  ctx.shadowColor='transparent';ctx.drawImage(image,-g.iw/2,-g.h/2+g.border,g.iw,g.ih);
  ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=.6;ctx.strokeRect(-g.w/2+.3,-g.h/2+.3,g.w-.6,g.h-.6);ctx.restore();
 }
 if(s.shutter>0){ctx.save();ctx.globalAlpha=s.shutter;ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);ctx.restore();}
 return {...s,photo:g};
}
