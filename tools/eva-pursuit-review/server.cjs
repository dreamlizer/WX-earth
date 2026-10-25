const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  let file=url.pathname==='/'?'tools/eva-pursuit-review/index.html':url.pathname==='/adapter.js'?'miniprogram/node_modules/threejs-miniprogram/dist/index.js':'miniprogram'+decodeURIComponent(url.pathname);
  if(url.pathname==='/capture'&&req.method==='POST'){
    let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
      try{const d=JSON.parse(body);if(!/^(pose|pursuit)-[0-9.]+$/.test(d.name))throw Error('name');
        const out=path.join(root,'docs/reviews/eva-pursuit-2026-10-22');fs.mkdirSync(out,{recursive:true});
        fs.writeFileSync(path.join(out,d.name+'.png'),Buffer.from(d.image.split(',')[1],'base64'));res.end('ok');
      }catch(_){res.writeHead(400).end();}
    });return;
  }
  const absolute=path.resolve(root,file);if(!absolute.startsWith(root+path.sep))return res.writeHead(403).end();
  try{
    let data=fs.readFileSync(absolute);
    if(file.endsWith('.js')&&file!=='miniprogram/node_modules/threejs-miniprogram/dist/index.js'){
      data=data.toString().replace(/require\('(\.\.\/\.\.\/assets\/models\/[^']+\.js)'\)/g,(_,relative)=>JSON.stringify(require(path.resolve(path.dirname(absolute),relative))));
    }
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream');res.end(data);
  }catch(_){res.writeHead(404).end();}
}).listen(18976,'127.0.0.1',()=>console.log('EVA pursuit review http://127.0.0.1:18976/'));
