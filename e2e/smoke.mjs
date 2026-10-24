// End-to-end smoke test in a real Chromium, against the production build.
//
//   npm run build && npm run e2e
//
// Needs a Chromium for playwright-core: either `npx playwright-core install chromium`
// or point CHROMIUM_PATH at an installed Chromium/Chrome binary.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = join(here, 'shots');
const PORT = 4391;
const ORIGIN = `http://localhost:${PORT}`;
await mkdir(shots, { recursive: true });

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  FAIL  ${name}\n        ${String(e.message ?? e).split("\n").slice(0, 6).join(" | ")}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

function startServer() {
  const proc = spawn(process.execPath, [join(root, 'scripts/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => String(d).includes('Serving') && resolve(proc));
    proc.on('exit', () => reject(new Error('server exited')));
  });
}

const stopServer = (proc) => new Promise((resolve) => (proc.exitCode !== null || proc.signalCode !== null ? resolve() : (proc.once('exit', resolve), proc.kill())));
let server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true });
const page = await context.newPage();
/** The opening scene plays once per visit; tests other than the opening test start past it. */
const skipOpening = (ctx) => ctx.addInitScript(() => {
  try {
    sessionStorage.setItem('qa-opened', '1');
  } catch {}
});
await skipOpening(context);

const requests = [];
const problems = [];
context.on('request', (r) => requests.push(r.url()));
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('dialog', (d) => {
  problems.push(`unexpected dialog: ${d.message()}`);
  void d.dismiss();
});

/** Reads the app's IndexedDB directly, independent of the UI. */
const db = () =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('questday');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const d = open.result;
          const out = {};
          const names = ['tasks', 'chores', 'events', 'rewards', 'achievements', 'city', 'residents'];
          const tx = d.transaction(names, 'readonly');
          for (const n of names) tx.objectStore(n).getAll().onsuccess = (e) => (out[n] = e.target.result);
          tx.oncomplete = () => {
            d.close();
            resolve(out);
          };
        };
      }),
  );
const live = (events) => events.filter((e) => !e.voidedAt);
const xpOf = (events) => live(events).reduce((n, e) => n + e.xp, 0);
const coinsOf = (events) => live(events).reduce((n, e) => n + e.coins, 0);
const noOverflow = async (label) => {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert(sw <= iw, `${label}: horizontal overflow (${sw} > ${iw})`);
};
const addQuest = async (title, { xp } = {}) => {
  await page.getByRole('button', { name: 'New quest' }).click();
  await page.getByPlaceholder('What needs doing?').fill(title);
  if (xp) {
    await page.getByText('More options').click();
    await page.getByLabel('Custom XP').fill(String(xp));
  }
  await page.getByPlaceholder('What needs doing?').press('Enter');
  await page.locator('dialog[open]').waitFor({ state: 'detached' }).catch(() => page.locator('dialog.sheet[open]').waitFor({ state: 'hidden' }));
};
const XSS = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';

console.log('\nMobile (390×844)');

await check('opening scene: a book cover that opens onto Chapter I', async () => {
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const o = await fresh.newPage();
  await o.goto(ORIGIN);
  await o.getByRole('button', { name: 'Open the book' }).waitFor();
  await o.waitForTimeout(600);
  await o.screenshot({ path: join(shots, 'mobile-0-opening.png') });
  await o.getByRole('button', { name: 'Open the book' }).click();
  await o.locator('.opening').waitFor({ state: 'detached' });
  assert((await o.evaluate(() => location.hash)) === '#/quests', 'did not open on quests');
  await o.locator('h1', { hasText: 'Quests' }).waitFor();
  await o.reload();
  await o.locator('h1', { hasText: 'Quests' }).waitFor();
  assert((await o.locator('.opening').count()) === 0, 'opening replayed within the same visit');
  await fresh.close();
});

await page.goto(ORIGIN);

await check('first run shows an inviting empty state', async () => {
  await page.getByText('Your story starts with a first quest').waitFor();
  await page.locator('.main').getByText('Level 1').first().waitFor();
  await page.screenshot({ path: join(shots, 'mobile-1-empty.png') });
});

await check('quick add: only a title is needed, Enter submits', async () => {
  await addQuest('Water the plants');
  await page.getByRole('button', { name: 'Complete: Water the plants' }).waitFor();
  assert((await db()).tasks.length === 1, 'task not stored');
});

