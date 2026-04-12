# Changelog

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
