import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailySpecial, EXHIBITS, exhibitLock, owned, priceOf, WING_BONUS, type Exhibit } from '../domain/museum';
import { balanceOf, gemBalance, totals } from '../domain/stats';
import { AppError, Repo } from './repo';
import { MemoryStorage } from './storage';
import { makeExport, parseImport } from './transfer';

async function setup({ premium = true } = {}) {
  const now = new Date('2026-10-05T09:00:00');
  const repo = new Repo(new MemoryStorage(), () => new Date(now));
  if (premium) await repo.setPremium(true, 'admin');
  return { repo, today: '2026-10-05' };
}
const code = (c: string) => (e: unknown) => e instanceof AppError && e.code === c;
const coins = async (repo: Repo) => balanceOf((await repo.snapshot()).events);

async function earnCoins(repo: Repo, wanted: number) {
  let i = 0;
  while ((await coins(repo)) < wanted) {
    const t = await repo.addTask({ title: `Earn ${i++}`, xp: 100 });
    await repo.completeTask(t.id);
  }
}
const wing = (id: Exhibit['wing']) => EXHIBITS.filter((x) => x.wing === id);

test('museum: buying an exhibit spends coins, never XP, and keeps it', async () => {
  const { repo, today } = await setup();
  await earnCoins(repo, 100);
  const before = await repo.snapshot();
  const x = wing('fossils')[0]!;
  const price = priceOf(x, today, owned(before.events), true);
  const { event, bonus } = await repo.collect(x.id);
  assert.equal(event.coins, -price);
  assert.equal(bonus, null);
  const after = await repo.snapshot();
  assert.equal(balanceOf(after.events), balanceOf(before.events) - price);
  assert.equal(totals(after.events).xp, totals(before.events).xp);
  assert.ok(owned(after.events).has(x.id));
});

