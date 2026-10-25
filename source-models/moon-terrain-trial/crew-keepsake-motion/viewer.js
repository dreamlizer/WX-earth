import {createScene} from '../crew-grounded-motion/scene.js';
import {START,END,REVIEW_START,KEYS,keepsakeAt,photoGeometry,drawKeepsake} from './keepsake-motion.js';
const $=s=>document.querySelector(s),errors=[];
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
let current=REVIEW_START,playing=false,busy=false,raf=0,last=0;
const playback={frames:0,completed:0,events:[],maxFrameGapMs:0};
try{
 const [config,anchor,image]=await Promise.all([
  fetch('../crew-grounded-motion/shot-config.json').then(r=>r.json()),fetch('../crew-grounded-motion/orbit-anchor.json').then(r=>r.json()),
  new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('纪念照加载失败'));i.src='/keepsake-photo.png';})
 ]);
 const stage=$('#stage'),canvas=$('#render'),ctx=canvas.getContext('2d'),world=document.createElement('canvas');
 const fit=()=>{const r=stage.getBoundingClientRect(),k=Math.min(r.width/540,r.height/960);canvas.style.width=540*k+'px';canvas.style.height=960*k+'px';};new ResizeObserver(fit).observe(stage);fit();
 const view=await createScene(world,config,anchor);view.setRefined(true);
 function phase(t){if(t<SHUTTER_TIME)return t>=255?'同望地球 · 镜头仍在慢行':[...config.phases].reverse().find(p=>t>=p[0])?.[1];if(t<267.35)return '快门轻暗 · 留下这一瞬';if(t<275.57)return '纪念照浮现 · 缓慢放大与转动';return '照片轻浮 · 留在这片宇宙里';}
 const SHUTTER_TIME=266.94;
 function show(t){const before=current;current=Math.max(START,t);view.render(current);const state=drawKeepsake(ctx,world,image,current);$('#time').value=Math.min(Number($('#time').max),current);$('#clock').textContent=current<=END?current.toFixed(2)+' / '+END.toFixed(2)+' 秒':END.toFixed(2)+' 秒 · 照片停留 '+(current-END).toFixed(1)+' 秒';$('#phase').textContent=phase(current);if(playing&&before<END&&current>=END){playback.completed++;playback.events.push({event:'natural-tail-end',time:current});$('#status').textContent='原片段已结束 · 无声照片继续轻浮，不自动重播';}return state;}
 function pause(){playing=false;cancelAnimationFrame(raf);$('#play').textContent='继续播放';$('#status').textContent='已暂停 · 背景与相框同时停住';playback.events.push({event:'pause',time:current});}
 function frame(now){if(!playing)return;const dt=(now-last)/1000;playback.maxFrameGapMs=Math.max(playback.maxFrameGapMs,now-last);last=now;show(current+dt);playback.frames++;raf=requestAnimationFrame(frame);}
 function play(){if(playing||busy)return;playing=true;last=performance.now();$('#play').textContent='暂停';$('#status').textContent='无声播放 · 照片与背景使用同一个时钟';playback.events.push({event:'play',time:current});raf=requestAnimationFrame(frame);}
 function seek(t){pause();show(t);playback.events.push({event:'seek',time:current});}
 $('#play').onclick=()=>playing?pause():play();$('#replay').onclick=()=>{seek(REVIEW_START);play();};$('#full').onclick=()=>{seek(START);play();};$('#photo').onclick=()=>{seek(276);play();};$('#time').oninput=e=>seek(Number(e.target.value));
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause();});
 const save=async(name,data)=>{const r=await fetch('/capture/'+name,{method:'POST',body:data});if(!r.ok)throw Error('保存失败 '+name);};
 $('#capture').onclick=async()=>{
  pause();busy=true;const old=current;document.querySelectorAll('button,input').forEach(e=>e.disabled=true);
  try{
   const sheet=document.createElement('canvas');sheet.width=1080;sheet.height=2040;const sc=sheet.getContext('2d');sc.fillStyle='#080b11';sc.fillRect(0,0,1080,2040);const samples=[];
   for(let i=0;i<KEYS.length;i++){const t=KEYS[i],state=show(t);samples.push(state);await save('frame-'+t.toFixed(2)+'.png',await new Promise(r=>canvas.toBlob(r,'image/png')));const x=i%3*360,y=Math.floor(i/3)*680;sc.drawImage(canvas,x,y,360,640);sc.fillStyle='#c8d4e4';sc.font='16px system-ui';sc.fillText(t.toFixed(2)+'s · '+(t<267?'3D场景':t<275.57?'相框靠近':'照片轻浮'),x+9,y+665);}
   await save('contact-sheet.png',await new Promise(r=>sheet.toBlob(r,'image/png')));
   const cr=canvas.getBoundingClientRect(),controls=$('#controls').getBoundingClientRect(),audioRequests=performance.getEntriesByType('resource').filter(r=>/\.(wav|mp3|m4a|ogg)(\?|$)/i.test(r.name)).map(r=>r.name);
   const report={page:'crew-keepsake-motion',timeBasis:'silent performance.now presentation clock; full 3D scene reused',samples,playback,errors,audio:{elements:document.querySelectorAll('audio,video').length,requests:audioRequests,soundEffects:false},layout:{viewport:[innerWidth,innerHeight],canvas:{x:cr.x,y:cr.y,width:cr.width,height:cr.height},controls:{top:controls.top,bottom:controls.bottom},fullFrameVisible:cr.left>=0&&cr.right<=innerWidth&&cr.top>=0&&cr.bottom<=innerHeight,controlsVisible:controls.top>=0&&controls.bottom<=innerHeight},webglError:view.renderer.getContext().getError()};
   await save('validation.json',new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));$('#report').textContent=JSON.stringify({audio:report.audio,layout:report.layout,webglError:report.webglError,errors,playback},null,2);$('#status').textContent='已保存9张关键帧、联系图与检查记录';
  }catch(e){errors.push(e.message);$('#status').textContent=e.message;}finally{busy=false;show(old);document.querySelectorAll('button,input').forEach(e=>e.disabled=false);}
 };
 show(REVIEW_START);document.querySelectorAll('button,input').forEach(e=>e.disabled=false);$('#status').textContent='已就绪 · 默认结尾前263秒 · 全程无声';
}catch(e){errors.push(e.message);$('#status').textContent='准备失败：'+e.message;console.error(e);}
