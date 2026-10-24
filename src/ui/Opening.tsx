import { useEffect, useRef, useState } from 'react';
import { APP_NAME } from '../config';
import { Corners, Crest } from './Ornaments';

/*
 * The opening scene: a leather-bound book with a gilt title and drifting
 * embers. Tapping "Open the book" swings the cover open onto Chapter I.
 * Plays once per visit; reduced-motion users get a simple fade.
 */
const EMBERS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  delay: `${(i * 0.43) % 6}s`,
  duration: `${5 + ((i * 7) % 5)}s`,
  drift: `${((i * 23) % 60) - 30}px`,
}));

export function Opening({ onOpen }: { onOpen: () => void }) {
  const [opening, setOpening] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);

  const open = () => {
    if (opening) return;
    setOpening(true);
    if (!/^#\/./.test(window.location.hash)) window.location.hash = '#/quests';
    window.setTimeout(onOpen, 1050);
  };

  return (
    <div className={opening ? 'opening done' : 'opening'} role="dialog" aria-modal="true" aria-label={`${APP_NAME}: a storybook for the things you mean to do`}>
      {EMBERS.map((e, i) => (
        <span key={i} className="ember" style={{ left: e.left, animationDelay: e.delay, animationDuration: e.duration, ['--drift' as string]: e.drift }} />
      ))}
      {/* The first leaf, revealed as the cover swings open. Same footprint as the cover. */}
      <div className="tome-pages" aria-hidden="true">
        <span className="tome-numeral">Chapter I</span>
        <span className="tome-title">Quests</span>
        <span className="tome-rule" />
      </div>
      <div className="cover">
        <Corners />
        <Crest />
        <div className="cover-title">{APP_NAME}</div>
        <p className="cover-sub">A storybook for the things you mean to do</p>
        <button ref={button} type="button" className="btn" onClick={open}>
          Open the book
        </button>
      </div>
    </div>
  );
}
