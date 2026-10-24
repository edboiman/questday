import { addDays, daysInMonth, parseDay, toDay, weekStart, weekdayOf, WEEKDAY_SHORT } from './dates';
import type { Day, Recurrence } from './types';

/*
 * Recurrence is intentionally simple and bounded: every calculation below is
 * O(1) or loops at most 7 times, so no rule can cause runaway work.
 *
 * A chore only ever has ONE pending occurrence (`nextDue`). Missed days do not
 * pile up: completing late schedules the next occurrence from the day you
 * actually did it.
 */

function monthlyOn(year: number, monthIndex: number, dayOfMonth: number): Day {
  const first = new Date(year, monthIndex, 1, 12);
  const y = first.getFullYear();
  const m = first.getMonth();
  return toDay(new Date(y, m, Math.min(dayOfMonth, daysInMonth(y, m)), 12));
}

/** First occurrence on or after `day`. Used when a chore is created, edited or resumed. */
export function nextOnOrAfter(rule: Recurrence, day: Day): Day {
  if (rule.kind === 'daily') return day;
  if (rule.kind === 'weekly') {
    for (let i = 0; i < 7; i++) {
      const d = addDays(day, i);
      if (rule.weekdays.includes(weekdayOf(d))) return d;
    }
    return day;
  }
  const d = parseDay(day);
  const thisMonth = monthlyOn(d.getFullYear(), d.getMonth(), rule.dayOfMonth);
  return thisMonth >= day ? thisMonth : monthlyOn(d.getFullYear(), d.getMonth() + 1, rule.dayOfMonth);
}

/** First occurrence strictly after `base`, honouring the interval. */
export function nextAfter(rule: Recurrence, base: Day): Day {
  const every = Math.max(1, Math.floor(rule.interval));
  if (rule.kind === 'daily') return addDays(base, every);
  if (rule.kind === 'weekly') {
    let found = addDays(base, 7);
    for (let i = 1; i <= 7; i++) {
      const d = addDays(base, i);
      if (rule.weekdays.includes(weekdayOf(d))) {
        found = d;
        break;
      }
    }
    // Rolling into a new week skips the "off" weeks of an every-N-weeks rule.
    return every > 1 && weekStart(found) !== weekStart(base) ? addDays(found, 7 * (every - 1)) : found;
  }
  const d = parseDay(base);
  const thisMonth = monthlyOn(d.getFullYear(), d.getMonth(), rule.dayOfMonth);
  return thisMonth > base ? thisMonth : monthlyOn(d.getFullYear(), d.getMonth() + every, rule.dayOfMonth);
}

/** Next due date after completing (or skipping) the occurrence due on `currentDue`. */
export function nextDueAfter(rule: Recurrence, currentDue: Day, doneOn: Day): Day {
  return nextAfter(rule, doneOn > currentDue ? doneOn : currentDue);
}

export function describeRecurrence(rule: Recurrence): string {
  const n = rule.interval;
  if (rule.kind === 'daily') return n === 1 ? 'Every day' : `Every ${n} days`;
  if (rule.kind === 'weekly') {
    const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => rule.weekdays.includes(d)).map((d) => WEEKDAY_SHORT[d]);
    const list = days.length === 7 ? 'every day' : days.join(', ');
    return n === 1 ? `Weekly · ${list}` : `Every ${n} weeks · ${list}`;
  }
  const dom = rule.dayOfMonth;
  const suffix = dom % 10 === 1 && dom !== 11 ? 'st' : dom % 10 === 2 && dom !== 12 ? 'nd' : dom % 10 === 3 && dom !== 13 ? 'rd' : 'th';
  return n === 1 ? `Monthly · ${dom}${suffix}` : `Every ${n} months · ${dom}${suffix}`;
}
