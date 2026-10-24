import './flags';

/*
 * The app's single source of "now". In the personal (admin) build, the admin
 * panel can shift it by whole days to test daily income, seasons and weekly
 * events. In the store build the offset code is removed and this is plain Date.
 */
function readStoredOffset(): number {
  try {
    const n = Number(localStorage.getItem('qa-admin-day-offset') ?? '0');
    return Number.isInteger(n) && Math.abs(n) <= 3650 ? n : 0;
  } catch {
    return 0;
  }
}

let offsetDays = __QA_ADMIN__ ? readStoredOffset() : 0;

export function now(): Date {
  return offsetDays ? new Date(Date.now() + offsetDays * 86_400_000) : new Date();
}

export function dayOffset(): number {
  return offsetDays;
}

/** Admin build only. Persisted so it survives the reload the admin panel triggers. */
export function setDayOffset(days: number): void {
  if (__QA_ADMIN__) storeOffset(days);
}

function storeOffset(days: number): void {
  offsetDays = Math.max(-3650, Math.min(3650, Math.trunc(days)));
  try {
    localStorage.setItem('qa-admin-day-offset', String(offsetDays));
  } catch {
    /* storage unavailable: the offset still applies until reload */
  }
}
