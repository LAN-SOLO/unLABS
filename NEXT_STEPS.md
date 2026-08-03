# NEXT STEPS — UnstableLabs

**Stand:** 2026-08-02 · **Branch:** `main` · **Version:** `0.1.27-beta`

Working agenda after the August project audit. Self-contained — pick up by
re-reading this file.

## Current State

| Check      | Status                                               |
| ---------- | ---------------------------------------------------- |
| Typecheck  | clean                                                |
| Unit tests | 142/142 pass (13 files)                              |
| E2E        | 11 Playwright tests (route smoke suite, chromium)    |
| Lint       | 0 errors, ~260 warnings (mostly unused `ctx` params) |
| Content    | EP0–EP6 + M001–M021 complete; 38 devices wired       |

Recently done (Aug 2): route-level e2e suite enabled, `types/database.ts`
regenerated from schema (54 tables, `AnyTable` workarounds removed —
`Database` now comes from `types/database.generated.ts` via `pnpm db:types`),
migrator orphan-recovery cutoff bumped, CHANGELOG caught up through 0.1.27.

## Short-term (infrastructure)

1. **Fix the Windows desktop build.** The `afterPack` hook in
   `electron-builder.config.ts:41` writes to a hardcoded macOS path
   (`*.app/Contents/Resources/app`), so `build:win` output is missing Next's
   `node_modules`. Branch on `context.electronPlatformName`, then run
   `pnpm build:win` once and verify the installer. Windows hasn't been built
   since 0.1.2-alpha (April). Until fixed, don't advertise the Windows
   installer.
2. **Lint to zero.** Bulk-rename unused `ctx` → `_ctx` in
   `lib/terminal/commands.ts`; fix the handful of stragglers elsewhere.
3. **E2E for authed flows.** Add authenticated Playwright fixtures, then
   cover: tutorial first-load → DifficultyPicker → first overlay step;
   achievement toast on a deterministic trigger; research unlock via Nexus;
   mission claim (m007/m008). See `e2e/routes.spec.ts` for the pattern.

## Mid-term (game content — the actual product)

4. **Tech-tree content.** 6 of 8 trees are empty (only Refine + Tools have
   nodes, 6 total). Engine, provider, UI, and tests all exist —
   `lib/game/techTree/catalog.ts` is where nodes go.
5. **Mission depth.** M008–M018 average 3–5 thin objectives vs. 7–10 rich
   ones in M001–M007 (hints, deep-dives, voice). Bring them up to par.
6. **Interactive early game.** EP0/EP1 steps are click-through (`continue`
   triggers). Migrate to `command`/`flag` triggers so the opening teaches by
   doing (design note already in `lib/game/quests/ep0.ts:18`).

## Later / structural

- Split `lib/terminal/commands.ts` (26k lines) along its 36 banner sections;
  rebuild `tests/terminal/command-registration.test.ts` first (it regex-parses
  the monolith and breaks on split).
- Component tests for critical providers (PowerManager, MissionProvider,
  ThermalManager) — `@testing-library/react` is installed but unused.
- Decide the fate of the old roadmap's marketplace/staking/on-chain phases
  (`.local/notes/roadmap.md`) — build or officially cut.
- Drop `@solana/web3.js` (production dep used for one type import in
  `types/phantom.ts`); move `pg`/`jsonwebtoken` to electron-only handling.

## Reference

```bash
pnpm check        # full CI gate
pnpm db:types     # regenerate types/database.generated.ts (Supabase must run)
pnpm test:e2e     # Playwright route smoke suite
```
