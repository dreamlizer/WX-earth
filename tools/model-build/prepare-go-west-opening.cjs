// Generates only track four's opening assets. Existing song art is untouched.
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const fs=require('node:fs');
const path=require('node:path');
GlobalFonts.registerFromPath('/System/Library/Fonts/Avenir.ttc','GoWestTitle');
const dir=path.resolve(__dirname,'../../miniprogram/scene-art-assets/zen-opening');
function draw(name,text,width,height,size,tracking,colours){
  let canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
  ctx.textBaseline='middle';ctx.font=`${size}px GoWestTitle`;
  const glyphs=Array.from(text),advances=glyphs.map(c=>ctx.measureText(c).width);
  width=Math.min(width,Math.ceil(advances.reduce((a,b)=>a+b,0)+tracking*(glyphs.length-1)+48));
  canvas=createCanvas(width,height);ctx=canvas.getContext('2d');
  ctx.textBaseline='middle';ctx.font=`${size}px GoWestTitle`;
  let x=(width-advances.reduce((a,b)=>a+b,0)-tracking*(glyphs.length-1))/2;
  const ink=ctx.createLinearGradient(0,height*.2,0,height*.85);
  ink.addColorStop(0,colours[0]);ink.addColorStop(1,colours[1]);
  ctx.fillStyle=ink;ctx.shadowColor='rgba(95,165,194,.35)';ctx.shadowBlur=3;
  glyphs.forEach((c,i)=>{ctx.fillText(c,x,height*.52);x+=advances[i]+tracking;});
  fs.writeFileSync(path.join(dir,name+'.png'),canvas.toBuffer('image/png'));
}
draw('go-west-title','GO WEST',900,120,110,16,['#f0debb','#99cada']);
draw('pet-shop-boys','PET SHOP BOYS',700,96,62,6,['#d4e3eb','#99bdd3']);
