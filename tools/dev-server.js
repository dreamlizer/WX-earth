// 轻量静态服务器：用于本地预览 miniprogram 目录（不依赖第三方库）
// Windows 运行：node tools/dev-server.js
// 说明：仅提供静态文件服务，不具备微信小程序运行环境，但可用于快速检查资源可加载和修改是否无报错。

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..', 'miniprogram');
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.txt': 'text/plain; charset=utf-8',
  '.wxml': 'text/xml; charset=utf-8',
  '.wxss': 'text/css; charset=utf-8'
};

function sendFile(res, filePath){
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send404(res);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function send404(res){
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
}

function listDir(res, dir){
  fs.readdir(dir, { withFileTypes: true }, (err, entries) => {
    if (err) return send404(res);
    const items = entries.map(e => {
      const mark = e.isDirectory() ? '/' : '';
      return `<li><a href="${encodeURIComponent(e.name)}${mark}">${e.name}${mark}</a></li>`;
    }).join('\n');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>miniprogram</title><h1>miniprogram/</h1><ul>${items}</ul>`);
  });
}

const server = http.createServer((req, res) => {
  try {
    const reqUrl = url.parse(req.url).pathname || '/';
    const safeUrl = reqUrl.replace(/\../g, ''); // 粗暴阻止越权路径
    const target = path.join(ROOT, safeUrl);
    fs.stat(target, (err, stat) => {
      if (err) return send404(res);
      if (stat.isDirectory()) {
        const indexHtml = path.join(target, 'index.html');
        fs.stat(indexHtml, (e2, s2) => {
          if (!e2 && s2.isFile()) return sendFile(res, indexHtml);
          return listDir(res, target);
        });
      } else {
        return sendFile(res, target);
      }
    });
  } catch(_){ send404(res); }
});

server.listen(PORT, () => {
  const urlStr = `http://localhost:${PORT}/`;
  console.log('[dev-server] serving:', ROOT);
  console.log('[dev-server] url:', urlStr);
});