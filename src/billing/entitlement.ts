import type { EntitlementCheck } from './types';

/*
 * Decides what this device should believe about Premium after asking the store.
 * Pure, so every edge case is unit-tested (billing.test.ts).
 *
 *  - Store says active            → Premium on (purchase, restore, pending payment completed, new device).
 *  - Store says inactive          → if this device had a store purchase, it was refunded or revoked: turn off.
 *                                   An admin toggle (personal build) is never touched by the store.
 *  - Store unreachable (unknown)  → keep what we had. No network never takes Premium away, and never grants it.
 * Things the player already owns (exhibits, buildings, residents) always stay; only new Premium actions stop.
 */
export type DevicePremium = { active: boolean; source: 'play' | 'admin' | null };

export type Reconciled = { next: DevicePremium; change: 'unlocked' | 'revoked' | null };

export function reconcile(current: DevicePremium, check: EntitlementCheck): Reconciled {
  if (check.kind === 'unknown') return { next: current, change: null };
  if (check.kind === 'active') {
    if (current.active && current.source === 'play') return { next: current, change: null };
    if (current.active && current.source === 'admin') return { next: { active: true, source: 'play' }, change: null };
    return { next: { active: true, source: 'play' }, change: 'unlocked' };
  }
  // inactive
  if (current.active && current.source === 'play') return { next: { active: false, source: null }, change: 'revoked' };
  return { next: current, change: null };
}
