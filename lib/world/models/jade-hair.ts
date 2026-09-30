/**
 * Jade's wardrobe — head, face and hairstyles (pure — no three).
 * ==============================================================
 *
 * The head (14×18×16, neck rows 0..1, face plane z 12..13, eyes rows 8..9,
 * brows rows 11..12, crown row 17, back z 1) is a skin volume with a hair
 * shell painted on by a per-style face mask, then capped round. Each
 * hairstyle also decides what hangs from the `hairBack` joint (ponytail,
 * braids, a shoulder-length curtain) and what sits on the crown (buns).
 * Colours come from the hair colourway: main strands, shade (dark locks,
 * brows), accent (sun-lightened strands).
 *
 * Headgear that `coversHair` tucks buns away (and the welding helmet the
 * whole hairBack); a cap keeps the ponytail, which comes out at the back.
 */
import { C } from "@/lib/world/content/palette";
import { WEAR_BY_ID } from "@/lib/world/content/wardrobe";
import {
  Canvas,
  SKIN,
  SKIN_SHADE,
  hash01,
  roundEdges,
  tint,
  type LookCtx,
  type Tone,
  type V3,
} from "@/lib/world/models/jade-kit";

/** Hair tones of the default auburn (brows stay natural under a dye). */
const AUBURN: Tone = { main: C.hair_auburn, shade: C.wood_red, accent: C.rust };
/** The teal hair tie. */
const TIE = C.sweater_teal;
const TIE_DK = C.paint_teal;

type Mask = (x: number, y: number, z: number) => boolean;

export interface HairStyle {
  /** True where skin shows (face, ears, neck). */
  face: Mask;
  /** Strand colour at a hair voxel. */
  strand: (t: Tone) => (x: number, y: number, z: number) => number;
  /** Ears drawn over the hair: [right (-x), left (+x)]. */
  ears: [boolean, boolean];
  /** Pencil behind the right ear. */
  pencil: boolean;
  /** Shape the shell before the crown is capped (trim close-cropped sides …). */
  trim?: (k: Canvas, t: Tone) => void;
  /** Loose strands, fringes, extra volume (after the face). */
  extras?: (k: Canvas, t: Tone) => void;
  /** Buns on the crown — skipped under crown-covering headgear. */
  crown?: (k: Canvas, t: Tone) => void;
  /** What hangs from the hairBack joint, drawn in HEAD coordinates; null = nothing. */
  back?: (k: Canvas, t: Tone) => void;
}

// ── Head volume ─────────────────────────────────────────────────

/** Skin volume of the head (rig.ts `headVolume`). */
export function headVolume(k: Canvas, skin: number, shade: number): void {
  k.box(5, 0, 5, 8, 1, 9, skin);
  k.box(5, 0, 9, 8, 0, 9, shade);
  const rows: Record<number, [hw: number, r: number, back: number]> = {
    2: [2.5, 1.5, 5],
    3: [3.5, 1.5, 4],
    4: [4.5, 1.5, 3],
  };
  for (let y = 2; y <= 16; y++) {
    const [hw, r, back] = rows[y] ?? (y >= 15 ? [y === 15 ? 4.6 : 3.8, 2.5, 3] : [5, 1.5, 2]);
    const cz = (back + 14) / 2;
    const hd = (14 - back) / 2;
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 14; x++) {
        const dx = Math.max(0, Math.abs(x + 0.5 - 7) - (hw - r));
        const dz = Math.max(0, Math.abs(z + 0.5 - cz) - (hd - r));
        if (dx * dx + dz * dz <= r * r + 0.01) k.set(x, y, z, skin);
      }
  }
}

/** Round off the top of a head (hair included) with an ellipsoid cap above row 12. */
function capHead(k: Canvas): void {
  k.forEach((x, y, z) => {
    if (y < 12) return;
    const e =
      ((x + 0.5 - 7) / 7.1) ** 2 + ((y + 0.5 - 8.5) / 9.6) ** 2 + ((z + 0.5 - 7.5) / 8.4) ** 2;
    if (e > 1) k.set(x, y, z, 0);
  });
}

