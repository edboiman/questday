import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadDemo } from '../data/demo';
import type { BillingProvider, Offer, PurchaseOutcome } from '../billing/types';
import { reconcile } from '../billing/entitlement';
import type { PremiumFeature } from '../domain/premium';
import { AppError, type ChoreDraft, type ChoreFields, type Repo, type RewardFields, type TaskDraft, type TaskFields } from '../data/repo';
import { makeExport } from '../data/transfer';
import { ACHIEVEMENTS } from '../domain/achievements';
import { now } from '../clock';
import '../flags';
import { toDay } from '../domain/dates';
import { cityStats, seasonOf, type CityStats, type Season } from '../domain/city';
import { activeDays, dayStat, gemBalance, streaks, totals, type Totals } from '../domain/stats';
import { EMPTY_SNAPSHOT, type BuildingId, type Chore, type Day, type Reward, type Settings, type Snapshot } from '../domain/types';
import { levelInfo, type LevelInfo } from '../domain/xp';

export type Editor = { kind: 'task'; id?: string; preset?: Partial<TaskFields> } | { kind: 'chore'; id?: string } | { kind: 'reward'; id?: string } | null;

export interface Toast {
  id: number;
  tone: 'xp' | 'info' | 'error' | 'trophy';
  text: string;
  detail?: string;
  undoId?: string;
}

/** A little "+25 XP" that floats up from where you tapped. */
export interface Pop {
  id: number;
  text: string;
  kind: 'xp' | 'coin' | 'gem';
  x: number;
  y: number;
  delay: number;
}

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
}

interface Actions {
  addTask(draft: TaskDraft): Promise<boolean>;
  updateTask(id: string, patch: Partial<TaskFields>): Promise<boolean>;
  deleteTask(id: string): Promise<void>;
  completeTask(id: string): Promise<void>;
  reopenTask(id: string): Promise<void>;
  toggleSubtask(taskId: string, subtaskId: string): Promise<void>;
  addChore(draft: ChoreDraft): Promise<boolean>;
  updateChore(id: string, patch: Partial<ChoreFields>): Promise<boolean>;
  deleteChore(id: string): Promise<void>;
  completeChore(chore: Chore): Promise<void>;
  skipChore(chore: Chore): Promise<void>;
  undo(eventId: string): Promise<void>;
  addReward(fields: RewardFields): Promise<boolean>;
  updateReward(id: string, patch: Partial<RewardFields>): Promise<boolean>;
  deleteReward(id: string): Promise<void>;
  redeem(reward: Reward): Promise<void>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  exportText(): string;
  importData(data: Snapshot, mode: 'replace' | 'merge'): Promise<boolean>;
  wipe(): Promise<void>;
  loadDemo(): Promise<void>;
  removeDemo(): Promise<void>;
  openPaywall(feature: PremiumFeature): void;
  closePaywall(): void;
  buyPremium(): Promise<PurchaseOutcome>;
  restorePremium(): Promise<PurchaseOutcome>;
  /** Personal build only. */
  setPremiumAdmin(active: boolean): Promise<void>;
  /** Personal build only. */
  adminAdjust(delta: { xp: number; coins: number; gems: number }): Promise<boolean>;
  collect(exhibitId: string): Promise<void>;
  build(type: BuildingId, x: number, y: number): Promise<boolean>;
  sellBuilding(id: string): Promise<void>;
  expandLand(): Promise<void>;
  claimEvent(): Promise<void>;
}

interface Store {
  status: 'loading' | 'ready' | 'error';
  snap: Snapshot;
  today: Day;
  totals: Totals;
  gems: number;
  city: CityStats;
  season: Season;
  level: LevelInfo;
  todayStat: { count: number; xp: number };
  streak: { current: number; best: number };
  act: Actions;
  premium: boolean;
  billing: { canPurchase: boolean; offer: Offer | null };
  paywall: PremiumFeature | null;
  toasts: Toast[];
  pops: Pop[];
  dismissToast(id: number): void;
  notify(text: string, tone?: Toast['tone']): void;
  levelUp: number | null;
  dismissLevelUp(): void;
  editor: Editor;
  openEditor(editor: Editor): void;
  confirmRequest: ConfirmOptions | null;
  confirm(options: ConfirmOptions): Promise<boolean>;
  answerConfirm(yes: boolean): void;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider is missing');
  return store;
}

/** User-facing text for a failure. Never includes stored content or internals. */
function friendly(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return 'That didn’t save. Nothing was changed — please try again.';
}

