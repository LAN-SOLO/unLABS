# Clarity engine — from big blocks to crystal clear

> The USP of \_unLABS: Jade Lawrence wakes up in a world of **big voxel
> blocks**. Everything she finds, invents, builds, optimises, combines and
> discovers makes the lab a little clearer — over **42 eras** the voxels keep
> splitting (1 → 2 → 4 → 6 → 8 cubes per voxel edge) until, when
> _everything_ is done, they are so small the lab reads almost as a render.
> It stays voxels all the way. Jade herself is never voxels: she is the one
> real thing in the lab from the first second.

This document is the technical reference. Related: [`HERO.md`](HERO.md)
(the realistic characters), [`NATIVE.md`](NATIVE.md) (desktop builds).

---

## 1. Concept

| Idea                        | Implementation                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------- |
| The world starts as blocks  | Source voxels only, muted colour grade                                              |
| Clearer = smaller voxels    | Voxels split again every chapter (`fineGrid`: shaped sub-voxels)                    |
| Progress = understanding    | 17 weighted progress categories → one score 0..1                                    |
| Very long game, small steps | 42 eras (7 chapters × 6), every knob a smooth curve                                 |
| "Perfect" only at 100 %     | Era 42 needs **every** category complete (same checklist as the completionist test) |
| Jade is real                | Hero layer drawn after the grade pass, full resolution, never graded                |
| A moment per era            | Toast + a ring of light spreading from Jade                                         |

## 2. Rules (`lib/world/clarity.ts`, pure)

### 2.1 Progress categories

Weights sum to 1. Each category returns `done(state) ∈ [0, 1]`.

| Group               | Category       | Weight | Counts                            |
| ------------------- | -------------- | -----: | --------------------------------- |
| Built               | `built`        |   0.18 | device stages built / all stages  |
| Built               | `discovered`   |   0.04 | devices discovered                |
| Invented / combined | `recipes`      |   0.12 | recipes known (exact output)      |
| Invented            | `insights`     |   0.08 | insights                          |
| Invented            | `research`     |   0.05 | research topics finished          |
| Found               | `pickups`      |   0.07 | pickups taken (ever)              |
| Found               | `slices`       |   0.05 | slices of crystal #0089 (of 30)   |
| Found               | `notes`        |   0.04 | notes read                        |
| Found               | `puzzles`      |   0.07 | puzzles solved                    |
| Optimised           | `firmware`     |   0.06 | lab firmware updates flashed      |
| Optimised           | `hubs`         |   0.03 | hubs with at least one link       |
| Discovered          | `achievements` |   0.06 | achievements                      |
| Discovered          | `endings`      |   0.05 | endings (incl. secret `kristall`) |
| Discovered          | `bots`         |   0.04 | lore bots reactivated             |
| Discovered          | `doors`        |   0.02 | doors open                        |
| Discovered          | `rooms`        |   0.02 | rooms visited                     |
| Discovered          | `dialogue`     |   0.02 | dialogue options said             |

The list mirrors `tests/world/simCoverage.ts` (`coverage()`), so the
simulated completionist reaches **exactly** 1.0 — `tests/world/clarity.test.ts`
asserts it.

### 2.2 Score

```
raw   = Σ weight_c · done_c(state)
base  = raw(initialState())          // starter devices, open doors
score = all categories complete ? 1 : min(0.9995, (raw − base) / (1 − base))
```

A fresh game is 0; one missing item keeps the world out of the last era.

### 2.3 Eras

`ERA_THRESHOLDS[i] = 0.985 · (i / 41)^1.1` for i < 41, and `1` for era 42.
`eraOf(score)` = last threshold reached. Inside an era the look drifts up to
60 % of the way to the next era (`level = era + eraT · 0.6`), so every
invention is visible and the era change stays a moment.

