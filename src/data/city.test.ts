import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS, LAND_COSTS } from '../domain/city';
import { gemBalance, totals } from '../domain/stats';
import type { Recurrence } from '../domain/types';
import { AppError, Repo } from './repo';
import { MemoryStorage } from './storage';
import { makeExport, parseImport } from './transfer';

function setup(start = '2026-10-05T09:00:00') {
  let now = new Date(start);
  const storage = new MemoryStorage();
  const repo = new Repo(storage, () => new Date(now));
  return { repo, storage, setNow: (iso: string) => void (now = new Date(iso)) };
}
const daily: Recurrence = { kind: 'daily', interval: 1, weekdays: [], dayOfMonth: 1 };
const code = (c: string) => (e: unknown) => e instanceof AppError && e.code === c;
const gems = async (repo: Repo) => gemBalance((await repo.snapshot()).events);

/** Earns roughly `n` gems by completing quests worth `xp` each (gems = xp/2 with no bonus). */
async function earn(repo: Repo, gemsWanted: number) {
  let have = await gems(repo);
  let i = 0;
  while (have < gemsWanted) {
    const t = await repo.addTask({ title: `Earn ${i++}`, xp: 50 });
    await repo.completeTask(t.id);
    have = await gems(repo);
  }
}

test('completions earn gems alongside XP and coins, at half an XP', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Quest', xp: 20 });
  const ev = await repo.completeTask(t.id);
  assert.equal(ev?.gems, 10);
  assert.equal(ev?.coins, 20);
  assert.equal(await gems(repo), 10);
  const c = await repo.addChore({ title: 'Dishes', recurrence: daily, xp: 15 });
  const ce = await repo.completeChore(c.id, c.nextDue);
  assert.equal(ce?.gems, 8);
});

test('reopening a quest withdraws its gems; spent gems cannot be withdrawn', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Quest', xp: 100 });
  await repo.completeTask(t.id);
  assert.equal(await gems(repo), 50);
  await repo.reopenTask(t.id);
  assert.equal(await gems(repo), 0);
  await repo.completeTask(t.id);
  await repo.build('cottage', 0, 0); // spends 40 of 50
  await assert.rejects(repo.reopenTask(t.id), code('spent'));
  assert.equal((await repo.snapshot()).tasks[0]!.completedAt !== null, true);
  assert.equal(await gems(repo), 10);
});

test('build: spends gems, places the building, and refuses overspending', async () => {
  const { repo } = setup();
  await assert.rejects(repo.build('cottage', 0, 0), code('insufficient'));
  await earn(repo, 40);
  const before = await gems(repo);
  const result = await repo.build('cottage', 1, 2);
  assert.equal(await gems(repo), before - BUILDINGS.cottage.cost);
  const snap = await repo.snapshot();
  assert.deepEqual(snap.city.buildings.map((b) => [b.type, b.x, b.y]), [['cottage', 1, 2]]);
  assert.equal(result.event.gems, -40);
  assert.equal(totals(snap.events).xp, totals(snap.events).xp); // XP is untouched by spending (checked below)
});

test('build: spending gems never lowers XP, level or coins', async () => {
  const { repo } = setup();
  await earn(repo, 100);
  const before = totals((await repo.snapshot()).events);
  await repo.build('cottage', 0, 0);
  await repo.build('park', 1, 0);
  const after = totals((await repo.snapshot()).events);
  assert.equal(after.xp, before.xp);
  assert.equal(after.balance, before.balance);
});

test('build: rejects bad tiles, taken tiles, unknown types, locked and out-of-season items', async () => {
  const { repo } = setup(); // 5 Oct = autumn
  await earn(repo, 300);
  await assert.rejects(repo.build('cottage', 4, 0), code('invalid')); // outside the 4×4 start
  await assert.rejects(repo.build('cottage', -1, 0), code('invalid'));
  await assert.rejects(repo.build('cottage', 1.5, 0), code('invalid'));
  await assert.rejects(repo.build('cottage', Number.NaN, 0), code('invalid'));
  await assert.rejects(repo.build('ferris', 0, 0), code('invalid')); // needs level 6
  await assert.rejects(repo.build('snowman', 0, 0), code('invalid')); // winter only
  await assert.rejects(repo.build('__proto__' as never, 0, 0), code('invalid'));
  await assert.rejects(repo.build('constructor' as never, 0, 0), code('invalid'));
  await repo.build('pumpkin', 0, 0); // autumn decoration is fine
  await assert.rejects(repo.build('cottage', 0, 0), code('invalid')); // tile taken
  assert.equal((await repo.snapshot()).city.buildings.length, 1);
});

