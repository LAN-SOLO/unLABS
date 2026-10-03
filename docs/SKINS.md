# Lab skins — walls and floors

Every room of the lab gets a designed wall and floor surface: panels, seams,
inlays, bands, cornices and floor patterns, all in voxels, plus three light
channels whose colour and motion the player controls per room from the
surveillance station. This document is the build spec: it defines the
geometry rules, the channel/shader model, the station UI, the gameplay hooks
and one concept per room (57 rooms, generated from the data).

Status (2026-10-03): **concept + generator + renders.** The data
(`lib/world/skins/`), the fine-voxel generator, the state/power model and the
tests exist and run; the Blender renders are made from exactly this data.
The engine integration (meshing, shader, station tab, save v11) is the
implementation plan in § 11 — nothing in the running game uses skins yet.

> **Voxels only** (decision 2026-10-02, `docs/CLARITY.md`). The mood board is
> smooth line art; the skins translate it into voxels — the same 4 × 4 × 4 fine
> lattice as device detail. No smooth surfaces, no textures, no bevels other
> than voxel steps.

## 1. Mood board

The user's references (`_imageBlast` 2022, 1500 × 500 banners):

| #   | Picture                                                         | What the skins take from it                                                                             |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Red line art: console, fans, a crystal in a square frame        | **Ink** look: field painted in one colour, everything else black line work → preset _Red ink_           |
| 2   | Black square panels with glowing amber edges behind the console | **Outline** look: dark field, glowing seams and inlay outlines → preset _Amber outline_ (Control Room)  |
| 3   | Orange lit panels, dark columns, LED pairs at mid height        | **Light box** look: field glows, dark columns, node pairs at seam crossings → preset _Sodium_           |
| 4   | The same wall in yellow                                         | preset _Lemon_                                                                                          |
| 5   | The same wall in red with dark inlays                           | preset _Red room_ (also the MCP alert flush)                                                            |
| 6   | Teal line art (picture 1 in teal)                               | preset _Teal ink_                                                                                       |
| 7   | Yellow octagonal tunnel with diamond floor markers              | wall family **rib** + floor **guide** with diamond markers → preset _Tunnel_ (corridors)                |
| 8   | Orange faceted crystal cathedral with pillars                   | wall family **facet** → preset _Cathedral_ (Anomaly Chamber, Halo Crystal Cave, Relic Vault)            |
| 9   | Blue grid control room: outlined panels, lit cove, portal       | rack/grid with bezels, cove light, diamond floor inlays → preset _Grid blue_ (Compute Core, Signal Lab) |

The key observation: pictures 2–5 are **one wall** in four moods. That is the
core rule of the system — **one geometry, many moods**. The geometry is
built once per room; the moods only change channel colours and motion.

## 2. Principles

1. **Silhouette rule.** Walls stay in their wall line, floors in the slab
   (y = 0). Relief is carved _into_ the surface, one fine voxel deep, never
   added onto it. The only voxels inside a room are the cornice at y 7–8
   directly beside the wall — above the walker's head, where lamps, corbels
   and cable trays live today (`layout.ts` architecture rules). Collision,
   zones, walkability and all game coordinates stay on the source grid.
2. **One geometry, many moods.** Every surface voxel is either a fixed
   palette colour or one of three channels: `line` (seams, outlines, guide
   lines, cove light), `node` (LEDs, keyholes, veins, stars) and `field`
   (panel faces). A mood (preset) sets the three colours, how much the field
   glows, a motion mode, speed and intensity.
3. **Readable play.** Skins never hide gameplay: door frames, keypads,
   interactable highlights and hazard markings keep their colours; channels
   are capped below the interaction highlight brightness; alarm and
   emergency moods are reserved for real events.
4. **Light costs power.** Lit walls are consumers on the power grid (§ 7).
   A sodium light box in a big hall costs more than amber outlines.
