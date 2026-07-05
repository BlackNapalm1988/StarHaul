import { createServer } from 'node:http';
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, relative, resolve } from 'node:path';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || 'localhost';
const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, 'reports');
const REPORT_FILE = join(REPORT_DIR, 'playtest-reports.jsonl');
const MAX_BODY_BYTES = 64 * 1024;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png'
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function safeStaticPath(urlPath) {
    const rawPath = decodeURIComponent(new URL(urlPath, `http://${HOST}:${PORT}`).pathname);
  const cleanPath = rawPath === '/' ? '/index.html' : rawPath;
  const target = resolve(ROOT, `.${normalize(cleanPath)}`);
  const rel = relative(ROOT, target);
  if (rel.startsWith('..') || rel === '' || rel.includes('node_modules')) return null;
  if (rel.startsWith('reports')) return null;
  return target;
}

function readRequestBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectBody(new Error('Report too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectBody);
  });
}

function normalizeReport(raw) {
  const type = raw?.type === 'Feature Request' ? 'Feature Request' : 'Bug';
  const comment = String(raw?.comment || '').trim().slice(0, 1200);
  if (!comment) return null;
  return {
    id: String(raw?.id || `SH-${Date.now().toString(36)}`),
    type,
    comment,
    context: raw?.context || {},
    receivedAt: new Date().toISOString()
  };
}

async function handleReport(req, res) {
  try {
    const body = await readRequestBody(req);
    const report = normalizeReport(JSON.parse(body || '{}'));
    if (!report) {
      sendJson(res, 400, { saved: false, error: 'Comment is required' });
      return;
    }
    await mkdir(REPORT_DIR, { recursive: true });
    await appendFile(REPORT_FILE, `${JSON.stringify(report)}\n`, 'utf8');
    sendJson(res, 201, { saved: true, path: 'reports/playtest-reports.jsonl', id: report.id });
  } catch (err) {
    sendJson(res, 400, { saved: false, error: err.message || 'Invalid report' });
  }
}

async function handleStatic(req, res) {
  const filePath = safeStaticPath(req.url || '/');
  if (!filePath) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');
    const type = contentTypes[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': info.size
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(filePath).pipe(res);
  } catch {
    try {
      const notFound = await readFile(join(ROOT, 'index.html'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(notFound);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/playtest-report') {
    handleReport(req, res);
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    handleStatic(req, res);
    return;
  }
  res.writeHead(405, { Allow: 'GET, HEAD, POST' });
  res.end('Method not allowed');
});

server.on('error', err => {
  console.error(`Unable to start StarHaul playtest server on ${HOST}:${PORT}: ${err.message}`);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`StarHaul playtest server running at http://${HOST}:${PORT}/`);
  console.log('Reports append to reports/playtest-reports.jsonl');
});
