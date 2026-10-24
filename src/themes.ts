import type { ThemePref } from './domain/types';

/*
 * Colour themes. Each is a full palette defined in styles.css under
 * :root[data-theme='<id>']. "system" follows the device: Parchment by day,
 * Nightfall by night. 'dark' and 'light' are the original Ink and Paper themes,
 * kept so existing settings and backups stay valid.
 */
export type ThemeId = Exclude<ThemePref, 'system'>;

export interface ThemeDef {
  id: ThemeId;
  name: string;
  blurb: string;
  /** Browser/OS chrome colour (address bar, task switcher). */
  chrome: string;
  /** Three swatches for the picker: page, ink, accent. */
  swatch: [string, string, string];
  scheme: 'light' | 'dark';
}

export const THEMES: readonly ThemeDef[] = [
  { id: 'wildwood', name: 'Wildwood', blurb: 'Forest-green leather, warm parchment and antique gold', chrome: '#243c32', swatch: ['#f4e9d2', '#243c32', '#d8aa55'], scheme: 'light' },
  { id: 'parchment', name: 'Parchment', blurb: 'Vellum pages, leather and gilt', chrome: '#3b2416', swatch: ['#e9d9b4', '#2b1d12', '#7b1e22'], scheme: 'light' },
  { id: 'nightfall', name: 'Nightfall', blurb: 'A midnight tome with frost-blue runes', chrome: '#0e0d1c', swatch: ['#1b1a31', '#e8e4ff', '#6fb3ff'], scheme: 'dark' },
  { id: 'hearth', name: 'Hearth', blurb: 'Warm cocoa, cookies and frosting', chrome: '#4a2c1a', swatch: ['#f2dcbc', '#3a2418', '#c96a2b'], scheme: 'light' },
  { id: 'grove', name: 'Grove', blurb: 'Deep forest and old bronze', chrome: '#111c14', swatch: ['#1c2a20', '#e4eed7', '#c08a3e'], scheme: 'dark' },
  { id: 'dark', name: 'Ink', blurb: 'The original dark theme', chrome: '#12111c', swatch: ['#1c1b2c', '#edeaf8', '#9a8cff'], scheme: 'dark' },
  { id: 'light', name: 'Paper', blurb: 'The original light theme', chrome: '#f5f1ea', swatch: ['#fffdf9', '#262239', '#5b46d6'], scheme: 'light' },
];

export const DEFAULT_THEME: ThemePref = 'wildwood';

export function resolveTheme(pref: string): ThemeDef {
  if (pref === 'system') {
    const light = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches;
    return THEMES.find((t) => t.id === (light ? 'wildwood' : 'nightfall'))!;
  }
  return THEMES.find((t) => t.id === pref) ?? THEMES[0]!;
}
