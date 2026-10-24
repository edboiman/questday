// Checks the book-opening scene still behaves as designed: same transition, swings to -115deg,
// reveals Chapter I, and works by tap (phone) and keyboard (desktop).
//   node scripts/build.mjs --personal && node e2e/opening.mjs
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4397;
const proc = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), '--personal'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => proc.stdout.on('data', (d) => String(d).includes('Serving') && r()));
const browser = await chromium.launch();
let failed = 0;
for (const [name, view, how] of [
  ['phone tap', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }, 'tap'],
  ['desktop keyboard', { viewport: { width: 1280, height: 860 } }, 'key'],
]) {
  const ctx = await browser.newContext(view);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/`);
  const btn = p.getByRole('button', { name: 'Open the book' });
  await btn.waitFor();
  const before = await p.$eval('.cover', (el) => { const s = getComputedStyle(el); return { t: s.transitionProperty + ' ' + s.transitionDuration + ' ' + s.transitionTimingFunction, origin: s.transformOrigin, persp: getComputedStyle(el.parentElement).perspective }; });
  const focused = await p.evaluate(() => document.activeElement?.textContent);
  if (how === 'tap') await btn.tap(); else await p.keyboard.press('Enter');
  await p.waitForTimeout(950);
  const end = await p.$eval('.cover', (el) => getComputedStyle(el).transform).catch(() => 'gone');
  await p.waitForTimeout(400);
  const gone = (await p.locator('.opening').count()) === 0;
  const chapter = await p.locator('h1').first().textContent();
  const ok = before.t === 'transform 0.9s cubic-bezier(0.6, 0, 0.3, 1)' && before.persp === '1800px' && focused === 'Open the book' && gone && chapter === 'Quests' && end !== 'none';
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}: ${before.t}, perspective ${before.persp}, end ${end.slice(0, 40)}…, closed ${gone}, page "${chapter}"`);
  if (!ok) failed++;
  await ctx.close();
}
await browser.close();
proc.kill();
process.exit(failed ? 1 : 0);
