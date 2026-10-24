// Browser test for the personal (admin) build in dist-personal/.
//   node scripts/build.mjs --personal && node e2e/personal.mjs
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4394;
const ORIGIN = `http://localhost:${PORT}`;
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const proc = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), '--personal'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => proc.stdout.on('data', (d) => String(d).includes('Serving') && r()));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => sessionStorage.setItem('qa-opened', '1'));
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text()));
let failed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`);
  }
};
const balances = () =>
  p.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('questday');
        open.onsuccess = () => {
          const req = open.result.transaction('events').objectStore('events').getAll();
          req.onsuccess = () => {
            const live = req.result.filter((e) => !e.voidedAt);
            resolve({ xp: live.reduce((n, e) => n + (e.kind === 'task' || e.kind === 'chore' || e.kind === 'admin' ? e.xp : 0), 0), coins: live.reduce((n, e) => n + e.coins, 0), gems: live.reduce((n, e) => n + (e.gems ?? 0), 0) });
            open.result.close();
          };
        };
      }),
  );

console.log('\nPersonal build (admin tools)');
await p.goto(`${ORIGIN}/#/settings`);

await step('admin panel is present and adjusts XP, coins and gems', async () => {
  await p.getByRole('heading', { name: 'Admin tools' }).waitFor();
  await p.getByLabel('XP (+/−)').fill('250');
  await p.getByLabel('Coins (+/−)').fill('500');
  await p.getByLabel('Gems (+/−)').fill('400');
  await p.getByRole('button', { name: 'Apply adjustment' }).click();
  await p.getByText('Admin adjustment applied').waitFor();
  const b = await balances();
  assert(b.xp === 250 && b.coins === 500 && b.gems === 400, JSON.stringify(b));
  await p.getByLabel('Coins (+/−)').fill('-9999');
  await p.getByRole('button', { name: 'Apply adjustment' }).click();
  await p.getByText('That would take a balance below zero.').waitFor();
});

await step('premium toggle unlocks the premium wings', async () => {
  await p.getByLabel('Premium unlocked on this device').click();
  await p.waitForTimeout(300);
  assert(await p.getByLabel('Premium unlocked on this device').isChecked(), 'not checked');
  await p.goto(`${ORIGIN}/#/rewards`);
  await p.getByRole('heading', { name: 'Space Wing' }).waitFor();
  assert((await p.locator('.wing.locked-wing').count()) === 0, 'wings still locked');
  await p.getByRole('button', { name: /^Iron Meteorite, \d+ coins$/ }).click();
  await p.getByRole('button', { name: /^Buy for/ }).click();
  await p.getByRole('button', { name: /^Spend/ }).click();
  await p.getByText('Iron Meteorite joined your museum').waitFor();
});

await step('premium: weekly report, premium buildings and +50% XP', async () => {
  await p.goto(`${ORIGIN}/#/progress`);
  await p.getByRole('heading', { name: 'Last week’s report' }).waitFor();
  await p.goto(`${ORIGIN}/#/city`);
  assert((await p.getByRole('button', { name: /^Build Bathhouse for/ }).count()) === 1, 'bathhouse not buildable with premium');
  await p.goto(`${ORIGIN}/#/quests`);
  await p.getByRole('button', { name: 'New quest' }).click();
  await p.getByPlaceholder('What needs doing?').fill('Boosted quest');
  await p.getByPlaceholder('What needs doing?').press('Enter');
  await p.getByRole('button', { name: 'Complete: Boosted quest' }).click();
  await p.getByText(/^\+15 XP/).first().waitFor(); // 10 XP quest +50%
});

await step('time travel moves the app’s date and pays town income', async () => {
  await p.goto(`${ORIGIN}/#/city`);
  await p.getByRole('button', { name: /^Build Bakery for/ }).click();
  await p.getByRole('button', { name: 'Empty tile, row 1 column 1' }).click();
  await p.getByText('Built Bakery').waitFor();
  const before = (await balances()).gems;
  await p.goto(`${ORIGIN}/#/settings`);
  await p.getByRole('button', { name: '+1 day' }).click();
  await p.waitForLoadState('load');
  await p.getByText(/Time travel: \+1 day/).waitFor();
  await p.waitForTimeout(800);
  const after = (await balances()).gems;
  assert(after > before, `no income after time travel (${before} → ${after})`);
  await p.getByRole('button', { name: 'Back to today' }).click();
  await p.waitForLoadState('load');
  await p.getByText(/Time travel: real date/).waitFor();
});

await step('reset and seed fills sample data', async () => {
  await p.getByRole('button', { name: 'Reset and seed sample data' }).click();
  await p.getByRole('button', { name: 'Reset and seed' }).last().click();
  await p.waitForTimeout(1000);
  const b = await balances();
  assert(b.coins >= 1000 && b.gems >= 1000, JSON.stringify(b));
});

await step('no console errors', async () => assert(errors.length === 0, errors.slice(0, 3).join(' | ')));

await browser.close();
proc.kill();
console.log(failed ? `\n${failed} failed` : '\nAll personal-build checks passed.');
process.exit(failed ? 1 : 0);