/** Hair shell: every head voxel outside the face mask, plus a one-voxel layer of volume. */
function hairShell(
  k: Canvas,
  face: Mask,
  strand: (x: number, y: number, z: number) => number,
): void {
  const add: V3[] = [];
  k.forEach((x, y, z) => {
    if (y < 3) return;
    for (const [dx, dy, dz] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (!k.inBounds(nx, ny, nz) || k.get(nx, ny, nz)) continue;
      if (!face(nx, ny, nz)) add.push([nx, ny, nz]);
    }
  });
  for (const [x, y, z] of add) k.set(x, y, z, strand(x, y, z));
  k.forEach((x, y, z) => {
    if (y >= 3 && !face(x, y, z)) k.set(x, y, z, strand(x, y, z));
  });
}

let VOLUME: Canvas | null = null;
/** The bare skin volume (for trimming the hair shell back to the scalp). */
function scalp(): Canvas {
  if (!VOLUME) {
    VOLUME = new Canvas(14, 18, 16);
    headVolume(VOLUME, 1, 1);
  }
  return VOLUME;
}

/** Remove shell voxels outside the scalp where `where` holds (close-cropped hair). */
function cropTo(k: Canvas, where: (x: number, y: number, z: number) => boolean): void {
  const v = scalp();
  k.forEach((x, y, z) => {
    if (where(x, y, z) && !v.get(x, y, z)) k.set(x, y, z, 0);
  });
}

// ── Strand patterns ─────────────────────────────────────────────

/** Default: locks in 3-row runs, lighter towards the crown. */
const locks = (t: Tone) => (x: number, y: number, z: number) => {
  const n = hash01(x * 13 + z * 7, Math.floor((y + x) / 3));
  return n < 0.2 ? t.shade : n > (y > 13 ? 0.72 : 0.86) ? t.accent : t.main;
};

/** Pulled back: streaks run front to back. */
const combed = (t: Tone) => (x: number, y: number, z: number) => {
  const n = hash01(x * 11 + (y >> 1) * 5, Math.floor(z / 5));
  return n < 0.22 ? t.shade : n > 0.84 ? t.accent : t.main;
};

/** Hanging straight: streaks run down. */
const straight = (t: Tone) => (x: number, y: number, z: number) => {
  const n = hash01(x * 17 + z * 3, Math.floor(y / 5));
  return n < 0.2 ? t.shade : n > 0.83 ? t.accent : t.main;
};

// ── Hairstyles ──────────────────────────────────────────────────

/** Jade's default: fringe swept to her left, tucked behind the right ear. */
function jadeFace(x: number, y: number, z: number): boolean {
  if (y <= 2) return true;
  if (y >= 14) return false;
  if (y === 13) return z >= 11 && x <= 5;
  if (x <= 2) return z >= 7 && y <= 12;
  if (x >= 12) return false;
  if (x === 11) return z >= 12 && y <= 10;
  return z >= 10;
}

/** Hair pulled back off the face, both ears free. */
function pulledBack(x: number, y: number, z: number): boolean {
  if (y <= 2) return true;
  if (y >= 15) return false;
  if (y === 14) return z >= 12 && x >= 3 && x <= 10;
  if (x <= 2 || x >= 11) return z >= 7 && y <= 12;
  if (y === 13) return z >= 11;
  return z >= 10;
}

function tuftBack(t: Tone): (k: Canvas) => void {
  return (k) => k.set(7, 9, 7, t.main);
}

const PONYTAIL: HairStyle = {
  face: jadeFace,
  strand: locks,
  ears: [true, false],
  pencil: true,
  extras: (k, t) => {
    // Loose strands: down the left temple and over the jaw, a flyaway on the crown.
    k.box(12, 3, 13, 12, 9, 13, t.shade).set(13, 4, 12, t.shade).set(11, 10, 14, t.shade);
    k.set(6, 17, 14, t.accent).set(7, 17, 13, t.accent);
    k.box(8, 13, 13, 10, 13, 14, t.main).set(11, 12, 14, t.main).set(9, 12, 14, t.shade);
  },
};