await check('XSS payload in a title is rendered as inert text', async () => {
  await addQuest(XSS);
  await page.getByText(XSS, { exact: true }).first().waitFor();
  assert((await page.evaluate(() => window.__xss)) === undefined, 'script executed');
  assert((await page.locator('img[src="x"]').count()) === 0, 'markup was parsed into the DOM');
});

await check('completing a quest gives immediate XP feedback', async () => {
  await page.getByRole('button', { name: 'Complete: Water the plants' }).click();
  await page.getByText('+10 XP · +10 coins').waitFor();
  await page.getByText('+10 XP today').waitFor();
  await page.getByText('Achievement unlocked: First Steps').waitFor();
  const d = await db();
  assert(xpOf(d.events) === 10, 'xp');
});

await check('hammering the complete button awards XP once', async () => {
  await addQuest('Tap me many times', { xp: 15 });
  const button = page.getByRole('button', { name: /^(Complete|Reopen): Tap me many times$/ });
  // Fire five clicks synchronously, before the UI can re-render.
  await button.evaluate((el) => {
    for (let i = 0; i < 5; i++) el.click();
  });
  await page.waitForTimeout(600);
  const d = await db();
  const mine = d.events.filter((e) => e.title === 'Tap me many times');
  assert(live(mine).length <= 1, `live awards: ${live(mine).length}`);
  assert(xpOf(d.events) <= 25, `xp ${xpOf(d.events)}`);
  const task = d.tasks.find((t) => t.title === 'Tap me many times');
  assert(Boolean(task.completedAt) === (live(mine).length === 1), 'task state and ledger disagree');
  if (!task.completedAt) await page.getByRole('button', { name: 'Complete: Tap me many times' }).click();
  await page.waitForTimeout(300);
  assert(xpOf((await db()).events) === 25, 'xp after settle');
});

await check('data survives a reload and is not re-awarded', async () => {
  await page.reload();
  await page.getByText('+25 XP today').waitFor();
  await page.getByRole('button', { name: 'Reopen: Water the plants' }).waitFor();
  assert(xpOf((await db()).events) === 25, 'xp changed on reload');
});

await check('reopening withdraws XP; completing again restores it once', async () => {
  await page.getByRole('button', { name: 'Reopen: Water the plants' }).click();
  await page.getByText('+15 XP today').waitFor();
  await page.getByRole('button', { name: 'Complete: Water the plants' }).click();
  await page.getByText('+25 XP today').waitFor();
  const d = await db();
  assert(d.events.filter((e) => e.title === 'Water the plants').length === 2, 'ledger should keep the voided event');
});

await check('undo on the XP toast reverses the completion', async () => {
  await addQuest('Undo me');
  await page.getByRole('button', { name: 'Complete: Undo me' }).click();
  await page.locator('.toast', { hasText: 'Undo me' }).getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Complete: Undo me' }).waitFor();
  assert(xpOf((await db()).events) === 25, 'xp after undo');
});

