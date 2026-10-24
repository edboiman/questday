import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIMITS } from '../domain/limits';
import { totals } from '../domain/stats';
import { loadDemo } from './demo';
import { AppError, Repo } from './repo';
import { MemoryStorage } from './storage';
import { makeExport, parseImport } from './transfer';

const NOW = new Date('2026-10-05T09:00:00');
async function seeded() {
  const repo = new Repo(new MemoryStorage(), () => new Date(NOW));
  await loadDemo(repo, '2026-10-05');
  await repo.completeTask('demo-t4'); // 50 XP
  await repo.completeChore('demo-c2', '2026-10-05'); // 15 XP
  await repo.redeem('demo-r1'); // −30 coins
  await repo.syncAchievements();
  return repo;
}
const exportText = async (repo: Repo) => JSON.stringify(makeExport(await repo.snapshot(), NOW));
/** Returns a deep-mutable copy of a valid export for tampering. */
async function tamper(edit: (file: any) => void): Promise<string> {
  const file = JSON.parse(await exportText(await seeded()));
  edit(file);
  return JSON.stringify(file);
}
const rejected = (text: string) => assert.equal(parseImport(text).ok, false);

test('export → import round-trips exactly (replace)', async () => {
  const source = await seeded();
  const text = await exportText(source);
  const parsed = parseImport(text);
  assert.ok(parsed.ok);
  const target = new Repo(new MemoryStorage(), () => new Date(NOW));
  await target.addTask({ title: 'Will be replaced' });
  await target.importData(parsed.data, 'replace');
  assert.deepEqual(await target.snapshot(), await source.snapshot());
  assert.deepEqual(totals((await target.snapshot()).events), { xp: 65, balance: 35, quests: 1, chores: 1, redemptions: 1 });
});

test('import (merge) adds new records, keeps existing ones, and is idempotent', async () => {
  const source = await seeded();
  const parsed = parseImport(await exportText(source));
  assert.ok(parsed.ok);
  const target = new Repo(new MemoryStorage(), () => new Date(NOW));
  const mine = await target.addTask({ title: 'Mine', xp: 20 });
  await target.completeTask(mine.id);
  await target.addTask({ title: 'Local version wins' }, 'demo-t1');
  await target.saveSettings({ playerName: 'Local' });
  await target.importData(parsed.data, 'merge');
  await target.importData(parsed.data, 'merge'); // importing twice must not double XP
  const snap = await target.snapshot();
  assert.equal(snap.tasks.length, 7);
  assert.equal(snap.tasks.find((t) => t.id === 'demo-t1')!.title, 'Local version wins');
  assert.equal(snap.settings.playerName, 'Local');
  assert.equal(totals(snap.events).xp, 85);
  assert.equal(totals(snap.events).balance, 55);
});

test('import rejects junk, wrong formats and oversized files', () => {
  rejected('');
  rejected('not json at all');
  rejected('[]');
  rejected('null');
  rejected('{"format":"something-else","version":1}');
  rejected('{"format":"questday-export","version":2,"exportedAt":"2026-10-05T09:00:00.000Z","data":{}}');
  rejected(' '.repeat(LIMITS.importChars + 1));
  rejected(JSON.stringify({ a: 'x'.repeat(LIMITS.importChars) }));
  const deep = '['.repeat(50_000) + ']'.repeat(50_000);
  rejected(deep); // deeply nested input must fail cleanly, not crash
});

test('import rejects XP and balance manipulation', async () => {
  rejected(await tamper((f) => (f.data.events[0].xp = 1_000_000)));
  rejected(await tamper((f) => (f.data.events[0].xp = -50)));
  rejected(await tamper((f) => (f.data.events[0].xp = 12.5)));
  rejected(await tamper((f) => (f.data.events[0].xp = '50')));
  rejected(await tamper((f) => (f.data.events[0].coins = 5_000))); // coins beyond any allowed rate
  rejected(await tamper((f) => { const r = f.data.events.find((e: any) => e.kind === 'redeem'); r.coins = 500; })); // "redemption" that pays out
  rejected(await tamper((f) => { const r = f.data.events.find((e: any) => e.kind === 'redeem'); r.xp = 400; }));
  rejected(await tamper((f) => { const r = f.data.events.find((e: any) => e.kind === 'redeem'); r.coins = -90_000; })); // negative balance
  rejected(await tamper((f) => f.data.events.push({ ...f.data.events[0] }))); // duplicated award
  rejected(await tamper((f) => (f.data.tasks[0].xp = 99_999)));
  rejected(await tamper((f) => (f.data.rewards[0].cost = 0)));
  rejected(await tamper((f) => (f.data.rewards[0].cost = -100)));
  rejected(await tamper((f) => (f.data.settings.coinRate = 1e6)));
  rejected(await tamper((f) => f.data.achievements.push({ id: 'made-up-trophy', unlockedAt: '2026-10-05T09:00:00.000Z' })));
});

