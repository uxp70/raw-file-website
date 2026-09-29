// Raw File Website - zero-dependency Node.js server
// Features: unlimited file size (streamed to disk), raw links, simple API
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_PATH = path.join(ROOT, 'data.json');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '[]', 'utf8');

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return [];
  }
}
function saveDB(rows) {
  fs.writeFileSync(DB_PATH, JSON.stringify(rows, null, 2), 'utf8');
}

const MIME = {
  '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css',
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.bmp': 'image/bmp', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.flac': 'audio/flac', '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf', '.zip': 'application/zip',
  '.rar': 'application/vnd.rar', '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar', '.gz': 'application/gzip',
  '.exe': 'application/octet-stream', '.apk': 'application/vnd.android.package-archive',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

function mimeFor(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  // normalize, block traversal
  rel = decodeURIComponent(rel).split('?')[0];
  const safe = path.normalize(rel).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // SPA fallback: serve index.html for unknown non-api routes (but not raw)
      const idx = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(idx) && !pathname.startsWith('/api/') && !pathname.startsWith('/raw/')) {
        const html = fs.readFileSync(idx);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length });
        res.end(html); return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return;
    }
    const type = mimeFor(filePath);
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, {
      'Content-Type': type + (type.startsWith('text/') ? '; charset=utf-8' : ''),
      'Content-Length': st.size,
      'Cache-Control': 'public, max-age=3600',
    });
    stream.pipe(res);
  });
}

function handleRaw(req, res, pathname) {
  // /raw/:id  or /raw/:id/anything
  const parts = pathname.split('/').filter(Boolean); // ['raw','id',...]
  const id = parts[1] || '';
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end('Invalid id'); return;
  }
  const db = loadDB();
  const entry = db.find(e => e.id === id);
  if (!entry) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('File not found'); return; }

  const filePath = path.join(UPLOAD_DIR, entry.stored);
  // extra safety: ensure inside upload dir
  if (!filePath.startsWith(UPLOAD_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('File missing on disk'); return; }

    const contentType = entry.mime && entry.mime !== 'application/octet-stream'
      ? entry.mime
      : mimeFor(entry.original);
    const safeName = (entry.original || 'file').replace(/["\r\n]/g, '');
    const range = req.headers.range;

    const baseHeaders = {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(entry.original || 'file')}`,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=31536000',
      'ETag': `"${entry.id}-${st.size}-${st.mtimeMs | 0}"`,
      'X-Raw-File-Name': encodeURIComponent(entry.original || 'file'),
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, { ...baseHeaders, 'Content-Length': st.size });
      res.end(); return;
    }

    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      if (m) {
        let start = m[1] === '' ? null : Number(m[1]);
        let end = m[2] === '' ? null : Number(m[2]);
        if (start === null && end !== null) { start = st.size - end; end = st.size - 1; }
        if (start === null) start = 0;
        if (end === null || end >= st.size) end = st.size - 1;
        if (start >= st.size || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
          res.end(); return;
        }
        res.writeHead(206, {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${end}/${st.size}`,
          'Content-Length': end - start + 1,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.writeHead(200, { ...baseHeaders, 'Content-Length': st.size });
    fs.createReadStream(filePath).pipe(res);
  });
}

function handleUpload(req, res, searchParams) {
  const rawName = searchParams.get('filename') || req.headers['x-file-name'] || 'untitled';
  let original = 'untitled';
  try { original = decodeURIComponent(rawName); } catch { original = String(rawName); }
  original = path.basename(original).slice(0, 255) || 'untitled';

  const clientMime = req.headers['content-type'] || '';
  const ext = path.extname(original);
  const id = Date.now().toString(36) + crypto.randomBytes(6).toString('hex');
  const stored = id + (ext ? ext.slice(0, 16) : '');
  const dest = path.join(UPLOAD_DIR, stored);

  // NO SIZE LIMIT: stream directly to disk, never buffer in memory
  const out = fs.createWriteStream(dest);
  let bytes = 0;
  let aborted = false;

  req.on('data', chunk => { bytes += chunk.length; });
  req.on('aborted', () => { aborted = true; });
  req.on('error', () => { aborted = true; });
  out.on('error', (e) => {
    try { req.destroy(); } catch {}
    sendJSON(res, 500, { error: 'Write failed: ' + e.message });
  });

  req.pipe(out);
  out.on('finish', () => {
    if (aborted) { try { fs.unlinkSync(dest); } catch {} return; }
    let finalSize = bytes;
    try { finalSize = fs.statSync(dest).size; } catch {}
    const mime = clientMime && clientMime !== 'application/octet-stream'
      ? clientMime.split(';')[0]
      : mimeFor(original);
    const entry = {
      id,
      original,
      stored,
      size: finalSize,
      mime,
      uploadedAt: new Date().toISOString(),
    };
    const db = loadDB();
    db.unshift(entry);
    saveDB(db);
    sendJSON(res, 200, { ok: true, ...entry, raw: `/raw/${id}` });
  });
}

const server = http.createServer((req, res) => {
  // Increase timeout for huge uploads, no body limit
  req.setTimeout(0);
  res.setTimeout(0);

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-File-Name, Content-Length',
      'Access-Control-Max-Age': '86400',
    });
    res.end(); return;
  }

  if (pathname.startsWith('/raw/') && (req.method === 'GET' || req.method === 'HEAD')) {
    handleRaw(req, res, pathname); return;
  }

  if (pathname === '/api/files' && req.method === 'GET') {
    sendJSON(res, 200, loadDB()); return;
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    handleUpload(req, res, url.searchParams); return;
  }

  if (pathname.startsWith('/api/files/') && req.method === 'DELETE') {
    const id = pathname.split('/')[3] || '';
    const db = loadDB();
    const idx = db.findIndex(e => e.id === id);
    if (idx === -1) { sendJSON(res, 404, { error: 'Not found' }); return; }
    const [entry] = db.splice(idx, 1);
    saveDB(db);
    try { fs.unlinkSync(path.join(UPLOAD_DIR, entry.stored)); } catch {}
    sendJSON(res, 200, { ok: true }); return;
  }

  if (pathname === '/api/health' && req.method === 'GET') {
    sendJSON(res, 200, { ok: true, uploads: loadDB().length }); return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res, pathname); return;
  }

  res.writeHead(404); res.end('Not found');
});

// Disable default Node request size guards — we stream, so unlimited
server.requestTimeout = 0;
server.headersTimeout = 0;
server.timeout = 0;
server.maxRequestsPerSocket = 0;

server.listen(PORT, () => {
  console.log(`\n  Raw File Website running at http://localhost:${PORT}`);
  console.log(`  Uploads dir: ${UPLOAD_DIR}`);
  console.log(`  Raw links look like: http://localhost:${PORT}/raw/<id>\n`);
});
