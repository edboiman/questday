import { useEffect, useRef, useState } from 'react';
import { APP_NAME } from './config';
import { Chores } from './pages/Chores';
import { City } from './pages/City';
import { Progress } from './pages/Progress';
import { Quests } from './pages/Quests';
import { RewardsChapter } from './pages/RewardsChapter';
import { Settings } from './pages/Settings';
import { useStore } from './state/store';
import { resolveTheme } from './themes';
import { Editors } from './ui/editors';
import { Opening } from './ui/Opening';
import { Paywall } from './ui/Paywall';
import { ConfirmDialog, LevelUp, Pops, Toasts } from './ui/overlays';
import { CHAPTERS, PAGES, pageFor, Shell, type Page } from './ui/Shell';

function pageFromHash(): Page {
  return pageFor(window.location.hash.replace(/^#\/?/, ''));
}

/** Tiny hash router with page-turn direction: real links, working back button, no dependency. */
function usePage(): { page: Page; turn: 'forward' | 'back' | null } {
  const [state, setState] = useState<{ page: Page; turn: 'forward' | 'back' | null }>(() => ({ page: pageFromHash(), turn: null }));
  const last = useRef(state.page);
  useEffect(() => {
    const onChange = () => {
      const page = pageFromHash();
      const from = CHAPTERS.findIndex((c) => c.id === last.current);
      const to = CHAPTERS.findIndex((c) => c.id === page);
      const turn = page === last.current ? null : from >= 0 && to >= 0 && to < from ? 'back' : 'forward';
      last.current = page;
      setState({ page, turn });
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return state;
}

export function applyTheme(pref: string): void {
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.dataset.scheme = theme.scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.chrome);
}

/** The opening plays once per visit (per browser tab session). */
function useOpening(): [boolean, () => void] {
  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem('qa-opened') !== '1';
    } catch {
      return true;
    }
  });
  const done = () => {
    try {
      sessionStorage.setItem('qa-opened', '1');
    } catch {
      /* fine: it just plays again next time */
    }
    setShow(false);
  };
  return [show, done];
}

export function App() {
  const { status, snap } = useStore();
  const { page, turn } = usePage();
  const theme = snap.settings.theme;
  const [opening, finishOpening] = useOpening();

  useEffect(() => {
    if (status !== 'ready') return;
    applyTheme(theme);
    // The theme is the only thing cached outside IndexedDB; it avoids a flash on start.
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* storage may be unavailable; the theme still applies */
    }
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [status, theme]);

  useEffect(() => {
    const label = PAGES.find((p) => p.id === page)?.label;
    document.title = label ? `${label} · ${APP_NAME}` : APP_NAME;
  }, [page]);

  if (status === 'error') {
    return (
      <div className="splash" role="alert">
        <div className="stack" style={{ maxWidth: 420 }}>
          <h1>Storage isn’t available</h1>
          <p className="muted">{APP_NAME} keeps everything in this browser’s local database, and it could not be opened. This can happen in private browsing, when site data is blocked, or if another tab is mid-update. Close other tabs of this app and reload.</p>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {status === 'ready' ? (
        <>
          <Shell page={page} turn={turn}>
            {page === 'quests' && <Quests />}
            {page === 'chores' && <Chores />}
            {page === 'city' && <City />}
            {page === 'rewards' && <RewardsChapter />}
            {page === 'progress' && <Progress />}
            {page === 'settings' && <Settings />}
          </Shell>
          <Editors />
          <Paywall />
          <ConfirmDialog />
          <Toasts />
          <Pops />
          <LevelUp />
        </>
      ) : (
        !opening && (
          <div className="splash" role="status">
            <p className="muted">Opening your journal…</p>
          </div>
        )
      )}
      {opening && <Opening onOpen={finishOpening} />}
    </>
  );
}
