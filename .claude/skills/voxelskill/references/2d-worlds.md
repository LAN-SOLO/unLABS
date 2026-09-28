# 2D worlds: top-down tile maps and isometric voxel art

Two supported 2D styles, both built on the same voxel data so assets are shared:

| Style | Data | Rendering | Template code |
|-------|------|-----------|---------------|
| Top-down tile map | ASCII rows + legend | voxel columns seen by an orthographic top camera | `tilemap/tilemap.ts`, `CameraRig` mode `topdown` |
| Isometric 2.5D (live) | any voxel world | orthographic camera at iso/dimetric angle | `CameraRig` modes `iso`, `dimetric` |
| Isometric sprites (baked) | `VoxelGrid` | CPU pixel-art renderer → PNG / texture | `iso/iso-baker.ts` |

## 1. Top-down tile maps

```json
"terrain": {
  "type": "tiles", "tileSize": 2,
  "rows": ["#####", "#.~.#", "#####"],
  "legend": {
    "#": { "color": 3, "height": 4 },
    ".": { "color": 2, "top": 1, "height": 1 },
    "~": { "color": 5, "height": 1, "walkable": false }
  }
}
```
- `rows[z][x]`, row 0 = north. With `yaw = 0` the top camera shows north up.
- `tileSize` voxels per tile edge; `height` stacks voxels; `top` recolors the top voxel.
- `walkable` drives 2D logic (`isWalkable`, `findPath` BFS, 4-neighbour). Default: height ≤ 1.
- `parseTileMap` throws on ragged rows and unknown characters — keep maps rectangular.
- Pure 2D look: `topdown` camera, `rig.zoom` = visible world height; small heights (1–4) read as
  relief. Shadows give depth; disable `sun.castShadow` for a flat look.
- Tile ↔ world (live tile map): tile `(tx, tz)` center = `(tx·tileSize + tileSize/2, height, tz·tileSize + tileSize/2)`;
  world → tile = `Math.floor(x / tileSize)`. Stand an NPC on `tileAt(map, tx, tz).height` (top of the column).
- Grid movement for top-down games: keep a tile position, tween the mesh between tiles, and use
  `findPath` for NPCs. The physics `Player` also works (walls = tall tiles).

## 2. Isometric views of a live 3D world

- `iso`: true isometric, elevation `atan(1/√2)` = 35.264°, yaw 45°.
- `dimetric`: pixel-art "isometric", elevation `atan(0.5)` = 26.565° → 2:1 pixel slopes.
- Use `OrthographicCamera` (`CameraRig` does it); rotate only in 90° steps (`rotateQuarter`)
  so the pixel grid stays aligned. `zoom` = visible world units vertically.
- Pixel-perfect look: render to a low-res `WebGLRenderTarget` and upscale with
  `NearestFilter`, or set `renderer.setPixelRatio(1)` + CSS `image-rendering: pixelated`.
- Picking still works: `Raycaster.setFromCamera` + `raycastVoxels` (see `main.ts pick()`).

## 3. Baked isometric sprites (`bakeIsoSprite`)

CPU rasterizer in the style of IsoVoxel (github.com/tommyettinger/IsoVoxel):
- Projection for voxel `(x, y, z)` (Y-up): `px = (x − z)·s`, `py = (x + z)·s/2 − y·s`;
  each voxel is a `2s × 2s` stamp with top (+Y), left (+Z) and right (+X) faces.
- Painter's order: increasing `x + y + z`; fully enclosed voxels are skipped.
- Output: `{ width, height, data (RGBA), originX, originY }`; canvas size
  `(W + D)·s × (W + D)·s/2 + H·s`. `originX/Y` = pixel of grid corner (0,0,0) for anchoring on a tile.
- Options: `scale` (even, default 4), `shade` per face, `rotation` 0..3 (bake 4 directions for
  sprites that turn), `outline` 1-px silhouette.
- Browser: `ctx.putImageData(new ImageData(s.data, s.width, s.height), 0, 0)`;
  Three: draw to a canvas first, then `new THREE.CanvasTexture(canvas)` with
  `magFilter = minFilter = NearestFilter` and `colorSpace = SRGBColorSpace` (use on a `THREE.Sprite`).
- Build-time sprite sheets: import `iso-baker.ts` in a Vitest/Node script and write PNGs
  (no WebGL needed). In the running game press **B** to download the level as an iso PNG.

## 4. Isometric sprite games (2D engine on top of baked sprites)

- Tile anchor: a tile `(tx, tz)` of size `t` voxels draws at `px = (tx − tz)·t·s`, `py = (tx + tz)·t·s/2`.
- Depth sort sprites by `x + z` (then `y`) every frame; floor tiles first.
- Keep one palette for all assets (same MagicaVoxel palette file) so sprites match.
- Animation: one MagicaVoxel model per frame (same size — see editor notes), bake each, pack into
  a sheet.

## 5. Choosing

- Want a playable map quickly, grid logic, RPG/strategy → **tile map + topdown/dimetric camera**.
- Want diorama look with full 3D lighting → **3D world + iso/dimetric camera**.
- Want classic pixel art, many units, low GPU → **baked sprites** (bake once, draw as 2D).
