# MagicaVoxel Editor Reference (0.99.x)

Source: official site ephtracy.github.io, snapshot 0.99.7 (latest download listed: 0.99.6.4, 09/05/2021; the log also has a 0.99.7.0 entry, "12/??/2021"). Everything here comes from that site. If something is not listed here, the site does not document it. Say so; do not guess. The binary layout of .vox is in `vox-format.md`.

## Contents
1. Limits and scene model
2. Game asset workflow
3. Export formats (and what to use for Three.js)
4. Shortcuts
5. Console commands
6. Materials
7. Renderer: promo images and sprite references
8. Resources
9. Troubleshooting (official FAQ)

---

## 1. Limits and scene model

| Item | Value | Since |
|---|---|---|
| Canvas size per model (object) | 256x256x256 | 0.99.5 |
| World/scene area | (-1024, +1024) | 0.99 |
| Renderer volume (dense) | 512x512x512, 1024x512x256 or 1024x1024x128 | 0.99 |
| Renderer volume (Sample->Geometry->SV, sparse) | 2048x2048x1024; total solid voxels still limited; cubic voxels only | 0.99.2 |
| Palette | one palette per project; community palettes are 256x1 PNGs (see Resources) | - |
| Undo depth | up to 100 commands | 0.99.5 |
| Animation frames (old model-list animation) | up to 24 | 0.98 |
| Photo render size | up to 12000x12000 | 0.99.3 |
| Max number of models/objects | not stated in the sources | - |

Palette index 0: the site only says that `flood 0` removes invisible voxels (index 0 = empty). The full index semantics are in `vox-format.md`.

Scene graph (World/Scene Editor, since 0.99):
- **Objects**: each object holds one model with its own transform (rotate, flip, move). Press TAB to switch between the Model Editor and the World Editor.
- **Groups**: CTRL+R groups and CTRL+SHIFT+R ungroups. TAB / SHIFT+TAB enters or leaves a group. Double-clicking enters or leaves (0.99.5.1), and right-double-click leaves.
- **References (instances)**: SHIFT+move (translation gizmo) makes a *referenced* copy, and editing one reference changes all of them. CTRL+T converts a reference into an independent duplicate. "Ref-R" converts recursively (0.99.5.1). There is an option to let SHIFT+drag duplicate or reference objects (0.99.5.1).
- **Layers**: a layer is a tag used to hide objects. The Layer Panel (0.99.6.4) sets an object's layer (click left of the circle), hides a layer (click the circle), sets the active layer for new objects (click right of the circle), and renames or recolors layers (right-click).
- **Scene Outline Panel** (0.99.6.4, second icon on the right panel): rename, hide or unhide objects, expand groups, and reorder them with the arrow keys (SHIFT moves to first/last). The layer color is shown in the panel.
- **Transform editing** (0.99.7): copy and paste transform, rotation or translation, type in exact positions, and use the new gizmo. You can also "reset rotation to identity" (0.99.5.1).
- Other scene tools: union combine (U), align objects (0.99.1), Boolean operations on groups and objects (0.99.6.2), Fit (fit the size of several objects) and live Crop (drag the arrow body to resize, the arrow head to move) (0.99.5.1).
- Deleted models are recoverable from the **Trash**. Auto-save runs every 25 steps to `cache/`, and the crash backup is `cache/backup.vox`.

## 2. Game asset workflow

Conventions (these are guidance; the site gives none):
- **One asset = one object/model.** Name each object in the Scene Outline, because the name ends up in exported file names (`[project]-[index]-[object].[ext]`, 0.99.3).
- **Pivot/origin**: mesh exports use *global world positions* (0.99.3). For assets that need to be centered, enable **IO->Export->Local** (the FAQ fix for "exported models are not centered"). Place objects on the ground with **G**. For .obj, a custom pivot can be set in `config.txt -> file_obj` (0.97.1).
- **Size**: stay within 256^3 per model. Use `shrink` to fit the canvas to the voxels, and `size x y z` to set it exactly.
- **Consistent palette across assets**: build all assets in one project, or share one palette file. The Pattern Library (0.99.6.4) loads an asset project as a library, and its **Match** option maps the pattern palette to the scene palette. Import options can match similar colors or import only a selected palette region (0.99.5.1). `pal mask` hides unused swatches. Palette Notes let you label palette rows (0.99.5.1).
- **Layers** separate collision proxies, variants or props so you can hide them; use groups for compound assets.
- **Material per palette index**: plan palette slots so that emissive, glass and metal colors sit in known index ranges (see section 6).
- **Animation frames**:
  - 0.99.7 Animation Panel (the arrow button at the top): **+** adds a frame, and **+** on an existing frame replaces it (frames do not update automatically). **-** deletes. Click a frame marker to select it, and CTRL/SHIFT-click for multiple. Drag moves frames and CTRL+SHIFT+drag duplicates them. The right-click menu offers select all/inverse/none and reverse.
  - You can pack several models into one animation and unpack them again. Both models and objects can be animated. Put animated models in a group before moving or duplicating them.
  - Known issue (0.99.7): pivots are buggy, so **keep all frame models the same size**.
  - Older (0.98): up to 24 frames. Drag and drop several models to import them as an animation. Anim import/export "not fully supported".