/** Low ponytail with a teal tie (w6 h12 d4), hanging from the back of the head. */
export function ponytailCanvas(t: Tone): Canvas {
  const m = new Canvas(6, 12, 4);
  m.box(1, 10, 0, 4, 11, 3, TIE).set(1, 11, 0, TIE_DK).set(4, 10, 3, TIE_DK);
  m.box(0, 6, 0, 5, 9, 3, t.main);
  m.box(1, 2, 0, 4, 5, 3, t.main);
  m.box(2, 0, 1, 3, 1, 2, t.main);
  roundEdges(m, 0, 5, 0, 3, 6, 9);
  roundEdges(m, 1, 4, 0, 3, 2, 5);
  for (let y = 0; y <= 9; y++)
    for (let x = 0; x < 6; x++)
      for (let z = 0; z < 4; z++) {
        const s = (x * 5 + z * 3) % 4;
        if (m.get(x, y, z) && s === 0) m.set(x, y, z, y % 3 ? t.shade : t.accent);
      }
  m.set(5, 4, 2, t.shade).set(5, 3, 2, t.shade); // stray strand escaping the tie
  return m;
}

const BUN: HairStyle = {
  face: pulledBack,
  strand: combed,
  ears: [true, true],
  pencil: false,
  extras: (k, t) => {
    // Wisps escaping at the temples and the nape.
    k.set(1, 11, 11, t.shade).set(1, 10, 12, t.shade).set(12, 11, 11, t.main);
    k.set(12, 10, 12, t.shade).set(6, 3, 2, t.main);
  },
  crown: (k, t) => {
    k.free(() => {
      // A twisted bun high at the back, held by a pencil.
      k.sphere(7, 16.4, 3, 3.1, t.main);
      k.forEach((x, y, z) => {
        const d = Math.hypot(x - 7, y - 16.4, z - 3);
        if (d > 3.3 || y < 13) return;
        const a = Math.atan2(y - 16.2, x - 7) + d * 1.3;
        if (Math.sin(a * 2) > 0.55) k.set(x, y, z, t.shade);
        else if (Math.sin(a * 2 + 1.7) > 0.9) k.set(x, y, z, t.accent);
      });
      const pencil: V3[] = [];
      for (let i = 0; i <= 9; i++)
        pencil.push([Math.round(2 + i), Math.round(18.2 - i * 0.45), Math.round(5.2 - i * 0.35)]);
      pencil.forEach(([x, y, z], i) =>
        k.set(
          x,
          y,
          z,
          i === 0
            ? C.paper_pink
            : i === 1
              ? C.steel
              : i === 8
                ? C.wood_light
                : i === 9
                  ? C.paint_black
                  : C.paper_yellow,
        ),
      );
    });
  },
};

const LOOSE: HairStyle = {
  face: (x, y, z) => {
    if (y <= 2) return true;
    if (y >= 14) return false;
    if (y === 13) return z >= 12 && x >= 3 && x <= 6;
    if (x <= 2 || x >= 11) return false;
    return z >= 10;
  },
  strand: straight,
  ears: [false, false],
  pencil: false,
  extras: (k, t) => {
    const s = straight(t);
    k.free(() => {
      // Volume: a second layer over the sides and curtains down past the jaw.
      for (let y = 0; y <= 12; y++)
        for (let z = 3; z <= 12; z++) {
          if (y <= 2 && (z < 5 || z > 11)) continue;
          if (k.get(1, y, z) || y <= 2) k.set(0, y, z, s(0, y, z));
          if (k.get(12, y, z) || y <= 2) k.set(13, y, z, s(13, y, z));
          if (y <= 2) k.set(1, y, z, s(1, y, z)).set(12, y, z, s(12, y, z));
        }
      for (const x of [0, 13]) for (let z = 4; z <= 11; z += 3) k.set(x, 0, z, 0);
      // A parted fringe swept to her left.
      k.box(7, 13, 13, 11, 13, 14, t.main).box(8, 12, 14, 10, 12, 14, t.main);
      k.set(11, 11, 14, t.shade).set(9, 12, 14, t.shade).set(7, 12, 13, t.shade);
      k.set(2, 12, 13, t.main).set(2, 11, 13, t.shade);
    });
  },
  back: (k, t) => {
    const s = straight(t);
    // Shoulder-length curtain behind the head, uneven tips.
    for (let y = -4; y <= 12; y++)
      for (let x = 1; x <= 12; x++) {
        if (y <= -2 && hash01(x * 3, y) < 0.35 + (y === -4 ? 0.3 : 0)) continue;
        if (y >= 10 && (x <= 2 || x >= 11)) continue;
        k.set(x, y, 0, s(x, y, 0));
        if (y >= -1 && x >= 2 && x <= 11) k.set(x, y, -1, s(x, y, -1));
      }
  },
};

