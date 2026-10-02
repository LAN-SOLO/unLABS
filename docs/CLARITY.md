# Look & clarity — voxels only

> **Decision 2026-10-02 (user):** the lab looks like the title diorama —
> **voxels only**, every model and the terrain refined 2×, nothing smooth,
> no real surfaces. **Jade is the one exception:** she stays the realistic
> hero ([`HERO.md`](HERO.md)).
>
> Tried and removed on that day because it "looked terrible":
>
> - the era look: big source blocks at the start, voxels splitting 1 → 2 → 4 → 6 → 8
>   over 42 eras, an era colour grade, surface micro detail, the era wave
> - the crystal age: Blender-built smooth surfaces after era 42, plus its
>   pipeline (`scripts/crystal`, MCP server `crystal`, `docs/CRYSTAL.md`)
>
> Both are in the git history (commits `154b170`, `70e68cb`, `be8f76b`,
> `6d3664f`) if anyone wants to look at them again. **Do not bring them back
> without asking.**

## 1. The look (`LabEngine`)

| Knob              | Value                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Model meshing     | `refinedModelMesh(grid, family)` at tier 2 (`meshTier`, fixed) — the title diorama's meshing                             |
| Terrain           | `WorldRenderer` refined 2× (`terrainTier`, fixed)                                                                        |
| Surface detail    | `VOXEL_CLARITY.uDetail` = 0 (plain voxel materials)                                                                      |
| Grade             | `ClarityGradePass` neutral (saturation 1, contrast 1), still in the chain for the depth copy the hero pass tests against |
| Environment light | `scene.environmentIntensity` = 0.25                                                                                      |
| Jade              | `HeroPass` draws her (layer 5) after the grade, full resolution                                                          |

Composer: RenderPass → `ClarityGradePass` → `HeroPass` → bloom → CRT →
output. Model meshes register their voxel source in `VOXEL_SRC` so aged decor
(`lib/world/aging.ts`) can be re-meshed through `stepRemesh`.

## 2. Clarity score (gameplay only, `lib/world/clarity.ts`)

The score still exists. It drives the aging crystals (they grow with it) and
the counters `clarity_best` / `clarity_era`. It **does not** change the look.

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

`eraOf(score)` maps the score onto 42 eras (`ERA_THRESHOLDS`); era 42 needs
every category complete. The era names in `ERA_NAMES` are kept for the
counters; nothing shows them any more.

## 3. Files

| Area  | Files                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Score | `lib/world/clarity.ts`, `lib/world/clarity-mode.ts`, tests `tests/world/clarity.test.ts`                                                         |
| Look  | `lib/world/render/engine.ts` (`stepClarity`), `lib/world/render/clarity-pass.ts`, `lib/world/render/voxel-mesh.ts`, `lib/world/models/refine.ts` |
