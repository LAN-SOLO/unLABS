# Hero characters — the real Jade, the veiled Damien

> In a lab made of voxels, Jade Lawrence is real from the first second.
> Damien Fridge is real too — but nobody may see him yet: until he has been
> found, he exists only as a silhouette dissolving in static.

Related: [`CLARITY.md`](CLARITY.md) (the voxel world around them — Jade is its one real figure).

---

## 1. Pipeline at a glance

```
SDF sculpt (pure TS)        lib/world/hero/jade-sculpt.ts, damien-sculpt.ts
  │  layers: head, hands, hair, shirt, coat, trousers, boots, belt, watch, trim …
  ▼
surface nets (+ projection) lib/sculpt/surface-nets.ts
  │  per-layer cell size: "portrait" (studio) or "game" (≈ 70 k / 43 k tris)
  ▼
skin weights + SDF AO       lib/world/hero/build.ts (meshLayer, fieldAo, unionField)
  │  built in a Web Worker  lib/world/hero/load.ts, hero.worker.ts, damien-*.ts
  ▼
skinned three.js rig        lib/world/render/hero/hero-rig.ts, damien-rig.ts
  │  bones named like the voxel rig → every pose of models/rig.ts plays
  ▼
procedural PBR shading      lib/world/render/hero/materials.ts, veil-material.ts
  ▼
HeroPass (layer 5)          drawn sharp on top of the pixelated world
```

## 2. Modelling with distance fields

`lib/sculpt/sdf.ts` holds the primitives (sphere, ellipsoid, capsule, round
cone, round box, torus), smooth union / intersection / subtraction and value
noise. Each body part is a field in **character space** (model voxels,
1 ≈ 2.78 cm, feet on y = 0, front = +z, her right = −x).

`lib/sculpt/surface-nets.ts` meshes a field: sparse sampling in 8³ blocks
(empty blocks skipped by their centre distance), one vertex per crossing
cell, quads per crossing edge, normals from the field gradient,
`projectToSurface` pulls vertices onto the exact surface. Tested for
watertightness, winding and sparse = dense.

**Jade's layers** (`jadeLayers(detail)`), modelled after the portrait
(`~/Desktop/JadeLawrence/Portrait_lawrence_usc.jpg`, 2026-10-01): skin (an
oval-round face widest at the cheekbones, smiling cheek apples, a short soft
nose, a wide closed-lip smile, slightly narrowed smiling eyes, high forehead
with an arched hairline, ears, neck, lid shells), hands, hair volume (the
under-layer of the strand hair, see §2a), shirt **body** and **sleeves**,
lab coat **body** and **sleeves** (open front, lapels, skirt to the knee),
trousers, boots, tool belt, watch, buttons. Bodies and sleeves are separate
layers so lifting an arm never stretches cloth across the armpit (§3).

## 2b. Face texture from the portrait

The skin shader projects the user's portrait front-on onto the face
(`public/hero/jade-face.webp`, built by `node scripts/hero/face-texture.mjs`):

- **Landmarks** (1833×1375 photo): pupils (800, 680) / (1070, 678) ↔ the
  sculpt's eyes at x = ±1.1, y = 56.55 → 122.7 px per voxel; the head
  profile, mouth (54.6, corners ±1.18), nose tip (55.32), chin (53.0),
  hairline (58.6) and ears are fitted to the same measurements.
- **Prep:** the well-lit half (image left) is mirrored onto the shaded side,
  the broad shading is divided out (3× box blur, r = 28 px) and the cheek
  colour is white-balanced to the game's skin tone — the scene lights her.
- **Shader** (`FACE_PROJECTION` in `materials.ts`): blended where the rest
  normal faces forward, inside the face, below the hairline; the sculpt's
  AO and pore bump are relaxed there (the photo carries them); the narrow
  shadow under the nose is faded. Eyes stay real geometry (procedural iris).
- Recolouring the skin tone in the wardrobe does not tint the photo area.

## 2a. Hair engine (strand hair)

