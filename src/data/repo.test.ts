import assert from 'node:assert/strict';
import { test } from 'node:test';
import { levelInfo } from '../domain/xp';
import { totals } from '../domain/stats';
import type { Recurrence } from '../domain/types';
import { loadDemo } from './demo';
import { AppError, Repo } from './repo';
import { MemoryStorage } from './storage';

function setup(start = '2026-10-05T09:00:00') {
  let now = new Date(start);
  const storage = new MemoryStorage();
  const repo = new Repo(storage, () => new Date(now));
  return { repo, storage, setNow: (iso: string) => void (now = new Date(iso)) };
}
const daily: Recurrence = { kind: 'daily', interval: 1, weekdays: [], dayOfMonth: 1 };
const xp = async (repo: Repo) => totals((await repo.snapshot()).events);
const code = (c: string) => (e: unknown) => e instanceof AppError && e.code === c;

test('task: only a title is required; defaults are sensible', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: '  Buy milk  ' });
  assert.equal(t.title, 'Buy milk');
  assert.equal(t.type, 'task');
  assert.equal(t.xp, 10);
  assert.equal(t.dueDate, null);
  assert.equal(t.completedAt, null);
  await assert.rejects(repo.addTask({ title: '   ' }), code('invalid'));
});

test('task: completing awards XP exactly once', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Quest', xp: 15 });
  const first = await repo.completeTask(t.id);
  assert.equal(first?.xp, 15);
  assert.equal(await repo.completeTask(t.id), null);
  assert.equal(await repo.completeTask(t.id), null);
  assert.deepEqual(await xp(repo), { xp: 15, balance: 15, quests: 1, chores: 0, redemptions: 0 });
});

test('task: rapid repeated taps (concurrent calls) still award once', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Quest', xp: 20 });
  const results = await Promise.all(Array.from({ length: 8 }, () => repo.completeTask(t.id)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await xp(repo)).xp, 20);
  assert.equal((await repo.snapshot()).events.length, 1);
});

test('task: reopening withdraws the XP; completing again awards it once more', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Quest', xp: 25 });
  await repo.completeTask(t.id);
  await repo.reopenTask(t.id);
  assert.equal((await xp(repo)).xp, 0);
  await repo.reopenTask(t.id); // reopening an open task is harmless
  assert.equal((await xp(repo)).xp, 0);
  await repo.completeTask(t.id);
  const snap = await repo.snapshot();
  assert.equal(totals(snap.events).xp, 25);
  assert.equal(snap.events.length, 2); // the voided event stays in the ledger for audit
  assert.equal(snap.events.filter((e) => e.voidedAt).length, 1);
  assert.equal(snap.tasks[0]!.completionSeq, 2);
});

test('task: cannot reopen once its coins are spent (balance never negative)', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Quest', xp: 50 });
  await repo.completeTask(t.id);
  const r = await repo.addReward({ name: 'Treat', description: '', cost: 40, icon: 'treat' });
  await repo.redeem(r.id);
  await assert.rejects(repo.reopenTask(t.id), code('spent'));
  const snap = await repo.snapshot();
  assert.ok(snap.tasks[0]!.completedAt, 'task stays completed');
  assert.equal(totals(snap.events).balance, 10);
});

test('task: editing XP after completion does not change the award; deleting keeps history', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Quest', xp: 10 });
  await repo.completeTask(t.id);
  await repo.updateTask(t.id, { xp: 500 });
  assert.equal((await xp(repo)).xp, 10);
  await repo.deleteTask(t.id);
  const snap = await repo.snapshot();
  assert.equal(snap.tasks.length, 0);
  assert.equal(totals(snap.events).xp, 10);
  assert.equal(snap.events[0]!.title, 'Quest');
});