test('build: simultaneous taps place and charge exactly once', async () => {
  const { repo } = setup();
  await earn(repo, 45);
  const results = await Promise.allSettled([repo.build('park', 0, 0), repo.build('park', 0, 0), repo.build('park', 0, 0)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await repo.snapshot()).city.buildings.length, 1);
});

test('build: a seasonal decoration is allowed in season and stays after the season ends', async () => {
  const { repo, setNow } = setup('2026-12-10T09:00:00'); // winter
  await earn(repo, 30);
  await repo.build('snowman', 0, 0);
  setNow('2027-04-10T09:00:00');
  assert.equal((await repo.snapshot()).city.buildings.length, 1);
  await assert.rejects(repo.build('snowman', 1, 0), code('invalid'));
});

test('residents: move in when a home exists and the town is content', async () => {
  const { repo } = setup();
  await earn(repo, 300);
  assert.equal((await repo.build('cottage', 0, 0)).arrived, null); // nothing to eat, nothing to do, nowhere to relax yet
  assert.equal((await repo.build('park', 1, 0)).arrived, null); // calm only: one third of the needs
  assert.equal((await repo.build('bakery', 2, 0)).arrived?.id, 'pip'); // food + calm: two thirds, enough
  assert.equal((await repo.build('carousel', 3, 0)).arrived?.id, 'mabel');
  assert.deepEqual((await repo.snapshot()).city.residents.map((r) => r.id), ['pip', 'mabel']);
  await repo.collectCity(); // the cottage has one room left and the town is happy
  assert.deepEqual((await repo.snapshot()).city.residents.map((r) => r.id), ['pip', 'mabel', 'otto']);
  const rest = await repo.collectCity(); // already collected today
  assert.equal(rest.arrived, null);
});

test('harmony bonus raises gems from completions; it never reduces them', async () => {
  const { repo } = setup();
  const plain = await repo.addTask({ title: 'Before', xp: 100 });
  assert.equal((await repo.completeTask(plain.id))?.gems, 50);
  await earn(repo, 300);
  for (const [type, x] of [['cottage', 0], ['park', 1], ['bakery', 2], ['carousel', 3]] as const) await repo.build(type, x, 0);
  assert.equal((await repo.snapshot()).city.residents.length, 2);
  const bonus = await repo.addTask({ title: 'After', xp: 100 });
  assert.equal((await repo.completeTask(bonus.id))?.gems, 75); // ×1.5 at full harmony
});

test('sell: refunds half; a home that residents live in cannot be sold', async () => {
  const { repo } = setup();
  await earn(repo, 300);
  const park = await repo.build('park', 3, 3);
  const before = await gems(repo);
  const sold = await repo.sellBuilding(park.building.id);
  assert.equal(sold.gems, 22);
  assert.equal(await gems(repo), before + 22);
  assert.equal((await repo.snapshot()).city.buildings.length, 0);
  await assert.rejects(repo.sellBuilding(park.building.id), code('not-found'));

  const home = await repo.build('cottage', 0, 0);
  for (const [type, x] of [['park', 1], ['bakery', 2], ['carousel', 3]] as const) await repo.build(type, x, 0);
  assert.equal((await repo.snapshot()).city.residents.length, 2);
  await assert.rejects(repo.sellBuilding(home.building.id), code('invalid'));
  assert.equal((await repo.snapshot()).city.buildings.length, 4);
  await repo.build('cottage', 0, 1);
  await repo.sellBuilding(home.building.id); // a second home exists now
});

