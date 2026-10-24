import { ACHIEVEMENTS } from '../domain/achievements';
import { formatDay, formatTime, toDay } from '../domain/dates';
import { isLive, weekSeries } from '../domain/stats';
import { weeklyReport } from '../domain/report';
import { formatDay as fmt } from '../domain/dates';
import { useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { Empty, XpBar } from '../ui/rows';

export function Progress() {
  const { snap, today, level, totals, gems, streak, premium, act } = useStore();
  const report = premium ? weeklyReport(snap.events, snap.city.residents, today) : null;
  const week = weekSeries(snap.events, today);
  const weekCount = week.reduce((n, d) => n + d.count, 0);
  const weekXp = week.reduce((n, d) => n + d.xp, 0);
  const peak = Math.max(1, ...week.map((d) => d.count));
  const goal = snap.settings.weeklyGoal;
  const unlocked = new Map(snap.achievements.map((a) => [a.id, a.unlockedAt]));
  const ctx = { tasks: snap.tasks, events: snap.events, settings: snap.settings, today };
  const history = snap.events.filter(isLive).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);

  return (
    <>
      <section className="card hero" aria-label="Level">
        <div className="level-row">
          <div className="level-badge" aria-hidden="true">
            <span>{level.level}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>Level {level.level}</h2>
            <p className="muted small">{level.totalXp} XP earned in total</p>
          </div>
        </div>
        <XpBar value={level.progress} label={`Level ${level.level} progress`} />
        <p className="muted small">
          {level.intoLevel} / {level.span} XP in this level · {level.remaining} XP to level {level.level + 1}
        </p>
      </section>

      <section className="tiles" aria-label="Totals">
        <div className="tile">
          <b>{totals.quests}</b>
          <span>Quests completed</span>
        </div>
        <div className="tile">
          <b>{totals.chores}</b>
          <span>Chores completed</span>
        </div>
        <div className="tile">
          <b className="gold">{totals.balance}</b>
          <span>Coins to spend</span>
        </div>
        <div className="tile">
          <b className="gem">{gems}</b>
          <span>Gems for the city</span>
        </div>
        <div className="tile">
          <b>{snap.city.residents.length}</b>
          <span>Residents</span>
        </div>
        {snap.settings.showStreak && (
          <>
            <div className="tile">
              <b>{streak.current}</b>
              <span>Current streak (days)</span>
            </div>
            <div className="tile">
              <b>{streak.best}</b>
              <span>Best streak (days)</span>
            </div>
          </>
        )}
        <div className="tile">
          <b>
            {unlocked.size}/{ACHIEVEMENTS.length}
          </b>
          <span>Achievements</span>
        </div>
      </section>

      {report ? (
        <section className="card stack report" aria-labelledby="p-report">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <h2 id="p-report">Last week’s report</h2>
            <span className="muted small">
              {fmt(report.start, today)} – {fmt(report.end, today)}
            </span>
          </div>
          <p className="plaque">{report.headline}</p>
          <div className="tiles">
            <ReportTile label="Quests" value={report.week.quests} before={report.previous.quests} />
            <ReportTile label="Chores" value={report.week.chores} before={report.previous.chores} />
            <ReportTile label="XP earned" value={report.week.xp} before={report.previous.xp} />
            <ReportTile label="Coins earned" value={report.week.coins} before={report.previous.coins} />
            <ReportTile label="Gems earned" value={report.week.gems} before={report.previous.gems} />
            <ReportTile label="Active days" value={report.week.activeDays} before={report.previous.activeDays} />
          </div>
          <p className="muted small">
            {report.bestDay ? `Busiest day: ${report.bestDay.label} (${report.bestDay.count} done). ` : ''}
            {report.week.exhibits ? `${report.week.exhibits} new ${report.week.exhibits === 1 ? 'exhibit' : 'exhibits'}. ` : ''}
            {report.week.buildings ? `${report.week.buildings} new ${report.week.buildings === 1 ? 'building' : 'buildings'}. ` : ''}
            {report.newResidents ? `${report.newResidents} new ${report.newResidents === 1 ? 'neighbour' : 'neighbours'}.` : ''}
          </p>
        </section>
      ) : (
        <section className="card locked-cta" aria-label="Weekly report">
          <span className="small grow">
            <strong>Weekly progress reports</strong>
            <br />
            <span className="muted">See each week at a glance, compared with the week before. Part of Premium.</span>
          </span>
          <button type="button" className="btn gold small" onClick={() => act.openPaywall('report')}>
            See Premium
          </button>
        </section>
      )}

      <section className="card" aria-labelledby="p-week">
        <div className="section-head">
          <h2 id="p-week">This week</h2>
          <span className="muted small">
            {weekCount} done · +{weekXp} XP
          </span>
        </div>
        <div className="week" role="img" aria-label={`Completions this week: ${week.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
          {week.map((d) => (
            <div key={d.day} className={`${d.count ? 'has' : ''} ${d.day === today ? 'today' : ''}`}>
              <span>{d.count || ''}</span>
              <i style={{ height: `${Math.round((d.count / peak) * 100)}%` }} />
              <span>{d.label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="section-head" style={{ marginBottom: 6 }}>
            <span className="small">Weekly challenge</span>
            <span className="muted small">
              {Math.min(weekCount, goal)} / {goal}
            </span>
          </div>
          <XpBar value={weekCount / goal} label="Weekly challenge progress" className="bar thin teal" />
        </div>
      </section>

      <section aria-labelledby="p-ach">
        <div className="section-head">
          <h2 id="p-ach">Achievements</h2>
        </div>
        <ul className="list trophies">
          {ACHIEVEMENTS.map((a) => {
            const at = unlocked.get(a.id);
            const p = a.progress(ctx);
            return (
              <li key={a.id} className={at ? 'trophy won' : 'trophy'}>
                <Icon name="trophy" size={24} />
                <strong>{a.name}</strong>
                <span className="muted small">{a.description}</span>
                {at ? (
                  <span className="small gold">Unlocked {formatDay(toDay(new Date(at)), today)}</span>
                ) : (
                  <>
                    <XpBar value={p.value / p.target} label={`${a.name} progress`} className="bar thin" />
                    <span className="muted small">
                      {Math.min(p.value, p.target)} / {p.target}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="p-history">
        <div className="section-head">
          <h2 id="p-history">Recent activity</h2>
        </div>
        {history.length ? (
          <ul className="list history" style={{ gap: 0 }}>
            {history.map((e) => (
              <li key={e.id}>
                <Icon name={e.kind === 'redeem' ? 'gift' : e.kind === 'collect' ? 'museum' : e.kind === 'chore' ? 'chores' : e.kind === 'task' ? 'check' : 'city'} size={16} className="muted" />
                <span className="grow">
                  {e.title}
                  <span className="muted small">
                    {' '}
                    · {formatDay(e.day, today)} {formatTime(e.at)}
                  </span>
                </span>
                {e.kind === 'redeem' || e.kind === 'collect' ? <span className="muted small">{e.coins} coins</span> : e.xp > 0 ? <span className="gold small">+{e.xp} XP</span> : <span className="gem small">{e.gems > 0 ? '+' : ''}{e.gems} gems</span>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon="sparkle" title="Your story starts here">
            <p>Complete a quest and it will show up in your history.</p>
          </Empty>
        )}
      </section>
    </>
  );
}

function ReportTile({ label, value, before }: { label: string; value: number; before: number }) {
  const diff = value - before;
  return (
    <div className="tile">
      <b>{value}</b>
      <span>
        {label}
        {diff !== 0 && <em className={diff > 0 ? 'up' : 'down'}> {diff > 0 ? `+${diff}` : diff} vs week before</em>}
      </span>
    </div>
  );
}


