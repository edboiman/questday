import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACHIEVEMENTS, satisfied } from './achievements';
import { addDays, diffDays, isValidDay, weekStart, weekdayOf } from './dates';
import { describeRecurrence, nextAfter, nextDueAfter, nextOnOrAfter } from './recurrence';
import { streaks, totals, weekSeries } from './stats';
import { DEFAULT_SETTINGS, type LedgerEvent, type Recurrence, type Task } from './types';
import { coinsFor, levelInfo, totalXpForLevel, xpToNextLevel } from './xp';

const rule = (r: Partial<Recurrence>): Recurrence => ({ kind: 'daily', interval: 1, weekdays: [], dayOfMonth: 1, ...r });
const ev = (e: Partial<LedgerEvent>): LedgerEvent => ({ id: Math.random().toString(36).slice(2), kind: 'task', refId: 'x', title: 't', taskType: 'task', xp: 10, coins: 10, gems: 5, at: '2026-10-05T10:00:00.000Z', day: '2026-10-05', prevDue: null, voidedAt: null, ...e });
const task = (t: Partial<Task>): Task => ({ id: 'a', title: 't', description: '', type: 'task', project: '', dueDate: null, focusDay: null, priority: null, tag: '', estimateMin: null, subtasks: [], xp: 10, completedAt: null, completionSeq: 0, createdAt: '2026-10-05T10:00:00.000Z', updatedAt: '2026-10-05T10:00:00.000Z', ...t });

test('dates: validation and arithmetic', () => {
  assert.ok(isValidDay('2026-02-28'));
  assert.ok(!isValidDay('2026-02-30'));
  assert.ok(!isValidDay('2026-2-3'));
  assert.ok(!isValidDay('99999-01-01'));
  assert.ok(!isValidDay(20260101));
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-03-30', '2026-03-28'), 2); // across EU DST change
  assert.equal(weekdayOf('2026-10-11'), 0); // Sunday
  assert.equal(weekStart('2026-10-11'), '2026-10-05'); // Monday
});

test('levels: thresholds follow the documented formula', () => {
  assert.equal(xpToNextLevel(1), 100);
  assert.equal(xpToNextLevel(2), 150);
  assert.equal(totalXpForLevel(1), 0);
  assert.equal(totalXpForLevel(2), 100);
  assert.equal(totalXpForLevel(3), 250);
  assert.equal(totalXpForLevel(5), 700);
  assert.equal(totalXpForLevel(10), 2700);
});

test('levels: a new player is level 1 with 0 XP', () => {
  assert.deepEqual(levelInfo(0), { level: 1, totalXp: 0, intoLevel: 0, span: 100, remaining: 100, progress: 0 });
});

test('levels: boundaries, progress inside a level, and bad input', () => {
  assert.equal(levelInfo(99).level, 1);
  assert.equal(levelInfo(100).level, 2);
  assert.equal(levelInfo(100).intoLevel, 0);
  assert.deepEqual(levelInfo(175), { level: 2, totalXp: 175, intoLevel: 75, span: 150, remaining: 75, progress: 0.5 });
  assert.equal(levelInfo(699).level, 4);
  assert.equal(levelInfo(700).level, 5);
  assert.equal(levelInfo(-50).level, 1);
  assert.equal(levelInfo(Number.NaN).totalXp, 0);
  assert.equal(levelInfo(Number.POSITIVE_INFINITY).level, 1);
  assert.ok(levelInfo(1e12).level <= 999); // terminates, capped
});

test('coins: conversion never goes negative', () => {
  assert.equal(coinsFor(15, 1), 15);
  assert.equal(coinsFor(15, 0.5), 8);
  assert.equal(coinsFor(15, 2), 30);
  assert.equal(coinsFor(-5, 1), 0);
});

