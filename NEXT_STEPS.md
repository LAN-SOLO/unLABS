# NEXT STEPS — UnstableLabs

**Generated:** 2026-05-13 · **Branch:** `main` · **Version:** `0.1.9-alpha`

This doc captures the working agenda after the project-status audit. It is self-contained so the context window can be cleared between steps; pick up by re-reading this file.

---

## Current State

| Check                           | Status                                                                |
| ------------------------------- | --------------------------------------------------------------------- |
| TypeScript (`pnpm typecheck`)   | clean                                                                 |
| Unit tests (`pnpm test`)        | **104/104 pass** across 9 test files                                  |
| Production build (`pnpm build`) | clean (13 routes)                                                     |
| ESLint (`pnpm lint`)            | 0 errors · 261 warnings (mostly unused `ctx` params in `commands.ts`) |
| Prettier (`pnpm format:check`)  | 10 files need formatting                                              |

### In-flight work (uncommitted)

A major feature push is fully implemented, wired, and tested, but **not yet committed**. Summary:

**New systems** (engine + tests + provider + server actions):

- Achievements — `lib/game/achievements/`, `contexts/AchievementProvider.tsx`, 20 tests
- Tech Tree / Research — `lib/game/techTree/`, `contexts/TechTreeProvider.tsx`, plus **NXS-01 Nexus** tier-2 device + in-terminal `TechGraph` app, 20 tests
- Tutorial — `lib/game/tutorial/`, `contexts/TutorialProvider.tsx`, `components/onboarding/` (DifficultyPicker, TutorialOverlay, WelcomeBackModal)
- Hint Escalation — `lib/game/hints/`, `contexts/HintEscalationProvider.tsx`, 7 tests
- Journal — `components/journal/`, `contexts/JournalProvider.tsx`
- Phase Observers — `contexts/PhaseObservers.tsx`
- Device Unlock gating — `hooks/useDeviceUnlocked.ts` + `lib/game/devices/unlocks.ts` + `components/panel/modules/GatedTile.tsx` (wired into all 22 device managers)
- Reserve burn economy — `lib/game/economy.ts`

**Content:**

- Quest episodes EP2, EP3, EP4 (`lib/game/quests/ep2|3|4.ts`) — 41 progression tests
- 7 new missions `m007`–`m013` in `lib/game/missions/catalog/`
- 5 new Supabase migrations (`tutorial_state`, `reserve_burn`, `achievements`, `tech_tree_research`, `tutorial_difficulty`)

Everything compiles. Providers nest correctly in `game-shell.tsx`. Terminal receives `tutorialActions` / `achievementActions` / `researchActions`. Missions index registers `m001–m013`. Quest index registers `EP2–EP4`.

---

## The 4 Steps

### Step 1 — Format + commit the WIP push ⬅ START HERE

**Goal:** Get ~70 uncommitted files into clean, logical commits so history is reviewable and rollback is possible.

