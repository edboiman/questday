/** Hard limits. Enforced in business logic and on import, not only in forms. */
export const LIMITS = {
  title: 120,
  description: 2000,
  tag: 30,
  project: 60,
  playerName: 40,
  subtasks: 30,
  maxXp: 500,
  /** Largest XP a single completion can award (maxXp with the Premium +50% boost). */
  maxEventXp: 750,
  /** Largest single admin adjustment (personal build only), per currency. */
  maxAdmin: 100_000,
  maxCost: 100_000,
  /** Largest single income or event payout, in gems. */
  maxPayout: 2_000,
  maxEstimateMin: 24 * 60,
  maxInterval: 365,
  minCoinRate: 0.1,
  maxCoinRate: 10,
  maxWeeklyGoal: 500,
  tasks: 5_000,
  chores: 500,
  rewards: 200,
  events: 50_000,
  /** Largest import file accepted, in characters (~5 MB). */
  importChars: 5_000_000,
} as const;
