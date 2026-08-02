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

### Supabase / Data

- Clients in `lib/supabase/`; schema types `types/database.ts` (regenerate via `pnpm db:types`) + `types/devices.ts`
- All device DB ops go through `lib/api/devices.ts`; sysprefs split into `sysprefs.ts` (client) and `sysprefs-server.ts` (server actions — canonical loader)
- Prefer RPCs/embeds/upserts over sequential queries (established perf pattern)

### Save Game

`lib/panel/panelState.ts` is the single source of truth for serialized state (incl. kernel snapshot); `lib/panel/buildPanelSaveData.ts` assembles it. Read both before adding any persistence.

### Desktop (Electron) — `electron/`

`main.ts`, `window.ts`, `auth/`, `services/`, `config/`; compiled to `dist-electron/` via `pnpm electron:compile`. `scripts/build-desktop.ts` packages with electron-builder (`electron-builder.config.ts`) → output in **`.INSTALL/`** (note the leading dot). Bundled binaries (Postgres/PostgREST/GoTrue) land in `bin/` via `pnpm download:binaries`.
