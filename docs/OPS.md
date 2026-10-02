# Operations — surveillance, routines, schedule, bots, idle life

The lab runs on its own once Jade knows it: cameras watch every room, Jade
remembers how she solved things and finishes her habits by herself, bots work
their duties on a timetable and go to their docks for service, the greenhouse
grows and overflows, and when the player is away Jade lives her own life.

All rules are pure (`lib/world/ops/`, no React, no three). The UI is
`components/world/ops/`. State lives in `WorldState.ops` (save v9).

## Files

| Area                                | File                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| State, limits, sanitising           | `lib/world/ops/state.ts` (`initialOps`, `sanitizeOps`, `SURVEILLANCE_PROP`)                                                                 |
| Routines, learning, habits          | `lib/world/ops/routines.ts`                                                                                                                 |
| Bot duties, wear, service, upgrades | `lib/world/ops/bots.ts`, data `lib/world/content/bot-duties.ts`                                                                             |
| Schedule (tasks, `opsTick`)         | `lib/world/ops/schedule.ts`                                                                                                                 |
| Idle life (pause > 1 h / 5 h)       | `lib/world/ops/idle.ts`                                                                                                                     |
| Vines, algae                        | `lib/world/aging.ts` (`VINE_ROOMS`, `ALGAE_ROOMS`, `vineStage`, `algaeStage`, `harvestAlgae`)                                               |
| Models                              | `lib/world/models/decor-ops.ts` (camera, station, dock, vine wall, algae spill); bot upgrade parts `withUpgrades` in `models/characters.ts` |
| Placement                           | `lib/world/content/interior.ts` `infrastructure()` (camera per room, dock per bot, vines, spills); station prop in `content/map.ts`         |
| Engine                              | `LabEngine.camFeed`, `idleActivity`, bot rebuild on level change and dock errand after a service (`syncBots`, `npc-brain.ts` `sendTo`)      |
| UI                                  | `components/world/ops/OpsPanel.tsx` (station), `track.ts` (action → routine glue)                                                           |
| Clock                               | `components/world/useWorld.ts` (1 Hz: `opsTick`; paused/hidden/closed: `idleTick`)                                                          |
| German                              | `lib/i18n/de/ops.ts`                                                                                                                        |
| Tests                               | `tests/world/ops.test.ts`                                                                                                                   |

## Surveillance

- **Station:** prop `surveillance_station` in the Control Room (L0, 76/15),
  variant decor with three `cams` screens (`screen-content.ts drawCams`). E on
  it opens the operations panel (`overlay.kind === "ops"`, dev
  `__lab.ops.open()`).
- **Cameras:** decor `security_cam`, one per room except the elevator shafts
  (`decor:<room>:cam`, `hasCamera`). The head pans with `camPan(t)`, the same
  curve the station's screens and the live feed use.
- **Live feed:** `LabEngine.camFeed(room, canvas)` renders the room from its
  camera into a 384×216 canvas (off-screen render target, about 5 fps). It
  works for every floor the engine has built. Floors nobody has visited show
  "no signal".
- **Needs attention:** `surveillanceIssues(s)` lists dry plants, dust,
  overflowing algae and bots due for service.

## Jade's routines

Every successful player action is noted as an `OpsStep`. The step kinds are:

- `pickup`, `note`, `puzzle`, `craft` (recipe key)
- `build`, `use`, `toggle`, `drone`, `research`
- `link`, `unlink`, `decor`

The action sites call `trackAction(api, step)` (`components/world/ops/track.ts`). This is the same vocabulary as the
undevbook's walkthrough.

- **Record:** Station → Routines → ● Record. Play on, then use Stop & keep.
  The routine is saved with a name (`source: "recorded"`).
- **Run:** `runRoutine` replays step by step through the game's own rules:
  - It only uses knowledge Jade already has. Recipes must be known (missing
    intermediates are crafted from known recipes, `craftKnown`).
  - Puzzles must have been solved before. A replayed puzzle only confirms
    the way and never solves it.
  - A failed step is reported and the rest still runs.
- **Combine:** select at least two routines and use Combine. The result is a
  routine made of routines (`source: "combined"`, depth ≤ 4, cycles
  refused).
- **Learn (habits):** a sequence of 2–5 steps repeated `LEARN_AT` = 3 times
  becomes a learned routine with `auto` on (`source: "learned"`).
  - Two routines run back to back 3 times become a learned combination.
- **Apply automatically:** when the player does the first step of an `auto`
  routine, Jade finishes the rest (`noteAction` → `habitFor` →
  `runRoutine(…, 1)`) and a toast says so.
  - Auto can be switched off per routine.

## Schedule

`OpsTask` = who (Jade or a bot), what (routine or duty), when, repeat
interval, priority 0–9, optional hold.

- `opsTick` runs once per play second.
  - Due tasks run highest priority first, at most one per agent per tick.
  - A repeating task is rescheduled at the bot's current speed (upgrades,
    coordination).