| Chapter | Eras  | Voxels (models / terrain) | Names                                                                                        |
| ------- | ----- | ------------------------- | -------------------------------------------------------------------------------------------- |
| 1       | 1–6   | 1× / 1×                   | Block Dawn · Cold Cubes · First Flicker · Blocky Shadows · Muted Colours · Coarse Grain      |
| 2       | 7–12  | 2× / 2×                   | First Split · Half Cubes · Edges Appear · Seams and Rivets · Warmer Colours · First Focus    |
| 3       | 13–18 | 2× / 2×                   | Steady Cubes · Fine Grain · Deep Palette · Shape Memory · Worn Edges · Steady Sight          |
| 4       | 19–24 | 4× / 2×                   | Second Split · Quarter Cubes · Rounded Edges · Surface Grain · True Reflections · Near Sight |
| 5       | 25–30 | 4× / 4×                   | Soft Light · Material Truth · Quiet Screens · Deep Shadows · Fine Detail · Clear Glass       |
| 6       | 31–36 | 6× / 4×                   | Third Split · Soft Contours · Living Light · Polished Steel · Clean Air · Almost Real        |
| 7       | 37–42 | 8× / 4×                   | Grains of Sand · Thin Veil · Last Grain · Final Polish · Pure Light · Crystal Clear          |

"Halving every era" literally would mean 2⁴² — the voxels split at chapter
boundaries instead (three halvings plus the 6× step); inside a chapter the
colour, materials, light and CRT grain carry the per-era change.

German names: `lib/i18n/de/clarity.ts`.

### 2.4 Look curves (`paramsAt(level)`, t = level / 41)

| Knob         | Curve                                            | Where it acts                                                   |
| ------------ | ------------------------------------------------ | --------------------------------------------------------------- |
| `mesh`       | 1× (eras 1–6) · 2× (7–18) · 4× (19–30) · 6× · 8× | model voxel divisions (`MESH_TIER_ERAS`)                        |
| `terrain`    | 1× (1–6) · 2× (7–24) · 4× (25–42)                | floors and walls (`TERRAIN_TIER_ERAS`)                          |
| `saturation` | 0.62 → 1.05                                      | grade pass (world only)                                         |
| `contrast`   | 0.86 → 1.04                                      | grade pass                                                      |
| `detail`     | 0 → 1 (0.25 … 0.97)                              | voxel materials: mottling, roughness, micro relief              |
| `crt`        | 1 → 0 (0.3 … 1)                                  | CRT grain / scan band — both off since 2026-10-01 (read as fog) |
| `env`        | 0.35 → 1.3                                       | image-based lighting intensity                                  |

The setting `graphics.voxelDetail` (4 / 6 / 8, from the graphics preset)
caps the model divisions; the terrain reaches 4× only from voxel detail 6.

## 3. Rendering

### 3.1 Composer chain (`LabEngine`)

```
RenderPass (world; hero layer excluded)
  → ClarityGradePass   colour grade, NaN guard, era wave ring, depth copy
  → HeroPass           Jade (layer 5) at full resolution, depth-tested against
                       the world depth, stencil for her X-ray twin
  → UnrealBloom → CRT → Output
```

- No pixelation, posterising or dithering: clarity comes from the voxels.
- The composer target carries a `DepthTexture` (depth + stencil,
  `clarityRenderTarget`); the grade pass copies the depth with
  `gl_FragDepth` so the hero pass can test against the world.
- Lights are enabled on the hero layer every 0.5 s (floors add lights);
  the lantern is excluded — Jade gets her own softer fill light.
- Hero meshes are also on `SHADOW_LAYER`: she casts real shadows into the
  voxel world; the world pass's shadow map is reused for the hero pass.
- NaN/Inf colours are replaced in the grade pass (bloom would smear one NaN
  over the whole frame).

### 3.2 Voxel divisions (`refinedModelMesh(grid, family, { tier })`)

| Tier | Mesh                                                                |
| ---: | ------------------------------------------------------------------- |
|   1× | greedy cubes on the source grid                                     |
|   2× | greedy cubes on the 2× refined grid (bevels, seams, rivets, LEDs …) |
| 4–8× | the refined grid split again into 2–4 shaped sub-voxels per voxel   |

`lib/voxel/fine-grid.ts` (`FineSampler`, `fineGrid`, `fineMesh`): a sharp
blurred occupancy field ([1 12 1] per axis) is sampled at every sub-voxel
centre near the surface — flat faces stay exactly in place, convex edges
get a small rounded bevel, staircases fill towards their plane, so the
cubes approach the true form with every split. Thin parts (nothing on both
sides along an axis), screens, LEDs and glass stay whole blocks; interior
and empty space is copied wholesale. Big models are meshed in blocks of 16
voxels (bounded memory). Terrain chunks split the refined chunk (with a
1-voxel ring) the same way.