test('recurrence: daily and every-N-days', () => {
  assert.equal(nextAfter(rule({}), '2026-10-11'), '2026-10-12');
  assert.equal(nextAfter(rule({ interval: 3 }), '2026-10-11'), '2026-10-14');
  assert.equal(nextOnOrAfter(rule({ interval: 3 }), '2026-10-11'), '2026-10-11');
});

test('recurrence: weekly on selected weekdays', () => {
  const monThu = rule({ kind: 'weekly', weekdays: [1, 4] });
  assert.equal(nextOnOrAfter(monThu, '2026-10-11'), '2026-10-12'); // Sun → Mon
  assert.equal(nextOnOrAfter(monThu, '2026-10-12'), '2026-10-12');
  assert.equal(nextAfter(monThu, '2026-10-12'), '2026-10-15'); // Mon → Thu
  assert.equal(nextAfter(monThu, '2026-10-15'), '2026-10-19'); // Thu → Mon
  const sat = rule({ kind: 'weekly', weekdays: [6] });
  assert.equal(nextAfter(sat, '2026-10-10'), '2026-10-17');
});

test('recurrence: every two weeks', () => {
  const biweekly = rule({ kind: 'weekly', interval: 2, weekdays: [6] });
  assert.equal(nextAfter(biweekly, '2026-10-10'), '2026-10-24');
  const twoDays = rule({ kind: 'weekly', interval: 2, weekdays: [1, 4] });
  assert.equal(nextAfter(twoDays, '2026-10-12'), '2026-10-15'); // same week: no skip
  assert.equal(nextAfter(twoDays, '2026-10-15'), '2026-10-26'); // new week: skip one
});

test('recurrence: monthly clamps to short months and handles year end', () => {
  const d31 = rule({ kind: 'monthly', dayOfMonth: 31 });
  assert.equal(nextOnOrAfter(d31, '2026-02-10'), '2026-02-28');
  assert.equal(nextAfter(d31, '2026-01-31'), '2026-02-28');
  assert.equal(nextAfter(d31, '2026-02-28'), '2026-03-31');
  assert.equal(nextAfter(rule({ kind: 'monthly', dayOfMonth: 15 }), '2026-12-15'), '2027-01-15');
  assert.equal(nextAfter(rule({ kind: 'monthly', dayOfMonth: 15, interval: 3 }), '2026-12-15'), '2027-03-15');
  assert.equal(nextAfter(rule({ kind: 'monthly', dayOfMonth: 15 }), '2026-10-01'), '2026-10-15');
});

test('recurrence: missed days never create a backlog', () => {
  // A daily chore last due 10 days ago, completed today, is next due tomorrow.
  assert.equal(nextDueAfter(rule({}), '2026-10-01', '2026-10-11'), '2026-10-12');
  // A weekly Saturday chore done three weeks late is next due the coming Saturday.
  assert.equal(nextDueAfter(rule({ kind: 'weekly', weekdays: [6] }), '2026-09-19', '2026-10-11'), '2026-10-17');
  // Done early: the occurrence being satisfied is the upcoming one.
  assert.equal(nextDueAfter(rule({ interval: 3 }), '2026-10-13', '2026-10-11'), '2026-10-16');
});

test('recurrence: descriptions', () => {
  assert.equal(describeRecurrence(rule({})), 'Every day');
  assert.equal(describeRecurrence(rule({ interval: 3 })), 'Every 3 days');
  assert.equal(describeRecurrence(rule({ kind: 'weekly', weekdays: [0, 1] })), 'Weekly · Mon, Sun');
  assert.equal(describeRecurrence(rule({ kind: 'monthly', dayOfMonth: 22, interval: 2 })), 'Every 2 months · 22nd');
});

