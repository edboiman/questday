import { diffDays } from './dates';
import { isPremiumWing } from './premium';
import { isLive } from './stats';
import type { Day, LedgerEvent } from './types';

/*
 * The museum. Coins buy collectible exhibits. Everything here is pure.
 *
 * Choices matter without punishment: within each wing, rarer exhibits only
 * become available once you own enough of that wing, one exhibit a day is
 * on special, and finishing a wing pays a one-time gem bonus to your town.
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type WingId = 'minerals' | 'fossils' | 'antiquities' | 'space' | 'curios';

export interface Exhibit {
  id: string;
  wing: WingId;
  name: string;
  plaque: string;
  rarity: Rarity;
  price: number;
}

export interface Wing {
  id: WingId;
  name: string;
  blurb: string;
}

export const WINGS: readonly Wing[] = [
  { id: 'minerals', name: 'Hall of Minerals', blurb: 'Crystals and gems from deep underground.' },
  { id: 'fossils', name: 'Fossil Gallery', blurb: 'Creatures from millions of years ago.' },
  { id: 'antiquities', name: 'Antiquities', blurb: 'Treasures from long-lost cities.' },
  { id: 'space', name: 'Space Wing', blurb: 'Pieces of the sky, brought down to earth.' },
  { id: 'curios', name: 'Cabinet of Curiosities', blurb: 'Odd, clever and slightly magical things.' },
];

export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
/** Exhibits of this rarity unlock once you own this many exhibits from the same wing. */
export const RARITY_NEEDS: Record<Rarity, number> = { common: 0, rare: 2, epic: 4, legendary: 5 };

const e = (wing: WingId, id: string, name: string, rarity: Rarity, price: number, plaque: string): Exhibit => ({ id, wing, name, rarity, price, plaque });

export const EXHIBITS: readonly Exhibit[] = [
  e('minerals', 'quartz', 'Quartz Cluster', 'common', 30, 'Six-sided towers of clear crystal, grown slowly over thousands of years.'),
  e('minerals', 'geode', 'Amethyst Geode', 'common', 45, 'A plain grey stone that hides a purple cave inside.'),
  e('minerals', 'emerald', 'Raw Emerald', 'rare', 90, 'Green as a spring meadow, still set in its rock.'),
  e('minerals', 'sapphire', 'Sapphire', 'rare', 110, 'Cut to catch the light. Bluer than the deep sea.'),
  e('minerals', 'opal', 'Fire Opal', 'epic', 200, 'Flickers of every colour dance inside it.'),
  e('minerals', 'stardiamond', 'Star Diamond', 'legendary', 450, 'The museum’s crown jewel. Some say it fell from the sky.'),

  e('fossils', 'ammonite', 'Ammonite', 'common', 30, 'A spiral shell from an ancient sea creature.'),
  e('fossils', 'trilobite', 'Trilobite', 'common', 45, 'One of the first animals with eyes. Older than the dinosaurs.'),
  e('fossils', 'sharktooth', 'Giant Shark Tooth', 'rare', 90, 'From a shark as long as a bus.'),
  e('fossils', 'amber', 'Amber with Insect', 'rare', 110, 'A tiny fly, caught in tree resin and kept perfect.'),
  e('fossils', 'claw', 'Raptor Claw', 'epic', 200, 'Curved, sharp and very fast in its day.'),
  e('fossils', 'trex', 'Tyrannosaur Skull', 'legendary', 450, 'The star of the gallery. Mind the teeth.'),

  e('antiquities', 'pot', 'Painted Clay Pot', 'common', 30, 'Used for olive oil, then forgotten for three thousand years.'),
  e('antiquities', 'coin', 'Bronze Coin', 'common', 45, 'Worn smooth by countless hands at a busy market.'),
  e('antiquities', 'lamp', 'Oil Lamp', 'rare', 90, 'It once lit a reader’s evening, long ago.'),
  e('antiquities', 'scarab', 'Golden Scarab', 'rare', 110, 'A lucky charm, carved with care.'),
  e('antiquities', 'mask', 'Golden Mask', 'epic', 200, 'Calm, shining and ever so slightly watching you.'),
  e('antiquities', 'crown', 'Crystal Crown', 'legendary', 450, 'Worn by a ruler whose name the wind forgot.'),

  e('space', 'meteorite', 'Iron Meteorite', 'common', 30, 'A chunk of metal that crossed the solar system to get here.'),
  e('space', 'moonrock', 'Moon Rock', 'common', 45, 'Grey, dusty and from very far away.'),
  e('space', 'telescope', 'Brass Telescope', 'rare', 90, 'An old explorer’s window on the stars.'),
  e('space', 'astrolabe', 'Astrolabe', 'rare', 110, 'Sailors used it to find their way by the sky.'),
  e('space', 'planet', 'Ringed Planet Model', 'epic', 200, 'A hand-painted world with rings of glass.'),
  e('space', 'comet', 'Comet in a Jar', 'legendary', 450, 'Nobody knows how it got in there. It still glows.'),

  e('curios', 'watch', 'Pocket Watch', 'common', 30, 'Still ticks. Always five minutes fast.'),
  e('curios', 'musicbox', 'Music Box', 'common', 45, 'Plays a tune nobody can quite name.'),
  e('curios', 'snowglobe', 'Snow Globe', 'rare', 90, 'A tiny town, forever in winter.'),
  e('curios', 'ship', 'Ship in a Bottle', 'rare', 110, 'How did they get it in? A mystery.'),
  e('curios', 'bird', 'Clockwork Bird', 'epic', 200, 'Wind it up and it sings for exactly one minute.'),
  e('curios', 'egg', 'Dragon Egg', 'legendary', 450, 'Warm to the touch. Probably fine.'),
];