test('undo: taking back a purchase refunds it in full, once, and only while it stands', async () => {
  const { repo } = setup();
  await earn(repo, 100);
  const start = await gems(repo);
  const park = await repo.build('park', 0, 0);
  await repo.undoEvent(park.event.id);
  assert.equal(await gems(repo), start);
  assert.equal((await repo.snapshot()).city.buildings.length, 0);
  await repo.undoEvent(park.event.id); // harmless second time

  const again = await repo.build('park', 0, 0);
  await repo.sellBuilding(again.building.id);
  const afterSale = await gems(repo);
  await assert.rejects(repo.undoEvent(again.event.id), code('invalid')); // would refund twice
  assert.equal(await gems(repo), afterSale);
});

test('undo: sales, land, income and event rewards cannot be undone', async () => {
  const { repo } = setup();
  await earn(repo, 200);
  const park = await repo.build('park', 0, 0);
  const sale = await repo.sellBuilding(park.building.id);
  await assert.rejects(repo.undoEvent(sale.id), code('invalid'));
  const land = await repo.expandLand();
  await assert.rejects(repo.undoEvent(land.id), code('invalid'));
});

test('premium: triples daily town income', async () => {
  const { repo, setNow } = setup();
  await earn(repo, 200);
  await repo.build('bakery', 0, 0);
  await repo.collectCity();
  setNow('2026-10-06T09:00:00');
  const free = (await repo.collectCity()).gems;
  await repo.setPremium(true, 'admin');
  setNow('2026-10-07T09:00:00');
  assert.equal((await repo.collectCity()).gems, free * 3);
});

test('premium: +50% XP per completion, coins and gems unchanged; premium buildings and residents', async () => {
  const { repo } = setup();
  const t1 = await repo.addTask({ title: 'Free', xp: 20 });
  const free = (await repo.completeTask(t1.id))!;
  assert.equal(free.xp, 20);
  await repo.setPremium(true, 'admin');
  const t2 = await repo.addTask({ title: 'Premium', xp: 20 });
  const boosted = (await repo.completeTask(t2.id))!;
  assert.equal(boosted.xp, 30);
  assert.equal(boosted.coins, free.coins);
  // Premium-only building
  await repo.setPremium(false, 'admin');
  await earn(repo, 400);
  await assert.rejects(repo.build('bathhouse', 0, 0), code('premium'));
  await repo.setPremium(true, 'admin');
  await repo.build('bathhouse', 0, 0);
  // A backup with boosted XP still imports.
  assert.equal(parseImport(JSON.stringify(makeExport(await repo.snapshot(), new Date()))).ok, true);
});

test('land: expansion costs rise, unlock new tiles, and stop at the maximum', async () => {
  const { repo } = setup();
  await earn(repo, 60);
  await assert.rejects(repo.build('park', 4, 0), code('invalid'));
  const first = await repo.expandLand();
  assert.equal(first.gems, -LAND_COSTS[0]!);
  await earn(repo, 400);
  await repo.build('fountain', 4, 4); // now inside the 5×5 plot
  await assert.rejects(repo.build('fountain', 5, 0), code('invalid'));
  const second = await repo.expandLand();
  assert.equal(second.gems, -LAND_COSTS[1]!);
  await earn(repo, 1500);
  await assert.rejects(repo.expandLand(), code('premium')); // free towns stop at 6×6
  await repo.setPremium(true, 'admin');
  for (let i = 2; i < LAND_COSTS.length; i++) await repo.expandLand();
  await assert.rejects(repo.expandLand(), code('invalid'));
  assert.equal((await repo.snapshot()).city.meta.landLevel, 5);
});

test('land: cannot be bought without enough gems', async () => {
  const { repo } = setup();
  await assert.rejects(repo.expandLand(), code('insufficient'));
  assert.equal((await repo.snapshot()).city.meta.landLevel, 0);
});

