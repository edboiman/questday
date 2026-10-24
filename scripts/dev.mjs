// Development server with rebuild-on-request. Binds to localhost only.
// No service worker and no CSP meta in dev; use `npm run build && npm start` to test those.
import { context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { esbuildOptions, manifest, renderHtml, root } from './shared.mjs';

const dir = join(root, '.dev');
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
await cp(join(root, 'public'), dir, { recursive: true });
await writeFile(join(dir, 'index.html'), renderHtml(await readFile(join(root, 'index.html'), 'utf8'), { css: './app.css', js: './app.js', csp: '' }));
await writeFile(join(dir, 'manifest.webmanifest'), JSON.stringify(manifest(), null, 2));

const ctx = await context({
  ...esbuildOptions,
  outdir: dir,
  sourcemap: 'inline',
  define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true', __QA_ADMIN__: 'true', __QA_TARGET__: '"web"', __QA_RC_KEY__: '""' },
});
const option = (name) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const port = Number(option('--port') ?? process.env.PORT) || 5173;
const host = option('--host') ?? '127.0.0.1';
await ctx.serve({ servedir: dir, host, port });
console.log(`\nDev server: http://localhost:${port}  (this computer only)\nReload the page after editing; each request rebuilds.`);
