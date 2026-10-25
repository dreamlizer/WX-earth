const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const root=__dirname,project=path.resolve(root,'../..'),out=path.join(root,'output');
let encoder=null,done=null,frames=0,err='';
const buffer=req=>new Promise((resolve,reject)=>{const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject);});
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),route=decodeURIComponent(url.pathname);
 if(req.method==='POST'){
  if(/^\/capture\/\d+\.\d$/.test(route)){fs.writeFileSync(path.join(out,'frame-'+route.split('/').pop()+'.png'),await buffer(req));res.end('ok');return;}
  if(route==='/export/start'){
   if(encoder)throw new Error('An export is already active');frames=0;err='';
   encoder=spawn('/Users/a1234/.local/bin/ffmpeg',['-y','-f','image2pipe','-framerate','30','-vcodec','png','-i','pipe:0','-filter_complex','[0:v]split=2[a][b];[b]crop=720:1280:720:80[new]','-map','[a]','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'moon-ridge-comparison.mp4'),'-map','[new]','-c:v','libx264','-crf','17','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'moon-ridge-sample.mp4')],{stdio:['pipe','ignore','pipe']});
   encoder.stderr.on('data',d=>err=(err+d).slice(-2000));encoder.stdin.on('error',()=>{});done=new Promise(resolve=>encoder.on('close',code=>resolve(code)));res.end('ok');return;
  }
  if(route==='/export/frame'){if(!encoder)throw new Error('Export not started');const data=await buffer(req);await new Promise((resolve,reject)=>encoder.stdin.write(data,e=>e?reject(e):resolve()));frames++;res.end('ok');return;}
  if(route==='/export/finish'){if(!encoder)throw new Error('Export not started');encoder.stdin.end();const code=await done;encoder=null;if(code!==0||frames!==840)throw new Error('Export failed: '+frames+' frames '+err);res.end('ok');return;}
  res.writeHead(404).end();return;
 }
 if(route==='/original.js'){
  let source=fs.readFileSync(path.join(root,'original-orbit.snapshot.js'),'utf8').replace(/^import .*;\n/gm,'').replaceAll('/scene-art-assets/textures/preview-day.jpg','/assets/earth.jpg').replaceAll('/scene-art-assets/textures/preview-cloud.png','/assets/clouds.png');
  let harness=fs.readFileSync(path.join(root,'original-harness.snapshot.js'),'utf8').replace('/assets/textures/refined-moon.jpg','/assets/moon.jpg');
  res.setHeader('Content-Type','text/javascript');res.end('const fixTexture=()=>{};const ensureSceneArtPackage=()=>Promise.resolve();\n'+source+'\n'+harness);return;
 }
 const file=route==='/adapter.js'?path.join(project,'miniprogram/node_modules/threejs-miniprogram/dist/index.js'):path.resolve(root,'.'+(route==='/'?'/index.html':route));
 if(route!=='/adapter.js'&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const stat=fs.statSync(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');
 if(req.headers.range){const m=/bytes=(\d+)-(\d*)/.exec(req.headers.range),a=+m[1],b=m[2]?+m[2]:stat.size-1;res.writeHead(206,{'Content-Range':`bytes ${a}-${b}/${stat.size}`,'Accept-Ranges':'bytes','Content-Length':b-a+1});fs.createReadStream(file,{start:a,end:b}).pipe(res);}else{res.setHeader('Content-Length',stat.size);fs.createReadStream(file).pipe(res);}
 }catch(e){res.writeHead(500);res.end(e.message);}});
server.listen(8962,'127.0.0.1',()=>console.log('Moon ridge sample: http://127.0.0.1:8962'));