- **Save as .vox** (CTRL+S; CTRL+SHIFT+S for Save As). The IO panel decides which components go into the .vox (0.99.5.1). Materials are stored in .vox since 0.98, and rendering settings since 0.99. The orange dot next to the name field means there are unsaved changes.
- Export or import palette, materials, rendering, camera and notes settings as text through the IO panel (0.99.5.1).

## 3. Export formats

Export with the IO/Export panel, or with the console command `o [type]` (single model) or `odir [type]` (all models in the current folder). Export settings (scale, axis, etc.) live in `config/config.txt`, keys `io_*` (0.99.3). If a selection exists, only the selected voxels are exported (0.98.1). The "only export selected objects" option exists since 0.99.5.1.

| Format | What it produces / caveats | Since |
|---|---|---|
| `.vox` | Native project: models, scene graph, palette, materials, settings | - |
| `obj` | Mesh with color-based simplification. Pivot configurable in `config.txt -> file_obj`. Several pivot/export bugs fixed in 0.96.2/0.97/0.97.1 | 0.96.1 |
| `mc` (.ply) | Marching Cubes mesh (smooth, not blocky) | 0.97.1 |
| `bake` | Mesh with baked ambient occlusion and soft shadow. Options: `config->bake->perface` (per face, pixelated) or per vertex (smooth), `ambient`, `gamma` (use 2.2 for gamma-corrected apps). Needs the renderer to work (crash risk) and takes seconds to about 30 s | 0.97.2 |
| `iso` | Isometric sprites. More isometric/2D sprite config options added in 0.97 | 0.96.1 |
| `slice` | Volume as one image of size (width, height x depth) | 0.98.1 |
| slices / cubes / point clouds | Additional export options | 0.99.3 |
| `.qb` | Qubicle format (export bug fixed in 0.97.2) | <=0.97.2 |
| jpeg / png | Screenshots (F6/6; CTRL+F6/CTRL+6 for the whole window). JPEG export since 0.99.5 | - |
| text settings | palette/materials/render/camera/notes | 0.99.5.1 |

Not in the sources: **glTF/GLB, FBX, STL**. Do not tell the user MagicaVoxel exports these. (The resource list mentions .collada only as a format that the third-party "mmmm" collection is distributed in.) Old limitation (0.99): export was single-model only, without offsets or names. This was addressed by 0.99.3 (object naming, global positions).

Choosing a format for Three.js:
1. **Preferred: ship `.vox`** and parse it at runtime or at build time (see `vox-format.md`). This keeps the palette, material, scene graph and animation data.
2. **Mesh fallback: `obj`.** Enable Export->Local so each asset is centered. Set scale/axis in `config.txt io_*`. MagicaVoxel's .obj color handling is not documented on the site, so check it after export. Expect the path-tracer materials (glass, emit, cloud) **not** to carry over.
3. `mc` (.ply) only for a smooth look. `bake` when you want AO/shadow baked into the mesh and the scene uses unlit shading (set bake gamma to 2.2 if the renderer applies gamma correction).
4. `iso` / `slice` / screenshots are for 2D sprite pipelines, not for 3D.

## 4. Shortcuts (macOS: Command instead of Ctrl; custom bindings go in `config/hotkey.txt`)

