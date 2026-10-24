import { ADMIN_BUILD } from '../flags';
import { z } from 'zod';
import { ACHIEVEMENT_IDS } from './achievements';
import { LAND_MAX_LEVEL, legacyGems, MAX_LAND_SIZE } from './city';
import { isValidDay } from './dates';
import { LIMITS } from './limits';
import { exhibit, SPECIAL_DISCOUNT } from './museum';
import { BUILDING_IDS, ROSTER_IDS, type Building, type Chore, type City, type LedgerEvent, type ResidentRow, type Reward, type Settings, type Task, type Unlock } from './types';

/*
 * One schema per stored record. Records are validated:
 *   - before every write to storage (repo.ts), and
 *   - for every record in an imported file (transfer.ts).
 * All objects are strict: unknown keys (including "__proto__") are rejected.
 */

const id = z.string().regex(/^[A-Za-z0-9:_-]{1,96}$/, 'invalid id');
/** Ids of tasks, chores, rewards and steps. No ':' so they can never imitate a ledger id. */
const entityId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'invalid id');
const day = z.string().refine(isValidDay, 'invalid date');
const timestamp = z
  .string()
  .max(40)
  .refine((s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !Number.isNaN(Date.parse(s)), 'invalid timestamp');
const int = (min: number, max: number) => z.number().int().min(min).max(max);
const title = z.string().trim().min(1, 'A title is required').max(LIMITS.title);

export const subtaskSchema = z.object({ id: entityId, title, done: z.boolean() }).strict();

export const taskSchema: z.ZodType<Task> = z
  .object({
    id: entityId,
    title,
    description: z.string().max(LIMITS.description),
    type: z.enum(['task', 'chore', 'project']),
    project: z.string().trim().max(LIMITS.project),
    dueDate: day.nullable(),
    focusDay: day.nullable(),
    priority: z.enum(['low', 'medium', 'high']).nullable(),
    tag: z.string().trim().max(LIMITS.tag),
    estimateMin: int(1, LIMITS.maxEstimateMin).nullable(),
    subtasks: z.array(subtaskSchema).max(LIMITS.subtasks),
    xp: int(0, LIMITS.maxXp),
    completedAt: timestamp.nullable(),
    completionSeq: int(0, 1_000_000),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

export const recurrenceSchema = z
  .object({
    kind: z.enum(['daily', 'weekly', 'monthly']),
    interval: int(1, LIMITS.maxInterval),
    weekdays: z.array(int(0, 6)).max(7),
    dayOfMonth: int(1, 31),
  })
  .strict()
  .refine((r) => new Set(r.weekdays).size === r.weekdays.length, 'duplicate weekdays')
  .refine((r) => r.kind !== 'weekly' || r.weekdays.length > 0, 'Pick at least one weekday');

export const choreSchema: z.ZodType<Chore> = z
  .object({
    id: entityId,
    title,
    description: z.string().max(LIMITS.description),
    recurrence: recurrenceSchema,
    nextDue: day,
    estimateMin: int(1, LIMITS.maxEstimateMin).nullable(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    xp: int(0, LIMITS.maxXp),
    paused: z.boolean(),
    completionSeq: int(0, 1_000_000),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

const eventObject = z
  .object({
    id,
    kind: z.enum(['task', 'chore', 'redeem', 'collect', 'build', 'income', 'event', 'admin']),
    refId: entityId,
    title,
    taskType: z.enum(['task', 'chore', 'project']).nullable(),
    xp: int(-LIMITS.maxAdmin, LIMITS.maxAdmin),
    coins: int(-LIMITS.maxAdmin, LIMITS.maxAdmin),
    // Optional only so backups made before the city existed still import.
    gems: int(-LIMITS.maxAdmin, LIMITS.maxAdmin).optional(),
    at: timestamp,
    day,
    prevDue: day.nullable(),
    voidedAt: timestamp.nullable(),
  })
  .strict();

type RawEvent = z.infer<typeof eventObject>;

/**
 * Each kind of event may only move the balances it is allowed to move, and by
 * a bounded amount. A hand-edited file cannot mint XP, coins or gems that the
 * rules of the game do not allow.
 */
/** A museum purchase must have paid the full price or the daily-special price. */
function paidFor(exhibitId: string, paid: number): boolean {
  const x = exhibit(exhibitId);
  return x !== undefined && (paid === x.price || paid === Math.round(x.price * (1 - SPECIAL_DISCOUNT)));
}

function eventConsistent(e: RawEvent): boolean {
  const gems = e.gems;
  if (e.kind === 'admin') return ADMIN_BUILD && e.refId === 'admin' && gems !== undefined;
  // Outside admin entries, amounts stay within the game's normal bounds.
  if (e.xp < 0 || e.xp > LIMITS.maxEventXp || Math.abs(e.coins) > LIMITS.maxCost || e.coins > LIMITS.maxXp * LIMITS.maxCoinRate || (gems !== undefined && Math.abs(gems) > LIMITS.maxCost)) return false;
  switch (e.kind) {
    case 'task':
    case 'chore':
      return e.coins >= 0 && e.coins <= Math.round(e.xp * LIMITS.maxCoinRate) && (gems === undefined || (gems >= 0 && gems <= e.xp));
    case 'redeem':
      return e.xp === 0 && e.coins < 0 && (gems === undefined || gems === 0);
    case 'collect':
      return e.xp === 0 && e.coins < 0 && (gems === undefined || gems === 0) && e.id === `collect:${e.refId}` && paidFor(e.refId, -e.coins);
    case 'build':
      return e.xp === 0 && e.coins === 0 && gems !== undefined && gems !== 0;
    case 'income':
    case 'event':
      return e.xp === 0 && e.coins === 0 && gems !== undefined && gems > 0 && gems <= LIMITS.maxPayout;
  }
}

export const eventSchema: z.ZodType<LedgerEvent, z.ZodTypeDef, unknown> = eventObject
  .refine(eventConsistent, 'inconsistent XP, coin or gem amount')
  .transform((e): LedgerEvent => ({ ...e, gems: e.gems ?? legacyGems(e) }));

export const rewardSchema: z.ZodType<Reward> = z
  .object({
    id: entityId,
    name: title,
    description: z.string().max(LIMITS.description),
    cost: int(1, LIMITS.maxCost),
    icon: z.enum(['gift', 'gamepad', 'film', 'treat', 'coffee', 'book', 'music', 'star']),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

export const unlockSchema: z.ZodType<Unlock> = z
  .object({ id: id.refine((v) => ACHIEVEMENT_IDS.has(v), 'unknown achievement'), unlockedAt: timestamp })
  .strict();

export const settingsSchema: z.ZodType<Settings> = z
  .object({
    playerName: z.string().trim().max(LIMITS.playerName),
    theme: z.enum(['wildwood', 'parchment', 'nightfall', 'hearth', 'grove', 'dark', 'light', 'system']),
    coinRate: z.number().min(LIMITS.minCoinRate).max(LIMITS.maxCoinRate),
    weeklyGoal: int(1, LIMITS.maxWeeklyGoal),
    showStreak: z.boolean(),
  })
  .strict();

export const buildingSchema: z.ZodType<Building> = z
  .object({ id: entityId, type: z.enum(BUILDING_IDS), x: int(0, MAX_LAND_SIZE - 1), y: int(0, MAX_LAND_SIZE - 1), placedAt: timestamp })
  .strict();

export const residentSchema: z.ZodType<ResidentRow> = z.object({ id: z.enum(ROSTER_IDS), movedIn: day }).strict();

export const cityMetaSchema = z.object({ landLevel: int(0, LAND_MAX_LEVEL), lastCollect: day.nullable() }).strict();

export const citySchema: z.ZodType<City> = z
  .object({
    buildings: z.array(buildingSchema).max(MAX_LAND_SIZE * MAX_LAND_SIZE),
    residents: z.array(residentSchema).max(ROSTER_IDS.length),
    meta: cityMetaSchema,
  })
  .strict();

export const EXPORT_FORMAT = 'questday-export';
export const EXPORT_VERSION = 1;

export const exportSchema = z
  .object({
    format: z.literal(EXPORT_FORMAT),
    version: z.literal(EXPORT_VERSION),
    exportedAt: timestamp,
    data: z
      .object({
        tasks: z.array(taskSchema).max(LIMITS.tasks),
        chores: z.array(choreSchema).max(LIMITS.chores),
        events: z.array(eventSchema).max(LIMITS.events),
        rewards: z.array(rewardSchema).max(LIMITS.rewards),
        achievements: z.array(unlockSchema).max(ACHIEVEMENT_IDS.size),
        settings: settingsSchema,
        // Optional so backups from before the city existed still import.
        city: citySchema.optional(),
      })
      .strict(),
  })
  .strict();

export type ExportFile = z.infer<typeof exportSchema>;

/** Short, content-free description of a validation failure. */
export function describeIssues(error: z.ZodError, max = 4): string[] {
  return error.issues.slice(0, max).map((i) => {
    const where = i.path.length ? `${i.path.join('.')}: ` : '';
    // zod's default text for some issues echoes the offending value; keep those generic.
    const message = i.code === 'invalid_enum_value' || i.code === 'invalid_literal' || i.code === 'unrecognized_keys' ? i.code.replace(/_/g, ' ') : i.message;
    return `${where}${message}`;
  });
}
