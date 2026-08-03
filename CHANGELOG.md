# Changelog

## v0.1.27-beta (2026-06-06)

### Fixed

- **Mission claim buttons unblocked.** Claim no longer stays disabled after
  reload; claimed missions remain reviewable in the panel.
- **Desktop window fit.** Game content is fitted to the desktop (Electron)
  window instead of overflowing it.

## v0.1.26-beta (2026-05-29)

Version-bump-only release (desktop rebuild). No code changes.

## v0.1.25-beta (2026-05-29)

### Added

- **`harmonize` terminal command** for resonance input.

## v0.1.24-beta (2026-05-29)

### Fixed

- **Atomic mission claim** with client-side progress, closing the window for
  double-claims.

## v0.1.23-beta (2026-05-29)

### Added

- **AND-001 sensitivity slider** on the panel tile.

## v0.1.22-beta (2026-05-28)

### Fixed

- **Midnight Commander file views** are reported to the mission system, so
  file-view objectives track.
- **Boot sequence** stays inside the viewport (no overflow).
- **Mission progress** derived client-side is persisted before claim.

## v0.1.21-beta (2026-05-28)

### Fixed

- **Mission tracking** for device, command, and flag objectives.

## v0.1.20-beta (2026-05-27)

### Added

- **Quest episodes EP5 (Quantum Frontier) and EP6 (Convergence)** with 8 new
  missions (m014–m021).
- **Tier 3 device recipes** (EMC, QAN, QSM, AIC, SCA, TLP) and exotic
  material crafting.

### Changed

- **PowerManager overhaul:** source state sync, performance throttle, load
  shedding, initial state hydration. BAT and MFR managers sync to
  PowerManager as the authoritative source.

### Fixed

- ResourceBar wired to GameTickProvider for live data.
- Electron navigation with `window.location` fallback.
- Quest cascade wrapped in `startTransition`.

_(Versions 0.1.18/0.1.19 were never released — numbering jumped from
0.1.17 to 0.1.20.)_

## v0.1.17-beta (2026-05-26)

### Fixed

- **Quest stuck at EP2 step 4 "Build NXS-01".** Production recipe flags
  (`nexus_built`, `smt_01_online`, `cnd_01_online`, `mix_01_online`,
  `three_chains_online`, `mfr_001_online`) were missing from the
  `CLIENT_SETTABLE_FLAGS` whitelist in `setQuestFlagAction`. The server
  silently returned `flag_not_allowed`, so the cascade-advance never
  fired after claiming a device recipe. The client set the flag locally
  (GatedTile showed the module) but the quest engine never advanced.

## v0.1.16-beta (2026-05-23)

### Added

- **NexusModule visual redesign.** Full retro-industrial device surface
  with 3D fold/unfold animation, LED status indicators, power toggle,
  animated tech-graph SVG (6 nodes, prerequisite edges, holo-sweep
  scan, CRT flicker), data-stream progress bar for active research,
  pulsing amber claim button, CRT scanline overlay, and mini node-status
  LED dots in the footer. Five CSS animations: sweep, flicker,
  research-pulse, data-stream, claim-glow.
- **Cold-boot startup sequence.** BIOS POST with hardware checks,
  hex memory scan, \_unOS kernel boot messages, and a freaky anomaly
  intercept (screen glitch + cryptic hex dump) before "SYSTEM READY."
  Plays once per session on first terminal load (~4.5 s), uses
  `sessionStorage` flag so reboots via terminal commands also trigger it.

### Fixed

- **NXS-01 Nexus now appears as a real tile in the panel.** The
  `NexusModule` component existed but was never mounted in
  `panel-client.tsx`, so players who built the Nexus could see it in
  `device list` but couldn't interact with it on the hardware panel.
  Added to the CORE OPERATIONS row, gated through `GatedTile`.
- **Unlock flag**: `NXS-01` was gated on `nexus_blueprint_visible`
  (lab-visibility) which meant a player past EP2 step 3 but without an
  actual built Nexus would see a blank tile (the module self-hides on
  `!nexus.isBuilt`). Switched to `nexus_built` so LOCKED stays until
  the device actually exists.
- **Device-ID consistency**: the terminal `device list` and man page
  used `NXS-001` (3-digit) while the canonical ID in
  `DEVICE_UNLOCK_FLAGS` and the module display is `NXS-01` (2-digit,
  matching SMT-01 / CND-01 / MIX-01). Aligned to `NXS-01` everywhere.

## v0.1.15-beta (2026-05-22)

Follow-up tuning after 0.1.14-beta live-testing.

### Fixed