test('income: paid once a day, up to three days while away, nothing owed beyond that', async () => {
  const { repo, setNow } = setup();
  await earn(repo, 200);
  await repo.build('boutique', 0, 0); // 4 gems/day
  await repo.build('market', 1, 0); // 3 gems/day
  const first = await repo.collectCity();
  assert.equal(first.gems, 0); // first visit just sets the clock; no back-pay
  assert.equal((await repo.collectCity()).gems, 0); // same day: nothing
  setNow('2026-10-06T09:00:00');
  const b0 = await gems(repo);
  assert.equal((await repo.collectCity()).gems, 7);
  assert.equal(await gems(repo), b0 + 7);
  assert.equal((await repo.collectCity()).gems, 0); // once per day
  setNow('2026-10-20T09:00:00'); // away for two weeks
  assert.equal((await repo.collectCity()).gems, 21); // three days' worth, no more
  const snap = await repo.snapshot();
  assert.equal(snap.events.filter((e) => e.kind === 'income').length, 2);
});

test('income: missing days never costs anything or removes anything', async () => {
  const { repo, setNow } = setup();
  await earn(repo, 100);
  await repo.build('boutique', 0, 0);
  await repo.collectCity();
  const before = await repo.snapshot();
  setNow('2027-03-01T09:00:00');
  await repo.collectCity();
  const after = await repo.snapshot();
  assert.equal(after.city.buildings.length, before.city.buildings.length);
  assert.ok(gemBalance(after.events) >= gemBalance(before.events));
  assert.equal(totals(after.events).xp, totals(before.events).xp);
});

test('weekly event: needs the goal, pays once, and the claim cannot be repeated', async () => {
  const { repo, setNow } = setup('2026-10-05T09:00:00');
  await assert.rejects(repo.claimWeeklyEvent(), code('invalid'));
  // Four active days with four quests each satisfies whichever event is running (count, XP or distinct days).
  for (const day of ['05', '06', '07', '08']) {
    setNow(`2026-10-${day}T09:00:00`);
    for (let i = 0; i < 4; i++) {
      const t = await repo.addTask({ title: `Q${day}-${i}`, xp: 10 });
      await repo.completeTask(t.id);
    }
    const c = await repo.addChore({ title: `Chore ${day}`, recurrence: daily });
    await repo.completeChore(c.id, c.nextDue);
  }
  const before = await gems(repo);
  const claim = await repo.claimWeeklyEvent();
  assert.ok(claim && claim.gems > 0);
  assert.equal(await gems(repo), before + claim.gems);
  assert.equal(await repo.claimWeeklyEvent(), null);
  const both = await Promise.allSettled([repo.claimWeeklyEvent(), repo.claimWeeklyEvent()]);
  assert.ok(both.every((r) => r.status === 'fulfilled' && r.value === null));
  await assert.rejects(repo.undoEvent(claim.id), code('invalid'));
  setNow('2026-10-13T09:00:00'); // next week: a new event, not yet complete
  await assert.rejects(repo.claimWeeklyEvent(), code('invalid'));
});

test('legacy ledger rows without gems are credited the gems they would have earned', async () => {
  const { repo, storage } = setup();
  await storage.tx('rw', (tx) => tx.put('events', { id: 'task:old:1', kind: 'task', refId: 'old', title: 'Old', taskType: 'task', xp: 40, coins: 40, at: '2026-09-01T09:00:00.000Z', day: '2026-09-01', prevDue: null, voidedAt: null }));
  assert.equal(await gems(repo), 20);
  await repo.build('park', 0, 0).then(
    () => assert.fail('45 gems is more than the 20 available'),
    (e) => assert.ok(e instanceof AppError),
  );
});