export const EXHIBIT_IDS: ReadonlySet<string> = new Set(EXHIBITS.map((x) => x.id));
export const exhibit = (id: string): Exhibit | undefined => EXHIBITS.find((x) => x.id === id);

/** Gems paid to the town, once, when a wing is complete. */
export const WING_BONUS = 60;
export const wingBonusId = (wing: WingId): string => `museum:${wing}`;
export const collectId = (exhibitId: string): string => `collect:${exhibitId}`;

/** Exhibit ids you own (live purchases in the ledger). */
export function owned(events: readonly LedgerEvent[]): Map<string, LedgerEvent> {
  const out = new Map<string, LedgerEvent>();
  for (const ev of events) if (isLive(ev) && ev.kind === 'collect') out.set(ev.refId, ev);
  return out;
}

export function ownedInWing(wing: WingId, have: ReadonlyMap<string, unknown>): number {
  return EXHIBITS.filter((x) => x.wing === wing && have.has(x.id)).length;
}

export function wingComplete(wing: WingId, have: ReadonlyMap<string, unknown>): boolean {
  return EXHIBITS.filter((x) => x.wing === wing).every((x) => have.has(x.id));
}

export const PREMIUM_LOCK = 'Part of Premium';

/** Why an exhibit cannot be bought yet, or null if it can. */
export function exhibitLock(x: Exhibit, have: ReadonlyMap<string, unknown>, premium: boolean): string | null {
  if (!premium && isPremiumWing(x.wing)) return PREMIUM_LOCK;
  const need = RARITY_NEEDS[x.rarity];
  const got = ownedInWing(x.wing, have);
  return got >= need ? null : `Own ${need} from this wing first (${got}/${need})`;
}

export const SPECIAL_DISCOUNT = 0.25;

/** Today's special: one exhibit, chosen by date, a quarter off. Skips what you already own. */
export function dailySpecial(today: Day, have: ReadonlyMap<string, unknown>, premium: boolean): Exhibit | null {
  const open = EXHIBITS.filter((x) => !have.has(x.id) && exhibitLock(x, have, premium) === null);
  if (!open.length) return null;
  const n = Math.abs(diffDays(today, '2026-01-01'));
  return open[(n * 7 + 3) % open.length]!;
}

export function priceOf(x: Exhibit, today: Day, have: ReadonlyMap<string, unknown>, premium: boolean): number {
  return dailySpecial(today, have, premium)?.id === x.id ? Math.round(x.price * (1 - SPECIAL_DISCOUNT)) : x.price;
}
