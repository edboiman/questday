import { toDay } from './dates';
import { activeDays, totals, weekSeries } from './stats';
import type { Day, LedgerEvent, Settings, Task } from './types';
import { levelInfo } from './xp';
import { ROHLD_ACHIEVEMENT_ID, ROHLD_UNLOCK_DAYS } from './visitor';

export interface AchievementContext {
  tasks: readonly Task[];
  events: readonly LedgerEvent[];
  settings: Settings;
  today: Day;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  progress(ctx: AchievementContext): { value: number; target: number };
}

/** Quests on today's list: due today or pinned to today. */
export function dailyQuests(tasks: readonly Task[], today: Day): Task[] {
  return tasks.filter((t) => t.dueDate === today || t.focusDay === today);
}

export const DAILY_SWEEP_MIN = 3;

function completedProjects(tasks: readonly Task[]): number {
  const groups = new Map<string, { total: number; done: number }>();
  for (const t of tasks) {
    if (t.type !== 'project') continue;
    const key = t.project.trim().toLowerCase();
    const g = groups.get(key) ?? { total: 0, done: 0 };
    g.total++;
    if (t.completedAt) g.done++;
    groups.set(key, g);
  }
  let complete = 0;
  for (const g of groups.values()) if (g.total > 0 && g.done === g.total) complete++;
  return complete;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-quest',
    name: 'First Steps',
    description: 'Complete your first quest.',
    progress: (c) => ({ value: totals(c.events).quests, target: 1 }),
  },
  {
    id: 'first-chore',
    name: 'Hearth Keeper',
    description: 'Complete your first chore.',
    progress: (c) => ({ value: totals(c.events).chores, target: 1 }),
  },
  {
    id: 'ten-quests',
    name: 'Adventurer',
    description: 'Complete 10 quests.',
    progress: (c) => ({ value: totals(c.events).quests, target: 10 }),
  },
  {
    id: 'fifty-chores',
    name: 'Master of the House',
    description: 'Complete 50 chores.',
    progress: (c) => ({ value: totals(c.events).chores, target: 50 }),
  },
  {
    id: 'first-project',
    name: 'Campaign Complete',
    description: 'Finish every quest in a project.',
    progress: (c) => ({ value: completedProjects(c.tasks), target: 1 }),
  },
  {
    id: 'daily-sweep',
    name: 'Clean Sweep',
    description: `Complete every quest on today's list (${DAILY_SWEEP_MIN} or more).`,
    progress: (c) => {
      const list = dailyQuests(c.tasks, c.today);
      const done = list.filter((t) => t.completedAt && toDay(new Date(t.completedAt)) <= c.today).length;
      return { value: done, target: Math.max(DAILY_SWEEP_MIN, list.length) };
    },
  },
  {
    id: 'level-5',
    name: 'Seasoned',
    description: 'Reach level 5.',
    progress: (c) => ({ value: levelInfo(totals(c.events).xp).level, target: 5 }),
  },
  {
    id: 'level-10',
    name: 'Veteran',
    description: 'Reach level 10.',
    progress: (c) => ({ value: levelInfo(totals(c.events).xp).level, target: 10 }),
  },
  {
    id: 'weekly-challenge',
    name: 'Weekly Challenge',
    description: 'Hit your personal weekly goal.',
    progress: (c) => ({
      value: weekSeries(c.events, c.today).reduce((sum, d) => sum + d.count, 0),
      target: c.settings.weeklyGoal,
    }),
  },
  {
    id: ROHLD_ACHIEVEMENT_ID,
    name: 'A New Friend',
    description: `Complete a quest, project or chore on ${ROHLD_UNLOCK_DAYS} different days. Meet Rohld, a visiting penguin.`,
    progress: (c) => ({ value: activeDays(c.events).size, target: ROHLD_UNLOCK_DAYS }),
  },
];

export const ACHIEVEMENT_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((a) => a.id));

/** Ids of achievements whose condition is currently met. */
export function satisfied(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter((a) => {
    const p = a.progress(ctx);
    return p.target > 0 && p.value >= p.target;
  }).map((a) => a.id);
}
