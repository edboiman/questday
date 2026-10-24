import { cityStats, landSize } from '../domain/city';
import { LIMITS } from '../domain/limits';
import { owned, wingBonusId, wingComplete, WINGS } from '../domain/museum';
import { describeIssues, EXPORT_FORMAT, EXPORT_VERSION, exportSchema, type ExportFile } from '../domain/schema';
import { balanceOf, gemBalance, isLive } from '../domain/stats';
import { EMPTY_CITY, type Snapshot } from '../domain/types';

export function makeExport(snapshot: Snapshot, now: Date): ExportFile {
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now.toISOString(), data: snapshot };
}

export type ImportResult = { ok: true; data: Snapshot } | { ok: false; errors: string[] };

function duplicateIds(rows: readonly { id: string }[]): boolean {
  return new Set(rows.map((r) => r.id)).size !== rows.length;
}

/** Cross-record checks that a per-record schema cannot express. */
export function integrityErrors(data: Snapshot): string[] {
  const errors: string[] = [];
  const tables: [string, readonly { id: string }[]][] = [
    ['tasks', data.tasks],
    ['chores', data.chores],
    ['events', data.events],
    ['rewards', data.rewards],
    ['achievements', data.achievements],
  ];
  for (const [name, rows] of tables) if (duplicateIds(rows)) errors.push(`${name}: duplicate ids`);
  if (balanceOf(data.events) < 0) errors.push('events: reward balance would be negative');
  if (gemBalance(data.events) < 0) errors.push('events: gem balance would be negative');

  // A wing bonus is only paid for a complete wing.
  const have = owned(data.events);
  for (const e of data.events) {
    if (!isLive(e) || e.kind !== 'event' || e.refId !== 'museum') continue;
    const wing = WINGS.find((w) => wingBonusId(w.id) === e.id);
    if (!wing || !wingComplete(wing.id, have)) errors.push('museum: bonus for an unfinished wing');
  }

  // The city must be explained by the ledger: every building was bought, every expansion was paid for.
  const { buildings, residents, meta } = data.city;
  if (duplicateIds(buildings)) errors.push('city: duplicate building ids');
  if (new Set(residents.map((r) => r.id)).size !== residents.length) errors.push('city: duplicate residents');
  const size = landSize(meta.landLevel);
  const cells = new Set<string>();
  const purchases = new Map<string, number>();
  let expansions = 0;
  for (const e of data.events) {
    if (!isLive(e) || e.kind !== 'build') continue;
    if (e.gems < 0) purchases.set(e.refId, -e.gems);
    if (/^land\d+$/.test(e.refId) && e.gems < 0) expansions++;
  }
  for (const bd of buildings) {
    const key = `${bd.x},${bd.y}`;
    if (cells.has(key)) errors.push('city: two buildings on one tile');
    cells.add(key);
    if (bd.x >= size || bd.y >= size) errors.push('city: building outside the unlocked land');
    if (!purchases.has(bd.id)) errors.push('city: building was not paid for');
  }
  if (residents.length > cityStats(buildings, 0).housing) errors.push('city: more residents than homes');
  if (meta.landLevel > expansions) errors.push('city: land was not paid for');
  return [...new Set(errors)];
}

/**
 * Parses and validates the text of an import file. Imported content is data
 * only: it is parsed with JSON.parse, checked against strict schemas, and
 * never evaluated, merged into objects by key, or rendered as HTML.
 */
export function parseImport(text: string): ImportResult {
  if (typeof text !== 'string' || text.length === 0) return { ok: false, errors: ['The file is empty.'] };
  if (text.length > LIMITS.importChars) return { ok: false, errors: ['The file is too large to be a backup from this app.'] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }
  const parsed = exportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: describeIssues(parsed.error) };
  const data = { ...parsed.data.data, city: parsed.data.data.city ?? EMPTY_CITY } as Snapshot;
  const errors = integrityErrors(data);
  if (errors.length) return { ok: false, errors };
  return { ok: true, data };
}
