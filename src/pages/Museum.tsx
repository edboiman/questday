import { useMemo, useState } from 'react';
import { formatDay } from '../domain/dates';
import { dailySpecial, EXHIBITS, exhibitLock, owned, PREMIUM_LOCK, ownedInWing, priceOf, RARITY_LABEL, WING_BONUS, wingBonusId, WINGS, type Exhibit, type WingId } from '../domain/museum';
import { isPremiumWing } from '../domain/premium';
import { isLive } from '../domain/stats';
import { useStore } from '../state/store';
import { Dialog } from '../ui/Dialog';
import { ExhibitArt } from '../ui/ExhibitArt';
import { WorldCanvas } from '../ui/world/WorldCanvas';
import type { WorldSpec } from '../ui/world/scenes';
import { Icon } from '../ui/Icon';

/** The museum half of the Rewards chapter. */
export function Museum() {
  const { snap, today, totals, act, confirm, premium } = useStore();
  const [wing, setWing] = useState<WingId>('minerals');
  const [viewing, setViewing] = useState<string | null>(null);
  const have = owned(snap.events);
  const ownedIds = Array.from(have.keys()).sort().join(',');
  const scene = useMemo<WorldSpec>(() => ({kind:'museum', wing, owned: ownedIds ? ownedIds.split(',') : []}), [wing, ownedIds]);
  const special = dailySpecial(today, have, premium);
  const bonuses = new Set(snap.events.filter((e) => isLive(e) && e.refId === 'museum').map((e) => e.id));
  const current = viewing ? EXHIBITS.find((x) => x.id === viewing) : undefined;

  const inspection = useMemo<WorldSpec>(()=>({kind:'exhibit',id:current?.id??'quartz'}),[current?.id]);

  const buy = async (x: Exhibit) => {
    const price = priceOf(x, today, have, premium);
    setViewing(null);
    const yes = await confirm({
      title: `Add the ${x.name} to your museum?`,
      body: `This spends ${price} of your ${totals.balance} coins. Exhibits are yours to keep, so purchases are final. Your level and XP are not affected.`,
      confirmLabel: `Spend ${price} coins`,
    });
    if (yes) await act.collect(x.id);
  };

  return (
    <div className="museum-page">
      {!premium && (
        <section className="card locked-cta" aria-label="Premium">
          <span className="small grow">The museum is part of Premium. Look around freely; collecting starts when you unlock it.</span>
          <button type="button" className="btn gold small" onClick={() => act.openPaywall('museum')}>
            See Premium
          </button>
        </section>
      )}

      <section className="card" aria-label="Collection">
        <div className="chips">
          <span className="chip">
            <Icon name="museum" size={12} />
            {have.size} of {EXHIBITS.length} exhibits
          </span>
          <span className="chip">
            {WINGS.filter((w) => bonuses.has(wingBonusId(w.id))).length} of {WINGS.length} wings complete
          </span>
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          Rarer pieces open up as each wing fills. A finished wing gives your town {WING_BONUS} gems.
        </p>
      </section>

      <section className="museum-gallery" aria-label="Museum gallery">
        <div className="world-heading"><div><span className="world-kicker">THE MUSEUM OF SMALL WONDERS</span><h2>Every effort leaves a story.</h2><p>Your discoveries, given a place of their own.</p></div><span className="world-badge">{have.size} discoveries</span></div>
        <div className="gallery-wings" role="group" aria-label="Choose a museum wing">{WINGS.map(w => <button type="button" key={w.id} aria-pressed={wing===w.id} onClick={()=>setWing(w.id)}>{w.name}<span>{ownedInWing(w.id,have)} / 6</span></button>)}</div>
        <WorldCanvas spec={scene} label={`${WINGS.find(w=>w.id===wing)!.name}, three-dimensional gallery`} onSelect={target=>{const id=target.startsWith('exhibit:')?target.slice(8):'';if(EXHIBITS.some(x=>x.id===id))setViewing(id);}}/>
        <p className="gallery-caption">Collected pieces fill the cases. Empty plinths are waiting for your next discovery.</p>
      </section>

      {special && (
        <section className="card special" aria-labelledby="m-special">
          <ExhibitArt id={special.id} size={64} className="silhouette" />
          <div className="grow">
            <p className="small muted" id="m-special">
              Today’s special · ¼ off
            </p>
            <strong>{special.name}</strong>
            <p className="small">
              <s className="muted">{special.price}</s> <span className="gold">{priceOf(special, today, have, premium)} coins</span>
            </p>
          </div>
          <button type="button" className="btn gold small" onClick={() => setViewing(special.id)}>
            Look
          </button>
        </section>
      )}

      {WINGS.filter(w => w.id === wing).map((w) => {
        const items = EXHIBITS.filter((x) => x.wing === w.id);
        const got = ownedInWing(w.id, have);
        const done = bonuses.has(wingBonusId(w.id));
        const locked = !premium && isPremiumWing(w.id);
        return (
          <section key={w.id} className={locked ? 'card wing locked-wing' : 'card wing'} aria-labelledby={`w-${w.id}`}>
            <div className="section-head">
              <h2 id={`w-${w.id}`}>{w.name}</h2>
              {locked && got === 0 ? <span className="premium-badge">Premium</span> : <span className={done ? 'small gold' : 'muted small'}>{done ? 'Complete ★' : `${got} / ${items.length}`}</span>}
            </div>
            <p className="muted small">{w.blurb}</p>
            <ul className="cases">
              {items.map((x) => {
                const mine = have.get(x.id);
                const lock = mine ? null : exhibitLock(x, have, premium);
                const label = mine ? `${x.name}, in your collection` : lock ? `${x.name}, locked. ${lock}` : `${x.name}, ${priceOf(x, today, have, premium)} coins`;
                return (
                  <li key={x.id}>
                    <button type="button" className={`case r-${x.rarity}${mine ? ' mine' : ''}${lock ? ' locked' : ''}`} onClick={() => (lock === PREMIUM_LOCK ? act.openPaywall('museum') : setViewing(x.id))} aria-label={lock === PREMIUM_LOCK ? `${x.name}: part of Premium` : label}>
                      <span className="pedestal">{lock ? <Icon name="lock" size={22} /> : <ExhibitArt id={x.id} size={100} className={mine ? undefined : 'silhouette'} />}</span>
                      <span className="case-name">{mine || !lock ? x.name : '???'}</span>
                      <span className="case-meta">{mine ? RARITY_LABEL[x.rarity] : lock ? RARITY_LABEL[x.rarity] : `${priceOf(x, today, have, premium)} coins`}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <Dialog open={current !== undefined} onClose={() => setViewing(null)} title={current ? (have.has(current.id) || !exhibitLock(current, have, premium) ? current.name : 'A locked exhibit') : ''}>
        {current &&
          (() => {
            const mine = have.get(current.id);
            const lock = mine ? null : exhibitLock(current, have, premium);
            const price = priceOf(current, today, have, premium);
            const short = price - totals.balance;
            return (
              <>
                {lock ? <div className={`showcase r-${current.rarity}`}><Icon name="lock" size={56}/></div> : <WorldCanvas spec={inspection} label={`Inspect ${current.name}`} onSelect={()=>{}}/>}
                <p className="small">
                  <span className={`rarity r-${current.rarity}`}>{RARITY_LABEL[current.rarity]}</span> · {WINGS.find((w) => w.id === current.wing)!.name}
                </p>
                {mine ? (
                  <>
                    <p className="plaque">{current.plaque}</p>
                    <p className="muted small">In your collection since {formatDay(mine.day, today).toLowerCase()} · paid {-mine.coins} coins</p>
                  </>
                ) : lock && !premium && isPremiumWing(current.wing) ? (
                  <p className="muted">This wing is part of QuestAday Premium, a one-time unlock. See Settings for what it includes.</p>
                ) : lock ? (
                  <p className="muted">{lock}. Collect more from this wing to open it up.</p>
                ) : (
                  <>
                    <p className="muted">Its plaque will be revealed when it joins your collection.</p>
                    <button type="button" className="btn gold" data-autofocus disabled={short > 0} onClick={() => void buy(current)}>
                      {short > 0 ? `${short} more coins needed` : `Buy for ${price} coins`}
                    </button>
                  </>
                )}
              </>
            );
          })()}
      </Dialog>
    </div>
  );
}
