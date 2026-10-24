import { useEffect, useRef, useState, type ReactNode } from 'react';
import { diffDays, formatDay, formatMinutes } from '../domain/dates';
import { describeRecurrence } from '../domain/recurrence';
import type { Chore, Task } from '../domain/types';
import { useStore } from '../state/store';
import { Icon, type IconName } from './Icon';

/*
 * All user-entered text below is rendered through React text nodes, which
 * escape it. Nothing here ever turns stored text into HTML or a link.
 */

function CheckButton({ done, label, onToggle }: { done: boolean; label: string; onToggle: () => void }) {
  const [pop, setPop] = useState(false);
  return (
    <button
      type="button"
      className={pop ? 'check pop' : 'check'}
      aria-pressed={done}
      aria-label={label}
      onClick={() => {
        if (!done) {
          setPop(true);
          window.setTimeout(() => setPop(false), 500);
        }
        onToggle();
      }}
    >
      <i>
        <Icon name="check" size={16} />
      </i>
    </button>
  );
}

export function TaskRow({ task }: { task: Task }) {
  const { act, today, openEditor } = useStore();
  const done = task.completedAt !== null;
  const delta = task.dueDate ? diffDays(task.dueDate, today) : null;
  const subDone = task.subtasks.filter((s) => s.done).length;
  return (
    <li className={done ? 'row done' : 'row'}>
      <CheckButton done={done} label={done ? `Reopen: ${task.title}` : `Complete: ${task.title}`} onToggle={() => void (done ? act.reopenTask(task.id) : act.completeTask(task.id))} />
      <button type="button" className="row-body" onClick={() => openEditor({ kind: 'task', id: task.id })} aria-label={`Edit: ${task.title}`}>
        <span className="row-title">{task.title}</span>
        <span className="chips">
          <span className="chip xp">+{task.xp} XP</span>
          {task.dueDate && delta !== null && (
            <span className={!done && delta < 0 ? 'chip late' : !done && delta === 0 ? 'chip soon' : 'chip'}>
              <Icon name="calendar" size={12} />
              {formatDay(task.dueDate, today)}
            </span>
          )}
          {task.type === 'chore' && <span className="chip">Chore</span>}
          {task.type === 'project' && <span className="chip">{task.project || 'Project'}</span>}
          {task.priority && task.priority !== 'low' && <span className={`chip ${task.priority}`}>{task.priority === 'high' ? 'High' : 'Medium'}</span>}
          {task.subtasks.length > 0 && (
            <span className="chip">
              {subDone}/{task.subtasks.length} steps
            </span>
          )}
          {task.estimateMin && <span className="chip">{formatMinutes(task.estimateMin)}</span>}
          {task.tag && <span className="chip">#{task.tag}</span>}
        </span>
      </button>
    </li>
  );
}

export function ChoreRow({ chore }: { chore: Chore }) {
  const { act, today, openEditor } = useStore();
  const delta = diffDays(chore.nextDue, today);
  const due = delta <= 0;
  return (
    <li className={chore.paused ? 'row done' : 'row'}>
      {chore.paused ? (
        <span className="check" aria-hidden="true">
          <Icon name="pause" size={18} className="muted" />
        </span>
      ) : (
        <CheckButton done={false} label={`${due ? 'Complete' : 'Complete early'}: ${chore.title}`} onToggle={() => void act.completeChore(chore)} />
      )}
      <button type="button" className="row-body" onClick={() => openEditor({ kind: 'chore', id: chore.id })} aria-label={`Edit: ${chore.title}`}>
        <span className="row-title">{chore.title}</span>
        <span className="chips">
          <span className="chip xp">+{chore.xp} XP</span>
          {chore.paused ? (
            <span className="chip">Paused</span>
          ) : (
            <span className={delta === 0 ? 'chip soon' : 'chip'}>
              <Icon name="calendar" size={12} />
              {delta < 0 ? `Waiting since ${formatDay(chore.nextDue, today)}` : formatDay(chore.nextDue, today)}
            </span>
          )}
          <span className="chip">{describeRecurrence(chore.recurrence)}</span>
          {chore.estimateMin && <span className="chip">{formatMinutes(chore.estimateMin)}</span>}
        </span>
      </button>
      {!chore.paused && due && (
        <span className="row-actions">
          <button type="button" className="icon-btn" aria-label={`Skip this time: ${chore.title}`} title="Skip this time" onClick={() => void act.skipChore(chore)}>
            <Icon name="skip" />
          </button>
        </span>
      )}
    </li>
  );
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} />
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function XpBar({ value, label, className = 'bar' }: { value: number; label: string; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  // A brief gold shine travels along the bar when it fills up (not on first paint, not when it drops).
  const prev = useRef(pct);
  const [gain, setGain] = useState(false);
  useEffect(() => {
    if (pct > prev.current) {
      setGain(true);
      const t = window.setTimeout(() => setGain(false), 1000);
      prev.current = pct;
      return () => window.clearTimeout(t);
    }
    prev.current = pct;
    return undefined;
  }, [pct]);
  return (
    <div className={gain ? `${className} gain` : className} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}
