import { useRef, useState } from 'react';
import { BUILDINGS, ROSTER, rosterSize, CATEGORY_LABEL, CATEGORY_ORDER, LAND_COSTS, LAND_MAX_LEVEL, NEEDS, NEED_LABEL, SEASON_LABEL, eventProgress, landSize, lineFor, lockReason, rosterEntry, sellValue, weeklyEvent, type BuildingDef } from '../domain/city';
import { FREE_LAND_MAX_LEVEL, incomeFor, landCap } from '../domain/premium';
import { isLive } from '../domain/stats';
import { dayStat } from '../domain/stats';
import { rohldLine, rohldProgress, ROHLD_ACHIEVEMENT_ID, ROHLD_UNLOCK_DAYS } from '../domain/visitor';
import type { Building, BuildingId, ResidentId } from '../domain/types';
import { useStore } from '../state/store';
import { BuildingArt, ResidentFace, RohldFace } from '../ui/CityArt';
import { TownWorld } from '../ui/TownWorld';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { Empty, XpBar } from '../ui/rows';

type Sheet = { kind: 'pick'; x: number; y: number } | { kind: 'building'; id: string } | null;

function statLine(def: BuildingDef): string {
  const parts: string[] = [];
  if (def.housing) parts.push(`Homes ${def.housing}`);
  if (def.food) parts.push(`Food +${def.food}`);
  if (def.fun) parts.push(`Fun +${def.fun}`);
  if (def.calm) parts.push(`Calm +${def.calm}`);
  if (def.income) parts.push(`${def.income} gems/day`);
  return parts.join(' · ');
}

