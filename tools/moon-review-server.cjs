// 本机构图检查：直接运行右下角原轨道模块与项目的 Three 适配层，不请求音乐或云端资源。
// node tools/moon-review-server.cjs ; open http://127.0.0.1:8766/original
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
// 试航已于 2026-09-27 移出运行包；检查用的 2K 月面贴图从隔离目录读取，不参与小程序打包。
const archivedMoonTexture = path.join(root, 'archives/pending-delete-2026-09-27/miniprogram/assets/textures/refined-moon.jpg');
const page = `<!doctype html><meta charset="utf-8"><title>登月关键帧检查</title>
<style>body{margin:0;background:#090d16;color:#d9e1ec;font:16px system-ui;text-align:center}nav{padding:14px}button{margin:0 8px;padding:8px 16px}canvas{width:390px;height:720px;background:black}p{margin:8px;font-size:13px}</style>
<nav><button onclick="playSweep()">迎光回放（原速）</button><button onclick="show(167)">掠光一</button><button onclick="show(200)">掠光二</button><button onclick="show(174)">第一次回望</button><button onclick="show(243)">拉近前</button><button onclick="show(261)">最终停留</button><button onclick="save()">保存当前画面</button><button onclick="playReview()">连续检查（4倍速）</button></nav><input aria-label="时间" type="range" min="113" max="265" step="0.1" value="174" oninput="show(Number(this.value))"><p>右下角原轨道模块：仅检查地月构图 · 本地 WebGL 检查（不代替微信验收）</p><canvas id="frame" width="780" height="1440"></canvas><p id="status">正在载入本地贴图</p>
<script>var exports={};</script><script src="/adapter.js"></script><script type="module">
import {createOriginalMoonScene} from '/original-scene.js';
const canvas=document.querySelector('canvas');canvas.createImage=()=>new Image();canvas.requestAnimationFrame=requestAnimationFrame;canvas.cancelAnimationFrame=cancelAnimationFrame;
const THREE=exports.createScopedThreejs(canvas);const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(780,1440,false);
const view=createOriginalMoonScene(THREE,false);let current=174;await view.ready;
let playing=false;
const renderFrame=(t)=>{current=t;view.update(t,390/720);view.render(renderer);document.querySelector('#status').textContent=t+' 秒 · 可直接切换，无需播放音乐';};
window.show=(t)=>{playing=false;renderFrame(t);};
window.playReview=()=>{playing=true;let start=performance.now(),empty=0,count=0;const step=now=>{if(!playing)return;const t=Math.min(265,113+(now-start)/1000*4);renderFrame(t);count++;if(view.isMoonVisible && !view.isMoonVisible())empty++;if(t<265)requestAnimationFrame(step);else{playing=false;document.querySelector('#status').textContent='连续检查完成：'+count+' 帧，月球完全出画 '+empty+' 帧';}};requestAnimationFrame(step);};
window.playSweep=()=>{playing=true;const start=performance.now();const step=now=>{if(!playing)return;const t=161.5+(now-start)/1000;renderFrame(Math.min(t,172.5));if(t<172.5)requestAnimationFrame(step);else playing=false;};requestAnimationFrame(step);};
window.save=async()=>{await fetch('/capture/original-'+current,{method:'POST',body:canvas.toDataURL('image/png')});document.querySelector('#status').textContent='已保存实际 WebGL 画面：'+current+' 秒';};show(174);
</script>`;
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST' && /^\/capture\/original-\d{3}$/.test(url.pathname)){
  let body='';req.on('data',b=>{body+=b;if(body.length>15000000)req.destroy();});req.on('end',()=>{const dir=path.join(root,'docs/reviews/moon-refinement');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,url.pathname.split('/').pop()+'.png'),Buffer.from(body.split(',')[1],'base64'));res.end('ok');});return;
 }
 if(url.pathname==='/'||url.pathname==='/original'){
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(page);return;
 }
 if(url.pathname==='/original-scene.js'){
  const orbit=fs.readFileSync(path.join(root,'miniprogram/pages/gl/moon-orbit-sequence.js'),'utf8').replace(/^import .*;\n/gm,'');
  const harness=fs.readFileSync(path.join(root,'tools/moon-original-review-scene.js'),'utf8');
  res.setHeader('Content-Type','text/javascript');res.end('const fixTexture=()=>{};\n'+orbit+'\n'+harness);return;
 }
 if(url.pathname==='/assets/textures/refined-moon.jpg'){
  try{res.setHeader('Content-Type','image/jpeg');res.end(fs.readFileSync(archivedMoonTexture));return;}catch(e){res.writeHead(404).end();return;}
 }
 const file=url.pathname==='/adapter.js'?path.join(root,'miniprogram/node_modules/threejs-miniprogram/dist/index.js'):path.resolve(root,'miniprogram', '.'+url.pathname);
 if(!file.startsWith(path.join(root,'miniprogram')+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'image/jpeg');res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}
}).listen(Number(process.env.MOON_REVIEW_PORT || 8766),'127.0.0.1',()=>console.log('Moon review server ready'));
