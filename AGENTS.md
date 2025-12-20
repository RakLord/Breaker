# Breaker Codebase Map

This file is a quick guide to where data lives and where to make changes when adding upgrades or gameplay tweaks.

## Entry Points
- `main.js`: bootstraps the game by calling `startApp()`.
- `src/app.js`: app orchestrator, main loop, and event wiring.

## Data Schema (Source of Truth)
Primary definitions and normalization live in `player.js`:
- `createDefaultPlayer()`: default save shape.
- `normalizePlayer()`: clamps/coerces save data and provides backward compatibility.

Key player fields:
- `points`, `clears`: strings (Decimal).
- `stars`: number.
- `clearsUpgrades`: `{ densityLevel, gridSizeLevel, brickHpLevel }`.
- `starUpgrades`: booleans and leveled fields (see `player.js` + `src/game/stars.js`).
- `ballTypes[typeId]`: `{ damageLevel, speedLevel, rangeLevel, sizeLevel, pieceLevel, critLevel, executionLevel }`.
- `progress`: `{ level, masterSeed }`.
- `game`: `{ balls, grid, initialBlocks }` (persisted save snapshot).
- `ui`: `{ ballContextEnabled, showHpOverlay, ballCardMinimized }`.
- `tutorials`: `{ manualBallToastShown }`.
- `meta`: `{ createdAt, lastSavedAt }`.

## Module Layout
- `src/game/ballLogic.js`: ball spawning, upgrades, and cursor-ball behavior.
- `src/game/gridFlow.js`: grid sizing/regeneration and restore from save.
- `src/game/stars.js`: star upgrade rules, costs, and prestige math.
- `src/game/progress.js`: progress normalization.
- `src/game/upgradeMath.js`: math helpers for piece/crit/execute.
- `src/game/view.js`: canvas transforms.
- `src/game/level.js`: grid generation helpers.
- `src/game/storage.js`: save export/import helpers.
- `src/ui/ballShop.js`: ball shop UI rendering + input handling.
- `src/ui/dom.js`: DOM element lookup.
- `src/ui/uiState.js`: UI state persistence in save.
- `src/ui/notifications.js`: toast notifications.
- `src/ui/changelog.js`: changelog data + modal behavior.
- `src/tooltips.js`: tooltip text map and init.

## Adding/Updating Upgrades Checklist
1. **Persisted data**
   - Add new fields to `createDefaultPlayer()` in `player.js`.
   - Clamp/normalize in `normalizePlayer()` in `player.js`.
   - Update this `AGENTS.md` schema if you add new top-level keys, new nested objects, or change types.
2. **Rules and math**
   - Star upgrades: update constants/logic in `src/game/stars.js`.
   - Ball upgrades: update costs in `player.js` and effects in `src/game/ballLogic.js`.
   - Clears upgrades: update costs in `player.js` and grid effects in `src/game/gridFlow.js`.
3. **UI wiring**
   - Add DOM refs in `src/ui/dom.js` if new controls are needed.
   - Wire events in `src/app.js`.
   - For ball shop rows/cards, update `src/ui/ballShop.js`.
4. **Tooltips**
   - Add/adjust entries in `src/tooltips.js`.
5. **Validation**
   - Update `tests/normalizePlayer.test.mjs` if save schema changes.
   - Manual smoke test: save/load, upgrade purchase, prestige flows.
6. **Project context**
   - If you add new systems, entry points, or storage formats, add them to this file so future changes stay discoverable.
