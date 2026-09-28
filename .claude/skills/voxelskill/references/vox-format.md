# MagicaVoxel .vox format — reference

Sources: https://github.com/ephtracy/voxel-model — `MagicaVoxel-file-format-vox.txt`
(10/18/2016) and `MagicaVoxel-file-format-vox-extension.txt`. Implemented and
tested in `assets/template/src/vox/` (TS) and `scripts/make_vox.py` / `vox_info.py` (Python).

Contents: 1 Layout · 2 Chunks · 3 Scene graph · 4 Special types · 5 Coordinates & pivot · 6 Gotchas

## 1. Layout (RIFF-style, little-endian)

```
"VOX "  int32 version (150 classic; newer MagicaVoxel writes 200 — parse both the same way)
MAIN chunk (content 0 bytes) → all other chunks are its children
```
Every chunk: `char[4] id | int32 contentBytes N | int32 childrenBytes M | N bytes | M bytes`.
Skip unknown chunks with `pos = contentStart + N + M` — never fail on them.

## 2. Chunks

| id | content | notes |
|----|---------|-------|
| `PACK` | int32 numModels | optional, old animation (0.98.2); ignore |
| `SIZE` | int32 x, y, z | z = gravity/up; always directly followed by its `XYZI` |
| `XYZI` | int32 n; n × (u8 x, u8 y, u8 z, u8 colorIndex) | model id = order of SIZE/XYZI pairs (0-based) |
| `RGBA` | 256 × (u8 r, g, b, a) | **file entry i → palette index i+1** (i = 0..254); 256th entry unused |
| `nTRN` | transform node | see §3 |
| `nGRP` | group node | see §3 |
| `nSHP` | shape node | see §3 |
| `MATL` | int32 materialId; DICT props | materialId = palette index |
| `LAYR` | int32 id; DICT (_name, _hidden); int32 -1 | |
| `rOBJ` | DICT | render settings, ignore for games |
| `rCAM` | int32 id; DICT (_mode, _focus, _angle, _radius, _frustum, _fov) | editor cameras |
| `NOTE` | int32 n; n × STRING | palette color names |
| `IMAP` | 256 × int32(spec) | palette display order; does **not** change voxel colors |
| `MATT` | — | deprecated, replaced by MATL |

Palette index 0 = empty. A voxel's color is `palette[colorIndex]`, colorIndex 1..255.
If `RGBA` is missing use the default palette (in `template/src/vox/default-palette.ts`,
values `0xAABBGGRR`, index-aligned). Current MagicaVoxel always writes RGBA.

### MATL properties (all values are strings)
`_type`: `_diffuse` | `_metal` | `_glass` | `_emit` (newer versions also `_blend`, `_media`).
Common keys: `_weight` (0..1), `_rough`, `_spec`, `_ior`, `_att`, `_flux`, `_plastic`,
plus newer `_metal`, `_alpha`, `_trans`, `_emit`, `_ldr`. Treat unknown keys as optional.
The template maps `_metal`→metal, `_glass`/`_blend`→glass, `_emit`→emit, else solid
(`render/voxel-mesh.ts: materialClassifier`) — an approximation of the path tracer.

## 3. Scene graph (world editor, 0.99+)

```
nTRN 0 (root) → nGRP 1 → nTRN → nSHP → model id
                        → nTRN → nGRP → …
```
- **nTRN**: int32 nodeId; DICT attrs (`_name`, `_hidden`); int32 childId; int32 reserved (-1);
  int32 layerId; int32 numFrames (>0); numFrames × DICT (`_r` rotation, `_t` "x y z", `_f` frame).
- **nGRP**: int32 nodeId; DICT; int32 n; n × int32 childId.
- **nSHP**: int32 nodeId; DICT; int32 n; n × (int32 modelId; DICT with `_f`).
- World transform of a shape = product of all nTRN transforms from the root.
  Same model id in several nSHP = instancing (render with `InstancedMesh`).
- Animation: several frames per nTRN / nSHP with `_f`; use the latest keyframe with `_f <= t`.
- Hidden: `_hidden = "1"` on node or its layer (`LAYR`).

## 4. Special types

- STRING: int32 byteLength + bytes (no `\0`).
- DICT: int32 count + count × (STRING key, STRING value). **Numbers are strings**: `_t = "-3 10 4"`, `_r = "20"`.
- ROTATION (byte): bits 0–1 column of non-zero in row 0, bits 2–3 column in row 1
  (row 2 takes the remaining column), bits 4/5/6 sign of rows 0/1/2 (1 = negative).
  Identity = `4`. Spec example rows (0 1 0)(0 0 -1)(-1 0 0) = `(1) | (2<<2) | (1<<5) | (1<<6)` = 105.
  48 valid bytes = 24 rotations + 24 mirrors. Code: `vox/scene.ts decodeRotation/encodeRotation`.

## 5. Coordinates & pivot (the #1 source of bugs)

- MagicaVoxel: right-handed, **Z up**. Three.js / template game world: right-handed, **Y up**.
  Convert points `(x, y, z)_vox → (x, z, -y)`; equals rotating −90° about X.
- A model's pivot is `floor(size / 2)` per axis (matches the ogt_vox reference loader).
  Voxel `v` covers `[v - pivot, v - pivot + 1]` in model space; `_t` places the pivot.
  Transform **voxel centers** (`v + 0.5 - pivot`) and floor afterwards — this keeps 90° rotations on the grid.
- Three's built-in `VOXLoader` (r186) centers with `size / 2` (float) — odd sizes end up half a
  voxel off from MagicaVoxel — and ignores MATL, frames and hidden layers. Use the template parser.
- `make_vox.py` / `writeVox` default `_t = (0, 0, floor(sz/2))` so a model stands on z = 0.

## 6. Gotchas

- Model axis size limit: 256 per axis (u8 coordinates). Bigger worlds = several models / chunks.
- Check `XYZI` coordinates against `SIZE` — third-party files occasionally contain out-of-range voxels.
- Palette colors are sRGB: convert to linear for vertex colors (`Palette.linear`) or colors look washed out.
- Never assume one model per file: iterate the scene graph (`flattenScene`).
- Editing tools may reorder models; reference models by `_name` of their nTRN, not by id.