await check('edit and delete a quest (with confirmation)', async () => {
  await page.getByRole('button', { name: 'Edit: Undo me' }).click();
  await page.getByPlaceholder('What needs doing?').fill('Renamed quest');
  await page.getByRole('button', { name: 'High' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Edit: Renamed quest' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByText('Delete this quest?').waitFor();
  await page.screenshot({ path: join(shots, 'mobile-2-confirm.png') });
  await page.getByRole('button', { name: 'Delete' }).last().click();
  await page.getByRole('button', { name: 'Edit: Renamed quest' }).waitFor({ state: 'detached' });
  assert(!(await db()).tasks.some((t) => t.title === 'Renamed quest'), 'still stored');
});

await check('level up: animation appears and the level increases', async () => {
  await addQuest('Finish the big thing', { xp: 100 });
  await page.getByRole('button', { name: 'Complete: Finish the big thing' }).click();
  await page.getByText('Level up!').waitFor();
  await page.screenshot({ path: join(shots, 'mobile-3-levelup.png') });
  await page.keyboard.press('Escape');
  await page.getByText('Level up!').waitFor({ state: 'detached' });
  await page.locator('.main').getByText('Level 2').first().waitFor();
});

await check('chores: create, complete, next occurrence scheduled, history kept', async () => {
  await page.getByRole('link', { name: 'Chores', exact: true }).click();
  await page.getByRole('button', { name: 'New chore' }).click();
  await page.getByPlaceholder('e.g. Water the plants').fill('Wash the dishes');
  await page.screenshot({ path: join(shots, 'mobile-4-chore-editor.png') });
  await page.getByRole('button', { name: 'Add chore' }).click();
  await page.getByRole('button', { name: 'Complete: Wash the dishes' }).click();
  await page.getByText('+15 XP · +15 coins').waitFor();
  await page.getByText('Tomorrow').waitFor();
  const d = await db();
  assert(d.chores.length === 1 && d.events.filter((e) => e.kind === 'chore').length === 1, 'chore ledger');
  assert(xpOf(d.events) === 140, `xp ${xpOf(d.events)}`);
  await page.getByRole('button', { name: 'Edit: Wash the dishes' }).click();
  await page.getByText('History · 1 completion').waitFor();
  await page.keyboard.press('Escape');
});

await check('treats: redeem spends coins, never XP; cannot overspend', async () => {
  await page.getByRole('link', { name: 'Rewards', exact: true }).click();
  await page.getByRole('button', { name: 'Real-life treats' }).click();
  await page.getByRole('button', { name: 'Add treat' }).click();
  await page.getByPlaceholder('Something you’ll look forward to').fill('Sauna evening');
  await page.getByLabel('Cost (coins)').fill('100');
  await page.getByRole('button', { name: 'Add reward' }).click();
  await page.getByRole('button', { name: 'Redeem Sauna evening' }).click();
  await page.getByRole('button', { name: 'Spend 100 coins' }).click();
  await page.getByText('Reward redeemed').waitFor();
  await page.getByRole('button', { name: 'Sauna evening: 60 more coins needed' }).waitFor();
  assert(await page.getByRole('button', { name: 'Sauna evening: 60 more coins needed' }).isDisabled(), 'redeem should be disabled');
  const d = await db();
  assert(xpOf(d.events) === 140 && coinsOf(d.events) === 40, `xp ${xpOf(d.events)} coins ${coinsOf(d.events)}`);
  await page.screenshot({ path: join(shots, 'mobile-5-rewards.png') });
});

await check('free version: Premium features open the paywall; nothing can be bought or unlocked on the web', async () => {
  await page.getByRole('button', { name: 'Museum', exact: true }).click();
  await page.getByRole('heading', { name: 'Fossil Gallery' }).scrollIntoViewIfNeeded();
  const before = JSON.stringify((await db()).events);
  // Museum: every wing is Premium; tapping an exhibit opens the paywall, never a purchase.
  assert((await page.locator('.wing.locked-wing').count()) === 5, 'museum wings not locked');
  await page.getByRole('button', { name: 'Ammonite: part of Premium' }).click();
  const wall = page.locator('dialog[open]');
  await wall.getByRole('heading', { name: 'The museum is part of Premium' }).waitFor();
  await wall.getByText('This web version can’t take payments').waitFor();
  assert((await wall.getByRole('button', { name: /^Unlock Premium/ }).count()) === 0, 'web build offered a purchase button');
  await page.screenshot({ path: join(shots, 'mobile-paywall.png') });
  await wall.getByRole('button', { name: 'Not now' }).click();
  await wall.waitFor({ state: 'detached' }).catch(() => undefined);
  await noOverflow('museum');
  await page.screenshot({ path: join(shots, 'mobile-museum.png'), fullPage: true });
  // Town: Premium buildings and unique residents lead to the paywall too.
  await page.getByRole('link', { name: 'Town', exact: true }).click();
  await page.getByRole('button', { name: 'Observatory: part of Premium' }).click();
  await page.locator('dialog[open]').getByRole('heading', { name: 'This building is part of Premium' }).waitFor();
  await page.keyboard.press('Escape');
  // Journal: weekly reports are Premium.
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await page.getByText('Weekly progress reports').waitFor();
  // Settings: the card opens the same paywall; there are no admin tools in the public build.
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Unlock Premium' }).click();
  await page.locator('dialog[open]').getByRole('heading', { name: 'QuestAday Premium' }).waitFor();
  await page.keyboard.press('Escape');
  assert((await page.getByText('Admin tools').count()) === 0, 'admin tools present in the store build');
  assert(JSON.stringify((await db()).events) === before, 'paywall interactions changed data');
  await page.getByRole('link', { name: 'Rewards', exact: true }).click();
});

await check('quests can be dated on any calendar day; chores every 1–4 days', async () => {
  const future = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 12);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.getByRole('link', { name: 'Quests', exact: true }).click();
  await page.getByRole('button', { name: 'New quest' }).click();
  await page.getByPlaceholder('What needs doing?').fill('Renew passport');
  await page.getByLabel('Due date').fill(future);
  await page.getByPlaceholder('What needs doing?').press('Enter');
  await page.locator('dialog.sheet[open]').waitFor({ state: 'hidden' });
  let d = await db();
  assert(d.tasks.find((t) => t.title === 'Renew passport')?.dueDate === future, 'future date not stored');
  await page.getByRole('link', { name: 'Chores', exact: true }).click();
  await page.getByRole('button', { name: 'New chore' }).click();
  await page.getByPlaceholder('e.g. Water the plants').fill('Water the garden');
  await page.getByRole('button', { name: '3 days', exact: true }).click();
  await page.screenshot({ path: join(shots, 'mobile-4b-chore-days.png') });
  await page.getByRole('button', { name: 'Add chore' }).click();
  await page.locator('dialog.sheet[open]').waitFor({ state: 'hidden' });
  d = await db();
  const c = d.chores.find((x) => x.title === 'Water the garden');
  assert(c && c.recurrence.kind === 'daily' && c.recurrence.interval === 3, `recurrence ${JSON.stringify(c?.recurrence)}`);
  await page.getByRole('button', { name: 'Edit: Water the garden' }).click();
  assert(await page.getByRole('button', { name: '3 days', exact: true }).getAttribute('aria-pressed') === 'true', '3 days not selected on edit');
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete' }).last().click();
  await page.waitForTimeout(300);
  await page.getByRole('link', { name: 'Quests', exact: true }).click();
});

await check('quests: search and filters', async () => {
  await page.getByRole('link', { name: 'Quests', exact: true }).click();
  await page.getByRole('button', { name: /^Completed/ }).click();
  await page.getByText('Finish the big thing').waitFor();
  await page.getByLabel('Search quests').fill('zzz-no-match');
  await page.getByText('No matches').waitFor();
  await page.getByLabel('Search quests').fill('');
  await page.getByRole('button', { name: /^All/ }).click();
  await page.screenshot({ path: join(shots, 'mobile-6-quests.png') });
});

await check('progress: totals and achievements are derived from the ledger', async () => {
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await page.getByText('140 XP earned in total').waitFor();
  await page.getByText('Hearth Keeper').first().waitFor();
  assert((await db()).achievements.length >= 2, 'achievements not stored');
  await page.screenshot({ path: join(shots, 'mobile-7-progress.png'), fullPage: true });
});

let backup = '';
await check('export downloads a valid JSON backup', async () => {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click()]);
  assert(/^questaday-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), 'file name');
  backup = await readFile(await download.path(), 'utf8');
  const file = JSON.parse(backup);
  assert(file.format === 'questday-export' && file.data.tasks.length === 5, 'backup contents');
});

