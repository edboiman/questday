import { useState } from 'react';
import { dayOffset, now, setDayOffset } from '../clock';
import { toDay } from '../domain/dates';
import { useStore } from '../state/store';

/*
 * Admin tools. Only compiled into the personal build (dist-personal/); the
 * store build removes this file entirely (scripts/check-bundle.mjs verifies).
 * Everything here acts on this device's own data.
 */
export function AdminPanel() {
  const { act, premium, confirm } = useStore();
  const [xp, setXp] = useState('0');
  const [coins, setCoins] = useState('0');
  const [gems, setGems] = useState('0');
  const offset = dayOffset();

  const num = (v: string) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
  const apply = async () => {
    const ok = await act.adminAdjust({ xp: num(xp), coins: num(coins), gems: num(gems) });
    if (ok) {
      setXp('0');
      setCoins('0');
      setGems('0');
    }
  };
  const travel = (days: number) => {
    setDayOffset(days);
    window.location.reload();
  };
  const reset = async (seed: boolean) => {
    const yes = await confirm({
      title: seed ? 'Reset and seed sample data?' : 'Reset everything?',
      body: seed ? 'Erases all data on this device, then adds example quests and chores plus 1,000 coins and 1,000 gems.' : 'Erases all data on this device. This cannot be undone.',
      confirmLabel: seed ? 'Reset and seed' : 'Reset',
      danger: true,
    });
    if (!yes) return;
    await act.wipe();
    if (seed) {
      await act.loadDemo();
      await act.adminAdjust({ xp: 0, coins: 1000, gems: 1000 });
    }
  };

  return (
    <section className="card stack admin" aria-labelledby="s-admin">
      <h2 id="s-admin">Admin tools</h2>
      <p className="muted small">Personal build only. These change this device’s data and are marked in your history.</p>

      <div className="grid-2">
        <label className="field">
          <span>XP (+/−)</span>
          <input className="input" type="number" inputMode="numeric" value={xp} onChange={(e) => setXp(e.target.value)} />
        </label>
        <label className="field">
          <span>Coins (+/−)</span>
          <input className="input" type="number" inputMode="numeric" value={coins} onChange={(e) => setCoins(e.target.value)} />
        </label>
        <label className="field">
          <span>Gems (+/−)</span>
          <input className="input" type="number" inputMode="numeric" value={gems} onChange={(e) => setGems(e.target.value)} />
        </label>
      </div>
      <button type="button" className="btn primary" onClick={() => void apply()}>
        Apply adjustment
      </button>

      <label className="switch">
        <span>Premium unlocked on this device</span>
        <input type="checkbox" checked={premium} onChange={(e) => void act.setPremiumAdmin(e.target.checked)} />
      </label>

      <div className="field">
        <span>
          Time travel: {offset === 0 ? 'real date' : `${offset > 0 ? '+' : ''}${offset} day${Math.abs(offset) === 1 ? '' : 's'}`} ({toDay(now())})
        </span>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={() => travel(offset - 1)}>
            −1 day
          </button>
          <button type="button" className="btn small" onClick={() => travel(offset + 1)}>
            +1 day
          </button>
          <button type="button" className="btn small" onClick={() => travel(offset + 7)}>
            +7 days
          </button>
          <button type="button" className="btn small" onClick={() => travel(offset + 91)}>
            +1 season
          </button>
          {offset !== 0 && (
            <button type="button" className="btn small" onClick={() => travel(0)}>
              Back to today
            </button>
          )}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" className="btn" onClick={() => void reset(true)}>
          Reset and seed sample data
        </button>
        <button type="button" className="btn danger" onClick={() => void reset(false)}>
          Reset everything
        </button>
      </div>
    </section>
  );
}
