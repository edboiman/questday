# Third-party and original assets

| File | Source | Licence | Author |
|---|---|---|---|
| `public/lora-variable.woff`, `public/lora-italic-variable.woff` | Lora (Google Fonts), subset to Latin with fontTools | SIL Open Font License 1.1 | Copyright 2011 The Lora Project Authors (github.com/cyrealtype/Lora-Cyrillic) |
| `public/paper.svg`, `public/fibres.svg` | Procedural paper grain (SVG noise filter) | Original | QuestAday |
| `public/flourish.svg`, `src/ui/Ornaments.tsx` (crest, corners, vignette) | Hand-drawn line art | Original | QuestAday |

Before a Play release: show the OFL notice for Lora on the licences screen (the OFL allows bundling
fonts in apps; the font may not be sold on its own and the name "Lora" stays with the original).

## Living town update
- `src/ui/TownScene.tsx`: original code-drawn SVG landscape, trees, river edge, isometric plots and full-body resident clothing. Uses the existing `ResidentFace` and `BuildingArt` illustrations. No external assets, downloads or new asset licences.

## Miniature world edition
- `src/ui/world/models.ts` and `scenes.ts`: original procedural 3D buildings, scenery, residents, museum rooms and all 30 exhibit models. No downloaded textures, models, fonts, analytics or CDN requests.
- Three.js: bundled local renderer, MIT licence. Full licence copied to `public/THREE-LICENSE.txt` and included in production builds.
- The bundle checker permits exactly one additional inert URL: the JCGT paper citation inside Three.js's PMREM shader comment. It is not a fetch target. Existing network API, credential, CSP and dynamic-code checks remain in force.
