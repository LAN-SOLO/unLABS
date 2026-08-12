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

## 0.1.30 — "Depth & Reach" — DONE 2026-08-10

6. ~~**Mission depth**~~ — M008–M018 raised to the M001–M007 standard
   (6–7 objectives across 2–3 tasks, hints/deep-dives everywhere, all
   four voice roles, relatedDeviceIds); IDs and rewards untouched.
   Bonus: fixed a genuine M016 deadlock (scan objective gated on the
   flag only its own claim sets — blocked EP5 step 3 transitively).
7. ~~**Windows desktop build**~~ — afterPack branches on
   electronPlatformName; UnstableLabs-Setup-0.1.27-beta.exe built on
   macOS with next's nested node_modules verified present. Still to
   do before advertising: a smoke run on real Windows.
8. ~~**E2E authed flows**~~ — setup project provisions a fresh
   confirmed user per run (localhost-guarded admin API), logs in via
   the real UI; four flows green: DifficultyPicker→overlay, dmesg→EP0
   advance (cmd:\* bridge end-to-end), balance box, daily board.
   Remaining flow ideas: achievement toast, research unlock, mission
   claim.

**Follow-up (small):** the full-chain test treats "allow-listed" as
"settable" — M016 showed a flag can be allow-listed yet never set by
any code path. Tighten the stuck-detection to require an actual
setter (grep client bridges) or an explicit exemption list.

## 0.2.0 — the strategic question — DECIDED: BUILD (2026-08-12)

The user chose to build the on-chain layer. Shipped in the first pass
(every mutation behind SECURITY DEFINER RPCs; user-JWT anon key can
read but never forge):

- **Wallet linking** — one verified Solana wallet per account,
  ed25519 signature over a stateless user+hour challenge, verified in
  TS (tweetnacl), written only by the service-role client. `wallet`
  command (status/link/unlink/balance); solana-balance route now
  403s on non-owned addresses.
- **Staking** (roadmap phase 6) — 7-day lock, 0.5%/full-day rewards
  from the deflationary reserve (source 'staking'). `stake` command.
- **Marketplace** (phase 5) — public crystal listings, atomic
  market_buy with 5% fee leaving circulation, counterparty ledger
  rows. `market` command.
- **Trust hardening** — reserve-paying achievement claims re-derive
  construction/breadth/trade truth from production_jobs/balances;
  monotonic progress writes; mission craft_count claims use DB
  counts. Documented residual: resource/energy/exploration branches
  and non-craft mission objectives remain client-trusted (no DB
  mirror).
- **NFT scaffolding** (phase 9, partial) — Metaplex-standard
  metadata route for minted crystals (`/api/crystal-metadata/[id]`);
  `crystals.mint_address` was schema-ready from day one.

**Still open before anything touches real value:**

1. **Devnet mint flow** — needs a funded devnet keypair (user
   provisions; never commit keys) + `@metaplex-foundation/*` deps;
   mint on request for wallet-linked users, write mint_address back.
   The metadata route and in-game mint path (position bug fixed
   2026-08-12 — minting had never worked end-to-end) are ready.
2. ~~**Slice manipulation** (phase 7)~~ — shipped 2026-08-12: `slice`
   command over merge/split/swap RPCs (90%/95% retention, fee burns,
   listed-crystal guard, direct-slice-write RLS hole closed).
   ~~**Solana volatility** (phase 8)~~ — shipped 2026-08-12:
   /api/volatility-feed (mainnet TPS → tier, cached snapshots,
   graceful stale) rendered in `scan`'s NETWORK TELEMETRY block.
3. **Legal/regulatory review before any mainnet or real-money
   framing** — a tradeable token with cash value is a different
   compliance regime than an in-game currency; this is a
   user/counsel decision, not an engineering task.
4. Service-role key must be provisioned in every deploy target for
   wallet linking + volatility snapshots (both degrade gracefully
   without it).

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