5. **Rooms have character.** Each room has its own signature mood and
   geometry that tells its story (Jade's colour-sorted notebooks, Damien's
   17 legal pads, the radio room's chalk Morse line, the 847 ms data center).

## 3. Geometry (`lib/world/skins/voxels.ts`)

- **Fine lattice:** every source voxel of a wall or floor becomes 4 × 4 × 4
  fine voxels (`SKIN_FINE = 4`, the device-detail scale; unit 0.25).
- **Wall face coordinates:** `u` runs along the wall (fine, from the wall
  cell's position `p` — the same rhythm the panelling uses today), `v` from
  y = 1 upward (0 … 31):

  | v       | Zone       | Content                                                     |
  | ------- | ---------- | ----------------------------------------------------------- |
  | 0 – 3   | base       | baseboard: plain, hazard stripes, glow strip or walnut      |
  | 4 – 27  | panel zone | the wall family, bands override rows                        |
  | 28 – 31 | cap        | wall top; covers the whole wall thickness (seen from above) |

- **Wall layers:** a wall cell is 4 fine voxels thick. Layer 0 (toward the
  room) is the surface — empty where a cell is _recessed_; layer 1 carries
  the colour (so a recessed seam is the seam colour one step back); layers
  2–3 are the core (`wall_dark_dk`). Diagonal corner cells are filled solid.
- **Cornice** (y 7–8, interior cell beside straight walls, not within 2 of a
  door): `chamfer` = a voxel staircase wedge, one fine step per two rows,
  with a line-channel lip at its lowest step (the ceiling bevel of
  pictures 2–7); `cove` = a ledge one voxel out with a light strip on top
  that lights the wall above (picture 9). Lamps keep their cells.
- **Floor:** the slab's top fine layer carries the pattern; recessed cells
  (grout, perforations, cracks) are one fine voxel lower. Under walls the
  slab is `metal_dark`.
- **Doors:** door cells are open from y 1 to 6; lintels stay. The door
  styles (`docs/DOORS.md`) mount into this opening unchanged.
- **Cutaway:** for iso pictures (and the game's V key) walls facing away
  from the camera (+x / +z side) stop at the base (`skinRoomGrid(…, { cut })`).

### Wall families

| Family     | Grammar                                                                                                                                   | Used by                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `grid`     | panel module `panel` × (24 / `rows`), seams `seam` wide, optional dark columns, inlays, LED pairs                                         | Control Room, rotundas, corridors      |
| `plate`    | heavy plates with four rivets each, hazard bases                                                                                          | airlocks, fabrication, reactor, hangar |
| `tile`     | small tiles with recessed grout                                                                                                           | labs, cooling, containment, kitchen    |
| `brick`    | running bond, half offset per row                                                                                                         | Map Room                               |
| `screen`   | panels are screens: bezel, scanlines, status node                                                                                         | Quantum Lab                            |
| `drawers`  | index-card / deposit-box fronts with pulls, labels or keyholes                                                                            | Archive, Relic Vault, Cold Archive     |
| `pegboard` | perforated board with painted tool silhouettes (shadow board)                                                                             | Workshop                               |
| `rack`     | rack bays: rails, vent slits, status LEDs, label strip                                                                                    | MCP, data center, compute core, depots |
| `rib`      | ribs every `pillar` voxels, horizontal bands, a mid light line (tunnel, picture 7)                                                        | corridors, Teleport, Observatory       |
| `facet`    | jittered Voronoi shards, glowing edges, some shards glow, dark shards recessed (picture 8)                                                | Anomaly, Halo Cave, X9 chamber         |
| `acoustic` | quadratic-residue diffuser wells (two depths), vertical light slits between modules                                                       | Signal Lab, Signal Core, Studio, Radio |
| `wainscot` | dado (`dado`: raised panels, beadboard, shiplap boards or tiles; fill `paint.dado`), chair rail, upper wall with damask dot, picture rail | quarters, library, residential         |
| `glass`    | steel mullions, glass panes, planter rim with algae nodes                                                                                 | Greenhouse                             |
| `rock`     | noise rock, recessed dark pockets, crystal veins (node), timber supports                                                                  | shaft level                            |

Wall `cracks` glow on the line channel by default; `crackGlow: "node"` puts
them on the node channel instead, so they keep a dim ember under the
emergency preset (which turns the line channel off) — used by the borehole.

### Bands (horizontal content inside the panel zone)

`books`, `notebooks` (rainbow-sorted), `pads` (legal pads), `cables` (with a
data line), `pipes` (flanges, valves), `busbar` (copper bars, current line),
`coils` (field windings), `ruler` (graduated scale), `morse` (the radio
room's chalk code), `plants` (trellis + leaves), `threads` (cork, pins, notes
and red threads = line channel), `light` (a light strip), `hazard`, `frost`
(passes the family through where no frost), `duct` (row of small screens).

### Glyphs (inlays)

`tetro` (tetromino shapes of pictures 2–5), `tools` (wrench, hammer,
screwdriver, saw, pliers), `digits` (3 × 5 font, the panel's bay number),
`trefoil` (radiation), `keyholes`, `chevrons`.

### Floor families

`tiles`, `checker`, `tread`, `grate` (bars, dark sub-floor, rare node
glints), `raised` (perforated tiles glow from below), `guide` (border, tiles,
centre / side light lines, diamond markers — picture 7), `rings` (rings +
spokes around the room centre, node hub), `planks`, `parquet` (basket weave),
`terrazzo` (specks, optional node glitter), `epoxy` (hazard lane at edge 2,
stains), `concrete` (saw cuts, aggregate, bay lines), `gravel` (rails +
sleepers), `beds` (planter beds, paths, algae nodes), `stars` (star chart),
`carpet` (pile + border). Options: `lines`, `diamonds`, `cracks` (glowing,
carved).

## 4. Channels and the shader

**Palette.** Three new entries, appended (indices 253–255; the palette is
now **full**): `skin_line` (emit), `skin_node` (emit), `skin_field` (solid).
Their colours are only defaults. A further colour needs the Uint16 grid
migration — not part of this feature.

**Per-room tint.** The renderer needs the room of a fragment and its mood:

- _Room map:_ one `R8` texture per floor (`FLOOR_SIZE.x × FLOOR_SIZE.z`,
  value = room index + 1 from `floorGeom.owner`/`wallOwner`). The shader
  samples it at the fragment's world xz (wall cells belong to their room).
- _Mood table:_ one `RGBA32F` texture, 64 × 4 texels per floor row:
  `(line.rgb, intensity)`, `(line2.rgb, speed)`, `(node.rgb, mode)`,
  `(field.rgb, fieldGlow)`. Updated on a mood change (cheap) — never a
  remesh.
- _Channel attribute:_ the mesher writes `aChan` (0 = fixed colour, 1 line,
  2 node, 3 field) for faces whose palette index is a channel; greedy merging
  never merges across channels (they are different indices anyway).
- _Shader:_ `skinLevel()` (`lib/world/skins/modes.ts`) is the reference; the
  GLSL is a line-by-line port (same constants, `hash2` = `fract(sin(dot)·
43758.5453)`). Inputs: `u = world.x + world.z`, `y = world.y`,
  `r = distance to the room centre` (centre per room in the mood table's
  spare row), `h = hash2(floor((fx+fz)/4), floor(fy/6))` from the fine
  position. Line/node: `emissive = colour × level × intensity`; field:
  `albedo = field`, `emissive = field × fieldGlow × level × intensity`.
- _Safety:_ no `pow()` on possibly negative values, no unguarded
  `normalize` (one NaN + bloom = black frame). `heartbeat` uses squares, not
  `pow`.
- _Bloom:_ channels are capped at 0.85 of the interaction highlight so the
  highlight stays the brightest thing in a room.

## 5. Motion modes (`modes.ts`)

| Mode        | Formula (level 0 … 1)                      | Duty | Typical use               |
| ----------- | ------------------------------------------ | ---- | ------------------------- |
| `static`    | 1                                          | 1.00 | outlines, reading light   |
| `breathe`   | 0.55 + 0.45 sin(2π · 0.25 s t)             | 0.72 | calm rooms                |
| `pulse`     | on half of a 2 / s period, 0.12 off        | 0.42 | 847 ms data center, locks |
| `heartbeat` | two Gaussian bumps per 1.2 / s             | 0.36 | MCP, Abyss                |
| `chase`     | comet along `u` (period 12 voxels)         | 0.34 | corridors, cables, bars   |
| `scan`      | horizontal band moving up over 4 / s       | 0.30 | measurement, seep         |
| `ripple`    | rings from the room centre                 | 0.65 | rotundas, forge, portal   |
| `flicker`   | 12 Hz hashed drop-outs per 4-voxel run     | 0.86 | old tubes, Geiger         |
| `twinkle`   | per-panel sparkle (sin⁸ with hashed phase) | 0.32 | stars, keyholes, qubits   |
| `rain`      | falling comets per column                  | 0.28 | data rain, drips          |
| `meter`     | lit below `input` height per column (VU)   | 0.50 | Signal Lab, studio, cells |
| `cycle`     | line colour cycles line ↔ line2            | 1.00 | Aurora, Halo Cave         |
| `alarm`     | 1 Hz on/off                                | 0.55 | forced on events          |
| `reactive`  | 0.15 + 0.85 · input                        | 0.60 | power, heat, load         |
| `daylight`  | 0.2 + 0.8 · daylight(hour)                 | 0.60 | quarters, greenhouse      |
| `off`       | 0                                          | 0.00 | —                         |

**Sources** for `reactive`/`meter`/`daylight`: `power` (grid load),
`load` (device CPU / MCP kernel load), `heat` (room temperature from the
root model), `signal` (audio bus level of the room), `charge` (battery),
`clarity` (clarity score), `clock` (time of day). The data center's 847 ms is
`pulse` at speed 1 / 0.847.

## 6. Presets (`presets.ts`)

24 library moods plus one signature per room: _Work light, Amber outline,
Sodium, Lemon, Red room, Red ink, Teal ink, Tunnel, Cathedral, Grid blue,
Phosphor, Night watch, Aurora, Heat map, Load meter, Spectrum, Dawn, Cryo,
Abyss, Gold leaf, Starlight_ — and the forced _Alarm_, _Emergency light_
and _Off_. Names are English in `tr()`, German in `lib/i18n/de/skins.ts`.

## 7. Surveillance station → tab "Skins"

A sixth tab next to Cams / Routines / Schedule / Bots / Doors
(`components/world/ops/OpsPanel.tsx`, `type Tab = … | "skins"`).

```
┌ Skins ─────────────────────────────────────────────────────────────┐
│ Floor ◀ L0 ▶   [Control Room ●] [MCP ●] [Workshop ●] …  (swatch+mode) │
├───────────────────────────────┬─────────────────────────────────────┤
│  live camera (camFeed)        │ Preset  ▸ Console amber (signature) │
│  of the selected room         │         ▸ Sodium · Lemon · Red room │
│                               │ Line  [■] Node [■] Field [■] glow ▮ │
│                               │ Mode  static ▾   Speed ◀ 1.0× ▶     │
│                               │ Intensity ▮▮▮▮▮▮▯▯  → 4.2 W         │
│                               │ Sync  ○ room ○ floor ○ lab          │
│                               │ [Copy] [Paste] [Reset to signature] │
└───────────────────────────────┴─────────────────────────────────────┘
```

- **Room list** per floor with the current swatch and a mode glyph; rooms
  without power show "no power" and fall back to Emergency.
- **Preset** list: signature first, the room's recommendations, then the
  library (`presetsForRoom`). Forced presets are not selectable.
- **Colours:** 16 curated swatches per channel (the palette's emit family);
  a free hue wheel unlocks at root ring `wheel` (`docs/ROOT-LAB.md`).
- **Speed** 0.25 × … 4 ×, **intensity** 0 … 100 % with the live watt cost
  (`skinWatts`).
- **Sync:** `applySkin` mirrors a setting to the floor or the whole lab;
  a synced signature becomes each room's own signature.
- **Preview:** the live camera feed (`LabEngine.camFeed`) shows the change
  immediately; nothing is remeshed.
- **Schedule:** the task schedule (`lib/world/ops/schedule.ts`) gets a task
  kind `skin` (room, preset, at hh:mm / every n min) — e.g. "22:00 all of
  L4 → Night watch".
- **Root:** tunables `skin.max_intensity` (ring operator, 0.4 … 1),
  `skin.budget_w` (lab-wide watt cap, kernel cost 0), shell command
  `skin <room> <preset> [mode] [speed]` for room terminals and the Main
  Console (`labor root skin …`).
- **Routines:** changing a skin is an `OpsStep` of kind `decor`
  (`trackAction`), so Jade can learn "evening lights" as a habit.

## 8. Gameplay hooks

- **Power:** each room's skin is a consumer `skin:<room>` with
  `skinWatts(room, resolved)` = perimeter × (0.02 + 0.08 · fieldGlow) ×
  intensity × duty(mode). If the grid cannot supply it, the room drops to
  _Emergency light_ (forced) until power returns.
- **Forced moods** (`resolveSkin(room, setting, forced)`): _Alarm_ on
  containment breach, reactor overload, explosion events; _Emergency light_
  on brownout; room-specific events listed per room below (they play once
  and return to the setting).
- **Unlocks:** the library starts with Work light, Amber outline, Night watch
  and the room signatures; the others are rewards (achievements, quests,
  finds) — a planned list lives with the implementation.

## 9. State and save

`WorldState.skins: Record<roomId, SkinSetting>` (save **v11**, `MIGRATIONS`
step: absent → `initialSkins()`), sanitised by `sanitizeSkins`
(`lib/world/skins/state.ts`: unknown rooms dropped, unknown or forced
presets reset to the signature, colours must be `#rrggbb`, speed clamped to
0.25 … 4, intensity 0 … 1, sync room/floor/lab).

## 10. Performance

- Walls and floors at 4 × fine are more faces than today's 2 × terrain:
  the Control Room shell is ~98 k faces before greedy merging (the renders'
  count); greedy merging on flat panel fields brings it to a fraction.
  Build per room in the detail worker pool (`render/detail-pool.ts`), swap
  in like device detail; far floors keep the 2 × terrain.
- Mood changes only update the mood table texture — no remesh, no new
  material, no extra draw call (channels live in the existing emit / solid
  buckets).
- The animated modes cost one texture fetch and a few ALU ops per fragment.

## 11. Implementation plan

1. Mesher: `aChan` attribute for channel indices; chunked terrain meshing
   of the fine wall/floor grids in the worker pool (reuse `detail.worker`).
2. `layout.ts`: replace the panelling and floor patterns of `buildFloor`
   by `skinRoomGrid` output for the render (source grid unchanged for
   collision); keep lamps, windows, door plates, hub detail.
3. Shader: room map + mood table textures, GLSL port of `skinLevel`,
   uniforms `uTime`, `uSkinInputs` (per room source values).
4. State: `WorldState.skins`, save v11 + migration, `sanitizeSkins` in
   `save-sanitize.ts`, power consumers in the grid, forced events.
5. UI: Skins tab in `OpsPanel`, schedule task kind, root tunables + shell
   command, German strings.
6. Tests: keep `tests/world/skins.test.ts`; add shader/TS parity (sample
   points), walkability unchanged, draw-call budget (`engine.debugStats()`).

## 12. Renders (Blender)

```
pnpm skins:export            # .voxel/skins/<room>/{grid,cut}.uvox.json + skin.json (moods, levels)
pnpm skins:render            # Cycles: overview + eye-level per mood (+ --frames for a loop)
pnpm skins:sheets            # contact sheets + GIF loops → .voxel/skins/sheets/
```

The renders use the voxelgod shell (`exposed_faces`, one quad per exposed
fine face); channel faces are tinted exactly like the planned shader. Moods
shown per room: the signature (eye level + iso overview + an 8-frame loop)
and the first three recommendations.

## 13. Rooms

Generated from `lib/world/skins/rooms.ts` by `pnpm skins:doc` — edit the
data, not this section.

<!-- rooms:begin -->

### L0

#### Control Room (`kontroll`) — Command wall

The wall behind the Main Console is the mood board come true: four rows of square panels with deep seams, dark tetromino inlays and a bevelled cornice like a ceiling edge. One geometry wears every mood — amber outlines, sodium light boxes, lemon, red room or grid blue.

|              |                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Wall         | `grid` · panel 8 × rows 4 · seam 1 (inset) · base plain · dark every 5th · 22 % tetro inlays · LED pairs · cornice chamfer              |
| Paint        | panel field · seam line · base metal_dark · cap metal_dark · inlay black · accent line                                                  |
| Bands        | —                                                                                                                                       |
| Floor        | `tiles` · tile 16 · floor_tile / floor_dark, grout black · diamond markers                                                              |
| Signature    | **Console amber** — line #ffb800, node #ffcf40, field #0a0806 (glow 0), `static` × 1 · ≈ 3.2 W                                          |
| Also offered | Sodium, Lemon, Red room, Grid blue, Amber outline                                                                                       |
| Events       | Console session starts: a scan sweeps once from floor to cornice. MCP alert: the field flushes red (Red room) until it is acknowledged. |
| References   | #2, #3, #4, #5                                                                                                                          |

#### MCP Chamber (`mcp`) — The red eye's iris

Rack fronts all around, cold and dark, with one red line pulsing through every seam in the MCP's heartbeat. The raised floor glows red through its perforations. The whole room is the eye that blinks very slowly.

|              |                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Wall         | `rack` · panel 8 × rows 4 · seam 1 (inset) · base plain · cornice cove                                         |
| Paint        | panel metal_dark · seam line · base metal_dark · cap metal_dark · inlay black · accent node                    |
| Bands        | —                                                                                                              |
| Floor        | `raised` · tile 8 · floor_red / metal_dark, grout black                                                        |
| Signature    | **Red eye** — line #ff2a1a, node #ff6a40, field #140404 (glow 0.1), `heartbeat` × 0.6, source `load` · ≈ 1.8 W |
| Also offered | Abyss, Red ink, Load meter, Night watch                                                                        |
| Events       | Kernel load above 80 %: the heartbeat doubles its tempo.                                                       |
| References   | #1, #5                                                                                                         |

#### Secondary Station (`sekundaer`) — Night-shift office

Damien's monitoring station from the late eighties: oak wainscot, a cream upper wall with a thin damask dot, a row of small monitor bezels along the chair rail. A warm cove light under the cornice is the only lamp that is always on.

|              |                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Wall         | `wainscot` · panel 12 × rows 4 · seam 1 (inset) · base plain · cornice cove                       |
| Paint        | panel field · seam wood_dark · base metal_dark · cap walnut · inlay black · accent node           |
| Bands        | light (v 13–15)                                                                                   |
| Floor        | `terrazzo` · tile 16 · floor_beige / beige_dk, grout floor_beige_dk                               |
| Signature    | **Desk lamp** — line #ffd9a0, node #33ff33, field #8a816c (glow 0.12), `breathe` × 0.15 · ≈ 2.4 W |
| Also offered | Dawn, Night watch, Teal ink, Work light                                                           |
| Events       | Synapsis headset in use: the monitor row turns green.                                             |
| References   | #6                                                                                                |

#### West Corridor (`westflur`) — Counting corridor

A tunnel of ribs every six voxels, each rib a day mark. Horizontal panel bands run between the ribs, a light line rides along them toward the control room, and diamond markers on the floor count the steps. Ref 7 in a straight corridor.

|              |                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Wall         | `rib` · panel 24 × rows 3 · seam 1 (inset) · base plain · pillar every 6 · cornice chamfer           |
| Paint        | panel field · seam metal_dark · base metal_dark · cap metal_dark · inlay black · accent line         |
| Bands        | —                                                                                                    |
| Floor        | `guide` · tile 16 · floor_tile / floor_dark, grout floor_dark · center light lines · diamond markers |
| Signature    | **Day counter** — line #f0f02a, node #ffffff, field #3a3c30 (glow 0.15), `chase` × 0.6 · ≈ 1.6 W     |
| Also offered | Tunnel, Grid blue, Night watch, Work light                                                           |
| Events       | Jade walks the corridor: the chase follows her pace.                                                 |
| References   | #7                                                                                                   |

#### Workshop (`werkstatt`) — Shadow board

Pegboard panels with painted tool silhouettes — every tool has its place, the empty outlines show what is out on a bench. Hazard-striped baseboard, task light strips in the cove, an epoxy floor with yellow lanes and oil spots.

|              |                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Wall         | `pegboard` · panel 16 × rows 2 · seam 1 (inset) · base hazard · 75 % tools inlays · cornice cove |
| Paint        | panel field · seam olive_dk · base metal_dark · cap olive_dk · inlay safety_red · accent line    |
| Bands        | —                                                                                                |
| Floor        | `epoxy` · tile 16 · floor_green / olive_dk, grout floor_dark                                     |
| Signature    | **Workbench** — line #fff2d8, node #ff7a00, field #4a5040 (glow 0), `static` × 1 · ≈ 2.9 W       |
| Also offered | Sodium, Work light, Amber outline, Alarm                                                         |
| Events       | A device is being built: the node lights run like a progress bar.                                |
| References   | #3                                                                                               |

#### Archive (`archiv`) — Card index

The walls are drawers: rows of small index-card fronts with brass pulls and tiny label lights. When the Crystal Data Cache is powered the labels twinkle as if someone were looking things up.

|              |                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Wall         | `drawers` · panel 6 × rows 6 · seam 1 (inset) · base plain · cornice none                                          |
| Paint        | panel field · seam teal_dk · base metal_dark · cap teal_dk · inlay black · accent brass                            |
| Bands        | —                                                                                                                  |
| Floor        | `tiles` · tile 12 · floor_blue / paint_navy, grout black                                                           |
| Signature    | **Index light** — line #3fd0ff, node #ffb800, field #2d6b6b (glow 0.12), `twinkle` × 0.4, source `power` · ≈ 1.3 W |
| Also offered | Teal ink, Cryo, Night watch, Work light                                                                            |
| Events       | CDC-001 indexing: label lights chase along the rows.                                                               |
| References   | #6                                                                                                                 |

#### Command Rotunda (`aufzug0`) — Compass rotunda

The command rotunda is a compass. Outlined panels run around the core, pillars mark the eight winds, and the floor carries rings and spokes with an amber needle toward the control room. Light ripples outward from the shaft whenever the elevator arrives.

|              |                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Wall         | `grid` · panel 8 × rows 3 · seam 1 (inset) · base plain · pillar every 8 · bezels · cornice chamfer |
| Paint        | panel field · seam black · base metal_dark · cap metal_dark · inlay black · accent line             |
| Bands        | —                                                                                                   |
| Floor        | `rings` · tile 12 · floor_tile / floor_dark, grout floor_dark                                       |
| Signature    | **Compass** — line #ffb800, node #ffffff, field #16181c (glow 0), `ripple` × 0.5 · ≈ 2.4 W          |
| Also offered | Grid blue, Amber outline, Tunnel, Night watch                                                       |
| Events       | Elevator arrives: one ripple from the shaft to the walls.                                           |
| References   | #2, #9                                                                                              |

#### Outer Airlock (`schleuse`) — Pressure cycle

Riveted olive plates, hazard-striped baseboard, a red warning band at shoulder height and status nodes beside the doors. While the airlock cycles the band pulses, then a light runs toward the door that may open.

|              |                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Wall         | `plate` · panel 16 × rows 2 · seam 1 (inset) · base hazard · cornice none                       |
| Paint        | panel wall_olive · seam olive_dk · base metal_dark · cap olive_dk · inlay black · accent chrome |
| Bands        | light (v 15–16)                                                                                 |
| Floor        | `grate` · tile 16 · floor_grate / black, grout floor_dark                                       |
| Signature    | **Lock cycle** — line #ff3020, node #ffb800, field #4a5040 (glow 0), `pulse` × 1 · ≈ 1 W        |
| Also offered | Alarm, Amber outline, Work light, Night watch                                                   |
| Events       | Door cycle: pulse, then a chase toward the released door.                                       |
| References   | #5                                                                                              |

#### Damien's Map Room (secret) (`kartenraum`) — Red threads

Old brick behind a cork band, pinned with notes; red threads run between the pins across the whole room — they are the line channel. In the dark only the threads glow, as if the map were thinking.

|              |                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Wall         | `brick` · panel 8 × rows 8 · seam 1 (inset) · base plain · cornice none                        |
| Paint        | panel brick · seam mortar · base metal_dark · cap walnut · inlay black · accent paper_yellow   |
| Bands        | threads (v 10–21), light (v 22–23)                                                             |
| Floor        | `planks` · tile 4 · wood / wood_dark, grout walnut                                             |
| Signature    | **Thread map** — line #ff2a1a, node #ffd9a0, field #7e3a2c (glow 0), `breathe` × 0.2 · ≈ 1.7 W |
| Also offered | Red ink, Emergency light, Dawn                                                                 |
| Events       | A map clue solved: its thread flashes three times.                                             |
| References   | #1                                                                                             |

#### Cable Passage (`kabelgang`) — Warm cables

Thigh-thick cable bundles fill the panel zone, held by steel clamps every two voxels. A light pulse travels along the bundles from the control room to the MCP — the data you just typed, on its way.

|              |                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Wall         | `grid` · panel 8 × rows 1 · seam 1 (inset) · base plain · cornice none                            |
| Paint        | panel metal_dark · seam steel_dark · base metal_dark · cap metal_dark · inlay black · accent line |
| Bands        | cables (v 5–25)                                                                                   |
| Floor        | `grate` · tile 16 · floor_grate / black, grout floor_dark                                         |
| Signature    | **Data in transit** — line #ff7a1a, node #ffb800, field #1f2226 (glow 0), `chase` × 1.2 · ≈ 0.7 W |
| Also offered | Phosphor, Tunnel, Night watch                                                                     |
| Events       | A terminal command runs: one pulse per command.                                                   |
| References   | #7                                                                                                |

#### Archive Passage (`archivgang`) — Stubborn passage

A narrow tiled passage with one fluorescent band that never quite settles. Guide lines on the floor lead to the archive door that has been electric since 1998 and stubborn since 2019.

|              |                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Wall         | `tile` · panel 4 × rows 6 · seam 1 (inset) · base plain · cornice none                          |
| Paint        | panel field · seam steel_dark · base metal_dark · cap metal_dark · inlay black · accent line    |
| Bands        | light (v 20–21)                                                                                 |
| Floor        | `guide` · tile 8 · floor_tile / floor_dark, grout floor_dark · sides light lines                |
| Signature    | **Tired tube** — line #e8f4ff, node #ffb800, field #5b6068 (glow 0.05), `flicker` × 0.6 · ≈ 1 W |
| Also offered | Work light, Night watch, Teal ink                                                               |
| Events       | Archive door jams: the band dies for a second.                                                  |
| References   | —                                                                                               |

### L−1

#### Distribution Core (`aufzug1`) — Busbar ring

Copper busbars, thick as an arm, circle the distribution core in three horizontal bands with steel clamps. The current is visible: a chase runs along the bars, its speed and brightness follow the lab's real power flow.

|              |                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Wall         | `grid` · panel 16 × rows 1 · seam 1 (inset) · base plain · pillar every 8 · cornice none                  |
| Paint        | panel metal_dark · seam steel_dark · base metal_dark · cap copper · inlay black · accent line             |
| Bands        | busbar (v 8–23)                                                                                           |
| Floor        | `rings` · tile 16 · floor_grate / metal_dark, grout black                                                 |
| Signature    | **Current** — line #ff7a1a, node #ffd040, field #1f2226 (glow 0), `chase` × 0.8, source `power` · ≈ 1.3 W |
| Also offered | Heat map, Amber outline, Tunnel                                                                           |
| Events       | Brownout: the chase stops, the bars dim to ember.                                                         |
| References   | #8                                                                                                        |

#### Utility Corridor (`versorgung`) — Hum

A utility corridor of plain plates and ribs; cable trays above. The light is an old fluorescent strip that hums and flickers, and the guide line on the floor glows a little brighter wherever a cable is warm.

|              |                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Wall         | `rib` · panel 16 × rows 2 · seam 1 (inset) · base plain · pillar every 8 · cornice none            |
| Paint        | panel field · seam wall_dk · base metal_dark · cap metal_dark · inlay black · accent line          |
| Bands        | —                                                                                                  |
| Floor        | `guide` · tile 16 · floor_tile / floor_dark, grout floor_dark · center light lines                 |
| Signature    | **Fluorescent** — line #e8f4ff, node #ffb800, field #5b6068 (glow 0.05), `flicker` × 0.4 · ≈ 1.5 W |
| Also offered | Tunnel, Work light, Night watch                                                                    |
| Events       | —                                                                                                  |
| References   | #7                                                                                                 |

#### Geothermal Shaft (`geo`) — Thermal vein

Raw formwork concrete with tie holes, a copper pipe band and cracks that glow from inside. The light is the rock's heat: it breathes slowly and turns brighter the hotter the borehole runs.

|              |                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Wall         | `plate` · panel 32 × rows 2 · seam 1 (flat) · base plain · glowing cracks · cornice none                       |
| Paint        | panel concrete · seam concrete_dark · base metal_dark · cap concrete_dark · inlay black · accent concrete_dark |
| Bands        | pipes (v 21–23)                                                                                                |
| Floor        | `concrete` · tile 32 · concrete_dark / concrete, grout asphalt · glowing cracks                                |
| Signature    | **Magma** — line #ff6b00, node #ff4a1a, field #55554f (glow 0), `breathe` × 0.2, source `heat` · ≈ 3.1 W       |
| Also offered | Heat map, Cathedral, Emergency light                                                                           |
| Events       | Seep valve opens: the cracks flare violet for a moment.                                                        |
| References   | #8                                                                                                             |

#### Battery Room (`batterie`) — Charge rack

Battery cell racks line the walls; each cell front carries a charge bar of node lights. The bars show the lab's real charge — green when full, sinking and turning amber as it drains. Rubber floor mats with hazard edges.

|              |                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Wall         | `rack` · panel 12 × rows 4 · seam 1 (inset) · base hazard · cornice none                                |
| Paint        | panel metal_dark · seam steel_dark · base metal_dark · cap metal_dark · inlay black · accent node       |
| Bands        | —                                                                                                       |
| Floor        | `tiles` · tile 16 · rubber / floor_tile, grout black                                                    |
| Signature    | **Charge** — line #00ff66, node #00ff66, field #1f2226 (glow 0), `meter` × 1, source `charge` · ≈ 1.6 W |
| Also offered | Load meter, Amber outline, Emergency light                                                              |
| Events       | Charge below 15 %: the bars blink amber.                                                                |
| References   | —                                                                                                       |

#### Cooling (`kuehlung`) — Frost tile

White and teal tiles with a frosted band at head height, drains in the floor. The cold is a colour: the light breathes ice-cyan and goes deeper blue the colder the coolant runs.

|              |                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| Wall         | `tile` · panel 4 × rows 6 · seam 1 (inset) · base plain · cornice none                                       |
| Paint        | panel field · seam steel_dark · base metal_dark · cap aluminium · inlay black · accent line                  |
| Bands        | frost (v 22–25)                                                                                              |
| Floor        | `tiles` · tile 8 · tile_white / tile_teal, grout steel_dark                                                  |
| Signature    | **Coolant** — line #00ffff, node #e0ffff, field #c9ccd0 (glow 0.2), `breathe` × 0.2, source `heat` · ≈ 3.3 W |
| Also offered | Cryo, Teal ink, Work light                                                                                   |
| Events       | Overheat: the band turns orange until the coolant catches up.                                                |
| References   | #6                                                                                                           |

#### Coolant Passage (`kuehlgang`) — Condensate

Frosted aluminium pipes run the length of the passage; condensate drips from them as falling light. The floor grate is wet and reflects it.

|              |                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------- |
| Wall         | `grid` · panel 8 × rows 1 · seam 1 (inset) · base plain · cornice none                      |
| Paint        | panel field · seam steel_dark · base metal_dark · cap aluminium · inlay black · accent line |
| Bands        | pipes (v 6–11), pipes (v 16–21)                                                             |
| Floor        | `grate` · tile 16 · floor_grate / puddle, grout floor_dark                                  |
| Signature    | **Drip** — line #3fd0ff, node #e0ffff, field #aeb4ba (glow 0.05), `rain` × 0.4 · ≈ 0.3 W    |
| Also offered | Cryo, Night watch                                                                           |
| Events       | —                                                                                           |
| References   | —                                                                                           |

#### Fabrication Hall (`fertigung`) — Assembly line

Big riveted plates with hazard chevrons, gantry rails as pillars, an epoxy floor with yellow lanes and glowing bot bays. A yellow chase runs around the hall in time with production; when a fabricator finishes, the bay lines flash.

|              |                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Wall         | `plate` · panel 24 × rows 2 · seam 1 (inset) · base hazard · pillar every 12 · 30 % chevrons inlays · cornice none |
| Paint        | panel field · seam olive_dk · base metal_dark · cap olive_dk · inlay safety_yellow · accent chrome                 |
| Bands        | —                                                                                                                  |
| Floor        | `epoxy` · tile 16 · floor_grate / olive_dk, grout floor_dark · sides light lines                                   |
| Signature    | **Production** — line #ffd400, node #ffffff, field #4a5040 (glow 0), `chase` × 0.8, source `load` · ≈ 1.4 W        |
| Also offered | Sodium, Lemon, Alarm, Work light                                                                                   |
| Events       | Craft finished: bay lines flash twice.                                                                             |
| References   | #4                                                                                                                 |

#### Data Center (`rechen`) — 847 ms

Server rack fronts with vent slits and status LEDs, a cold-aisle line in blue along the seams, and a raised perforated floor that glows from below. One LED pattern runs through the whole room: 847 ms on, 847 ms off.

|              |                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| Wall         | `rack` · panel 8 × rows 4 · seam 1 (inset) · base plain · cornice cove                                   |
| Paint        | panel metal_dark · seam line · base metal_dark · cap metal_dark · inlay black · accent node              |
| Bands        | —                                                                                                        |
| Floor        | `raised` · tile 8 · floor_blue / metal_dark, grout black                                                 |
| Signature    | **847 ms** — line #2f7bff, node #00ff66, field #1f2226 (glow 0), `pulse` × 1.18, source `load` · ≈ 1.4 W |
| Also offered | Grid blue, Phosphor, Load meter, Night watch                                                             |
| Events       | CPU at full load: the LEDs switch to rain.                                                               |
| References   | #9                                                                                                       |

#### Materials Store (`lager`) — Stock bays

Shelf bays painted beige with stencilled bay numbers, a blue safety band, and floor markings for pallets. In smoke the blue light draws visible beams; once the ventilation runs, the numbers glow clear.

|              |                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| Wall         | `grid` · panel 16 × rows 2 · seam 1 (inset) · base plain · 60 % digits inlays · cornice none             |
| Paint        | panel field · seam wall_beige_dk · base metal_dark · cap wall_beige_dk · inlay safety_blue · accent line |
| Bands        | light (v 15–16)                                                                                          |
| Floor        | `concrete` · tile 24 · floor_beige / floor_beige_dk, grout floor_beige_dk · both light lines             |
| Signature    | **Stock** — line #1f8fff, node #ffffff, field #8a816c (glow 0), `static` × 1 · ≈ 2.3 W                   |
| Also offered | Work light, Lemon, Night watch                                                                           |
| Events       | Pickup in the store: its bay number flashes.                                                             |
| References   | —                                                                                                        |

### L−2

#### Signal Core (`aufzug2`) — Listening core

Perforated steel over acoustic foam: a diffuser wall of wells with different depths swallows every echo. The light listens too — it follows the lab's ambience like a slow meter.

|              |                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Wall         | `acoustic` · panel 8 × rows 4 · seam 1 (inset) · base plain · pillar every 8 · cornice chamfer                |
| Paint        | panel fabric_gray · seam line · base metal_dark · cap metal_dark · inlay black · accent paint_black           |
| Bands        | —                                                                                                             |
| Floor        | `rings` · tile 16 · floor_dark / metal_dark, grout floor_dark                                                 |
| Signature    | **Listening** — line #8b00ff, node #c38bff, field #1a1820 (glow 0), `reactive` × 1, source `signal` · ≈ 1.8 W |
| Also offered | Spectrum, Aurora, Night watch                                                                                 |
| Events       | X0-R8T speaks: the wells pulse with the voice.                                                                |
| References   | #9                                                                                                            |

#### Measurement Corridor (`messgang`) — Ruler

A measurement corridor with a graduated scale along both walls: fine ticks every fine voxel, long ticks every voxel, decade marks with node lights. A scan line measures the room from floor to cornice.

|              |                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Wall         | `grid` · panel 16 × rows 2 · seam 1 (inset) · base plain · cornice none                            |
| Paint        | panel field · seam wall_dk · base metal_dark · cap metal_dark · inlay black · accent line          |
| Bands        | ruler (v 14–19)                                                                                    |
| Floor        | `guide` · tile 8 · floor_tile / floor_dark, grout floor_dark · sides light lines · diamond markers |
| Signature    | **Measure** — line #00ffff, node #ffb800, field #5b6068 (glow 0), `scan` × 0.5 · ≈ 0.7 W           |
| Also offered | Grid blue, Work light, Tunnel                                                                      |
| Events       | A measurement puzzle runs: the scan freezes at the answer.                                         |
| References   | #7                                                                                                 |

#### Signal Lab (`signal`) — VU wall

Quadratic-residue diffusers in two tones cover the walls; between them vertical light slits rise and fall like a VU meter with the music and the signal level. The floor is a dark plum with concentric rings around the listening spot.

|              |                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Wall         | `acoustic` · panel 12 × rows 4 · seam 1 (inset) · base plain · cornice cove                                         |
| Paint        | panel fabric_gray · seam line · base metal_dark · cap metal_dark · inlay black · accent paint_black                 |
| Bands        | —                                                                                                                   |
| Floor        | `rings` · tile 16 · floor_purple / black, grout floor_dark                                                          |
| Signature    | **Spectrum** — line #ff00ff ↔ #00ffff, node #00ffff, field #14101a (glow 0), `meter` × 1, source `signal` · ≈ 2.2 W |
| Also offered | Spectrum, Aurora, Phosphor, Night watch                                                                             |
| Events       | First answer of X0-R8T: every slit flashes white once.                                                              |
| References   | #9                                                                                                                  |

#### Anomaly Chamber (`anomalie`) — Singing edges

Faceted shards of dark panelling meet in glowing edges, the way compression has edges. The edges flicker and twinkle violet, the floor cracks glow — the room sings when the Anomaly Detector is on.

|              |                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Wall         | `facet` · panel 12 × rows 4 · seam 1 (inset) · base plain · cornice chamfer                                     |
| Paint        | panel floor_forge · seam line · base metal_dark · cap metal_dark · inlay black · accent field                   |
| Bands        | —                                                                                                               |
| Floor        | `concrete` · tile 32 · floor_forge / black, grout black · glowing cracks                                        |
| Signature    | **Shimmer** — line #b060ff, node #ffffff, field #1c1a24 (glow 0.1), `twinkle` × 0.8, source `clarity` · ≈ 1.9 W |
| Also offered | Cathedral, Abyss, Aurora                                                                                        |
| Events       | AND-001 detects: the edges flash in sequence toward the source.                                                 |
| References   | #8                                                                                                              |

#### Diagnostics Room (`diagnose`) — Error code

A clean lab of white tiles with a blue signage band and a row of small diagnostic screens. One node in every screen bezel blinks the error code that has been blinking since 2019.

|              |                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Wall         | `tile` · panel 4 × rows 6 · seam 1 (inset) · base plain · cornice none                              |
| Paint        | panel tile_white · seam coat_shadow · base metal_dark · cap metal_light · inlay black · accent line |
| Bands        | light (v 14–15), duct (v 17–23)                                                                     |
| Floor        | `tiles` · tile 8 · floor_tile / tile_white_dk, grout floor_dark · sides light lines                 |
| Signature    | **Error code** — line #1f5fbf, node #ff3333, field #cfd3d6 (glow 0), `pulse` × 0.8 · ≈ 0.8 W        |
| Also offered | Work light, Grid blue, Cryo                                                                         |
| Events       | Diagnosis finished: the code turns green.                                                           |
| References   | —                                                                                                   |

#### Drone Hangar (`hangar`) — Runway

Concrete panels with hazard chevrons and painted bay numbers; on the floor a runway of guide lines and diamonds leads to the sealed shaft. When the drone launches, the lights chase toward the shaft.

|              |                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Wall         | `plate` · panel 32 × rows 2 · seam 1 (flat) · base hazard · 50 % digits inlays · cornice none                          |
| Paint        | panel concrete · seam concrete_dark · base metal_dark · cap concrete_dark · inlay safety_yellow · accent concrete_dark |
| Bands        | —                                                                                                                      |
| Floor        | `guide` · tile 32 · concrete_dark / concrete, grout asphalt · both light lines · diamond markers                       |
| Signature    | **Launch** — line #ffd400, node #ffffff, field #6e6e68 (glow 0), `chase` × 1 · ≈ 1.3 W                                 |
| Also offered | Work light, Tunnel, Alarm                                                                                              |
| Events       | EXD-001 launches: runway chase toward the shaft.                                                                       |
| References   | #7                                                                                                                     |

#### Relic Vault (`tresor`) — Deposit boxes

Walls of square safe-deposit doors with brass keyholes; a gold cap and gold line. The keyholes twinkle like something inside is awake. The floor carries a gold diamond inlay.

|              |                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Wall         | `drawers` · panel 6 × rows 4 · seam 1 (inset) · base plain · cornice none                        |
| Paint        | panel field · seam line · base metal_dark · cap gold · inlay black · accent node                 |
| Bands        | —                                                                                                |
| Floor        | `tiles` · tile 16 · floor_forge / black, grout brass · diamond markers                           |
| Signature    | **Gold leaf** — line #e0b64a, node #fff0a0, field #120c00 (glow 0.05), `twinkle` × 0.5 · ≈ 1.4 W |
| Also offered | Gold leaf, Cathedral, Night watch                                                                |
| Events       | A relic is taken: its keyhole stays lit.                                                         |
| References   | #8                                                                                               |

#### Bot Depot (`botdepot`) — Charging bays

Vertical bay frames with stencilled numbers and a charge bar in each; hazard baseboard, grate floor with bay lines. A reactivated bot's bar breathes green; a broken one stays dark.

|              |                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Wall         | `rack` · panel 16 × rows 4 · seam 1 (inset) · base hazard · 50 % digits inlays · cornice none    |
| Paint        | panel field · seam olive_dk · base metal_dark · cap olive_dk · inlay safety_yellow · accent node |
| Bands        | —                                                                                                |
| Floor        | `grate` · tile 16 · floor_grate / black, grout floor_dark · both light lines                     |
| Signature    | **Charging** — line #1fa34a, node #00ff66, field #4a5040 (glow 0), `breathe` × 0.5 · ≈ 2 W       |
| Also offered | Load meter, Work light, Night watch                                                              |
| Events       | Bot service done: its bay flashes white.                                                         |
| References   | —                                                                                                |

#### Radiation Lock (`strahlengang`) — Dosimeter

Lead-grey plates with radiation trefoils, a hazard base and a yellow line that clicks like a Geiger counter — irregular flicker that grows denser the closer the anomaly runs.

|              |                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Wall         | `plate` · panel 12 × rows 2 · seam 1 (inset) · base hazard · 50 % trefoil inlays · cornice none             |
| Paint        | panel steel_dark · seam metal_dark · base metal_dark · cap metal_dark · inlay safety_yellow · accent chrome |
| Bands        | light (v 15–16)                                                                                             |
| Floor        | `grate` · tile 16 · floor_grate / black, grout floor_dark                                                   |
| Signature    | **Geiger** — line #ffd400, node #ffd400, field #50565d (glow 0), `flicker` × 1.5 · ≈ 0.9 W                  |
| Also offered | Alarm, Lemon, Work light                                                                                    |
| Events       | Anomaly active: the flicker speeds up.                                                                      |
| References   | #4                                                                                                          |

#### Damien's Sound Studio (secret) (`studio`) — Tape

Damien's hidden studio: wooden diffusers and bass traps, a warm amber VU meter in the slits and a red carpet. The meter rises with whatever plays on the tape machines.

|              |                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Wall         | `acoustic` · panel 8 × rows 4 · seam 1 (inset) · base plain · cornice cove                                |
| Paint        | panel wood · seam line · base metal_dark · cap walnut · inlay black · accent wood_dark                    |
| Bands        | —                                                                                                         |
| Floor        | `carpet` · tile 16 · carpet_red / fabric_red_shade, grout floor_dark                                      |
| Signature    | **VU amber** — line #ffaa00, node #ff3333, field #3a2618 (glow 0), `meter` × 1, source `signal` · ≈ 1.2 W |
| Also offered | Spectrum, Dawn, Night watch                                                                               |
| Events       | A song plays in the studio: the meter follows it.                                                         |
| References   | #3                                                                                                        |

### L−3

#### Deep Core (`aufzug3`) — Cerulean seep

Ribs with frost on their edges, a painted warning band on the floor, and cerulean light seeping up from the Forge: a scan rises from the floor through the ribs, slowly, like cold water.

|              |                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------- |
| Wall         | `rib` · panel 16 × rows 3 · seam 1 (inset) · base plain · pillar every 8 · cornice chamfer   |
| Paint        | panel field · seam metal_dark · base metal_dark · cap metal_dark · inlay black · accent line |
| Bands        | frost (v 24–27)                                                                              |
| Floor        | `rings` · tile 16 · floor_dark / metal_dark, grout floor_dark                                |
| Signature    | **Seep** — line #3fa7ff, node #cfe8ff, field #1c2028 (glow 0.05), `scan` × 0.3 · ≈ 1.4 W     |
| Also offered | Cryo, Grid blue, Abyss                                                                       |
| Events       | Forge field on: the seep turns white-gold.                                                   |
| References   | #9                                                                                           |

#### Pressure Antechamber (`vorraum`) — Pressure

Heavy plates under ice, a frost band and a pulse between red and blue while the pressure equalises. The warning sign is a glyph that glows through the ice.

|              |                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Wall         | `plate` · panel 12 × rows 2 · seam 1 (inset) · base plain · 40 % chevrons inlays · cornice none |
| Paint        | panel field · seam metal_dark · base metal_dark · cap ice · inlay line · accent chrome          |
| Bands        | frost (v 20–27)                                                                                 |
| Floor        | `grate` · tile 16 · floor_grate / ice, grout floor_dark                                         |
| Signature    | **Equalise** — line #ff3020, node #3fd0ff, field #3d4147 (glow 0), `pulse` × 0.6 · ≈ 0.8 W      |
| Also offered | Cryo, Alarm                                                                                     |
| Events       | Pressure equalised: the pulse settles to blue.                                                  |
| References   | —                                                                                               |

#### Infinity Forge Chamber (`forge`) — Field coils

Horizontal field coils wind around the chamber between faceted panels; the floor is a ring field around the two Synapsis stations. When the Infinity Forge field runs, ripples of cerulean travel outward from the centre.

|              |                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Wall         | `grid` · panel 12 × rows 2 · seam 1 (inset) · base plain · pillar every 8 · cornice chamfer       |
| Paint        | panel field · seam metal_dark · base metal_dark · cap metal_dark · inlay black · accent line      |
| Bands        | coils (v 8–11), coils (v 18–21)                                                                   |
| Floor        | `rings` · tile 16 · floor_forge / black, grout floor_dark                                         |
| Signature    | **Forge field** — line #3fa7ff, node #ffe9a8, field #0a1420 (glow 0.15), `ripple` × 0.6 · ≈ 4.3 W |
| Also offered | Grid blue, Aurora, Gold leaf                                                                      |
| Events       | A forging completes: one white-gold ripple.                                                       |
| References   | #9                                                                                                |

#### Reactor Room (`reaktor`) — Cherenkov

Olive riveted plates around the plinth with its magnetic rings; the line is Cherenkov blue and breathes with the reactor's output. Hazard rings on the floor around the plinth.

|              |                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| Wall         | `plate` · panel 16 × rows 3 · seam 1 (inset) · base hazard · cornice none                                    |
| Paint        | panel field · seam line · base metal_dark · cap olive_dk · inlay black · accent chrome                       |
| Bands        | —                                                                                                            |
| Floor        | `rings` · tile 16 · concrete_dark / olive_dk, grout floor_dark                                               |
| Signature    | **Cherenkov** — line #3fd0ff, node #e8f4ff, field #4a5040 (glow 0), `reactive` × 1, source `power` · ≈ 2.2 W |
| Also offered | Heat map, Alarm, Grid blue                                                                                   |
| Events       | MFR-001 overload: Alarm until it cools down.                                                                 |
| References   | —                                                                                                            |

#### Containment (`containment`) — Field cell

Black tiles with steel grout, a magenta field line that pulses; the floor is plum tile. If containment breaks, the room jumps to Alarm on its own.

|              |                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Wall         | `tile` · panel 4 × rows 6 · seam 1 (inset) · base plain · cornice none                            |
| Paint        | panel tile_black · seam steel_dark · base metal_dark · cap metal_dark · inlay black · accent line |
| Bands        | light (v 9–10), light (v 21–22)                                                                   |
| Floor        | `tiles` · tile 8 · floor_purple / black, grout steel_dark                                         |
| Signature    | **Field** — line #ff3fbf, node #ff00ff, field #1c1e21 (glow 0), `pulse` × 0.5 · ≈ 1.1 W           |
| Also offered | Abyss, Alarm, Red ink                                                                             |
| Events       | Breach: Alarm (forced) until EMC-001 holds again.                                                 |
| References   | —                                                                                                 |

#### Compute Core (`rechenkern`) — Neural grid

The blue grid room of ref 9: outlined rack panels, a lit cove, a diamond-inlaid floor. Data rain falls down the seams; its density is the compute core's load. Something here thinks.

|              |                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Wall         | `rack` · panel 8 × rows 4 · seam 1 (inset) · base plain · bezels · cornice cove                                |
| Paint        | panel field · seam line · base metal_dark · cap metal_dark · inlay black · accent node                         |
| Bands        | —                                                                                                              |
| Floor        | `tiles` · tile 16 · floor_blue / paint_navy, grout black · diamond markers                                     |
| Signature    | **Neural rain** — line #4ab8ff, node #bfe8ff, field #050a3a (glow 0.25), `rain` × 0.8, source `load` · ≈ 1.9 W |
| Also offered | Grid blue, Phosphor, Aurora                                                                                    |
| Events       | AIC-001 wakes: the rain turns into a scan.                                                                     |
| References   | #9                                                                                                             |

#### Teleport Platform (`teleport`) — Halo gate

Ribs every four voxels make the walls an octagonal tunnel around the circular plinth; rings and spokes on the floor. Exotic blue ripples run toward the plinth, faster the closer a jump is.

|              |                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------ |
| Wall         | `rib` · panel 16 × rows 3 · seam 1 (inset) · base plain · pillar every 4 · cornice chamfer |
| Paint        | panel field · seam black · base metal_dark · cap metal_dark · inlay black · accent line    |
| Bands        | —                                                                                          |
| Floor        | `rings` · tile 16 · floor_forge / black, grout floor_dark                                  |
| Signature    | **Halo** — line #4b3bff, node #c38bff, field #0a0820 (glow 0.1), `ripple` × 1 · ≈ 2.6 W    |
| Also offered | Tunnel, Grid blue, Aurora                                                                  |
| Events       | Jump: the ripple reverses and collapses into the plinth.                                   |
| References   | #7, #9                                                                                     |

#### Quantum Lab (`quanten`) — Superposition

Teal tiles and a screen band of qubit readouts; nodes twinkle independently, never twice the same — the qubits don't forget, but they never decide either.

|              |                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------- |
| Wall         | `screen` · panel 8 × rows 2 · seam 1 (inset) · base plain · cornice none                  |
| Paint        | panel field · seam teal_dk · base metal_dark · cap tile_teal · inlay black · accent node  |
| Bands        | —                                                                                         |
| Floor        | `tiles` · tile 8 · tile_teal / floor_blue, grout tile_black                               |
| Signature    | **Qubit** — line #5cf2ff, node #ffffff, field #0a2a30 (glow 0.3), `twinkle` × 1 · ≈ 1.9 W |
| Also offered | Cryo, Aurora, Teal ink                                                                    |
| Events       | Measurement: every node freezes for a second.                                             |
| References   | #6                                                                                        |

#### Cold Archive (secret) (`kaeltearchiv`) — Hoarfrost

Shelves under hoarfrost: drawer fronts with a thick frost band, an ice-white field glow that breathes so slowly you only see it if you stand still.

|              |                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Wall         | `drawers` · panel 8 × rows 4 · seam 1 (inset) · base plain · cornice none                        |
| Paint        | panel field · seam steel_dark · base metal_dark · cap ice · inlay black · accent aluminium       |
| Bands        | frost (v 20–27)                                                                                  |
| Floor        | `tiles` · tile 16 · floor_blue / ice, grout steel_dark                                           |
| Signature    | **Hoarfrost** — line #cfefff, node #ffffff, field #9fb8c8 (glow 0.4), `breathe` × 0.08 · ≈ 4.8 W |
| Also offered | Cryo, Night watch                                                                                |
| Events       | —                                                                                                |
| References   | —                                                                                                |

### L−4

#### Garden Atrium (`aufzug4`) — Grow-light atrium

Beige wainscot with a wooden trellis band where the ivy climbs; a grow light in the cove follows the time of day — dawn pink, noon white, night off.

|              |                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Wall         | `wainscot` · panel 16 × rows 4 · seam 1 (inset) · base plain · cornice cove                                     |
| Paint        | panel field · seam tile_cream_dk · base metal_dark · cap walnut · inlay black · accent line                     |
| Bands        | plants (v 15–25)                                                                                                |
| Floor        | `terrazzo` · tile 16 · floor_beige / beige_dk, grout floor_beige_dk                                             |
| Signature    | **Grow light** — line #ff8ad8, node #fff4c8, field #8a816c (glow 0.1), `daylight` × 1, source `clock` · ≈ 2.8 W |
| Also offered | Dawn, Aurora, Night watch                                                                                       |
| Events       | —                                                                                                               |
| References   | —                                                                                                               |

#### Residential Corridor (`wohnflur`) — Evening hall

Wainscot with a picture rail, a red carpet with a border, and a warm cove light that follows the evening. Name plates beside the doors glow softly.

|              |                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Wall         | `wainscot` · panel 12 × rows 4 · seam 1 (inset) · base plain · cornice cove                                   |
| Paint        | panel field · seam wood_dark · base metal_dark · cap walnut · inlay black · accent line                       |
| Bands        | —                                                                                                             |
| Floor        | `carpet` · tile 16 · carpet_red / fabric_red_shade, grout floor_dark                                          |
| Signature    | **Evening** — line #ffd9a0, node #ffb070, field #8a816c (glow 0.05), `daylight` × 1, source `clock` · ≈ 1.2 W |
| Also offered | Dawn, Night watch, Work light                                                                                 |
| Events       | —                                                                                                             |
| References   | —                                                                                                             |

#### Jade's Quarters (`jadeq`) — Colour-sorted

Jade's teal room: a teal pegboard full of pinned paper sketches — parts, brackets, half-ideas — and above it a narrow notebook shelf with spines sorted by colour, like her stacks. Warm reading cove, blue carpet. At night only the shelf's node lights stay on, dim.

|              |                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Wall         | `pegboard` · panel 10 × rows 2 · seam 1 (inset) · base wood · 60 % tetro inlays · cornice cove                |
| Paint        | panel field · seam teal_dk · base metal_dark · cap walnut · inlay paper · accent line                         |
| Bands        | notebooks (v 16–21)                                                                                           |
| Floor        | `carpet` · tile 16 · carpet_blue / fabric_blue_shade, grout floor_dark                                        |
| Signature    | **Reading** — line #ffd9a0, node #5cf2ff, field #2d6b6b (glow 0.05), `daylight` × 1, source `clock` · ≈ 1.7 W |
| Also offered | Dawn, Night watch, Teal ink                                                                                   |
| Events       | Jade sleeps: Night watch until she wakes.                                                                     |
| References   | #6                                                                                                            |

#### Damien's Quarters (`damienq`) — Legal pads

Olive wainscot, and above it seventeen yellow legal pads pinned in a row, numbered — chaos with a system. The light swings with the grandfather clock that is missing a gear: a breath every two seconds, slightly off.

|              |                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------- |
| Wall         | `wainscot` · panel 12 × rows 4 · seam 1 (inset) · base plain · cornice cove                   |
| Paint        | panel field · seam olive_dk · base metal_dark · cap walnut · inlay black · accent line        |
| Bands        | pads (v 14–23)                                                                                |
| Floor        | `carpet` · tile 16 · carpet_green / fabric_green_shade, grout floor_dark                      |
| Signature    | **Pendulum** — line #ffd9a0, node #ffaa00, field #4a5040 (glow 0), `breathe` × 0.53 · ≈ 1.6 W |
| Also offered | Dawn, Red ink, Night watch                                                                    |
| Events       | The clock is repaired: the breath falls exactly on the second.                                |
| References   | —                                                                                             |

#### Kitchen & Canteen (`kantine`) — Coffee break

Subway tiles, a checkered floor, a warm band over the counter. A node light near the coffee machine glows when it has power — from the wall, not the socket.

|              |                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Wall         | `tile` · panel 8 × rows 8 · seam 1 (inset) · base plain · cornice none                                    |
| Paint        | panel tile_white · seam coat_shadow · base metal_dark · cap walnut · inlay black · accent line            |
| Bands        | light (v 17–18)                                                                                           |
| Floor        | `checker` · tile 8 · tile_white / tile_black, grout steel_dark                                            |
| Signature    | **Coffee** — line #ffd9a0, node #ffb800, field #cfd3d6 (glow 0), `daylight` × 1, source `clock` · ≈ 1.6 W |
| Also offered | Work light, Dawn, Night watch                                                                             |
| Events       | Coffee brewed: the node blinks three times.                                                               |
| References   | —                                                                                                         |

#### Library (`bibliothek`) — Spines

Book spines from wainscot to cornice in real colours (red, green, blue, brown); a reading cove light and a basket-weave parquet. Static, warm, quiet — the light only dims when the room is empty.

|              |                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Wall         | `wainscot` · panel 12 × rows 4 · seam 1 (inset) · base plain · cornice cove                    |
| Paint        | panel field · seam wood_dark · base metal_dark · cap walnut · inlay black · accent line        |
| Bands        | books (v 13–18), books (v 20–25)                                                               |
| Floor        | `parquet` · tile 4 · oak / wood_dark, grout walnut                                             |
| Signature    | **Reading lamp** — line #ffd9a0, node #ffb070, field #8a816c (glow 0.05), `static` × 1 · ≈ 3 W |
| Also offered | Dawn, Night watch, Red ink                                                                     |
| Events       | —                                                                                              |
| References   | —                                                                                              |

#### Greenhouse (`gewaechshaus`) — Photosynthesis

Glass panes in steel mullions over planter beds; the grow light in the cove follows the day, and glow-algae nodes in the bed rims breathe green. The floor is beds and stepping-stone paths.

|              |                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Wall         | `glass` · panel 12 × rows 2 · seam 1 (inset) · base plain · cornice cove                                          |
| Paint        | panel glass_green · seam steel · base metal_dark · cap steel_dark · inlay black · accent node                     |
| Bands        | —                                                                                                                 |
| Floor        | `beds` · tile 24 · soil / floor_green, grout wood_dark                                                            |
| Signature    | **Photosynthesis** — line #ff5fd0, node #39ff88, field #2f3b33 (glow 0), `daylight` × 1, source `clock` · ≈ 2.1 W |
| Also offered | Aurora, Dawn, Night watch                                                                                         |
| Events       | Plants watered: the algae nodes flare.                                                                            |
| References   | —                                                                                                                 |

#### Garden Passage (`gartengang`) — Mint wins

A wainscot passage with a cable duct band where mint has taken over — leaves spill over the duct edge. The duct's light breathes green.

|              |                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------- |
| Wall         | `wainscot` · panel 12 × rows 4 · seam 1 (inset) · base plain · cornice cove                 |
| Paint        | panel field · seam paint_mint_dk · base metal_dark · cap walnut · inlay black · accent line |
| Bands        | plants (v 17–22)                                                                            |
| Floor        | `carpet` · tile 16 · carpet_green / fabric_green_shade, grout floor_dark                    |
| Signature    | **Mint** — line #7dffb0, node #39ff88, field #8a816c (glow 0), `breathe` × 0.3 · ≈ 1.3 W    |
| Also offered | Dawn, Night watch                                                                           |
| Events       | —                                                                                           |
| References   | —                                                                                           |

#### Observatory (`observatorium`) — Dome segments

Steel dome segments as ribs, navy fields between them full of star nodes that twinkle; the floor is a star chart with rings and spokes. The strip of starlight through the gap becomes a slow scan.

|              |                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------- |
| Wall         | `rib` · panel 16 × rows 3 · seam 1 (inset) · base plain · pillar every 6 · cornice chamfer    |
| Paint        | panel field · seam steel_dark · base metal_dark · cap brass · inlay black · accent brass      |
| Bands        | —                                                                                             |
| Floor        | `stars` · tile 16 · floor_dark / paint_navy, grout brass                                      |
| Signature    | **Starlight** — line #3a4a8a, node #ffffff, field #02030a (glow 0), `twinkle` × 0.5 · ≈ 1.2 W |
| Also offered | Starlight, Aurora, Grid blue                                                                  |
| Events       | Dome opens: the field turns to sky blue, the stars fade.                                      |
| References   | #9                                                                                            |

#### Radio Room (`funkraum`) — Morse

Acoustic panels and, at eye height, the chalk Morse line from the wall — dots and dashes as node lights that play the code over and over as a chase.

|              |                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Wall         | `acoustic` · panel 8 × rows 4 · seam 1 (inset) · base plain · cornice none                                 |
| Paint        | panel fabric_gray · seam paint_black · base metal_dark · cap metal_dark · inlay black · accent paint_black |
| Bands        | morse (v 14–16)                                                                                            |
| Floor        | `carpet` · tile 16 · floor_purple / carpet_blue, grout floor_dark                                          |
| Signature    | **Morse** — line #ffaa00, node #ffaa00, field #2e2838 (glow 0), `chase` × 0.4 · ≈ 0.7 W                    |
| Also offered | Phosphor, Spectrum, Night watch                                                                            |
| Events       | A transmission arrives: the code changes to the received one.                                              |
| References   | —                                                                                                          |

### L−5

#### Shaft Station (`aufzug5`) — Miner's lamp

Raw rock with timber supports, rails in the gravel. Lamps on the timbers flicker like carbide light; thin crystal veins in the rock glow cyan.

|              |                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------- |
| Wall         | `rock` · panel 8 × rows 4 · seam 1 (inset) · base plain · pillar every 6 · cornice none     |
| Paint        | panel rock · seam rock_dark · base metal_dark · cap rock_dark · inlay black · accent wood   |
| Bands        | —                                                                                           |
| Floor        | `gravel` · tile 16 · asphalt / rock_dark, grout floor_dark · center light lines             |
| Signature    | **Carbide** — line #ffd9a0, node #45f0d8, field #4d4841 (glow 0), `flicker` × 0.3 · ≈ 2.7 W |
| Also offered | Emergency light, Abyss                                                                      |
| Events       | —                                                                                           |
| References   | —                                                                                           |

#### Shaft Bottom (`sohle`) — Trickle

Rock with chalk marks, puddles on the floor. Somewhere it always trickles: cyan drops of light run down the veins.

|              |                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------ |
| Wall         | `rock` · panel 8 × rows 4 · seam 1 (inset) · base plain · cornice none                     |
| Paint        | panel rock · seam rock_dark · base metal_dark · cap rock_dark · inlay black · accent paper |
| Bands        | —                                                                                          |
| Floor        | `gravel` · tile 16 · concrete_dark / puddle, grout floor_dark · glowing cracks             |
| Signature    | **Trickle** — line #45f0d8, node #45f0d8, field #4d4841 (glow 0), `rain` × 0.3 · ≈ 1 W     |
| Also offered | Abyss, Emergency light                                                                     |
| Events       | —                                                                                          |
| References   | —                                                                                          |

#### X9-DUST Chamber (`x9kammer`) — Halo dust

Fine faceted panels full of glitter: the dust that never settles. Thousands of tiny white-gold nodes twinkle in the facets and on the floor — read under a microscope: THE HALO EXPANDS.

|              |                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------- |
| Wall         | `facet` · panel 8 × rows 4 · seam 1 (inset) · base plain · cornice none                      |
| Paint        | panel floor_forge · seam line · base metal_dark · cap metal_dark · inlay black · accent node |
| Bands        | —                                                                                            |
| Floor        | `terrazzo` · tile 16 · floor_forge / black, grout black                                      |
| Signature    | **Halo dust** — line #ffe9a8, node #fff4c8, field #1c1a24 (glow 0), `twinkle` × 1 · ≈ 0.9 W  |
| Also offered | Gold leaf, Starlight, Cathedral                                                              |
| Events       | —                                                                                            |
| References   | #8                                                                                           |

#### Rubble Tunnel (`stollen`) — Warm wall

A half-buried tunnel: rock, timber, bent rails. The walls are warm — orange heat breathes in the cracks, stronger toward the borehole.

|              |                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Wall         | `rock` · panel 8 × rows 4 · seam 1 (inset) · base plain · pillar every 6 · glowing cracks · cornice none      |
| Paint        | panel rock · seam rock_dark · base metal_dark · cap rock_dark · inlay black · accent wood                     |
| Bands        | —                                                                                                             |
| Floor        | `gravel` · tile 16 · asphalt / rock_dark, grout floor_dark · center light lines · glowing cracks              |
| Signature    | **Warm wall** — line #ff6b00, node #ff4a1a, field #4d4841 (glow 0), `breathe` × 0.25, source `heat` · ≈ 1.8 W |
| Also offered | Heat map, Emergency light                                                                                     |
| Events       | —                                                                                                             |
| References   | #8                                                                                                            |

#### Halo Crystal Cave (`hoehle`) — Two shadows

The crystal cathedral of ref 8, in voxels: big faceted shards with glowing edges, the floor cracked and lit from below. The light cycles between violet and cyan and ripples outward — every shard casts two shadows.

|              |                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Wall         | `facet` · panel 10 × rows 4 · seam 1 (inset) · base plain · cornice chamfer                                               |
| Paint        | panel rock_dark · seam line · base metal_dark · cap rock_dark · inlay black · accent field                                |
| Bands        | —                                                                                                                         |
| Floor        | `gravel` · tile 16 · floor_purple / rock_dark, grout floor_dark · glowing cracks                                          |
| Signature    | **Two shadows** — line #9d5cff ↔ #45f0d8, node #45f0d8, field #3a1a5c (glow 0.35), `cycle` × 1, source `clarity` · ≈ 10 W |
| Also offered | Cathedral, Aurora, Abyss                                                                                                  |
| Events       | The membrane listens: one ripple from the centre.                                                                         |
| References   | #8                                                                                                                        |

#### C8-BR41N's Hideout (`c8versteck`) — [EXTERNAL]

An improvised server room: rack fronts from three decades, mismatched, cables everywhere. Phosphor-green rain runs down the seams, and every few seconds one rack spells [EXTERNAL].

|              |                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------- |
| Wall         | `rack` · panel 12 × rows 4 · seam 1 (inset) · base plain · cornice none                     |
| Paint        | panel field · seam line · base metal_dark · cap metal_dark · inlay black · accent node      |
| Bands        | cables (v 22–26)                                                                            |
| Floor        | `raised` · tile 8 · floor_blue / metal_dark, grout floor_dark                               |
| Signature    | **[EXTERNAL]** — line #33ff33, node #b8ffb8, field #0a1a0a (glow 0.1), `rain` × 1 · ≈ 1.3 W |
| Also offered | Phosphor, Load meter, Night watch                                                           |
| Events       | C8-BR41N speaks: the rain stops, one line glows.                                            |
| References   | —                                                                                           |

#### Collapse Site (`truemmer`) — Collapse

Olive plates, half of them fallen: rock shows through the gaps. Only emergency light still works, a dim red breath on the nodes.

|              |                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| Wall         | `plate` · panel 16 × rows 2 · seam 1 (inset) · base plain · dark every 3th · LED pairs · cornice none |
| Paint        | panel wall_olive · seam olive_dk · base metal_dark · cap rock_dark · inlay black · accent chrome      |
| Bands        | —                                                                                                     |
| Floor        | `gravel` · tile 16 · concrete_dark / rock, grout floor_dark · glowing cracks                          |
| Signature    | **Emergency** — line #000000, node #ff3020, field #4a5040 (glow 0), `breathe` × 0.3 · ≈ 1.2 W         |
| Also offered | Emergency light, Abyss                                                                                |
| Events       | —                                                                                                     |
| References   | —                                                                                                     |

#### Borehole #1 (`bohrung`) — 847 m

Formwork concrete with a ring of copper pipe; the floor rings around the drill head. Heat light scans downward, toward the boiling rock 847 metres below.

|              |                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Wall         | `plate` · panel 32 × rows 2 · seam 1 (flat) · base plain · glowing cracks · cornice none                       |
| Paint        | panel concrete · seam concrete_dark · base metal_dark · cap concrete_dark · inlay black · accent concrete_dark |
| Bands        | pipes (v 10–12)                                                                                                |
| Floor        | `rings` · tile 16 · concrete_dark / asphalt, grout floor_dark · glowing cracks                                 |
| Signature    | **Downward** — line #ff6b00, node #ff4a1a, field #55554f (glow 0), `scan` × 0.3, source `heat` · ≈ 0.9 W       |
| Also offered | Heat map, Emergency light                                                                                      |
| Events       | —                                                                                                              |
| References   | #8                                                                                                             |

<!-- rooms:end -->
