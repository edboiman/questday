/*
 * Persistence boundary.
 *
 * The rest of the app only talks to the `Storage` interface: a set of tables
 * keyed by `id`, read and written inside atomic transactions. Two adapters:
 *
 *   IdbStorage     IndexedDB, used in the browser.
 *   MemoryStorage  in-memory with the same atomic semantics, used by tests.
 *
 * A future sync adapter can implement the same interface (or wrap IdbStorage
 * and observe writes) without touching business logic.
 *
 * NOTE: IndexedDB is NOT encrypted. Anyone with access to the unlocked device
 * or browser profile can read this data.
 */

export const TABLES = ['tasks', 'chores', 'events', 'rewards', 'achievements', 'meta', 'city', 'residents'] as const;
export type Table = (typeof TABLES)[number];

export interface Row {
  id: string;
}

export interface Tx {
  get<T extends Row>(table: Table, id: string): Promise<T | undefined>;
  all<T extends Row>(table: Table): Promise<T[]>;
  /** Insert only; fails (and aborts the transaction) if the id already exists. */
  add<T extends Row>(table: Table, row: T): Promise<void>;
  put<T extends Row>(table: Table, row: T): Promise<void>;
  del(table: Table, id: string): Promise<void>;
  clear(table: Table): Promise<void>;
}

export interface Storage {
  /** Runs `fn` in one atomic transaction. If `fn` throws, nothing is written. */
  tx<T>(mode: 'r' | 'rw', fn: (tx: Tx) => Promise<T>): Promise<T>;
  close(): void;
}

// ---------------------------------------------------------------- in-memory

export class MemoryStorage implements Storage {
  private tables = new Map<Table, Map<string, Row>>(TABLES.map((t) => [t, new Map()]));
  private queue: Promise<unknown> = Promise.resolve();

  tx<T>(mode: 'r' | 'rw', fn: (tx: Tx) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const draft = new Map<Table, Map<string, Row>>([...this.tables].map(([t, rows]) => [t, new Map(rows)]));
      const table = (t: Table) => draft.get(t)!;
      const tx: Tx = {
        get: async <R extends Row>(t: Table, id: string) => {
          const row = table(t).get(id);
          return row ? (structuredClone(row) as R) : undefined;
        },
        all: async <R extends Row>(t: Table) => [...table(t).values()].map((r) => structuredClone(r) as R),
        add: async (t, row) => {
          if (table(t).has(row.id)) throw new Error('Key already exists');
          table(t).set(row.id, structuredClone(row));
        },
        put: async (t, row) => void table(t).set(row.id, structuredClone(row)),
        del: async (t, id) => void table(t).delete(id),
        clear: async (t) => table(t).clear(),
      };
      const result = await fn(tx);
      if (mode === 'rw') this.tables = draft;
      return result;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  close(): void {}
}

// ---------------------------------------------------------------- IndexedDB

// v2 adds the 'city' and 'residents' tables. Existing data is untouched.
const DB_VERSION = 2;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Storage request failed'));
  });
}

export class IdbStorage implements Storage {
  private db: Promise<IDBDatabase>;

  constructor(name: string) {
    this.db = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const open = indexedDB.open(name, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        for (const table of TABLES) {
          if (!db.objectStoreNames.contains(table)) db.createObjectStore(table, { keyPath: 'id' });
        }
      };
      open.onsuccess = () => {
        const db = open.result;
        // Another tab upgraded the schema: step aside rather than block it.
        db.onversionchange = () => db.close();
        resolve(db);
      };
      open.onerror = () => reject(open.error ?? new Error('Could not open storage'));
      open.onblocked = () => reject(new Error('Storage is blocked by another tab'));
    });
  }

  async tx<T>(mode: 'r' | 'rw', fn: (tx: Tx) => Promise<T>): Promise<T> {
    const db = await this.db;
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(TABLES, mode === 'r' ? 'readonly' : 'readwrite');
      let result: T;
      let failure: unknown;
      t.oncomplete = () => resolve(result);
      t.onabort = () => reject(failure ?? t.error ?? new Error('Storage transaction aborted'));
      const store = (table: Table) => t.objectStore(table);
      const tx: Tx = {
        get: <R extends Row>(table: Table, id: string) => request(store(table).get(id)) as Promise<R | undefined>,
        all: <R extends Row>(table: Table) => request(store(table).getAll()) as Promise<R[]>,
        add: async (table, row) => void (await request(store(table).add(row))),
        put: async (table, row) => void (await request(store(table).put(row))),
        del: async (table, id) => void (await request(store(table).delete(id))),
        clear: async (table) => void (await request(store(table).clear())),
      };
      fn(tx).then(
        (value) => {
          result = value;
        },
        (error) => {
          failure = error;
          try {
            t.abort();
          } catch {
            reject(error);
          }
        },
      );
    });
  }

  close(): void {
    void this.db.then((db) => db.close()).catch(() => undefined);
  }
}
