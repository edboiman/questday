import { formatDay } from '../domain/dates';
import { isLive } from '../domain/stats';
import type { Reward } from '../domain/types';
import { useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { Empty } from '../ui/rows';

/** The player's own real-life treats, bought with coins. Shown at the bottom of the museum. */
export function Treats() {
  const { snap, totals, today, act, confirm, openEditor } = useStore();
  const rewards = [...snap.rewards].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const redemptions = snap.events.filter((e) => e.kind === 'redeem' && isLive(e)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);

  const redeem = async (reward: Reward) => {
    const yes = await confirm({
      title: `Redeem “${reward.name}”?`,
      body: `This spends ${reward.cost} of your ${totals.balance} coins. Your level and lifetime XP are not affected.`,
      confirmLabel: `Spend ${reward.cost} coins`,
    });
    if (yes) await act.redeem(reward);
  };

  return (
    <>
      <section aria-labelledby="r-shop">
        <div className="section-head">
          <h2 id="r-shop">Real-life treats</h2>
          <button type="button" className="btn small" onClick={() => openEditor({ kind: 'reward' })}>
            <Icon name="plus" size={16} />
            Add treat
          </button>
        </div>
        {rewards.length ? (
          <ul className="list">
            {rewards.map((r) => {
              const short = r.cost - totals.balance;
              return (
                <li key={r.id} className="card reward">
                  <span className="reward-icon">
                    <Icon name={r.icon} size={24} />
                  </span>
                  <button type="button" className="row-body grow" style={{ padding: 0 }} onClick={() => openEditor({ kind: 'reward', id: r.id })} aria-label={`Edit reward: ${r.name}`}>
                    <span className="row-title">{r.name}</span>
                    {r.description && <span className="muted small">{r.description}</span>}
                    <span className="small gold">{r.cost} coins</span>
                  </button>
                  <button type="button" className="btn gold small" disabled={short > 0} onClick={() => void redeem(r)} aria-label={short > 0 ? `${r.name}: ${short} more coins needed` : `Redeem ${r.name}`}>
                    {short > 0 ? `${short} to go` : 'Redeem'}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty icon="gift" title="Treat yourself, too">
            <p>Optional: add real-life rewards (a movie night, a fancy coffee) and spend coins on them as well as on exhibits.</p>
          </Empty>
        )}
      </section>

      {redemptions.length > 0 && (
        <section className="card" aria-labelledby="r-history">
          <div className="section-head">
            <h2 id="r-history">Treats redeemed</h2>
          </div>
          <ul className="list history" style={{ gap: 0 }}>
            {redemptions.map((e) => (
              <li key={e.id}>
                <Icon name="gift" size={16} className="muted" />
                <span className="grow">{e.title}</span>
                <span className="muted small">
                  {formatDay(e.day, today)} · {-e.coins} coins
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
