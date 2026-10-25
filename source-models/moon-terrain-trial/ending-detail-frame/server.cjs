const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.json':'application/json','.mp3':'audio/mpeg','.wav':'audio/wav'};
const outputs=new Set(['baseline.png','enhanced.png','validation.json']);
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST'&&url.pathname.startsWith('/capture/')){
  if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:8974'){res.writeHead(403).end();return;}
  const name=url.pathname.slice(9);if(!outputs.has(name)){res.writeHead(403).end();return;}
  const chunks=[];let size=0;req.on('data',c=>{size+=c.length;if(size>16000000){req.destroy();return;}chunks.push(c)});
  req.on('end',()=>{fs.writeFile(path.join(__dirname,'output',name),Buffer.concat(chunks),e=>res.writeHead(e?500:200).end(e?'write failed':'saved'))});return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{res.writeHead(400).end();return;}
 if(pathname==='/'){res.writeHead(302,{Location:'/moon-terrain-trial/ending-detail-frame/index.html'}).end();return;}
 const shared={'/moon.jpg':'moon.jpg','/earth.jpg':'earth.jpg','/clouds.png':'clouds.png'};
 const official={'/earth.jpg':'preview-day.jpg','/clouds.png':'preview-cloud.png'};
 const file=official[pathname]?path.resolve(root,'../miniprogram/scene-art-assets/textures/',official[pathname]):shared[pathname]?path.resolve(root,'../experiments/moon-ridge-sample-2026-10-20/assets/',shared[pathname]):path.resolve(root,'.'+pathname);
 // Only the trial's reusable assets/vendor and current preview are exposed.
 const allowed=[path.join(root,'moon-terrain-trial/crew-rim-balance/'),path.join(__dirname,path.sep),path.join(root,'moon-terrain-trial/descent-to-earth-193/assets/'),path.join(root,'moon-terrain-trial/preview/assets/'),path.join(root,'moon-terrain-trial/airborne-comparison/assets/'),path.join(root,'mech-encounter-candidates/preview/vendor/')];
 if(!shared[pathname]&&!allowed.some(p=>file.startsWith(p))){res.writeHead(403).end();return;}
 fs.stat(file,(e,s)=>{if(e||!s.isFile()){res.writeHead(404).end();return;}const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};let start=0,end=s.size-1,code=200;if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m){res.writeHead(416).end();return;}start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end;if(start>end){res.writeHead(416,{'Content-Range':'bytes */'+s.size}).end();return;}code=206;headers['Content-Range']=`bytes ${start}-${end}/${s.size}`;}headers['Content-Length']=end-start+1;res.writeHead(code,headers);if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res)});
}).listen(8974,'127.0.0.1',()=>console.log('193秒至曲终 · 月面与远地球 http://127.0.0.1:8974/'));
