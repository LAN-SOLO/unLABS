# Doors — individual shapes, locking mechanisms, lock system, airlock

Every door in the lab is a one-off. Each has:

- its own shape
- its own locking mechanism, which engages every time the door closes
- a lock interface on its jamb, also listed in the surveillance station

The data center (Level −1) is reached through an airlock that keeps the dust
out with steam and extraction.

> **Crystal age (2026-10-02):** the styled doors are in the Blender crystal
> export too (the earlier "voxels only" decision is lifted). After era 42
> every frame, leaf piece, locking part, lock interface and the airlock
> hardware swaps to its real surface like every other model. See
> [Blender renders](#blender-renders-all-42-eras--crystal-age).

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
| Tests                        | `tests/world/door-styles.test.ts`; unlock flow in `render-transitions.test.ts`; crystal coverage `tests/world/door-crystal.test.ts`                                                                     |
| Crystal + era renders        | `scripts/crystal/door-parts.ts` (the engine's door assembly), `scripts/crystal/doors.ts` + `scripts/crystal/blender/doors.py` (`pnpm crystal:doors`)                                                    |

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

## Blender renders: all 42 eras + crystal age

`pnpm crystal:doors` renders every door (and the data-center airlock as a
whole) in Blender/Cycles through every clarity era and then in the crystal
age. Prerequisite: `pnpm crystal:export` and `pnpm crystal:build`.

**What one door goes through:**

- **Eras 1–42:** the engine's own voxel meshes
  (`refinedModelMesh(grid, "architecture", { tier })`) at the era's model
  tier: 1× in chapter 1, 2× from era 7, 4× from 19, 6× from 31, 8× from
  37 (`MESH_TIER_ERAS`). The meshes are exported once per grid and tier as
  binary files (`.crystal/doors/mesh/`, deduplicated by `gridHash`).
- **Era look** (`paramsAt(era)`), mirrored in Blender:
  - the four voxel material classes of `voxel-mesh.ts`: solid (roughness
    0.9), metal (0.35 / metallic 0.8), glass (alpha 0.45), emit (vertex
    colour × 2.4)
  - `detail` drives the same colour mottle (± 7 %), roughness noise
    (± 0.16 × relief) and fine relief (0.012 × relief) as the shader's
    `uDetail`, in world space
  - `env` scales the studio reflections (like `environmentIntensity`)
  - the compositor applies `ClarityGradePass.grade()` exactly: saturation
    around Rec.709 luma, contrast around 0.18, plus a soft bloom
  - the CRT pass is not rendered: its base grain and scan band are 0 in
    the game
- **Crystal age:** the crystal GLBs of every part with the last era's grade.
  Emissive crystal surfaces glow in their vertex colour × 2.4, because the
  engine reuses the voxel `emit` material for them (the GLB's own emission
  is white).

**Assembly:** `doorAssembly(def)` in `scripts/crystal/door-parts.ts` places
every part as `DoorSystem.addDoor` / `applyLook` does: frame, beacon, leaf
pieces at `piece.at`, mechanism parts at `part.at` (locked, `lockE = 1`),
the lock interface at `IFACE_AT`, all centred and scaled by `DOOR_SCALE`.
The door is shown closed in its default state: normal doors green, locked
red, keypad amber, airlock doors with the amber cycle screen. Secret doors
are shown revealed. `airlockAssembly` adds the chamber hardware and the
inner door in the outer door's frame of reference. **If the engine's door
assembly changes, change `door-parts.ts` with it.**
`tests/world/door-crystal.test.ts` checks that every part is exported in
every light and that the airlock is laid out correctly.

**Output** per subject in `.crystal/doors/<id>/` (local, not committed):

| File                                | Content                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| `era-00.png` … `era-41.png`         | the door in every era (same camera, 720², Cycles 48 spp)    |
| `crystal-front.png`, `crystal-back` | crystal age, front and back (96 spp)                        |
| `mech-era41.png`, `mech-crystal`    | close-up of the first locking part (nearly frontal)         |
| `iface-era41.png`, `iface-crystal`  | close-up of the lock interface on the jamb                  |
| `sheet.png`                         | one chapter (6 eras) per row, crystal views in the last row |

Plus `.crystal/doors/index.html` (gallery: style, mechanism text, views,
every era with its name and tier) and `doors.json` (styles and era
parameters).

**Options:** door id prefixes (`pnpm crystal:doors d_mcp,airlock-`),
`--eras 0,18,41` (look-dev, no sheet), `--workers`, `--samples`, `--size`,
`--plan` (meshes + `doors.json` only), `--gallery` (rewrite the gallery).
Finished era stills are skipped on a rerun; delete them to re-render.
The airlock overview has no close-ups (the chamber hardware blocks the
camera); its two doors have their own.

**First full run (2026-10-02, M1 Max, 3 Blender workers, Metal):** 59
subjects (58 doors + the airlock), 2,820 stills, ≈ 1 h 45 min, ≈ 2.2 GB in
`.crystal/doors/`. Before that, `pnpm crystal:build --only
door-style-,door-iface-,airlock-` built the 393 door grids in 172 s.
