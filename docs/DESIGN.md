# QuestAday: design guide

## Idea
The app is a storybook. The screen edge is a leather cover, content sits on a page, chapters are reached by
ribbon bookmarks, and changing chapter turns the page. Inspired by the warmth of classic fantasy MMOs and
idle games (chunky parchment UI, gilt trim, big satisfying numbers), **without copying any of their art,
fonts, names, icons or layouts**.

Spend boldness in one place: the book (cover, page, ribbons, page turn, opening). Inside the page, keep
things calm, readable and consistent.

## Themes
Defined in `src/styles.css` (`:root[data-theme='…']`) and listed in `src/themes.ts`.

| Theme | Feel | Page | Ink | Accent | Trim |
|---|---|---|---|---|---|
| Parchment (default) | Vellum pages, brown leather, oxblood ribbons | `#e9d9b4` | `#2b1d12` | `#7b1e22` | `#b8862b` |
| Nightfall | Midnight tome, frost-blue runes, gold | `#17162b` | `#ece8ff` | `#6fb3ff` | `#d9b14a` |
| Hearth | Cocoa, cookie amber, frosting pink | `#f2dcbc` | `#3a2418` | `#b5541f` | `#c98b3a` |
| Grove | Deep forest, old bronze | `#1a271e` | `#e6efd9` | `#9bcf6a` | `#c08a3e` |
| Ink | Original flat dark | `#1c1b2c` | `#edeaf8` | `#9a8cff` | gold |
| Paper | Original flat light | `#fffdf9` | `#262239` | `#5b46d6` | gold |

Every theme sets: `--bg --panel --panel-2 --line --text --muted --accent --accent-ink --teal --gold --gold-ink
--danger --gem` plus book parts `--cover --cover-grain --page --page-texture --page-edge --page-glow --trim
--ribbon --ribbon-ink`. To add a theme: copy a block, change the colours, add it to `THEMES`, and add the id to
`ThemePref` (types.ts) and `settingsSchema` (schema.ts). Keep body text at 4.5:1 contrast or better.

## Type
- Display: the device's old-style serif (`--display`: Iowan Old Style, Palatino, Book Antiqua, P052, Georgia).
  Chapter titles and the cover title use **small caps**, not all-caps.
- Body: the device's UI sans (`--font`), 16px base, line-height 1.45.
- Future: a self-hosted OFL font (e.g. a classical display serif) bundled in the app, never loaded from a CDN.

## Spacing and shape
- 16px page gutter on phones; content max 760px (1080px on desktop).
- Cards: 16px radius, 16px padding. Buttons and tap targets ≥ 44px. Ribbons 58–64px tall.
- Page: 4px radius at the spine, 14px at the fore-edge, two stacked page edges on the right, gilt inner rule.

## Motion
- One orchestrated moment: the opening (cover swings open, 0.9s).
- Page turn between chapters (0.5s, direction follows the book order). Swipe left/right to turn.
- Reward pops ("+25 XP / +25 coins / +12 gems") rise from where you tapped. Level-up overlay.
- Everything respects `prefers-reduced-motion` (fades only).

## Voice
Plain, warm, encouraging. Sentence case. Errors say what happened and what to do. No guilt, no countdowns.

## Art
See "Art pipeline" in `CLAUDE.md`. Current art is placeholder inline SVG behind `BuildingArt`,
`ResidentFace` and `ExhibitArt`; original art replaces it id by id.

## Apps admired (for feel, not for copying)
Classic fantasy MMO interfaces (parchment panels, gilt frames, skill-level celebrations), cosy idle/clicker
games (big numbers, constant small rewards), and illustrated children's storybooks (page turns, ribbon markers).
