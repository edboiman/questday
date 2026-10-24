import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { newId } from '../data/ids';
import type { ChoreFields, RewardFields, TaskFields } from '../data/repo';
import { addDays, formatDay, formatTime, isValidDay, WEEKDAY_SHORT, weekdayOf } from '../domain/dates';
import { LIMITS } from '../domain/limits';
import { isLive } from '../domain/stats';
import type { Chore, Difficulty, Priority, Recurrence, Reward, RewardIcon, Task, TaskType } from '../domain/types';
import { DEFAULT_TASK_XP, DIFFICULTY_XP, XP_PRESETS } from '../domain/xp';
import { useStore } from '../state/store';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

/** Parses a whole number from a text field, clamped to a range; empty → null. */
function toInt(value: string, min: number, max: number): number | null {
  if (value.trim() === '') return null;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="seg" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </fieldset>
  );
}

function XpPicker({ value, onChange }: { value: number; onChange: (xp: number) => void }) {
  return (
    <div className="field">
      <span id="xp-label">XP reward</span>
      <div className="seg" role="group" aria-labelledby="xp-label">
        {XP_PRESETS.map((xp) => (
          <button key={xp} type="button" aria-pressed={value === xp} onClick={() => onChange(xp)}>
            {xp}
          </button>
        ))}
        <input className="input" style={{ width: 96 }} type="number" inputMode="numeric" min={0} max={LIMITS.maxXp} aria-label="Custom XP" value={value} onChange={(e) => onChange(toInt(e.target.value, 0, LIMITS.maxXp) ?? 0)} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- task

const TYPE_OPTIONS = [
  ['task', 'Quest'],
  ['chore', 'One-off chore'],
  ['project', 'Project quest'],
] as const satisfies readonly (readonly [TaskType, string])[];

const PRIORITY_OPTIONS = [
  ['none', 'None'],
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
] as const;

function TaskForm({ task, preset, onDone }: { task?: Task; preset?: Partial<TaskFields>; onDone: () => void }) {
  const { act, today, snap, confirm } = useStore();
  const [f, setF] = useState<TaskFields>(() => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    type: task?.type ?? 'task',
    project: task?.project ?? '',
    dueDate: task?.dueDate ?? null,
    focusDay: task?.focusDay ?? null,
    priority: task?.priority ?? null,
    tag: task?.tag ?? '',
    estimateMin: task?.estimateMin ?? null,
    subtasks: task?.subtasks ?? [],
    xp: task?.xp ?? DEFAULT_TASK_XP,
    ...(task ? {} : preset),
  }));
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TaskFields>(key: K, value: TaskFields[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const projects = [...new Set(snap.tasks.filter((t) => t.type === 'project' && t.project).map((t) => t.project))];
  const done = Boolean(task?.completedAt);

  const addStep = () => {
    const title = step.trim();
    if (!title || f.subtasks.length >= LIMITS.subtasks) return;
    set('subtasks', [...f.subtasks, { id: newId(), title: title.slice(0, LIMITS.title), done: false }]);
    setStep('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!f.title.trim()) {
      setError('Give your quest a name.');
      return;
    }
    setBusy(true);
    const saved = task ? await act.updateTask(task.id, f) : await act.addTask(f);
    setBusy(false);
    if (saved) onDone();
  };

  const remove = async () => {
    if (!task) return;
    const yes = await confirm({
      title: 'Delete this quest?',
      body: done ? 'The quest is removed. XP you already earned from it stays in your history.' : 'This can’t be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (yes) {
      await act.deleteTask(task.id);
      onDone();
    }
  };

  const dateChips: [string, string | null][] = [
    ['Today', today],
    ['Tomorrow', addDays(today, 1)],
    ['Someday', null],
  ];

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <label className="field">
        <span>Quest</span>
        <input
          className="input big"
          data-autofocus
          value={f.title}
          maxLength={LIMITS.title}
          placeholder="What needs doing?"
          enterKeyHint="done"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'task-error' : undefined}
          onChange={(e) => {
            set('title', e.target.value);
            setError('');
          }}
        />
      </label>
      {error && (
        <p className="error" id="task-error" role="alert">
          {error}
        </p>
      )}

      <div className="field">
        <span>When</span>
        <div className="seg" role="group" aria-label="Due">
          {dateChips.map(([label, day]) => (
            <button key={label} type="button" aria-pressed={f.dueDate === day} onClick={() => set('dueDate', day)}>
              {label}
            </button>
          ))}
        </div>
        <label className="date-pick">
          <Icon name="calendar" size={18} />
          <span className="sr-only">Due date</span>
          <input className="input" type="date" value={f.dueDate ?? ''} min={addDays(today, -365)} max={addDays(today, 3650)} onChange={(e) => set('dueDate', isValidDay(e.target.value) ? e.target.value : null)} />
          {f.dueDate && !dateChips.some(([, d]) => d === f.dueDate) && <span className="muted small">{formatDay(f.dueDate, today)}</span>}
        </label>
      </div>

      <details className="more" open={Boolean(task)}>
        <summary>More options</summary>
        <div className="stack">
          <Seg label="Type" value={f.type} options={TYPE_OPTIONS} onChange={(v) => set('type', v)} />
          {f.type === 'project' && (
            <label className="field">
              <span>Project</span>
              <input className="input" list="project-names" value={f.project} maxLength={LIMITS.project} placeholder="Project name" autoComplete="off" onChange={(e) => set('project', e.target.value)} />
              <datalist id="project-names">
                {projects.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
          )}
          <div className="grid-2">
            <label className="field">
              <span>Estimate (minutes)</span>
              <input className="input" type="number" inputMode="numeric" min={1} max={LIMITS.maxEstimateMin} value={f.estimateMin ?? ''} onChange={(e) => set('estimateMin', toInt(e.target.value, 1, LIMITS.maxEstimateMin))} />
            </label>
          </div>
          <div className="field">
            <span>Priority</span>
            <Seg label="Priority" value={f.priority ?? 'none'} options={PRIORITY_OPTIONS} onChange={(v) => set('priority', v === 'none' ? null : (v as Priority))} />
          </div>
          <XpPicker value={f.xp} onChange={(xp) => set('xp', xp)} />
          <label className="switch">
            <span>Pin to today’s quests</span>
            <input type="checkbox" checked={f.focusDay === today} onChange={(e) => set('focusDay', e.target.checked ? today : null)} />
          </label>
          <label className="field">
            <span>Tag</span>
            <input className="input" value={f.tag} maxLength={LIMITS.tag} placeholder="e.g. health" autoComplete="off" onChange={(e) => set('tag', e.target.value)} />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea className="input" value={f.description} maxLength={LIMITS.description} onChange={(e) => set('description', e.target.value)} />
          </label>
          <div className="field">
            <span>Steps</span>
            <ul className="subtasks">
              {f.subtasks.map((s) => (
                <li key={s.id}>
                  <label>
                    <input type="checkbox" checked={s.done} onChange={() => set('subtasks', f.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} />
                    <span>{s.title}</span>
                  </label>
                  <button type="button" className="icon-btn" aria-label={`Remove step: ${s.title}`} onClick={() => set('subtasks', f.subtasks.filter((x) => x.id !== s.id))}>
                    <Icon name="x" size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="toolbar-row">
              <input
                className="input"
                value={step}
                maxLength={LIMITS.title}
                placeholder="Add a step"
                aria-label="New step"
                autoComplete="off"
                enterKeyHint="enter"
                onChange={(e) => setStep(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addStep();
                  }
                }}
              />
              <button type="button" className="btn" onClick={addStep} aria-label="Add step">
                <Icon name="plus" />
              </button>
            </div>
          </div>
        </div>
      </details>

      <div className="btn-row">
        {task && (
          <button type="button" className="btn danger" onClick={() => void remove()}>
            <Icon name="trash" size={18} />
            Delete
          </button>
        )}
        <button type="submit" className="btn primary grow" disabled={busy}>
          {task ? 'Save' : 'Add quest'}
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ chore

type Mode = 'days' | 'weekly' | 'monthly';

const MODE_OPTIONS = [
  ['days', 'Every X days'],
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
] as const;

/** Quick picks for "every X days". Anything else can be typed in. */
const DAY_PICKS = [1, 2, 3, 4] as const;

const DIFFICULTY_OPTIONS = [
  ['easy', `Easy · ${DIFFICULTY_XP.easy} XP`],
  ['medium', `Standard · ${DIFFICULTY_XP.medium} XP`],
  ['hard', `Big · ${DIFFICULTY_XP.hard} XP`],
] as const satisfies readonly (readonly [Difficulty, string])[];

function modeOf(r: Recurrence): Mode {
  if (r.kind === 'daily') return 'days';
  return r.kind;
}

function ChoreForm({ chore, onDone }: { chore?: Chore; onDone: () => void }) {
  const { act, today, snap, confirm } = useStore();
  const [title, setTitle] = useState(chore?.title ?? '');
  const [mode, setMode] = useState<Mode>(chore ? modeOf(chore.recurrence) : 'days');
  const [firstDue, setFirstDue] = useState<string>(today);
  const [interval, setIntervalN] = useState(chore?.recurrence.interval ?? 1);
  const [weekdays, setWeekdays] = useState<number[]>(chore?.recurrence.weekdays.length ? chore.recurrence.weekdays : [weekdayOf(today)]);
  const [dayOfMonth, setDayOfMonth] = useState(chore?.recurrence.dayOfMonth ?? Number(today.slice(8)));
  const [difficulty, setDifficulty] = useState<Difficulty>(chore?.difficulty ?? 'medium');
  const [xp, setXp] = useState(chore?.xp ?? DIFFICULTY_XP.medium);
  const [estimateMin, setEstimateMin] = useState<number | null>(chore?.estimateMin ?? null);
  const [paused, setPaused] = useState(chore?.paused ?? false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const history = chore ? snap.events.filter((e) => e.kind === 'chore' && e.refId === chore.id && isLive(e)).sort((a, b) => b.at.localeCompare(a.at)) : [];

  const changeMode = (next: Mode) => {
    setMode(next);
    setIntervalN(1);
  };

  const recurrence = (): Recurrence => {
    const every = Math.max(1, interval);
    if (mode === 'days') return { kind: 'daily', interval: every, weekdays: [], dayOfMonth: 1 };
    if (mode === 'weekly') return { kind: 'weekly', interval: every, weekdays: [...weekdays].sort(), dayOfMonth: 1 };
    return { kind: 'monthly', interval: every, weekdays: [], dayOfMonth };
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) return setError('Give your chore a name.');
    if (mode === 'weekly' && weekdays.length === 0) return setError('Pick at least one weekday.');
    setBusy(true);
    const fields: ChoreFields = { title, description: chore?.description ?? '', recurrence: recurrence(), estimateMin, difficulty, xp, paused };
    const saved = chore ? await act.updateChore(chore.id, fields) : await act.addChore({ ...fields, nextDue: isValidDay(firstDue) && firstDue >= today ? firstDue : today });
    setBusy(false);
    if (saved) onDone();
  };

  const remove = async () => {
    if (!chore) return;
    const yes = await confirm({ title: 'Delete this chore?', body: 'The chore stops recurring. Its past completions and the XP you earned stay in your history.', confirmLabel: 'Delete', danger: true });
    if (yes) {
      await act.deleteChore(chore.id);
      onDone();
    }
  };

  const unit = mode === 'weekly' ? 'weeks' : mode === 'monthly' ? 'months' : 'days';

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <label className="field">
        <span>Chore</span>
        <input
          className="input big"
          data-autofocus
          value={title}
          maxLength={LIMITS.title}
          placeholder="e.g. Water the plants"
          enterKeyHint="done"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'chore-error' : undefined}
          onChange={(e) => {
            setTitle(e.target.value);
            setError('');
          }}
        />
      </label>
      {error && (
        <p className="error" id="chore-error" role="alert">
          {error}
        </p>
      )}

      <div className="field">
        <span>Repeats</span>
        <Seg label="Repeats" value={mode} options={MODE_OPTIONS} onChange={changeMode} />
      </div>

      {mode === 'weekly' && (
        <div className="seg" role="group" aria-label="Weekdays">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={weekdays.includes(d)}
              onClick={() => {
                setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));
                setError('');
              }}
            >
              {WEEKDAY_SHORT[d]}
            </button>
          ))}
        </div>
      )}

      {mode === 'days' && (
        <div className="field">
          <span>How often</span>
          <div className="seg" role="group" aria-label="How often">
            {DAY_PICKS.map((n) => (
              <button key={n} type="button" aria-pressed={interval === n} onClick={() => setIntervalN(n)}>
                {n === 1 ? 'Every day' : `${n} days`}
              </button>
            ))}
          </div>
          <label className="inline-num">
            <span>Or every</span>
            <input className="input" type="number" inputMode="numeric" min={1} max={LIMITS.maxInterval} value={interval} aria-label="Every how many days" onChange={(e) => setIntervalN(toInt(e.target.value, 1, LIMITS.maxInterval) ?? 1)} />
            <span>{interval === 1 ? 'day' : 'days'}</span>
          </label>
        </div>
      )}

      {mode !== 'days' && (
        <div className="grid-2">
          <label className="field">
            <span>Every … {unit}</span>
            <input className="input" type="number" inputMode="numeric" min={1} max={LIMITS.maxInterval} value={interval} onChange={(e) => setIntervalN(toInt(e.target.value, 1, LIMITS.maxInterval) ?? 1)} />
          </label>
          {mode === 'monthly' && (
            <label className="field">
              <span>Day of month</span>
              <input className="input" type="number" inputMode="numeric" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(toInt(e.target.value, 1, 31) ?? 1)} />
            </label>
          )}
        </div>
      )}

      {!chore && mode === 'days' && (
        <label className="field">
          <span>First due</span>
          <input className="input" type="date" value={firstDue} min={today} max={addDays(today, 3650)} onChange={(e) => setFirstDue(e.target.value || today)} />
        </label>
      )}

      <div className="field">
        <span>Effort</span>
        <Seg
          label="Effort"
          value={difficulty}
          options={DIFFICULTY_OPTIONS}
          onChange={(d) => {
            setDifficulty(d);
            setXp(DIFFICULTY_XP[d]);
          }}
        />
      </div>

      <details className="more">
        <summary>More options</summary>
        <div className="stack">
          <XpPicker value={xp} onChange={setXp} />
          <label className="field">
            <span>Estimate (minutes)</span>
            <input className="input" type="number" inputMode="numeric" min={1} max={LIMITS.maxEstimateMin} value={estimateMin ?? ''} onChange={(e) => setEstimateMin(toInt(e.target.value, 1, LIMITS.maxEstimateMin))} />
          </label>
          {chore && (
            <label className="switch">
              <span>Paused (hidden from due lists, nothing piles up)</span>
              <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
            </label>
          )}
        </div>
      </details>

      {chore && (
        <div className="field">
          <span>
            History · {history.length} {history.length === 1 ? 'completion' : 'completions'}
          </span>
          {history.length === 0 ? (
            <p className="muted small">Not completed yet.</p>
          ) : (
            <ul className="list history small">
              {history.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Icon name="check" size={14} className="muted" />
                  <span className="grow">
                    {formatDay(e.day, today)} · {formatTime(e.at)}
                  </span>
                  <span className="gold">+{e.xp} XP</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="btn-row">
        {chore && (
          <button type="button" className="btn danger" onClick={() => void remove()}>
            <Icon name="trash" size={18} />
            Delete
          </button>
        )}
        <button type="submit" className="btn primary grow" disabled={busy}>
          {chore ? 'Save' : 'Add chore'}
        </button>
      </div>
    </form>
  );
}

// ----------------------------------------------------------------- reward

export const REWARD_ICONS: readonly RewardIcon[] = ['gift', 'gamepad', 'film', 'treat', 'coffee', 'book', 'music', 'star'];

function RewardForm({ reward, onDone }: { reward?: Reward; onDone: () => void }) {
  const { act, confirm } = useStore();
  const [f, setF] = useState<RewardFields>({ name: reward?.name ?? '', description: reward?.description ?? '', cost: reward?.cost ?? 50, icon: reward?.icon ?? 'gift' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!f.name.trim()) return setError('Give your reward a name.');
    setBusy(true);
    const saved = reward ? await act.updateReward(reward.id, f) : await act.addReward(f);
    setBusy(false);
    if (saved) onDone();
  };

  const remove = async () => {
    if (!reward) return;
    const yes = await confirm({ title: 'Delete this reward?', body: 'Past redemptions stay in your history.', confirmLabel: 'Delete', danger: true });
    if (yes) {
      await act.deleteReward(reward.id);
      onDone();
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <label className="field">
        <span>Reward</span>
        <input
          className="input big"
          data-autofocus
          value={f.name}
          maxLength={LIMITS.title}
          placeholder="Something you’ll look forward to"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setF({ ...f, name: e.target.value });
            setError('');
          }}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <label className="field">
        <span>Cost (coins)</span>
        <input className="input" type="number" inputMode="numeric" min={1} max={LIMITS.maxCost} value={f.cost} onChange={(e) => setF({ ...f, cost: toInt(e.target.value, 1, LIMITS.maxCost) ?? 1 })} />
      </label>
      <div className="field">
        <span>Icon</span>
        <div className="seg" role="group" aria-label="Icon">
          {REWARD_ICONS.map((icon) => (
            <button key={icon} type="button" aria-pressed={f.icon === icon} aria-label={icon} onClick={() => setF({ ...f, icon })}>
              <Icon name={icon} />
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Notes</span>
        <textarea className="input" value={f.description} maxLength={LIMITS.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      <div className="btn-row">
        {reward && (
          <button type="button" className="btn danger" onClick={() => void remove()}>
            <Icon name="trash" size={18} />
            Delete
          </button>
        )}
        <button type="submit" className="btn primary grow" disabled={busy}>
          {reward ? 'Save' : 'Add reward'}
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------- host

/** Renders whichever editor the store says is open. */
export function Editors() {
  const { editor, openEditor, snap } = useStore();
  const close = () => openEditor(null);
  const task = editor?.kind === 'task' && editor.id ? snap.tasks.find((t) => t.id === editor.id) : undefined;
  const chore = editor?.kind === 'chore' && editor.id ? snap.chores.find((c) => c.id === editor.id) : undefined;
  const reward = editor?.kind === 'reward' && editor.id ? snap.rewards.find((r) => r.id === editor.id) : undefined;
  const title = !editor ? '' : editor.kind === 'task' ? (editor.id ? 'Edit quest' : 'New quest') : editor.kind === 'chore' ? (editor.id ? 'Edit chore' : 'New chore') : editor.id ? 'Edit reward' : 'New reward';
  // The key remounts the form for each record so no state leaks between edits.
  const key = editor ? `${editor.kind}:${editor.id ?? 'new'}` : 'none';
  return (
    <Dialog open={editor !== null} onClose={close} title={title}>
      {editor?.kind === 'task' && <TaskForm key={key} task={task} preset={editor.preset} onDone={close} />}
      {editor?.kind === 'chore' && <ChoreForm key={key} chore={chore} onDone={close} />}
      {editor?.kind === 'reward' && <RewardForm key={key} reward={reward} onDone={close} />}
    </Dialog>
  );
}