let toastSeq = 0;

export function StoreProvider({ repo, billing, children }: { repo: Repo; billing: BillingProvider; children: ReactNode }) {
  const [status, setStatus] = useState<Store['status']>('loading');
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [today, setToday] = useState<Day>(() => toDay(now()));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [premium, setPremium] = useState(false);
  const [paywall, setPaywall] = useState<PremiumFeature | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const lastCheck = useRef(0);
  const lastTap = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmOptions | null>(null);
  const snapRef = useRef(snap);
  const confirmResolve = useRef<((yes: boolean) => void) | null>(null);

  const dismissToast = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const pushToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = ++toastSeq;
      setToasts((list) => [...list.slice(-2), { ...toast, id }]);
      window.setTimeout(() => dismissToast(id), toast.undoId ? 7000 : 4500);
    },
    [dismissToast],
  );

  // Remember where the last tap was, so rewards can pop up from it.
  useEffect(() => {
    const onDown = (e: PointerEvent) => (lastTap.current = { x: e.clientX, y: e.clientY });
    window.addEventListener('pointerdown', onDown, { passive: true, capture: true });
    return () => window.removeEventListener('pointerdown', onDown, { capture: true });
  }, []);

  const celebrate = useCallback((e: { xp: number; coins: number; gems: number }) => {
    const { x, y } = lastTap.current;
    const parts: [string, Pop['kind']][] = [[`+${e.xp} XP`, 'xp'], [`+${e.coins}`, 'coin'], [`+${e.gems}`, 'gem']];
    const made = parts.filter(([text]) => !/^\+0\b/.test(text)).map(([text, kind], i) => ({ id: ++toastSeq, text: kind === 'coin' ? `${text} coins` : kind === 'gem' ? `${text} gems` : text, kind, x: Math.min(window.innerWidth - 60, Math.max(60, x + (i - 1) * 18)), y: y - i * 26, delay: i * 120 }));
    setPops((list) => [...list.slice(-6), ...made]);
    window.setTimeout(() => setPops((list) => list.filter((p) => !made.includes(p))), 1600);
  }, []);

  const notify = useCallback((text: string, tone: Toast['tone'] = 'info') => pushToast({ tone, text }), [pushToast]);

  const refresh = useCallback(async () => {
    const [next, isPremium] = await Promise.all([repo.snapshot(), repo.isPremium()]);
    setPremium(isPremium);
    snapRef.current = next;
    setSnap(next);
    return next;
  }, [repo]);

  // Initial load.
  useEffect(() => {
    let alive = true;
    repo
      .syncAchievements()
      .then(() => refresh())
      .then(() => alive && setStatus('ready'))
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [repo, refresh]);

  // Roll over to a new day while the app stays open, and pick up changes made in another tab.
  useEffect(() => {
    const tick = () => {
      setToday(toDay(now()));
      if (document.visibilityState === 'visible') void refresh().catch(() => undefined);
    };
    const timer = window.setInterval(() => setToday(toDay(now())), 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);

  /** Runs a write, then re-reads state, records achievements and celebrates. */
  const mutate = useCallback(
    async <T,>(fn: () => Promise<T>, celebrate = false): Promise<{ ok: true; value: T } | { ok: false }> => {
      const levelBefore = levelInfo(totals(snapRef.current.events).xp).level;
      try {
        const value = await fn();
        const unlocked = await repo.syncAchievements();
        const next = await refresh();
        const levelAfter = levelInfo(totals(next.events).xp).level;
        if (celebrate && levelAfter > levelBefore) setLevelUp(levelAfter);
        for (const id of unlocked) {
          const def = ACHIEVEMENTS.find((a) => a.id === id);
          if (def) pushToast({ tone: 'trophy', text: `Achievement unlocked: ${def.name}`, detail: def.description });
        }
        return { ok: true, value };
      } catch (error) {
        pushToast({ tone: 'error', text: friendly(error) });
        await refresh().catch(() => undefined);
        return { ok: false };
      }
    },
    [repo, refresh, pushToast],
  );

  // Pay the town's daily income and welcome new residents, once per day.
  useEffect(() => {
    if (status !== 'ready') return;
    let alive = true;
    void (async () => {
      const result = await mutate(() => repo.collectCity());
      if (!alive || !result.ok) return;
      const { gems, arrived } = result.value;
      if (gems > 0) pushToast({ tone: 'info', text: `Your town earned ${gems} gems` });
      if (arrived) pushToast({ tone: 'trophy', text: `${arrived.name} ${arrived.title} moved in!`, detail: 'A new neighbour for your town.' });
    })();
    return () => {
      alive = false;
    };
  }, [status, today, repo, mutate, pushToast]);

  /**
   * Brings this device's Premium flag in line with Google Play (via the billing provider).
   * No network never takes Premium away (see billing/entitlement.ts).
   */
  const syncOnce = useCallback(
    async (fresh?: Awaited<ReturnType<BillingProvider['check']>>) => {
      let check = fresh ?? (await billing.check());
      if (check.kind === 'inactive' && typeof navigator !== 'undefined' && navigator.onLine === false) check = { kind: 'unknown' };
      const { next, change } = reconcile(await repo.premiumState(), check);
      if (!change) return;
      await repo.setPremium(next.active, 'play');
      await refresh();
      if (change === 'unlocked') pushToast({ tone: 'trophy', text: 'Premium is active. Thank you!', detail: 'The museum, faster levelling and more town options are open.' });
      else pushToast({ tone: 'info', text: 'Premium is no longer active on this Google account.', detail: 'Everything you already collected and built stays yours.' });
    },
    [billing, repo, refresh, pushToast],
  );

  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const syncEntitlement = useCallback(
    // Runs one at a time, so overlapping checks (purchase result + "back online") can't double-apply.
    (fresh?: Awaited<ReturnType<BillingProvider['check']>>) => (syncQueue.current = syncQueue.current.catch(() => undefined).then(() => syncOnce(fresh))),
    [syncOnce],
  );

  useEffect(() => {
    if (status !== 'ready' || !billing.canPurchase) return;
    void billing.init().then(async () => {
      setOffer(await billing.offer());
      await syncEntitlement();
    });
    billing.onChange((c) => void syncEntitlement(c));
    const maybeCheck = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck.current < 60_000) return;
      lastCheck.current = Date.now();
      void syncEntitlement();
    };
    const onOnline = () => {
      lastCheck.current = 0;
      maybeCheck();
      void billing.offer().then(setOffer);
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', maybeCheck);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', maybeCheck);
    };
  }, [status, billing, syncEntitlement]);

  const act = useMemo<Actions>(() => {
    const ok = async (p: Promise<{ ok: boolean }>) => (await p).ok;
    const run = async (p: Promise<unknown>) => void (await p);
    return {
      addTask: (draft) => ok(mutate(() => repo.addTask(draft))),
      updateTask: (id, patch) => ok(mutate(() => repo.updateTask(id, patch))),
      deleteTask: (id) => run(mutate(() => repo.deleteTask(id))),
      completeTask: async (id) => {
        const result = await mutate(() => repo.completeTask(id), true);
        if (result.ok && result.value) {
          const e = result.value;
          pushToast({ tone: 'xp', text: `+${e.xp} XP · +${e.coins} coins · +${e.gems} gems`, detail: e.title, undoId: e.id });
          celebrate(e);
        }
      },
      reopenTask: (id) => run(mutate(() => repo.reopenTask(id))),
      toggleSubtask: (taskId, subtaskId) => run(mutate(() => repo.toggleSubtask(taskId, subtaskId))),
      addChore: (draft) => ok(mutate(() => repo.addChore(draft))),
      updateChore: (id, patch) => ok(mutate(() => repo.updateChore(id, patch))),
      deleteChore: (id) => run(mutate(() => repo.deleteChore(id))),
      completeChore: async (chore) => {
        const result = await mutate(() => repo.completeChore(chore.id, chore.nextDue), true);
        if (result.ok && result.value) {
          const e = result.value;
          pushToast({ tone: 'xp', text: `+${e.xp} XP · +${e.coins} coins · +${e.gems} gems`, detail: e.title, undoId: e.id });
          celebrate(e);
        }
      },
      skipChore: (chore) => run(mutate(() => repo.skipChore(chore.id, chore.nextDue))),
      undo: (eventId) => run(mutate(() => repo.undoEvent(eventId))),
      addReward: (fields) => ok(mutate(() => repo.addReward(fields))),
      updateReward: (id, patch) => ok(mutate(() => repo.updateReward(id, patch))),
      deleteReward: (id) => run(mutate(() => repo.deleteReward(id))),
      redeem: async (reward) => {
        const result = await mutate(() => repo.redeem(reward.id));
        if (result.ok) pushToast({ tone: 'info', text: 'Reward redeemed — enjoy it!', detail: reward.name, undoId: result.value.id });
      },
      saveSettings: (patch) => run(mutate(() => repo.saveSettings(patch))),
      exportText: () => JSON.stringify(makeExport(snapRef.current, now()), null, 2),
      importData: (data, mode) => ok(mutate(() => repo.importData(data, mode))),
      wipe: () => run(mutate(() => repo.wipe())),
      loadDemo: () => run(mutate(() => loadDemo(repo, toDay(now())))),
      removeDemo: () => run(mutate(() => repo.removeDemo())),
      openPaywall: (feature) => setPaywall(feature),
      closePaywall: () => setPaywall(null),
      buyPremium: async () => {
        const outcome = await billing.purchase();
        if (outcome.kind === 'purchased') {
          await syncEntitlement({ kind: 'active' });
          setPaywall(null);
        }
        return outcome;
      },
      restorePremium: async () => {
        const outcome = await billing.restore();
        if (outcome.kind === 'purchased') {
          await syncEntitlement({ kind: 'active' });
          setPaywall(null);
        }
        return outcome;
      },
      setPremiumAdmin: __QA_ADMIN__ ? (active) => run(mutate(() => repo.setPremium(active, 'admin'))) : async () => undefined,
      adminAdjust: __QA_ADMIN__
        ? async (delta) => {
            const result = await mutate(() => repo.adminAdjust(delta), true);
            if (result.ok) pushToast({ tone: 'info', text: 'Admin adjustment applied', detail: `${delta.xp} XP · ${delta.coins} coins · ${delta.gems} gems` });
            return result.ok;
          }
        : async () => false,
      collect: async (exhibitId) => {
        const result = await mutate(() => repo.collect(exhibitId));
        if (!result.ok) return;
        pushToast({ tone: 'info', text: `${result.value.event.title} joined your museum`, detail: `${result.value.event.coins} coins` });
        if (result.value.bonus) pushToast({ tone: 'trophy', text: result.value.bonus.title, detail: `+${result.value.bonus.gems} gems for your town` });
      },
      build: async (type, x, y) => {
        const result = await mutate(() => repo.build(type, x, y));
        if (!result.ok) return false;
        const { event, arrived } = result.value;
        pushToast({ tone: 'info', text: event.title, detail: `${event.gems} gems`, undoId: event.id });
        if (arrived) pushToast({ tone: 'trophy', text: `${arrived.name} ${arrived.title} moved in!`, detail: 'A new neighbour for your town.' });
        return true;
      },
      sellBuilding: async (id) => {
        const result = await mutate(() => repo.sellBuilding(id));
        if (result.ok) pushToast({ tone: 'info', text: result.value.title, detail: `+${result.value.gems} gems` });
      },
      expandLand: async () => {
        const result = await mutate(() => repo.expandLand());
        if (result.ok) pushToast({ tone: 'info', text: 'Your town grew!', detail: 'More land to build on.' });
      },
      claimEvent: async () => {
        const result = await mutate(() => repo.claimWeeklyEvent());
        if (result.ok && result.value) pushToast({ tone: 'trophy', text: `${result.value.title} complete`, detail: `+${result.value.gems} gems` });
      },
    };
  }, [repo, mutate, pushToast, celebrate, billing, syncEntitlement]);

  const confirm = useCallback((options: ConfirmOptions) => {
    confirmResolve.current?.(false);
    setConfirmRequest(options);
    return new Promise<boolean>((resolve) => {
      confirmResolve.current = resolve;
    });
  }, []);

  const answerConfirm = useCallback((yes: boolean) => {
    confirmResolve.current?.(yes);
    confirmResolve.current = null;
    setConfirmRequest(null);
  }, []);

  const derived = useMemo(() => {
    const t = totals(snap.events);
    const city = cityStats(snap.city.buildings, snap.city.residents.length);
    return { totals: t, gems: gemBalance(snap.events), city, season: seasonOf(today), level: levelInfo(t.xp), todayStat: dayStat(snap.events, today), streak: streaks(activeDays(snap.events), today) };
  }, [snap.events, snap.city, today]);

  const store: Store = {
    status,
    snap,
    today,
    ...derived,
    act,
    premium,
    billing: { canPurchase: billing.canPurchase, offer },
    paywall,
    toasts,
    pops,
    dismissToast,
    notify,
    levelUp,
    dismissLevelUp: useCallback(() => setLevelUp(null), []),
    editor,
    openEditor: setEditor,
    confirmRequest,
    confirm,
    answerConfirm,
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
