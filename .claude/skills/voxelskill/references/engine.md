# Voxel engine reference (template architecture, algorithms, Three.js r186)

Contents: 1 Module map · 2 Data model · 3 Meshing & AO · 4 Chunks & editing · 5 Physics & picking ·
6 Rendering with Three.js · 7 Performance budgets · 8 Extending · 9 Pitfalls (verified)

## 1. Module map (`assets/template/src`, alias `@/` = `src/`)

| Module | Responsibility | Depends on |
|--------|----------------|------------|
| `voxel/palette.ts` | 256-entry sRGB palette, hex import, `linear()` | — |
| `voxel/grid.ts` | `VoxelGrid` dense volume, `VoxelSource` interface, `Vec3` | — |
| `voxel/world.ts` | `VoxelWorld` chunked (32³) Y-up world, dirty tracking | grid |
| `voxel/mesher.ts` | `greedyMesh()` greedy quads + AO + material groups | grid, palette |
| `voxel/raycast.ts` | `raycastVoxels()` Amanatides–Woo DDA | grid |
| `voxel/collision.ts` | `moveBox()` / `overlapsSolid()` swept AABB | grid |
| `vox/*` | `.vox` parse / write / scene graph → Y-up grid | voxel |
| `render/voxel-mesh.ts` | MeshData → `BufferGeometry`, shared materials, MATL mapping | three |
| `render/vox-object.ts` | `.vox` file → one baked `THREE.Mesh` (`anchor`) | vox, mesher |
| `render/world-renderer.ts` | one mesh per chunk, budgeted re-meshing | world, mesher |
| `render/cameras.ts` | `CameraRig`: perspective / iso / dimetric / topdown | three |
| `iso/iso-baker.ts` | CPU pixel-art iso sprites (no WebGL) | grid, palette |
| `tilemap/tilemap.ts` | ASCII tile maps → voxel columns, BFS pathfinding | world |
| `procgen/*` | seeded PRNG, value noise, fBm, island generator | world |
| `level/level.ts` | JSON level → world + props + collision | all |
| `game/*` | `Input` (KeyboardEvent.code), `Player` kinematic controller | collision |
| `main.ts` | bootstrap, loop, HUD, block editing, `window.game` (dev only) | all |

Keep the layering: `voxel/` and `vox/` never import `three` — they run in tests, workers and Node.

## 2. Data model

- Palette index per voxel (`Uint8Array`), 0 = empty. Colors live in the palette, materials are
  derived per index (`materialOf(index) → 'solid' | 'glass' | 'emit' | 'metal'`).
- Game world is **Y-up**, integer voxel coordinates, voxel `(x,y,z)` spans `[x, x+1)` etc.
  One voxel = one world unit (scale the root object if you need smaller voxels).
- `.vox` models stay Z-up until `sceneToGrid()` bakes them (see `vox-format.md` §5).
- Writes out of bounds: `VoxelGrid.set()` **throws**, `VoxelWorld.set()` **silently ignores** (edits at
  the level edge are harmless). Check `inBounds()` when code must work with both.
- Anything that reads voxels takes a `VoxelSource` (`get(x,y,z)`, 0 outside) — grids, worlds
  and composites (`level.solids` = terrain ∪ prop collision) are interchangeable.

## 3. Meshing & ambient occlusion (`greedyMesh`)

1. For each axis `d` and direction ±1, sweep slices; build a 2D mask of **visible faces**:
   voxel non-empty and neighbour empty, or neighbour transparent with a different index.
2. Per face compute 4 corner AO levels from the 3 neighbours in the outside layer
   (`side1 && side2 ? 0 : 3 - (side1 + side2 + corner)`).
3. Mask key = `colorIndex | aoBits << 8`. Merge equal keys greedily (widest run, then grow rows).
   Equal AO in the key prevents AO from smearing over merged quads.
4. Split quads along the brighter diagonal (`ao0+ao2 < ao1+ao3` → use 1–3) to avoid AO streaks.
5. Colors: `palette.linear(index) × aoCurve[level]` baked into vertex colors.
6. Output is grouped by material class → one draw call per class per mesh.

Samples outside the meshed box are read from the source, so chunk borders cull and shade correctly.
Costs: a solid 8³ cube = 6 quads; worst case (checkerboard) = 6 quads per voxel.

## 4. Chunks & editing

- `VoxelWorld` allocates 32³ `Uint8Array` chunks lazily; `set()` marks the chunk and touching
  neighbours dirty (faces + AO depend on neighbours).
