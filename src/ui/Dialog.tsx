import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Modal built on the native <dialog>: the browser provides the focus trap,
 * Escape-to-close, inert background and screen-reader semantics.
 * Renders as a bottom sheet on phones and a centred panel on larger screens.
 */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="sheet-body">
          <header className="sheet-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
              <Icon name="x" />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