test('task: updates are validated and cannot smuggle protected fields', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Quest' });
  await assert.rejects(repo.updateTask(t.id, { xp: 99999 }), code('invalid'));
  await assert.rejects(repo.updateTask(t.id, { xp: -5 }), code('invalid'));
  await assert.rejects(repo.updateTask(t.id, { title: 'x'.repeat(121) }), code('invalid'));
  await assert.rejects(repo.updateTask(t.id, { dueDate: '2026-13-45' }), code('invalid'));
  const hostile = JSON.parse('{"title":"ok","completedAt":"2026-01-01T00:00:00.000Z","id":"other","completionSeq":9,"__proto__":{"polluted":true}}');
  const after = await repo.updateTask(t.id, hostile);
  assert.equal(after.id, t.id);
  assert.equal(after.completedAt, null);
  assert.equal(after.completionSeq, 0);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  await assert.rejects(repo.updateTask('missing', { title: 'x' }), code('not-found'));
});

test('task: subtasks toggle and project name only applies to project quests', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Quest', type: 'project', project: 'Story', subtasks: [{ id: 's1', title: 'a', done: false }] });
  await repo.toggleSubtask(t.id, 's1');
  assert.equal((await repo.snapshot()).tasks[0]!.subtasks[0]!.done, true);
  const changed = await repo.updateTask(t.id, { type: 'task' });
  assert.equal(changed.project, '');
});

test('chore: completing records history and schedules the next occurrence', async () => {
  const { repo, setNow } = setup();
  const c = await repo.addChore({ title: 'Dishes', recurrence: daily, difficulty: 'hard' });
  assert.equal(c.nextDue, '2026-10-05');
  assert.equal(c.xp, 25);
  const ev = await repo.completeChore(c.id, '2026-10-05');
  assert.equal(ev?.xp, 25);
  assert.equal((await repo.snapshot()).chores[0]!.nextDue, '2026-10-06');
  setNow('2026-10-06T08:00:00');
  await repo.completeChore(c.id, '2026-10-06');
  const snap = await repo.snapshot();
  assert.equal(snap.events.filter((e) => e.refId === c.id).length, 2);
  assert.deepEqual(totals(snap.events), { xp: 50, balance: 50, quests: 0, chores: 2, redemptions: 0 });
});

test('chore: a double tap completes one occurrence, not two', async () => {
  const { repo } = setup();
  const c = await repo.addChore({ title: 'Dishes', recurrence: daily });
  const results = await Promise.all([repo.completeChore(c.id, c.nextDue), repo.completeChore(c.id, c.nextDue), repo.completeChore(c.id, c.nextDue)]);
  assert.equal(results.filter(Boolean).length, 1);
  const snap = await repo.snapshot();
  assert.equal(snap.events.length, 1);
  assert.equal(snap.chores[0]!.nextDue, '2026-10-06');
});

test('chore: overdue chores keep a single occurrence and no penalty', async () => {
  const { repo, setNow } = setup();
  const c = await repo.addChore({ title: 'Bed', recurrence: daily });
  setNow('2026-10-20T09:00:00'); // fifteen days missed
  const before = await repo.snapshot();
  assert.equal(before.chores[0]!.nextDue, '2026-10-05'); // still just the one
  assert.equal(totals(before.events).xp, 0); // nothing deducted
  await repo.completeChore(c.id, '2026-10-05');
  const after = await repo.snapshot();
  assert.equal(after.chores[0]!.nextDue, '2026-10-21');
  assert.equal(after.events.length, 1);
});

test('chore: skip moves on without XP; paused chores cannot be completed', async () => {
  const { repo, setNow } = setup();
  const c = await repo.addChore({ title: 'Laundry', recurrence: { kind: 'weekly', interval: 1, weekdays: [6], dayOfMonth: 1 } });
  assert.equal(c.nextDue, '2026-10-10');
  setNow('2026-10-12T09:00:00');
  await repo.skipChore(c.id, '2026-10-10');
  assert.equal((await repo.snapshot()).chores[0]!.nextDue, '2026-10-17');
  assert.equal((await xp(repo)).xp, 0);
  await repo.updateChore(c.id, { paused: true });
  assert.equal(await repo.completeChore(c.id, '2026-10-17'), null);
  setNow('2026-11-02T09:00:00');
  const resumed = await repo.updateChore(c.id, { paused: false });
  assert.equal(resumed.nextDue, '2026-11-07'); // resumes from today, no backlog
});

