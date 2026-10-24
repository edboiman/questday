import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const config = JSON.parse(await readFile(join(root, 'app.config.json'), 'utf8'));

/*
 * Content Security Policy.
 *  - default-src 'none': nothing loads unless listed below.
 *  - script/style/img/font/manifest/worker: this origin only. No inline script,
 *    no eval, no third-party hosts.
 *  - connect-src 'self': even if a bug tried to send data elsewhere, the
 *    browser would block the request.
 */
export const CSP_META = ["default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self'", "font-src 'self'", "connect-src 'self'", "manifest-src 'self'", "worker-src 'self'", "base-uri 'none'", "form-action 'none'"].join('; ');

/** Headers for any server that hosts dist/. frame-ancestors only works as a header. */
export const SECURITY_HEADERS = {
  'Content-Security-Policy': `${CSP_META}; frame-ancestors 'none'`,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderHtml(template, { css, js, csp, name = config.name }) {
  return template
    .replace('<!--app:csp-->', csp ? `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}" />` : '')
    .replaceAll('%NAME%', escapeHtml(name))
    .replaceAll('%DESCRIPTION%', escapeHtml(config.description))
    .replaceAll('%THEME%', escapeHtml(config.themeColor))
    .replace('%CSS%', css)
    .replace('%JS%', js);
}

export function manifest({ name = config.name, shortName = config.shortName } = {}) {
  return {
    name,
    short_name: shortName,
    description: config.description,
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'any',
    background_color: config.backgroundColor,
    theme_color: config.themeColor,
    categories: ['productivity', 'lifestyle'],
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Quests', url: './#/quests' },
      { name: 'Chores', url: './#/chores' },
    ],
  };
}

export const esbuildOptions = {
  entryPoints: { app: join(root, 'src/main.tsx') },
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  // Fonts and texture/ornament SVGs live in public/ and are copied next to the CSS, so url() keeps them as-is.
  external: ['*.woff', '*.svg'],
  logLevel: 'info',
};
