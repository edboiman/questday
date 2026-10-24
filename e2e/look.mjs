// Visual snapshot of the personal build: opening scene (closed, mid-swing, open), every chapter,
// on a phone and a desktop, in the chosen theme. Screenshots go to e2e/shots/look-*.png.
//   node scripts/build.mjs --personal && node e2e/look.mjs [theme]
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const theme = process.argv[2] || 'wildwood';
const PORT = 4396;
const ORIGIN = `http://localhost:${PORT}`;
const out = join(root, 'e2e/shots');
await mkdir(out, { recursive: true });
const proc = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), '--personal'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => proc.stdout.on('data', (d) => String(d).includes('Serving') && r()));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];

for (const [name, view] of [
  ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['desk', { viewport: { width: 1280, height: 860 } }],
]) {
  const ctx = await browser.newContext(view);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  p.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(`${name}: ${m.text()}`));
  p.on('requestfailed', (r) => errors.push(`${name}: failed ${r.url()}`));
  await p.goto(`${ORIGIN}/`);
  await p.getByRole('button', { name: 'Open the book' }).waitFor();
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(out, `look-${name}-0-cover.png`) });
  await p.getByRole('button', { name: 'Open the book' }).click();
  await p.waitForTimeout(450);
  await p.screenshot({ path: join(out, `look-${name}-1-swing.png`) });
  await p.waitForTimeout(1400);
  // Seed sample data and pick the theme.
  await p.goto(`${ORIGIN}/#/settings`);
  await p.getByRole('button', { name: 'Reset and seed sample data' }).click();
  await p.getByRole('button', { name: 'Reset and seed', exact: true }).click();
  await p.waitForTimeout(600);
  await p.evaluate((t) => localStorage.setItem('theme', t), theme);
  const pick = p.locator(`button.theme-pick[data-theme-id="${theme}"]`);
  if (await pick.count()) await pick.click();
  await p.waitForTimeout(300);
  for (const page of ['quests', 'chores', 'city', 'rewards', 'progress', 'settings']) {
    await p.goto(`${ORIGIN}/#/${page}`);
    await p.waitForTimeout(700);
    await p.screenshot({ path: join(out, `look-${name}-${page}.png`), fullPage: page !== 'settings' });
  }
  // Complete a quest to capture the reward flourish.
  await p.goto(`${ORIGIN}/#/quests`);
  await p.waitForTimeout(600);
  const check = p.locator('.row:not(.done) .check').first();
  if (await check.count()) {
    await check.click();
    await p.waitForTimeout(220);
    await p.screenshot({ path: join(out, `look-${name}-complete.png`) });
  }
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) errors.push(`${name}: horizontal overflow ${overflow}px`);
  await ctx.close();
}
await browser.close();
proc.kill();
console.log(errors.length ? `Problems:\n  ${errors.join('\n  ')}` : 'No console errors, failed requests or overflow.');
