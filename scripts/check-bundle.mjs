// Inspects the production build for things that must never ship:
// secrets, source maps, remote resources, dynamic code execution and network calls.
//
//   npm run build && npm run check:bundle
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { root } from './shared.mjs';

const personal = process.argv.includes('--personal');
const android = process.argv.includes('--android');
const dist = join(root, android ? 'dist-android' : personal ? 'dist-personal' : 'dist');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])))).flat();
}

const files = await walk(dist);
const text = files.filter((f) => /\.(js|css|html|webmanifest|svg|json)$/.test(f));
const problems = [];
const notes = [];
const flag = (file, message) => problems.push(`${relative(dist, file)}: ${message}`);

// URLs that are identifiers or documentation strings inside libraries, never fetched.
const INERT_URLS = [
  /^https:\/\/jcgt\.org\/published\/0007\/04\/01\/$/, // Three.js PMREM shader paper citation, inside a GLSL comment; never fetched.
  /^https?:\/\/www\.w3\.org\//, // XML/SVG/MathML namespace identifiers
  /^https:\/\/react\.dev\//, // React's error-code help link, printed in error text only
];

const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/, 'API secret key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'GitHub token'],
  [/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/, 'JWT'],
  [/(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"']{6,}["']/i, 'hard-coded credential'],
  [/\b(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?:\.\d{1,3})?\b/, 'private network address'],
];

const NETWORK_APIS = [/\bXMLHttpRequest\b/, /\bnew WebSocket\b/, /\bEventSource\b/, /\bsendBeacon\b/, /\bimportScripts\b/];

for (const file of files) {
  if (file.endsWith('.map')) flag(file, 'source map present');
}

for (const file of text) {
  const body = await readFile(file, 'utf8');
  const name = relative(dist, file);

  if (/sourceMappingURL=/.test(body)) flag(file, 'references a source map');
  // RevenueCat public SDK keys (goog_…) are meant to ship in apps; anything else that looks like a key is flagged.
  const scanned = body.replace(/apiKey\s*:\s*"goog_[A-Za-z0-9]+"/g, 'apiKey:"<revenuecat public key>"');
  for (const [pattern, label] of SECRET_PATTERNS) if (pattern.test(scanned)) flag(file, `possible ${label}`);
  if (/\b(?:sk_|rk_)(?:live|test)_[A-Za-z0-9]{10,}/.test(body)) flag(file, 'possible secret payment key');

  const urls = [...new Set(body.match(/https?:\/\/[^\s"'`<>)\\]+/g) ?? [])];
  const live = urls.filter((u) => !INERT_URLS.some((ok) => ok.test(u)));
  for (const u of live) flag(file, `remote URL: ${u}`);
  if (urls.length > live.length) notes.push(`${name}: ${urls.length - live.length} inert URL string(s) (namespace / documentation identifiers, never requested)`);

  if (name.endsWith('.js')) {
    if (/\beval\s*\(/.test(body) || /new Function\s*\(/.test(body)) flag(file, 'dynamic code execution');
    for (const api of NETWORK_APIS) if (api.test(body)) flag(file, `network API: ${api.source}`);
    // The app bundle must not call fetch at all; only the service worker may, for same-origin app files.
    if (name !== 'sw.js' && /\bfetch\s*\(/.test(body)) flag(file, 'fetch() call in the app bundle');
    if (/dangerouslySetInnerHTML\s*:/.test(body.replace(/dangerouslySetInnerHTML:\s*null/g, ''))) notes.push(`${name}: React's own dangerouslySetInnerHTML plumbing is present (library code); the app source never uses it (see src/safety.test.ts)`);
  }
  if (name.endsWith('.html')) {
    if (/<script(?![^>]*\bsrc=)[^>]*>/.test(body)) flag(file, 'inline script');
    if (/\son[a-z]+\s*=/.test(body)) flag(file, 'inline event handler');
    if (!/http-equiv="Content-Security-Policy"/.test(body)) flag(file, 'CSP meta tag missing');
  }
  if (name.endsWith('.css') && /@import|url\(\s*["']?(?:https?:)?\/\//.test(body)) flag(file, 'remote stylesheet, font or image');
}

console.log(`Checked ${files.length} files in dist/.`);
for (const n of notes) console.log(`  note: ${n}`);
// The store build must not contain the personal build's admin tools.
if (!personal) {
  for (const file of text.filter((f) => f.endsWith('.js'))) {
    const body = await readFile(file, 'utf8');
    for (const marker of ['Admin adjustment', 'qa-admin-day-offset', 'Admin tools']) if (body.includes(marker)) flag(file, `admin code in the store build: "${marker}"`);
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('No secrets, source maps, remote resources, dynamic code or network calls found.');
