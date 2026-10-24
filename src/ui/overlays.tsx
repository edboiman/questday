import { useEffect, useRef, useState } from 'react';
import { applyUpdate, getPwaState, subscribePwa, type PwaState } from '../pwa/register';
import { useStore } from '../state/store';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

export function usePwa(): PwaState {
  const [state, setState] = useState(getPwaState);
  useEffect(() => subscribePwa(setState), []);
  return state;
}

export function Toasts() {
  const { toasts, dismissToast, act } = useStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast t-${t.tone}`}>
          {t.tone === 'xp' && <Icon name="sparkle" />}
          {t.tone === 'trophy' && <Icon name="trophy" />}
          <div className="grow">
            <div>
              <strong>{t.text}</strong>
            </div>
            {t.detail && <div className="muted small">{t.detail}</div>}
          </div>
          {t.undoId ? (
            <button
              type="button"
              className="btn small"
              onClick={() => {
                const id = t.undoId!;
                dismissToast(t.id);
                void act.undo(id);
              }}
            >
              <Icon name="undo" size={16} />
              Undo
            </button>
          ) : (
            <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function LevelUp() {
  const { levelUp, dismissLevelUp } = useStore();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (levelUp === null) return;
    ref.current?.focus();
    const timer = window.setTimeout(dismissLevelUp, 6000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissLevelUp();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [levelUp, dismissLevelUp]);
  if (levelUp === null) return null;
  return (
    <button ref={ref} type="button" className="levelup" onClick={dismissLevelUp} aria-label={`Level up! You reached level ${levelUp}. Continue`}>
      <span className="levelup-card" role="alert">
        <span className="levelup-num">{levelUp}</span>
        <span className="levelup-title">Level up!</span>
        <span>You reached level {levelUp}. Nicely done.</span>
        <span className="muted small">Tap to continue</span>
      </span>
    </button>
  );
}

export function ConfirmDialog() {
  const { confirmRequest, answerConfirm } = useStore();
  return (
    <Dialog open={confirmRequest !== null} onClose={() => answerConfirm(false)} title={confirmRequest?.title ?? ''}>
      {confirmRequest && (
        <>
          <p>{confirmRequest.body}</p>
          <div className="btn-row">
            <button type="button" className="btn grow" data-autofocus onClick={() => answerConfirm(false)}>
              Cancel
            </button>
            <button type="button" className={confirmRequest.danger ? 'btn danger grow' : 'btn primary grow'} onClick={() => answerConfirm(true)}>
              {confirmRequest.confirmLabel}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

export function UpdateBanner() {
  const { updateReady } = usePwa();
  if (!updateReady) return null;
  return (
    <div className="note banner" role="status">
      <span>A new version is ready.</span>
      <button type="button" className="btn small primary" onClick={applyUpdate}>
        Update now
      </button>
    </div>
  );
}

/** Floating "+25 XP / +25 coins / +12 gems" that rise from where you tapped. Decorative: the toast carries the same news for screen readers. */
export function Pops() {
  const { pops } = useStore();
  return (
    <div className="pops" aria-hidden="true">
      {pops.map((p) => (
        <span key={p.id} className={`pop ${p.kind}`} style={{ left: p.x, top: p.y, animationDelay: `${p.delay}ms` }}>
          {p.text}
        </span>
      ))}
    </div>
  );
}
