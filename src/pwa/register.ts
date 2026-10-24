import '../flags';
/*
 * Service worker registration, update flow and install prompt.
 * The worker only ever serves this app's own files from its own origin.
 */

export interface PwaState {
  /** A new version is downloaded and waiting. */
  updateReady: boolean;
  /** The browser has offered an install prompt we can trigger. */
  canInstall: boolean;
  /** The app shell is cached and will open without a connection. */
  offlineReady: boolean;
  /** Running as an installed app. */
  standalone: boolean;
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let state: PwaState = { updateReady: false, canInstall: false, offlineReady: false, standalone: false };
const listeners = new Set<(s: PwaState) => void>();
let waiting: ServiceWorker | null = null;
let installEvent: InstallPromptEvent | null = null;

function set(patch: Partial<PwaState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

export const getPwaState = (): PwaState => state;

export function subscribePwa(fn: (s: PwaState) => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function initPwa(): void {
  set({ standalone: window.matchMedia('(display-mode: standalone)').matches });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    set({ canInstall: false, standalone: true });
  });

  // The Android app ships its files inside the APK, so it needs no service worker.
  if (__DEV__ || __QA_TARGET__ === 'android' || !('serviceWorker' in navigator)) return;

  const track = (worker: ServiceWorker | null) => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          waiting = worker;
          set({ updateReady: true });
        } else {
          set({ offlineReady: true });
        }
      }
    });
  };

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload for an update the user accepted, not for the first install.
    if (reloading || !state.updateReady) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((reg) => {
      if (reg.active) set({ offlineReady: true });
      if (reg.waiting && navigator.serviceWorker.controller) {
        waiting = reg.waiting;
        set({ updateReady: true });
      }
      track(reg.installing);
      reg.addEventListener('updatefound', () => track(reg.installing));
    })
    .catch(() => {
      // Not a secure context (e.g. opened over plain http on a LAN address).
      // The app still works; it just cannot be installed or used offline.
    });
}

/** Activates the waiting version; the page reloads once it takes control. */
export function applyUpdate(): void {
  waiting?.postMessage('SKIP_WAITING');
}

export async function promptInstall(): Promise<void> {
  if (!installEvent) return;
  await installEvent.prompt();
  await installEvent.userChoice.catch(() => undefined);
  installEvent = null;
  set({ canInstall: false });
}
