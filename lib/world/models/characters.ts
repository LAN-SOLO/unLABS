/**
 * Characters and lore bots.
 * =========================
 *
 * Humanoids live in `rig.ts` (`jadeRig`, `damienRig`: a jointed part
 * hierarchy with face parts — brows, blinking lids — plus pure pose,
 * transition and prop functions). This module keeps the legacy
 * five-piece `CharacterParts` split (body / legs / arms) for the simple
 * walk rig, derived from the rest pose of the new rigs.
 *
 * Bots are `DeviceVisual`s at BOT_SCALE (0.125 world units per voxel,
 * ≤ 24 voxels = 3 world units tall, ≤ 28 voxels across) designed from
 * NAR_LORE_bot-origins / GD_SOCIAL_bot-catalog (designs in `bots.ts`):
 * every lore bot has its own silhouette, 4–10 animated parts
 * (≤ BOT_PART_BUDGET), status LEDs and wear. They are authored at the
 * refined resolution and flagged `fine` (meshed as is, refine family
 * "hires"), like the MCP avatar and the humanoid rigs. Parts never use
 * `parent`, so they work with any part-nesting convention.
 *
 * Awake vs dormant (`botVisual(id, awake)`):
 * - awake (default): every part and light is always-on (`requiresPower:
 *   false`) — the bot animates whatever `rig.powered` says.
 * - dormant: the base's emissive voxels are baked dark, every part and
 *   light needs power (the engine builds the rig with `powered = false`, so
 *   parts rest frozen and dark, blink-kind eyes/LEDs vanish), sagging parts
 *   (antennas, arms, heads) become static `step` parts at their slumped
 *   angle, and floating extras (sparks, glitches) are left out.
 */
import { C } from "@/lib/world/content/palette";
import {
  fanRotor,
  glow,
  mount,
  ringModel,
  stencil,
  visual,
  type AnimPart,
  type DeviceVisual,
  type ScreenSpec,
  type VisualLight,
} from "@/lib/world/models/anim";
import { cable, drum, paint } from "@/lib/world/models/bot-kit";
import { BOT_DESIGNS, genericBot, lamp, type BotDesign } from "@/lib/world/models/bots";
import { Model, stagedGrid } from "@/lib/world/models/core";
import {
  CHARACTER_SCALE,
  RIG_UNIT,
  damienRig,
  holoColor,
  jadeRig,
  posedVoxels,
  type CharacterRigDef,
  type RigPartName,
} from "@/lib/world/models/rig";

export interface CharacterParts {
  body: Model;
  legL: Model;
  legR: Model;
  armL: Model;
  armR: Model;
  /** Pivot heights (model voxels) for hips and shoulders. */
  hip: number;
  shoulder: number;
  width: number;
  /** World units per model voxel (engine default 0.3). */
  scale?: number;
}

// ── Legacy split of the rigs ─────────────────────────────────────
//
// Engine contract (buildCharacter): body corner at (-width/2, hip, -4);
// legs hang from (±3, hip, 0) centred in x/z; arms hang from
// (±(width/2 + 1), shoulder, 0) centred in x/z. "L" parts sit at -x.
// Fine-scale rig voxels (RIG_UNIT per pose unit).

const U = RIG_UNIT;
const LEGACY_HIP = 12 * U;
const LEGACY_SHOULDER = 22 * U;
const LEGACY_WIDTH = 10 * U;

function bake(
  def: CharacterRigDef,
  names: readonly RigPartName[],
  size: [number, number, number],
  map: (p: [number, number, number]) => [number, number, number],
): Model {
  const m = new Model(size[0], size[1], size[2]);
  const want = new Set<RigPartName>(names);
  for (const v of posedVoxels(def)) {
    if (!want.has(v.part)) continue;
    const [x, y, z] = map(v.p);
    const cx = Math.min(size[0] - 1, Math.max(0, x));
    const cz = Math.min(size[2] - 1, Math.max(0, z));
    if (y >= 0 && y < size[1]) m.set(cx, y, cz, v.color);
  }
  return m;
}

