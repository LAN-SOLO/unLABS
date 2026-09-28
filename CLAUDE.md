# CLAUDE.md

Guidance for Claude Code in this repository.

## Commands

- `pnpm dev` — Next.js dev server (port 3000); `pnpm build` / `pnpm start` — production
- `pnpm lint` / `lint:fix` · `pnpm typecheck` · `pnpm format` / `format:check`
- `pnpm test` / `test:watch` — Vitest; `pnpm test:e2e` — Playwright (once: `pnpm exec playwright install --with-deps chromium`)
- `pnpm check` — lint + typecheck + format:check + test + build (same gates as CI)
- `pnpm db:start|db:stop|db:reset|db:new <name>|db:diff|db:types` — Supabase CLI wrappers
- `pnpm electron:dev` — desktop dev; `pnpm build:mac|build:win|build:all` — desktop builds → output in `.INSTALL/`; `pnpm download:binaries` — fetch bundled binaries

Lefthook runs format/lint/typecheck on commit and `pnpm test` on push; CI (`.github/workflows/ci.yml`) re-runs the same commands. Details: `docs/PIPELINE.md`, `docs/SUPABASE.md`.

## Standards (non-negotiable)

- TypeScript strict · Node 20+ · Next.js 16 (App Router) + React 19
- **pnpm only** — never npm or yarn
- No `any` — use `unknown` + type guards; prefer named exports; absolute imports via `@/*` (only alias)
- Schema changes only via migrations in `supabase/migrations/` (use `db:*` scripts); no destructive queries (`DROP`, `TRUNCATE`) without explicit user confirmation
- Never force-push `main`/`develop`; never commit secrets or `.env` files; lint + typecheck before committing
- Business logic lives in service layers (`lib/api/*`, `lib/unos/*`, `lib/game/*`), not in API route handlers; prefer composition over inheritance

## Architecture

Next.js game simulating a Linux-like OS (`_unOS`): terminal, hardware panel, 38 in-game devices, episode-based quest progression, plus an Electron desktop build.

### Routes — `app/`

- `(auth)/`, `auth/` — authentication
- `(game)/` — `terminal/` (`terminal-frame.tsx`, `terminal-power-wrapper.tsx`, `actions/` server actions), `panel/`, `lab/`, `dev/`, `monitor/`; shared shell in `game-shell.tsx`
- `api/` — thin handlers that delegate to `lib/`

### \_unOS Kernel — `lib/unos/kernel/`

Subsystems: dmesg, process, memory, scheduler, syscall, ipc, modules, procfs. Surrounding modules in `lib/unos/`: filesystem, users, network, packages, containers, cron, journal, shell, devices, init.

- Instantiated in `components/terminal/Terminal.tsx` via `kernelRef`, exposed through `KernelActions`
- procfs hooks into the virtual FS via `setProcFS()` / `setProcFSListDir()` (dynamic `/unproc`)
- State persists to localStorage via `PanelSaveData.kernel`; `init.ts` accepts an optional `Kernel` so processes get real PIDs

### Terminal — `lib/terminal/`

- `commands.ts` is **~26,000+ lines**. New commands must be registered in **two** places: the definition AND the `commands[]` array at the end of the file — missing the array is the most common bug.
- `types.ts` defines `DataFetchers` (~line 1615) — the contract every command uses for game state and actions
- `unapp/` (`appShell.ts`, `deviceApps.ts`, `moduleRenderers.ts`) — in-terminal apps rendering device modules
- `hooks/useTerminal.ts` builds `dataFetchers` and wraps every command in `kernelActions.execCommand()` / `finishCommand()` so the kernel sees real processes

### Device System — `contexts/` + `devices/` + `lib/firmware/`

Every device follows the same fan-out:

