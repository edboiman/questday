import type { Day } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export const toDay = (d: Date): Day => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parses a Day at local noon, which keeps day arithmetic safe across DST changes. */
export function parseDay(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0);
}

export function isValidDay(value: unknown): value is Day {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 1970 || year > 2200) return false;
  return toDay(parseDay(value)) === value;
}

export function addDays(day: Day, n: number): Day {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

/** a − b in whole days. */
export const diffDays = (a: Day, b: Day): number =>
  Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86_400_000);

/** 0 = Sunday … 6 = Saturday. */
export const weekdayOf = (day: Day): number => parseDay(day).getDay();

/** Monday of the week containing `day`. */
export const weekStart = (day: Day): Day => addDays(day, -((weekdayOf(day) + 6) % 7));

export const daysInMonth = (year: number, monthIndex: number): number => new Date(year, monthIndex + 1, 0).getDate();

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Friendly relative label: Today, Tomorrow, Fri, 12 Oct … */
export function formatDay(day: Day, today: Day): string {
  const delta = diffDays(day, today);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta === -1) return 'Yesterday';
  const d = parseDay(day);
  if (delta > 1 && delta < 7) return WEEKDAY_LONG[d.getDay()]!;
  const base = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  return d.getFullYear() === parseDay(today).getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function formatLongDate(day: Day): string {
  const d = parseDay(day);
  return `${WEEKDAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