function legacyParts(def: CharacterRigDef): CharacterParts {
  const f = Math.floor;
  const leg = (names: RigPartName[], cx: number): Model =>
    bake(def, names, [3 * U, LEGACY_HIP, 5 * U], (p) => [
      f(p[0] - cx + 1.5 * U),
      f(p[1]),
      f(p[2] + 2.5 * U),
    ]);
  const arm = (names: RigPartName[], cx: number): Model =>
    bake(def, names, [3 * U, 10 * U, 3 * U], (p) => [
      f(p[0] - cx + 1.5 * U),
      f(p[1] - (LEGACY_SHOULDER - 10 * U)),
      f(p[2] + 1.5 * U),
    ]);
  // Lids rest inside the skull (hidden), brows are part of the face.
  const body = bake(
    def,
    ["hips", "torso", "head", "hairBack", "brows"],
    [LEGACY_WIDTH, 19 * U, 7 * U],
    (p) => [f(p[0] + LEGACY_WIDTH / 2), f(p[1] - LEGACY_HIP), f(p[2] + 2 * U)],
  );
  const side = LEGACY_WIDTH / 2 + 0.5 * U;
  return {
    body,
    legL: leg(["thighR", "shinR"], -1.5 * U),
    legR: leg(["thighL", "shinL"], 1.5 * U),
    armL: arm(["upperArmR", "forearmR"], -side),
    armR: arm(["upperArmL", "forearmL"], side),
    hip: LEGACY_HIP,
    shoulder: LEGACY_SHOULDER,
    width: LEGACY_WIDTH,
    scale: CHARACTER_SCALE,
  };
}

function holoModel(src: Model): Model {
  const out = new Model(src.w, src.h, src.d);
  src.grid.forEach((x, y, z, v) => out.set(x, y, z, holoColor(v)));
  return out;
}

/** Jade Lawrence (legacy five-piece split of `jadeRig()`). */
export function jadeModel(): CharacterParts {
  return legacyParts(jadeRig());
}

/** Damien's echo as a hologram (glass classes) — he is a pattern, not a body. */
export function damienModel(): CharacterParts {
  const p = damienSolidModel();
  return {
    ...p,
    body: holoModel(p.body),
    legL: holoModel(p.legL),
    legR: holoModel(p.legR),
    armL: holoModel(p.armL),
    armR: holoModel(p.armR),
  };
}

export function damienSolidModel(): CharacterParts {
  return legacyParts(damienRig(false));
}
// ── Bots ─────────────────────────────────────────────────────────

/** World units per bot voxel (fine scale: half the old edge, twice the voxels, same size). */
export const BOT_SCALE = 0.125;
/** Tallest a bot may be, in voxels (incl. parts) → 3 world units. */
export const BOT_MAX_HEIGHT = 24;
/** Widest a bot base may be, in voxels → 3.5 world units. */
export const BOT_MAX_WIDTH = 28;
/**
 * Most animated parts a bot may carry (each is one mesh → draw calls per
 * bot). 10: the fine designs add a few small moving parts (K2-LDR's
 * stamp, W2-REK's mandibles) on top of the old 4–8.
 */
export const BOT_PART_BUDGET = 10;

function bot(
  base: Model,
  parts: AnimPart[],
  lights: VisualLight[],
  screens?: ScreenSpec[],
): DeviceVisual {
  const v = visual(base, parts, lights);
  v.scale = BOT_SCALE;
  v.fine = true;
  if (screens) v.screens = screens;
  return v;
}

/** Copy of `m` with every emissive voxel baked to its unlit colour. */
function darkened(m: Model): Model {
  const out = new Model(m.w, m.h, m.d);
  stagedGrid(m.grid, 1, false).forEach((x, y, z, v) => out.set(x, y, z, v));
  return out;
}

function finish(d: BotDesign, awake: boolean): DeviceVisual {
  if (awake) return bot(d.base, d.parts, d.lights, d.screens);
  const hide = new Set(d.awakeOnly ?? []);
  const parts = d.parts
    .filter((p) => !hide.has(p.name))
    .map((p): AnimPart => {
      const s = d.slump?.[p.name];
      // `step` at speed 0 rests at `phase` whether powered or not.
      return s
        ? {
            ...p,
            kind: "step",
            axis: s.axis,
            speed: 0,
            amplitude: 0,
            phase: s.angle,
            requiresPower: true,
          }
        : { ...p, requiresPower: true };
    });
  const lights = d.lights.map((l) => ({ ...l, requiresPower: true }));
  const screens = d.screens?.map((s) => ({ ...s, requiresPower: true }));
  return bot(darkened(d.base), parts, lights, screens);
}

/** Lore bot ids with a dedicated design. */
export const BOT_IDS: readonly string[] = Object.keys(BOT_DESIGNS);

/**
 * Visual for a bot. `awake = false` gives the dormant look (see the module
 * doc): build its rig with `powered = false` and swap to the awake visual
 * once `bot_<id>_awake` is set.
 */
export function botVisual(id: string, awake = true): DeviceVisual {
  return finish((BOT_DESIGNS[id] ?? genericBot)(), awake);
}

/**
 * The MCP's avatar: a floor projector beside MCP-000 that throws a
 * floating red eye. The projector (turning lens collar, vent fan, status
 * LED) is hardware; the eye (iris, pupil, glint, scanlines), its lids, the
 * beam cone and the crown are light — every part needs power, so while
 * MCP-000 is dark (`rig.powered = false`) the hologram vanishes and the
 * hardware stands still. Fine scale like the bots.
 */
