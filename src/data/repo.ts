import { z } from 'zod';
import { satisfied } from '../domain/achievements';
import { BUILDINGS, canWelcome, cityStats, eventProgress, gemsFor, LAND_COSTS, LAND_MAX_LEVEL, landSize, legacyGems, lockReason, MAX_INCOME_DAYS, nextResident, sellValue, seasonOf, weeklyEvent, type RosterEntry } from '../domain/city';
import { diffDays, isValidDay, toDay } from '../domain/dates';
import { now as appNow } from '../clock';
import { ADMIN_BUILD } from '../flags';
import { LIMITS } from '../domain/limits';
import { incomeFor, landCap, xpFor } from '../domain/premium';
import { collectId, exhibit, exhibitLock, owned, priceOf, WING_BONUS, wingBonusId, wingComplete, WINGS } from '../domain/museum';
import { nextAfter, nextDueAfter, nextOnOrAfter } from '../domain/recurrence';
import { buildingSchema, choreSchema, cityMetaSchema, citySchema, describeIssues, eventSchema, recurrenceSchema, residentSchema, rewardSchema, settingsSchema, taskSchema, unlockSchema } from '../domain/schema';
import { balanceOf, gemBalance, totals } from '../domain/stats';
import {
  DEFAULT_SETTINGS,
  EMPTY_CITY,
  type Building,
  type BuildingId,
  type Chore,
  type City,
  type CityMeta,
  type Day,
  type LedgerEvent,
  type Reward,
  type Settings,
  type Snapshot,
  type Task,
} from '../domain/types';
import { coinsFor, DEFAULT_TASK_XP, DIFFICULTY_XP, levelInfo } from '../domain/xp';
import { newId } from './ids';
import type { Storage, Tx } from './storage';
import { integrityErrors } from './transfer';

export type ErrorCode = 'invalid' | 'not-found' | 'limit' | 'insufficient' | 'spent' | 'premium';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export type TaskFields = Pick<Task, 'title' | 'description' | 'type' | 'project' | 'dueDate' | 'focusDay' | 'priority' | 'tag' | 'estimateMin' | 'subtasks' | 'xp'>;
export type TaskDraft = Partial<TaskFields> & { title: string };
export type ChoreFields = Pick<Chore, 'title' | 'description' | 'recurrence' | 'estimateMin' | 'difficulty' | 'xp' | 'paused'>;
export type ChoreDraft = Partial<ChoreFields> & Pick<Chore, 'title' | 'recurrence'> & { nextDue?: Day };
export type RewardFields = Pick<Reward, 'name' | 'description' | 'cost' | 'icon'>;

interface SettingsRow {
  id: 'settings';
  value: Settings;
}

/** Validates a record against its schema; all writes go through here. */
function check<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('invalid', describeIssues(parsed.error, 1)[0] ?? 'Invalid data');
  return parsed.data;
}

async function readSettings(tx: Tx): Promise<Settings> {
  const row = await tx.get<SettingsRow>('meta', 'settings');
  const parsed = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(row?.value ?? {}) });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

/** Keeps only rows that still match their schema. */
function valid<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, rows: unknown[]): T[] {
  const out: T[] = [];
  for (const row of rows) {
    const parsed = schema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Which balances each kind of event may move. Mirrors the import schema. */
function saneAmounts(kind: unknown, xp: number, coins: number, gems: unknown): boolean {
  if (kind === 'admin') return ADMIN_BUILD && typeof gems === 'number' && Number.isInteger(gems) && Math.abs(gems) <= LIMITS.maxAdmin && Math.abs(xp) <= LIMITS.maxAdmin && Math.abs(coins) <= LIMITS.maxAdmin;
  if (xp < 0 || xp > LIMITS.maxEventXp || Math.abs(coins) > LIMITS.maxCost) return false;
  if (gems !== undefined && (typeof gems !== 'number' || !Number.isInteger(gems) || Math.abs(gems) > LIMITS.maxCost)) return false;
  const g = gems as number | undefined;
  switch (kind) {
    case 'task':
    case 'chore':
      return coins >= 0 && (g === undefined || (g >= 0 && g <= xp));
    case 'redeem':
    case 'collect':
      return xp === 0 && coins < 0 && (g === undefined || g === 0);
    case 'build':
      return xp === 0 && coins === 0 && g !== undefined && g !== 0;
    default: // income, event
      return xp === 0 && coins === 0 && g !== undefined && g > 0 && g <= LIMITS.maxPayout;
  }
}

/** Fast structural check for ledger rows (there can be tens of thousands). */
function saneEvent(row: unknown): row is LedgerEvent {
  if (!row || typeof row !== 'object') return false;
  const e = row as Record<string, unknown>;
  const xp = e.xp;
  const coins = e.coins;
  return (
    typeof e.id === 'string' &&
    (e.kind === 'task' || e.kind === 'chore' || e.kind === 'redeem' || e.kind === 'collect' || e.kind === 'build' || e.kind === 'income' || e.kind === 'event' || e.kind === 'admin') &&
    typeof e.refId === 'string' &&
    typeof e.title === 'string' &&
    typeof xp === 'number' && Number.isInteger(xp) &&
    typeof coins === 'number' && Number.isInteger(coins) &&
    saneAmounts(e.kind, xp, coins, e.gems) &&
    typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)) &&
    isValidDay(e.day) &&
    (e.voidedAt === null || typeof e.voidedAt === 'string') &&
    (e.taskType === null || e.taskType === 'task' || e.taskType === 'chore' || e.taskType === 'project') &&
    (e.prevDue === null || isValidDay(e.prevDue))
  );
}

