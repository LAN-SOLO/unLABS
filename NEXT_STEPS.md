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

1. **Rush Job** (S): finish a running production job now for
   `ceil(remainingMinutes)` \_unSC (cap 2× the recipe's `unscBurn`), type
   `fee`, `completes_at = now()` — an in-session impulse burn.
2. **Resonance live-wire** (S): wire `pushStateEvent` from harmonize/device
   managers so the 5 dormant protocols, 3 stuck achievements, and 2 mission
   objectives fire — activates ~140 \_unSC of already-budgeted faucet.
3. **Volatility pricing** (M): deterministic date-seeded ±20-25% daily
   modifier on `unscBurn`/rush prices via a shared `chargeForAction()`
   helper — makes checking prices a daily habit.
4. **Kernel Recompile prestige** (L): 500×2ⁿ \_unSC burn for a permanent
   production multiplier (rateMultiplier param in `advanceResources`),
   gated on EP4's reserved prestige flag; the long-horizon sink.

**Security debt (blocker before any real-money framing):** the
`balances` UPDATE RLS policy (20260521000001) lets a client set its own
balance directly with the anon key — the "server-authoritative" economy is
authoritative by convention only. Fix: move burn/earn into SECURITY
DEFINER RPCs keyed on `auth.uid()` and drop the broad UPDATE policy.
Same class: `updateAchievementProgress` and mission `clientProgress`
accept client-asserted progress for reserve-paying claims.

## 0.1.28 — "Onboarding" (the first impression) ⬅ START HERE

1. **Full-chain progression test first.** EP2 and EP3/EP4 have progression
   tests; EP0/EP1/EP5/EP6 don't. Git history is full of "quest stuck" fixes —
   a test that simulates the complete flag chain EP0→EP6 through the pure
   quest engine catches that whole bug class. An afternoon of work; protects
   everything below. (`tests/game/ep2-progression.test.ts` is the template.)
2. **Make EP0/EP1 interactive.** Both episodes are click-through (`continue`
   triggers) while EP2–EP6 anchor to real game flags. Migrate steps to
   `command`/`flag` triggers ("type `dmesg`", "power on BAT-001") — design
   note in `lib/game/quests/ep0.ts:18`; the `data-*` overlay anchors are
   already wired.

## 0.1.29 — "Research" (the mid-game engine)

3. **Tech-tree content.** 6 of 8 trees are empty (only Refine + Tools, 6
   nodes total) — the monitor page even tells players so. Engine, provider,
   UI, and tests all exist; nodes go in `lib/game/techTree/catalog.ts`,
   design templates in `.local/docs/`. Biggest content lever: research
   drives progression and device unlocks.
4. **Achievement balancing.** Tier-2/3 targets are placeholders "pending
   balancing" (`lib/game/achievements/catalog/resource.ts:5`). The new
   `totalProduced`/`totalConsumed` counters provide real measures now.
5. **Make /monitor discoverable** — currently linked only from /lab and
   /dev, not from terminal or panel.

## 0.1.30 — "Depth & Reach"

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
