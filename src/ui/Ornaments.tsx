/*
 * Decorative line art for the book: the cover crest, gilt corner filigree and a small
 * landscape vignette. Original drawings, inline SVG, coloured with currentColor so every
 * theme can tint them. All purely decorative (aria-hidden).
 */

export function Crest({ className = 'cover-crest', size = 84 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 84 84" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <circle cx="42" cy="42" r="38" strokeWidth="1.6" />
        <circle cx="42" cy="42" r="33" strokeWidth="0.8" opacity="0.7" strokeDasharray="1.5 3.2" />
        <circle cx="42" cy="42" r="22" strokeWidth="1" opacity="0.6" />
        {/* Laurel sprigs curling up both sides. */}
        <path d="M20 62c-6-7-8-16-5-26M64 62c6-7 8-16 5-26" strokeWidth="1.3" />
        <path d="M16.5 52c-4-1-6-4-6-7 3 0 6 2 7 5M15 43c-3-2-4-5-3-8 3 1 5 3 5 6M16.5 35c-2-3-2-6 0-8 2 2 3 5 2 8M67.5 52c4-1 6-4 6-7-3 0-6 2-7 5M69 43c3-2 4-5 3-8-3 1-5 3-5 6M67.5 35c2-3 2-6 0-8-2 2-3 5-2 8" strokeWidth="1.1" />
      </g>
      {/* Compass star. */}
      <path d="M42 12l4.5 25.5L72 42l-25.5 4.5L42 72l-4.5-25.5L12 42l25.5-4.5z" fill="currentColor" />
      <path d="M42 24l2.4 15.6L60 42l-15.6 2.4L42 60l-2.4-15.6L24 42l15.6-2.4z" fill="currentColor" opacity="0.55" transform="rotate(45 42 42)" />
      <circle cx="42" cy="42" r="4.2" fill="var(--crest-core, #1d2a22)" />
      <circle cx="42" cy="42" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** Gilt filigree for one corner, drawn for the top-left; CSS mirrors it for the others. */
export function Corner({ className }: { className: string }) {
  return (
    <svg className={className} width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <path d="M3 53V13C3 7.5 7.5 3 13 3h40" />
        <path d="M8.5 47V17c0-4.7 3.8-8.5 8.5-8.5h30" opacity="0.7" />
        <path d="M14 14c5.5 0 9 2.6 9 7 0 3.4-2.6 5.2-5 5.2-2 0-3.6-1.7-2.7-3.8M14 14c0 5.5 2.6 9 7 9" />
        <path d="M26 8.5c3.4 1.8 5.2 4.4 4.4 7M8.5 26c1.8 3.4 4.4 5.2 7 4.4" />
      </g>
      <circle cx="14" cy="14" r="2.4" fill="currentColor" />
      <circle cx="35" cy="8.5" r="1.4" fill="currentColor" />
      <circle cx="8.5" cy="35" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function Corners() {
  return (
    <>
      <Corner className="corner tl" />
      <Corner className="corner tr" />
      <Corner className="corner bl" />
      <Corner className="corner br" />
    </>
  );
}

/** A tiny ink landscape for the Today card: hills, a winding road and a far-off tower. */
export function Vignette() {
  return (
    <svg className="vignette" width="150" height="86" viewBox="0 0 150 86" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 70c18-14 32-18 48-12s26 2 40-8 34-10 58-2" strokeWidth="1.3" />
        <path d="M2 82c22-10 44-12 66-6s44 2 80-8" strokeWidth="1.1" opacity="0.7" />
        <path d="M70 84c4-6 10-8 18-10s10-6 6-10-4-6 6-8" strokeWidth="1" strokeDasharray="2.5 3" />
        {/* Tower on the far hill. */}
        <path d="M104 52V30h12v22M102 30h16l-8-10zM108 52v-6a2 2 0 0 1 4 0v6M108 36h4" strokeWidth="1.2" />
        <path d="M110 20v-6l6 2-6 2" strokeWidth="1" />
        {/* Pines. */}
        <path d="M28 64l6-14 6 14zM34 64v4M40 62l5-11 5 11zM45 62v3" strokeWidth="1.1" />
        {/* Sun and birds. */}
        <circle cx="132" cy="18" r="6" strokeWidth="1" opacity="0.8" />
        <path d="M60 22c2-2 4-2 5 0 1-2 3-2 5 0M76 14c1.5-1.5 3-1.5 4 0 1-1.5 2.5-1.5 4 0" strokeWidth="1" />
      </g>
    </svg>
  );
}
