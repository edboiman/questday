import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Day, LedgerEvent } from './types';
import { rohldLine, rohldProgress, ROHLD_UNLOCK_DAYS } from './visitor';

function event(id: string, day: Day, kind: LedgerEvent['kind'] = 'task', voidedAt: string | null = null): LedgerEvent {
  return { id, kind, refId: id, title: 'A small quest', taskType: kind === 'chore' ? 'chore' : 'task', xp: 10, coins: 10, gems: 0, at: `${day}T10:00:00.000Z`, day, prevDue: null, voidedAt };
}

test('Rohld unlocks after 30 distinct live quest, project or chore days', () => {
  const events = Array.from({ length: ROHLD_UNLOCK_DAYS }, (_, i) => event(`task-${i}`, `2026-01-${String(i + 1).padStart(2, '0')}`));
  events.push(event('second-task-same-day', '2026-01-01', 'chore'));
  assert.deepEqual(rohldProgress(events), { days: 30, remaining: 0, unlocked: true });
  assert.equal(rohldProgress(events.slice(0, 29)).unlocked, false);
});

test('undoing a completion removes that active day unless another live completion remains', () => {
  const events = [event('one', '2026-03-01', 'task', '2026-03-02T10:00:00.000Z'), event('two', '2026-03-01', 'chore')];
  assert.equal(rohldProgress(events).days, 1);
  assert.equal(rohldProgress(events.slice(0, 1)).days, 0);
});

test('purchases and passive events do not count toward the unlock', () => {
  assert.equal(rohldProgress([event('buy', '2026-04-01', 'collect'), event('daily-gems', '2026-04-02', 'income')]).days, 0);
});

test('an earned visitor unlock remains permanent after later undo', () => {
  const undone = event('one', '2026-04-01', 'task', '2026-04-02T10:00:00.000Z');
  assert.equal(rohldProgress([undone], true).unlocked, true);
});

test('Rohld dialogue varies deterministically by day and visit', () => {
  const first = rohldLine('2026-06-10', 1);
  assert.equal(rohldLine('2026-06-10', 1), first);
  assert.notEqual(rohldLine('2026-06-10', 2), first);
  assert.notEqual(rohldLine('2026-06-11', 1), first);
});
