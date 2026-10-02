# Voxel God — the game's voxel engine, cloned in Blender

Blender holds **exact voxel clones** of the game's models. Every voxel is
there, the inside included, on the same lattice, in the same palette colour.
This is the base for building more complex devices: author in Blender at any
voxel size, combine sizes exactly, and bring the result back into the game.
It stays 100 % voxels throughout.

> **Not the crystal age.** Nothing here smooths, remeshes or bakes a surface.
> The lab stays voxels only (decision 2026-10-02, `docs/CLARITY.md`). Blender
> is a voxel tool here, not a surface tool.

**Proven 1:1 (first run, 2026-10-02):**

- 99 models: 39 devices, 58 doors, the airlock and the book's door frame.
- 99 / 99 are **voxel-exact**: the clone's volume, read back from Blender,
  has the same `sha` as the game grid.
- 99 / 99 are **pixel-exact**: Blender's iso render matches the game's iso
  baker with 0 differing pixels.
- 683 / 683 assembly parts are exact.
- The game references themselves are byte-identical to the undevbook's
  pictures (40 / 40 the book shows).

## Commands

| Command               | What it does                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm voxel:export`   | game → `.voxel/` (uvox files, references, palette, cross-language fixtures)               |
| `pnpm voxel:verify`   | clone every model, read it back, render the iso and compare; saves `.voxel/blend/*.blend` |
| `pnpm voxel:selftest` | Python ops vs TypeScript (bit-identical) plus every UI operator driven headless           |
| `pnpm voxel:beauty`   | lit Cycles views from 7 sides plus a voxel cutaway → `.voxel/blender/beauty/<id>/`        |
| `pnpm voxel:gallery`  | `.voxel/index.html`: book, clone, views and numbers per model                             |
| `pnpm voxel:blender`  | open Blender with the add-on (`pnpm voxel:blender devices` loads the device library)      |

- Options: `pnpm voxel:export CDC-001,d_mcp` exports only those ids;
  `node scripts/voxel/blender.mjs verify --only …` and `beauty --only … --samples N --size N`
  restrict a run.
- Blender comes from `$BLENDER` or `/Applications/Blender.app` (5.1).
- `.voxel/` is gitignored and is rebuilt by the commands above.

## Data flow

```
game models (TypeScript, lib/world/models/**)
  │ scripts/voxel/export.ts
  ├── devices: composeVisual(v, 0, powered) → refineModel(…, "device")      = the book's picture
  ├── doors:   doorAssembly(def) → refined parts, placed like DoorSystem    = the engine's door
  ▼
.voxel/models/**.uvox.json · .scene.json   (+ ref/*.png from the game's iso baker)
  │ scripts/voxel/blender/voxelgod
  ├── build.clone → shell (one quad per exposed voxel face) + .vox volume (one vertex per voxel)
  ├── build.read_back(volume) → uvox → sha == game sha            (voxel-exact, inside too)
  ├── iso.render_iso → Workbench flat, no AA → outline + trim → == reference (0 px)
  ▼
edit / combine / author in Blender → export uvox → lib/world/models/uvox-model.ts → Model
```

## The uvox format (`lib/voxel/uvox.ts`, `voxelgod/uvox.py`)

- Fields: `size`, `unit` (world units per voxel edge), `origin` and `anchor`
  (placement: `world(p) = origin + Ry(rotY)·((p − anchor)·unit)`), `rotY`,
  `palette` (every used game index with its rgb, material class and name),
  `runs` (RLE over cells, x fastest) and `sha`.
- Cell values are **game palette indices**, so a clone never re-quantises a
  colour.
- `sha` = two FNV-1a lanes over the header and the raw cells. It is
  identical in TypeScript and Python and runs in the browser, so the game can
  load uvox too.
- `uvox-scene` = several placed models (door assemblies).

## Exactness, step by step

1. **Composition.** `lib/world/models/compose.ts` is the undevbook's
   `compose`, moved into the game. Rig parts go through their pose
   voxel-centre by voxel-centre and are floored onto the base lattice. The
   references from it equal the book's PNGs byte for byte.
2. **Clone.**
   - **Volume:** the `.vox` object is the truth; every voxel is a vertex at
     its centre with `pal`.
   - **Shell:** one quad per exposed face in Blender axes (game x, y, z →
     Blender x, −z, y). Face attributes are `voxel`, `pal` and `dir`; corner
     colours are `Col` and `Iso`; there is one material slot per class.
   - **Placement:** the object matrix applies the uvox placement, so Blender
     units equal world units. Secret door leaves keep the engine's 0.98 z-scale.
3. **Iso picture.** The baker's projection is linear with kernel (1, 1, 1):
   - Faces are laid out directly in pixel space, with depth = x + y + z
     (painter's order). The camera sits just above the deepest voxel, because
     a far camera loses depth precision and gives wrong winners.
   - Workbench renders with FLAT lighting, attribute colour, no AA, Standard
     view and no dither.
   - Face shading is top 1, +z 0.78, +x 0.6, rounded like `Uint8ClampedArray`
     (half to even).
   - With an even pixel scale, no face edge passes through a pixel centre,
     so rasterisation equals the baker's stamp.
4. **Assemblies.** Every placed part is cloned and checked on its own. The
   snapped single-grid version (`doors/<id>.uvox.json`) is for pictures only;
   the scene is the engine's exact placement.

## Voxels at every size (`voxelgod/ops.py`, mirrored in `lib/voxel/uvox.ts`)

| Operation                     | Exact?                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| `upsample(k)`                 | yes: every voxel → k³, unit ÷ k                              |
| `rotate_y90`, `mirror`        | yes, and lossless both ways                                  |
| `combine(parts, unit)`        | yes, or it refuses (see below)                               |
| `subtract(model, cutter)`     | yes (same lattice rules)                                     |
| `box`, `cylinder`, `sphere`   | yes: voxels whose centre is inside, deterministic, symmetric |
| `voxelize_object(mesh, unit)` | yes: cells whose centre is inside a closed mesh (ray parity) |
| `paint`, `recolor`            | yes, game colours only                                       |
| `downsample(k)`               | **lossy** (majority per k³ block); the only lossy op         |
| `refit`                       | crops to the filled box; voxels stay put                     |

`combine` mixes voxel sizes on the finest lattice. Every unit must be an
integer multiple of the target unit, and every corner must sit on the
lattice. Otherwise it raises: nothing is resampled or rounded. That is how
fine detail is mounted on coarse bodies without losing a voxel.

`selftest` checks the TypeScript and Python versions of every operation
against each other on real models (CLK-001 at 0.5, CDC-001 at 0.25 mounted
at (1.75, 0.5, −0.25)).

## Blender UI (`voxelgod/addon.py`, 3D View › Sidebar › **Voxel**)

| Group       | Operators                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| In / out    | Import uvox (model or scene), Export uvox (reads the volume)                                                              |
| Edit        | **Snap volume** (centres onto the lattice, one per cell, grid grows), **Rebuild shell**, **Paint selected** (game colour) |
| Size & form | Up ×k (exact), Down ×k (majority), turn 90°, mirror x / y / z, **Combine** (exact, the active clone wins overlaps)        |
| Create      | Box, cylinder or sphere in a game colour at any voxel size; **Voxelize** a closed mesh                                    |

**Editing a voxel:**

1. Enter Edit Mode on `<id>.vox`.
2. Duplicate, move or delete vertices. A vertex is a voxel.
3. Run **Snap volume** and then **Rebuild shell**.

**Colours:** paint selected vertices with **Paint selected**. Colours come
only from the game palette (`.voxel/palette.json`).

## Back into the game

```ts
import { modelFromUvox } from "@/lib/world/models/uvox-model";
const { model, scale, fine } = modelFromUvox(json); // fine: mesh as authored (family "hires")
```

The loader checks every palette entry against the game palette and refuses
on any mismatch.

## Files

| Area        | Files                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| Format, ops | `lib/voxel/uvox.ts`, `scripts/voxel/blender/voxelgod/uvox.py`, `voxelgod/ops.py`                                  |
| Game side   | `lib/world/models/compose.ts`, `lib/world/models/uvox-model.ts`                                                   |
| Export      | `scripts/voxel/export.ts`, `scripts/voxel/door-parts.ts` (keep in sync with `DoorSystem`), `scripts/voxel/png.ts` |
| Blender     | `scripts/voxel/blender/voxelgod/{build,iso,beauty,addon}.py`, `scripts/voxel/blender/{cli,open}.py`               |
| Runner      | `scripts/voxel/blender.mjs`, `scripts/voxel/gallery.mjs`                                                          |
| Tests       | `tests/voxel/uvox.test.ts`; `pnpm voxel:selftest` (Blender)                                                       |
| Skill       | `.claude/skills/voxel-blender/SKILL.md`                                                                           |