test('chore: editing the schedule keeps completion history', async () => {
  const { repo } = setup();
  const c = await repo.addChore({ title: 'Trash', recurrence: daily });
  await repo.completeChore(c.id, c.nextDue);
  const edited = await repo.updateChore(c.id, { title: 'Take out trash', recurrence: { kind: 'weekly', interval: 1, weekdays: [3], dayOfMonth: 1 } });
  assert.equal(edited.nextDue, '2026-10-07');
  assert.equal(edited.completionSeq, 1);
  const snap = await repo.snapshot();
  assert.equal(snap.events.length, 1);
  assert.equal(snap.events[0]!.title, 'Trash');
  await repo.deleteChore(c.id);
  assert.equal(totals((await repo.snapshot()).events).chores, 1);
});

test('chore: invalid recurrence rules are rejected', async () => {
  const { repo } = setup();
  await assert.rejects(repo.addChore({ title: 'x', recurrence: { kind: 'weekly', interval: 1, weekdays: [], dayOfMonth: 1 } }), code('invalid'));
  await assert.rejects(repo.addChore({ title: 'x', recurrence: { ...daily, interval: 0 } }), code('invalid'));
  await assert.rejects(repo.addChore({ title: 'x', recurrence: { ...daily, interval: 1e9 } }), code('invalid'));
  await assert.rejects(repo.addChore({ title: 'x', recurrence: { kind: 'weekly', interval: 1, weekdays: [9], dayOfMonth: 1 } }), code('invalid'));
});

test('undo: chore completion rewinds the due date; redemption is refunded', async () => {
  const { repo } = setup();
  const c = await repo.addChore({ title: 'Dishes', recurrence: daily, xp: 40 });
  const ev = await repo.completeChore(c.id, c.nextDue);
  await repo.undoEvent(ev!.id);
  let snap = await repo.snapshot();
  assert.equal(snap.chores[0]!.nextDue, '2026-10-05');
  assert.equal(totals(snap.events).xp, 0);
  await repo.undoEvent(ev!.id); // undoing twice is harmless
  const again = await repo.completeChore(c.id, '2026-10-05');
  assert.notEqual(again!.id, ev!.id);
  const r = await repo.addReward({ name: 'Tea', description: '', cost: 30, icon: 'coffee' });
  const spend = await repo.redeem(r.id);
  assert.equal((await xp(repo)).balance, 10);
  await repo.undoEvent(spend.id);
  snap = await repo.snapshot();
  assert.equal(totals(snap.events).balance, 40);
});

test('rewards: redeeming spends coins but never lifetime XP or level', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Big quest', xp: 120 });
  await repo.completeTask(t.id);
  const r = await repo.addReward({ name: 'Movie', description: '', cost: 75, icon: 'film' });
  await repo.redeem(r.id);
  const tot = await xp(repo);
  assert.equal(tot.xp, 120);
  assert.equal(tot.balance, 45);
  assert.equal(levelInfo(tot.xp).level, 2);
});

test('rewards: insufficient balance is refused and nothing is written', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Quest', xp: 50 });
  await repo.completeTask(t.id);
  const r = await repo.addReward({ name: 'Movie', description: '', cost: 30, icon: 'film' });
  // Three simultaneous redemptions with funds for one: only one may succeed.
  const results = await Promise.allSettled([repo.redeem(r.id), repo.redeem(r.id), repo.redeem(r.id)]);
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await xp(repo)).balance, 20);
  await assert.rejects(repo.redeem(r.id), code('insufficient'));
  await assert.rejects(repo.addReward({ name: 'Free', description: '', cost: 0, icon: 'gift' }), code('invalid'));
  await assert.rejects(repo.addReward({ name: 'Neg', description: '', cost: -10, icon: 'gift' }), code('invalid'));
});

