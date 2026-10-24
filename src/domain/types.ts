/** Local calendar day, formatted YYYY-MM-DD. */
export type Day = string;

export type Priority = 'low' | 'medium' | 'high';
export type TaskType = 'task' | 'chore' | 'project';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ThemePref = 'wildwood' | 'parchment' | 'nightfall' | 'hearth' | 'grove' | 'dark' | 'light' | 'system';
export type RewardIcon = 'gift' | 'gamepad' | 'film' | 'treat' | 'coffee' | 'book' | 'music' | 'star';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  /** Project name. Only meaningful when type is "project". */
  project: string;
  dueDate: Day | null;
  /** Day this quest was pinned to the daily list, if any. */
  focusDay: Day | null;
  priority: Priority | null;
  tag: string;
  estimateMin: number | null;
  subtasks: Subtask[];
  xp: number;
  completedAt: string | null;
  /** How many times this task has been completed. Makes ledger ids unique. */
  completionSeq: number;
  createdAt: string;
  updatedAt: string;
}

export interface Recurrence {
  kind: 'daily' | 'weekly' | 'monthly';
  /** Every N days / weeks / months. */
  interval: number;
  /** 0 = Sunday … 6 = Saturday. Used by weekly rules. */
  weekdays: number[];
  /** 1–31, clamped to the month length. Used by monthly rules. */
  dayOfMonth: number;
}

export interface Chore {
  id: string;
  title: string;
  description: string;
  recurrence: Recurrence;
  nextDue: Day;
  estimateMin: number | null;
  difficulty: Difficulty;
  xp: number;
  paused: boolean;
  completionSeq: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * The ledger. Every XP award and every reward redemption is one event.
 * Events are never edited or deleted; an undo sets `voidedAt`.
 * Level, balance, streaks and statistics are all derived from this table.
 */
export interface LedgerEvent {
  id: string;
  kind: 'task' | 'chore' | 'redeem' | 'collect' | 'build' | 'income' | 'event' | 'admin';
  /** Task, chore or reward id. */
  refId: string;
  /** Title at the time of the event, so history survives deletion. */
  title: string;
  taskType: TaskType | null;
  xp: number;
  /** Positive for earnings, negative for redemptions. */
  coins: number;
  /** City currency. Positive for earnings, negative for purchases. */
  gems: number;
  at: string;
  day: Day;
  /** For chores: the due date this completion satisfied (restored on undo). */
  prevDue: Day | null;
  voidedAt: string | null;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: RewardIcon;
  createdAt: string;
  updatedAt: string;
}

export interface Unlock {
  id: string;
  unlockedAt: string;
}

export interface Settings {
  playerName: string;
  theme: ThemePref;
  /** Coins earned per XP. */
  coinRate: number;
  /** Completions per week for the personal weekly challenge. */
  weeklyGoal: number;
  showStreak: boolean;
}

export const BUILDING_IDS = ['cottage', 'townhouse', 'bakery', 'market', 'cafe', 'boutique', 'park', 'fountain', 'library', 'gardens', 'carousel', 'cinema', 'ferris', 'blossom', 'lemonade', 'pumpkin', 'snowman', 'observatory', 'bathhouse', 'guildhall'] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

export const ROSTER_IDS = ['pip', 'mabel', 'otto', 'juno', 'rosa', 'bram', 'clover', 'fen', 'mina', 'hugo', 'ember', 'luna', 'gale'] as const;
export type ResidentId = (typeof ROSTER_IDS)[number];

/** A building standing on the map. Each is backed by a purchase in the ledger. */
export interface Building {
  id: string;
  type: BuildingId;
  x: number;
  y: number;
  placedAt: string;
}

export interface ResidentRow {
  id: ResidentId;
  movedIn: Day;
}

export interface CityMeta {
  /** 0 = starting plot; each expansion adds one row and column. */
  landLevel: number;
  /** Last day daily income was collected. */
  lastCollect: Day | null;
}

export interface City {
  buildings: Building[];
  residents: ResidentRow[];
  meta: CityMeta;
}

export const EMPTY_CITY: City = { buildings: [], residents: [], meta: { landLevel: 0, lastCollect: null } };

export interface Snapshot {
  tasks: Task[];
  chores: Chore[];
  events: LedgerEvent[];
  rewards: Reward[];
  achievements: Unlock[];
  settings: Settings;
  city: City;
}

export const DEFAULT_SETTINGS: Settings = {
  playerName: '',
  theme: 'wildwood',
  coinRate: 1,
  weeklyGoal: 15,
  showStreak: true,
};

export const EMPTY_SNAPSHOT: Snapshot = {
  tasks: [],
  chores: [],
  events: [],
  rewards: [],
  achievements: [],
  settings: DEFAULT_SETTINGS,
  city: EMPTY_CITY,
};