test('museum: an exhibit can only be bought once, even with simultaneous taps', async () => {
  const { repo } = await setup();
  await earnCoins(repo, 500);
  const x = wing('minerals')[0]!;
  const results = await Promise.allSettled([repo.collect(x.id), repo.collect(x.id), repo.collect(x.id)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  await assert.rejects(repo.collect(x.id), code('invalid'));
});

test('museum: rarer exhibits stay locked until you own enough of the wing; no overspending', async () => {
  const { repo } = await setup();
  const rare = wing('space').find((x) => x.rarity === 'rare')!;
  assert.ok(exhibitLock(rare, new Map(), true));
  await earnCoins(repo, 1000);
  await assert.rejects(repo.collect(rare.id), code('invalid'));
  await assert.rejects(repo.collect('unicorn'), code('invalid'));
  for (const x of wing('space').filter((y) => y.rarity === 'common')) await repo.collect(x.id);
  await repo.collect(rare.id);
  const fresh = (await setup()).repo;
  await assert.rejects(fresh.collect(wing('space')[0]!.id), code('insufficient'));
});

test('museum: completing a wing pays its gem bonus to the town exactly once', async () => {
  const { repo } = await setup();
  await earnCoins(repo, 1500);
  const gemsBefore = gemBalance((await repo.snapshot()).events);
  const items = wing('curios');
  let last = null;
  for (const x of items) last = await repo.collect(x.id);
  assert.ok(last?.bonus);
  assert.equal(last.bonus.gems, WING_BONUS);
  assert.equal(gemBalance((await repo.snapshot()).events), gemsBefore + WING_BONUS);
  await assert.rejects(repo.undoEvent(last.event.id), code('invalid'));
  await assert.rejects(repo.undoEvent(last.bonus.id), code('invalid'));
});

test('museum: the daily special is a quarter off and never something you own', async () => {
  const { repo, today } = await setup();
  const s = dailySpecial(today, new Map(), true)!;
  assert.ok(s);
  assert.equal(priceOf(s, today, new Map(), true), Math.round(s.price * 0.75));
  await earnCoins(repo, 200);
  const { event } = await repo.collect(s.id);
  assert.equal(event.coins, -Math.round(s.price * 0.75));
  assert.notEqual(dailySpecial(today, owned((await repo.snapshot()).events), true)?.id, s.id);
});

test('museum: backups round-trip; forged exhibits, prices and bonuses are rejected', async () => {
  const { repo } = await setup();
  await earnCoins(repo, 300);
  await repo.collect(wing('antiquities')[0]!.id);
  const text = JSON.stringify(makeExport(await repo.snapshot(), new Date()));
  assert.equal(parseImport(text).ok, true);
  const base = () => JSON.parse(text);
  const ev = (f: any) => f.data.events.find((e: any) => e.kind === 'collect');
  let f = base(); ev(f).coins = -1; assert.equal(parseImport(JSON.stringify(f)).ok, false, 'cheap price');
  f = base(); ev(f).refId = 'unicorn'; ev(f).id = 'collect:unicorn'; assert.equal(parseImport(JSON.stringify(f)).ok, false, 'unknown exhibit');
  f = base(); ev(f).id = 'collect:other'; assert.equal(parseImport(JSON.stringify(f)).ok, false, 'id mismatch');
  f = base(); ev(f).coins = 10; assert.equal(parseImport(JSON.stringify(f)).ok, false, 'purchase that pays');
  f = base(); f.data.events.push({ id: 'museum:fossils', kind: 'event', refId: 'museum', title: 'x', taskType: null, xp: 0, coins: 0, gems: 60, at: '2026-10-05T09:00:00.000Z', day: '2026-10-05', prevDue: null, voidedAt: null });
  assert.equal(parseImport(JSON.stringify(f)).ok, false, 'bonus for unfinished wing');
});

test('premium: the museum is a Premium feature; exhibits already owned stay owned', async () => {
  const { repo } = await setup({ premium: false });
  assert.equal(await repo.isPremium(), false);
  await earnCoins(repo, 400);
  await assert.rejects(repo.collect(wing('space')[0]!.id), code('invalid'));
  await assert.rejects(repo.collect(wing('minerals')[0]!.id), code('invalid'));
  assert.equal(exhibitLock(wing('curios')[0]!, new Map(), false), 'Part of Premium');
  assert.equal(dailySpecial('2026-10-05', new Map(), false), null);
  await repo.setPremium(true, 'admin');
  await repo.collect(wing('minerals')[0]!.id);
  await repo.setPremium(false, 'admin');
  assert.ok(owned((await repo.snapshot()).events).has(wing('minerals')[0]!.id), 'owned exhibit kept after Premium ends');
  await repo.setPremium(true, 'admin');
  assert.equal(await repo.isPremium(), true);
  await repo.collect(wing('space')[0]!.id);
});

test('premium: a restore keeps the purchase; a wipe keeps a Play purchase but not an admin toggle', async () => {
  const { repo } = await setup();
  const file = parseImport(JSON.stringify(makeExport(await repo.snapshot(), new Date())));
  assert.ok(file.ok);
  await repo.importData(file.data, 'replace');
  assert.equal(await repo.isPremium(), true);
  await repo.wipe();
  assert.equal(await repo.isPremium(), false);
  await repo.setPremium(true, 'play');
  await repo.wipe();
  assert.equal(await repo.isPremium(), true);
});

test('admin: adjustments are ledger entries, cannot go negative, cannot be undone', async () => {
  const { repo } = await setup();
  const e = await repo.adminAdjust({ xp: 300, coins: 50, gems: 20 });
  let snap = await repo.snapshot();
  assert.equal(totals(snap.events).xp, 300);
  assert.equal(balanceOf(snap.events), 50);
  assert.equal(gemBalance(snap.events), 20);
  await assert.rejects(repo.adminAdjust({ xp: 0, coins: -51, gems: 0 }), code('invalid'));
  await assert.rejects(repo.adminAdjust({ xp: 0, coins: 0, gems: 0 }), code('invalid'));
  await assert.rejects(repo.undoEvent(e.id), code('invalid'));
  await repo.adminAdjust({ xp: -300, coins: -50, gems: -20 });
  snap = await repo.snapshot();
  assert.equal(totals(snap.events).xp, 0);
  // Admin entries survive a backup round-trip in the personal build.
  assert.equal(parseImport(JSON.stringify(makeExport(snap, new Date()))).ok, true);
});
