import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { APP_NAME } from '../config';
import { useStore } from '../state/store';
import { Icon, type IconName } from './Icon';
import { Corner } from './Ornaments';
import { UpdateBanner } from './overlays';
import { XpBar } from './rows';

export type Page = 'quests' | 'chores' | 'city' | 'rewards' | 'progress' | 'settings';

interface PageDef {
  id: Page;
  label: string;
  icon: IconName;
  /** Chapters are the book's main sequence, reached by ribbon bookmarks and page turns. */
  chapter?: string;
}

export const PAGES: readonly PageDef[] = [
  { id: 'quests', label: 'Quests', icon: 'quests', chapter: 'Chapter I' },
  { id: 'chores', label: 'Chores', icon: 'chores', chapter: 'Chapter II' },
  { id: 'city', label: 'Town', icon: 'city', chapter: 'Chapter III' },
  { id: 'rewards', label: 'Rewards', icon: 'museum', chapter: 'Chapter IV' },
  { id: 'progress', label: 'Journal', icon: 'progress' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export const CHAPTERS = PAGES.filter((p) => p.chapter);

/** Old links and bookmarks keep working. */
const ALIASES: Record<string, Page> = { home: 'quests', museum: 'rewards' };
export const pageFor = (id: string): Page => ALIASES[id] ?? PAGES.find((p) => p.id === id)?.id ?? 'quests';

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** Elements where a horizontal swipe means something else (scrolling the town map, editing text). */
const NO_SWIPE = '.city-wrap, input, textarea, select, dialog, .seg.scroll, [data-noswipe]';

function goTo(page: Page): void {
  window.location.hash = `#/${page}`;
}

/** Swipe left/right on a page to turn to the next/previous chapter, like a book. */
function useSwipe(page: Page, ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    const index = CHAPTERS.findIndex((c) => c.id === page);
    if (!el || index < 0) return;
    let start: { x: number; y: number; t: number } | null = null;
    const down = (e: PointerEvent) => {
      start = e.pointerType === 'touch' && !(e.target as Element).closest(NO_SWIPE) ? { x: e.clientX, y: e.clientY, t: e.timeStamp } : null;
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const quick = e.timeStamp - start.t < 700;
      start = null;
      if (!quick || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      const next = CHAPTERS[index + (dx < 0 ? 1 : -1)];
      if (next) goTo(next.id);
    };
    const cancel = () => (start = null);
    el.addEventListener('pointerdown', down, { passive: true });
    el.addEventListener('pointerup', up, { passive: true });
    el.addEventListener('pointercancel', cancel, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
  }, [page, ref]);
}

export function Shell({ page, turn, children }: { page: Page; turn: 'forward' | 'back' | null; children: ReactNode }) {
  const { level, totals, gems, openEditor, editor, today } = useStore();
  const current = PAGES.find((p) => p.id === page)!;
  const pageRef = useRef<HTMLDivElement>(null);
  useSwipe(page, pageRef);
  const add = page === 'chores' ? { label: 'New chore', open: () => openEditor({ kind: 'chore' }) } : page === 'quests' ? { label: 'New quest', open: () => openEditor({ kind: 'task', preset: { dueDate: today } }) } : null;

  // Desktop shortcut: "n" starts a new entry on pages that have one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!add || e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || editor || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      add.open();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <Icon name="sparkle" size={26} />
          {APP_NAME}
        </div>
        <div className="card">
          <div className="level-row">
            <div className="level-badge">
              <span>{level.level}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>Level {level.level}</strong>
              <div className="muted small">{level.remaining} XP to next</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <XpBar value={level.progress} label="Progress to next level" className="bar thin" />
          </div>
          <div className="muted small" style={{ marginTop: 10 }}>
            <span className="gold">{totals.balance}</span> coins · <span className="gem">{gems}</span> gems
          </div>
        </div>
        <nav aria-label="Chapters">
          {PAGES.map((p) => (
            <a key={p.id} href={`#/${p.id}`} aria-current={p.id === page ? 'page' : undefined}>
              <Icon name={p.icon} />
              {p.label}
            </a>
          ))}
        </nav>
        <div className="spacer" />
        <p className="muted small" style={{ padding: '0 8px' }}>
          Press <kbd>N</kbd> to add. Everything stays on this device.
        </p>
      </aside>

      <div className="main">
        <div className="book-page" ref={pageRef}>
          <Corner className="corner tl page-corner" />
          <Corner className="corner tr page-corner" />
          <header className="top">
            <div className="chapter-title">
              {current.chapter && <span className="numeral">{current.chapter}</span>}
              <h1>{current.label}</h1>
            </div>
            <div className="top-actions only-mobile">
              <a className="level-pill" href="#/progress" aria-label={`Level ${level.level}, ${totals.balance} coins. Open the journal`}>
                <Icon name="star" size={14} className="gold" />
                Lv {level.level}
                <span className="muted">·</span>
                <span className="gold">{totals.balance}</span>
              </a>
              <a className="icon-btn" href="#/progress" aria-label="Journal" aria-current={page === 'progress' ? 'page' : undefined}>
                <Icon name="progress" />
              </a>
              <a className="icon-btn" href="#/settings" aria-label="Settings" aria-current={page === 'settings' ? 'page' : undefined}>
                <Icon name="settings" />
              </a>
            </div>
          </header>
          <main className={turn ? `content turn${turn === 'back' ? ' back' : ''}` : 'content'} id="main" key={page}>
            <UpdateBanner />
            {children}
          </main>
        </div>
      </div>

      <nav className="tabs" aria-label="Chapters">
        {CHAPTERS.map((p) => (
          <a key={p.id} href={`#/${p.id}`} aria-current={p.id === page ? 'page' : undefined}>
            <Icon name={p.icon} size={22} />
            {p.label}
          </a>
        ))}
      </nav>

      {add && (
        <button type="button" className="fab" onClick={add.open}>
          <Icon name="plus" size={22} />
          {add.label}
        </button>
      )}
    </div>
  );
}
