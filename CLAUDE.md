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
- **Wardrobe:** data `content/wardrobe.ts` (13 slots, 79 pieces, colourways/dyes, textiles, `REFINE_RECIPES`, replicator constants); rules `wardrobe.ts` (equip — clothes/shoes/hair only `atWardrobe` —, presets, rewards, replicator jobs, recycle, `sanitizeWardrobe`, `worn_<id>` flags); hints `wardrobe-hints.ts`. Hidden finds are pickups whose item is `wear:<id>` (`WEAR_ITEM_PREFIX`, `PLANNED_PICKUPS` in `content/map.ts`); replicator prop `wardrobe_replicator` (jadeq, needs 50 W). Models `models/jade-*.ts` (`jadeRig(look)`, `jadeLookGrid`, `wearItemGrid`); the engine swaps meshes via `LabEngine.setPlayerLook`. UI `components/world/wardrobe/` (`CharacterMenu`, key O in LabWorld). Sim: `tests/world/simWardrobe.ts` (completionist run)
- **Characters (0.3.1):** Jade = tall/slim, copper updo, stand-collar shirt, no glasses in the first-day look (glasses/goggles are accessories only); first-day voxel hash pinned in `tests/world/jade-look.test.ts`. **Damien stays hidden:** every in-game appearance goes through the veil (`models/veil.ts`: `veilRig`, `damienFigureRigs`; screens: `drawDamien` with `damienRevealed`) and is revealed only by `isDamienRevealed()` (`lib/world/damien.ts`, flag `damien_found`, reserved for a future arc — `tests/world/damien-reveal.test.ts` fails if anything sets it). Never render `damienRig(false)` unveiled in game/UI; the undevbook bakes the revealed model only as a dev-only sprite (stripped from the Beta Lab). **Signature looks:** `content/looks.ts` (18, unlock kinds start/craft/find/event), rules in `wardrobe.ts`, UI `wardrobe/LooksView.tsx`
- **Audio round 7:** footsteps = footwear × surface recipes in `audio/footfall.ts` (sole from the worn shoes, `step` / `layer` on pieces), `StepTracker` in `audio/footsteps.ts`, decor-spot surfaces in `audio/surfaces.ts` (`surfaceForTheme` in `sfx.ts` for the room base). Song length setting `audio.songLength` → `songPlan(song, length)` variation passes (`audio/songs/arrange.ts`, COMPOSING.md). Page lifecycle (tab/visibility/iOS) goes only through `engine.bindPageLifecycle()` — serialized `settle()` in `audio/engine.ts`; don't call `ctx.suspend/resume` outside it
- **Merch:** catalogue `lib/world/merch.ts`; bot designs are generated from the game's voxel models: `scripts/merch/export-voxels.ts` (vite-node) → `scripts/merch/voxels/*.json` → `voxel-art.ts` `isoModel()` SVG → `designs-bots.ts`
- **Terminal ↔ Lab World:** the world save is the source of truth for which devices exist/are on (`lib/terminal/labSync.ts`, gate in `executeCommand`); terminal power switches write back via `lib/world/bridge.ts`; world progress sets terminal quest flags. Without a world save the terminal behaves as before
- **Voxels only (user decision 2026-10-02, `docs/CLARITY.md`):** the whole lab looks like the title diorama — every model and the terrain refined 2× (`meshTier`/`terrainTier` fixed at 2), no era grade, no surface micro detail (`uDetail` 0), no real surfaces. **Only Jade is real** (hero layer). The clarity eras and the crystal age were tried and removed ("sieht schrecklich aus"); don't reintroduce smooth meshes, Blender-built surfaces or era look changes. `lib/world/clarity.ts` still scores progress over 42 eras (17 weighted categories, mirror of `tests/world/simCoverage.ts` — add a new kind of progress to both) for gameplay only (aging crystals). Composer: RenderPass → `ClarityGradePass` (neutral grade, depth copy) → `HeroPass` (layer 5, Jade) → bloom → CRT → output. Model meshes register their voxel source in `VOXEL_SRC` so aged decor can be re-meshed (`stepRemesh`) — new model call sites go through `meshModel`/`sharedMesh`. Never use `pow()` on possibly negative values or unguarded `normalize` in world shaders: one NaN + bloom = black frame
- **Matrix Chamber (`docs/SLICES.md`):** post-game station `matrix_chamber` (prop model `matrix`, Control Room), wakes when every device is built. Rules `lib/world/matrix/` (pure): real ETH ledger `content/eth-history.json` (`scripts/eth-history/fetch.mjs`, past only — never invent days), released unETH captures `content/uneth-release.json` (`scripts/uneth/export-release.mjs`); extractions run on **wall-clock** epoch ms (2–24 h, outcome by seed), state `WorldState.matrix` (save v8, `sanitizeMatrix` in `matrix/state.ts` — keep game-free to avoid import cycles). Composer = 30 slot lists, GIF via `matrix/gif.ts`. Mint is prepared only (`matrix/mint.ts`, devnet; mainnet gated by legal review); server-authoritative extraction + marketplace still to build. UI `components/world/matrix/MatrixPanel.tsx`; dev `__lab.matrix.{open,wake,feed,finishNow}`
- **Voxel God (`docs/VOXEL-BLENDER.md`, skill `voxel-blender`):** Blender holds exact 1:1 voxel clones of every device and door (99/99 voxel- and pixel-exact vs the undevbook, inside included). Format uvox (`lib/voxel/uvox.ts` ⇄ `scripts/voxel/blender/voxelgod/uvox.py`, game palette indices, `sha` identical in TS/Python); devices compose like the book (`lib/world/models/compose.ts`); doors via `scripts/voxel/door-parts.ts` (keep in sync with `DoorSystem`). Exact ops at any voxel size (`combine` refuses off-lattice, `downsample` is the only lossy op), primitives, voxelize, paint, Blender UI (sidebar Voxel). Back into the game: `modelFromUvox` (`lib/world/models/uvox-model.ts`, refuses palette drift). `pnpm voxel:export|verify|selftest|beauty|gallery|blender`; output `.voxel/` (gitignored). Never smooth or remesh — voxels only
- **Device detail (`docs/VOXEL-BLENDER.md` § Device detail):** the renderer draws every device 4× finer (refined twice) with voxel components stamped on authored panels (`lib/world/models/detail.ts`: screen art, type plate, hatches, vents, grilles, stickers, rivets; never grows the silhouette, skips live-screen panels). `assembleDetail` scales all voxel coords so world space is identical — game logic keeps `deviceVisual`, only rendering uses the detail. Built in workers (`render/detail-pool.ts`, `detail.worker.ts`), swapped in by `LabEngine.swapDetail` once a device is complete; the title diorama swaps too (`swapDetails`), and the undevbook bakes the detail (pixel-identical to the Blender clones)
- **Living lab (`lib/world/aging.ts`, pure):** plants grow in lit + watered rooms and wilt without water, dust settles in dry rooms (any decor use tidies), rust + moss in damp themes, crystals grow with clarity — counters `grow:/water:/dust:/damp:<room>` (no save bump), `agingTick` 1 Hz in useWorld, watering = decor effect `care: "water"`. Variants `lib/world/models/decor-aging.ts` (`agedDecorModel`, `agedVisual` for rig parts) never leave the base shape (tests/world/aging.test.ts); engine `refreshAging` in `sync()` swaps `fixedSrc` grids / rebuilds decor rigs. Dev `__lab.aging.advance(s)`, `.water(room)`
- **Jade's real head (docs/HERO.md §9):** Blender + MPFB2 (`scripts/hero/blender/jade_mpfb.py`, params `jade.json`), portrait skin bake, exported aligned on `JADE_EYES` → `public/hero/jade-head.glb` (+ `jade-skin.jpg`, never embedded: CSP) → `head-glb.ts` → `buildHeroRig({ head })` replaces the SDF head + lid caps, blink = morph. The reference photo never goes into the repo (comparisons stay local, never committed)
- **Operations (`docs/OPS.md`):** pure rules `lib/world/ops/` (state `WorldState.ops`, save v9): surveillance station prop `surveillance_station` (Control Room) + a panning `security_cam` per room (`LabEngine.camFeed` live feed), Jade's routines (record/combine/run; sequences repeated 3× become `auto` habits she finishes herself — action sites call `trackAction` from `components/world/ops/track.ts`), task schedule (`opsTick` at 1 Hz in `useWorld.ts`), bot duties from the design database (`content/bot-duties.ts`), wear → `service_dock`, upgrades (look via `withUpgrades`), vines/algae in `aging.ts`, idle life after 1 h / 5 h of real pause (`ops/idle.ts`, `LabEngine.idleActivity`). Lab-wide infrastructure decor is listed in `OPS_INFRA`. UI `components/world/ops/OpsPanel.tsx`
- **Root Lab (`docs/ROOT-LAB.md`):** the terminal as root on the lab. Pure rules `lib/world/root/` (state `WorldState.root`, save v10): rings operator/wheel/root/kernel (`access.ts`, granted by `su` once devices are online), tunables `tunables.ts` (`sysctl`, every knob has default + ring range + kernel-load cost on the MCP-000), firmware clock/voltage per device (`model.ts`: draw × clk·volt², heat = clk·volt vs limit, undervolt browns out, < 90 % clock drops `hasFeature`), cron with guards (`cron.ts`, `rootTick` 1 Hz in useWorld), profiles + share codes, audit, `rescue`. One shell (`shell.ts`, `runRoot` pure → `RootOp`s) for room terminals (`terminal-lite`), Main Console (`root …` / `labor root …` → `bridge.labRoot`, events replayed) and cron. New gameplay constants → add a tunable and read it via `tun(s, key)`
- **Skins — walls & floors (`docs/SKINS.md`):** one concept per room in `lib/world/skins/` (`rooms.ts` 57 concepts: wall family + bands + glyphs, floor family, signature mood, recommended presets, events; `presets.ts` library; `modes.ts` = the shader's reference `skinLevel`; `state.ts` settings/sync/sanitize/power; `voxels.ts` `skinRoomGrid` = 4× fine walls/floors/cornice with the silhouette rule — relief carved, only the cornice at y 7–8 enters the room). Three dynamic channels `skin_line` / `skin_node` / `skin_field` are palette indices 253–255 — **the palette is now full (255)**. Status: concept + generator + tests + Blender renders (`pnpm skins:export|render|sheets|doc`, output `.voxel/skins/`); engine/shader/station tab/save v11 are the plan in § 11, nothing in the running game uses skins yet. `docs/SKINS.md` § 13 is generated (`pnpm skins:doc`, also writes the undevbook feature) — edit the data, not the doc
- **Doors (`docs/DOORS.md`):** every door has its own shape + locking mechanism (`lib/world/doors/style.ts`, deterministic, uniqueness tested; models `models/door-styles.ts`), a lock interface on its jamb (target `doorpanel`, `components/world/doors/DoorPanel.tsx`, modes auto/hold/sealed in counters `door_mode:<id>` via `doors/lock.ts`) and a Doors tab in the surveillance station. `DoorSystem` releases the mechanism before the leaves move and engages it after they close; sealed/gated doors never close on Jade in the doorway. Airlock to the data center (`doors/airlock.ts`: `d_rechen_schleuse` + `d_rechen`, interlock, steam → extraction, `CLEAN_ROOMS` stay dust-free). Collision is style-independent. Voxels only
- **Hero characters (`docs/HERO.md`):** Jade is sculpted as SDF layers (`lib/world/hero/jade-sculpt.ts`, after the portrait), meshed with surface nets (`lib/sculpt/`), skinned to an anatomical skeleton with the voxel rig's 15 joint names (`lib/world/hero/skeleton.ts`) so every pose plays — garment bodies and sleeves are separate layers with restricted weights (`build.ts`, `tests/world/hero-weights.test.ts`); hair = strand engine (groom `jade-groom.ts`, sim `lib/hair/sim.ts`, GPU strands `render/hero/hair-render.ts`, `HeroRig.update(dt)` per frame); built in a worker (`lib/world/hero/load.ts` → `{ layers, groom }`), shaded procedurally (`lib/world/render/hero/materials.ts`), wardrobe recolours via `heroColorsForLook`. Damien's hero is only ever shown veiled until `isDamienRevealed()`. Dev studio `/studio` (dev only)
- **Native:** desktop-only gate `NEXT_PUBLIC_DESKTOP_ONLY` (`lib/native/gate.ts`), Linux = Flatpak + AppImage (`docs/NATIVE.md`)
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

- **Security (audit 2026-09-30, `docs/AUDIT.md`):** per-install secrets in userData (`jwt-secret`, `db-secret`, `operator-secret`, 0600 via `config/secrets.ts`); Postgres uses SCRAM only — `hardenPostgresAuth()` rewrites `pg_hba.conf` on every boot, never reintroduce `trust` or fixed passwords; every pg client/URL needs `dbPassword`. The gateway rejects foreign `Origin`/`Host`, the Next middleware and `/setup` actions accept loopback hosts only (`lib/auth/loopback.ts`); local operator passwords are HMAC-derived (`lib/auth/localOperator.ts`). Window: sandbox, navigation/popup/permission lock-down in `window.ts`; IPC answers only the game's main frame. Child processes get `childEnv()`. New binaries need a pinned SHA-256 in `scripts/download-binaries.ts` (GoTrue has no official Windows build). `UNLABS_USER_DATA_DIR` runs Electron against a throw-away profile for tests.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