**Workers and live switching.** Tiers ≥ 4 are meshed by a pool of Web
Workers (`lib/world/render/fine-mesh-pool.ts`, `fine-mesh.worker.ts`; a
big device takes seconds at 8×). Until a fine mesh arrives the model shows
the 2× mesh. Every model mesh remembers its voxel source and tier in a
`WeakMap` (`VOXEL_SRC`); on a tier change the floor's meshes are queued
**nearest to Jade first** and swapped as the workers deliver; the static
batcher and auto-instancer pick up the new geometry, merged decor re-merges
once all its parts are fine. The model mesh cache is LRU with a 192 MB
budget.

### 3.3 The era moment

- `noteClarityEra(state)` (called in `useWorld.act`) → toast
  "The world sharpens — era n of 42: Name"; the counter `clarity_era`
  keeps it once per save.
- The engine sees the level cross an integer and starts a 2.8 s **era
  wave**: a thin bright ring grows from Jade's head over the screen.
  Materials, light and voxel divisions switch as the wave starts (the fine
  meshes then spread out from Jade as the workers deliver them).

## 4. Settings

`graphics.clarity`: `story` (default) · `clear` (always crystal clear —
accessibility, photo mode) · `pixel` (always era 1, "always blocky"; the id
stays `pixel` for old settings).
`graphics.voxelDetail`: 4 · 6 · 8 — finest voxel division (preset low 4,
medium 6, high/ultra 8).
`graphics.realJade`: realistic Jade on/off (off = voxel Jade; next load).

## 5. Performance (M1 Max, headless Chrome, 1400×900, Control Room)

| Era | Voxels (models / terrain) | Triangles | FPS (60 cap) |
| --: | ------------------------- | --------: | -----------: |
|   1 | 1× / 1×                   |    0.48 M |          ~50 |
|   9 | 2× / 2×                   |    0.85 M |          ~46 |
|  21 | 4× / 2×                   |    1.61 M |          ~38 |
|  33 | 6× / 4×                   |    2.77 M |          ~40 |
|  42 | 8× / 4×                   |    4.26 M |          ~30 |

Meshing every device and decor model once (single thread): 2× 1.7 s,
4× 13 s, 6× 26 s, 8× 51 s — spread over the workers and only for the
floor in view. Headless numbers are indicative only; measure on target
hardware with `__lab.engine.debugStats()`.

## 6. Dev handles & tests

- `__lab.engine.debugClarity(level 0..41 | null)` — pin a level
- `__lab.engine.debugEraWave(from, to)` — play the era wave
- `__lab.engine.remeshBusy()` — models / chunks still being re-meshed
- `__lab.engine.clarity()` — current level, goal, look, hero on/off
- `/studio` (dev only) — hero photo studio
- Tests: `tests/world/clarity.test.ts` (42 eras, weights, monotone curves,
  voxel splits at chapter starts, completionist reaches era 42 exactly),
  `tests/world/fine-voxels.test.ts` (flat faces, bevels, thin parts, block
  meshing), `tests/sculpt/*` (surface nets for the hero), `tests/world/hero-*`, `tests/world/damien-*`.

## 7. Files

| Area      | Files                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Rules     | `lib/world/clarity.ts`, `lib/world/clarity-mode.ts`, `lib/i18n/de/clarity.ts`                                                      |
| Passes    | `lib/world/render/clarity-pass.ts` (grade + hero), `lib/world/render/crt-pass.ts`                                                  |
| Engine    | `lib/world/render/engine.ts` (`stepClarity`, `startRemesh`, `stepRemesh`, `installHero`, `recolorHero`)                            |
| Meshing   | `lib/voxel/fine-grid.ts`, `lib/world/models/refine.ts`, `lib/world/render/fine-mesh-pool.ts`, `lib/world/render/world-renderer.ts` |
| Materials | `lib/world/render/voxel-mesh.ts` (`VOXEL_CLARITY`)                                                                                 |
| UI        | `components/world/useWorld.ts` (era toast), `components/world/menu/SettingsPanel.tsx`                                              |