test('settings: coin rate applies to new awards only and is range-checked', async () => {
  const { repo } = setup();
  const a = await repo.addTask({ title: 'A', xp: 10 });
  await repo.completeTask(a.id);
  await repo.saveSettings({ coinRate: 2 });
  const b = await repo.addTask({ title: 'B', xp: 10 });
  await repo.completeTask(b.id);
  assert.deepEqual(await xp(repo), { xp: 20, balance: 30, quests: 2, chores: 0, redemptions: 0 });
  await assert.rejects(repo.saveSettings({ coinRate: 1000 }), code('invalid'));
  await assert.rejects(repo.saveSettings({ weeklyGoal: 0 }), code('invalid'));
});

test('achievements: unlock once and stay unlocked', async () => {
  const { repo } = setup();
  const t = await repo.addTask({ title: 'Quest' });
  await repo.completeTask(t.id);
  assert.deepEqual(await repo.syncAchievements(), ['first-quest']);
  assert.deepEqual(await repo.syncAchievements(), []);
  await repo.reopenTask(t.id);
  assert.deepEqual(await repo.syncAchievements(), []);
  assert.equal((await repo.snapshot()).achievements.length, 1);
});

test('Rohld achievement unlocks at 30 active dates and stays earned after undo', async () => {
  const { repo, setNow } = setup();
  let lastTaskId = '';
  for (let i = 1; i <= 30; i++) {
    setNow(`2026-01-${String(i).padStart(2, '0')}T09:00:00`);
    const task = await repo.addTask({ title: `Day ${i}` });
    lastTaskId = task.id;
    await repo.completeTask(task.id);
  }
  const unlocked = await repo.syncAchievements();
  assert.ok(unlocked.includes('rohld-visitor'));
  await repo.reopenTask(lastTaskId);
  assert.deepEqual(await repo.syncAchievements(), []);
  assert.ok((await repo.snapshot()).achievements.some((entry) => entry.id === 'rohld-visitor'));
});

test('persistence: a second Repo on the same storage sees everything (reload)', async () => {
  const { repo, storage } = setup();
  const t = await repo.addTask({ title: 'Survives reload', xp: 15 });
  await repo.completeTask(t.id);
  await repo.addChore({ title: 'Dishes', recurrence: daily });
  await repo.saveSettings({ playerName: 'Robin' });
  const reopened = new Repo(storage, () => new Date('2026-10-05T12:00:00'));
  const snap = await reopened.snapshot();
  assert.equal(snap.tasks[0]!.title, 'Survives reload');
  assert.equal(snap.chores.length, 1);
  assert.equal(snap.settings.playerName, 'Robin');
  assert.equal(totals(snap.events).xp, 15);
  assert.equal(await reopened.completeTask(t.id), null); // no second award after "refresh"
});

test('storage: a failed transaction writes nothing', async () => {
  const { repo, storage } = setup();
  await repo.addTask({ title: 'A' }, 'fixed-id');
  await assert.rejects(repo.addTask({ title: 'B' }, 'fixed-id'));
  await assert.rejects(
    storage.tx('rw', async (tx) => {
      await tx.put('tasks', { id: 'half-written' });
      throw new Error('boom');
    }),
  );
  const snap = await repo.snapshot();
  assert.deepEqual(snap.tasks.map((t) => t.title), ['A']);
});

test('demo data: loads idempotently and can be removed cleanly', async () => {
  const { repo } = setup();
  const mine = await repo.addTask({ title: 'My own quest' });
  await loadDemo(repo, '2026-10-05');
  await loadDemo(repo, '2026-10-05');
  let snap = await repo.snapshot();
  assert.equal(snap.tasks.length, 7);
  assert.equal(snap.chores.length, 6);
  assert.equal(snap.rewards.length, 3);
  await repo.completeTask('demo-t1');
  await repo.removeDemo();
  snap = await repo.snapshot();
  assert.deepEqual(snap.tasks.map((t) => t.id), [mine.id]);
  assert.equal(snap.chores.length + snap.rewards.length, 0);
  assert.equal(totals(snap.events).xp, 10); // XP you earned stays
});

