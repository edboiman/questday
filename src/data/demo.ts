import { addDays } from '../domain/dates';
import type { Day } from '../domain/types';
import type { Repo } from './repo';

/**
 * Optional example data. Every record id starts with "demo-" so it can be
 * removed cleanly (Settings → Remove example data). Safe to call twice:
 * ids already present are skipped.
 */
export async function loadDemo(repo: Repo, today: Day): Promise<void> {
  const snap = await repo.snapshot();
  const have = new Set([...snap.tasks, ...snap.chores, ...snap.rewards].map((r) => r.id));
  const once = async (id: string, add: () => Promise<unknown>) => {
    if (!have.has(id)) await add();
  };

  await once('demo-t1', () => repo.addTask({ title: 'Reply to the landlord', dueDate: today, priority: 'high', xp: 10 }, 'demo-t1'));
  await once('demo-t2', () => repo.addTask({ title: 'Book a dentist appointment', dueDate: today, estimateMin: 10, xp: 10 }, 'demo-t2'));
  await once('demo-t3', () =>
    repo.addTask(
      {
        title: 'Sort the paperwork drawer',
        type: 'chore',
        dueDate: addDays(today, 2),
        xp: 25,
        subtasks: [
          { id: 'demo-s1', title: 'Shred old statements', done: false },
          { id: 'demo-s2', title: 'File this year’s receipts', done: false },
        ],
      },
      'demo-t3',
    ),
  );
  await once('demo-t4', () => repo.addTask({ title: 'Outline chapter one', type: 'project', project: 'Short story', dueDate: addDays(today, 4), priority: 'medium', xp: 50 }, 'demo-t4'));
  await once('demo-t5', () => repo.addTask({ title: 'Pick a title', type: 'project', project: 'Short story', xp: 15, tag: 'writing' }, 'demo-t5'));
  await once('demo-t6', () => repo.addTask({ title: 'Stretch for ten minutes', focusDay: today, xp: 5, tag: 'health' }, 'demo-t6'));

  const daily = { kind: 'daily', interval: 1, weekdays: [], dayOfMonth: 1 } as const;
  await once('demo-c1', () => repo.addChore({ title: 'Make the bed', recurrence: { ...daily, weekdays: [] }, difficulty: 'easy' }, 'demo-c1'));
  await once('demo-c2', () => repo.addChore({ title: 'Wash the dishes', recurrence: { ...daily, weekdays: [] }, difficulty: 'medium', estimateMin: 15 }, 'demo-c2'));
  await once('demo-c3', () => repo.addChore({ title: 'Take out the trash', recurrence: { kind: 'daily', interval: 3, weekdays: [], dayOfMonth: 1 }, difficulty: 'easy' }, 'demo-c3'));
  await once('demo-c4', () => repo.addChore({ title: 'Laundry', recurrence: { kind: 'weekly', interval: 1, weekdays: [6], dayOfMonth: 1 }, difficulty: 'medium', estimateMin: 45 }, 'demo-c4'));
  await once('demo-c5', () => repo.addChore({ title: 'Clean the bathroom', recurrence: { kind: 'weekly', interval: 1, weekdays: [0], dayOfMonth: 1 }, difficulty: 'hard', estimateMin: 30 }, 'demo-c5'));
  await once('demo-c6', () => repo.addChore({ title: 'Change the bedsheets', recurrence: { kind: 'weekly', interval: 2, weekdays: [0], dayOfMonth: 1 }, difficulty: 'medium' }, 'demo-c6'));

  await once('demo-r1', () => repo.addReward({ name: 'Guilt-free gaming session', description: 'An hour, no second-guessing.', cost: 30, icon: 'gamepad' }, 'demo-r1'));
  await once('demo-r2', () => repo.addReward({ name: 'Movie night', description: '', cost: 75, icon: 'film' }, 'demo-r2'));
  await once('demo-r3', () => repo.addReward({ name: 'A special treat', description: 'Whatever sounds good today.', cost: 150, icon: 'treat' }, 'demo-r3'));
}

export function hasDemo(ids: Iterable<string>): boolean {
  for (const id of ids) if (id.startsWith('demo-')) return true;
  return false;
}
