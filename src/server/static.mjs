import fs from 'node:fs';
import path from 'node:path';

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
});

const MISSING_UI = `<!doctype html><meta charset="utf-8"><title>Herdr DB</title>
<body style="font:14px -apple-system,sans-serif;padding:32px">
<h1>Herdr DB</h1><p>The viewer UI has not been built yet. Run <code>npm run build:ui</code> in the plugin directory.</p>`;

export function serveStatic(uiDir, pathname, res) {
  const relative = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.(\/|\\|$))+/, '');
  const candidate = path.join(uiDir, relative);
  const insideUi = candidate.startsWith(uiDir + path.sep) || candidate === uiDir;
  const file = insideUi && fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(uiDir, 'index.html');

  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'content-type': CONTENT_TYPES['.html'] });
    res.end(MISSING_UI);
    return;
  }
  const isAsset = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
    'cache-control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}