```
groom (pure)      lib/world/hero/jade-groom.ts   guide strands over the updo volume
  ▼
simulation (pure) lib/hair/sim.ts                Verlet + PBD: roots on the head,
  │                                              shape memory, inextensible segments,
  │                                              collisions (skull, jaw, neck, shoulders)
  ▼
renderer          lib/world/render/hero/hair-render.ts
                  guide particles → float textures; one instanced draw grows every
                  visible strand on the GPU (clump offset, curl, camera-facing ribbon,
                  ≥ 1 px + alpha-hash fade); Kajiya–Kay shading on three.js lights
                  (white primary + coloured secondary highlight, transmission glow)
```

- **Groom (the portrait):** strands swept straight up from an arched
  hairline into a tall pompadour that narrows into a messy knot on the crown
  (`HAIR_KNOT`); sides pulled up above the ears; loose curls in front of the
  ears, behind them and at the nape; ~200 flyaways. Kinds: `updo` (stiff
  0.92→0.55), `knot` loops, `wisp` (0.35→0.04, they swing), `flyaway`.
- **Counts:** portrait ≈ 900 guides / ≈ 30 k strands; lab (`GROOM_DENSITY`
  0.55, `hairShare` 0.22) ≈ 420 guides / ≈ 3.3 k strands, simulation at
  1/60 s × 2 iterations ≈ 1 ms per frame (M1 Max).
- Built with the meshes in the hero worker (`buildJadeBundle` → `{ layers,
groom }`); `HeroRig.update(dt)` steps the simulation every frame (the
  engine after `applyPose`, the studio in its loop). The strands share the
  sculpted hair material's colour uniform, so the wardrobe recolours both.
- World-space simulation: walking, turning and head motion drag the hair
  with real inertia; teleports snap instead of whipping.

## 3. Skeleton & animation

`lib/world/hero/skeleton.ts`: an anatomical skeleton (≈ 7.3 heads,
1.70 m to the crown) with the **same 15 joint names, parents and rest
orientation** as the voxel rig. All poses in `models/rig.ts` (walk, run,
sit, lie, typing, climb, carry, wave …) are joint rotations plus small
translations and play unchanged. Skin weights: rigid layers follow one bone
(hair → head, hands → forearms, belt → hips, watch → left forearm); the neck
blends head → torso; clothes are weighted by inverse 4th-power distance to
the bone segments, **restricted per garment**: shirt/coat bodies follow only
hips and torso, sleeves only their arm (blending into the torso at the
shoulder seam), trousers never the arms, the coat skirt only hips +
`coatTail` (never the legs — the open front lets them swing).
`tests/world/hero-weights.test.ts` guards this (the old single-mesh coat
stretched into sheets under a lifted arm and when walking).

## 4. Shading

`materials.ts`: every surface is a `MeshPhysicalMaterial` with a procedural
layer injected via `onBeforeCompile`. The vertex's rest position (`rest`)
drives paint and bump — no textures, any wardrobe colour applies instantly.

- **Skin:** mottling, warm cheeks/nose/ears, freckles, silver lids,
  winged liner, lash lines, copper brows, dusty lips, a soft painted
  hairline, pore-scale bump, sheen as a cheap subsurface glow.
- **Hair:** strand noise along the flow, anisotropic highlight along
  per-vertex tangents pointing to the twist, darker roots.
- **Cloth / leather / metal:** weave, twill, grain, sole, stitching.
- **Eyes:** sclera with veins, fibrous brown iris, limbal ring, pupil,
  clearcoat cornea.
- **AO:** per-vertex SDF ambient occlusion against the union of all layers.
- Bumps fade with the pixel footprint (`fwidth`) — no shimmer in the iso view.

## 5. In the game

`LabEngine.installHero` swaps the voxel Jade for the real one as soon as the
worker delivers (keeps place, pose, hand props). Her meshes are on the hero
layer (drawn by `HeroPass`) and the shadow layer (she casts shadows into the
pixel world); her X-ray twins share the skeleton. The lantern is excluded
from her (it is tuned for matte voxels); a softer fill light follows her.
Wardrobe: `heroColorsForLook(look)` → `setHeroColors` (uniform updates only)

- visibility of the optional garments (coat, belt, watch).

## 6. Damien — veiled

`damien-skeleton.ts` / `damien-sculpt.ts` / `damien-build.ts`: tall
(≈ 5.77 units, under the 5.8 door limit), broad, slicked-back hair in a
knot, long pointed beard, white shirt. **He is only ever shown veiled**
until `isDamienRevealed(state)` (`lib/world/damien.ts`, flag `damien_found`,
never set by the current game — `tests/world/damien-reveal.test.ts`):