test('corrupted city rows are ignored', async () => {
  const { repo, storage } = setup();
  await earn(repo, 50);
  const ok = await repo.build('park', 0, 0);
  await storage.tx('rw', async (tx) => {
    await tx.put('city', { id: 'junk1', type: 'castle', x: 0, y: 0, placedAt: 'x' });
    await tx.put('city', { id: 'junk2', type: 'park', x: 99, y: -1, placedAt: '2026-10-05T10:00:00.000Z' });
    await tx.put('residents', { id: 'dragon', movedIn: '2026-10-05' });
    await tx.put('meta', { id: 'city', value: { landLevel: 1e9, lastCollect: 'tomorrow' } });
    await tx.put('events', { id: 'build:fake', kind: 'build', refId: 'x', title: 'Free', taskType: null, xp: 0, coins: 0, gems: 5_000_000, at: '2026-10-05T09:00:00.000Z', day: '2026-10-05', prevDue: null, voidedAt: null });
    await tx.put('events', { id: 'income:fake', kind: 'income', refId: 'city', title: 'Free', taskType: null, xp: 0, coins: 0, gems: 999_999, at: '2026-10-05T09:00:00.000Z', day: '2026-10-05', prevDue: null, voidedAt: null });
    await tx.put('events', { id: 'event:fake', kind: 'event', refId: 'weekly', title: 'Free', taskType: null, xp: 7, coins: 0, gems: 10, at: '2026-10-05T09:00:00.000Z', day: '2026-10-05', prevDue: null, voidedAt: null });
  });
  const snap = await repo.snapshot();
  assert.deepEqual(snap.city.buildings.map((b) => b.id), [ok.building.id]);
  assert.equal(snap.city.residents.length, 0);
  assert.equal(snap.city.meta.landLevel, 0);
  assert.equal(snap.events.some((e) => e.id.endsWith('fake')), false);
  assert.ok((await gems(repo)) < 100);
});

// -------------------------------------------------------------- backups

async function playedCity() {
  const { repo } = setup();
  await earn(repo, 400);
  for (const [type, x] of [['cottage', 0], ['park', 1], ['bakery', 2], ['carousel', 3]] as const) await repo.build(type, x, 0);
  await repo.expandLand();
  await repo.collectCity();
  return repo;
}
const exported = async (repo: Repo) => JSON.parse(JSON.stringify(makeExport(await repo.snapshot(), new Date('2026-10-05T09:00:00'))));
const rejected = (f: unknown) => assert.equal(parseImport(JSON.stringify(f)).ok, false);

test('backup: the city survives export → import (replace)', async () => {
  const source = await playedCity();
  const parsed = parseImport(JSON.stringify(await exported(source)));
  assert.ok(parsed.ok);
  const target = setup().repo;
  await target.importData(parsed.data, 'replace');
  assert.deepEqual(await target.snapshot(), await source.snapshot());
  const snap = await target.snapshot();
  assert.equal(snap.city.buildings.length, 4);
  assert.equal(snap.city.residents.length, 3); // two on arrival, a third at the first daily visit
  assert.equal(snap.city.meta.landLevel, 1);
});

test('backup: files from before the city existed still import', async () => {
  const source = setup().repo;
  const t = await source.addTask({ title: 'Old backup', xp: 30 });
  await source.completeTask(t.id);
  const file = await exported(source);
  delete file.data.city;
  for (const e of file.data.events) delete e.gems;
  const parsed = parseImport(JSON.stringify(file));
  assert.ok(parsed.ok);
  assert.equal(parsed.data.events[0]!.gems, 15);
  const target = setup().repo;
  await target.importData(parsed.data, 'replace');
  assert.equal(await gems(target), 15);
});

test('backup: merging twice does not duplicate buildings, residents or gems', async () => {
  const source = await playedCity();
  const parsed = parseImport(JSON.stringify(await exported(source)));
  assert.ok(parsed.ok);
  const target = setup().repo;
  await target.importData(parsed.data, 'merge');
  await target.importData(parsed.data, 'merge');
  const snap = await target.snapshot();
  assert.equal(snap.city.buildings.length, 4);
  assert.equal(snap.city.residents.length, 3);
  assert.equal(gemBalance(snap.events), gemBalance((await source.snapshot()).events));
});

test('backup: merge moves a building whose tile is taken instead of losing it', async () => {
  const source = await playedCity();
  const parsed = parseImport(JSON.stringify(await exported(source)));
  assert.ok(parsed.ok);
  const target = setup().repo;
  await earn(target, 50);
  await target.build('fountain', 0, 0);
  await target.importData(parsed.data, 'merge');
  const snap = await target.snapshot();
  const cells = snap.city.buildings.map((b) => `${b.x},${b.y}`);
  assert.equal(new Set(cells).size, cells.length);
  assert.equal(snap.city.buildings.length, 5);
});

