import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS, cityStats, eventProgress, gemsFor, landSize, lineFor, lines, lockReason, nextResident, canWelcome, ROSTER, seasonOf, sellValue, weeklyEvent, WEEKLY_EVENTS, LAND_COSTS, LAND_MAX_LEVEL } from './city';
import { BUILDING_IDS, ROSTER_IDS, type Building, type LedgerEvent } from './types';

const bd = (type: Building['type'], i = 0): Building => ({ id: `b${i}`, type, x: i % 9, y: Math.floor(i / 9), placedAt: '2026-10-05T10:00:00.000Z' });
const ev = (e: Partial<LedgerEvent>): LedgerEvent => ({ id: Math.random().toString(36).slice(2), kind: 'task', refId: 'x', title: 't', taskType: 'task', xp: 10, coins: 10, gems: 5, at: '2026-10-07T10:00:00.000Z', day: '2026-10-07', prevDue: null, voidedAt: null, ...e });

test('catalog: every building id has a definition and the roster matches its ids', () => {
  for (const id of BUILDING_IDS) {
    const def = BUILDINGS[id];
    assert.equal(def.id, id);
    assert.ok(def.cost > 0 && def.level >= 1);
    assert.ok(def.housing + def.food + def.fun + def.calm + def.income > 0, `${id} must do something`);
  }
  assert.deepEqual(ROSTER.map((r) => r.id), [...ROSTER_IDS]);
  for (const r of ROSTER) assert.ok(BUILDINGS[r.fav], `${r.id}'s favourite exists`);
});

test('land: grows one ring at a time, with rising costs', () => {
  assert.equal(landSize(0), 4);
  assert.equal(landSize(LAND_MAX_LEVEL), 9);
  assert.equal(landSize(99), 9);
  assert.equal(landSize(-3), 4);
  for (let i = 1; i < LAND_COSTS.length; i++) assert.ok(LAND_COSTS[i]! > LAND_COSTS[i - 1]!);
  assert.equal(LAND_COSTS.length, LAND_MAX_LEVEL);
});

test('selling returns half, rounded down', () => {
  assert.equal(sellValue(40), 20);
  assert.equal(sellValue(35), 17);
});

test('gems: base rate is half an XP, harmony bonus never goes below the base', () => {
  assert.equal(gemsFor(10, 1), 5);
  assert.equal(gemsFor(10, 1.5), 8);
  assert.equal(gemsFor(0, 1.5), 0);
  assert.equal(gemsFor(-5, 1), 0);
});

test('stats: an empty town earns the base rate and has no pressure', () => {
  const s = cityStats([], 0);
  assert.equal(s.multiplier, 1);
  assert.equal(s.harmony, 1);
  assert.equal(s.incomePerDay, 0);
});

test('stats: needs are met by buildings, and harmony is their average', () => {
  const none = cityStats([bd('cottage')], 3);
  assert.deepEqual(none.coverage, { food: 0, fun: 0, calm: 0 });
  assert.equal(none.multiplier, 1); // unmet needs only forgo the bonus; never below base
  const full = cityStats([bd('cottage', 0), bd('bakery', 1), bd('carousel', 2), bd('park', 3)], 3);
  assert.deepEqual(full.coverage, { food: 1, fun: 1, calm: 1 });
  assert.equal(full.multiplier, 1.5);
  const partial = cityStats([bd('cottage', 0), bd('bakery', 1), bd('fountain', 2)], 4); // food 4/4, calm 2/4, fun 0
  assert.equal(partial.coverage.calm, 0.5);
  assert.ok(Math.abs(partial.harmony - 0.5) < 1e-9);
  assert.equal(partial.multiplier, 1.25);
});

test('stats: income adds building income and residents who are content', () => {
  const s = cityStats([bd('cottage', 0), bd('bakery', 1), bd('boutique', 2), bd('carousel', 3), bd('park', 4)], 3);
  assert.equal(s.incomePerDay, 1 + 4 + 3); // bakery + boutique + 3 residents at full harmony
  assert.equal(cityStats([bd('market')], 0).incomePerDay, 3);
});

test('welcome: needs a free home and a content town', () => {
  assert.equal(canWelcome([], 0, false), false);
  assert.equal(canWelcome([bd('cottage')], 0, false), false); // a home alone is not enough
  assert.equal(canWelcome([bd('cottage', 0), bd('bakery', 1), bd('park', 2)], 0, false), true); // food and calm cover two thirds of the needs
  assert.equal(canWelcome([bd('cottage')], 3, false), false); // full
  const hungry = [bd('cottage', 0), bd('cottage', 1)]; // 6 homes, 3 residents, no food/fun/calm
  assert.equal(canWelcome(hungry, 3, false), false);
  assert.equal(canWelcome([...hungry, bd('bakery', 2), bd('park', 3), bd('carousel', 4)], 3, false), true);
  assert.equal(canWelcome([bd('townhouse'), bd('townhouse', 1), bd('townhouse', 2)], ROSTER.length, true), false);
});

test('residents move in, in roster order, once each', () => {
  assert.equal(nextResident([], false)?.id, 'pip');
  assert.equal(nextResident([{ id: 'pip' }, { id: 'mabel' }], false)?.id, 'otto');
  assert.equal(nextResident(ROSTER.map((r) => ({ id: r.id })), true), null);
  // Unique residents only come to Premium towns.
  const regulars = ROSTER.filter((r) => !r.premium).map((r) => ({ id: r.id }));
  assert.equal(nextResident(regulars, false), null);
  assert.equal(nextResident(regulars, true)?.id, 'ember');
});

