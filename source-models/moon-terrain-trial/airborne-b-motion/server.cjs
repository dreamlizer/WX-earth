const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.json':'application/json'};
const outputs=new Set(['contact-sheet.png','validation.json',...[0,5,10,14,17,20].map(t=>'frame-'+String(t).padStart(2,'0')+'.png')]);
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST'&&url.pathname.startsWith('/capture/')){
  if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:8966'){res.writeHead(403).end();return;}
  const name=url.pathname.slice(9);if(!outputs.has(name)){res.writeHead(403).end();return;}
  const chunks=[];let size=0;req.on('data',c=>{size+=c.length;if(size>16000000){req.destroy();return;}chunks.push(c)});
  req.on('end',()=>{fs.writeFile(path.join(__dirname,'output',name),Buffer.concat(chunks),e=>res.writeHead(e?500:200).end(e?'write failed':'saved'))});return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{res.writeHead(400).end();return;}
 if(pathname==='/'){res.writeHead(302,{Location:'/moon-terrain-trial/airborne-b-motion/index.html'}).end();return;}
 const file=pathname==='/earth.jpg'?path.resolve(root,'../experiments/moon-ridge-sample-2026-10-20/assets/earth.jpg'):path.resolve(root,'.'+pathname);
 // Only the trial's reusable assets/vendor and current preview are exposed.
 const allowed=[path.join(__dirname,path.sep),path.join(root,'moon-terrain-trial/preview/assets/'),path.join(root,'moon-terrain-trial/airborne-comparison/assets/'),path.join(root,'mech-encounter-candidates/preview/vendor/')];
 if(pathname!=='/earth.jpg'&&!allowed.some(p=>file.startsWith(p))){res.writeHead(403).end();return;}
 fs.stat(file,(e,s)=>{if(e||!s.isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':s.size,'Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res)});
}).listen(8966,'127.0.0.1',()=>console.log('月面 B 动态样段 http://127.0.0.1:8966/'));