- Every awake bot gets its duties onto the timetable once
  (`ensureBotSchedule`). After that, the player can tune them.
- X0-R8T keeps its own schedule: its signal task cannot be removed or
  planned.
- Every run lands in the lab log (`log`) and in the task's `lastResult`.

## Bots

Duties come from the design database (unlabsdatabase
`01_GAME_DESIGN/social/`: bot-catalog, bot-org-structure, bot-network). Each
duty carries its source line (`BotDuty.source`).

| Bot     | Duty                             | Effect                                             |
| ------- | -------------------------------- | -------------------------------------------------- |
| F1N-DR  | Signal patrol                    | tidies every room of its level                     |
| X0-R8T  | Void transmission (own schedule) | drops an item from its level's finds               |
| L0G1K   | Verify research chains           | resets the research cooldown (needs NXS-01)        |
| P1NDR0  | Lost item recovery               | respawns 1 + level picked-over spots               |
| R3TR0   | Terminal macro                   | runs one of Jade's routines (task `arg`)           |
| B4C0N   | Optimisation review              | lowers every other bot's wear                      |
| D3C4D3  | Surveillance watch               | sweeps the cameras, reports issues                 |
| W2REK   | Greenhouse crawl                 | waters the vine rooms, harvests algae at stage ≥ 2 |
| K2LDR   | Catalogue the archive            | `klarer_kopf` buff for Jade                        |
| C8BR41N | Coordinate the agents            | all duties faster for a while                      |

- **Wear:** every run adds wear. At `WORN` = 100 the bot refuses duties.
  - `opsTick` sends a worn bot to service automatically.
  - Service resets wear to 0. The engine then walks the bot to its
    `service_dock` (`decor:<room>:dock:<bot>`, placed next to its home), where
    it works for a moment.
  - The player can trigger a service from the Bots tab at any time.
- **Upgrades** (`UPGRADE_COST`, levels 1–3):
  - Each level makes duties faster (`LEVEL_SPEED`) and wear slower
    (`LEVEL_WEAR`).
  - Look (`withUpgrades` in `models/characters.ts`):
    - L1 adds a whip antenna with a tally LED on a mount plate. It stands on
      the highest point of the shell's back-right quarter.
    - L2 adds a two-row glowing teal band around the body.
    - L3 adds a 3 × 3 brass badge with a red stone on the front, and a
      spinning sensor puck. The puck's stem stands on the shell and lifts the
      disc clear of everything under it.
    - Nothing floats. `tests/world/ops.test.ts` checks every bot and level.
  - The engine rebuilds the bot when its level changes.

## Living lab additions

- **Plants need water:** see `aging.ts`. They wilt when dry and lose leaves
  (`LEAVES_OF`). They grow in lit, watered rooms.
  - The greenhouse crawler and Jade's own watering (decor care actions) both
    care for them.
- **Climbing vines** (`vine_wall`, `decor:<room>:v<i>`): they start in the
  greenhouse and grow segment by segment through `VINE_ROOMS`:
  - greenhouse → garden corridor → living corridor → canteen
  - each room starts `VINE_ROOM_SPAN` later
  - each segment starts `VINE_SEG_DELAY` later and takes `VINE_SEG_GROW` to
    grow
  - Dry vines wilt.
- **Algae** (`ALGAE_ROOMS`): the tanks overgrow in light, in 4 stages over
  `ALGAE_SECONDS`. From stage 2 an `algae_spill` slick spreads on the floor.
  - Harvest by hand: the algae tank's decor action (`harvest: "algae"`) gives
    1 + 2·stage glow algae.
  - W2REK harvests the tanks automatically on its rounds.

## Idle life (pause)

The real time spent paused counts: pause menu, console, hidden tab, or the
game closed. Closed time is measured from `counters.ops_seen_ms`, the last
wall-clock second played.

- **After 1 hour:** Jade first works off her own tasks by priority
  (`jadeQueue`). Then she goes to her quarters (L+1) and reads by her bed, or
  trains at the ergometer if her fitness is low and she is rested
  (`idleChoice`, biorhythm `bio_fit`/`bio_rest`).
- **After 5 hours:** she goes to bed and sleeps (`biorhythm.sleep`).
- **On return:** LabWorld puts her there (`LabEngine.idleActivity`) and shows
  a toast. The first key or click ends the idle state (`endIdle`).

## Save

`SAVE_VERSION` 9, migration `MIGRATIONS[8]`, `sanitizeOps`. Limits:

- log 120 steps
- 48 routines
- 64 tasks
- level ≤ 3

## Tests

`tests/world/ops.test.ts` covers:

- recording and replay, learned habits, combination and cycle refusal
- knowledge gating
- duties from the database, timetables, X0-R8T's own schedule
- wear, service and upgrades, the crawler's watering and algae harvest
- priority order
- vine and algae growth
- the idle hour, then the 5-hour sleep
- save sanitising
