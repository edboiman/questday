import { activeDays } from './stats';
import type { Day, LedgerEvent } from './types';

/** Rohld is a visiting friend, so his unlock never changes the saved city schema. */
export const ROHLD_UNLOCK_DAYS = 30;
export const ROHLD_ACHIEVEMENT_ID = 'rohld-visitor';

export function rohldProgress(events: readonly LedgerEvent[], alreadyUnlocked = false) {
  const days = activeDays(events).size;
  return {
    days: Math.min(days, ROHLD_UNLOCK_DAYS),
    remaining: Math.max(0, ROHLD_UNLOCK_DAYS - days),
    unlocked: alreadyUnlocked || days >= ROHLD_UNLOCK_DAYS,
  };
}

const ROHLD_LINES = [
  'I walked here at sunrise. The hills were wearing a little gold.',
  'I keep a tiny map of every good place I find. Your town made the page.',
  'A quiet day still counts as a day you showed up for.',
  'I brought a pebble from the coast. It looks like a sleepy potato.',
  'I am practicing my victory shuffle. The scarf makes it harder.',
  'The museum is lovely. I have been politely not touching the glass.',
  'I packed a snack for the road and somehow ate it before the road.',
  'There is a nice breeze by the fountain. I may stay a while.',
];

/** A stable line changes across visits and days without storing dialogue state. */
export function rohldLine(day: Day, visit: number): string {
  const dayKey = [...day].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const visitIndex = Number.isFinite(visit) ? Math.max(0, Math.floor(visit)) : 0;
  return ROHLD_LINES[(dayKey + visitIndex) % ROHLD_LINES.length]!;
}
