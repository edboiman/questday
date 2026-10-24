import { useState } from 'react';
import { useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { Museum } from './Museum';
import { Treats } from './Rewards';

type Shelf = 'museum' | 'treats';

/**
 * Chapter IV. One coin purse, two ways to spend it: exhibits for your museum,
 * or real-life treats you define yourself. Spending never lowers your level.
 */
export function RewardsChapter() {
  const { totals, snap } = useStore();
  const [shelf, setShelf] = useState<Shelf>(() => {
    try {
      return sessionStorage.getItem('qa-shelf') === 'treats' ? 'treats' : 'museum';
    } catch {
      return 'museum';
    }
  });
  const choose = (next: Shelf) => {
    setShelf(next);
    try {
      sessionStorage.setItem('qa-shelf', next);
    } catch {
      /* remembered only for this visit anyway */
    }
  };

  return (
    <>
      <section className="card hero" aria-label="Coin purse">
        <div className="purse">
          <Icon name="coin" size={40} className="gold" />
          <div>
            <b>{totals.balance}</b>
            <p className="muted small">coins in your purse</p>
          </div>
        </div>
        <p className="muted small">
          Every quest and chore fills your purse ({snap.settings.coinRate === 1 ? '1 coin' : `${snap.settings.coinRate} coins`} per XP). Spend it on museum exhibits or on real-life treats. Spending never lowers your level.
        </p>
        <div className="seg" role="group" aria-label="Spend coins on">
          <button type="button" aria-pressed={shelf === 'museum'} onClick={() => choose('museum')}>
            <Icon name="museum" size={16} />
            Museum
          </button>
          <button type="button" aria-pressed={shelf === 'treats'} onClick={() => choose('treats')}>
            <Icon name="gift" size={16} />
            Real-life treats
          </button>
        </div>
      </section>
      {shelf === 'museum' ? <Museum /> : <Treats />}
    </>
  );
}
