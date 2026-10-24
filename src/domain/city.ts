import { addDays, diffDays, parseDay, weekStart } from './dates';
import { isChoreEvent, isEarn, isLive } from './stats';
import type { Building, BuildingId, Day, LedgerEvent, ResidentId } from './types';

/*
 * The city. Everything here is pure: no storage, no clock, no randomness.
 *
 * The challenge is in the choices, never in penalties. Land is scarce and each
 * expansion costs more; residents have needs (food, fun, calm) that your
 * buildings must cover; a balanced city earns a bonus on gems. A poorly
 * balanced city simply earns the base rate. Nothing is ever taken away.
 */

export type Category = 'home' | 'food' | 'fun' | 'calm' | 'shop' | 'decor';
export type Need = 'food' | 'fun' | 'calm';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const NEEDS: readonly Need[] = ['food', 'fun', 'calm'];
export const NEED_LABEL: Record<Need, string> = { food: 'Food', fun: 'Fun', calm: 'Calm' };

export interface BuildingDef {
  id: BuildingId;
  name: string;
  blurb: string;
  category: Category;
  cost: number;
  /** Player level needed before it can be built. */
  level: number;
  housing: number;
  food: number;
  fun: number;
  calm: number;
  /** Gems earned per day. */
  income: number;
  /** Seasonal decorations can only be bought in their season (and stay afterwards). */
  season?: Season;
  /** Part of QuestAday Premium. */
  premium?: boolean;
}

const b = (def: Partial<BuildingDef> & Pick<BuildingDef, 'id' | 'name' | 'blurb' | 'category' | 'cost' | 'level'>): BuildingDef => ({ housing: 0, food: 0, fun: 0, calm: 0, income: 0, ...def });

export const BUILDINGS: Readonly<Record<BuildingId, BuildingDef>> = {
  cottage: b({ id: 'cottage', name: 'Cottage', blurb: 'A snug home for three residents.', category: 'home', cost: 40, level: 1, housing: 3 }),
  townhouse: b({ id: 'townhouse', name: 'Townhouse', blurb: 'Room for eight, on one plot.', category: 'home', cost: 120, level: 3, housing: 8 }),
  bakery: b({ id: 'bakery', name: 'Bakery', blurb: 'Warm bread and a little income.', category: 'food', cost: 50, level: 1, food: 4, income: 1 }),
  market: b({ id: 'market', name: 'Market', blurb: 'Stalls of fresh food. Busy and profitable.', category: 'food', cost: 110, level: 3, food: 8, income: 3 }),
  cafe: b({ id: 'cafe', name: 'Café', blurb: 'A bite and a quiet moment.', category: 'food', cost: 70, level: 2, food: 2, calm: 2, income: 1 }),
  boutique: b({ id: 'boutique', name: 'Boutique', blurb: 'A pretty shop that pays well.', category: 'shop', cost: 80, level: 2, income: 4 }),
  park: b({ id: 'park', name: 'Park', blurb: 'Grass, benches and birdsong.', category: 'calm', cost: 45, level: 1, calm: 4 }),
  fountain: b({ id: 'fountain', name: 'Fountain', blurb: 'A small, soothing plaza.', category: 'calm', cost: 35, level: 1, calm: 2 }),
  library: b({ id: 'library', name: 'Library', blurb: 'Hushed shelves and warm lamps.', category: 'calm', cost: 100, level: 3, calm: 7 }),
  gardens: b({ id: 'gardens', name: 'Gardens', blurb: 'Terraced flowers for the whole town.', category: 'calm', cost: 200, level: 5, calm: 14 }),
  carousel: b({ id: 'carousel', name: 'Carousel', blurb: 'Painted horses, endless laughter.', category: 'fun', cost: 90, level: 2, fun: 5 }),
  cinema: b({ id: 'cinema', name: 'Cinema', blurb: 'Movie nights for everyone.', category: 'fun', cost: 160, level: 4, fun: 10, income: 2 }),
  ferris: b({ id: 'ferris', name: 'Ferris Wheel', blurb: 'The town’s showpiece amusement.', category: 'fun', cost: 320, level: 6, fun: 20 }),
  blossom: b({ id: 'blossom', name: 'Blossom Tree', blurb: 'Spring only. Pink and peaceful.', category: 'decor', cost: 30, level: 1, calm: 2, season: 'spring' }),
  lemonade: b({ id: 'lemonade', name: 'Lemonade Stand', blurb: 'Summer only. Cold, sweet, cheap.', category: 'decor', cost: 30, level: 1, food: 2, season: 'summer' }),
  pumpkin: b({ id: 'pumpkin', name: 'Pumpkin Patch', blurb: 'Autumn only. Orange as far as you can see.', category: 'decor', cost: 30, level: 1, calm: 1, fun: 1, season: 'autumn' }),
  snowman: b({ id: 'snowman', name: 'Snowman', blurb: 'Winter only. Wears a very good scarf.', category: 'decor', cost: 30, level: 1, fun: 2, season: 'winter' }),
  observatory: b({ id: 'observatory', name: 'Observatory', blurb: 'Stargazing nights for the whole town.', category: 'fun', cost: 180, level: 3, fun: 8, calm: 4, income: 2, premium: true }),
  bathhouse: b({ id: 'bathhouse', name: 'Bathhouse', blurb: 'Warm springs and steam. Deeply calming.', category: 'calm', cost: 150, level: 2, calm: 10, income: 1, premium: true }),
  guildhall: b({ id: 'guildhall', name: 'Guildhall', blurb: 'Homes upstairs, a busy hall below.', category: 'home', cost: 220, level: 4, housing: 6, income: 5, premium: true }),
};