await check('import rejects a hostile file and changes nothing', async () => {
  const before = JSON.stringify(await db());
  const evil = JSON.parse(backup);
  evil.data.events[0].xp = 999999;
  evil.data.tasks[0].__proto__ = { polluted: true };
  const path = join(shots, 'evil.json');
  await writeFile(path, JSON.stringify(evil).replace('"settings":{', '"settings":{"__proto__":{"polluted":true},'));
  await page.getByLabel('Backup file to import').setInputFiles(path);
  await page.getByText('That file can’t be imported.').waitFor();
  assert(JSON.stringify(await db()) === before, 'data changed');
  assert((await page.evaluate(() => ({}).polluted)) === undefined, 'prototype polluted');
  // A backup from the personal (admin) build cannot carry admin-granted XP or coins into the store build.
  const adminFile = JSON.parse(backup);
  adminFile.data.events.push({ id: 'admin:x1', kind: 'admin', refId: 'admin', title: 'Admin adjustment', taskType: null, xp: 5000, coins: 5000, gems: 5000, at: '2026-10-05T09:00:00.000Z', day: '2026-10-05', prevDue: null, voidedAt: null });
  await writeFile(path, JSON.stringify(adminFile));
  await page.getByLabel('Backup file to import').setInputFiles(path);
  await page.getByText('That file can’t be imported.').waitFor();
  assert(JSON.stringify(await db()) === before, 'admin backup changed data');
  await writeFile(path, 'x'.repeat(11_000_000));
  await page.getByLabel('Backup file to import').setInputFiles(path);
  await page.getByText('too large').waitFor();
});

