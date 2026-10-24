/* A small, consistent, hand-drawn stroke icon set (24×24). No icon font, no remote assets. */
const PATHS = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  quests: 'M6 3h12a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1zM9 8h6M9 12h6',
  chores: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  progress: 'M2 20h20M5 20v-9M10 20V4M15 20v-7M20 20V9',
  gift: 'M4 12v9h16v-9M2 7h20v5H2zM12 21V7M12 7C10 7 7.5 6.5 7.5 4.5S10 2 12 7zM12 7c2 0 4.5-.5 4.5-2.5S14 2 12 7z',
  settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  star: 'M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8z',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5l1.3 2.8 3 .4-2.2 2.1.6 3-2.7-1.5-2.7 1.5.6-3-2.2-2.1 3-.4z',
  flame: 'M12 3c1 3.5 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  calendar: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  flag: 'M5 21V4M5 4h12l-2.5 4 2.5 4H5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 5l12 7-12 7z',
  skip: 'M5 5l9 7-9 7zM18 5v14',
  undo: 'M8 5L4 9l4 4M4 9h10a5 5 0 0 1 0 10h-3',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  trophy: 'M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 14v4M8 20h8',
  sparkle: 'M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8zM18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  pin: 'M12 21v-6M8 4h8l-1 6 3 3H6l3-3z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  gamepad: 'M6 8h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.5 1.7L15 14H9l-1.5 1.7A3 3 0 0 1 2 14v-2a4 4 0 0 1 4-4zM7 10.5v3M5.5 12h3M16 11h.01M18 13h.01',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4',
  treat: 'M7 11a5 5 0 0 1 10 0M5 11h14l-3 10H8zM12 6V3',
  coffee: 'M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 10h2a2 2 0 0 1 0 5h-2M8 3v3M12 3v3',
  book: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10',
  city: 'M3 21V10l5-3v14M8 21V5l6-2v18M14 21v-9l7-2v11M3 21h18M5 13h1M5 16h1M10 8h1M10 11h1M10 14h1M17 15h1M17 18h1',
  gem: 'M6 4h12l4 6-10 11L2 10zM2 10h20M9 4l-2 6 5 11 5-11-2-6',
  museum: 'M3 9l9-6 9 6M4 9h16M6 9v9M10 9v9M14 9v9M18 9v9M3 21h18M4 18h16',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
  music: 'M9 18V5l10-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