1. `contexts/[XXX]Manager.tsx` — provider holding state, firmware metadata, power specs, actions
2. `components/terminal/Terminal.tsx` collects manager refs into an actions object
3. `hooks/useTerminal.ts` wires actions into `dataFetchers`
4. Commands access via `ctx.data.<actions>` (kernel at `ctx.data.kernelActions`)
5. `components/panel/modules/` — panel UI module
6. `devices/tier-{1,2,3}/<DEVICE>/` — `DEVICE-ID.md` + `firmware.json`; runtime model in `lib/firmware/registry.ts`, owner `contexts/FirmwareManager.tsx`

Follow the pattern end-to-end — skipping the wiring layer is the second most common bug. Catalog: `devices/README.md`; firmware contracts: `devices/FIRMWARE-API.md`, `FIRMWARE-SPEC.md`.

### Game Layer — `lib/game/` + `contexts/`

Quests (`quests/ep0.ts`–`ep6.ts`), missions (`missions/catalog/`), tutorial (`tutorial/`, UI in `components/onboarding/`), tick engine (`tickEngine.ts` + `contexts/GameTickProvider.tsx`), plus achievements, techTree, economy, production, resonance, hints. Each system has a provider in `contexts/` (QuestProvider, MissionProvider, TutorialProvider, …) and UI in `components/{quest,mission,journal,onboarding}/`. Device unlock/roster logic: `lib/game/devices/`.

### Lab World — `app/world/` + `lib/world/` + `components/world/`

Isometric voxel lab (Three.js) and the entry point after login/setup; the big terminal is one area inside it (Hauptkonsole in the Kontrollraum → `/terminal`, back via `/world`). Lives **outside** `(game)` so the terminal's tutorial/journal overlays don't render on top. Progress is local (`localStorage`, see `lib/world/save.ts`).