await check('import (replace) restores a backup exactly', async () => {
  const restored = JSON.parse(backup);
  restored.data.tasks[0].title = XSS; // imported markup must stay inert too
  const path = join(shots, 'restore.json');
  await writeFile(path, JSON.stringify(restored));
  await page.getByLabel('Backup file to import').setInputFiles(path);
  await page.getByText('Import this backup?').waitFor();
  await page.getByRole('button', { name: 'Replace everything on this device' }).click();
  await page.getByText('Backup restored.').waitFor();
  const d = await db();
  assert(d.tasks.length === 5 && xpOf(d.events) === 140 && coinsOf(d.events) === coinsOf(JSON.parse(backup).data.events), 'restored state');
  assert((await page.evaluate(() => window.__xss)) === undefined, 'script executed from import');
});

await check('light theme applies and persists', async () => {
  await page.getByRole('button', { name: /^Paper/ }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.screenshot({ path: join(shots, 'mobile-8-settings-light.png'), fullPage: true });
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.getByRole('link', { name: 'Quests', exact: true }).click();
  await page.screenshot({ path: join(shots, 'mobile-9-home-light.png') });
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  for (const [name, id] of [['Nightfall', 'nightfall'], ['Hearth', 'hearth'], ['Grove', 'grove'], ['Parchment', 'parchment']]) {
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.waitForFunction((t) => document.documentElement.dataset.theme === t, id);
  }
});

await check('no horizontal overflow on any page (mobile)', async () => {
  for (const p of ['quests', 'chores', 'city', 'rewards', 'progress', 'settings']) {
    await page.goto(`${ORIGIN}/#/${p}`);
    await page.waitForTimeout(150);
    await noOverflow(p);
  }
});

await check('city: earn gems, build, sell and undo', async () => {
  await page.goto(`${ORIGIN}/#/city`);
  await page.getByRole('heading', { name: 'Your town', exact: true }).waitFor();
  // Give the test town some gems through the ledger (a stand-in for a few weeks of quests).
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('questday');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const d = open.result;
          const tx = d.transaction('events', 'readwrite');
          tx.objectStore('events').add({ id: 'event:e2e', kind: 'event', refId: 'weekly', title: 'Test grant', taskType: null, xp: 0, coins: 0, gems: 200, at: new Date().toISOString(), day: '2026-01-01', prevDue: null, voidedAt: null });
          tx.oncomplete = () => (d.close(), resolve());
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await page.getByRole('heading', { name: 'Your town', exact: true }).waitFor();
  const gemsBefore = (await db()).events.filter((e) => !e.voidedAt).reduce((n, e) => n + (e.gems ?? 0), 0);
  assert(gemsBefore >= 200, `gems ${gemsBefore}`);
  // Shop -> placing mode -> tap a tile.
  await page.getByRole('button', { name: 'Build Park for 45 gems' }).click();
  await page.getByText('Tap an empty tile').waitFor();
  await page.waitForTimeout(700);
  const inView = await page.getByRole('button', { name: 'Empty tile, row 1 column 1' }).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  });
  assert(inView, 'map not scrolled into view after choosing a building');
  await page.getByRole('button', { name: 'Empty tile, row 1 column 1' }).click();
  await page.getByText('Built Park').waitFor();
  let d = await db();
  assert(d.city.length === 1 && d.city[0].type === 'park', 'park not stored');
  const afterBuild = d.events.filter((e) => !e.voidedAt).reduce((n, e) => n + e.gems, 0);
  assert(afterBuild === gemsBefore - 45, `gems after build ${afterBuild}`);
  await noOverflow('city');
  await page.screenshot({ path: join(shots, 'mobile-city.png'), fullPage: true });
  // Undo restores the gems and removes the building.
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.waitForFunction(async () => true);
  await page.waitForTimeout(400);
  d = await db();
  assert(d.city.length === 0, 'building remained after undo');
  assert(d.events.filter((e) => !e.voidedAt).reduce((n, e) => n + e.gems, 0) === gemsBefore, 'gems not restored');
  // Build again via the tile picker, then sell for half.
  await page.getByRole('button', { name: 'Empty tile, row 2 column 2' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: /^Park/ }).click();
  await page.getByText('Built Park').first().waitFor();
  await page.getByRole('button', { name: /^Park, row 2 column 2/ }).click();
  await page.getByRole('button', { name: 'Sell for 22 gems' }).click();
  await page.getByRole('button', { name: 'Sell for 22 gems' }).last().click();
  await page.waitForTimeout(400);
  d = await db();
  assert(d.city.length === 0, 'building remained after sell');
  assert(d.events.filter((e) => !e.voidedAt).reduce((n, e) => n + e.gems, 0) === gemsBefore - 23, 'sell refund wrong');
});