- `veil-material.ts`: every vertex snaps to a coarse block grid before
  skinning (body 0.9, head 1.45 voxels) — no facial geometry survives;
  colours are a cold cyan/teal/white block hash, with dropout, fraying
  edges, tearing rows, rolling scanlines and a fresnel glow; additive,
  no shadows.
- Engine: the echo NPC and the scene figure (`showFigure`) use the real
  veiled rig once loaded (`upgradeDamienEcho`, `damienRig`); the figure
  condenses out of the static (`setStrength`) instead of building part by
  part. Until the mesh is ready, the voxel veil (`models/veil.ts`) shows.

## 7. Tools

- `/studio` (dev only): `?view=portrait|bust|full|side|back|turn`,
  `?detail=game`, `?only=head,hair,strands`, `?yaw=<rad>`,
  `?pose=walk&t=0.4&speed=4` (any rig pose, frozen), `?hair=0`
- `/studio/damien` (dev only): veiled; `&reveal=1` dev preview
- Tests: `tests/sculpt/*`, `tests/hair/*` (simulation, groom),
  `tests/world/hero-*.test.ts` (incl. `hero-weights`),
  `tests/world/damien-hero.test.ts`, `tests/world/damien-reveal.test.ts`

## 8. Limits (honest)

- Procedural SDF sculpting reads as high-quality CG, not as a photo scan.
  The pipeline accepts any mesh with the 15 bones; a scanned/sculpted asset
  can replace a sculpt layer later without touching the engine.
- The wardrobe changes colours and the optional garments; garment
  _shapes_ of the 79 pieces are not sculpted individually yet.

## 9. Jade's real head (Blender + MPFB2, 2026-10-01)

The SDF face reached its ceiling ("good CG, not a person"). The head is now
an anatomical human built in Blender with **MPFB2** (MakeHuman; CC0 system
assets: skins, eyes, brows, lashes) — `scripts/hero/blender/`:

| File             | Job                                                                                                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jade.json`      | phenotype (female, ~40, tall, slim), ~30 face targets, expression units (closed-lip smile, slightly narrowed eyes, raised brow tails), brown iris, white shirt                                                                                                                                            |
| `jade_mpfb.py`   | builds the character headless, renders `face` / `portrait` / `full`; `--export-head`, `--hair`, `--face`                                                                                                                                                                                                  |
| `compare.py`     | render vs. reference portrait, aligned on the projected pupils (output only in `.crystal/`, the photo never enters the repo)                                                                                                                                                                              |
| `skin_bake.py`   | projects the de-lit portrait window (`public/hero/jade-face.webp`) onto the head through the pupil-aligned camera, face-oval / hair / grazing-angle masks, tone-matches the whole body skin, bakes into the skin texture                                                                                  |
| `hair.py`        | the game's groom (`scripts/hero/export-groom.ts`) as Blender hair curves: ~45 k strands, length jitter, waves, tip clumping, frizz; Principled Hair BSDF (Chiang)                                                                                                                                         |
| `export_head.py` | head + neck (cut inside the collar, y > 49.5) in character space, **aligned so the MPFB eye centres land on `JADE_EYES`** — eyes, bones, groom and hair colliders fit unchanged; morph target `blink` (MPFB eye-closure units); textures written next to the GLB (the CSP blocks the loader's blob: URLs) |

Game: `lib/world/render/hero/head-glb.ts` loads `public/hero/jade-head.glb`

- `jade-skin.jpg`; `buildHeroRig(layers, { head })` drops the SDF `head`
  layer and the lid caps, adds the textured head (`texturedSkinMaterial`:
  same red-shifted wrap lighting, sheen) skinned head → torso over the neck,
  and `setBlink` drives the morph. Engine and `/studio` load it automatically
  (`/studio?head=sdf` shows the old sculpt). Install MPFB once:
  `blender --online-mode --command extension install --sync --enable mpfb`
  and unpack `makehuman_system_assets_cc0.zip` into its user data directory.

Honest gaps: the skin texture is a front projection (flatter in profile);
the hairstyle still follows the old tower-like groom; a hard shadow edge
across the face shows in the studio light.
