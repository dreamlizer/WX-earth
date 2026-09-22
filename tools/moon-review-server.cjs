// Local visual review of the actual trial scene/Three adapter. No music or cloud requests.
// node tools/moon-review-server.cjs ; open http://127.0.0.1:8766
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const page = `<!doctype html><meta charset="utf-8"><title>登月关键帧检查</title>
<style>body{margin:0;background:#090d16;color:#d9e1ec;font:16px system-ui;text-align:center}nav{padding:14px}button{margin:0 8px;padding:8px 16px}canvas{width:390px;height:720px;background:black}p{margin:8px;font-size:13px}</style>
<nav><button onclick="show(156)">第一次回望</button><button onclick="show(188)">月球遮挡</button><button onclick="show(245)">最终停留</button><button onclick="save()">保存当前画面</button></nav><p>实际场景代码 · 本地 WebGL 构图检查（不代替微信验收）</p><canvas id="frame" width="780" height="1440"></canvas><p id="status">正在载入本地贴图</p>
<script>var exports={};</script><script src="/adapter.js"></script><script type="module">
import {createMoonTrialScene} from '/scene.js';
const canvas=document.querySelector('canvas');canvas.createImage=()=>new Image();canvas.requestAnimationFrame=requestAnimationFrame;canvas.cancelAnimationFrame=cancelAnimationFrame;
const THREE=exports.createScopedThreejs(canvas);const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(780,1440,false);
const view=createMoonTrialScene(THREE,false);let current=156;await view.ready;
window.show=(t)=>{current=t;view.update(t,390/720);view.render(renderer);document.querySelector('#status').textContent=t+' 秒 · 可直接切换，无需播放音乐';};
window.save=async()=>{await fetch('/capture/'+current,{method:'POST',body:canvas.toDataURL('image/png')});document.querySelector('#status').textContent='已保存实际 WebGL 画面：'+current+' 秒';};show(156);
</script>`;
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST' && /^\/capture\/(156|188|245)$/.test(url.pathname)){
  let body='';req.on('data',b=>{body+=b;if(body.length>15000000)req.destroy();});req.on('end',()=>{const dir=path.join(root,'docs/reviews/moon-refinement');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,url.pathname.split('/').pop()+'.png'),Buffer.from(body.split(',')[1],'base64'));res.end('ok');});return;
 }
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(page);return;}
 if(url.pathname==='/scene.js'){
  const source=fs.readFileSync(path.join(root,'miniprogram/pages/gl/moon-trial-scene.js'),'utf8').replace(/^import .*;\n/gm,'');
  const data=fs.readFileSync(path.join(root,'miniprogram/pages/gl/moon-voyage-zodiac-data.js'),'utf8');
  res.setHeader('Content-Type','text/javascript');res.end('const fixTexture=()=>{};\n'+data+'\n'+source);return;
 }
 const file=url.pathname==='/adapter.js'?path.join(root,'miniprogram/node_modules/threejs-miniprogram/dist/index.js'):path.resolve(root,'miniprogram', '.'+url.pathname);
 if(!file.startsWith(path.join(root,'miniprogram')+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'image/jpeg');res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}
}).listen(8766,'127.0.0.1',()=>console.log('Moon review: http://127.0.0.1:8766'));
