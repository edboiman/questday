import assert from 'node:assert/strict';
import { test } from 'node:test';
import { weeklyReport } from './report';
import type { LedgerEvent } from './types';

const ev = (day: string, kind: LedgerEvent['kind'], xp: number, extra: Partial<LedgerEvent> = {}): LedgerEvent => ({ id: `${kind}:${day}:${Math.random()}`, kind, refId: 'r', title: 't', taskType: kind === 'task' ? 'task' : null, xp, coins: xp, gems: Math.round(xp / 2), at: `${day}T10:00:00.000Z`, day, prevDue: null, voidedAt: null, ...extra });

test('weekly report: last full week, compared with the week before, undone items excluded', () => {
  // Today is Wed 2026-10-14; last week is Mon 5 – Sun 11 Oct; the week before is 28 Sep – 4 Oct.
  const events = [ev('2026-10-05', 'task', 20), ev('2026-10-05', 'chore', 10), ev('2026-10-07', 'task', 30), ev('2026-10-08', 'task', 50, { voidedAt: '2026-10-08T11:00:00.000Z' }), ev('2026-09-30', 'task', 10), ev('2026-10-13', 'task', 99), ev('2026-10-06', 'collect', 0, { coins: -30, gems: 0 })];
  const r = weeklyReport(events, [{ id: 'pip', movedIn: '2026-10-06' }], '2026-10-14');
  assert.equal(r.start, '2026-10-05');
  assert.equal(r.end, '2026-10-11');
  assert.equal(r.week.quests, 2);
  assert.equal(r.week.chores, 1);
  assert.equal(r.week.xp, 60);
  assert.equal(r.week.activeDays, 2);
  assert.equal(r.week.exhibits, 1);
  assert.equal(r.previous.quests, 1);
  assert.equal(r.bestDay?.label, 'Mon');
  assert.equal(r.newResidents, 1);
  assert.match(r.headline, /more than the week before/);
});

test('weekly report: an empty week gets a kind headline, never a scolding', () => {
  const r = weeklyReport([], [], '2026-10-14');
  assert.equal(r.week.quests, 0);
  assert.equal(r.bestDay, null);
  assert.match(r.headline, /Rest counts too/);
});
