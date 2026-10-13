// Build deterministic transparent typography; uses the bundled @napi-rs/canvas runtime.
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const fs=require('fs');
GlobalFonts.registerFromPath('/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf','ZenTitle');
GlobalFonts.registerFromPath('/System/Library/Fonts/Supplemental/Times New Roman.ttf','ZenArtist');
const dir=require('path').resolve(__dirname,'../../miniprogram/scene-art-assets/zen-opening');fs.mkdirSync(dir,{recursive:true});
function lettering(name,text,{width,height,font,size,color,spacing=0,glow=0}){
 const c=createCanvas(width,height),x=c.getContext('2d');x.font=`${size}px ${font}`;x.textBaseline='middle';
 const total=x.measureText(text).width+spacing*(text.length-1);let left=(width-total)/2;
 x.fillStyle=color;x.shadowColor=color;x.shadowBlur=glow;
 for(const letter of text){x.fillText(letter,left,height*.5);left+=x.measureText(letter).width+spacing;}
 fs.writeFileSync(`${dir}/${name}.png`,c.toBuffer('image/png'));
}
lettering('how-deep-title','How Deep Is Your Love',{width:900,height:120,font:'ZenTitle',size:82.5,color:'#fff4e4',glow:4.5});
lettering('bee-gees','Bee Gees',{width:400,height:80,font:'ZenArtist',size:47,color:'#b9d1e4',spacing:11,glow:1.5});
lettering('out-of-darkness-title','Out of Darkness',{width:900,height:120,font:'ZenTitle',size:82.5,color:'#fff4e4',glow:4.5});
lettering('aubrey-ashburn','Aubrey Ashburn',{width:700,height:80,font:'ZenArtist',size:47,color:'#b9d1e4',spacing:8,glow:1.5});
const c=createCanvas(900,90),x=c.getContext('2d');x.scale(.5,.5);
let g=x.createRadialGradient(900,90,0,900,90,700);g.addColorStop(0,'rgba(144,197,232,0.28)');g.addColorStop(.14,'rgba(103,160,207,0.17)');g.addColorStop(1,'rgba(90,152,211,0)');x.fillStyle=g;x.save();x.translate(0,76);x.scale(1,.15);x.fillRect(0,0,1800,1800);x.restore();
g=x.createLinearGradient(130,90,1670,90);g.addColorStop(0,'rgba(86,145,196,0)');g.addColorStop(.42,'rgba(112,174,222,.35)');g.addColorStop(.5,'rgba(216,236,248,.65)');g.addColorStop(.58,'rgba(112,174,222,.35)');g.addColorStop(1,'rgba(86,145,196,0)');x.strokeStyle=g;x.lineWidth=2;x.beginPath();x.moveTo(130,90);x.lineTo(1670,90);x.stroke();
let seed=43;const rnd=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
for(let i=0;i<80;i++){let px=210+rnd()*1380,py=90+(rnd()-.5)*48;const opacity=.08+rnd()*.21;x.fillStyle=`rgba(158,200,232,${opacity})`;x.beginPath();x.arc(px,py,.55+rnd()*1.2,0,Math.PI*2);x.fill();}
g=x.createRadialGradient(900,90,0,900,90,28);g.addColorStop(0,'rgba(224,243,255,.65)');g.addColorStop(.2,'rgba(156,210,247,.28)');g.addColorStop(1,'rgba(90,161,222,0)');x.fillStyle=g;x.fillRect(870,60,60,60);
fs.writeFileSync(`${dir}/blue-starlight.png`,c.toBuffer('image/png'));
for(const f of fs.readdirSync(dir))console.log(f,fs.statSync(dir+'/'+f).size);