await check('touch targets are at least 44px', async () => {
  await page.goto(`${ORIGIN}/#/home`);
  await page.locator('h1', { hasText: 'Quests' }).waitFor();
  await page.waitForTimeout(700); // let the page-turn animation finish before measuring
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, a.btn, .tabs a, .icon-btn')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ r: el.getBoundingClientRect(), label: el.getAttribute('aria-label') ?? el.textContent }))
      .filter(({ r }) => r.height < 44 || r.width < 44)
      .map(({ r, label }) => `${label} (${Math.round(r.width)}×${Math.round(r.height)})`),
  );
  assert(small.length === 0, `too small: ${small.join('; ')}`);
  await page.screenshot({ path: join(shots, 'mobile-10-home.png'), fullPage: true });
});

console.log('\nPWA, offline and network');

await check('manifest and service worker are valid', async () => {
  const m = JSON.parse(await (await page.request.get(`${ORIGIN}/manifest.webmanifest`)).text());
  assert(m.display === 'standalone' && m.icons.some((i) => i.sizes === '512x512') && m.icons.some((i) => i.purpose === 'maskable'), 'manifest fields');
  for (const icon of m.icons) assert((await page.request.get(`${ORIGIN}/${icon.src}`)).ok(), `missing ${icon.src}`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
});

await check('security headers and CSP are served', async () => {
  const res = await page.request.get(ORIGIN);
  const h = res.headers();
  assert(h['content-security-policy'].includes("default-src 'none'") && h['content-security-policy'].includes("frame-ancestors 'none'"), 'CSP header');
  assert(h['x-content-type-options'] === 'nosniff' && h['referrer-policy'] === 'no-referrer' && h['x-frame-options'] === 'DENY', 'headers');
  assert((await res.text()).includes('http-equiv="Content-Security-Policy"'), 'CSP meta missing from index.html');
  assert((await page.request.get(`${ORIGIN}/../package.json`)).status() !== 200, 'path traversal');
  assert((await page.request.get(`${ORIGIN}/%2e%2e/%2e%2e/etc/passwd`)).status() !== 200, 'encoded traversal');
  assert((await page.request.post(ORIGIN, { data: 'x' })).status() === 405, 'POST should be refused');
});

await check('CSP blocks injected inline script and third-party requests', async () => {
  const result = await page.evaluate(async () => {
    const s = document.createElement('script');
    s.textContent = 'window.__inline = 1';
    document.head.append(s);
    let fetched = 'blocked';
    try {
      await fetch('https://example.com/collect?x=1', { mode: 'no-cors' });
      fetched = 'allowed';
    } catch {
      /* expected */
    }
    // Run from a timer: code evaluated directly by the test driver is exempt from the eval check.
    const evaled = await new Promise((resolve) =>
      setTimeout(() => {
        try {
          resolve(String(new Function('return "allowed"')()));
        } catch {
          resolve('blocked');
        }
      }, 0),
    );
    return { inline: window.__inline, fetched, evaled };
  });
  assert(result.inline === undefined, 'inline script ran');
  assert(result.fetched === 'blocked', 'cross-origin fetch was allowed');
  assert(result.evaled === 'blocked', 'eval was allowed');
});

// Everything above this line must have produced zero console errors (the CSP probe below is deliberate).
const cleanConsole = problems.filter((p) => !/Content Security Policy|example\.com/.test(p));

await check('works offline: reload with the network cut', async () => {
  await context.setOffline(true);
  await page.reload();
  await page.locator('h1', { hasText: 'Quests' }).waitFor();
  await page.locator('.main').getByText('Level 2').first().waitFor();
  await addQuest('Added while offline');
  assert((await db()).tasks.some((t) => t.title === 'Added while offline'), 'offline write failed');
  await context.setOffline(false);
});

await check('works with the server stopped entirely', async () => {
  await stopServer(server);
  await page.reload();
  await page.getByText('Added while offline').first().waitFor();
  for (const p of ['quests', 'chores', 'city', 'rewards', 'progress', 'settings']) {
    await page.goto(`${ORIGIN}/#/${p}`);
    await page.locator('h1').waitFor();
  }
  await page.getByText('ready, opens without a connection').waitFor();
});
await stopServer(server);
server = await startServer();

await check('the app made no request to any other origin', async () => {
  const foreign = [...new Set(requests.filter((u) => !u.startsWith(`${ORIGIN}/`) && !u.startsWith('blob:') && !u.startsWith('data:')))];
  const deliberate = foreign.filter((u) => !u.startsWith('https://example.com/collect'));
  assert(deliberate.length === 0, `foreign requests: ${deliberate.join(', ')}`);
  const paths = new Set(requests.filter((u) => u.startsWith(ORIGIN)).map((u) => new URL(u).pathname));
  console.log(`        (${requests.length} requests, all to ${ORIGIN}; ${paths.size} distinct static files)`);
});

await check('no personal data in localStorage, cookies or the service worker cache', async () => {
  const found = await page.evaluate(async () => {
    const needle = ['Tap me many times', 'Finish the big thing', 'Sauna evening', 'Added while offline'];
    const hits = [];
    const scan = (where, text) => needle.forEach((n) => text.includes(n) && hits.push(`${where}: ${n}`));
    scan('localStorage', JSON.stringify({ ...localStorage }));
    scan('sessionStorage', JSON.stringify({ ...sessionStorage }));
    scan('cookie', document.cookie);
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) scan(`cache ${req.url}`, await (await cache.match(req)).text());
    }
    return { hits, keys: Object.keys(localStorage) };
  });
  assert(found.hits.length === 0, found.hits.join('; '));
  assert(found.keys.join() === 'theme', `localStorage keys: ${found.keys}`);
});

