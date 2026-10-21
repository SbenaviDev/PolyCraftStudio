// Servidor HTTP simple para PolyCraft Studio Web
// Uso: node server.js
// Luego abre http://localhost:3000 en tu navegador

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.obj': 'text/plain',
  '.stl': 'application/octet-stream',
  '.fbx': 'application/octet-stream'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - Archivo no encontrado</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Error interno del servidor: ' + error.code, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  PolyCraft Studio Web - Servidor Local   ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║  Servidor corriendo en:                   ║`);
  console.log(`║  http://localhost:${PORT}                    ║`);
  console.log('║                                            ║');
  console.log('║  Presiona Ctrl+C para detener             ║');
  console.log('╚════════════════════════════════════════════╝');
});
