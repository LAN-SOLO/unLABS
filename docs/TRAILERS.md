# Social-media trailers

Four teasers for the community (requested 2026-10-03), released as numbered
**transmissions**. The campaign behind them (the link to the lab is up, and
the story starts now) is in docs/TRANSMISSIONS.md. They should tease, not
explain: no endings, no puzzle answers, no unveiled Damien, no UI tutorials.
Every frame is rendered in Blender from the game's own data. The voxels come
from `scripts/trailer/export.ts`, Jade is the game's hero sculpt, and the music
is the game's soundtrack (`scripts/audio/render-songs.ts`).

## Principles

- **Slow and confident.** Shots run 5–9 s. Every shot has exactly one camera
  move (push, pull, crane, orbit or lateral track), eased with a Bezier
  curve. Cuts land on the music: hard cuts on downbeats, dissolves on pads.
  There are no flash cuts.
- **Light tells the story.** The lab is dark and powers up on camera: lamps,
  screens and channels come on, and voxels assemble.
- **One question per trailer.** Each trailer ends on a line that invites
  speculation, then the logo and a status line (`TRANSMISSION 01 // LINK
ESTABLISHED`). We never write "coming soon" and never give a date.
- **The transmission layer.** A `TXnn  LINK nn%` readout (top right) and
  short signal glitches (RGB split, band tears, static, dropouts with the
  music ducking). Both follow the story: T01 starts at 12 % and stabilises,
  T02 holds at 100 %, T03 loses signal with depth and jumps back to 100 % in
  the cave. They are applied in post (`assemble.mjs`), so they stay sharp
  under depth of field and can be retimed without re-rendering.
- **Hidden in plain sight.** Each trailer hides one detail from the game for
  the community to find. Each one is the game's own data:
  - **Wake:** the data centre racks blink at 847 ms.
  - **Damien:** the radio room light pulses the chalk morse line.
  - **847 Metres:** the depth counter freezes on 847.
- **Voxels only** (docs/CLARITY.md). Jade is the only realistic figure,
  exactly as in the game. Damien appears only veiled (`veilRig`) and only
  for a few frames.
- **Text:** English, in a voxel bitmap font that is built from cubes in the
  scene and lit by the scene. The one exception is the type-on terminal
  lines, which glow like a CRT.

## Formats

- 16:9, 1920 × 1080 (YouTube, X, Discord).
- 9:16, 1080 × 1920 (Reels, TikTok, Shorts). Every shot has its own vertical
  camera: same set and timing, reframed. It is not a crop.
- 24 fps, H.264 High, AAC 320 k, −14 LUFS integrated.

## Transmission 00: "Signal", about 15 s

Music: _Handshake 3648_. The comeback post. Black. `_unOS // EXTERNAL LINK
REQUEST`, then the handshake fails twice (847 ms apart, with dropouts) and
holds: `LINK ESTABLISHED`. One second of the MCP and two seconds of the lit
control room (frames borrowed from T01), heavily glitched while the link
climbs from 4 % to `STABLE`. Then the logo, `LINK ESTABLISHED.` and
`TRANSMISSION 00`.

## Trailer 1: "Still Running" (Wake), about 63 s

Music: _Boot Sequence_ (electronic, 124 BPM). \_unOS wakes line by line.