await check('no console errors or warnings during normal use', async () => {
  assert(cleanConsole.length === 0, cleanConsole.slice(0, 5).join(' | '));
});

console.log('\nDesktop (1280×800)');
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const d = await desk.newPage();
await skipOpening(desk);
const deskProblems = [];
d.on('console', (m) => ['error', 'warning'].includes(m.type()) && deskProblems.push(m.text()));
d.on('pageerror', (e) => deskProblems.push(e.message));

await check('separate browser profiles have separate data (no sync is implied)', async () => {
  await d.goto(ORIGIN);
  await d.getByText('Your story starts with a first quest').waitFor();
});

await check('sidebar layout, example data, keyboard: N opens, Enter submits, Escape closes', async () => {
  assert(await d.locator('aside.side').isVisible(), 'sidebar hidden');
  assert(!(await d.locator('nav.tabs').isVisible()), 'bottom tabs should be hidden on desktop');
  await d.getByRole('button', { name: 'Try example data' }).click();
  await d.getByRole('button', { name: 'Complete: Reply to the landlord' }).waitFor();
  await d.keyboard.press('n');
  await d.getByPlaceholder('What needs doing?').waitFor();
  assert(await d.getByPlaceholder('What needs doing?').evaluate((el) => el === document.activeElement), 'title not focused');
  await d.keyboard.press('Escape');
  await d.locator('dialog[open]').waitFor({ state: 'detached' });
  await d.waitForTimeout(100); // let the dialog's close event land, as it would for a person
  await d.keyboard.press('n');
  await d.waitForFunction(() => document.activeElement?.getAttribute('placeholder') === 'What needs doing?');
  await d.keyboard.type('Typed from the keyboard');
  await d.keyboard.press('Enter');
  await d.getByRole('button', { name: 'Complete: Typed from the keyboard' }).waitFor();
  await d.screenshot({ path: join(shots, 'desktop-1-home.png') });
});

await check('keyboard-only completion with visible focus', async () => {
  const button = d.getByRole('button', { name: 'Complete: Typed from the keyboard' });
  await button.focus();
  await d.keyboard.press('Enter');
  await d.getByRole('button', { name: 'Reopen: Typed from the keyboard' }).waitFor();
  await d.keyboard.press('Tab');
  const outline = await d.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert(outline !== 'none', 'no visible focus outline');
});