/**
 * Stored data is a trust boundary too: a crash mid-write, a browser bug or
 * another program could leave a damaged row behind. Damaged rows are ignored
 * on read (never executed, never rendered, never counted) instead of being
 * allowed to break the app or distort XP.
 */
async function readSnapshot(tx: Tx): Promise<Snapshot> {
  return {
    tasks: valid(taskSchema, await tx.all('tasks')),
    chores: valid(choreSchema, await tx.all('chores')),
    events: await readEvents(tx),
    rewards: valid(rewardSchema, await tx.all('rewards')),
    achievements: valid(unlockSchema, await tx.all('achievements')),
    settings: await readSettings(tx),
    city: await readCity(tx),
  };
}

/** Rows written before the city existed have no gems; they are given the gems they would have earned. */
function normalise(e: LedgerEvent): LedgerEvent {
  return typeof e.gems === 'number' ? e : { ...e, gems: legacyGems(e) };
}

async function readEvents(tx: Tx): Promise<LedgerEvent[]> {
  return (await tx.all('events')).filter(saneEvent).map(normalise);
}

interface CityMetaRow {
  id: 'city';
  value: CityMeta;
}

async function readCity(tx: Tx): Promise<City> {
  const meta = cityMetaSchema.safeParse((await tx.get<CityMetaRow>('meta', 'city'))?.value);
  return {
    buildings: valid(buildingSchema, await tx.all('city')),
    residents: valid(residentSchema, await tx.all('residents')),
    meta: meta.success ? meta.data : EMPTY_CITY.meta,
  };
}

const PREMIUM_ROW = 'premium';
interface PremiumRow {
  id: typeof PREMIUM_ROW;
  value: { active: boolean; source: 'play' | 'admin'; at: string };
}

/** Whether the Premium unlock is active on this device. Anything malformed counts as "no". */
async function readPremium(tx: Tx): Promise<boolean> {
  const row = await tx.get<PremiumRow>('meta', PREMIUM_ROW);
  const v = row?.value;
  if (!v || v.active !== true) return false;
  return v.source === 'play' || (v.source === 'admin' && ADMIN_BUILD);
}

/** Module-level (not a class method) so the store build can drop it entirely. */
function adminAdjustTx(storage: Storage, clock: () => Date, delta: { xp: number; coins: number; gems: number }): Promise<LedgerEvent> {
    return storage.tx('rw', async (tx) => {
      const events = await readEvents(tx);
      const t = totals(events);
      const xp = Math.trunc(delta.xp) || 0;
      const coins = Math.trunc(delta.coins) || 0;
      const gems = Math.trunc(delta.gems) || 0;
      if (!xp && !coins && !gems) throw new AppError('invalid', 'Nothing to change.');
      if (t.xp + xp < 0 || t.balance + coins < 0 || gemBalance(events) + gems < 0) throw new AppError('invalid', 'That would take a balance below zero.');
      const now = clock();
      const event = check(eventSchema, {
        id: `admin:${newId()}`,
        kind: 'admin',
        refId: 'admin',
        title: 'Admin adjustment',
        taskType: null,
        xp,
        coins,
        gems,
        at: now.toISOString(),
        day: toDay(now),
        prevDue: null,
        voidedAt: null,
      });
      await tx.add('events', event);
      return event;
    });
  }

/** Moves in the next resident if there is a free home and the town is content. At most one per call. */
async function welcome(tx: Tx, today: Day): Promise<RosterEntry | null> {
  const city = await readCity(tx);
  const premium = await readPremium(tx);
  if (!canWelcome(city.buildings, city.residents.length, premium)) return null;
  const next = nextResident(city.residents, premium);
  if (!next) return null;
  await tx.put('residents', check(residentSchema, { id: next.id, movedIn: today }));
  return next;
}

/** Homes that would remain after removing `building`, compared with the people who live in the town. */
function homesAfterRemoving(city: City, building: Building): number {
  return cityStats(city.buildings.filter((b) => b.id !== building.id), city.residents.length).housing;
}

export interface CollectResult {
  event: LedgerEvent;
  /** The wing's gem bonus, if this purchase completed a wing. */
  bonus: LedgerEvent | null;
}

export interface BuildResult {
  event: LedgerEvent;
  building: Building;
  arrived: RosterEntry | null;
}

/** Next free ledger sequence number for a task or chore. */
async function freeSeq(tx: Tx, prefix: string, after: number): Promise<number> {
  let seq = after + 1;
  while (seq < 1_000_000 && (await tx.get('events', `${prefix}:${seq}`))) seq++;
  return seq;
}