| Context | Key | Action |
|---|---|---|
| Global | F1 | console |
| | CTRL+Z / CTRL+Y (=CTRL+SHIFT+Z) | undo / redo |
| | F6 / 6 (+CTRL = whole window) | screenshot |
| | TAB | model <-> world editor |
| | CTRL +/- | scale UI |
| Project | CTRL+S / CTRL+SHIFT+S | save / save as |
| | CTRL+O / CTRL+SHIFT+O | open / import project |
| | CTRL+P / CTRL+SHIFT+P | new / duplicate project |
| Select | CTRL+A / CTRL+I / CTRL+D | all / inverse / none |
| | CTRL+C / CTRL+X / CTRL+V | copy / cut / paste |
| Camera | RButton / MButton (=Space+LButton, Space+WASDQE) | rotate / pan |
| | WHEEL; Z+LButton drag | zoom |
| | X+LButton | set camera focus (rotation center) |
| | LButton+Ruler | snap angle to multiples of 5 degrees |
| | WASDQE | rotate / move (free mode) |
| | F4/4; F5/5 | recenter; 90-degree views |
| | F7/7; F8/8; Numpad 0-9 | save pose; load pose; camera slot |
| Model edit | U / I | fUll / fIll model |
| | Backspace/Delete | delete voxels |
| World edit | TAB / SHIFT+TAB | enter / leave group |
| | U | union objects |
| | Arrow/Page; -/+; G | move; rotate; drop to ground |
| | CTRL+H / CTRL+SHIFT+H | hide / unhide |
| | CTRL+N; Backspace/Delete | new object; delete object |
| | CTRL+T | reference -> duplicate |
| | CTRL+R / CTRL+SHIFT+R | group / ungroup |
| | CTRL+LButton | move object along the surface |
| Brush | ALT+LButton | pick voxel color |
| | CTRL+LButton (+SHIFT = along normal) | move voxels (model editor) |
| | T / R / G / N | aTtach / eRase / paint / selectioN (SHIFT toggles attach<->erase; for selection, SHIFT adds and SHIFT+ALT subtracts) |
| Brush mode | V F B L C P | voxel / face / box / line / center / pattern |
| | +/- (V) ; 1-9 | resize brush (1-9 hotkeys since 0.97.1) |
| | P: +/-, 9, 0; Arrow/Page; Home | rotate pattern z/x/y; offset; reset offset |
| | CTRL+ALT+drag | resize voxel brush (0.99.5.1) |
| Mirror / Axis | 1 2 3 / CTRL+1 2 3 | mirror x y z / axis x y z |
| Display | CTRL+E G F U B W M | edge, grid, frame, ground, background, shadow, wireframe |
| Palette | ALT+DRAG | pick color from screen |
| | CTRL+DRAG / CTRL+SHIFT+DRAG | swap / duplicate color |
| | ALT+SHIFT+DRAG | fill gradient block |
| | click / drag / SHIFT+drag / SHIFT+ALT+drag | select / multi-select / add / remove (0.99.5) |
| Renderer | LButton | pick DOF focus |
| | ALT+LButton | pick voxel material (click the ground to give it a material) |
| | CTRL+R / CTRL+C / CTRL+V | reset / copy / paste material |

Note: the version history also lists ALT+DRAG as "swap palette color without changing model" (0.97.2) and "pick color from screen" (0.99). The current controls page gives ALT+DRAG = pick color and CTRL+DRAG = swap.

## 5. Console commands (F1 or TAB to enter, Enter to run, UP/DOWN for history)

