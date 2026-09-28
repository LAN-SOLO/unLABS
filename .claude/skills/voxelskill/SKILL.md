---
name: voxelskill
description: Builds browser voxel games in TypeScript + Three.js with MagicaVoxel assets — 3D voxel worlds and dioramas, isometric/dimetric 2.5D views, top-down tile maps and baked isometric pixel-art sprites. Use when the user wants a voxel game, voxel world or level, works with .vox files or MagicaVoxel, or needs greedy meshing, voxel raycasting/collision or iso voxel sprites. Not for Minecraft mods or non-voxel 2D games.
argument-hint: "[what to build or change]"
---

# Voxel games with Three.js + MagicaVoxel

You build on a **tested template** (TypeScript strict, Vite, Three.js r186, Vitest, PNPM) that already
has a `.vox` parser/writer, greedy mesher with AO, chunked world, DDA raycast, AABB physics,
four camera modes, tile maps, CPU iso-sprite baker and a JSON level format.
Two rules matter most:

1. **Extend the template, never rewrite its core.** Read the module you touch first
   ([references/engine.md](references/engine.md) §1 maps them). Do not swap in Three's `VOXLoader` —
   it centers odd-sized models half a voxel off and drops materials and animation frames.
2. **Axes:** MagicaVoxel is Z-up, the game is Y-up: `(x, y, z)_vox → (x, z, −y)`. Pivot = `floor(size/2)`.
   Every placement bug starts here — use `vox/scene.ts` (`sceneToGrid`, `instanceCells`) instead of hand math.

## Workflow

1. **New project** (skip if one exists — look for `src/voxel/mesher.ts`):
   `bash ${CLAUDE_SKILL_DIR}/scripts/new_game.sh <target-dir>` — copies the template, generates
   demo `.vox` props, runs `pnpm install`. Target must be empty.
2. **Plan the change** against the module map; decide 3D, iso/dimetric or top-down
   ([references/2d-worlds.md](references/2d-worlds.md) §5).
3. **Content first, code second:** new levels are JSON (`public/levels/`), new assets are `.vox`
   (`public/models/`). Level schema: [references/levels.md](references/levels.md).
4. **Implement** in the right layer: pure logic in `src/voxel|vox|tilemap|procgen|game`
   (no `three` imports), rendering in `src/render`, wiring in `main.ts`.
5. **Test** pure logic with Vitest next to the code (`*.test.ts`).
6. **Verify** (all must pass before reporting done):
   ```sh
   pnpm check          # tsc --noEmit && vitest run && vite build
   pnpm dev            # then look at it (below)
   ```
   Visual check with a browser tool if available: open `http://localhost:5173/?level=/levels/<x>.json&view=<mode>`,
   screenshot, read console errors. Automated tabs are often hidden → the render loop pauses;
   drive state through `window.game` (dev only), e.g.
   `game.player.update(game.level.solids, {move:[0,1], jump:false}, 1/60)`, then
   `game.renderer.render(game.scene, game.rig.camera)` before the screenshot.

## Assets

| Task | Command / API |
|------|---------------|
| Inspect a `.vox` (models, scene graph, materials, colors used) | `python3 ${CLAUDE_SKILL_DIR}/scripts/vox_info.py file.vox [--json]` |
| Demo props (tree, house, crate, lamp, coin) | `python3 ${CLAUDE_SKILL_DIR}/scripts/make_vox.py --demo all --out public/models` |
| Generate a `.vox` from boxes/voxels JSON | `python3 ${CLAUDE_SKILL_DIR}/scripts/make_vox.py --json spec.json --out x.vox` (format in `--help`) |
| Load in game | `voxToObject(await loadVox('/models/x.vox'), materials, { anchor: 'bottom-center' })` |
| Bake to Y-up grid (collision, sprites, editing) | `sceneToGrid(flattenScene(file))` |
| Save world/model as `.vox` | `writeVox([{ size, xyzi: packXyzi(voxels) }], { palette })` (≤ 256 per axis) |
| Pixel-art iso sprite | `bakeIsoSprite(grid, palette, { scale: 4, outline: true, rotation })` |

Guide the user through MagicaVoxel with [references/magicavoxel-editor.md](references/magicavoxel-editor.md)
(shortcuts, console commands, export formats, limits). Binary details, MATL keys, rotation bytes:
[references/vox-format.md](references/vox-format.md).

## Rules

- One voxel = one world unit; the world is a bounded `VoxelWorld` (32³ chunks). Edits go through
  `world.set()`; `WorldRenderer.sync()` re-meshes dirty chunks with a per-frame budget.
- Palette index 0 = empty. Colors are sRGB in palettes — `Palette.linear()` for vertex colors.
- Materials come from palette indices: `solid | glass | emit | metal` (level `materials` or MATL).
  Metal needs `scene.environment` (already set up) or it renders black.
- Collision/raycasts use `level.solids` (terrain ∪ solid props). Keep movement per `moveBox` call < 1 voxel.
- Orthographic views rotate in 90° steps only (`rig.rotateQuarter`) to keep pixel alignment.
- Three r186: `PCFSoftShadowMap` is gone (use `PCFShadowMap`); import addons from `three/addons/...`.
- Performance: < 300 draw calls, re-mesh ≤ 4 chunks/frame, repeated props → `InstancedMesh`.
  Numbers and patterns: [references/engine.md](references/engine.md) §6–8.
- Keep `strict` + `noUncheckedIndexedAccess`; no `any`. PNPM only.

## References

- [references/engine.md](references/engine.md) — module map, meshing/AO, chunks, physics, Three.js setup, budgets, extension patterns, verified pitfalls. Read before changing engine code.
- [references/levels.md](references/levels.md) — level JSON, MagicaVoxel→game pipeline, diorama design, gameplay recipes. Read when making levels or gameplay.
- [references/2d-worlds.md](references/2d-worlds.md) — tile maps, iso/dimetric cameras, sprite baking math. Read for any 2D/2.5D work.
- [references/vox-format.md](references/vox-format.md) — .vox chunks, scene graph, coordinates, gotchas. Read when parsing/writing files or debugging placement.
- [references/magicavoxel-editor.md](references/magicavoxel-editor.md) — editor limits, shortcuts, commands, materials, export, resources. Read when the user models in MagicaVoxel.