export const CATEGORY_LABEL: Record<Category, string> = { home: 'Homes', food: 'Food', fun: 'Amusement', calm: 'Parks & calm', shop: 'Shops', decor: 'Seasonal' };
export const CATEGORY_ORDER: readonly Category[] = ['home', 'food', 'fun', 'calm', 'shop', 'decor'];

// ---------------------------------------------------------------- land

export const LAND_BASE = 4;
export const LAND_MAX_LEVEL = 5;
/** Cost of expanding from level N to N+1. */
export const LAND_COSTS: readonly number[] = [60, 120, 200, 320, 500];
export const landSize = (level: number): number => LAND_BASE + Math.min(Math.max(0, Math.floor(level)), LAND_MAX_LEVEL);
export const MAX_LAND_SIZE = LAND_BASE + LAND_MAX_LEVEL;
export const SELL_REFUND = 0.5;
export const sellValue = (cost: number): number => Math.floor(cost * SELL_REFUND);

// ------------------------------------------------------------ economy

export const GEM_RATE = 0.5;
/** Gems for a completion. `multiplier` is the city's harmony bonus (1–1.5). */
export const gemsFor = (xp: number, multiplier: number): number => Math.max(0, Math.round(xp * GEM_RATE * multiplier));

/** Gems that completions earned before the city existed. Derived, so old data gains them without a migration. */
export const legacyGems = (e: Pick<LedgerEvent, 'kind' | 'xp'>): number => (e.kind === 'task' || e.kind === 'chore' ? Math.round(e.xp * GEM_RATE) : 0);

export interface CityStats {
  housing: number;
  population: number;
  supply: Record<Need, number>;
  /** 0–1 per need: how much of the population that need's buildings can serve. */
  coverage: Record<Need, number>;
  /** Average of the three coverages, 0–1. */
  harmony: number;
  /** Bonus on gems earned from quests: 1 (no bonus) to 1.5. */
  multiplier: number;
  incomePerDay: number;
}