const BOB: HairStyle = {
  face: (x, y, z) => {
    if (y <= 2) return true;
    if (y >= 13) return false;
    if (x <= 2 || x >= 11) return false;
    return z >= 10;
  },
  strand: straight,
  ears: [false, false],
  pencil: false,
  extras: (k, t) => {
    const s = straight(t);
    k.free(() => {
      // Blunt fringe, full sides that flick out at the jaw, a full back.
      for (let x = 2; x <= 11; x++) {
        k.set(x, 13, 14, x % 3 ? t.main : t.shade).set(x, 14, 14, t.main);
        if (x % 2) k.set(x, 12, 14, t.shade);
      }
      for (let y = 3; y <= 13; y++)
        for (let z = 3; z <= 12; z++) {
          if (k.get(1, y, z)) k.set(0, y, z, s(0, y, z));
          if (k.get(12, y, z)) k.set(13, y, z, s(13, y, z));
        }
      for (let z = 4; z <= 11; z++) k.set(-1, 3, z, t.shade).set(14, 3, z, t.shade);
      for (let x = 2; x <= 11; x++)
        for (let y = 3; y <= 13; y++) if (k.get(x, y, 1)) k.set(x, y, 0, s(x, y, 0));
      k.box(3, 2, 1, 10, 3, 3, t.main);
    });
  },
};

const BRAIDS: HairStyle = {
  face: (x, y, z) => {
    if (y <= 2) return true;
    if (y >= 14) return false;
    if (y === 13) return z >= 11 && x >= 2 && x <= 11;
    if (x <= 2 || x >= 11) return z >= 7 && y <= 11;
    return z >= 10;
  },
  strand: (t) => (x, y, z) => {
    if (y >= 14 && x === 7 && z >= 7) return SKIN_SHADE;
    const n = hash01((x < 7 ? -1 : 1) * (y + z) * 3 + x, 7);
    return n < 0.22 ? t.shade : n > 0.85 ? t.accent : t.main;
  },
  ears: [true, true],
  pencil: false,
  back: (k, t) => {
    for (const c of [1, 12]) {
      // A three-strand plait from behind the ear down past the shoulder blades.
      for (let y = 10; y >= -9; y--) {
        const z0 = y >= 4 ? 2 : y >= 1 ? 1 : 0;
        const half = y <= -7 ? 0 : 1;
        if (y === -6) {
          k.box(c - 1, y, z0, c + 1, y, z0 + 1, TIE).set(c, y, z0 + 1, TIE_DK);
          continue;
        }
        for (let x = c - half; x <= c + half; x++)
          for (let z = z0; z <= z0 + 1; z++) {
            if (y <= -8 && hash01(x, y + z) < 0.4) continue;
            const w = (((y + (x - c) * (c === 1 ? 1 : -1)) % 3) + 3) % 3;
            k.set(x, y, z, w === 0 ? t.shade : w === 1 && x === c ? t.accent : t.main);
          }
      }
    }
  },
};

const SPACE_BUNS: HairStyle = {
  face: pulledBack,
  strand: (t) => (x, y, z) => (y >= 15 && x === 7 && z >= 5 ? SKIN_SHADE : combed(t)(x, y, z)),
  ears: [true, true],
  pencil: false,
  crown: (k, t) => {
    k.free(() => {
      for (const cx of [3.4, 10.6]) {
        k.sphere(cx, 17.4, 7.2, 2.8, t.main);
        k.forEach((x, y, z) => {
          const d = Math.hypot(x - cx, y - 17.2, z - 7.2);
          if (d > 2.7 || y < 15) return;
          const a = Math.atan2(z - 7.2, x - cx) + y * 0.9;
          if (Math.sin(a * 2) > 0.6) k.set(x, y, z, t.shade);
          else if (Math.sin(a * 3 + 1) > 0.92) k.set(x, y, z, t.accent);
        });
        for (let x = Math.floor(cx) - 2; x <= Math.ceil(cx) + 2; x++)
          for (let z = 5; z <= 9; z++)
            if (Math.abs(Math.hypot(x - cx, z - 7.2) - 2.2) < 0.6) k.set(x, 15, z, TIE);
      }
    });
  },
};

