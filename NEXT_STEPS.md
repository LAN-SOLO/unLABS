# NEXT STEPS — UnstableLabs

**Stand:** 2026-08-06 · **Branch:** `main` · **Version:** `0.1.27-beta`

Working agenda after the August project audit, organized as release
packages. Self-contained — pick up by re-reading this file.

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

## Shipped 2026-08-08 — Economy slice 1: Daily Contracts

The CRONWORK design (multi-agent design review, winner over sink-first
OVERDRIVE and endgame-first RECOMPILE): date-seeded daily contracts +
streaks + reroll/insurance sinks, reserve-funded payouts (`daily` source),
`daily` terminal command, WelcomeBack board, ledger-integrity migration
(20260808000001). Follow-up slices, in dependency order:

1. ~~**Rush Job** (S)~~ — shipped 2026-08-08: `lab jobs` / `lab rush <n>`,
   1 \_unSC per started minute remaining (min 1, cap 2× `unscBurn`).
2. ~~**Resonance live-wire** (S)~~ — shipped 2026-08-08:
   `useResonanceEventBridge` (device state/param + thermal + heartbeat),
   command feed in useTerminal, VNT purge event. Open ends:
   `qbridge sync` / `kernel sync --deep` don't exist as real subcommands
   yet (they count via the command feed but print errors); OSC-001 state
   stands in via the `osc_001_online` flag; DIM "scan" maps to the
   rift-scan test phase; THERMAL-PHOENIX ≥85° is only reachable via
   CPU/GPU zones (panel is clamped to 80°).
3. ~~**Volatility pricing** (M)~~ — shipped 2026-08-08:
   `lib/game/volatility.ts` (global ±25%/day, 1% steps), charged in
   startJob/rushJob/startResearch, displayed in lab, TechGraph, and the
   research/lab/daily terminal outputs. `qbridge sync` and the `kernel`
   command are real now (closes the resonance ritual gap).
4. ~~**Kernel Recompile prestige** (L)~~ — shipped 2026-08-08:
   `prestige_state` table + `kernel_recompile()` RPC (500×2ⁿ, cap 20,
   ENDGAME_UNLOCKED gate), 1.5^level multiplier on net-positive rates in
   `advanceResources`, `recompile` command, computeWhatNext endgame
   branch. All four economy slices are live.

**Security debt:** ~~balances UPDATE RLS~~ — fixed 2026-08-08
(20260808000002: `unsc_burn`/`unsc_earn` SECURITY DEFINER RPCs keyed on
`auth.uid()`, earn dev-gated, UPDATE policy dropped). Still open, same
class: `updateAchievementProgress`, mission `clientProgress`, and
resonance `logDiscovery` accept client-asserted progress for
reserve-paying or reward-granting claims.

## 0.1.28 — "Onboarding" — DONE 2026-08-10

1. ~~**Full-chain progression test**~~ —
   `tests/game/full-chain-progression.test.ts`: all 32 steps EP0→EP6
   through the pure engine, trigger-derived flag keys, QUEST-STUCK
   detection (every gate needs a legitimate setter), cascade fixpoint
   from every state. Zero stuck candidates at landing.
2. ~~**Make EP0/EP1 interactive**~~ — EP0 opens with a real `dmesg`
   (new terminal→quest cmd:\* bridge: success-gated command feed,
   allow-listed `^cmd:[a-z0-9_-]{1,32}$`, overlay shows "awaiting:
   <command>") and closes on `grid_online` (power BAT/NET/MEM).
   EP1's Lissajous lock was already real; `ep1.power_on` stays
   continue (`osc_001_online` is set by the step itself — needs an
   OSC manager first).

## 0.1.29 — "Research" — DONE 2026-08-10

3. ~~**Tech-tree content**~~ — all 8 trees populated (24 new nodes,
   tier 1–4 chains, ~1.9k \_unSC of research sinks, no-placebo-effects
   rule + integrity tests).
4. ~~**Achievement balancing**~~ — accumulation tiers measure
   lifetime `totalProduced` (held-amount targets were
   capacity-clamped: abstractum caps at 100, "stockpile 500" was
   unreachable). Energy T1/T2 stay held-amount as research gating.
5. ~~**Make /monitor discoverable**~~ — `monitor` terminal command
   (aliases unmonitor, mon).

## 0.1.30 — "Depth & Reach" ⬅ START HERE

6. **Mission depth.** M008–M018 average 3–5 thin objectives vs. 7–10 rich
   ones in M001–M007 (hints, deep-dives, voice). Bring them up to par.
7. **Fix the Windows desktop build.** The `afterPack` hook in
   `electron-builder.config.ts:41` writes to a hardcoded macOS path
   (`*.app/Contents/Resources/app`), so `build:win` output is missing Next's
   `node_modules`. Branch on `context.electronPlatformName`, run
   `pnpm build:win`, verify the installer. Windows hasn't been built since
   0.1.2-alpha (April) — until fixed, don't advertise the installer.
8. **E2E for authed flows.** Authenticated Playwright fixtures, then:
   tutorial first-load → DifficultyPicker → first overlay step; achievement
   toast; research unlock via Nexus; mission claim (m007/m008).

## 0.2.0 — the strategic question

The old roadmap's marketplace/staking/on-chain/NFT phases
(`.local/notes/roadmap.md`, phases 5–9) were never started. Decide: build
or officially cut. If cut, drop `@solana/web3.js` (production dep used for
one type import in `types/phantom.ts`) and the wallet integration — the
game positions cleanly as an idle/puzzle title, simplifying deps to
marketing.

## Later / structural

- Lint to zero: bulk-rename unused `ctx` → `_ctx` in
  `lib/terminal/commands.ts`.
- Split `lib/terminal/commands.ts` (26k lines) along its 36 banner sections;
  rebuild `tests/terminal/command-registration.test.ts` first (it
  regex-parses the monolith and breaks on split).
- Component tests for critical providers (PowerManager, MissionProvider,
  ThermalManager) — `@testing-library/react` is installed but unused.
- Move `pg`/`jsonwebtoken` to electron-only handling.

## Reference

```bash
pnpm check        # full CI gate
pnpm db:types     # regenerate types/database.generated.ts (Supabase must run)
pnpm test:e2e     # Playwright route smoke suite
```