test('import rejects malformed structure, dates, ids and recurrence rules', async () => {
  rejected(await tamper((f) => delete f.data.tasks));
  rejected(await tamper((f) => (f.data.tasks = { length: 1 })));
  rejected(await tamper((f) => delete f.data.tasks[0].title));
  rejected(await tamper((f) => (f.data.tasks[0].title = '')));
  rejected(await tamper((f) => (f.data.tasks[0].title = 'x'.repeat(LIMITS.title + 1))));
  rejected(await tamper((f) => (f.data.tasks[0].description = 'x'.repeat(LIMITS.description + 1))));
  rejected(await tamper((f) => (f.data.tasks[0].dueDate = '2026-02-31')));
  rejected(await tamper((f) => (f.data.tasks[0].dueDate = 'tomorrow')));
  rejected(await tamper((f) => (f.data.tasks[0].createdAt = 'yesterday')));
  rejected(await tamper((f) => (f.data.tasks[0].id = '../../etc/passwd')));
  rejected(await tamper((f) => (f.data.tasks[0].id = '<img src=x>')));
  rejected(await tamper((f) => (f.data.tasks[0].id = 'x'.repeat(200))));
  rejected(await tamper((f) => (f.data.tasks[0].type = 'admin')));
  rejected(await tamper((f) => (f.data.tasks[0].subtasks = Array.from({ length: 31 }, (_, i) => ({ id: `s${i}`, title: 'x', done: false })))));
  rejected(await tamper((f) => (f.data.tasks[1].id = f.data.tasks[0].id)));
  rejected(await tamper((f) => (f.data.chores[0].recurrence.interval = 0)));
  rejected(await tamper((f) => (f.data.chores[0].recurrence.interval = 1e12)));
  rejected(await tamper((f) => (f.data.chores[0].recurrence.kind = 'every-millisecond')));
  rejected(await tamper((f) => { f.data.chores[0].recurrence.kind = 'weekly'; f.data.chores[0].recurrence.weekdays = []; }));
  rejected(await tamper((f) => (f.data.chores[0].recurrence.weekdays = [1, 1, 1])));
  rejected(await tamper((f) => (f.data.chores[0].nextDue = null)));
  rejected(await tamper((f) => (f.data.rewards[0].icon = 'javascript:alert(1)')));
  rejected(await tamper((f) => (f.data.settings.theme = 'neon')));
});

test('import rejects unknown keys, config overrides and prototype pollution', async () => {
  rejected(await tamper((f) => (f.data.tasks[0].isAdmin = true)));
  rejected(await tamper((f) => (f.data.settings.debug = true)));
  rejected(await tamper((f) => (f.data.config = { csp: 'off' })));
  rejected(await tamper((f) => (f.serviceWorker = 'https://evil.example/sw.js')));
  const base = await tamper(() => undefined);
  rejected(base.replace('"data":{', '"data":{"__proto__":{"polluted":true},'));
  rejected(base.replace('"settings":{', '"settings":{"__proto__":{"polluted":true},'));
  rejected(base.replace('"settings":{', '"settings":{"constructor":{"prototype":{"polluted":true}},'));
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal((Object.prototype as Record<string, unknown>).polluted, undefined);
});

test('import treats markup as inert text (no HTML, no code execution)', async () => {
  const payloads = ['<script>globalThis.__xss=1</script>', '<img src=x onerror="globalThis.__xss=1">', '"><svg onload=alert(1)>', 'javascript:alert(1)', '{{constructor.constructor("return 1")()}}'];
  const text = await tamper((f) => {
    f.data.tasks[0].title = payloads[0];
    f.data.tasks[0].description = payloads[1];
    f.data.tasks[0].tag = payloads[2].slice(0, 30);
    f.data.rewards[0].name = payloads[3];
    f.data.rewards[0].description = payloads[4];
  });
  const parsed = parseImport(text);
  assert.ok(parsed.ok, 'markup is valid *text* and is stored verbatim');
  assert.equal(parsed.data.tasks[0]!.title, payloads[0]);
  assert.equal((globalThis as Record<string, unknown>).__xss, undefined);
});

test('import error messages do not echo file contents', async () => {
  const secret = 'PRIVATE-NOTE-do-not-leak';
  const result = parseImport(await tamper((f) => { f.data.tasks[0].type = secret; f.data.tasks[1][secret] = 1; f.format = secret; }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(!result.errors.join(' ').includes(secret));
});

test('importData re-validates and refuses data that would overdraw the balance', async () => {
  const source = await seeded();
  const snap = await source.snapshot();
  const target = new Repo(new MemoryStorage(), () => new Date(NOW));
  const mine = await target.addTask({ title: 'Mine' });
  // Bypass parseImport on purpose: the repo must still defend itself.
  const overdrawn = { ...snap, events: snap.events.filter((e) => e.kind === 'redeem') };
  await assert.rejects(target.importData(overdrawn, 'merge'), (e) => e instanceof AppError);
  const bad = { ...snap, tasks: [{ ...snap.tasks[0]!, xp: 1e9 }] };
  await assert.rejects(target.importData(bad, 'replace'), (e) => e instanceof AppError);
  const after = await target.snapshot();
  assert.deepEqual(after.tasks.map((t) => t.id), [mine.id]); // nothing was changed
  assert.equal(after.events.length, 0);
});