| #   | Time | Set       | Shot                                                                                                                                                                            |
| --- | ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0:00 | kontroll  | Black. CRT type-on: `_unOS // EXTERNAL LINK REQUEST`, `HANDSHAKE 3648 ... OK`, `DORMANCY: 2,561 DAYS`, `EXTERNAL CONTACT: ESTABLISHED`, `MCP-000 ... RESPONDING (RELUCTANTLY)`. |
| 2   | 0:07 | kontroll  | The control room in darkness, lit only by its screens. A slow push in. The ceiling lamps click on one by one toward the camera.                                                 |
| 3   | 0:14 | mcp       | MCP-000 from a low angle. Its red core breathes, the racks around it wake in a wave, and the camera pushes in.                                                                  |
| 4   | 0:21 | werkstatt | A device assembles voxel by voxel in a slow orbit (the game's build drop, slowed down).                                                                                         |
| 5   | 0:28 | rechen    | A lateral track along the racks. LEDs blink in the 847 ms beat.                                                                                                                 |
| 6   | 0:34 | botdepot  | A dormant bot in its dock. Its eyes light up, it switches to its awake model, and the camera pushes in.                                                                         |
| 7   | 0:41 | signal    | The synthesizer by the east wall wakes key by key as the room's lights come up.                                                                                                 |
| 8   | 0:47 | kontroll  | A high pull-back over the fully lit control room, with light shafts through the haze.                                                                                           |
| 9   | 0:55 | title     | The voxel logo `_unLABS` assembles. `THE LAB NEVER SLEPT.`                                                                                                                      |

## Trailer 2: "Where Is Damien?", about 70 s

Music: _Letters to Damien_ (calm, 58 BPM, piano waltz).

| #   | Time | Set           | Shot                                                                                                              |
| --- | ---- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | 0:00 | —             | Black. Terminal type-on: `SEARCHING FOR D. FRIDGE ...` then `NO SIGNAL`.                                          |
| 2   | 0:06 | kontroll      | Jade from behind in the doorway, looking into the dim control room. A slow push past her shoulder.                |
| 3   | 0:14 | damienq       | A slow lateral track across Damien's quarters: legal pads, a cold mug, the grandfather clock.                     |
| 4   | 0:22 | observatorium | A slow orbit around the telescope, "still pointing where Damien left it".                                         |
| 5   | 0:30 | funkraum      | The chalk morse line on the wall. The sconce light pulses in the morse rhythm (the hidden detail).                |
| 6   | 0:37 | kartenraum    | A push into the cork wall: notes and red threads.                                                                 |
| 7   | 0:44 | kontroll      | The surveillance station screen: static, a camera feed, and for half a second a veiled figure. Then static again. |
| 8   | 0:51 | kontroll      | A close profile of Jade. She turns her head toward the camera, then cut.                                          |
| 9   | 0:58 | title         | `WHERE IS DAMIEN?`, then the logo.                                                                                |

## Trailer 3: "847 Metres", about 75 s

Music: _The Shaft Breathes_ (ambient, 56 BPM) into _Overture: The Halo
Awakens_ at the bottom. A depth counter in voxel digits runs from 0 M down to
847 M.

| #   | Time | Set      | Shot                                                                                                               |
| --- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | 0:00 | aufzug4  | The top rotunda (L+1), looking straight down the core. `0 M`.                                                      |
| 2   | 0:07 | aufzug0  | Descending through the L0 rotunda; the elevator ring passes the camera.                                            |
| 3   | 0:14 | rechen   | L−1. The data centre breathes in its rhythm. A slow downward crane.                                                |
| 4   | 0:21 | anomalie | L−2. Purple shards and broken glass, with the light glitching.                                                     |
| 5   | 0:28 | forge    | L−3. The Infinity Forge glows in the dark. A push in.                                                              |
| 6   | 0:36 | x9kammer | The containment pod, with halo dust drifting in the light.                                                         |
| 7   | 0:43 | bohrung  | Borehole #1. The drill head and the rings in the floor. The camera tilts down.                                     |
| 8   | 0:51 | hoehle   | The crystal cave: the crystal wall wakes in cerulean light, and two shadows are cast where only one figure stands. |
| 9   | 1:00 | title    | `847. NOT CHOSEN. GIVEN.`, then the logo.                                                                          |

## Pipeline

```
pnpm trailer:export                         # sets + cast → .voxel/trailer/
node scripts/trailer/render.mjs t1 h        # Blender EEVEE frames (h = 16:9, v = 9:16)
node scripts/trailer/assemble.mjs t1 h      # ffmpeg: clips, transitions, music, transmission layer → .voxel/trailer/out/
node scripts/trailer/assemble.mjs t1 h --clean   # without readouts and glitches
```

- **Sets** (`scripts/trailer/sets.ts`): one floor box per room. Each box holds
  the terrain refined 2×, the doors, the detailed devices, the props and the
  decor, placed exactly as the engine places them, plus the light list.
- **Shots** (`scripts/trailer/blender/shots.py`): one function per shot. It
  builds the set, the camera keys for both formats and the light and glow
  keys. `lab.py` holds the shared look: EEVEE, haze, bloom, AgX, and the
  per-object `glow` property that drives emission.
- **Text** (`scripts/trailer/blender/font.py`): a 5 × 7 voxel font. The post
  layer draws the same glyphs as crisp PNGs (`hud.mjs`).
- **Transmission layer** (`timeline.mjs` per shot: `link`, `label`,
  `glitch`, `auto`; logic in `glitch.mjs`): the link readout, level labels,
  and glitches whose density follows the link. Each glitch also gets a
  crushed-static burst on the audio, and dropouts duck the music.
- **Cameras** (`path()` in shots.py) keep a clear sight line. If a wall or
  cabinet stands between the subject and the eye, the eye moves in front of
  it (`_sightline`). Pass `clamp=False` for shots that must stay exactly as
  framed.
- **Jade** (`scripts/trailer/jade.ts`, `blender/jade.py`): the hero layers,
  the head glb, the armature and the hair strands.
