const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.json':'application/json'};
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST'&&url.pathname==='/capture'){
  const chunks=[];let size=0;req.on('data',c=>{size+=c.length;if(size>16000000){req.destroy();return;}chunks.push(c);});
  req.on('end',()=>{fs.writeFileSync(path.join(__dirname,'trial-capture.png'),Buffer.concat(chunks));res.writeHead(200).end('saved');});return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
 if(pathname==='/'){res.writeHead(302,{Location:'/moon-terrain-trial/preview/index.html'}).end();return;}
 const file=pathname==='/earth.jpg'?path.resolve(root,'../experiments/moon-ridge-sample-2026-10-20/assets/earth.jpg'):path.resolve(root,'.'+pathname);
 if(pathname!='/earth.jpg'&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(file,(e,s)=>{if(e||!s.isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':s.size,'Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);});
}).listen(8963,'127.0.0.1',()=>console.log('月面素材试装 http://127.0.0.1:8963/'));