1. Run `pnpm format` to fix the 10 files flagged by prettier.
2. Re-run `pnpm typecheck && pnpm test` to confirm still green.
3. Split into logical commits (proposed order — each leaves the build green):
   1. **DB migrations + types** — `supabase/migrations/2026042*.sql`, `supabase/migrations/20260429*.sql`, `types/database.ts`
   2. **Core economy (reserve burn)** — `lib/game/economy.ts`, `tests/game/economy-reserve.test.ts`
   3. **Achievement system** — `lib/game/achievements/`, `contexts/AchievementProvider.tsx`, `app/(game)/actions/achievement.ts`, `tests/game/achievement-*.test.ts`
   4. **Tech tree + Nexus device** — `lib/game/techTree/`, `contexts/TechTreeProvider.tsx`, `contexts/NexusManager.tsx`, `app/(game)/actions/research.ts`, `components/nexus/`, `devices/tier-2/NXS-01_Nexus/`, `components/panel/modules/NexusModule.tsx`, `tests/game/tech-tree-engine.test.ts`
   5. **Tutorial + onboarding + welcome-back** — `lib/game/tutorial/`, `contexts/TutorialProvider.tsx`, `components/onboarding/`, `app/(game)/actions/tutorial.ts`, `contexts/GameTickProvider.tsx` (offline-delta additions)
   6. **Hint engine + Journal + Phase observers** — `lib/game/hints/`, `contexts/HintEscalationProvider.tsx`, `contexts/JournalProvider.tsx`, `contexts/PhaseObservers.tsx`, `components/journal/`, `tests/game/hint-engine.test.ts`
   7. **Device unlock gating** — `hooks/useDeviceUnlocked.ts`, `lib/game/devices/unlocks.ts`, `components/panel/modules/GatedTile.tsx`, the 22 modified `contexts/*Manager.tsx` files (+5/-0 each), `app/(game)/panel/panel-client.tsx`
   8. **Quest episodes EP2/EP3/EP4** — `lib/game/quests/ep2|3|4.ts`, modifications to `ep1.ts`, `types.ts`, `index.ts`, `contexts/QuestProvider.tsx`, `app/(game)/actions/quest.ts`, `components/quest/QuestOverlay.tsx`, `tests/game/ep2-progression.test.ts`, `tests/game/ep3-ep4-progression.test.ts`
   9. **Missions m007–m013** — `lib/game/missions/catalog/m007-…ts`–`m013-…ts`, `lib/game/missions/index.ts`, `contexts/MissionProvider.tsx`, `components/mission/MissionPanel.tsx`, `components/mission/TaskChecklist.tsx`
   10. **Terminal + shell wiring** — `components/terminal/Terminal.tsx`, `hooks/useTerminal.ts`, `lib/terminal/commands.ts`, `lib/terminal/types.ts`, `app/(game)/game-shell.tsx`, `app/(game)/layout.tsx`, `lib/game/recipes.ts`, `app/(game)/actions/production.ts`
   11. **Misc chores** — `electron/*`, `electron-builder.config.ts`, `package.json`, `.mcp.json`, `app/(auth)/*`, `app/globals.css`, `components/panel/displays/Oscilloscope.tsx`, `INSTALL/`

Some files (e.g. `Terminal.tsx`) are touched by multiple features. They land in commit #10 (wiring) — earlier feature commits may not be fully wired in isolation, which is acceptable for a fast-moving alpha. If strict bisectability is required, squash to fewer commits.

**Do not push.** The user will review locally first.

---

### Step 2 — Browser smoke test

**Goal:** Type/unit tests verify code correctness, not feature correctness. Walk the golden paths in a real browser.

1. `pnpm dev` → open http://localhost:3000
2. Log in or register a new account.
3. Walk each new flow:
   - **Tutorial:** DifficultyPicker on first load → TutorialOverlay steps → WelcomeBackModal after >60s offline.
   - **Achievements:** trigger an early achievement (e.g. first power-on, first resource milestone), confirm toast + journal entry.
   - **Tech Tree:** boot NXS-01, open `TechGraph` from terminal app, research a node, confirm unlock.
   - **Missions m007–m013:** check they appear in the mission panel and progress correctly.
   - **Episodes:** progress through EP2 → EP3 → EP4 (or manually fire the relevant `set_flag` to fast-forward).
   - **Device unlock gating:** confirm `GatedTile` shows for locked devices and unlocks via tech tree.
4. Watch the browser console for errors and the dev server for warnings.

---

### Step 3 — E2E coverage gap

**Goal:** Add Playwright smoke tests for the new critical paths. Currently `e2e/` covers auth + base terminal; no coverage for tutorial / achievements / research / missions.

Suggested priority order:

1. Tutorial first-load → DifficultyPicker → first overlay step
2. Achievement unlock toast on a deterministic trigger
3. Research-node unlock via Nexus
4. Mission completion path for `m007` or `m008`

Reuse the existing Playwright setup in `playwright.config.ts` and the helpers in `e2e/`.

---

### Step 4 — Lint cleanup (optional)

**Goal:** Bring `pnpm lint` to zero warnings.

The 261 warnings are dominated by:

- ~200 unused `ctx` params in `commands.ts` (command handlers that don't consume context)
- ~4 `any` types in `commands.ts`
- A handful of unused-import warnings elsewhere

Approach:

1. `pnpm lint:fix` to auto-fix the 4 trivially fixable ones.
2. For unused `ctx`: bulk-rename to `_ctx` via search-and-replace, or remove the param when the handler signature allows it.
3. Replace `any` with `unknown` + narrow per project rule.

Low priority — no functional impact, purely hygiene.

---

## Quick reference

```bash
# Health checks
pnpm typecheck
pnpm test
pnpm build
pnpm lint
pnpm format:check

# Combined CI gate
pnpm check

# Dev
pnpm dev
```
