---
name: voxel-blender
description: Voxel God — exact 1:1 voxel clones of _unLABS game models in Blender and a voxel production pipeline (any voxel size, exact combining, primitives, voxelize, paint, back into the game). Use for anything that shows, rebuilds, edits, combines, renders or authors devices, doors or other game models in Blender, for "more detailed devices" work, for checking that a model looks exactly like the undevbook, or for anything in scripts/voxel, lib/voxel/uvox.ts, lib/world/models/compose.ts or uvox-model.ts. Not for smooth or real surfaces — the lab is voxels only.
argument-hint: "[model id or task]"
---

# Voxel God: the game's voxels, cloned in Blender

The full reference is `docs/VOXEL-BLENDER.md`. Read its "Exactness" section
before you change anything in `scripts/voxel`.

## Golden rules (user, 2026-10-02: "keine Abweichung, kein Kompromiss")

1. **Voxels only.** Never smooth, remesh, bevel, decimate, merge across
   colours, or swap in surfaces. A clone is the lattice: one quad per
   exposed voxel face, and a volume that holds every voxel, the inside
   included. The only realistic figure in the game is Jade
   (memory: feedback-voxels-only).
2. **The game is the truth.** Clone from the game's grids (`pnpm voxel:export`).
   Never re-model a device by eye. The models are complete voxel bodies,
   inside included, and the devices are functionally complex, so keep every
   voxel.
3. **Prove it, don't claim it.** After any change to export, clone or render,
   run `pnpm voxel:export && pnpm voxel:verify && pnpm voxel:selftest`. The
   bar is 99 / 99 voxel-exact, 99 / 99 pixel-exact (0 px) and all parts
   exact. Report the numbers, never "should match".
4. **Game palette only.** Cell values are game palette indices. New colours
   go into the game palette first (`lib/world/content/palette.ts`), then
   `pnpm voxel:export` writes `.voxel/palette.json`.
   `modelFromUvox` refuses any palette mismatch.
5. **Sizes combine exactly or not at all.** `combine` needs integer unit
   ratios and corners on the lattice, and raises otherwise. Do not "fix"
   that with rounding. Move the part onto the lattice or pick a finer unit.
   `downsample` is the only lossy operation; say so when you use it.
6. **Doors:** `scripts/voxel/door-parts.ts` mirrors `DoorSystem.addDoor` /
   `applyLook`. Change both together; `tests/voxel/uvox.test.ts` checks the
   counts.

## How to

| Task                                   | Do                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| See all clones next to the book        | `pnpm voxel:verify && pnpm voxel:beauty && pnpm voxel:gallery` → `.voxel/index.html`                                                                          |
| Work interactively                     | `pnpm voxel:blender devices` (library) → sidebar **Voxel**                                                                                                    |
| One model, every side + inside         | `node scripts/voxel/blender.mjs beauty --only MFR-001`                                                                                                        |
| Script in Blender                      | `sys.path.insert(0, "scripts/voxel/blender")`, then `from voxelgod import uvox, build, ops, iso, beauty`                                                      |
| Mount fine detail on a coarse body     | `ops.combine([body, detail], unit)`; the detail's `origin` must be on the `unit` lattice                                                                      |
| New part from a shape                  | `ops.box`, `ops.cylinder` or `ops.sphere` at the target unit, or `ops.voxelize_object(mesh, unit, colour, palette)`                                           |
| Higher detail for a device             | `ops.upsample(m, k)` (exact, same look), then carve / paint / combine new fine detail; prove the untouched parts are unchanged (combine at the old unit → same sha) |
| Into the game                          | `uvox.save(m, path)`, then `modelFromUvox(json)` gives `{ model, scale, fine }` for a visual with `fine: true`                                                 |

## Gotchas

- **Axes:** game (x, y, z) maps to Blender (x, −z, y). Game +z is the front.
  `rotY` follows three.js (`Rz(+rotY)` in Blender).
- **Iso renders** need the camera close above the scene (`iso.CAM_Z`). A far
  camera loses depth precision and lets the wrong face win.
- **Blender object order:** `bpy.data.objects` is sorted by name, not by
  creation. Find clones by `uvox_id`.
- **`read_back`** reads the `.vox` volume, never the stored source. After
  manual edits, run **Snap volume** before export.
- **Doors** need the 0.98 z-scale on secret leaves (`meta.scaleZ`).