test('stats: totals ignore voided events and keep XP separate from coins', () => {
  const events = [
    ev({ xp: 10, coins: 10 }),
    ev({ xp: 25, coins: 25, kind: 'chore', taskType: null }),
    ev({ xp: 15, coins: 15, taskType: 'chore' }),
    ev({ xp: 50, coins: 50, voidedAt: '2026-10-05T11:00:00.000Z' }),
    ev({ kind: 'redeem', xp: 0, coins: -30, taskType: null }),
  ];
  assert.deepEqual(totals(events), { xp: 50, balance: 20, quests: 1, chores: 2, redemptions: 1 });
});

test('stats: streaks', () => {
  const days = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-09', '2026-10-10']);
  assert.deepEqual(streaks(days, '2026-10-10'), { current: 2, best: 3 });
  assert.deepEqual(streaks(days, '2026-10-11'), { current: 2, best: 3 }); // nothing yet today: still alive
  assert.deepEqual(streaks(days, '2026-10-12'), { current: 0, best: 3 }); // ended, best kept
  assert.deepEqual(streaks(new Set(), '2026-10-12'), { current: 0, best: 0 });
});

test('stats: week series covers Monday to Sunday', () => {
  const series = weekSeries([ev({ day: '2026-10-05' }), ev({ day: '2026-10-11', xp: 5 }), ev({ day: '2026-10-04' })], '2026-10-08');
  assert.equal(series.length, 7);
  assert.equal(series[0]!.day, '2026-10-05');
  assert.equal(series[0]!.count, 1);
  assert.equal(series[6]!.xp, 5);
  assert.equal(series.reduce((n, d) => n + d.count, 0), 2);
});

test('achievements: unlock conditions', () => {
  const ctx = (tasks: Task[], events: LedgerEvent[]) => ({ tasks, events, settings: { ...DEFAULT_SETTINGS, weeklyGoal: 3 }, today: '2026-10-05' });
  assert.deepEqual(satisfied(ctx([], [])), []);
  assert.deepEqual(satisfied(ctx([], [ev({})])), ['first-quest']);
  assert.deepEqual(satisfied(ctx([], [ev({ kind: 'chore', taskType: null })])), ['first-chore']);
  // a voided completion unlocks nothing
  assert.deepEqual(satisfied(ctx([], [ev({ voidedAt: '2026-10-05T11:00:00.000Z' })])), []);
  const ten = Array.from({ length: 10 }, () => ev({ xp: 70 }));
  const got = satisfied(ctx([], ten));
  for (const id of ['first-quest', 'ten-quests', 'level-5', 'weekly-challenge']) assert.ok(got.includes(id), id);
  assert.ok(!got.includes('level-10'));
});

test('achievements: project completes only when every quest in it is done', () => {
  const ctx = (tasks: Task[]) => ({ tasks, events: [], settings: DEFAULT_SETTINGS, today: '2026-10-05' });
  const a = task({ id: 'a', type: 'project', project: 'Story', completedAt: '2026-10-05T10:00:00.000Z' });
  const b = task({ id: 'b', type: 'project', project: 'story ' });
  assert.ok(!satisfied(ctx([a, b])).includes('first-project'));
  assert.ok(satisfied(ctx([a, { ...b, completedAt: '2026-10-05T10:00:00.000Z' }])).includes('first-project'));
});

test('achievements: clean sweep needs at least three daily quests, all done', () => {
  const ctx = (tasks: Task[]) => ({ tasks, events: [], settings: DEFAULT_SETTINGS, today: '2026-10-05' });
  const done = { completedAt: '2026-10-05T10:00:00.000Z' };
  const two = [task({ id: 'a', dueDate: '2026-10-05', ...done }), task({ id: 'b', focusDay: '2026-10-05', ...done })];
  assert.ok(!satisfied(ctx(two)).includes('daily-sweep'));
  const three = [...two, task({ id: 'c', dueDate: '2026-10-05' })];
  assert.ok(!satisfied(ctx(three)).includes('daily-sweep'));
  three[2] = { ...three[2]!, ...done };
  assert.ok(satisfied(ctx(three)).includes('daily-sweep'));
});

test('achievements: ids are unique', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
});