- `lib/voxel/` — pure voxel engine (grid, chunked world, greedy mesher + AO, DDA raycast, AABB collision), adapted from the voxelskill template
- `lib/world/content/` — all game data: `map.ts` (floors, rooms, doors incl. secret doors, pickups, notes, props), `devices.ts` (38 devices + `MCP-000`, 3 build stages each, deps, `DEVICE_PUZZLES`), `items.ts` (items, recipes, the 30 `_unSLC` slices), `story.ts` (insights, NPC dialogue for the MCP, Damien's echo, the \_unstables and 10 lore bots, 4 endings + secret `kristall`), `puzzles.ts`, `palette.ts`, `interior.ts`
- `lib/world/game.ts` — pure rules (conditions, power grid, discovery, building, salvage, puzzles, endings, hints); `combine.ts` — deterministic open-ended combination engine (recipe or generated prototype, 14 archetypes, explosion events; prototypes are _used_ on targets via `applyPrototype`/`prototypeUseOptions` in game.ts); `models/` — procedural voxel models (core, devices, props, characters, decor, anim); `layout.ts` — floor voxelization; `actor.ts` — walker/collision
- `lib/world/render/engine.ts` — `LabEngine` (only file importing three besides `render/*`); reads state, reports interactions via callbacks. Draw calls are kept low by `batching.ts` (merged terrain, `StaticBatcher` tiles, `AutoInstancer`) — mark static meshes with `markStatic`, measure with `engine.debugStats()`; state transitions (power ramps, build drops, pickup flights) in `transitions.ts`; bots run `npc-brain.ts`. Lighting: per-room shadow-casting key spot + pooled `VirtualLight`s (fixed 14 PointLights follow the nearest lamps/screens/devices — never add raw PointLights for decor), emergency mode, CRT post pass (`crt-pass.ts`), wall cutaway (V), `FxSystem` (`fx.ts`), `CameraDirector` (`cutscene.ts`)
- Render refinement: every rendered voxel is split 2×2×2 at meshing time only (`lib/voxel/refine.ts` rules, lab profiles/partner colours/cache in `lib/world/models/refine.ts`; models via `refinedModelMesh(grid, family)`, terrain chunks via `WorldRenderer`'s `refine` + `VoxelWorld.dirtyReach`). Game logic, collision, zones and all coordinates stay on the source grids; meshes keep source units. New model call sites must pass a `RefineFamily`
- Content by floor: 6 floors (`FloorId` 0–5; use `FLOOR_BY_ID` / `FLOORS_TOP_DOWN`, not `FLOORS[id]`); interior set dressing in `content/interior.ts` + `models/decor.ts`; device/bot visuals with animated parts in `models/devices.ts`, `models/characters.ts`, `models/anim.ts`
- Systems: `achievements.ts`, `quests.ts` (journal "Aufträge" + HUD compass), `scenes.ts` (scripted cinematics, run by `components/world/useLabDirector.ts`), `audio/` (procedural Web Audio: sfx, ambience, music, voice bleeps), `settings.ts` (`unlabs.settings.v1`), `save.ts` (3 slots + autosave: `unlabs.world.v1.slot1..3|auto`, `.meta`, `.active`, `.bak`; every load/import goes through `save-sanitize.ts` — bump `SAVE_VERSION` in game.ts and add a `MIGRATIONS` step when the state shape changes), `bridge.ts` (lab world ↔ `/terminal`: signals, summaries, terminal events)
- `components/world/` — `LabWorld.tsx` (title → loading → game, HUD, overlays), `panels.tsx`, `menu/` (title, pause, settings, slots, credits), `puzzles/` (26 minigame kinds), `Minimap.tsx`, `AchievementsPanel.tsx`
- **Languages:** English is the main language, German second. Every player-visible string in `lib/world/**`, `components/world/**`, `app/world/**` is English inside `tr("…")` (`lib/i18n`); German lives in `lib/i18n/de/<area>.ts` keyed by the English string — see `lib/i18n/README.md` + `GLOSSARY.md`. `tests/i18n/coverage.test.ts` fails on missing German entries or German literals. Never branch on translated text; language switch reloads the page
- **Terminal ↔ Lab World:** the world save is the source of truth for which devices exist/are on (`lib/terminal/labSync.ts`, gate in `executeCommand`); terminal power switches write back via `lib/world/bridge.ts`; world progress sets terminal quest flags. Without a world save the terminal behaves as before
- `useWorld()` returns a new object every render and `act()` re-renders — never call `act` in an effect that depends on `[world]` (infinite loop); use a ref
- Tests in `tests/world/`: `content.test.ts` validates ids/positions/doors/dependency graph; `playthrough.test.ts` is a greedy simulated player that must reach all endings, reactivate all bots and collect all 30 slices; `walkability.test.ts` flood-fills every floor (devices, props, decor as solid) — run both after any content/model size change (they catch soft-locks, blocked doors and resource shortages); `connectivity.test.ts` requires every achievement/recipe to be reachable by the simulated player (`simPlayer.ts`) and `pacing.test.ts` bounds stalls and bark/hint rates

### Supabase / Data

- Clients in `lib/supabase/`; schema types `types/database.ts` (regenerate via `pnpm db:types`) + `types/devices.ts`
- All device DB ops go through `lib/api/devices.ts`; sysprefs split into `sysprefs.ts` (client) and `sysprefs-server.ts` (server actions — canonical loader)
- Prefer RPCs/embeds/upserts over sequential queries (established perf pattern)

### Save Game

`lib/panel/panelState.ts` is the single source of truth for serialized state (incl. kernel snapshot); `lib/panel/buildPanelSaveData.ts` assembles it. Read both before adding any persistence.

### Desktop (Electron) — `electron/`

`main.ts`, `window.ts`, `auth/`, `services/`, `config/`; compiled to `dist-electron/` via `pnpm electron:compile`. `scripts/build-desktop.ts` packages with electron-builder (`electron-builder.config.ts`) → output in **`.INSTALL/`** (note the leading dot). Bundled binaries (Postgres/PostgREST/GoTrue) land in `bin/` via `pnpm download:binaries`.