await check('desktop pages render without overflow; example data can be removed', async () => {
  for (const p of ['quests', 'chores', 'city', 'rewards', 'progress', 'settings']) {
    await d.goto(`${ORIGIN}/#/${p}`);
    await d.locator('h1').waitFor();
    await d.waitForTimeout(150);
    const [sw, iw] = await d.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    assert(sw <= iw, `${p}: overflow`);
    await d.screenshot({ path: join(shots, `desktop-2-${p}.png`) });
  }
  await d.getByRole('button', { name: 'Remove example data' }).click();
  await d.getByRole('button', { name: 'Load example data' }).waitFor();
  await d.goto(`${ORIGIN}/#/quests`);
  await d.getByRole('button', { name: /^All/ }).click();
  await d.getByRole('button', { name: /: Typed from the keyboard$/ }).first().waitFor();
  assert((await d.getByText('Reply to the landlord').count()) === 0, 'demo task remained');
});

await check('reduced motion is honoured', async () => {
  const rm = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await skipOpening(rm);
  const p = await rm.newPage();
  await p.goto(ORIGIN);
  await p.getByRole('button', { name: 'Add your first quest' }).click();
  const duration = await p.locator('dialog.sheet[open]').evaluate((el) => getComputedStyle(el).animationDuration);
  assert(parseFloat(duration) < 0.01, `animation still runs (${duration})`);
  await rm.close();
});

await check('no console errors on desktop', async () => {
  assert(deskProblems.length === 0, deskProblems.slice(0, 5).join(' | '));
});

console.log('\nBasic host with no security headers, in a sub-folder (like GitHub Pages)');
const SUB = 'http://localhost:4393/dist/';
const plainHost = spawn('python3', ['-m', 'http.server', '4393', '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const plain = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await skipOpening(plain);
const g = await plain.newPage();
const plainProblems = [];
const plainRequests = [];
plain.on('request', (r) => plainRequests.push(r.url()));
g.on('console', (m) => ['error', 'warning'].includes(m.type()) && plainProblems.push(m.text()));
g.on('pageerror', (e) => plainProblems.push(e.message));

await check('installs, saves and works offline from a sub-folder with no headers', async () => {
  await g.goto(SUB);
  await g.getByText('Your story starts with a first quest').waitFor();
  await g.getByRole('button', { name: 'Add your first quest' }).click();
  await g.getByPlaceholder('What needs doing?').fill('Hosted in a sub-folder');
  await g.getByPlaceholder('What needs doing?').press('Enter');
  await g.getByRole('button', { name: 'Complete: Hosted in a sub-folder' }).waitFor();
  await g.evaluate(() => navigator.serviceWorker.ready);
  await g.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await plain.setOffline(true);
  await g.reload();
  await g.getByRole('button', { name: 'Complete: Hosted in a sub-folder' }).waitFor();
  await plain.setOffline(false);
  assert(plainRequests.every((u) => u.startsWith(SUB)), `request outside the app folder: ${plainRequests.find((u) => !u.startsWith(SUB))}`);
  assert(plainProblems.length === 0, plainProblems.slice(0, 3).join(' | '));
});

await check('the built-in policy still blocks inline script, eval and third-party requests there', async () => {
  const result = await g.evaluate(async () => {
    const s = document.createElement('script');
    s.textContent = 'window.__inline = 1';
    document.head.append(s);
    let fetched = 'blocked';
    try {
      await fetch('https://example.com/collect', { mode: 'no-cors' });
      fetched = 'allowed';
    } catch {
      /* expected */
    }
    const evaled = await new Promise((resolve) =>
      setTimeout(() => {
        try {
          resolve(String(new Function('return "allowed"')()));
        } catch {
          resolve('blocked');
        }
      }, 0),
    );
    return { inline: window.__inline, fetched, evaled };
  });
  assert(result.inline === undefined && result.fetched === 'blocked' && result.evaled === 'blocked', JSON.stringify(result));
});

await check('refuses to run when another page embeds it in a frame', async () => {
  const outer = await plain.newPage();
  await outer.setContent(`<h1>hostile page</h1><iframe src="${SUB}" style="width:390px;height:700px"></iframe>`);
  const frame = outer.frames().find((f) => f.url().startsWith(SUB)) ?? (await outer.waitForEvent('framenavigated'));
  await frame.getByText('does not run inside another page').waitFor();
  assert((await frame.locator('.app, button, input').count()) === 0, 'app UI rendered inside a frame');
  await outer.close();
});

await check('the bundled server refuses requests addressed to another host name', async () => {
  const http = await import('node:http');
  const status = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/', headers: { Host: 'attacker.example' } }, (res) => resolve(res.statusCode));
    req.on('error', reject);
    req.end();
  });
  assert(status === 403, `status ${status}`);
});
plainHost.kill();

await browser.close();
await stopServer(server);
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
