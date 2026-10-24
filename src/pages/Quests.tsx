import { useMemo, useState } from 'react';
import { now } from '../clock';
import { diffDays, formatLongDate, toDay } from '../domain/dates';
import type { Task } from '../domain/types';
import { useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { Empty, TaskRow, XpBar } from '../ui/rows';
import { Vignette } from '../ui/Ornaments';

// Encouraging, never guilt-inducing. One per day, chosen by date.
const NUDGES = [
  'One small quest is a fine place to start.',
  'Progress counts, however small.',
  'Pick the easiest thing first. Momentum does the rest.',
  'Nothing here expires. Go at your own pace.',
  'Future you will appreciate whatever you manage today.',
  'A tidy corner is still a tidy corner.',
  'Rest is part of the adventure too.',
];

function greeting(name: string): string {
  const h = now().getHours();
  const hello = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${hello}, ${name}` : hello;
}

type Filter = 'open' | 'today' | 'upcoming' | 'overdue' | 'completed' | 'all';
type Sort = 'due' | 'priority' | 'created';

const FILTERS: readonly (readonly [Filter, string])[] = [
  ['open', 'Open'],
  ['today', 'Today'],
  ['upcoming', 'Upcoming'],
  ['overdue', 'Overdue'],
  ['completed', 'Completed'],
  ['all', 'All'],
];

const RANK = { high: 0, medium: 1, low: 2 } as const;

const EMPTY_TEXT: Record<Filter, string> = {
  open: 'No open quests. Enjoy the calm, or add something new.',
  today: 'Nothing is due today.',
  upcoming: 'Nothing scheduled ahead.',
  overdue: 'Nothing is overdue.',
  completed: 'Completed quests will collect here.',
  all: 'No quests yet. Add your first one.',
};

export function Quests() {
  const { snap, today, gems, level, todayStat, streak, openEditor, act } = useStore();
  const [filter, setFilter] = useState<Filter>(() => (snap.tasks.some((t) => !t.completedAt && (t.dueDate === today || t.focusDay === today)) ? 'today' : 'open'));
  const [sort, setSort] = useState<Sort>('due');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const open = snap.tasks.filter((t) => !t.completedAt);
    return {
      open: open.length,
      today: open.filter((t) => t.dueDate === today || t.focusDay === today).length,
      upcoming: open.filter((t) => t.dueDate !== null && t.dueDate > today).length,
      overdue: open.filter((t) => t.dueDate !== null && t.dueDate < today).length,
      completed: snap.tasks.length - open.length,
      all: snap.tasks.length,
    } satisfies Record<Filter, number>;
  }, [snap.tasks, today]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesFilter = (t: Task) => {
      const done = t.completedAt !== null;
      if (filter === 'all') return true;
      if (filter === 'completed') return done;
      // What you finished today stays on Today and Open (struck through, at the bottom), so the day's progress stays visible.
      if (done) return (filter === 'today' || filter === 'open') && toDay(new Date(t.completedAt!)) === today;
      if (filter === 'today') return t.dueDate === today || t.focusDay === today;
      if (filter === 'upcoming') return t.dueDate !== null && t.dueDate > today;
      if (filter === 'overdue') return t.dueDate !== null && t.dueDate < today;
      return true;
    };
    const matchesQuery = (t: Task) => !q || [t.title, t.description, t.tag, t.project, ...t.subtasks.map((s) => s.title)].some((text) => text.toLowerCase().includes(q));
    const order = (a: Task, b: Task) => {
      const doneDiff = Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt));
      if (doneDiff) return doneDiff;
      if (a.completedAt && b.completedAt) return b.completedAt.localeCompare(a.completedAt);
      if (sort === 'due') return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || b.createdAt.localeCompare(a.createdAt);
      if (sort === 'priority') return (a.priority ? RANK[a.priority] : 3) - (b.priority ? RANK[b.priority] : 3) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
      return b.createdAt.localeCompare(a.createdAt);
    };
    return snap.tasks.filter((t) => matchesFilter(t) && matchesQuery(t)).sort(order);
  }, [snap.tasks, filter, sort, query, today]);

  const nudge = NUDGES[Math.abs(diffDays(today, '2026-01-01')) % NUDGES.length]!;
  const isEmpty = snap.tasks.length === 0 && snap.chores.length === 0;

  return (
    <>
      <section className="card hero" aria-label="Today">
        <Vignette />
        <div>
          <p className="muted small">{formatLongDate(today)}</p>
          <h2>{greeting(snap.settings.playerName)}</h2>
        </div>
        <div className="level-row">
          <div className="level-badge" aria-hidden="true">
            <span>{level.level}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="section-head" style={{ marginBottom: 6 }}>
              <strong>Level {level.level}</strong>
              <span className="muted small">
                {level.intoLevel} / {level.span} XP
              </span>
            </div>
            <XpBar value={level.progress} label={`Level ${level.level} progress`} />
          </div>
        </div>
        <div className="chips">
          <span className="chip xp">
            <Icon name="sparkle" size={12} />+{todayStat.xp} XP today
          </span>
          <span className="chip">
            <Icon name="check" size={12} />
            {todayStat.count} done today
          </span>
          {snap.settings.showStreak && streak.current > 0 && (
            <span className="chip">
              <Icon name="flame" size={12} />
              {streak.current}-day streak
            </span>
          )}
          <a className="chip gem" href="#/city">
            <Icon name="gem" size={12} />
            {gems} gems
          </a>
        </div>
        <p className="muted small">{nudge}</p>
      </section>

      {isEmpty ? (
        <Empty icon="quests" title="Your story starts with a first quest">
          <p>Write down one thing you mean to do. A title is all it needs.</p>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => openEditor({ kind: 'task', preset: { dueDate: today } })}>
              <Icon name="plus" />
              Add your first quest
            </button>
            <button type="button" className="btn" onClick={() => void act.loadDemo()}>
              Try example data
            </button>
          </div>
        </Empty>
      ) : (
        <>
      <div className="toolbar">
        <div className="toolbar-row">
          <div className="search">
            <Icon name="search" />
            <input className="input" type="search" value={query} placeholder="Search quests" aria-label="Search quests" maxLength={120} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="input" style={{ width: 'auto' }} value={sort} aria-label="Sort by" onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
            <option value="created">Newest</option>
          </select>
        </div>
        <div className="seg scroll" role="group" aria-label="Filter">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
              <span className="muted">{counts[id]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length ? (
        <ul className="list" aria-label="Quests">
          {visible.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      ) : (
        <Empty icon="quests" title={query ? 'No matches' : 'All clear'}>
          <p>{query ? 'Try a different search.' : EMPTY_TEXT[filter]}</p>
        </Empty>
      )}
        </>
      )}
    </>
  );
}
