// Zero-dependency static server for dist/. Needs only Node — no npm install.
//
//   node scripts/serve.mjs            → http://localhost:4173, this computer only
//   node scripts/serve.mjs --lan      → also reachable from your local network
//   PORT=5000 node scripts/serve.mjs  → different port
//
// It serves files and nothing else: no API, no uploads, no logging of requests.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { root, SECURITY_HEADERS } from './shared.mjs';

const dist = join(root, process.argv.includes('--android') ? 'dist-android' : process.argv.includes('--personal') ? 'dist-personal' : 'dist');
const lan = process.argv.includes('--lan');
const host = lan ? '0.0.0.0' : '127.0.0.1';
const port = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

try {
  await stat(join(dist, 'index.html'));
} catch {
  console.error('dist/ is missing. Run "npm install" and "npm run build" first (or use the prebuilt dist/ from the download).');
  process.exit(1);
}

const server = createServer(async (req, res) => {
  const send = (code, body) => {
    res.writeHead(code, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  };
  // Unless --lan was asked for, only answer requests addressed to this computer by name.
  const hostName = String(req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();
  if (!lan && !['localhost', '127.0.0.1', '[::1]'].includes(hostName)) return send(403, 'Forbidden');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method not allowed');
  let path;
  try {
    path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    return send(400, 'Bad request');
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(dist, path));
  // Never serve anything outside dist/.
  if (file !== dist && !file.startsWith(dist + sep)) return send(403, 'Forbidden');
  const type = TYPES[extname(file).toLowerCase()];
  try {
    const info = await stat(file);
    if (!info.isFile() || !type) return send(404, 'Not found');
    const hashed = /-[A-Z0-9]{8}\.(js|css)$/.test(file);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': type,
      'Content-Length': info.size,
      // Hashed assets never change; everything else (index.html, sw.js) is always revalidated so updates arrive.
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  } catch {
    send(404, 'Not found');
  }
});

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the other program or set PORT=<number>.` : `Server error: ${e.code ?? 'unknown'}`);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`\nServing dist/ at http://localhost:${port}`);
  if (!lan) {
    console.log('Reachable from this computer only. Press Ctrl+C to stop.');
    return;
  }
  const addresses = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('\n--lan: the app is now reachable by EVERY device on your local network:');
  for (const a of addresses) console.log(`  http://${a}:${port}`);
  console.log('\nOnly the app files are served; your quests are not (they live inside each browser).');
  console.log('Over plain http on a LAN address the app cannot be installed or work offline —');
  console.log('use USB port forwarding for that (see README). Use this only on a network you trust,');
  console.log('and stop the server with Ctrl+C when you are done.');
});