const PIXIE: HairStyle = {
  face: (x, y, z) => {
    if (y <= 2) return true;
    if (y >= 15) return false;
    if (y >= 13) return z >= 12 && x <= 7;
    if (x <= 2 || x >= 11) return z >= 6 && y <= 12;
    return z >= 10;
  },
  strand: locks,
  ears: [true, true],
  pencil: false,
  trim: (k) => cropTo(k, (_x, y, z) => y <= 12 || (z <= 2 && y <= 13)),
  extras: (k, t) => {
    k.free(() => {
      // Textured crown and a fringe swept to her left.
      for (const [x, y, z] of [
        [4, 17, 8],
        [6, 18, 9],
        [9, 17, 6],
        [10, 17, 10],
        [7, 18, 5],
        [3, 16, 11],
      ] as const)
        k.set(x, y, z, (x + z) % 2 ? t.accent : t.main);
      k.box(8, 13, 14, 11, 14, 14, t.main).set(11, 12, 14, t.shade).set(9, 12, 14, t.shade);
      k.set(10, 12, 14, t.main);
    });
  },
};

const UNDERCUT: HairStyle = {
  face: (x, y, z) => {
    if (y <= 2) return true;
    if (y >= 14) return false;
    if (y === 13) return z >= 12 && x <= 6;
    if (x <= 2 || x >= 11) return z >= 6 && y <= 12;
    return z >= 10;
  },
  strand: locks,
  ears: [true, true],
  pencil: false,
  trim: (k, t) => {
    const shaved = (x: number, y: number, z: number) => y <= 13 && (x <= 3 || x >= 10 || z <= 3);
    cropTo(k, shaved);
    // Stubble on the shaved sides and back.
    k.forEach((x, y, z, v) => {
      if (!shaved(x, y, z) || v === SKIN || y < 3) return;
      if (v === t.main || v === t.shade || v === t.accent)
        k.set(x, y, z, hash01(x * 5 + z, y) < 0.55 ? t.shade : SKIN_SHADE);
    });
  },
  extras: (k, t) => {
    k.free(() => {
      // Long top swept over to her left, falling past the part.
      for (let x = 4; x <= 10; x++)
        for (let z = 4; z <= 12; z++)
          if (k.get(x, 17, z) || k.get(x, 16, z)) k.set(x, 18, z, locks(t)(x, 18, z));
      for (let z = 5; z <= 12; z++) {
        k.box(11, 14, z, 12, 16, z, t.main);
        k.set(13, 14, z, z % 2 ? t.shade : t.main);
        k.set(13, 13, z, z % 3 ? t.shade : 0);
      }
      k.box(7, 13, 14, 10, 13, 14, t.main).set(9, 12, 14, t.shade).set(10, 14, 15, t.accent);
    });
  },
};

export const HAIR_STYLES: Readonly<Record<string, HairStyle>> = {
  hair_ponytail: PONYTAIL,
  hair_bun: BUN,
  hair_loose: LOOSE,
  hair_bob: BOB,
  hair_braids: BRAIDS,
  hair_space_buns: SPACE_BUNS,
  hair_pixie: PIXIE,
  hair_undercut: UNDERCUT,
};

/** Headgear that sits on the crown (buns are tucked away under it). */
const CROWN_GEAR = new Set([
  "hardhat",
  "welding_helmet",
  "beanie",
  "cap",
  "propeller_cap",
  "headphones",
  "antenna_band",
]);

export function hairTone(ctx: LookCtx): Tone {
  return ctx.hair?.t ?? AUBURN;
}

/** Brows keep Jade's natural colour under a dye. */
export function browTone(ctx: LookCtx): Tone {
  const h = ctx.hair;
  if (!h) return AUBURN;
  const cw = WEAR_BY_ID.get(h.id)?.colorways.find((c) => C[c.tones.main] === h.t.main);
  return cw?.dye ? AUBURN : h.t;
}

function styleOf(ctx: LookCtx): HairStyle {
  return HAIR_STYLES[ctx.hair?.id ?? ""] ?? PONYTAIL;
}

// ── The head ────────────────────────────────────────────────────

