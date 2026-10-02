---
name: crystal
description: Crystal pipeline of _unLABS — turns the game's voxel models and terrain into real, rendered surfaces with Blender (headless + live via the `crystal` MCP server) and the user's material library, and ships them to the engine's crystal age (era 42). Use for look-dev of crystal models, binding palette colours to library materials, tuning shape profiles, rebuilding public/crystal, Blender renders of game models (stills, merch), or anything in scripts/crystal, lib/world/crystal.ts or lib/world/render/crystal.ts. Not for the voxel clarity eras themselves (docs/CLARITY.md) or Jade's hero sculpt (docs/HERO.md).
argument-hint: "[model, surface or look to work on]"
---

# Crystal pipeline: voxels to real surfaces

When the lab reaches era 42, the voxels give way to **real surfaces**. Every model grid the
engine meshes, and every 32³ terrain chunk, has a Blender-built twin in `public/crystal/`.
The twin is keyed by the grid's content hash. The engine swaps the twin in. Anything without
a twin stays voxels, so the pipeline can always ship partially.

The full reference is `docs/CRYSTAL.md`. Read §2 (data flow) before changing code.

## Golden rules

1. **The palette is the art direction.** Vertex colour = palette colour × baked AO × wear.
   The library adds physical truth on top: roughness, metal, relief, grunge. It never changes
   a model's hue. Albedo maps are used as luminance detail, normalised to their mean.
2. **Shape lives in profiles, never in per-model hacks.** Tune profiles in
   `scripts/crystal/config/profiles.json`. Use `overrides.json` only when one model truly needs
   something different, and say why in the override.
3. **Never touch Damien or Jade.** Damien stays veiled until `isDamienRevealed()`. Jade is the
   hero and never becomes voxels. The export never writes them. `forbiddenUse()` in
   `lib/world/crystal.ts` double-checks this, and `tests/world/crystal.test.ts` guards it. Don't
   weaken either.
4. **Keys are content hashes.** If a model's voxels change in the game sources, its key changes.
   Run `pnpm crystal:export` and then `pnpm crystal:build`. Never hand-edit manifest keys.
5. **Look first, then build.** Run a cheap `crystal_preview` / `crystal_load` on 2–3
   representative models, show the user the images, and get a yes. Only then run
   `crystal_build` over everything. A full build of about 1500 models takes about 7 min on 5
   workers. Unchanged models are cached (per-model fingerprint).
6. **pnpm only.** Blender comes from `$BLENDER` or `/Applications/Blender.app`. Python deps come
   via `uv` (PEP 723 inline scripts).

## Tools (MCP server `crystal`, .mcp.json)

| Need | Tool |
| --- | --- |
| Where things stand | `crystal_status`, `crystal_find("CDC-001")` |
| Quick look, no window | `crystal_preview(model, profile?, shape?)` → report + Cycles image |
| Live look-dev | `blender_open` → `crystal_load(model, voxels=true)` → `crystal_render` / `blender_screenshot` |
| Arbitrary Blender work | `blender_exec(code)` (bpy; set `result`) |
| Shape | `crystal_set_profile(name, props, family?)`, `crystal_override(model, profile?, shape?)` |
| Materials | `crystal_set_surface(id, props)`, `crystal_bind(color, surface, model?)` |
| Library | `library_scan(roots)`, `library_search("scratched painted metal")`, `library_assign(surface, entry)`, `library_textures()` |
| Ship | `crystal_export()`, `crystal_build(only?, previews?)` |

Use `model` arguments as use-id prefixes (`dev-CDC-001/base`, `bot-b4c0n`, `decor-lamp_desk`,
`prop-workbench`, `terrain-f0-3.0.1-lit-up`) or grid keys.

Era renders: `pnpm crystal:doors [ids] [--eras 0,18,41]` renders every door (engine voxel meshes per era tier + era look, then the crystal GLBs) — the pattern for any "show X through all 42 eras" request (`scripts/crystal/doors.ts`, `blender/doors.py`).