export function cityStats(buildings: readonly Building[], residents: number): CityStats {
  const supply: Record<Need, number> = { food: 0, fun: 0, calm: 0 };
  let housing = 0;
  let income = 0;
  for (const bd of buildings) {
    const def = BUILDINGS[bd.type];
    housing += def.housing;
    income += def.income;
    for (const n of NEEDS) supply[n] += def[n];
  }
  const population = Math.max(0, residents);
  const coverage = { food: 1, fun: 1, calm: 1 } as Record<Need, number>;
  if (population > 0) for (const n of NEEDS) coverage[n] = Math.min(1, supply[n] / population);
  const harmony = (coverage.food + coverage.fun + coverage.calm) / 3;
  return {
    housing,
    population,
    supply,
    coverage,
    harmony,
    multiplier: population > 0 ? Math.round((1 + 0.5 * harmony) * 100) / 100 : 1,
    incomePerDay: income + Math.round(population * harmony),
  };
}

/** Days of income that can accumulate while you are away. Missing days costs nothing; it just stops stacking. */
export const MAX_INCOME_DAYS = 3;

// -------------------------------------------------------------- seasons

export function seasonOf(day: Day): Season {
  const m = parseDay(day).getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export const SEASON_LABEL: Record<Season, string> = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

/** Why a building cannot be built right now, or null if it can. */
export function lockReason(def: BuildingDef, level: number, season: Season, premium: boolean): string | null {
  if (def.premium && !premium) return 'Premium';
  if (def.season && def.season !== season) return `Only in ${SEASON_LABEL[def.season].toLowerCase()}`;
  if (def.level > level) return `Reach level ${def.level}`;
  return null;
}

// ------------------------------------------------------------ residents

export interface RosterEntry {
  id: ResidentId;
  name: string;
  species: 'fox' | 'hedgehog' | 'owl' | 'otter' | 'gardener' | 'bear' | 'rabbit' | 'frog' | 'cat' | 'mayor' | 'dragon' | 'unicorn' | 'griffin';
  title: string;
  fav: BuildingId;
  /** Unique residents who only move into Premium towns. */
  premium?: boolean;
}

/** Residents move in, in this order. */
export const ROSTER: readonly RosterEntry[] = [
  { id: 'pip', name: 'Pip', species: 'fox', title: 'the fox', fav: 'bakery' },
  { id: 'mabel', name: 'Mabel', species: 'hedgehog', title: 'the hedgehog', fav: 'fountain' },
  { id: 'otto', name: 'Otto', species: 'owl', title: 'the owl', fav: 'library' },
  { id: 'juno', name: 'Juno', species: 'otter', title: 'the otter', fav: 'carousel' },
  { id: 'rosa', name: 'Rosa', species: 'gardener', title: 'the gardener', fav: 'gardens' },
  { id: 'bram', name: 'Bram', species: 'bear', title: 'the bear', fav: 'market' },
  { id: 'clover', name: 'Clover', species: 'rabbit', title: 'the rabbit', fav: 'park' },
  { id: 'fen', name: 'Fen', species: 'frog', title: 'the frog', fav: 'cafe' },
  { id: 'mina', name: 'Mina', species: 'cat', title: 'the cat', fav: 'boutique' },
  { id: 'hugo', name: 'Hugo', species: 'mayor', title: 'the mayor', fav: 'ferris' },
  { id: 'ember', name: 'Ember', species: 'dragon', title: 'the little dragon', fav: 'bathhouse', premium: true },
  { id: 'luna', name: 'Luna', species: 'unicorn', title: 'the unicorn', fav: 'observatory', premium: true },
  { id: 'gale', name: 'Gale', species: 'griffin', title: 'the griffin', fav: 'guildhall', premium: true },
];

export const rosterEntry = (id: ResidentId): RosterEntry => ROSTER.find((r) => r.id === id)!;

/** The next resident to move in, or null if everyone is already here. */
export function nextResident(present: readonly { id: ResidentId }[], premium: boolean): RosterEntry | null {
  const have = new Set(present.map((r) => r.id));
  return ROSTER.find((r) => !have.has(r.id) && (premium || !r.premium)) ?? null;
}

/** How many residents a town can ever have. */
export const rosterSize = (premium: boolean): number => ROSTER.filter((r) => premium || !r.premium).length;

/**
 * A new resident arrives when there is a free home AND the town would still be
 * content with one more person (harmony of at least one half). So a home alone
 * is not enough: you have to feed, entertain and calm the people you invite.
 */
export function canWelcome(buildings: readonly Building[], residents: number, premium: boolean): boolean {
  if (residents >= rosterSize(premium)) return false;
  const s = cityStats(buildings, residents + 1);
  return s.housing > residents && s.harmony >= 0.5;
}

export interface DialogueContext {
  stats: CityStats;
  buildings: readonly Building[];
  doneToday: number;
  season: Season;
  today: Day;
}

const NEED_WISH: Record<Need, string> = {
  food: 'Could we have a bit more food around town? No rush at all.',
  fun: 'A little more to do for fun would be lovely, whenever it suits.',
  calm: 'More green and quiet corners would be wonderful, someday.',
};

const SEASON_LINE: Record<Season, string> = {
  spring: 'Blossom season! Everything smells new.',
  summer: 'Long days and warm evenings. Lovely.',
  autumn: 'I do love the autumn leaves.',
  winter: 'Cosy weather. Hot drinks all round.',
};

/** Everything this resident might say today, most relevant first. Gentle and never guilt-inducing. */
export function lines(r: RosterEntry, ctx: DialogueContext): string[] {
  const out: string[] = [];
  const fav = BUILDINGS[r.fav];
  const hasFav = ctx.buildings.some((x) => x.type === r.fav);
  out.push(hasFav ? `The ${fav.name} is my favourite spot in town!` : `I keep daydreaming about a ${fav.name}.`);
  for (const n of NEEDS) if (ctx.stats.population > 0 && ctx.stats.coverage[n] < 0.7) out.push(NEED_WISH[n]);
  out.push(ctx.doneToday > 0 ? `${ctx.doneToday} ${ctx.doneToday === 1 ? 'thing' : 'things'} done today. Nicely done!` : 'No pressure today. The town is ticking along nicely.');
  out.push(SEASON_LINE[ctx.season]);
  if (ctx.stats.harmony >= 0.9 && ctx.stats.population > 1) out.push('Everyone is so happy here. Thank you!');
  return out;
}

/** Short, original lines that give every neighbor a distinct voice. */
const RESIDENT_VOICE: Record<ResidentId, readonly string[]> = {
  pip: ['I spotted a new shortcut. It might be a very small loop.', 'The bakery smells wonderful today.', 'I was only checking on the town. Then I found three interesting things.', 'Do you think foxes can learn to bake? Asking for a friend.'],
  mabel: ['I found a quiet little corner you might like.', 'Small steps still take you somewhere.', 'The fountain makes a lovely thinking sound.', 'I have been saving this nice thought for you.'],
  otto: ['I have a fact, if you have a moment.', 'The library has a book for every sort of day.', 'I stayed up late reading. Again. No regrets.', 'A well kept note is a tiny time machine.'],
  juno: ['The carousel looks ready for an adventure!', 'I can almost hear the town laughing.', 'Shall we take the scenic way around?', 'I have a lot of energy. Luckily, the town is big.'],
  rosa: ['A little care makes a place feel like home.', 'I noticed a new flower by the path.', 'Gardens grow at their own pace. So do we.', 'The leaves are telling me the season is changing.'],
  bram: ['There is something comforting about a busy market.', 'I brought a little patience with me today.', 'A good bench is worth stopping for.', 'The town feels warmer when we look out for one another.'],
  clover: ['I am glad we get to share this little place.', 'The park is lovely when you take your time.', 'I found a lucky leaf. I left it by the path for you.', 'You do not have to do everything today.'],
  fen: ['I have been practising my pond stare.', 'The café is a fine place to be quietly nearby.', 'I am not rushing. I am considering.', 'A little progress is still progress.'],
  mina: ['I have been thinking about a new look for the town.', 'Some days call for a little sparkle.', 'The boutique window catches the afternoon light.', 'I like how every neighbor brings their own color.'],
  hugo: ['As mayor, I officially approve of this very nice day.', 'The town is coming together, one small thing at a time.', 'I have a short speech prepared. It is mostly thank-yous.', 'I checked the town records. You are doing fine.'],
  ember: ['I warmed the bathhouse stones. Just a little.', 'My wings are better at gentle breezes now.', 'I am learning to make a very small puff of smoke.', 'It is nice to have a place where I can be myself.'],
  luna: ['The stars have stories, even in the daytime.', 'I saved a quiet place beside the observatory.', 'Some wishes take their time finding us.', 'The sky seems a little closer from up there.'],
  gale: ['The wind carried a lovely song over the guildhall.', 'I can see the whole town from up here.', 'Even a long journey starts with one good step.', 'I like having a place to return to.'],
};

/** Rotate through personal and town-aware dialogue by day and conversation. */
export function lineFor(r: RosterEntry, ctx: DialogueContext, index: number, visit = 0): string {
  const context = lines(r, ctx);
  const voice = RESIDENT_VOICE[r.id];
  const day = Math.abs(diffDays(ctx.today, '2026-01-01'));
  const count = Math.max(0, Math.trunc(visit));
  // Give each neighbor their own voice first, then alternate personal and
  // town-aware lines on return visits. Inputs fully determine the result.
  if (count % 2 === 0) return voice[(day + index + count / 2) % voice.length]!;
  return context[(day + index + (count - 1) / 2) % context.length]!;
}

// -------------------------------------------------------- weekly events

export interface WeeklyEventDef {
  id: string;
  name: string;
  blurb: string;
  metric: 'quests' | 'chores' | 'xp' | 'days' | 'any';
  goal: number;
  reward: number;
}

export const WEEKLY_EVENTS: readonly WeeklyEventDef[] = [
  { id: 'harvest', name: 'Harvest Festival', blurb: 'Bring in the quests.', metric: 'quests', goal: 6, reward: 40 },
  { id: 'spring-clean', name: 'Great Tidy-Up', blurb: 'Keep the household humming.', metric: 'chores', goal: 5, reward: 40 },
  { id: 'lantern', name: 'Lantern Night', blurb: 'Earn a glow of XP.', metric: 'xp', goal: 100, reward: 50 },
  { id: 'steady', name: 'Steady Steps Fair', blurb: 'Show up on a few different days.', metric: 'days', goal: 4, reward: 45 },
  { id: 'market-day', name: 'Market Day', blurb: 'Anything counts. Do a bit of everything.', metric: 'any', goal: 10, reward: 50 },
  { id: 'parade', name: 'Town Parade', blurb: 'A big week for the town.', metric: 'any', goal: 14, reward: 70 },
];

export interface WeeklyEvent {
  def: WeeklyEventDef;
  /** Monday of the event week. */
  start: Day;
  end: Day;
  /** Ledger id of the claim. Unique per week, so it can be claimed once. */
  claimId: string;
}

export function weeklyEvent(today: Day): WeeklyEvent {
  const start = weekStart(today);
  const index = Math.floor(diffDays(start, '2026-01-05') / 7);
  const def = WEEKLY_EVENTS[((index % WEEKLY_EVENTS.length) + WEEKLY_EVENTS.length) % WEEKLY_EVENTS.length]!;
  return { def, start, end: addDays(start, 6), claimId: `event:${start}` };
}

export function eventProgress(def: WeeklyEventDef, events: readonly LedgerEvent[], start: Day, end: Day): number {
  let count = 0;
  let xp = 0;
  const days = new Set<Day>();
  for (const e of events) {
    if (!isLive(e) || !isEarn(e) || e.day < start || e.day > end) continue;
    const chore = isChoreEvent(e);
    if (def.metric === 'quests' && chore) continue;
    if (def.metric === 'chores' && !chore) continue;
    count++;
    xp += e.xp;
    days.add(e.day);
  }
  return def.metric === 'xp' ? xp : def.metric === 'days' ? days.size : count;
}
