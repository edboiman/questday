# QuestAday — miniature world edition

The town and museum now use real, locally rendered 3D models. This ZIP contains the editable source and prebuilt app files.

## Upload to your existing GitHub Pages site

1. Export a backup from your current app's Settings.
2. Extract this ZIP and open `questday/dist-personal`.
3. Upload every FILE INSIDE `dist-personal` to the ROOT of your existing `edboiman/questday` repository, replacing matching files. Do not upload the folder itself or the entire development project.
4. Keep the same Pages address. After deployment, open the app and choose Update now when offered.
5. In Town, use the scene or Build & manage plots. In Rewards → Museum, choose a gallery. Collected exhibits occupy the cases; empty cases represent pieces not yet collected.

Nothing has been pushed to GitHub automatically.

## Recommended: review locally first

With Node.js 20 or newer installed, open a terminal inside the extracted `questday` folder:

    node scripts/serve.mjs --personal

Open http://localhost:4173. The prebuilt app needs no npm install. Import a backup here if you want to preview your town; localhost has separate storage from GitHub Pages. Do not double-click index.html.

## What is in this version

Town:
- Low-poly 3D buildings with real roofs, doors, windows, storefronts and shadows.
- Continuous paths, border trees, fencing, a pond edge and timber bridge.
- Full-body residents with distinct animal features, turning, walking legs and corner pauses.
- Residents walk around their favorite building's plot when available. These are visual routines, not a new gameplay AI system.
- Click buildings or neighbors; keyboard/touch-friendly plot controls and resident buttons remain outside the canvas.
- Each of the 13 villagers has a distinct set of original greetings. Repeated conversations alternate personal lines with remarks about the town, season and your activity. Lines vary by day and conversation, without storing chat history.
- Rohld, an original travelling penguin, visits after you complete a quest, project or chore on 30 distinct days. This is not a streak; progress is derived from existing, undo-aware activity history and the earned unlock is kept with the app's existing achievements.
- Rotate, zoom, evening lighting, pause/resume, reset view, reduced-motion support and a retry/fallback message when 3D is unavailable.

Museum:
- Five selectable 3D gallery rooms with panelled walls, brass trim, glass display cases, plinths and focused lighting.
- Original procedural 3D models for all 30 exhibits, with distinct shapes and surface details across minerals, fossils, antiquities, space and curiosities.
- Only owned exhibits appear in the gallery cases. Selecting an unlocked exhibit opens a rotatable 3D inspection view.
- Refined exhibit cards and collection navigation. Existing collection costs, locks, purchase confirmation and rewards are preserved.

This version focuses on the town and museum. Relationship progression, a focus timer, sound, decoration editing and restoration quest systems are not added.

## Security and data

- Same IndexedDB database structure, ledger rules, save/import/export and offline update flow. The visitor uses the existing achievements collection; there is no new counter or user-data field.
- No analytics, CDN scripts, remote fonts, remote models or texture downloads.
- Three.js is bundled locally, pinned in the lockfile and licensed under MIT. Its licence ships with the build.
- Existing restrictive CSP remains unchanged. No new app network APIs, dynamic code execution, credential strings or public-build admin code pass the release scanner.
- The scan allows one exact inert academic citation in a Three.js shader comment, not a network destination.

## Validation and limitations

Passed: typecheck; 132 automated tests; public and personal builds; both bundle safety scans. The dependency audit reported zero known vulnerabilities at the prior check; no dependencies changed for this update.

Second review addressed case-top occlusion, scroll gestures selecting plots, camera rotation behind museum walls, cross-scene material disposal, stationary-render performance and renderer context-loss fallback. Geometry tests cover every saved building/resident/exhibit identifier; routes are tested across 4×4 to 9×9 towns.

Browser preview access is blocked in this environment. Actual rendered appearance, graphics-driver behavior, mobile frame rate, pointer hit targets, keyboard interaction and installed-PWA update behavior are not visually/browser verified. Review on your device before replacing the live app. Existing automated game tests do not substitute for that check.

The renderer caps device pixel ratio at 1.5, animation at approximately 30 FPS, skips rendering off-screen/in hidden tabs, and renders static museum views only when needed. WebGL 2 support is required for 3D; non-canvas controls remain usable without it.

## Development

    npm ci
    npm run dev
    npm run verify
    npm audit

3D models: `src/ui/world/models.ts`
World layout and motion: `src/ui/world/scenes.ts`
Renderer lifecycle: `src/ui/world/WorldCanvas.tsx`
Interaction guards: `src/ui/world/interaction.ts`
Town integration: `src/ui/TownWorld.tsx`, `src/pages/City.tsx`
Museum integration: `src/pages/Museum.tsx`

`dist` is the public web build with admin tools removed. `dist-personal` preserves the personal admin tools in Settings. Keep all source files for future editing, but only upload the built files to GitHub Pages.