/** Head with face, ears and hair (headgear / face pieces: jade-gear.ts). */
export function headWithHair(k: Canvas, ctx: LookCtx): void {
  const t = hairTone(ctx);
  const style = styleOf(ctx);
  const headId = ctx.head?.id ?? "";
  headVolume(k, C.skin, C.skin_shadow);
  hairShell(k, style.face, style.strand(t));
  style.trim?.(k, t);
  capHead(k);
  // Face: cheeks, eyes, nose, mouth, chin.
  const face: readonly string[] = [
    // x 2..11, rows 12 (top) … 2 (bottom); z = 13 (x 2 / 11 at z 12).
    "..........",
    "LLLL..LLLL", // 10: lash line
    "WGGW..WGGW", // 9
    "WGPW..WPGW", // 8
    "....SS....", // 7: nose bridge shading
    ".b..NN..b.", // 6: blush, nose
    "....ss....", // 5: nostrils
    "..sMMMMs..", // 4: mouth
    "...lMMl...", // 3: lower lip
    "..........", // 2
  ];
  const pal: Record<string, number> = {
    L: C.walnut_dk,
    W: C.eye_white,
    G: C.eye_green,
    P: C.hair_black,
    S: C.skin_light,
    N: C.skin,
    s: C.skin_shadow,
    M: C.lips,
    l: C.skin_light,
    b: C.paper_pink,
  };
  face.forEach((row, r) => {
    const y = 11 - r;
    for (let i = 0; i < row.length; i++) {
      const c = pal[row[i]!];
      if (!c) continue;
      const x = 2 + i;
      const z = k.get(x, y, 13) ? 13 : 12;
      k.set(x, y, z, c);
    }
  });
  // Nose tip and bridge stand proud.
  k.box(6, 5, 14, 7, 7, 14, C.skin).set(6, 5, 14, C.skin_shadow).set(7, 5, 14, C.skin_shadow);
  k.set(6, 7, 14, C.skin_light);
  // Jaw shading under the chin.
  for (let x = 4; x <= 9; x++) tint(k, x, 2, 11, C.skin_shadow);
  const cups = headId === "headphones";
  if (style.ears[0] && !cups) {
    // Right ear, the pencil behind it and a small gold stud.
    k.box(1, 7, 7, 1, 9, 8, C.skin).set(1, 8, 7, C.skin_shadow);
    if (style.pencil && !ctx.head?.item.coversHair)
      k.box(0, 10, 5, 0, 10, 10, C.paper_yellow)
        .set(0, 10, 11, C.paper_pink)
        .set(0, 10, 4, C.wood_light);
    k.set(1, 6, 8, C.gold);
  }
  if (style.ears[1] && !cups) {
    k.box(12, 7, 7, 12, 9, 8, C.skin).set(12, 8, 7, C.skin_shadow);
    k.set(12, 6, 8, C.gold);
  }
  style.extras?.(k, t);
  if (style.crown && !CROWN_GEAR.has(headId)) style.crown(k, t);
}

/** Placeholder hairBack voxel buried in the skull (styles with nothing hanging). */
export function hairBackCanvas(ctx: LookCtx): { canvas: Canvas; origin: V3 } {
  const t = hairTone(ctx);
  const style = styleOf(ctx);
  const tucked = ctx.head?.id === "welding_helmet";
  if (style === PONYTAIL && !tucked) return { canvas: ponytailCanvas(t), origin: [3, 12, 4] };
  // Head coordinates: origin = the hairBack pivot in the head.
  const k = new Canvas(1, 1, 1);
  k.clip = null;
  if (!tucked && style.back) style.back(k, t);
  if (!k.count()) tuftBack(t)(k);
  return { canvas: k, origin: [7, 11, 0] };
}

/** Brows (w10 h2 d2): arched, tapered tails. */
export function browsCanvas(ctx: LookCtx): Canvas {
  const t = browTone(ctx);
  const m = new Canvas(10, 2, 2);
  m.box(1, 1, 0, 3, 1, 1, t.shade).set(0, 0, 1, t.main).set(0, 0, 0, t.shade);
  m.box(6, 1, 0, 8, 1, 1, t.shade).set(9, 0, 1, t.main).set(9, 0, 0, t.shade);
  m.set(3, 0, 1, t.shade).set(6, 0, 1, t.shade);
  return m;
}

/** Eyelids (w10 h2 d1): skin above a dark lash line. */
export function lidsCanvas(): Canvas {
  const m = new Canvas(10, 2, 1);
  m.box(0, 1, 0, 3, 1, 0, C.skin_shadow).box(6, 1, 0, 9, 1, 0, C.skin_shadow);
  m.box(0, 0, 0, 3, 0, 0, C.walnut_dk).box(6, 0, 0, 9, 0, 0, C.walnut_dk);
  return m;
}

export { SKIN };
