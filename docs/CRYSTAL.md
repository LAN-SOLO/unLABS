# Crystal age — from voxels to real surfaces

> After the 42nd era the voxels stop splitting: the lab **crystallises**.
> Every voxel model and every piece of terrain is swapped for a real,
> rendered surface built in Blender from the very same voxels — rounded
> edges, true slopes instead of staircases, metal that reflects, painted
> steel with worn edges, all in the lab's palette. Jade (the hero) was real
> from the start; now the world catches up with her.

Related: [`CLARITY.md`](CLARITY.md) (the 42 voxel eras that lead here),
[`HERO.md`](HERO.md) (Jade's sculpt). Skill: `.claude/skills/crystal/SKILL.md`.

---

## 1. Concept

| Idea                                 | Implementation                                                             |
| ------------------------------------ | -------------------------------------------------------------------------- |
| The world crystallises at the end    | `graphics.crystal` = `story`: era 42 → crystal models (`crystalWanted`)    |
| Same art, real surfaces              | Built from the game's own voxel grids; the palette colour stays the colour |
| Nothing breaks if a model is missing | Keyed by content hash; no crystal model → the voxel mesh stays             |
| The library brings the physics       | Surfaces (painted metal, steel, rubber, …) bound to library materials      |
| Claude does the look-dev             | MCP server `crystal` drives Blender; skill `crystal` describes the loop    |
| Damien stays hidden                  | Never exported; `forbiddenUse()` + `tests/world/crystal.test.ts` guard it  |

Settings: **Crystal age** `story` (after era 42, default) · `always`
(photo mode / showcase) · `never` (`graphics.crystal`, `lib/world/clarity-mode.ts`).

## 2. Data flow

```
game sources (models/*, layout, content)
   │  pnpm crystal:export          scripts/crystal/export.ts (vite-node)
   ▼
.crystal/dumps/<key>.json + .crystal/inventory.json      (gitignored work dir)
   │  pnpm crystal:build           scripts/crystal/build.ts → N × Blender -b
   │                               scripts/crystal/blender/cli.py batch
   ▼                               (shape → AO → colours → crop → slots → GLB)
.crystal/raw/*.glb ──meshopt + quantise (glTF-Transform)──▶ public/crystal/models/*.glb
                                                           public/crystal/manifest.json
   │  fetch on demand               lib/world/render/crystal.ts (CrystalLibrary)
   ▼
LabEngine: meshModel / sharedMesh / merged decor / WorldRenderer chunks
           swap geometry + material slots when the crystal age is on
```

### 2.1 Inventory (`export.ts`)

Every grid the engine meshes (see the call-site table in the file header):
devices (complete, powered + dark, base + rig parts), lore bots (awake +
dormant), MCP avatar, props (base, rig parts, variant decor), pickups,
notes, all decor (+ animated decor parts), doors (frames, beacons, leaves
per light / keypad / bolt, secret covers), the styled doors of
`docs/DOORS.md` (frame, leaf pieces per light, mechanism parts, the six
lock-interface states, airlock hardware — `scripts/crystal/door-parts.ts`,
393 grids), elevators, room terminals, hand props — deduplicated by
`gridHash`.

**Not exported:** Jade (the hero — never voxels in the crystal age), Damien
and his veil (spoiler; reserved arc), partial build stages (era 42 needs
every device complete).

**Terrain:** every allocated 32³ chunk of every floor, as a 36³ box (chunk

- `TERRAIN_RING` = 2 voxels of context, so blur and AO match across
  borders), for lamps lit / dark × wall cutaway up / half / down (≈ 630
  unique boxes). Key = `t:` + `gridHash(box)`; a state that was never
  exported (a half-lit room mid-transition, an opened secret door) shows
  voxels for that chunk.

### 2.2 Dump format

`scripts/crystal/blender/crystal/dump.py`: `size` (game axes, y up),
local `palette` [{hex, mat, name}], run-length `runs` (x fastest), plus
`key`, `family`, `unit` (source voxels per cell), `center`, `uses`, and
for terrain `crop` [x0,y0,z0,x1,y1,z1].

### 2.3 Blender build (`scripts/crystal/blender/crystal/`)

| Module        | Job                                                                                  |
| ------------- | ------------------------------------------------------------------------------------ |
| `shell.py`    | numpy voxel shell (exposed quads), game ↔ Blender axes, label lookup / smoothing     |
| `sdf.py`      | **crystallisation**: Gaussian-blurred occupancy → OpenVDB iso surface (see 2.4)      |
| `geometry.py` | profiles (`sdf`, `hard`, `remesh`), relabelling, planar reduce, budget, terrain crop |
| `surfaces.py` | AO bake (Cycles → vertex colours), wear / cavity, `COLOR_0`, box UVs, surface slots  |
| `look.py`     | look-dev materials (library maps / .blend materials × palette), used for previews    |
| `render.py`   | studio stage, procedural softbox world (or library HDRI), Cycles stills, Metal GPU   |
| `export.py`   | glTF export (geometry, normals, UV, `COLOR_0`, `crystal:<surface>` materials)        |
| `library.py`  | .blend asset listing, engine texture export                                          |
| `pipeline.py` | one model end to end; `cli.py` = headless entry (`build`, `batch`, `textures`, …)    |

### 2.4 Shape: the `sdf` profile

Occupancy upsampled to `cell` source voxels, blurred with σ = `blur`
voxels, meshed at the 0.5 iso level (OpenVDB `convertToPolygons`):

- a flat side blurs to a half-space → its iso surface stays **exactly
  planar and in place**;
- voxel staircases melt into the slope they stand for;
- convex edges round with radius ≈ σ, concave ones get a fillet.

Kept crisp: screens / LEDs / glass (`sharpClasses`, `sharpNames`,
softened by `sharpBevel`). Thin parts (empty on both sides along an axis)
would evaporate under the blur: they get their own blur and gain
(`thinBlur`, `thinGain`). Colours come from blurred per-colour fields
(`colorBlur`, argmax) so borders run straight instead of in steps. Then
coplanar faces are merged (`planar`°, colour borders kept), the triangle
budget is applied (`trisPerVoxel`, `minTris`, `maxTris`), and normals are
area-weighted (big faces stay flat-shaded).

Profiles (`scripts/crystal/config/profiles.json`): `crystal` (devices,
props, decor, doors, pickups, bots), `crystal_soft`, `crystal_fine`,
`terrain` (stronger thin-part blur so diagonal walls come out straight),
plus `hard` (bevelled voxels, product look) and `blend` / `soft` (remesh).

### 2.5 Colour and surfaces

- `COLOR_0` (linear) = palette colour × AO (Cycles bake, `ao.strength`) ×
  (1 + edge wear − cavity grime) — per surface `wear`.
- Every palette colour binds to one **surface** (`surfaces.json`
  `bindings`, first match wins; per model via `overrides.json`). 19
  surfaces: painted_metal, steel, chrome, warm_metal, rust, plastic,
  rubber, wood, fabric, leather, paper, ceramic, masonry, organic, skin,
  hair, glass, crystal, emissive (≤ 24, the engine's slot count).
- A surface has PBR factors (`metal`, `rough`, `relief`, `wear`, `emit`,
  `transmission`, `clearcoat`, `sheen`, `subsurface`) and optionally a
  library entry (`library`, `texScale`, `texDetail`, `texAlbedo`).

### 2.6 Cache

`public/crystal/manifest.json` keeps per model the dump `sha` and a `cfg`
fingerprint = pipeline version + bindings + per-surface wear + AO / wear /
UV settings + the model's profile + its override. `crystal:build` rebuilds
only what changed. Library refs / texture settings never trigger a
rebuild (they only change looks and engine textures). `--adopt` re-stamps
existing GLBs after a config change that cannot affect geometry;
`--force` rebuilds everything.

### 2.7 Quality pass (2026-10-01, afternoon)

- **Colour borders are cut, not painted:** on the dense iso mesh every
  triangle whose corners carry two colours is split where the two blurred
  colour fields are equal (marching triangles, numpy, `cut_color_borders`;
  edge points shared → no cracks). Before planar merging, so flat regions
  still merge afterwards.
- **Dirt is a gradient:** palette colours listed in `profiles.json →
overlays` (grime 0.55, dust 0.78) are removed from the shape's colours
  (the paint grows into them) and come back as a blurred field mixed over
  the paint (`overlay.py`).
- **Budgets by importance:** `crystal` (devices, bots, props, doors) 12
  tris / voxel, `crystal_small` (detail, decor, pickups) 6; **adaptive
  sampling cell** (`sdf.adaptive_cell`): the field is never sampled finer
  than ~6× the triangle budget needs (a 52³ device went from 497 s to 33 s).
- **Engine look:** surface slots are `MeshPhysicalMaterial`s with lacquer
  (painted metal, plastic, ceramic), sheen (fabric, skin) and brushed /
  smudged roughness on metals; **GTAO** (half resolution, computed by
  `GTAOPass` without swapping, multiplied into the grade pass; glowing
  pixels stay bright) while the crystal age is on and shadows are enabled.
- **Aging variants** (lib/world/aging.ts) are exported too: every growth /
  wilt / weather / crystal stage of every decor piece has its own grid and
  key, so the living lab keeps changing in the crystal age.
- First "ultra" attempt (cell 0.125, 24 tris / voxel everywhere): 32 M
  triangles, 15 fps in the Control Room (headless) — reverted to the
  budgets above.

## 3. Engine

### 3.1 Library (`lib/world/render/crystal.ts`)

`CrystalLibrary` fetches the manifest once, loads GLBs on demand
(`GLTFLoader` + `MeshoptDecoder`), de-quantises them into float position /
normal / colour, bakes the node transform and groups the primitives by
surface slot (`CRYSTAL_SLOT_BASE + slot`, i.e. after the four voxel
classes). `materialsFor(voxelArray)` extends a voxel material array with
the 24 crystal slots: emissive surfaces reuse the array's own `emit`
(pulse parts keep their glow material and bloom tuning), transmissive ones
its `glass`, the rest are shared `MeshStandardMaterial`s with world-space
micro relief — or triplanar library normal / roughness maps from
`public/crystal/textures/<surface>/`.

### 3.2 Swap (`LabEngine`)

- `VoxelSrc` gains `crystal` + `voxelMats`. `needsRemesh(src, tier)` is
  true when the voxel divisions differ **or** the crystal state does
  (`wantsCrystal`: crystal age on, manifest has the grid, no custom
  `materialOf`).
- `startRemesh` / `stepRemesh` handle both: crystal geometry when wanted
  and loaded (else retried later), voxel mesh at the current tier
  otherwise — nearest to Jade first, so the crystallisation spreads from
  her with the era wave.
- Merged decor (`fixedSrc`) swaps its part geometry; the static batcher
  and the terrain carry the crystal slots in their material arrays
  (unused groups cost nothing), the auto-instancer keys on geometry +
  materials as before.
- Terrain: `WorldRenderer.setCrystal(lib, materials)`; `rebuild` uses the
  chunk's crystal model when its `terrainChunkKey` is in the manifest,
  translated to the box origin; loading chunks show voxels until
  `sync()` sees them ready.
- Crystal geometries are shared by the library (`userData.crystal`) and
  never disposed by the swap.

### 3.3 Dev handles

- `__lab.engine.debugCrystal(true | false | null)` — force / follow
- `__lab.engine.crystalStats()` — on, manifest size, crystal / voxel
  meshes and terrain chunks on this floor, loads in flight
- `__lab.engine.remeshBusy()` — includes crystal loads and chunks
- `__lab.engine.debugClarity(41)` — the last era

## 4. Tooling

| Command                 | What                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm crystal:export`   | inventory + dumps (`--no-terrain`, or id prefixes)                                          |
| `pnpm crystal:build`    | build changed models (`--only`, `--force`, `--previews`, `--workers`, `--limit`, `--adopt`) |
| `pnpm crystal:library`  | scan the material library → `.crystal/library/catalog.json`                                 |
| `pnpm crystal:textures` | export bound library maps → `public/crystal/textures/`                                      |
| `pnpm crystal:blender`  | open Blender with the MCP bridge                                                            |
| `pnpm crystal:mcp`      | run the MCP server by hand (normally started via `.mcp.json`)                               |
| `pnpm crystal:assemble` | whole-figure crystal stills of every bot (`.crystal/assembled/`)                            |
| `pnpm crystal:doors`    | every door through all 42 eras + crystal age in Blender (`.crystal/doors/`, docs/DOORS.md)  |

`--previews` renders a Cycles still per model and writes a contact sheet
to `.crystal/previews/index.html`.

### 4.1 MCP server `crystal` (`scripts/crystal/mcp/`)

`server.py` (PEP 723, `uv run --script`, mcp 1.x) exposes 19 tools: status
/ find, live Blender (`blender_open`, `crystal_load`, `crystal_render`,
`blender_screenshot`, `blender_exec`), headless `crystal_preview`, config
(`crystal_config`, `crystal_set_surface`, `crystal_bind`,
`crystal_set_profile`, `crystal_override`), library (`library_scan`,
`library_search`, `library_assign`, `library_textures`) and builds
(`crystal_export`, `crystal_build`).

`bridge.py` runs inside Blender: a socket on **127.0.0.1 only**, every
request carries the random token from `.crystal/bridge.json` (mode 0600,
rewritten on every start); commands run on Blender's main thread via
`bpy.app.timers`. It executes Python by design — never expose the port.

### 4.2 Material library

Roots: `$CRYSTAL_LIBRARY` (path-separator list) or
`.crystal/library/roots.json` — machine-specific, never committed (the
catalog holds absolute paths). Recognised: texture sets in PolyHaven /
ambientCG / Quixel / Poliigon naming (albedo, normal GL or DX, roughness,
AO, metal, height), HDRIs (`.hdr` / `.exr`), and `.blend` materials
(`library_scan(blend=true)`). Engine textures are exported at 1024²
(normal + roughness; albedo only with `texAlbedo`) and committed with the
GLBs.

## 5. Numbers (M1 Max)

| What                          | Value                                             |
| ----------------------------- | ------------------------------------------------- |
| Unique grids / terrain boxes  | ≈ 864 / 630                                       |
| Full build, 5 Blender workers | ≈ 7 min (models ≈ 2.5 min, terrain ≈ 5 min)       |
| Output                        | ≈ 160 MB GLB (meshopt), ≈ 15 M triangles in total |
| Control Room, crystal on      | ≈ 2.4 M triangles drawn, 280 draw calls           |

Headless numbers are indicative; measure on target hardware with
`__lab.engine.debugStats()`. Size levers: terrain `cell` / `planar`,
`trisPerVoxel`, and shipping the GLBs outside the git history (LFS /
release asset / CDN) — see open items.

## 6. Open items

- **Distribution:** ≈ 160 MB of GLBs — decide git LFS vs. release asset /
  CDN before committing them (desktop builds bundle `public/`).
- **Crystallisation moment:** the swap rides the era-42 wave; a scripted
  cinematic (`scenes.ts`) and a toast are still to write.
- **Look-dev with the real library:** bindings and profiles are first
  guesses; tune them with the skill once the library is scanned.
- **Colour borders** follow triangles (≈ ¼ voxel). A per-model base-colour
  bake would make them razor-sharp — only if the look asks for it.
- **Title diorama** still meshes its own grids (not swapped yet).

## 7. Files

| Area     | Files                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Rules    | `lib/world/crystal.ts`, `lib/world/clarity-mode.ts` (`CRYSTAL_MODES`), `lib/world/settings.ts`                          |
| Engine   | `lib/world/render/crystal.ts`, `lib/world/render/engine.ts`, `lib/world/render/world-renderer.ts`                       |
| Pipeline | `scripts/crystal/{export,build,door-parts,doors}.ts`, `scripts/crystal/blender/**`, `scripts/crystal/config/*.json`     |
| Tools    | `scripts/crystal/mcp/{server,bridge}.py`, `scripts/crystal/library/scan.py`, `scripts/crystal/blender.mjs`, `.mcp.json` |
| Output   | `public/crystal/{manifest.json,models/,textures/}`                                                                      |
| Tests    | `tests/world/crystal.test.ts`, `tests/world/door-crystal.test.ts`                                                       |
| Skill    | `.claude/skills/crystal/SKILL.md`                                                                                       |
