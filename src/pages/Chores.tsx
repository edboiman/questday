import { useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { ChoreRow, Empty } from '../ui/rows';

export function Chores() {
  const { snap, today, openEditor } = useStore();
  const active = snap.chores.filter((c) => !c.paused).sort((a, b) => a.nextDue.localeCompare(b.nextDue) || a.title.localeCompare(b.title));
  const due = active.filter((c) => c.nextDue <= today);
  const later = active.filter((c) => c.nextDue > today);
  const paused = snap.chores.filter((c) => c.paused);
  const oneOff = snap.tasks.filter((t) => t.type === 'chore' && !t.completedAt).length;

  if (snap.chores.length === 0) {
    return (
      <Empty icon="chores" title="No recurring chores yet">
        <p>Set up the routines that keep home ticking over. They come back on their own schedule, and missed days never pile up.</p>
        <button type="button" className="btn primary" onClick={() => openEditor({ kind: 'chore' })}>
          <Icon name="plus" />
          Add a chore
        </button>
      </Empty>
    );
  }

  return (
    <>
      <section aria-labelledby="c-due">
        <div className="section-head">
          <h2 id="c-due">Due now</h2>
          <span className="muted small">{due.length || ''}</span>
        </div>
        {due.length ? (
          <ul className="list">
            {due.map((c) => (
              <ChoreRow key={c.id} chore={c} />
            ))}
          </ul>
        ) : (
          <p className="muted">All caught up. Nice.</p>
        )}
      </section>

      {later.length > 0 && (
        <section aria-labelledby="c-later">
          <div className="section-head">
            <h2 id="c-later">Coming up</h2>
          </div>
          <ul className="list">
            {later.map((c) => (
              <ChoreRow key={c.id} chore={c} />
            ))}
          </ul>
        </section>
      )}

      {paused.length > 0 && (
        <section aria-labelledby="c-paused">
          <div className="section-head">
            <h2 id="c-paused">Paused</h2>
          </div>
          <ul className="list">
            {paused.map((c) => (
              <ChoreRow key={c.id} chore={c} />
            ))}
          </ul>
        </section>
      )}

      {oneOff > 0 && (
        <p className="muted small">
          {oneOff} one-off {oneOff === 1 ? 'chore is' : 'chores are'} on your <a className="link" href="#/quests">quest list</a>.
        </p>
      )}
    </>
  );
}
