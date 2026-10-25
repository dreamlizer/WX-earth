import {createScene} from './scene.js';
const $=s=>document.querySelector(s),audio=$('#audio');
const errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
let current=193,playing=false,busy=false,raf=0;
const telemetry={completed:0,frames:0,startTime:null,endTime:null,maxAudioVisualDelta:0,stalls:0,muted:false};
try{
 const [config,anchor]=await Promise.all(['./shot-config.json','./orbit-anchor.json'].map(url=>fetch(url).then(r=>{if(!r.ok)throw Error('配置加载失败');return r.json()})));
 const view=await createScene($('#render'),config,anchor);
 const phase=t=>[...config.phases].reverse().find(p=>t>=p[0])?.[1]||config.phases[0][1];
 function show(t){current=Math.min(config.end,Math.max(config.start,t));view.render(current);$('#time').value=current;$('#clock').textContent=current.toFixed(2)+' / '+config.end.toFixed(2)+' 秒 · 样段 '+(current-config.start).toFixed(2)+' 秒';$('#phase').textContent=phase(current);}
 function pause(){playing=false;audio.pause();cancelAnimationFrame(raf);$('#play').textContent='播放（含原音乐）';$('#status').textContent='已暂停 · 音乐与画面停在同一时间';}
 function frame(){if(!playing)return;show(config.start+audio.currentTime);telemetry.frames++;telemetry.endTime=current;telemetry.maxAudioVisualDelta=Math.max(telemetry.maxAudioVisualDelta,Math.abs(current-(config.start+audio.currentTime)));raf=requestAnimationFrame(frame);}
 async function seek(t){pause();show(t);audio.currentTime=current-config.start;}
 async function play(){if(busy)return;if(current>=config.end-.02)await seek(config.start);if(Math.abs(config.start+audio.currentTime-current)>.1)audio.currentTime=current-config.start;try{await audio.play();playing=true;telemetry.startTime??=current;$('#play').textContent='暂停';$('#status').textContent='原音乐正常速度播放 · 画面跟随音乐时间';raf=requestAnimationFrame(frame);}catch(e){$('#status').textContent='音乐播放失败：'+e.message;errors.push(e.message);}}
 $('#play').onclick=()=>playing?pause():play();$('#replay').onclick=async()=>{await seek(config.start);telemetry.startTime=config.start;telemetry.frames=0;telemetry.maxAudioVisualDelta=0;play()};$('#baseline').onclick=()=>seek(232);$('#time').oninput=e=>{if(!busy)seek(Number(e.target.value))};$('#mute').onchange=e=>{audio.muted=e.target.checked;telemetry.muted=audio.muted};
 audio.addEventListener('waiting',()=>{if(playing)telemetry.stalls++});audio.addEventListener('error',()=>{const msg='音乐加载失败 '+audio.error?.code;errors.push(msg);$('#status').textContent=msg});audio.addEventListener('ended',()=>{pause();telemetry.completed++;telemetry.endTime=config.end;telemetry.nativeEnded=true;show(config.end);$('#status').textContent='原音乐自然结束 · 远地球终景'});
 const metadata=audio.readyState>=1?Promise.resolve():new Promise((resolve,reject)=>{audio.addEventListener('loadedmetadata',resolve,{once:true});audio.addEventListener('error',reject,{once:true})});await metadata;audio.currentTime=0;audio.volume=.8;show(config.start);
 async function save(name,data){const r=await fetch('/capture/'+name,{method:'POST',body:data});if(!r.ok)throw Error('保存失败 '+name)}
 $('#capture').onclick=async()=>{pause();busy=true;const old=current;document.querySelectorAll('button,input').forEach(e=>e.disabled=true);try{
  const sheet=document.createElement('canvas');sheet.width=1488;sheet.height=2136;const ctx=sheet.getContext('2d');ctx.fillStyle='#080b11';ctx.fillRect(0,0,sheet.width,sheet.height);const pixelStats=[];
  for(let i=0;i<config.keyframes.length;i++){const t=config.keyframes[i];show(t);const frameName='frame-'+t.toFixed(2)+'.png';await save(frameName,await new Promise(r=>view.renderer.domElement.toBlob(r,'image/png')));const x=(i%4)*372,y=Math.floor(i/4)*712;ctx.drawImage(view.renderer.domElement,x,y,360,640);ctx.fillStyle='#c2d6ee';ctx.font='500 18px system-ui';ctx.fillText(t.toFixed(2)+' 秒',x+10,y+670);ctx.fillStyle='#96a2b5';ctx.font='15px system-ui';ctx.fillText(phase(t),x+10,y+697);
   const gl=view.renderer.getContext(),pixels=new Uint8Array(540*960*4);gl.readPixels(0,0,540,960,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let lowerNonBlack=0;for(let py=0;py<120;py++)for(let px=0;px<540;px++){const k=(py*540+px)*4;if(pixels[k]+pixels[k+1]+pixels[k+2]>6)lowerNonBlack++;}pixelStats.push({time:t,bottom120RowsNonBlackPixels:lowerNonBlack});
  }
  await save('contact-sheet.png',await new Promise(r=>sheet.toBlob(r,'image/png')));const report={...view.inspect(),audio:{duration:audio.duration,sourceEnd:config.start+audio.duration,sourceStart:config.start,volume:audio.volume,muted:audio.muted,readyState:audio.readyState,networkState:audio.networkState},playback:{...telemetry},pixelStats,errors:[...errors]};await save('validation.json',new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));$('#report').textContent='已保存12张关键帧、联系图与验证数据';$('#status').textContent='已保存至 descent-to-earth-193/output/';
 }catch(e){$('#status').textContent=e.message;errors.push(e.message);console.error(e)}finally{busy=false;show(old);audio.currentTime=old-config.start;document.querySelectorAll('button,input').forEach(e=>e.disabled=false)}};
 document.querySelectorAll('button,input').forEach(e=>e.disabled=false);$('#status').textContent='月面与原音乐已就绪 · 从193秒开始播放';
}catch(e){$('#status').textContent='准备失败：'+e.message;console.error(e);}
