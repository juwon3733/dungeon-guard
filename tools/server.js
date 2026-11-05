// 개발 확인용 정적 파일 서버. 실행: node tools/server.js (게임 자체는 index.html을 바로 열어도 된다)
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.env.PORT) || 8123;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.css': 'text/css' };

http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(root, clean === '/' ? 'index.html' : clean);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
    });
}).listen(port, () => console.log(`http://localhost:${port}`));
