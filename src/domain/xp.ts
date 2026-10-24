import type { Difficulty } from './types';

/**
 * Level curve.
 *
 * Going from level L to L+1 costs 100 + 50·(L−1) XP:
 *   1→2: 100, 2→3: 150, 3→4: 200 …
 * so reaching level L needs 100·(L−1) + 25·(L−1)·(L−2) XP in total
 * (level 5 = 700 XP, level 10 = 2,700 XP).
 */
export const MAX_LEVEL = 999;

export const xpToNextLevel = (level: number): number => 100 + 50 * (level - 1);

export function totalXpForLevel(level: number): number {
  const n = level - 1;
  return 100 * n + 25 * n * (n - 1);
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP the current level spans. */
  span: number;
  /** XP still needed for the next level. */
  remaining: number;
  /** 0–1. */
  progress: number;
}

export function levelInfo(totalXp: number): LevelInfo {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  let level = 1;
  while (level < MAX_LEVEL && xp >= totalXpForLevel(level + 1)) level++;
  const intoLevel = xp - totalXpForLevel(level);
  const span = xpToNextLevel(level);
  return { level, totalXp: xp, intoLevel, span, remaining: Math.max(0, span - intoLevel), progress: Math.min(1, intoLevel / span) };
}

/** Spendable coins for an XP award. Lifetime XP is never spent. */
export const coinsFor = (xp: number, rate: number): number => Math.max(0, Math.round(xp * rate));

export const DIFFICULTY_XP: Record<Difficulty, number> = { easy: 10, medium: 15, hard: 25 };
export const DEFAULT_TASK_XP = 10;
export const XP_PRESETS = [5, 10, 15, 25, 50] as const;