- `WorldRenderer.sync(budget)` re-meshes ≤ `budget` dirty chunks per frame; `syncAll()` after
  bulk generation. It disposes old geometry — materials are shared, dispose them once.
- For huge edits (explosions) batch `set()` calls, then `sync()` once.
- Save/load: serialize chunk arrays (`chunkKeys()` + data) or bake to `.vox` with `writeVox()`
  (≤ 256 per axis per model → split into 256³ models).

## 5. Physics & picking

- `moveBox()` resolves Y, then X, then Z against solid voxels and snaps flush (ε = 1e-4).
  Keep per-call movement < 1 voxel; `Player.update` sub-steps to ≤ 0.5.
- `Player`: 0.6 × 1.7 AABB, gravity 28, jump 8.5, auto step-up 1 voxel. Fixed 60 Hz step
  with an accumulator in `main.ts` (clamped at 0.25 s to survive tab switches).
- `raycastVoxels()` visits every crossed cell in order; `hit.voxel + hit.normal` is where to place.
  Works for orthographic cameras too (ray origin far away → pass a large max distance).
- Non-voxel objects (enemies, pickups): keep their own AABBs; use `overlapsSolid` for terrain checks.

## 6. Rendering with Three.js (r186)

- `WebGLRenderer({ antialias: true })`, `renderer.setAnimationLoop(fn)`, pixel ratio ≤ 2.
- Lights: `HemisphereLight` (sky/ground fill) + one `DirectionalLight` with shadows sized to the level
  (`shadow.camera` left/right/top/bottom = level half-extent). Voxel meshes cast + receive.
- `scene.environment` from `PMREMGenerator(renderer).fromScene(new RoomEnvironment())` —
  required or metal voxels render black.
- Materials: `MeshStandardMaterial({ vertexColors: true })` per class; glass
  `transparent, opacity ~0.45, depthWrite: false`; emit `MeshBasicMaterial` (+ `UnrealBloomPass`
  from `three/addons/postprocessing/` for glow).
- Many copies of one prop → `THREE.InstancedMesh(geometry, materials, count)` + `setMatrixAt`.
- Addons import path: `three/addons/...` (e.g. `three/addons/environments/RoomEnvironment.js`).
- Stylized look: flat vertex colors + AO already give the MagicaVoxel look; add fog
  (`scene.fog = new THREE.Fog(color, near, far)`) and a warm sun for dioramas.

## 7. Performance budgets (desktop browser, 60 fps)

| Item | Budget |
|------|--------|
| Draw calls | < 300 (chunks × material classes + props) |
| Triangles | < 1–2 M |
| Re-mesh per frame | 1–4 chunks of 32³ (~1–3 ms each) |
| Level size (dense diorama) | ≤ 256 × 128 × 256 voxels |
| Shadow map | 2048², one directional light |

Measure with `renderer.info.render` (`calls`, `triangles`) — `window.game.renderer` in dev.
Move meshing to a Web Worker (`voxel/` has no DOM deps) when edits cause frame drops.

## 8. Extending (patterns that fit the template)

- **Entities**: plain classes with `update(dt)` + a `THREE.Object3D`; keep an array in `main.ts`
  or a small `game/world-state.ts`. Composition over inheritance.
- **Triggers/doors/pickups**: AABB overlap tests against `player.box`.
- **NPC movement on tile maps**: `findPath()` → move tile by tile.
- **Day/night**: animate sun direction + hemisphere colors; emissive voxels unaffected by lighting.
- **Destruction**: `world.set(…, 0)` in a sphere, spawn small cubes as `InstancedMesh` debris.
- **Save games**: `localStorage` with chunk data base64-encoded, or download a `.vox`.

## 9. Pitfalls (each verified against three 0.186 / Vite 8 / TS 5.9)

- `THREE.PCFSoftShadowMap` was removed — use `PCFShadowMap` (runtime warning otherwise).
- `new ImageData(data, w, h)` needs `Uint8ClampedArray<ArrayBuffer>` in current DOM typings.
- `requestAnimationFrame` / `setAnimationLoop` pause in hidden tabs — automated browser tabs
  are often hidden; step `window.game.player.update(...)` manually when testing.
- `noUncheckedIndexedAccess`: indexing a `Vec3` with a variable yields `number | undefined` — use `!`
  on reads and `a[i] = a[i]! + x` instead of `+=`.
- Palette colors must be converted sRGB → linear before going into vertex colors.
- Top-level `await` in `main.ts` is fine with Vite's default build target.