export function mcpAvatarVisual(): DeviceVisual {
  const m = new Model(18, 6, 18);
  const c = 8.5;
  m.cyl(c, c, 8.4, 0, 0, C.rubber);
  drum(m, c, c, 7.6, 1, 3, C.steel_dark, C.steel);
  m.cyl(c, c, 6.4, 4, 4, C.bot_dark);
  m.ring(c, c, 6.4, 4, C.metal_dark);
  m.ring(c, c, 4.2, 4, C.steel);
  m.cyl(c, c, 3, 5, 5, C.metal_dark);
  m.cyl(c, c, 2, 4, 5, C.glass_red);
  m.ring(c, c, 2.6, 5, C.chrome);
  // Feet bolts, radial vent slots, a cable to MCP-000, the ID label, grime.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    const x = Math.round(c + Math.cos(a) * 7.6);
    const z = Math.round(c + Math.sin(a) * 7.6);
    if (m.grid.get(x, 2, z)) m.set(x, 2, z, k % 2 ? C.black : C.metal_dark);
    m.set(Math.round(c + Math.cos(a) * 8.2), 0, Math.round(c + Math.sin(a) * 8.2), C.chrome);
  }
  cable(m, [8, 0, 0], [9, 0, 2], C.cable_red);
  m.set(8, 1, 1, C.cable_red);
  paint(m, "+z", 16, 5, 1, 12, 3, C.paper);
  stencil(m, "+z", 16, 5, 1, "MCP", C.mcp_red);
  m.set(3, 1, 4, C.grime).set(13, 1, 14, C.grime).set(12, 3, 3, C.grime);
  // Eye: dark rim, iris gradient with radial striations and scanlines, hot pupil, glint.
  const eye = new Model(11, 11, 1);
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 11; x++) {
      const d = Math.hypot(x - 5, y - 5);
      if (d > 5.3) continue;
      const a = Math.atan2(y - 5, x - 5);
      let col: number;
      // Dark rim in the emissive class (led_bezel): the eye stays one material.
      if (d > 4.5) col = C.led_bezel;
      else if (d < 1.1) col = C.led_white;
      else if (d < 1.9) col = C.white_gold;
      else if (d < 3) col = C.led_red;
      else col = Math.abs(Math.sin(a * 4)) < 0.25 ? C.led_red : C.mcp_red;
      if (d >= 1.9 && d <= 4.5 && y % 2 === 1) col = col === C.led_red ? C.mcp_red : C.screen_red;
      eye.set(x, y, 0, col);
    }
  eye.set(3, 7, 0, C.led_white).set(4, 7, 0, C.gamma);
  // Lids: closed bars over the eye, shown for a moment every few seconds.
  const lids = new Model(11, 11, 1);
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 11; x++)
      if (Math.hypot(x - 5, y - 5) <= 5.3) lids.set(x, y, 0, y === 5 ? C.mcp_red : C.metal_dark);
  const collar = ringModel(6, "xz", C.mcp_red, C.led_white);
  const crown = ringModel(4.4, "xz", C.glass_red);
  const beam = new Model(5, 5, 5);
  for (let y = 0; y < 5; y++) beam.cyl(2, 2, 0.6 + y * 0.45, y, y, C.glass_red, y > 1);
  const p = { power: true } as const;
  return bot(
    m,
    [
      mount("eye", eye, [9, 15, 9.5], "blink", {
        speed: 0.1,
        amplitude: 1,
        ...p,
      }),
      mount("lids", lids, [9, 15, 10.5], "blink", {
        speed: 0.23,
        amplitude: 0.05,
        phase: 2,
        ...p,
      }),
      mount("beam", beam, [9, 8.5, 9], "blink", {
        speed: 6,
        amplitude: 0.85,
        ...p,
      }),
      mount("crown", crown, [9, 22, 9], "blink", {
        speed: 0.35,
        amplitude: 0.8,
        ...p,
      }),
      mount("halo", collar, [9, 7, 9], "spin", { speed: 0.6, ...p }),
      mount("fan", fanRotor(2, "xy", C.steel, C.metal_dark), [9, 2.5, 0.5], "spin", {
        axis: "z",
        speed: 4,
        ...p,
      }),
      mount("status", lamp(1, 1, C.led_red), [9, 2.5, 17], "blink", {
        speed: 1.2,
        amplitude: 0.5,
        ...p,
      }),
    ],
    [glow([9, 15, 10], "led_red", 2.5, 5, true, true)],
  );
}

/** Static bot model (compatibility with the pre-animation engine). */
export function botModel(kind: string): Model {
  return botVisual(kind).base;
}
