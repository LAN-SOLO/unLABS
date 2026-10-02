# Doors — individual shapes, locking mechanisms, lock system, airlock

Every door in the lab is a one-off. Each has:

- its own shape
- its own locking mechanism, which engages every time the door closes
- a lock interface on its jamb, also listed in the surveillance station

The data center (Level −1) is reached through an airlock that keeps the dust
out with steam and extraction.

> **Voxels only:** doors are voxel models like everything in the lab (see
> `docs/CLARITY.md`). The Blender renders and crystal export tried on
> 2026-10-02 were removed the same day.

## Files

| Area                         | File                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Styles (pure, deterministic) | `lib/world/doors/style.ts` (`doorStyle`, `doorStyles`, labels)                                                                                                                                          |
| Lock system (pure)           | `lib/world/doors/lock.ts` (modes, access log, `doorInfo`, `doorPanelPoint`)                                                                                                                             |
| Airlock (pure controller)    | `lib/world/doors/airlock.ts` (`AIRLOCKS`, `stepAirlock`, `CLEAN_ROOMS`)                                                                                                                                 |
| Models                       | `lib/world/models/door-styles.ts` (panel, pieces, frame, mechanism parts, interface), `lib/world/models/airlock.ts` (nozzle rails, grate, ducts, lamps, steam points)                                   |
| Engine                       | `lib/world/render/doors.ts` `DoorSystem` (pieces per motion, mechanism timing, modes, gates, interface screens); `engine.ts` `stepAirlocks`, `airlockPhase`, door interface interactables (`doorpanel`) |
| UI                           | `components/world/doors/DoorPanel.tsx` (interface), Doors tab in `components/world/ops/OpsPanel.tsx`                                                                                                    |
| Sounds                       | `latch_bolt`, `latch_wheel`, `latch_magnet`, `airlock_steam`, `airlock_extract` (`lib/world/audio/sfx.ts`); pistons use `door_hiss`                                                                     |
| German                       | `lib/i18n/de/doors.ts`                                                                                                                                                                                  |
| Tests                        | `tests/world/door-styles.test.ts`; unlock flow in `render-transitions.test.ts`                                                                                                                          |

## Styles

A style is shape plus mechanism:

- **Motion:**
  - `split`: two leaves slide into the wall
  - `stagger`: four segments, the upper pair lags
  - `swing`: two leaves on hinges, fixed side per door
  - `shutter`: six slats roll up into a drum in the header
- **Meeting edge:** `straight`, `stepped`, `toothed`, `diagonal`, `wave`. The
  closed door is one panel, cut along the profile.
- **Window:** `none`, `slit`, `porthole`, `grid`, `twin`
- **Pattern:** `chevron`, `ribs`, `diamond`, `panels`, `honeycomb`, `plain`
- **Frame:** `square`, `chamfer`, `arch`, `vault`, `slim`. Chamfer and arch also
  cut the top corners of the leaves.
- **Colours:** leaf paint and trim colour from a fixed list.
- **Mechanism:** 8 kinds × 9 variants (count 2–4, high/low, heavy = both faces):

| Kind              | Release motion                                      |
| ----------------- | --------------------------------------------------- |
| Throw bolts       | slide back into the leaf (shutters: from the jambs) |
| Vault wheel       | quarter turn                                        |
| Jamb clamps       | swing out of the wall plane                         |
| Drop pins         | lift into the header                                |
| Magnetic seal     | strip goes dark                                     |
| Cross bar         | swings up around its end                            |
| Cam latch         | discs turn a quarter                                |
| Hydraulic pistons | rods retract into their cylinders                   |

**Uniqueness and fixed styles:**

- `assign` walks every door in id order, each from its own hash, until it
  finds a free combination. The designed doors are placed first.
- The test checks that every visible door has its own shape and every door its
  own mechanism. Today that is 54 shapes and 58 mechanisms.
- The secret doors keep their flush wall disguise and get a hidden magnetic
  lock.
- The airlock pair is clean-room white, with portholes, a vault frame, pistons
  (outer) and clamps (inner).

**What stays the same for every style:**