test('seasons follow the calendar month', () => {
  assert.equal(seasonOf('2026-03-01'), 'spring');
  assert.equal(seasonOf('2026-05-31'), 'spring');
  assert.equal(seasonOf('2026-06-01'), 'summer');
  assert.equal(seasonOf('2026-08-31'), 'summer');
  assert.equal(seasonOf('2026-10-11'), 'autumn');
  assert.equal(seasonOf('2026-12-01'), 'winter');
  assert.equal(seasonOf('2026-02-28'), 'winter');
});

test('locks: level and season gate what can be built', () => {
  assert.equal(lockReason(BUILDINGS.cottage, 1, 'autumn', false), null);
  assert.equal(lockReason(BUILDINGS.ferris, 5, 'autumn', false), 'Reach level 6');
  assert.equal(lockReason(BUILDINGS.pumpkin, 1, 'autumn', false), null);
  assert.equal(lockReason(BUILDINGS.pumpkin, 1, 'winter', false), 'Only in autumn');
  assert.equal(lockReason(BUILDINGS.snowman, 99, 'autumn', false), 'Only in winter');
  assert.equal(lockReason(BUILDINGS.observatory, 99, 'autumn', false), 'Premium');
  assert.equal(lockReason(BUILDINGS.observatory, 99, 'autumn', true), null);
});

test('dialogue: gentle, relevant, varies by day, never guilt-inducing', () => {
  const pip = ROSTER[0]!;
  const stats = cityStats([bd('cottage')], 3);
  const ctx = { stats, buildings: [bd('cottage')], doneToday: 0, season: 'autumn' as const, today: '2026-10-11' };
  const all = lines(pip, ctx);
  assert.ok(all.some((l) => l.includes('Bakery')));
  assert.ok(all.some((l) => /food/i.test(l)));
  assert.ok(all.some((l) => l.startsWith('No pressure')));
  for (const l of all) assert.ok(!/(late|behind|lazy|fail|should have|missed|disappoint)/i.test(l), l);
  assert.ok(lines(pip, { ...ctx, doneToday: 1 }).some((l) => l.startsWith('1 thing done today')));
  assert.notEqual(lineFor(pip, ctx, 0), lineFor(pip, { ...ctx, today: '2026-10-12' }, 0));
  assert.equal(typeof lineFor(pip, ctx, 3), 'string');
});

test('weekly event: one per Monday–Sunday week, rotating, claim id unique per week', () => {
  const a = weeklyEvent('2026-10-05');
  const b = weeklyEvent('2026-10-11');
  const c = weeklyEvent('2026-10-12');
  assert.equal(a.start, '2026-10-05');
  assert.equal(a.end, '2026-10-11');
  assert.equal(a.def.id, b.def.id);
  assert.equal(a.claimId, b.claimId);
  assert.notEqual(a.claimId, c.claimId);
  assert.notEqual(a.def.id, c.def.id);
  assert.equal(weeklyEvent('2025-12-29').start, '2025-12-29'); // before the epoch week still resolves
  for (const e of WEEKLY_EVENTS) assert.ok(e.goal > 0 && e.reward > 0);
});

test('weekly event progress counts only live completions inside the week', () => {
  const quests = WEEKLY_EVENTS.find((e) => e.metric === 'quests')!;
  const chores = WEEKLY_EVENTS.find((e) => e.metric === 'chores')!;
  const xp = WEEKLY_EVENTS.find((e) => e.metric === 'xp')!;
  const days = WEEKLY_EVENTS.find((e) => e.metric === 'days')!;
  const events = [
    ev({ day: '2026-10-05' }),
    ev({ day: '2026-10-05', xp: 40 }),
    ev({ day: '2026-10-07', kind: 'chore', taskType: null }),
    ev({ day: '2026-10-08', taskType: 'chore' }),
    ev({ day: '2026-10-04' }), // before the week
    ev({ day: '2026-10-12' }), // after the week
    ev({ day: '2026-10-06', voidedAt: '2026-10-06T12:00:00.000Z' }),
    ev({ day: '2026-10-06', kind: 'build', xp: 0, coins: 0, gems: -40, taskType: null }), // purchases are not activity
    ev({ day: '2026-10-09', kind: 'income', xp: 0, coins: 0, gems: 9, taskType: null }),
  ];
  assert.equal(eventProgress(quests, events, '2026-10-05', '2026-10-11'), 2);
  assert.equal(eventProgress(chores, events, '2026-10-05', '2026-10-11'), 2);
  assert.equal(eventProgress(xp, events, '2026-10-05', '2026-10-11'), 10 + 40 + 10 + 10);
  assert.equal(eventProgress(days, events, '2026-10-05', '2026-10-11'), 3);
});

test('each resident has a recognizable voice and repeat visits rotate their lines without randomness', () => {
  const sampleBuildings=[bd('cottage'),bd('bakery',1),bd('park',2)];
  const dialogue={stats:cityStats(sampleBuildings,3),buildings:sampleBuildings,doneToday:2,season:'spring' as const,today:'2026-10-22'};
  const first=ROSTER.map((r,i)=>lineFor(r,dialogue,i,0));
  assert.equal(new Set(first).size,ROSTER.length);
  for(const [i,r] of ROSTER.entries()){
    const dayA=Array.from({length:12},(_,visit)=>lineFor(r,dialogue,i,visit));
    const dayB=Array.from({length:12},(_,visit)=>lineFor(r,{...dialogue,today:'2026-10-23'},i,visit));
    assert.ok(new Set(dayA).size>=6,`${r.name} repeats should rotate through distinct dialogue`);
    assert.notDeepEqual(dayA,dayB,`${r.name}'s greeting should evolve with a new day`);
  }
  const pip=ROSTER.find(r=>r.id==='pip')!;const otto=ROSTER.find(r=>r.id==='otto')!;
  assert.notEqual(lineFor(pip,dialogue,0,0),lineFor(otto,dialogue,0,0));
});
