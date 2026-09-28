# Levels & dioramas: format, asset pipeline, design

Contents: 1 Level JSON · 2 MagicaVoxel → game pipeline · 3 Diorama design rules · 4 Gameplay recipes

## 1. Level JSON (`public/levels/*.json`, loaded via `?level=/levels/x.json`)

```jsonc
{
  "name": "Demo Island",
  "size": [64, 32, 64],                 // world x, y (up), z in voxels
  "palette": ["#5da33c", "#8a5a35"],    // entry i = palette index i+1 (terrain only)
  "materials": { "5": "glass", "6": "emit" },   // index → solid|glass|emit|metal
  "terrain": { "type": "island", "seed": 7, "scale": 0.06, "base": 7, "amplitude": 9,
               "waterLevel": 4, "colors": { "grass": 1, "dirt": 2, "stone": 3, "sand": 4, "water": 5 } },
  //  or { "type": "tiles", "tileSize": 2, "rows": [...], "legend": {...} }   (see 2d-worlds.md)
  //  or { "type": "vox", "model": "/models/terrain.vox" }  (hand-built terrain; uses that file's palette)
  "props": [
    { "model": "/models/house.vox", "at": [30, 34], "rotY": 0 },    // [x, z] → stands on surface
    { "model": "/models/crate.vox", "at": [40, 9, 28], "solid": false }, // [x, y, z] exact
    { "model": "/models/coin.vox", "at": [20, 30], "solid": false, "id": "coin-1", "tags": ["coin"] }
  ],
  "spawn": [32, 24, 22],
  "view": "perspective"                  // perspective | iso | dimetric | topdown
}
```
- `validateLevel` checks structure; `buildLevel` generates terrain, places props (anchor
  bottom-center, `rotY` quarter turns) and stamps solid props into `level.propSolids`.
- Find props in code by tag or id, never by children order: `findProps(level, 'coin')`,
  `level.props.getObjectByName('coin-1')`; the full `PropDef` is on `mesh.userData.prop`.
- Props must not overlap each other or the spawn — check footprints: a model of size
  (sx, sy, sz) in MagicaVoxel covers `sx × sy` tiles around `at`.
- Verify a level in the browser: `window.game.level`, step physics via `window.game.player.update`.

## 2. MagicaVoxel → game pipeline

1. **One shared palette** for the whole game (save a palette `.vox` or PNG; load it into every asset).
   Mixed palettes are fine technically (each prop keeps its own), but one palette keeps the art coherent.
2. Model each prop as its own model; its bottom at z = 0, front facing −Y in MagicaVoxel
   (becomes +Z toward the default camera in the game). Name the object (`_name`) in the world editor.
3. Materials: mark glass/emit/metal in the MagicaVoxel material panel — the MATL chunk carries them.
4. Save `.vox` into `public/models/`. Inspect with `python3 ${CLAUDE_SKILL_DIR}/scripts/vox_info.py file.vox`.
5. Reference it in a level (`props`) or load in code: `voxToObject(await loadVox(url), materials)`.
6. Procedural or scripted assets: `scripts/make_vox.py --json spec.json --out x.vox` — the result
   also opens in MagicaVoxel for hand polishing.
7. Big hand-built scenes (a whole diorama) → `terrain.type = "vox"`; each model ≤ 256³,
   the scene graph positions them.

Editor details (shortcuts, export formats, limits): `magicavoxel-editor.md`.

## 3. Diorama design rules

- Readable silhouette: island/plateau with a clear edge (the island generator's radial falloff),
  or walls on tile maps. Keep playable space ≤ 96 × 96 voxels for the classic diorama look.
- Scale: player ≈ 2 voxels tall (1.7), doors 2×3–4, props 3–15 voxels. Keep one scale everywhere.
- Palette: 8–16 colors; 2–3 shades per material (light top / mid / dark), accent colors for
  interactables (keys, levers) so players spot them.
- Lighting: warm low sun + cool hemisphere fill; emissive voxels for lamps/crystals; fog to fade edges.
- Camera: `dimetric` or `iso` for dioramas, `perspective` follow for exploration. Rotate in 90°.
- Composition: a landmark visible from spawn (house, tower), a path leading to it, water or
  cliffs as natural borders, clusters of 3 props rather than even scattering.

## 4. Gameplay recipes

| Goal | How |
|------|-----|
| Collectibles | `tags: ["coin"]`, `solid: false`; each frame test `findProps(level, 'coin')` against `player.box` (mesh position ± half size), on hit remove mesh + count in HUD; spin with `mesh.rotation.y += dt` |
| Doors/switches | prop with `solid: true`; on interaction key remove its cells from `propSolids` and hide mesh |
| Goal zone / level exit | AABB check → load next `?level=` |
| Enemies patrolling | waypoint list; on tile maps `findPath`; collide with `moveBox` |
| Breakable blocks | already in `main.ts` (LMB); restrict with `materialOf` or a per-index table |
| Save progress | `localStorage` (collected ids, level) in try/catch |
| Mobile | pointer events for tap-to-move (raycast + `findPath` on tile maps) |

Every new feature: add a Vitest test for the pure logic (`voxel/`, `vox/`, `tilemap/`, game rules)
and verify in the browser; `pnpm check` must stay green.
