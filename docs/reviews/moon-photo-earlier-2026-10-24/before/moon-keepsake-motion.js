// Approved crew-keepsake-motion timing. Paper stays opaque under the shutter.
export const PHOTO_END = 271.7266666666667;
export const PHOTO_SHUTTER = 266.94;
const smooth=x=>{const u=Math.max(0,Math.min(1,x));return u*u*(3-2*u);};
export function keepsakeAt(t){
  const reveal=smooth((t-267.07)/.42),grow=smooth((t-267.07)/8.5),linger=Math.max(0,t-275.57),drift=smooth(linger/2);
  const shutter=t<PHOTO_SHUTTER?0:t<267.05?smooth((t-PHOTO_SHUTTER)/.11):1-smooth((t-267.05)/.27);
  return {opacity:t>=267.07?1:0,shutter,backgroundDim:.46*smooth((t-PHOTO_SHUTTER)/1.2),blur:1.25*reveal,
    heightRatio:.61+.235*grow,angleDegrees:-2.4+3.5*grow+.32*Math.sin(linger*.30)*drift,
    offsetX:1.4*Math.sin(linger*.24)*drift,offsetY:9*(1-grow)+1.8*Math.sin(linger*.33)*drift};
}
export function keepsakeGeometry(state,width,height){
  const fit=Math.min(width/540,height/960),h=960*fit*state.heightRatio,border=h*.013,bottom=h*.038,ih=h-border-bottom,iw=ih*941/1672;
  return {fit,h,w:iw+2*border,ih,iw,border,bottom,x:state.offsetX*fit,y:state.offsetY*fit,angle:state.angleDegrees*Math.PI/180};
}