- **Cascade was too aggressive.** Original implementation walked through
  every unsatisfied step up to the furthest satisfied trigger, which on
  a returning EP3 player (`welcome_back_seen=true`, no research started)
  silently completed steps 1 & 2 and granted their milestone flags. New
  rule: cascade looks at most **one** step ahead — enough to unstick the
  EP2 "Nexus before bottleneck observer" case, not enough to fabricate
  milestones.
- **Episode Jumper write was misleading.** Clicking an EPx button used
  to immediately update `profiles.current_episode` while leaving the
  active quest_state untouched, so the header read "EP1" while the
  footer still read "active: EP2 step 3". Buttons now select locally
  only; **RESET EPISODE** remains the single mutator and applies the
  selection.
- **NXS-001 Nexus missing from `device list`.** The Nexus was wired
  through `NexusManager` but never added to the device-registry
  terminal output, so players who built it couldn't find it in `device`
  / `device list` / `device unman`. Added registry row + man-page
  entry. Status surfaces as `LOCKED` (not built), `STANDBY` (built but
  offline), or `ONLINE`.

## v0.1.14-beta (2026-05-22)

Quest-engine resilience pass + dev-tooling cleanup. Triggered by a stuck EP2
save where the player built the Nexus before the abstractum-bottleneck
observer tripped — engine had no path out of step 3.

### Fixed

- **Out-of-order quest triggers no longer strand the player.** Engine now
  `cascadeAdvance`s: if a later step's trigger is satisfied while the current
  step's isn't, intermediate steps force-advance (with their rewards still
  applied) until the engine hits a genuinely unsatisfied trigger. Cascades
  across episode boundaries via `nextEpisode`. Wired into both
  `advanceQuestStep` (continue button) and `setQuestFlagAction` (recipe
  claims, observer flips) so the engine stays in its most-advanced state
  the instant a flag changes.
- **Dev console was not scrollable** — `min-h-screen` clamped against the
  global `overflow: hidden`. Now `h-screen overflow-y-auto` like `/lab`.
- **Journal panel overlapped the quest overlay** — both lived on the right.
  Moved the journal slide-out drawer to the **left** edge; quest stays
  right-anchored. No more dueling z-indices.

### Added

- **`undev` / `unpanel` / `unlab` terminal commands** for jumping between
  `/dev`, `/panel`, and `/lab`. `undev` was previously an alias of the
  `device` management command; freed and repurposed (device keeps `dev` and
  `devices`).
- **`// QUEST FLAGS` section** in the dev console — sorted flag table +
  completed step list, with the existing live-state JSON dump now including
  the full `quest` slice.
- **`> CASCADE ADVANCE` button** in the dev console — force-runs
  `cascadeAdvance` on the persisted state. Heals saves stranded by an
  out-of-order trigger and is also useful as a "what would the engine do
  right now?" probe.
- **One-shot device recipes hide from the lab once built.** Smelter,
  Condenser, Mixer, Nexus, and MFR-001 disappear from the catalog the moment
  their corresponding online/built flag flips. Repeatable material/energy
  recipes are unaffected. Future upgrade paths would ship as separate
  recipe ids (e.g. `nxs_01_upgrade_t3`).

### Changed

- Desktop build artifacts now land in **`.INSTALL/`** instead of `INSTALL/`
  (`electron-builder.config.ts:directories.output`). Hidden dot-dir keeps
  the project root cleaner.

## v0.1.10-beta (2026-05-21)

First beta cut after the WIP push for achievements, tech tree, tutorial, hint engine,
journal, phase observers, device unlock gating, reserve burn economy, EP2–EP4 quests,
and missions m007–m013. Discovered during Step-2 browser smoke testing.

### Fixed

- **`_unSC` burn was silently a no-op** — `balances` table had no UPDATE RLS policy, so
  `burnUnsc()` consistently returned `ok: true` while updating zero rows. Every recipe
  burn (start of Smelter, Condenser, etc.) failed without surfacing an error. Added
  migration `20260521000001_balances_update_policy.sql` granting per-user UPDATE.
- **Production `set_flag` rewards never fired** — `ProductionProvider.applyRewards` had
  a Phase-5 TODO that dropped flag-setting rewards on the floor. Effect: claiming
  Smelter never set `smt_01_online`, so Condenser/Mixer/Nexus recipes stayed locked and
  EP2 stalled at step 1/4. Now plumbed through `quest.setFlag()`, with a one-shot
  backfill on mount so already-claimed devices retroactively set their flags.
- **`craft_count` mission objectives never advanced** — no path incremented progress
  for "craft N of recipe X" objectives, so M001/M002/M007/etc. never ticked and the
  tutorial overlay's auto-advance was permanently stuck on STEP 4. `MissionProvider`
  now derives `craft_count` progress from `production.jobs` (same pattern as
  `resourceThresholdProgress`).