- Collision does not depend on the style: every door has the 5-cell opening
  and becomes passable at `DOOR_PASSABLE_AT`.
- Leaf crops are 12 voxels wide so that profiled edges fit. Pieces fill the
  closed panel exactly; this is tested.

## Mechanism timing

The engage amount `lockE` goes from 1 (locked) to 0 (released).

1. **Opening:** the mechanism releases first (`MECH_TIME` 0.28 s), then the
   leaves move.
2. **Closing:** the leaves close, then the mechanism engages.
3. **Locked door that unlocks:** the beacon strobes (`unlockPose`), the
   mechanism releases, then the door opens. No temporary parts are added any
   more.
4. **Reduced motion:** the mechanism snaps between states.

Each start of a release or engage calls `onMech(id, engage)`, which plays the
sound for that mechanism kind.

## Lock system

The interface sits on the right jamb, visible from both wall faces. Its
target is `{ kind: "doorpanel" }` and its stand spots come from
`occupancy.doorPanelStand`. A secret door's interface only exists once the
door is revealed.

**Screen colour:**

| State                  | Colour |
| ---------------------- | ------ |
| auto                   | green  |
| hold                   | blue   |
| sealed / locked        | red    |
| keypad / airlock cycle | amber  |

**Modes**, stored in counters as `door_mode:<id>` (no save bump):

- **Automatic:** the default.
- **Hold open:** only for a door whose lock is satisfied, and never for an
  airlock door.
- **Seal:** the door stays shut and path planning treats it as locked.
- **Safety rule:** a sealed or gated door never closes on Jade while she is in
  the doorway (`inDoorway`).

**Access log:** `door_opens:<id>`, `door_last:<id>`, `doors_opened`. It is
written when a door starts to open for Jade and saved with the next autosave.

**Two places to use it:**

- At the door: the interface shows status, door type, mechanism, mode buttons,
  "Enter code" for keypad doors, the airlock cycle and the access log.
- In the surveillance station's Doors tab: all known doors per floor, with
  mode buttons.

## Airlock (data center)

**Layout:** in the passage between the geothermal room and the data center,
on Level −1:

- outer door `d_rechen_schleuse` at (32, 99), a new floor-plan door with
  `airlock: "schleuse_rechen"`
- the existing inner door `d_rechen` at (32, 104), which keeps its power lock
- the chamber between them: x 30…34, z 100…103

**Cycle** (`stepAirlock`, pure):

1. **Interlock:** a door may open only while the other one is fully closed.
2. **Seal:** whoever is deep in the chamber (`DEEP`, past the doorway
   clearance) gets sealed in, and both doors close.
3. **Steam** for `STEAM_S` (1.8 s): steam bursts from the nozzle rails.
4. **Extraction** for `EXTRACT_S` (1.6 s): dust is pulled through the floor
   grate.
5. **Release:** the far door opens first; either door may open, one at a time.
6. **Cleared:** once Jade has left the chamber, the airlock is idle again.

**Never traps:**

- Before the seal, the door she is next to stays usable.
- After the release, both doors are available, one at a time.
- While gated, the walker waits instead of giving up (`waitingForDoor`).

**Clean room:** `CLEAN_ROOMS` (`rechen`) never gathers dust (`aging.ts`).

**First completed cycle:** an MCP toast, flag `airlock_cycled`, counter
`airlock_cycles`.

**Fixtures** (`airlockFixtures`, static meshes): nozzle rails with amber lamps
on both side walls, suction ducts on the wall tops, and the yellow-rimmed
extraction grate.

## Tests

- **`tests/world/door-styles.test.ts`:**
  - uniqueness, determinism and the airlock look
  - pieces fill the panel for every motion × edge × frame
  - frame size, opening cuts, edge range, mechanism parts
  - modes, secret doors, access log, interface position
  - a sealed door never closes on Jade, and the mechanism runs in order
  - the airlock walk-through (event order, never both open), stepping back out
    before the seal, the dust-free data center
- **`content.test.ts`:** airlock doors may share a room on both sides (the
  chamber is part of the passage).