test('wipe: erases everything', async () => {
  const { repo } = setup();
  await loadDemo(repo, '2026-10-05');
  await repo.saveSettings({ playerName: 'Robin' });
  await repo.wipe();
  const snap = await repo.snapshot();
  assert.equal(snap.tasks.length + snap.chores.length + snap.rewards.length + snap.events.length, 0);
  assert.equal(snap.settings.playerName, '');
});

test('corrupted stored rows are ignored, never crash the app or distort XP', async () => {
  const { repo, storage } = setup();
  const good = await repo.addTask({ title: 'Good', xp: 10 });
  await repo.completeTask(good.id);
  await storage.tx('rw', async (tx) => {
    await tx.put('tasks', { id: 'broken-1' }); // missing everything
    await tx.put('tasks', { ...good, id: 'broken-2', subtasks: 'not-a-list', xp: 1e9 });
    await tx.put('chores', { id: 'broken-3', title: 'x', recurrence: { kind: 'daily', interval: 0 } });
    await tx.put('rewards', { id: 'broken-4', name: 'Free money', cost: -500 });
    await tx.put('events', { id: 'broken-5', kind: 'task', xp: 999_999, coins: 999_999 });
    await tx.put('events', { id: 'broken-6', kind: 'redeem', refId: 'r', title: 't', taskType: null, xp: 0, coins: 5000, at: '2026-10-05T09:00:00.000Z', day: '2026-10-05', prevDue: null, voidedAt: null });
    await tx.put('events', { id: 'broken-7', kind: 'task', refId: 'r', title: 't', taskType: null, xp: Number.NaN, coins: 1, at: 'x', day: 'y', prevDue: null, voidedAt: null });
    await tx.put('achievements', { id: 'level-10', unlockedAt: 12345 });
    await tx.put('meta', { id: 'settings', value: { coinRate: 1e9, theme: '<script>' } });
  });
  const snap = await repo.snapshot();
  assert.deepEqual(snap.tasks.map((t) => t.id), [good.id]);
  assert.equal(snap.chores.length + snap.rewards.length + snap.achievements.length, 0);
  assert.deepEqual(totals(snap.events), { xp: 10, balance: 10, quests: 1, chores: 0, redemptions: 0 });
  assert.equal(snap.settings.coinRate, 1); // bad settings fall back to defaults
  assert.equal(await repo.completeTask('broken-2'), null); // a damaged task cannot mint XP
  await assert.rejects(repo.redeem('broken-4'), code('not-found'));
  assert.deepEqual(await repo.syncAchievements(), ['first-quest']);
});

test('a pre-existing ledger id cannot block a completion', async () => {
  const { repo, storage } = setup();
  const t = await repo.addTask({ title: 'Quest', xp: 10 }, 'abc');
  await storage.tx('rw', (tx) => tx.put('events', { id: 'task:abc:1', kind: 'task', refId: 'abc', title: 'old', taskType: 'task', xp: 10, coins: 10, at: '2026-10-01T09:00:00.000Z', day: '2026-10-01', prevDue: null, voidedAt: '2026-10-01T10:00:00.000Z' }));
  const ev = await repo.completeTask(t.id);
  assert.equal(ev?.id, 'task:abc:2');
  assert.equal((await xp(repo)).xp, 10);
  await repo.reopenTask(t.id);
  assert.equal((await xp(repo)).xp, 0);
});

test('record ids cannot imitate ledger ids', async () => {
  const { repo } = setup();
  await assert.rejects(repo.addTask({ title: 'x' }, 'task:abc:1'), code('invalid'));
  await assert.rejects(repo.addTask({ title: 'x' }, 'x'.repeat(65)), code('invalid'));
});
