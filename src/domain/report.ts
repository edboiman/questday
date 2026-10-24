import { addDays, weekStart, WEEKDAY_SHORT, weekdayOf } from './dates';
import { isChoreEvent, isEarn, isLive } from './stats';
import type { Day, LedgerEvent, ResidentRow } from './types';

/*
 * Weekly progress report (Premium). Computed on the device from the ledger;
 * nothing is sent anywhere. A week runs Monday to Sunday.
 */

export interface WeekNumbers {
  quests: number;
  chores: number;
  xp: number;
  coins: number;
  gems: number;
  activeDays: number;
  exhibits: number;
  buildings: number;
}

export interface WeeklyReport {
  start: Day;
  end: Day;
  week: WeekNumbers;
  previous: WeekNumbers;
  /** Busiest day, or null if nothing was done. */
  bestDay: { label: string; count: number } | null;
  newResidents: number;
  /** One encouraging sentence, never a scolding one. */
  headline: string;
}

function numbers(events: readonly LedgerEvent[], start: Day, end: Day): WeekNumbers {
  const n: WeekNumbers = { quests: 0, chores: 0, xp: 0, coins: 0, gems: 0, activeDays: 0, exhibits: 0, buildings: 0 };
  const days = new Set<Day>();
  for (const e of events) {
    if (!isLive(e) || e.day < start || e.day > end) continue;
    if (isEarn(e)) {
      if (isChoreEvent(e)) n.chores++;
      else n.quests++;
      n.xp += e.xp;
      n.coins += e.coins;
      days.add(e.day);
    }
    if (e.gems > 0) n.gems += e.gems;
    if (e.kind === 'collect') n.exhibits++;
    if (e.kind === 'build' && e.gems < 0 && !e.refId.startsWith('land')) n.buildings++;
  }
  n.activeDays = days.size;
  return n;
}

function headline(w: WeekNumbers, p: WeekNumbers): string {
  const done = w.quests + w.chores;
  const before = p.quests + p.chores;
  if (done === 0) return 'A quiet week. Rest counts too; the book is ready whenever you are.';
  if (before > 0 && done > before) return `You did ${done - before} more than the week before. Lovely momentum.`;
  if (w.activeDays >= 5) return `You showed up on ${w.activeDays} days. That steadiness adds up.`;
  return `${done} ${done === 1 ? 'thing' : 'things'} done. Every one of them moved your story forward.`;
}

/** The report for the most recent complete week before `today` (or `today`'s week if `current`). */
export function weeklyReport(events: readonly LedgerEvent[], residents: readonly ResidentRow[], today: Day, current = false): WeeklyReport {
  const start = current ? weekStart(today) : addDays(weekStart(today), -7);
  const end = addDays(start, 6);
  const week = numbers(events, start, end);
  const previous = numbers(events, addDays(start, -7), addDays(start, -1));
  const perDay = new Map<Day, number>();
  for (const e of events) if (isLive(e) && isEarn(e) && e.day >= start && e.day <= end) perDay.set(e.day, (perDay.get(e.day) ?? 0) + 1);
  let bestDay: WeeklyReport['bestDay'] = null;
  for (const [day, count] of perDay) if (!bestDay || count > bestDay.count) bestDay = { label: WEEKDAY_SHORT[weekdayOf(day)]!, count };
  return {
    start,
    end,
    week,
    previous,
    bestDay,
    newResidents: residents.filter((r) => r.movedIn >= start && r.movedIn <= end).length,
    headline: headline(week, previous),
  };
}