| Command | Effect | Example |
|---|---|---|
| `sel_none` / `sel_all` / `sel_inv` | selection | |
| `copy` / `cut` / `paste` | voxels | |
| `size x y z` | resize model canvas | `size 45 60 120` |
| `shrink` | fit canvas to voxels | |
| `zero` / `full` / `fill` / `inv` | clear / fill volume / paint all voxels with current color / invert solid and empty | |
| `flip axis` | flip | `flip x y` |
| `loop axis offset` | wrap-shift model | `loop z 1 x -2` |
| `scale [xyz] factor` | scale | `scale x 0.5 yz 2.8`, `scale 2.0` |
| `x2` | double size | |
| `rot axis deg` / `rot90 axis` | rotate | `rot x 30`, `rot90 x` |
| `repeat [xyz] factor` | tile (a negative value mirrors) | `repeat xy 4 z -0.5` |
| `mir [axis]` | mirror symmetry (default x) | `mir x` |
| `dia [axis]` | diagonal symmetry (default z) | `dia x` |
| `dil [axis]` / `ero [axis]` | dilate / erode (`+z`, `-z`, `z`) | `dil +z`, `ero +z-yx` |
| `flood idx` | `0`: remove invisible voxels; else fill enclosed space | `flood 0`, `flood 73` |
| `noise [seed scale min max]` | noise (defaults 0.03 0.2 0.5) | `noise 123 0.03 0.2 0.5` |
| `rand [min max]` | random color index in range (uses the palette multi-selection since 0.99.5) | `rand 10 15` |
| `maze [edge]` | maze shape | `maze 8` |
| `shear axis s s` | shear (0.99.6.2) | `shear z 0.2 0.2` |
| `log` | model count, scene size, voxel count per color (0.99.6.2) | |
| `pal mask` | mask unused swatches | |
| `pal fill idx` | fill palette with one color | `pal fill 100` |
| `pal bw` / `pal mac` | grey / default mac palette | |
| `pal sort [+-hsvrgb]` | sort palette; only the selected colors if more than one is selected (0.99.2 / 0.99.6.2) | `pal sort vsh` |
| `o type` | export current model | `o obj`, `o slice` |
| `odir type` | export all models in the current folder | `odir obj` |
| `xs [opts] name args...` | run voxel shader from `shader/` (`-n N` iterations, `-prev`/`-cur` input frame; subfolders `xs sub/poly`) | `xs wave`, `xs -n 8 name` |
| `cam x/y/z tx/ty/tz rx/ry/rz` | set camera values (0.99.6.2) | |
| `ui scale v` | UI scale | `ui scale 1.5` |

Voxel shaders are GLSL (0.97.1). Inputs: `iFrame`, `iNumFrames`, `iIter`, `iRand`. Up to 16 arguments, `var` aliases, `color_sel()`, `palette()` (0.99.6.2). The Voxel Shader brush and the SDF brush apply them interactively.

## 6. Materials

Materials are assigned **per palette index** (Matter->Sel since 0.96.2; select them with ALT+LButton in the renderer). They are saved inside the .vox since 0.98, which is the MATL data described in `vox-format.md`. Copy and paste them with CTRL+C/V or Matter->C/P. Multi-select palette colors to edit many at once (0.99.5).

| Material | Notes | Since |
|---|---|---|
| Diffuse (default) | Light->0 is a pure color model | - |
| Metal / Plastic | GGX NDF; Rough = 0 gives a perfect mirror | 0.97.3 |
| Glass | refraction, attenuation (Glass->Attenuation tints light through TR-Shadow) | 0.96.3 |
| Emit | Formula `Emit * 10^Power`. Glow only enhances Bloom/Bokeh. Area light: Power = radiant flux, Total = total power (for small, strong lights). Needs GI. Cubic/RG/RE shapes only | 0.96.2, 0.97.4, 0.98.2 |
| Cloud | volumetric media, multiple scattering | 0.99.4 |
| Blend | weighted Metal/Plastic/Glass/Cloud mix (like Disney Principled) | 0.99.6.2 |
| SSS | subsurface scattering: transparency controls transmission, density controls scattering | 0.99.6.2 |
| Absorb/Scatter/Emissive media | emissive cloud, can sit inside glass with ior > 1 | 0.99.6.2 |
| Alpha blend | glass + absorb media, density = 0, ior = 0, transparency > 0 | 0.99.6.2 |

For Three.js, map these yourself when you load the model: metal/rough -> `MeshStandardMaterial` metalness/roughness, glass -> transparent/transmission, emit -> emissive. This mapping is guidance; the site does not define it.

## 7. Renderer: promo images and isometric sprite references