test('backup: hostile city data is rejected', async () => {
  const base = async () => exported(await playedCity());
  let f = await base(); f.data.city.buildings.push({ id: 'free-castle', type: 'ferris', x: 3, y: 3, placedAt: '2026-10-05T09:00:00.000Z' }); rejected(f); // never paid for
  f = await base(); f.data.city.buildings.push({ ...f.data.city.buildings[0] }); rejected(f); // duplicate id
  f = await base(); f.data.city.buildings[1].x = f.data.city.buildings[0].x; f.data.city.buildings[1].y = f.data.city.buildings[0].y; rejected(f); // same tile
  f = await base(); f.data.city.buildings[0].x = 8; rejected(f); // outside unlocked land
  f = await base(); f.data.city.buildings[0].type = 'castle'; rejected(f);
  f = await base(); f.data.city.meta.landLevel = 5; rejected(f); // land never bought
  f = await base(); f.data.city.meta.landLevel = 9; rejected(f);
  f = await base(); f.data.city.residents.push({ id: 'dragon', movedIn: '2026-10-05' }); rejected(f);
  f = await base(); f.data.city.residents.push({ ...f.data.city.residents[0] }); rejected(f);
  f = await base(); f.data.city.extra = 1; rejected(f);
  f = await base(); f.data.city.meta.lastCollect = 'someday'; rejected(f);
  f = await base(); f.data.events.push({ id: 'income:cheat', kind: 'income', refId: 'city', title: 'x', taskType: null, xp: 0, coins: 0, gems: 50_000, at: '2026-10-05T09:00:00.000Z', day: '2026-10-05', prevDue: null, voidedAt: null }); rejected(f); // above any payout
  f = await base(); f.data.events.push({ id: 'income:cheat', kind: 'income', refId: 'city', title: 'x', taskType: null, xp: 9, coins: 0, gems: 5, at: '2026-10-05T09:00:00.000Z', day: '2026-10-05', prevDue: null, voidedAt: null }); rejected(f); // income that also pays XP
  f = await base(); f.data.events.push({ id: 'build:cheat', kind: 'build', refId: 'x', title: 'x', taskType: null, xp: 0, coins: 0, gems: 0, at: '2026-10-05T09:00:00.000Z', day: '2026-10-05', prevDue: null, voidedAt: null }); rejected(f);
  f = await base(); f.data.events[0].gems = 99_999; rejected(f); // a completion cannot pay more gems than XP
  f = await base(); f.data.events.find((e: any) => e.kind === 'redeem' || e.gems < 0).gems = -99_999; rejected(f); // overspent
  f = await base(); f.data.events.push({ id: 'event:cheat', kind: 'event', refId: 'weekly', title: 'x', taskType: null, xp: 0, coins: 0, gems: 100, at: '2026-10-05T09:00:00.000Z', day: '2026-10-05', prevDue: null, voidedAt: null, bonus: 1 }); rejected(f); // unknown key
  f = await base(); assert.ok(f.data.city.residents.length > 0); f.data.city.buildings = f.data.city.buildings.filter((b: any) => b.type !== 'cottage'); rejected(f); // residents with no homes
  assert.equal(parseImport(JSON.stringify(await base())).ok, true, 'the untouched file is valid');
});

test('backup: merging never houses more residents than there are homes', async () => {
  const source = await playedCity();
  const file = parseImport(JSON.stringify(makeExport(await source.snapshot(), new Date())));
  assert.ok(file.ok);
  // Drop the incoming homes (as if no tile was free for them); the residents must not arrive homeless.
  const data = { ...file.data, city: { ...file.data.city, buildings: file.data.city.buildings.filter((b) => b.type !== 'cottage') } };
  const { repo } = setup();
  await repo.importData(data, 'merge');
  const after = await repo.snapshot();
  assert.equal(after.city.residents.length, 0);
});