- **`guide` terminal command failed for fresh players** — bailed with "No active
  mission" because nothing was in `activeMissionIds`. Now falls back to the
  highest-priority `available` mission so the walkthrough is always reachable.
- **ANSI escape codes leaked as literal text** in the terminal output
  (e.g. `[32m MISSION CONTROL [0m`). Renderer now strips `\x1b[..m` SGR sequences.
- **`/lab` page not scrollable** — global `overflow: hidden` on `html, body` (added
  for the panel route) made long recipe lists / history inaccessible without a window
  resize. Lab container is now `h-screen overflow-y-auto`.
- **`[a-zA-Z0-9_-]+` pattern attribute** in `/setup` and `/register` threw a Chromium
  `/v` (unicode-sets) regex parse error. Hyphen moved to start of character class.

### Added

- **`lab` terminal command** (alias `production`) navigates to `/lab`. Tutorial overlay
  step `m001-craft-energy-cell-intro` told players to type `lab`; the command was
  missing entirely.
- **Mission events written to the journal** — `MissionProvider` emits journal entries
  when a mission first becomes available and when an objective completes, so
  dismissing the tutorial overlay no longer means losing visibility into next steps.

### Known issues (tracked, not yet fixed)

- Same-recipe parallel jobs still allowed; energy is consumed upfront only. A
  full power-load production system (live E/s draw, same-recipe serialization,
  parallelism capped by available energy) is queued as a separate workstream.
- `/panel` and `/lab` track resources independently (PanelSaveData vs. tick engine);
  Energy/Abstractum values diverge between the two views.
- Default Abstractum capacity stays at 100 across the whole progression; MFR-001
  needs 120 ABS to start and is currently uncraftable without a manual cap raise.
- Tutorial overlay dismiss is one-way — no UI re-show after clicking `×`.

---

## v0.1.2-alpha (2026-04-11)

### Fixed

- **Operator login**: Fixed "invalid JWT" / "Failed to prepare login session" error when continuing as an existing operator
- **Operator deletion**: Fixed delete failing with JWT signature error — now deletes via database cascade instead of admin API
- **Password consistency**: All local operators now use a standard password so login always works on subsequent launches

### Changed

- Delete operator now uses database-level cascade delete (profiles -> saves, balances, etc.) with best-effort auth cleanup
- Sign-in fallback: if admin password reset fails, attempts re-signup to recover the session

---

## v0.1.1-alpha.1 (2026-04-11)

### Added

- **Setup screen**: New onboarding page shown on every launch with three options:
  - Continue as existing operator (cyan button with last-seen date)
  - Create new operator (green button)
  - Import save file (amber button)
- **Delete operator**: Trash icon next to each operator with safety confirmation (must type username to confirm)
- **Save/Export/Import**: Bottom bar buttons for manual save, export .json, and import .json

### Fixed

- **Devices start unpowered**: All 31 device managers now default to `isPowered: false` instead of `true` — fresh games start with all devices OFF, matching the Cold Boot (EP0) design
- **Overlapping displays**: Removed terminal `clamp()` minWidth, added `overflow-hidden` to displays row children
- **Window size selector**: Rewrote to use `transform: scale()` instead of broken CSS property overrides

---

## v1.0.0 (2026-04-10)

### Added

- **Desktop app**: Electron wrapper with embedded PostgreSQL 17.2, GoTrue v2.188.1, PostgREST 12.2.8
- **Mac installer**: DMG with drag-to-Applications
- **Windows installer**: NSIS setup wizard
- **Auto-bootstrap**: First launch initializes database, runs all 17 migrations, creates auth schema
- **Offline play**: Fully self-contained, no internet or Docker required
- **Mission system**: 6 missions with multi-objective tracking, hint escalation, and `whatnext` terminal command
- **Resonance protocols**: 5 hidden device-action sequences (uncommon/rare/legendary) with sliding window detection
- **Notification system**: Ephemeral CRT-styled toasts for mission progress and discoveries
- **Discovery log**: Journal of found resonance protocols accessible via panel and terminal
- **Terminal commands**: `whatnext`, `missions`, `discoveries` with full ANSI formatting
- **Lore files**: Jade's margin notes and Fridge's engineering logs in `/unvar/log/`
- **Contextual tips**: 7 game-state-aware tips in the mission panel footer
- **Device tile markers**: Pulsing cyan dots on devices related to active mission objectives
- **EP1 completion**: Sets `missions_unlocked` flag to transition from linear quests to open-world missions