- **Render->Image**: *Photo* mode (up to 12000x12000, no bloom), *Turntable* (spinning camera plus motion blur, saved as `name (frame).png` sequence), *Anim* (0.99.7: set start and end frames, then Render). Photo and Turntable can render in the background. Disable vsync in the GPU panel if needed.
- **Isometric/orthographic**: orth/iso camera modes, ground is infinite there. The View Cube offers 26 standard angles (90/45 degrees). F5/5 cycles face views. LButton+Ruler snaps the angle to 5 degrees. Use camera slots (F7/F8, Numpad) and the Camera Panel (Fov, Speed, Mouse; global/local position, pitch/yaw/roll, save/load slots, 0.99.6.2) to repeat exactly the same view for every asset.
- **Pixelated / sprite look**: turn off View->AA and render small (e.g. 128) (0.98.2). Sample->PX gives pixelated illumination (0.99.2).
- **Clean background**: View->Back (CTRL+B) for a constant color or sky background. The Fog slider fades the ground into the horizon.
- **Lighting**: Sun/Sky (colors picked from the palette), Atmospheric skydome (Rayleigh/Mie), Sky->IBL with `.hdr` panoramas (0.99.4.1), area lights through Emit.
- **Quality**: Sample->GI (slower, use 3000+ samples), MIS-GGX, TR-Shadow (light passes through glass and cloud), Bounce depths, Bounce->Clamp for noise. Denoiser plugin (Intel OIDN, 64-bit, 4 GB RAM; extract plugin.zip into the program folder): Image->Filter->Denoise, optional Image->MRT (0.99.4.2).
- **Post/Lens**: Post->E exposure, Post->V vignette, Camera->G gamma, ACES tone mapping, DOF (click to focus), bladed bokeh, Bloom, Lens->Pano (width = 2 x height), FOV 1-360.
- **Voxel shapes** for stylized renders: Lego, Marching Cubes, Sphere, Cylinder, Clay, rounded corners. World Scale sets rectangular voxels (0.99.2).
- Incomplete scene: enable Sample->Geometry->Sparse, or raise `config.txt -> render -> dense_buffer/sparse_buffer`.

MagicaVoxel Viewer (a separate program, v0.41): a path tracer for sparse volumes up to 2048^3 that opens .vox, .xraw (8/16-bit palette), .schematic, .rsvo, PNG heightmaps and .asc LIDAR, and voxelizes .obj. Download: https://github.com/ephtracy/ephtracy.github.io/releases/download/0.41/MagicaVoxel-Viewer.zip

## 8. Resources

- Downloads/releases: https://github.com/ephtracy/ephtracy.github.io/releases
- Sample models and palettes, language packs, .vox spec: https://github.com/ephtracy/voxel-model (spec: `MagicaVoxel-file-format-vox.txt`; translation: `/language` into `/config`)
- mmmm, 400+ city models (.vox, .collada, Unity .prefab): https://github.com/mikelovesrobots/mmmm
- kluchek/vox-models: https://github.com/kluchek/vox-models
- Palettes, 256x1 single-row PNG with data starting at the right side: https://github.com/mattperrin/MagicaVoxelPalettes
- Zingot retro palettes: http://www.zingot.com/personal.html
- Voxel shaders: https://github.com/lachlanmcdonald/magicavoxel-shaders ; CA shader generator: https://github.com/kchapelier/cellular-automata-voxel-shader
- IsoVoxel, isometric pixel art from .vox: https://github.com/tommyettinger/IsoVoxel
- Sketchfab publishing: https://blog.sketchfab.com/publishing-voxel-designs-from-magicavoxel-to-sketchfab/
- A-Frame (WebVR, three.js-based) import guide: https://aframe.io/docs/0.3.0/guides/building-with-magicavoxel.html
- Render animation script: http://drinkdecaf.com/magicavoxel_animate
- Tutorials: official 0.98 https://youtu.be/d_WymsNdRBA ; Aaron Robbins (0.97.1, EN) https://www.youtube.com/playlist?list=PLHtmobOgsDvlikllA1MBk7pk_DWlmtR_S ; Elliot KiD (FR) https://www.youtube.com/playlist?list=PLYmCMg3QL20-jQNEyAAmKjGteZDxVesmy ; Bobby Bob (FR, making-of) https://youtu.be/bdROMzu3gw0
- Related tools by ephtracy: MagicaCSG (SDF editor, Marching-Cubes mesh export, Win64), Aerialod (heightmap path tracer, PLY export).

## 9. Troubleshooting (official FAQ)

- Win64 missing VCOMP100.DLL: install the MS VC++ 2010 SP1 x64 redistributable.
- macOS will not open: allow the app in Security and Privacy. Black screen: move the .app out of its folder and back. Slow on Retina: disable Brush->Display->HDPI.
- UI too small: CTRL +/- or `ui_scale` in config.txt. No middle mouse button: Space+drag pans, Z+drag zooms.
- Several objects visible and you cannot edit: press TAB or double-click the background. Model partly under the ground: press G in the world editor.
- Black renderer: the GPU/driver does not meet the requirements. Crash with a corrupted backup: delete the backup files in `cache/`.