Without the MCP server, use the CLI equivalents: `pnpm crystal:export`,
`pnpm crystal:build [--only p,q] [--previews] [--force] [--adopt]`, `pnpm crystal:library`, and
`blender -b --factory-startup -P scripts/crystal/blender/cli.py -- build --dump … --preview …
--shape '{…}'`.

## Look-dev loop

1. **Pick representatives.** Take one device base (`dev-…/base`), one bot (`bot-…/base`), one
   decor piece, and one terrain chunk with a diagonal wall. If a palette colour is involved,
   pick models that use it (`crystal_find`).
2. **Load next to the voxels.** Run `crystal_load(model, voxels=true)`, then `crystal_render`.
   Judge silhouette first, then colour borders, then materials.
3. **Turn knobs in this order.** Test values first with the `shape` argument of
   `crystal_preview` / `crystal_load`. Persist them only after the user agrees.
   - Silhouette too blocky: raise `blur` (0.6 → 0.8). Too melted: lower it.
   - Plates and rods vanishing or cubic: `thinBlur` / `thinGain`.
   - Screens, LEDs or glass mushy: add the class or name to `sharpClasses` / `sharpNames`, and
     set `sharpBevel` ≈ 0.1–0.25.
   - Colour borders stair-stepped: raise `colorBlur`. Ragged at triangle size: lower `cell`
     (denser mesh, more tris).
   - Flat areas over-tessellated: raise `planar` (degrees).
   - Budget: `trisPerVoxel`, `maxTris`.
4. **Materials.** Run `library_search` for the surface's look and `library_assign(surface, id)`.
   Re-render. Adjust `texScale` (repeats), `texDetail` (albedo detail strength), and
   `rough` / `metal` / `relief`. Bind outlier colours with `crystal_bind`.
5. **Ship.** Run `library_textures()` if any library maps changed. Then run `crystal_build`
   (only the affected prefixes if possible). Then check in-game:
   `__lab.engine.debugCrystal(true)`, `__lab.engine.crystalStats()`, and
   `__lab.engine.remeshBusy()` → 0.

## Shape profiles (`profiles.json`)

| Mode | What it does | Use for |
| --- | --- | --- |
| `sdf` | Occupancy is blurred (σ = `blur` voxels) and the iso surface extracted with OpenVDB. Flat sides stay planar, staircases become slopes, edges round with radius ≈ σ. Sharp classes and thin parts get their own treatment. | **default:** `crystal`, `crystal_soft`, `crystal_fine`, `terrain` |
| `hard` | Voxel shell, coplanar faces merged per colour, real bevels. | Product-shot voxel look, merch |
| `remesh` | Blender voxel remesh plus relax. | Experiments |

Families map to profiles (`families`): device, prop, architecture, decor, detail, pickup and hires
use `crystal`; terrain uses `terrain`.

## Engine contract (don't break)

- GLB space = the engine's voxel mesh space: source voxel units, y up, min corner at 0. The
  engine centres it itself.
- Materials are named `crystal:<surface>`. Engine slot = 4 + index of the surface in the
  manifest's `surfaces`. Emissive surfaces reuse the voxel `emit` material (glow parts keep their
  pulse). Transmissive surfaces reuse `glass`.
- Terrain dumps are `36³` boxes (chunk + 2-voxel ring), keyed `t:<hash>`, cropped back to the
  chunk in Blender. A state that was never exported shows voxels.
- Adding a surface: add it in `surfaces.json`. Keep ≤ 24 (`CRYSTAL_SLOTS`).
- New model call sites in the engine go through `meshModel` / `sharedMesh` (CLAUDE.md). The
  crystal swap then works automatically. Add the grid to `scripts/crystal/export.ts` too.

## When something looks wrong in-game

- Shows voxels: `crystalStats()`. Then find the grid's key (`gridHash`) and check it in the
  manifest. Not there means the export is missing that grid or that state.
- Black or NaN frames: check custom shaders for unguarded `normalize` / `pow` (CLAUDE.md rule).
- Seams between terrain chunks: the ring is too small for the blur. Raise `TERRAIN_RING` in
  `lib/world/crystal.ts` **and** re-export.
- Lamp, door or cutaway state shows voxels: that state isn't exported. Extend the terrain loop in
  `export.ts`.
