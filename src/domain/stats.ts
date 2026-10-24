import { addDays, weekStart, WEEKDAY_SHORT, weekdayOf } from './dates';
import type { Day, LedgerEvent } from './types';

/*
 * Every number shown in the app is derived from the ledger here.
 * There are no stored counters that could drift out of sync.
 */

export const isLive = (e: LedgerEvent): boolean => e.voidedAt === null;
/** A completed quest or chore (as opposed to a purchase, income payout or event reward). */
export const isEarn = (e: LedgerEvent): boolean => e.kind === 'task' || e.kind === 'chore';
export const isChoreEvent = (e: LedgerEvent): boolean => e.kind === 'chore' || (e.kind === 'task' && e.taskType === 'chore');

export interface Totals {
  xp: number;
  balance: number;
  quests: number;
  chores: number;
  redemptions: number;
}

export function totals(events: readonly LedgerEvent[]): Totals {
  const t: Totals = { xp: 0, balance: 0, quests: 0, chores: 0, redemptions: 0 };
  for (const e of events) {
    if (!isLive(e)) continue;
    t.balance += e.coins;
    if (e.kind === 'admin') {
      t.xp += e.xp;
      continue;
    }
    if (e.kind === 'redeem') {
      t.redemptions++;
      continue;
    }
    if (!isEarn(e)) continue;
    t.xp += e.xp;
    if (isChoreEvent(e)) t.chores++;
    else t.quests++;
  }
  return t;
}

export const balanceOf = (events: readonly LedgerEvent[]): number => totals(events).balance;

/** Spendable city currency. */
export function gemBalance(events: readonly LedgerEvent[]): number {
  let gems = 0;
  for (const e of events) if (isLive(e)) gems += e.gems;
  return gems;
}

export function activeDays(events: readonly LedgerEvent[]): Set<Day> {
  const days = new Set<Day>();
  for (const e of events) if (isLive(e) && isEarn(e)) days.add(e.day);
  return days;
}

/** A streak stays "current" through today even if nothing is done yet today. */
export function streaks(days: ReadonlySet<Day>, today: Day): { current: number; best: number } {
  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // not the start of a run
    let len = 1;
    let next = addDays(day, 1);
    while (days.has(next)) {
      len++;
      next = addDays(next, 1);
    }
    if (len > best) best = len;
  }
  return { current, best: Math.max(best, current) };
}

export interface DayStat {
  day: Day;
  label: string;
  count: number;
  xp: number;
}

/** Monday–Sunday of the week containing `today`. */
export function weekSeries(events: readonly LedgerEvent[], today: Day): DayStat[] {
  const start = weekStart(today);
  const series: DayStat[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    series.push({ day, label: WEEKDAY_SHORT[weekdayOf(day)]!, count: 0, xp: 0 });
  }
  const byDay = new Map(series.map((s) => [s.day, s]));
  for (const e of events) {
    if (!isLive(e) || !isEarn(e)) continue;
    const slot = byDay.get(e.day);
    if (slot) {
      slot.count++;
      slot.xp += e.xp;
    }
  }
  return series;
}

export function dayStat(events: readonly LedgerEvent[], day: Day): { count: number; xp: number } {
  let count = 0;
  let xp = 0;
  for (const e of events) {
    if (isLive(e) && isEarn(e) && e.day === day) {
      count++;
      xp += e.xp;
    }
  }
  return { count, xp };
}