/**
 * All application writes. Each method is one atomic transaction, so a repeated
 * tap, a second tab or a crash mid-way can never award XP twice or leave a
 * half-applied change.
 *
 * XP POLICY
 *  - Completing a task or chore occurrence adds exactly one ledger event.
 *  - Completing something already complete is a no-op.
 *  - Reopening a task (or undoing a chore) voids that event: its XP and coins
 *    are withdrawn. Completing again creates a fresh event, so the net effect
 *    of complete → reopen → complete is a single award.
 *  - A completion whose coins have already been spent cannot be undone, which
 *    keeps the balance from ever going negative.
 *  - Editing a task's XP after completion does not change what was awarded.
 *  - Deleting a completed task or chore keeps its ledger history and XP.
 */
export class Repo {
  constructor(
    private storage: Storage,
    private clock: () => Date = appNow,
  ) {}

  snapshot(): Promise<Snapshot> {
    return this.storage.tx('r', readSnapshot);
  }

  // ------------------------------------------------------------------ tasks

  addTask(draft: TaskDraft, id: string = newId()): Promise<Task> {
    return this.storage.tx('rw', async (tx) => {
      if ((await tx.all('tasks')).length >= LIMITS.tasks) throw new AppError('limit', 'Task limit reached. Delete some completed quests first.');
      const now = this.clock().toISOString();
      const task = check(taskSchema, {
        id,
        title: draft.title,
        description: draft.description ?? '',
        type: draft.type ?? 'task',
        project: draft.type === 'project' ? (draft.project ?? '') : '',
        dueDate: draft.dueDate ?? null,
        focusDay: draft.focusDay ?? null,
        priority: draft.priority ?? null,
        tag: draft.tag ?? '',
        estimateMin: draft.estimateMin ?? null,
        subtasks: draft.subtasks ?? [],
        xp: draft.xp ?? DEFAULT_TASK_XP,
        completedAt: null,
        completionSeq: 0,
        createdAt: now,
        updatedAt: now,
      });
      await tx.add('tasks', task);
      return task;
    });
  }

  updateTask(id: string, patch: Partial<TaskFields>): Promise<Task> {
    return this.storage.tx('rw', async (tx) => {
      const current = await tx.get<Task>('tasks', id);
      if (!current) throw new AppError('not-found', 'That quest no longer exists.');
      const merged = { ...current, ...pick(patch, TASK_KEYS), updatedAt: this.clock().toISOString() };
      if (merged.type !== 'project') merged.project = '';
      const task = check(taskSchema, merged);
      await tx.put('tasks', task);
      return task;
    });
  }

  deleteTask(id: string): Promise<void> {
    return this.storage.tx('rw', (tx) => tx.del('tasks', id));
  }

  /** Returns the award, or null if the task was already complete (no XP is granted twice). */
  completeTask(id: string): Promise<LedgerEvent | null> {
    return this.storage.tx('rw', async (tx) => {
      const task = valid(taskSchema, [await tx.get('tasks', id)])[0];
      if (!task || task.completedAt) return null;
      const now = this.clock();
      const seq = await freeSeq(tx, `task:${task.id}`, task.completionSeq);
      const settings = await readSettings(tx);
      const gems = await this.gemsForCompletion(tx, task.xp);
      const event = check(eventSchema, {
        id: `task:${task.id}:${seq}`,
        kind: 'task',
        refId: task.id,
        title: task.title,
        taskType: task.type,
        xp: xpFor(task.xp, await readPremium(tx)),
        coins: coinsFor(task.xp, settings.coinRate),
        gems,
        at: now.toISOString(),
        day: toDay(now),
        prevDue: null,
        voidedAt: null,
      });
      await tx.add('events', event); // unique id: a duplicate aborts the whole transaction
      await tx.put('tasks', { ...task, completedAt: now.toISOString(), completionSeq: seq, updatedAt: now.toISOString() });
      return event;
    });
  }

  /** Reopens a task and withdraws the XP from its last completion. */
  reopenTask(id: string): Promise<void> {
    return this.storage.tx('rw', async (tx) => {
      const task = await tx.get<Task>('tasks', id);
      if (!task || !task.completedAt) return;
      const now = this.clock().toISOString();
      await this.voidEvent(tx, `task:${task.id}:${task.completionSeq}`, now);
      await tx.put('tasks', { ...task, completedAt: null, updatedAt: now });
    });
  }

  toggleSubtask(taskId: string, subtaskId: string): Promise<void> {
    return this.storage.tx('rw', async (tx) => {
      const task = await tx.get<Task>('tasks', taskId);
      if (!task) return;
      const subtasks = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
      await tx.put('tasks', check(taskSchema, { ...task, subtasks, updatedAt: this.clock().toISOString() }));
    });
  }

  // ----------------------------------------------------------------- chores

