import { LAND_MAX_LEVEL } from './city';
import type { WingId } from './museum';

/*
 * What the one-time Premium unlock ($1, Google Play) adds. The free version is
 * a complete quest journal: quests, chores, the Journal, real-life treats and
 * a small town. Premium adds content and speed and never takes anything away:
 * whatever a player already owns stays theirs whether or not Premium is active.
 */

/** Museum wings included in the free version. The whole museum is a Premium feature. */
export const FREE_WINGS: ReadonlySet<WingId> = new Set<WingId>();
export const isPremiumWing = (wing: WingId): boolean => !FREE_WINGS.has(wing);

/** Free towns can grow to 6×6; Premium towns to 9×9. */
export const FREE_LAND_MAX_LEVEL = 2;
export const landCap = (premium: boolean): number => (premium ? LAND_MAX_LEVEL : FREE_LAND_MAX_LEVEL);

/** Premium towns grow three times faster: daily income ×3. */
export const PREMIUM_INCOME_MULTIPLIER = 3;
export const incomeFor = (base: number, premium: boolean): number => (premium ? base * PREMIUM_INCOME_MULTIPLIER : base);

/** Premium players level up faster: +50% XP on every completion (coins and gems are unchanged). */
export const PREMIUM_XP_MULTIPLIER = 1.5;
export const xpFor = (base: number, premium: boolean): number => (premium ? Math.round(base * PREMIUM_XP_MULTIPLIER) : base);

export const PREMIUM_PRICE_FALLBACK = '$0.99';

export type PremiumFeature = 'museum' | 'land' | 'building' | 'resident' | 'report' | 'xp' | 'general';

export const PREMIUM_PERKS: readonly { feature: PremiumFeature; text: string }[] = [
  { feature: 'museum', text: 'The museum: 30 collectible exhibits in five wings' },
  { feature: 'xp', text: 'Faster levelling: +50% XP on every quest and chore' },
  { feature: 'land', text: 'A bigger, faster town: up to 9×9 and triple daily income' },
  { feature: 'building', text: 'More to build: Observatory, Bathhouse and Guildhall' },
  { feature: 'resident', text: 'Unique residents: Ember the dragon, Luna the unicorn and Gale the griffin' },
  { feature: 'report', text: 'Weekly progress reports in your Journal' },
];

export const FEATURE_TITLE: Record<PremiumFeature, string> = {
  museum: 'The museum is part of Premium',
  land: 'Grow your town further with Premium',
  building: 'This building is part of Premium',
  resident: 'Unique residents come with Premium',
  report: 'Weekly reports are part of Premium',
  xp: 'Level up faster with Premium',
  general: 'QuestAday Premium',
};
