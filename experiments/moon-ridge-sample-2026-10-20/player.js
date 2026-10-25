import {createRidgeScene,DURATION} from './scene.js';
import {createOriginalMoonScene} from './original.js';
const $=s=>document.querySelector(s),W=720,H=1280;
function setup(id){const canvas=$(id);canvas.createImage=()=>new Image();canvas.requestAnimationFrame=requestAnimationFrame;canvas.cancelAnimationFrame=cancelAnimationFrame;const THREE=exports.createScopedThreejs(canvas);const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setSize(W,H,false);return {canvas,THREE,renderer};}
const before=setup('#before'),after=setup('#after');before.view=createOriginalMoonScene(before.THREE);after.view=createRidgeScene(after.THREE);
let current=0,playing=false,rendering=false,start=0;
function show(t){current=t;before.view.update(243+t,W/H);before.view.render(before.renderer);after.view.update(t,W/H);after.view.render(after.renderer);$('#time').value=t;$('#status').textContent=`${t.toFixed(1)} / 28 秒 · ${t<9?'贴近月面':t<17?'越过山脊':t<23?'地球显露':'停留 · 让画面呼吸'}`;}
await Promise.all([before.view.ready,after.view.ready]);
$('#play').onclick=()=>{if(rendering)return;playing=true;start=performance.now();requestAnimationFrame(step);};
function step(now){if(!playing)return;const t=Math.min(DURATION,(now-start)/1000);show(t);if(t<DURATION)requestAnimationFrame(step);else playing=false;}
$('#pause').onclick=()=>playing=false;
$('#time').oninput=e=>{playing=false;if(!rendering)show(+e.target.value);};
$('#solo').onclick=()=>{document.body.classList.toggle('single');$('#solo').textContent=document.body.classList.contains('single')?'并排比较':'只看新样段';};
const png=canvas=>new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
$('#save').onclick=async()=>{playing=false;await fetch('/capture/'+current.toFixed(1),{method:'POST',body:await png(after.canvas)});$('#status').textContent+=' · 实际渲染帧已保存';};
$('#export').onclick=async()=>{
 if(rendering)return;playing=false;rendering=true;
 try{
  await fetch('/export/start',{method:'POST'});
  const composite=document.createElement('canvas');composite.width=W*2;composite.height=H+80;const c=composite.getContext('2d');
  for(let f=0;f<DURATION*30;f++){
   const t=f/30;show(t);c.fillStyle='#080a0e';c.fillRect(0,0,W*2,H+80);c.drawImage(before.canvas,0,80);c.drawImage(after.canvas,W,80);
   c.fillStyle='#c4ccda';c.font='25px -apple-system, sans-serif';c.fillText('原版 / ORIGINAL ORBIT',30,48);c.fillText('新样段 / OVER THE RIDGE',W+30,48);
   const r=await fetch('/export/frame',{method:'POST',body:await png(composite)});if(!r.ok)throw new Error(await r.text());
   if(f%15===0)$('#renderProgress').textContent=`渲染 ${f+1} / ${DURATION*30} 帧（${Math.round(f/(DURATION*30)*100)}%）`;
  }
  $('#renderProgress').textContent='正在封装 MP4…';const r=await fetch('/export/finish',{method:'POST'});if(!r.ok)throw new Error(await r.text());
  $('#renderProgress').textContent='完成：28 秒 / 30 fps。';$('#exports').innerHTML='<a href="/output/moon-ridge-sample.mp4" target="_blank">播放新样段 MP4</a><a href="/output/moon-ridge-comparison.mp4" target="_blank">播放前后对比 MP4</a>';show(28);
 }catch(e){$('#renderProgress').textContent='导出失败：'+e.message;}finally{rendering=false;}
};
show(0);