  addChore(draft: ChoreDraft, id: string = newId()): Promise<Chore> {
    return this.storage.tx('rw', async (tx) => {
      if ((await tx.all('chores')).length >= LIMITS.chores) throw new AppError('limit', 'Chore limit reached.');
      const now = this.clock();
      const difficulty = draft.difficulty ?? 'medium';
      const recurrence = check(recurrenceSchema, draft.recurrence);
      const chore = check(choreSchema, {
        id,
        title: draft.title,
        description: draft.description ?? '',
        recurrence,
        nextDue: draft.nextDue ?? nextOnOrAfter(recurrence, toDay(now)),
        estimateMin: draft.estimateMin ?? null,
        difficulty,
        xp: draft.xp ?? DIFFICULTY_XP[difficulty],
        paused: draft.paused ?? false,
        completionSeq: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      await tx.add('chores', chore);
      return chore;
    });
  }

  /**
   * Edits a chore definition. Completion history lives in the ledger and is
   * never touched. Changing the schedule (or resuming) recalculates the next
   * due date from today.
   */
  updateChore(id: string, patch: Partial<ChoreFields>): Promise<Chore> {
    return this.storage.tx('rw', async (tx) => {
      const current = await tx.get<Chore>('chores', id);
      if (!current) throw new AppError('not-found', 'That chore no longer exists.');
      const now = this.clock();
      const today = toDay(now);
      const merged = check(choreSchema, { ...current, ...pick(patch, CHORE_KEYS), updatedAt: now.toISOString() });
      const scheduleChanged = JSON.stringify(merged.recurrence) !== JSON.stringify(current.recurrence);
      const resumed = current.paused && !merged.paused;
      if (scheduleChanged || (resumed && merged.nextDue < today)) merged.nextDue = nextOnOrAfter(merged.recurrence, today);
      await tx.put('chores', merged);
      return merged;
    });
  }

  deleteChore(id: string): Promise<void> {
    return this.storage.tx('rw', (tx) => tx.del('chores', id));
  }

  /**
   * Completes the occurrence due on `expectedDue`. If the chore has already
   * moved on (a repeated tap, another tab) this is a no-op and returns null.
   */
  completeChore(id: string, expectedDue: Day): Promise<LedgerEvent | null> {
    return this.storage.tx('rw', async (tx) => {
      const chore = valid(choreSchema, [await tx.get('chores', id)])[0];
      if (!chore || chore.paused || chore.nextDue !== expectedDue) return null;
      const now = this.clock();
      const today = toDay(now);
      const seq = await freeSeq(tx, `chore:${chore.id}`, chore.completionSeq);
      const settings = await readSettings(tx);
      const gems = await this.gemsForCompletion(tx, chore.xp);
      const event = check(eventSchema, {
        id: `chore:${chore.id}:${seq}`,
        kind: 'chore',
        refId: chore.id,
        title: chore.title,
        taskType: null,
        xp: xpFor(chore.xp, await readPremium(tx)),
        coins: coinsFor(chore.xp, settings.coinRate),
        gems,
        at: now.toISOString(),
        day: today,
        prevDue: chore.nextDue,
        voidedAt: null,
      });
      await tx.add('events', event);
      await tx.put('chores', {
        ...chore,
        nextDue: nextDueAfter(chore.recurrence, chore.nextDue, today),
        completionSeq: seq,
        updatedAt: now.toISOString(),
      });
      return event;
    });
  }

  /** Moves a chore to its next occurrence without awarding or penalising anything. */
  skipChore(id: string, expectedDue: Day): Promise<void> {
    return this.storage.tx('rw', async (tx) => {
      const chore = await tx.get<Chore>('chores', id);
      if (!chore || chore.nextDue !== expectedDue) return;
      const now = this.clock();
      await tx.put('chores', { ...chore, nextDue: nextAfter(chore.recurrence, maxDay(chore.nextDue, toDay(now))), updatedAt: now.toISOString() });
    });
  }

  // ----------------------------------------------------------------- ledger

  private async voidEvent(tx: Tx, eventId: string, now: string): Promise<LedgerEvent | null> {
    const row = await tx.get('events', eventId);
    const event = saneEvent(row) ? normalise(row) : undefined;
    if (!event || event.voidedAt) return null;
    if (event.coins > 0 || event.gems > 0 || event.xp > 0) {
      const events = await readEvents(tx);
      if (event.xp > 0 && totals(events).xp - event.xp < 0) throw new AppError('spent', 'That can’t be undone.');
      if (event.coins > 0 && balanceOf(events) - event.coins < 0) {
        throw new AppError('spent', 'The coins from this have already been spent, so it can’t be undone.');
      }
      if (event.gems > 0 && gemBalance(events) - event.gems < 0) {
        throw new AppError('spent', 'The gems from this have already been spent, so it can’t be undone.');
      }
    }
    const voided = { ...event, voidedAt: now };
    await tx.put('events', voided);
    return voided;
  }

  /** Undo for the "+XP" toast: reopens a task, rewinds a chore, or refunds a redemption. */
  undoEvent(eventId: string): Promise<void> {
    return this.storage.tx('rw', async (tx) => {
      const now = this.clock().toISOString();
      const peek = await tx.get('events', eventId);
      if (saneEvent(peek) && !peek.voidedAt) {
        const purchase = peek.kind === 'build' && normalise(peek).gems < 0 && !peek.refId.startsWith('land');
        if (peek.kind === 'income' || peek.kind === 'event' || peek.kind === 'collect' || peek.kind === 'admin' || (peek.kind === 'build' && !purchase)) {
          throw new AppError('invalid', 'That can’t be undone.');
        }
        if (purchase) {
          // Only a building that is still standing can be taken back; otherwise a sale would be refunded twice.
          const city = await readCity(tx);
          const building = city.buildings.find((x) => x.id === peek.refId);
          if (!building) throw new AppError('invalid', 'That building is already gone.');
          if (homesAfterRemoving(city, building) < city.residents.length) throw new AppError('invalid', 'Residents live there. Build another home first.');
        }
      }
      const event = await this.voidEvent(tx, eventId, now);
      if (!event) return;
      if (event.kind === 'build') {
        await tx.del('city', event.refId);
        return;
      }
      if (event.kind === 'task') {
        const task = await tx.get<Task>('tasks', event.refId);
        if (task && task.completedAt && event.id === `task:${task.id}:${task.completionSeq}`) {
          await tx.put('tasks', { ...task, completedAt: null, updatedAt: now });
        }
      } else if (event.kind === 'chore' && event.prevDue) {
        const chore = await tx.get<Chore>('chores', event.refId);
        if (chore && event.id === `chore:${chore.id}:${chore.completionSeq}`) {
          await tx.put('chores', { ...chore, nextDue: event.prevDue, updatedAt: now });
        }
      }
    });
  }

  // ---------------------------------------------------------------- rewards

  addReward(fields: RewardFields, id: string = newId()): Promise<Reward> {
    return this.storage.tx('rw', async (tx) => {
      if ((await tx.all('rewards')).length >= LIMITS.rewards) throw new AppError('limit', 'Reward limit reached.');
      const now = this.clock().toISOString();
      const reward = check(rewardSchema, { id, ...pick(fields, REWARD_KEYS), createdAt: now, updatedAt: now });
      await tx.add('rewards', reward);
      return reward;
    });
  }

  updateReward(id: string, patch: Partial<RewardFields>): Promise<Reward> {
    return this.storage.tx('rw', async (tx) => {
      const current = await tx.get<Reward>('rewards', id);
      if (!current) throw new AppError('not-found', 'That reward no longer exists.');
      const reward = check(rewardSchema, { ...current, ...pick(patch, REWARD_KEYS), updatedAt: this.clock().toISOString() });
      await tx.put('rewards', reward);
      return reward;
    });
  }

  deleteReward(id: string): Promise<void> {
    return this.storage.tx('rw', (tx) => tx.del('rewards', id));
  }

  /** Spends coins on a reward. The balance check and the spend are one transaction. */
  redeem(rewardId: string): Promise<LedgerEvent> {
    return this.storage.tx('rw', async (tx) => {
      const reward = valid(rewardSchema, [await tx.get('rewards', rewardId)])[0];
      if (!reward) throw new AppError('not-found', 'That reward no longer exists.');
      const balance = balanceOf(await readEvents(tx));
      if (balance < reward.cost) throw new AppError('insufficient', `You need ${reward.cost - balance} more coins for that.`);
      const now = this.clock();
      const event = check(eventSchema, {
        id: `redeem:${newId()}`,
        kind: 'redeem',
        refId: reward.id,
        title: reward.name,
        taskType: null,
        xp: 0,
        coins: -reward.cost,
        gems: 0,
        at: now.toISOString(),
        day: toDay(now),
        prevDue: null,
        voidedAt: null,
      });
      await tx.add('events', event);
      return event;
    });
  }

  // ---------------------------------------------------------------- premium

  isPremium(): Promise<boolean> {
    return this.storage.tx('r', (tx) => readPremium(tx));
  }

  /** What this device believes about Premium and where that came from (for reconciling with the store). */
  premiumState(): Promise<{ active: boolean; source: 'play' | 'admin' | null }> {
    return this.storage.tx('r', async (tx) => {
      const v = (await tx.get<PremiumRow>('meta', PREMIUM_ROW))?.value;
      const active = await readPremium(tx);
      return { active, source: active ? (v?.source ?? null) : null };
    });
  }

  /**
   * Turns Premium on or off on this device. `play` is for the (future) Google
   * Play Billing flow, after the server has verified the purchase; `admin` is
   * only honoured in the personal build, so a store build can't be unlocked
   * by calling it.
   */
  setPremium(active: boolean, source: 'play' | 'admin'): Promise<void> {
    if (source === 'admin' && !ADMIN_BUILD) return Promise.reject(new AppError('invalid', 'Not available.'));
    return this.storage.tx('rw', async (tx) => {
      await tx.put('meta', { id: PREMIUM_ROW, value: { active, source, at: this.clock().toISOString() } } satisfies PremiumRow);
    });
  }

  // ------------------------------------------------------------------ admin

  /**
   * Personal build only: adds or removes XP, coins and gems with one clearly
   * marked ledger entry. Balances may not go below zero. Store builds refuse
   * this, and refuse to import backups that contain admin entries.
   */
  adminAdjust(delta: { xp: number; coins: number; gems: number }): Promise<LedgerEvent> {
    return __QA_ADMIN__ ? adminAdjustTx(this.storage, this.clock, delta) : Promise.reject(new AppError('invalid', 'Not available.'));
  }

  // ----------------------------------------------------------------- museum

  /**
   * Buys an exhibit with coins. Exhibits are one of a kind: the ledger id is
   * the exhibit id, so a double tap or a second tab cannot buy it twice.
   * Completing a wing pays its gem bonus to the town in the same transaction.
   * Purchases are final (they are confirmed first), like a real museum's.
   */
  collect(exhibitId: string): Promise<CollectResult> {
    return this.storage.tx('rw', async (tx) => {
      const x = exhibit(exhibitId);
      if (!x) throw new AppError('invalid', 'That exhibit doesn’t exist.');
      const events = await readEvents(tx);
      const have = owned(events);
      if (have.has(x.id) || (await tx.get('events', collectId(x.id)))) throw new AppError('invalid', 'That exhibit is already in your museum.');
      const premium = await readPremium(tx);
      const lock = exhibitLock(x, have, premium);
      if (lock) throw new AppError('invalid', `${x.name}: ${lock.charAt(0).toLowerCase()}${lock.slice(1)}.`);
      const now = this.clock();
      const today = toDay(now);
      const price = priceOf(x, today, have, premium);
      const balance = balanceOf(events);
      if (balance < price) throw new AppError('insufficient', `You need ${price - balance} more coins for that.`);
      const event = check(eventSchema, {
        id: collectId(x.id),
        kind: 'collect',
        refId: x.id,
        title: x.name,
        taskType: null,
        xp: 0,
        coins: -price,
        gems: 0,
        at: now.toISOString(),
        day: today,
        prevDue: null,
        voidedAt: null,
      });
      await tx.add('events', event);
      have.set(x.id, event);
      let bonus: LedgerEvent | null = null;
      const wing = WINGS.find((w) => w.id === x.wing)!;
      if (wingComplete(wing.id, have) && !(await tx.get('events', wingBonusId(wing.id)))) {
        bonus = check(eventSchema, {
          id: wingBonusId(wing.id),
          kind: 'event',
          refId: 'museum',
          title: `${wing.name} complete`,
          taskType: null,
          xp: 0,
          coins: 0,
          gems: WING_BONUS,
          at: now.toISOString(),
          day: today,
          prevDue: null,
          voidedAt: null,
        });
        await tx.add('events', bonus);
      }
      return { event, bonus };
    });
  }

  // ------------------------------------------------------------------- city

  /** Gems for a completion, including the harmony bonus from the town's current balance. */
  private async gemsForCompletion(tx: Tx, xp: number): Promise<number> {
    const city = await readCity(tx);
    return gemsFor(xp, cityStats(city.buildings, city.residents.length).multiplier);
  }

  /**
   * Buys a building and places it, in one transaction. The checks (level,
   * season, land, free tile, balance) and the spend cannot be separated, so a
   * double tap or a second tab cannot overspend or double-place.
   */
  build(type: BuildingId, x: number, y: number): Promise<BuildResult> {
    return this.storage.tx('rw', async (tx) => {
      if (!Object.prototype.hasOwnProperty.call(BUILDINGS, type)) throw new AppError('invalid', 'That isn’t something you can build.');
      const def = BUILDINGS[type];
      const now = this.clock();
      const today = toDay(now);
      const events = await readEvents(tx);
      const city = await readCity(tx);
      const locked = lockReason(def, levelInfo(totals(events).xp).level, seasonOf(today), await readPremium(tx));
      if (locked === 'Premium') throw new AppError('premium', `${def.name} is part of Premium.`);
      if (locked) throw new AppError('invalid', `${def.name}: ${locked.charAt(0).toLowerCase()}${locked.slice(1)}.`);
      const size = landSize(city.meta.landLevel);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) throw new AppError('invalid', 'That tile isn’t part of your land yet.');
      if (city.buildings.some((b) => b.x === x && b.y === y)) throw new AppError('invalid', 'That tile is already taken.');
      const gems = gemBalance(events);
      if (gems < def.cost) throw new AppError('insufficient', `You need ${def.cost - gems} more gems for that.`);
      const building = check(buildingSchema, { id: newId(), type, x, y, placedAt: now.toISOString() });
      const event = check(eventSchema, {
        id: `build:${building.id}`,
        kind: 'build',
        refId: building.id,
        title: `Built ${def.name}`,
        taskType: null,
        xp: 0,
        coins: 0,
        gems: -def.cost,
        at: now.toISOString(),
        day: today,
        prevDue: null,
        voidedAt: null,
      });
      await tx.add('events', event);
      await tx.add('city', building);
      return { event, building, arrived: await welcome(tx, today) };
    });
  }

  /** Sells a building back for half its price. A home cannot be sold while residents would be left without one. */
  sellBuilding(id: string): Promise<LedgerEvent> {
    return this.storage.tx('rw', async (tx) => {
      const building = valid(buildingSchema, [await tx.get('city', id)])[0];
      if (!building) throw new AppError('not-found', 'That building is already gone.');
      const def = BUILDINGS[building.type];
      const city = await readCity(tx);
      if (homesAfterRemoving(city, building) < city.residents.length) throw new AppError('invalid', 'Residents live there. Build another home first.');
      const now = this.clock();
      const event = check(eventSchema, {
        id: `build:sell:${building.id}`,
        kind: 'build',
        refId: building.id,
        title: `Sold ${def.name}`,
        taskType: null,
        xp: 0,
        coins: 0,
        gems: sellValue(def.cost),
        at: now.toISOString(),
        day: toDay(now),
        prevDue: null,
        voidedAt: null,
      });
      await tx.add('events', event);
      await tx.del('city', building.id);
      return event;
    });
  }

  /** Buys the next ring of land. Each expansion costs more than the last. */
  expandLand(): Promise<LedgerEvent> {
    return this.storage.tx('rw', async (tx) => {
      const city = await readCity(tx);
      if (city.meta.landLevel >= LAND_MAX_LEVEL) throw new AppError('invalid', 'Your town can’t grow any bigger.');
      if (city.meta.landLevel >= landCap(await readPremium(tx))) throw new AppError('premium', 'Premium lets your town grow beyond 6×6.');
      const cost = LAND_COSTS[city.meta.landLevel]!;
      const gems = gemBalance(await readEvents(tx));
      if (gems < cost) throw new AppError('insufficient', `You need ${cost - gems} more gems for that.`);
      const next = city.meta.landLevel + 1;
      const now = this.clock();
      const event = check(eventSchema, {
        id: `build:land:${next}`,
        kind: 'build',
        refId: `land${next}`,
        title: 'Expanded the town',
        taskType: null,
        xp: 0,
        coins: 0,
        gems: -cost,
        at: now.toISOString(),
        day: toDay(now),
        prevDue: null,
        voidedAt: null,
      });
      await tx.add('events', event);
      await tx.put('meta', { id: 'city', value: { ...city.meta, landLevel: next } } satisfies CityMetaRow);
      return event;
    });
  }

  /**
   * Once per day: pays the town's income (up to three days' worth if you were
   * away; days beyond that simply don't stack, nothing is lost or owed) and
   * welcomes a new resident if there is room and the town is content.
   */
  collectCity(): Promise<{ gems: number; arrived: RosterEntry | null }> {
    return this.storage.tx('rw', async (tx) => {
      const today = toDay(this.clock());
      const city = await readCity(tx);
      if (city.meta.lastCollect === today) return { gems: 0, arrived: null };
      const days = city.meta.lastCollect ? Math.min(MAX_INCOME_DAYS, Math.max(0, diffDays(today, city.meta.lastCollect))) : 0;
      const gems = incomeFor(cityStats(city.buildings, city.residents.length).incomePerDay, await readPremium(tx)) * days;
      if (gems > 0) {
        const event = check(eventSchema, {
          id: `income:${today}`,
          kind: 'income',
          refId: 'city',
          title: days === 1 ? 'Town income' : `Town income (${days} days)`,
          taskType: null,
          xp: 0,
          coins: 0,
          gems,
          at: this.clock().toISOString(),
          day: today,
          prevDue: null,
          voidedAt: null,
        });
        if (!(await tx.get('events', event.id))) await tx.add('events', event);
      }
      await tx.put('meta', { id: 'city', value: { ...city.meta, lastCollect: today } } satisfies CityMetaRow);
      return { gems, arrived: await welcome(tx, today) };
    });
  }

  /** Claims this week's event reward once its goal is met. Returns null if it was already claimed. */
  claimWeeklyEvent(): Promise<LedgerEvent | null> {
    return this.storage.tx('rw', async (tx) => {
      const now = this.clock();
      const week = weeklyEvent(toDay(now));
      if (await tx.get('events', week.claimId)) return null;
      const progress = eventProgress(week.def, await readEvents(tx), week.start, week.end);
      if (progress < week.def.goal) throw new AppError('invalid', 'This week’s event isn’t finished yet.');
      const event = check(eventSchema, {
        id: week.claimId,
        kind: 'event',
        refId: 'weekly',
        title: week.def.name,
        taskType: null,
        xp: 0,
        coins: 0,
        gems: week.def.reward,
        at: now.toISOString(),
        day: toDay(now),
        prevDue: null,
        voidedAt: null,
      });
      await tx.add('events', event);
      return event;
    });
  }

  // --------------------------------------------------------------- settings

  saveSettings(patch: Partial<Settings>): Promise<Settings> {
    return this.storage.tx('rw', async (tx) => {
      const settings = check(settingsSchema, { ...(await readSettings(tx)), ...pick(patch, SETTINGS_KEYS) });
      await tx.put('meta', { id: 'settings', value: settings } satisfies SettingsRow);
      return settings;
    });
  }

  // ----------------------------------------------------------- achievements

  /** Records any newly earned achievements and returns their ids. Unlocks are permanent. */
  syncAchievements(): Promise<string[]> {
    return this.storage.tx('rw', async (tx) => {
      const snap = await readSnapshot(tx);
      const now = this.clock();
      const have = new Set(snap.achievements.map((a) => a.id));
      const fresh = satisfied({ tasks: snap.tasks, events: snap.events, settings: snap.settings, today: toDay(now) }).filter((id) => !have.has(id));
      for (const id of fresh) await tx.put('achievements', check(unlockSchema, { id, unlockedAt: now.toISOString() }));
      return fresh;
    });
  }

  // ------------------------------------------------------------ bulk / data

  /**
   * Loads a validated snapshot (see transfer.parseImport).
   *  - replace: everything on this device is replaced by the file.
   *  - merge: records whose id is not present yet are added; existing records
   *    and current settings are kept.
   * Every record is re-validated here and the result must keep a non-negative
   * balance, otherwise nothing is written.
   */
  importData(data: Snapshot, mode: 'replace' | 'merge'): Promise<void> {
    return this.storage.tx('rw', async (tx) => {
      const incoming: Snapshot = {
        tasks: data.tasks.map((r) => check(taskSchema, r)),
        chores: data.chores.map((r) => check(choreSchema, r)),
        events: data.events.map((r) => check(eventSchema, r)),
        rewards: data.rewards.map((r) => check(rewardSchema, r)),
        achievements: data.achievements.map((r) => check(unlockSchema, r)),
        settings: check(settingsSchema, data.settings),
        city: check(citySchema, data.city ?? EMPTY_CITY),
      };
      if (mode === 'replace') {
        // A purchase belongs to the device/account, not to a backup file: keep it across a restore.
        const keep = await tx.get('meta', PREMIUM_ROW);
        for (const table of ['tasks', 'chores', 'events', 'rewards', 'achievements', 'meta', 'city', 'residents'] as const) await tx.clear(table);
        if (keep) await tx.put('meta', keep);
        await tx.put('meta', { id: 'settings', value: incoming.settings } satisfies SettingsRow);
        await tx.put('meta', { id: 'city', value: incoming.city.meta } satisfies CityMetaRow);
      }
      const existing = await readSnapshot(tx);
      const tables = ['tasks', 'chores', 'events', 'rewards', 'achievements'] as const;
      for (const table of tables) {
        const have = new Set(existing[table].map((r) => r.id));
        for (const row of incoming[table]) if (!have.has(row.id)) await tx.put(table, row);
      }
      // City: union by id. A building whose tile is taken moves to the first free tile, or is dropped if none is left.
      const current = await readCity(tx);
      const land = Math.max(current.meta.landLevel, incoming.city.meta.landLevel);
      const last = [current.meta.lastCollect, incoming.city.meta.lastCollect].filter((d): d is Day => d !== null).sort().pop() ?? null;
      await tx.put('meta', { id: 'city', value: { landLevel: land, lastCollect: last } } satisfies CityMetaRow);
      const size = landSize(land);
      const taken = new Set(current.buildings.map((b) => `${b.x},${b.y}`));
      const knownBuildings = new Set(current.buildings.map((b) => b.id));
      for (const bd of incoming.city.buildings) {
        if (knownBuildings.has(bd.id)) continue;
        let spot: { x: number; y: number } | null = !taken.has(`${bd.x},${bd.y}`) && bd.x < size && bd.y < size ? { x: bd.x, y: bd.y } : null;
        for (let y = 0; !spot && y < size; y++) for (let x = 0; !spot && x < size; x++) if (!taken.has(`${x},${y}`)) spot = { x, y };
        if (!spot) continue;
        taken.add(`${spot.x},${spot.y}`);
        await tx.put('city', { ...bd, ...spot });
      }
      const knownResidents = new Set(current.residents.map((r) => r.id));
      // Residents only move in where there is a home for them.
      const merged = await readCity(tx);
      let room = cityStats(merged.buildings, 0).housing - merged.residents.length;
      for (const r of incoming.city.residents) {
        if (knownResidents.has(r.id) || room <= 0) continue;
        await tx.put('residents', r);
        room--;
      }

      const result = await readSnapshot(tx);
      const errors = integrityErrors(result);
      const tooBig = result.tasks.length > LIMITS.tasks || result.chores.length > LIMITS.chores || result.events.length > LIMITS.events || result.rewards.length > LIMITS.rewards;
      if (errors.length || tooBig) throw new AppError('invalid', 'Importing this file would leave your data in an inconsistent state, so nothing was changed.');
    });
  }

  /** Erases everything on this device. */
  /** Erases all game data. A Play purchase is kept (it was paid for); an admin-granted unlock is not. */
  wipe(): Promise<void> {
    return this.storage.tx('rw', async (tx) => {
      const keep = await tx.get<PremiumRow>('meta', PREMIUM_ROW);
      for (const table of ['tasks', 'chores', 'events', 'rewards', 'achievements', 'meta', 'city', 'residents'] as const) await tx.clear(table);
      if (keep?.value?.source === 'play') await tx.put('meta', keep);
    });
  }

  /** Removes records created by the optional example data (ids start with "demo-"). Earned XP is kept. */
  removeDemo(): Promise<void> {
    return this.storage.tx('rw', async (tx) => {
      for (const table of ['tasks', 'chores', 'rewards'] as const) {
        for (const row of await tx.all(table)) if (row.id.startsWith('demo-')) await tx.del(table, row.id);
      }
    });
  }
}

const maxDay = (a: Day, b: Day): Day => (a > b ? a : b);

const TASK_KEYS = ['title', 'description', 'type', 'project', 'dueDate', 'focusDay', 'priority', 'tag', 'estimateMin', 'subtasks', 'xp'] as const;
const CHORE_KEYS = ['title', 'description', 'recurrence', 'estimateMin', 'difficulty', 'xp', 'paused'] as const;
const REWARD_KEYS = ['name', 'description', 'cost', 'icon'] as const;
const SETTINGS_KEYS = ['playerName', 'theme', 'coinRate', 'weeklyGoal', 'showStreak'] as const;

/**
 * Copies only an explicit allow-list of own keys. Patches are never spread
 * wholesale into stored records, so a stray or hostile key ("id",
 * "completedAt", "__proto__" …) cannot ride along.
 */
function pick<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) out[key] = source[key];
  }
  return out;
}