export function City() {
  const { snap, today, gems, city, season, level, act, confirm, premium } = useStore();
  const [placing, setPlacing] = useState<BuildingId | null>(null);
  const [talking, setTalking] = useState<ResidentId | null>(null);
  const [visits, setVisits] = useState<Partial<Record<ResidentId, number>>>({});
  const greet = (id: ResidentId) => { setVisits(current => ({...current, [id]:(current[id]??0)+1})); setTalking(id); };
  const [rohldTalking, setRohldTalking] = useState(false);
  const [rohldVisits, setRohldVisits] = useState(0);
  const visitor = rohldProgress(snap.events, snap.achievements.some((entry) => entry.id === ROHLD_ACHIEVEMENT_ID));
  const greetRohld = () => { setRohldVisits(current => current + 1); setRohldTalking(true); };
  const [sheet, setSheet] = useState<Sheet>(null);
  const mapRef = useRef<HTMLElement>(null);
  const startPlacing = (type: BuildingId) => {
    setPlacing(type);
    mapRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const size = landSize(snap.city.meta.landLevel);
  const byTile = new Map(snap.city.buildings.map((b) => [`${b.x},${b.y}`, b]));
  const free = size * size - snap.city.buildings.length;
  const week = weeklyEvent(today);
  const progress = eventProgress(week.def, snap.events, week.start, week.end);
  const claimed = snap.events.some((e) => e.id === week.claimId && isLive(e));
  const done = progress >= week.def.goal;
  const atFreeCap = !premium && snap.city.meta.landLevel >= FREE_LAND_MAX_LEVEL && snap.city.meta.landLevel < LAND_MAX_LEVEL;
  const nextLand = snap.city.meta.landLevel < landCap(premium) ? LAND_COSTS[snap.city.meta.landLevel]! : null;
  const ctx = { stats: city, buildings: snap.city.buildings, doneToday: dayStat(snap.events, today).count, season, today };
  const placingDef = placing ? BUILDINGS[placing] : null;

  const place = async (type: BuildingId, x: number, y: number) => {
    setSheet(null);
    const ok = await act.build(type, x, y);
    if (ok) setPlacing(null);
  };

  const tap = (x: number, y: number) => {
    const existing = byTile.get(`${x},${y}`);
    if (existing) return setSheet({ kind: 'building', id: existing.id });
    if (placing) return void place(placing, x, y);
    setSheet({ kind: 'pick', x, y });
  };

  const sell = async (b: Building) => {
    const def = BUILDINGS[b.type];
    setSheet(null);
    const yes = await confirm({ title: `Sell ${def.name}?`, body: `You get back ${sellValue(def.cost)} of the ${def.cost} gems it cost. You can rebuild it later.`, confirmLabel: `Sell for ${sellValue(def.cost)} gems`, danger: true });
    if (yes) await act.sellBuilding(b.id);
  };

  const expand = async () => {
    if (nextLand === null) return;
    const yes = await confirm({ title: 'Expand your town?', body: `A new row and column of land costs ${nextLand} gems. Each expansion costs more than the last.`, confirmLabel: `Spend ${nextLand} gems` });
    if (yes) await act.expandLand();
  };

  const target = sheet?.kind === 'building' ? snap.city.buildings.find((b) => b.id === sheet.id) : undefined;
  const buildable = (def: BuildingDef) => lockReason(def, level.level, season, premium);

  return (
    <div className="town-page">
      <section className="card hero" aria-label="Town">
        <div className="balance">
          <Icon name="gem" size={36} className="gem" />
          <div>
            <b className="gem">{gems}</b>
            <p className="muted small">gems to build with</p>
          </div>
        </div>
        <div className="chips">
          <span className="chip">
            <Icon name="home" size={12} />
            {city.population} / {city.housing} homes
          </span>
          <span className="chip xp">Gem bonus ×{city.multiplier.toFixed(2)}</span>
          <span className="chip">+{incomeFor(city.incomePerDay, premium)} gems/day{premium ? ' (×2 Premium)' : ''}</span>
          <span className="chip">{SEASON_LABEL[season]}</span>
        </div>
        <p className="muted small">Every quest and chore earns gems as well as coins. A happy, balanced town earns up to 50% more.</p>
      </section>

      <section ref={mapRef} className="card map-card" aria-labelledby="c-map">
        <div className="section-head">
          <h2 id="c-map">Your town</h2>
          <span className="muted small">
            {free} free {free === 1 ? 'tile' : 'tiles'}
          </span>
        </div>
      {placingDef && (
          <div className="note placing" role="status">
            <span>
              Tap an empty tile to build a <b>{placingDef.name}</b> ({placingDef.cost} gems).
            </span>
            <button type="button" className="btn small" onClick={() => setPlacing(null)}>
              Cancel
            </button>
          </div>
        )}
        <TownWorld size={size} buildings={snap.city.buildings} residents={snap.city.residents} season={season} placing={!!placing} rohldUnlocked={visitor.unlocked} onTile={tap} onResident={greet} onRohld={greetRohld} />
      </section>

      <section className="card" aria-labelledby="c-needs">
        <div className="section-head">
          <h2 id="c-needs">What your town needs</h2>
          <span className="muted small">{Math.round(city.harmony * 100)}% happy</span>
        </div>
        {city.population === 0 ? (
          <p className="muted small">Build a home, then some food, fun and calm. Residents move in when there is a free home and the town can keep them content.</p>
        ) : (
          <ul className="list needs">
            {NEEDS.map((n) => (
              <li key={n}>
                <span>{NEED_LABEL[n]}</span>
                <XpBar value={city.coverage[n]} label={`${NEED_LABEL[n]} coverage`} className={`bar thin ${n === 'calm' ? 'teal' : ''}`} />
                <span className="muted small">
                  {city.supply[n]} / {city.population}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="c-event">
        <div className="section-head">
          <h2 id="c-event">{week.def.name}</h2>
          <span className="muted small">This week</span>
        </div>
        <p className="muted small">
          {week.def.blurb} {week.def.metric === 'xp' ? `Earn ${week.def.goal} XP` : week.def.metric === 'days' ? `Be active on ${week.def.goal} days` : `Complete ${week.def.goal} ${week.def.metric === 'any' ? 'things' : week.def.metric}`}.
        </p>
        <XpBar value={progress / week.def.goal} label="Event progress" className="bar thin teal" />
        <div className="section-head" style={{ marginTop: 8 }}>
          <span className="muted small">
            {Math.min(progress, week.def.goal)} / {week.def.goal}
          </span>
          {claimed ? (
            <span className="small gem">Claimed · +{week.def.reward} gems</span>
          ) : (
            <button type="button" className="btn small primary" disabled={!done} onClick={() => void act.claimEvent()}>
              {done ? `Claim ${week.def.reward} gems` : `${week.def.reward} gems reward`}
            </button>
          )}
        </div>
      </section>

      <section aria-labelledby="c-res">
        <div className="section-head">
          <h2 id="c-res">Residents & visitors</h2>
          <span className="muted small">
            {snap.city.residents.length} of {rosterSize(premium)}
          </span>
        </div>
        {snap.city.residents.length ? (
          <ul className="list">
            {snap.city.residents.map((r, i) => {
              const entry = rosterEntry(r.id);
              return (
                <li key={r.id} className="card resident">
                  <ResidentFace species={entry.species} size={48} />
                  <div className="grow">
                    <strong>
                      {entry.name} <span className="muted small">{entry.title}</span>
                    </strong>
                    <p className="bubble">“{lineFor(entry, ctx, i)}”</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty icon="city" title="No one lives here yet">
            <p>Build a home and a few things to eat, enjoy and relax in. A friend will move in once the town is ready.</p>
          </Empty>
        )}
        {visitor.unlocked ? (
          <button type="button" className="card rohld-card rohld-card-open" onClick={greetRohld} aria-label="Talk with Rohld, a visiting penguin">
            <RohldFace size={64} />
            <span className="grow"><strong>Rohld <span className="visitor-tag">Visiting friend</span></strong><span className="muted small">A cheerful travelling penguin has found your town.</span></span>
            <span className="btn small">Say hello</span>
          </button>
        ) : (
          <div className="card rohld-card" aria-label="Rohld visitor unlock progress">
            <RohldFace size={64} />
            <div className="grow">
              <strong>Someone is making their way here…</strong>
              <p className="muted small">Meet Rohld after completing a quest, project, or chore on {ROHLD_UNLOCK_DAYS} different days. It doesn’t need to be a streak.</p>
              <XpBar value={visitor.days / ROHLD_UNLOCK_DAYS} label="Rohld unlock progress" className="bar thin teal" />
              <span className="muted small">{visitor.days} / {ROHLD_UNLOCK_DAYS} successful days</span>
            </div>
          </div>
        )}
        {!premium && (
          <div className="card locked-cta" style={{ marginTop: 8 }}>
            <span style={{ display: 'flex', gap: 4 }} aria-hidden="true">
              {ROSTER.filter((r) => r.premium).map((r) => (
                <ResidentFace key={r.id} species={r.species} size={36} />
              ))}
            </span>
            <span className="small grow">Ember, Luna and Gale only move into Premium towns.</span>
            <button type="button" className="btn small" onClick={() => act.openPaywall('resident')}>
              <span className="premium-badge">Premium</span>
            </button>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="c-land">
        <div className="section-head">
          <h2 id="c-land">Land</h2>
          <span className="muted small">
            {size} × {size}
          </span>
        </div>
        {atFreeCap ? (
          <>
            <p className="muted small">
              Free towns grow to {landSize(FREE_LAND_MAX_LEVEL)} × {landSize(FREE_LAND_MAX_LEVEL)}. Premium lets yours reach {landSize(LAND_MAX_LEVEL)} × {landSize(LAND_MAX_LEVEL)} and triples daily income.
            </p>
            <button type="button" className="btn" onClick={() => act.openPaywall('land')}>
              <span className="premium-badge">Premium</span>
              Grow beyond {landSize(FREE_LAND_MAX_LEVEL)} × {landSize(FREE_LAND_MAX_LEVEL)}
            </button>
          </>
        ) : nextLand === null ? (
          <p className="muted small">Your town has all the land it can have. Make every tile count.</p>
        ) : (
          <>
            <p className="muted small">Space is limited, so choose what goes where. A bigger plot costs more each time.</p>
            <button type="button" className="btn" disabled={gems < nextLand} onClick={() => void expand()}>
              <Icon name="plus" />
              {gems < nextLand ? `Expand land · ${nextLand - gems} gems to go` : `Expand land · ${nextLand} gems`}
            </button>
          </>
        )}
      </section>

      <section aria-labelledby="c-shop">
        <div className="section-head">
          <h2 id="c-shop">Town shop</h2>
          <span className="muted small">Pay in gems</span>
        </div>
        <div className="stack">
          {CATEGORY_ORDER.map((cat) => {
            const defs = Object.values(BUILDINGS).filter((d) => d.category === cat && (!d.season || d.season === season));
            if (!defs.length) return null;
            return (
              <div key={cat} className="stack" role="group" aria-label={CATEGORY_LABEL[cat]}>
                <h3 className="small muted">{CATEGORY_LABEL[cat]}</h3>
                <ul className="list">
                  {defs.map((d) => {
                    const lock = buildable(d);
                    const short = d.cost - gems;
                    return (
                      <li key={d.id} className="card shop-item">
                        <BuildingArt type={d.id} size={44} />
                        <div className="grow">
                          <strong>{d.name}</strong>
                          <p className="muted small">{statLine(d)}</p>
                        </div>
                        {lock === 'Premium' ? (
                          <button type="button" className="btn small" aria-label={`${d.name}: part of Premium`} onClick={() => act.openPaywall('building')}>
                            <span className="premium-badge">Premium</span>
                          </button>
                        ) : (
                          <button type="button" className="btn small" disabled={lock !== null || short > 0 || free === 0} aria-label={lock ? `${d.name}: ${lock}` : short > 0 ? `${d.name}: ${short} more gems needed` : free === 0 ? `${d.name}: no free tiles` : `Build ${d.name} for ${d.cost} gems`} onClick={() => startPlacing(d.id)}>
                            {lock ?? (free === 0 ? 'No room' : short > 0 ? `${short} to go` : `${d.cost} gems`)}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={talking !== null} onClose={() => setTalking(null)} title={talking ? rosterEntry(talking).name : ''}>
        {talking && <div className="town-conversation"><ResidentFace species={rosterEntry(talking).species} size={96}/><p className="muted small">{rosterEntry(talking).title}</p><p>“{lineFor(rosterEntry(talking), ctx, snap.city.residents.findIndex(r => r.id === talking), visits[talking] ?? 1)}”</p><p className="small muted">Favorite place: {BUILDINGS[rosterEntry(talking).fav].name}</p></div>}
      </Dialog>

      <Dialog open={rohldTalking} onClose={() => setRohldTalking(false)} title="Rohld">
        <div className="town-conversation rohld-conversation"><RohldFace size={112}/><p className="muted small">A travelling penguin · New friend</p><p>“{rohldLine(today, rohldVisits)}”</p><p className="small muted">He drops by whenever your town feels like a good place to pause.</p></div>
      </Dialog>

      <Dialog open={sheet?.kind === 'pick'} onClose={() => setSheet(null)} title="What shall we build here?">
        {sheet?.kind === 'pick' && (
          <ul className="list">
            {Object.values(BUILDINGS)
              .filter((d) => !d.season || d.season === season)
              .map((d) => {
                const lock = buildable(d);
                const ok = lock === null && gems >= d.cost;
                const paid = lock === 'Premium';
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      className="card shop-item pick"
                      disabled={!ok && !paid}
                      onClick={() => {
                        if (paid) {
                          setSheet(null);
                          act.openPaywall('building');
                        } else void place(d.id, sheet.x, sheet.y);
                      }}
                    >
                      <BuildingArt type={d.id} size={40} />
                      <span className="grow">
                        <strong>{d.name}</strong>
                        <span className="muted small block">{statLine(d)}</span>
                      </span>
                      <span className="small gem">{lock ?? `${d.cost} gems`}</span>
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </Dialog>

      <Dialog open={target !== undefined} onClose={() => setSheet(null)} title={target ? BUILDINGS[target.type].name : ''}>
        {target && (
          <>
            <div className="center">
              <BuildingArt type={target.type} size={96} />
            </div>
            <p>{BUILDINGS[target.type].blurb}</p>
            <p className="muted small">{statLine(BUILDINGS[target.type])}</p>
            <button type="button" className="btn danger" data-autofocus onClick={() => void sell(target)}>
              Sell for {sellValue(BUILDINGS[target.type].cost)} gems
            </button>
          </>
        )}
      </Dialog>
    </div>
  );
}
