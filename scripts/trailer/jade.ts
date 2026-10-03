/**
 * Trailer hero: the realistic Jade for Blender (scripts/trailer/blender/jade.py).
 *
 *   node_modules/.bin/vite-node --config scripts/audio/vite.config.mjs scripts/trailer/jade.ts [portrait|game] [--share=1]
 *
 * Exports exactly what the engine draws for the hero Jade (hero-rig.ts):
 *  - every sculpt layer, meshed and skinned by build.ts (buildJadeBundle),
 *    with the default look's colour per material (heroColorsForLook);
 *  - the 15 hero joints (skeleton.ts) with rest positions + suggested tails;
 *  - the hair: every child strand grown around the groom's guides with the
 *    same clump rules as the GPU strands (hair-render.ts vertex shader),
 *    in the rest pose (no simulation);
 *  - where the real head goes (public/hero/jade-head.glb + jade-skin.jpg,
 *    head-glb.ts): the GLB is already in character space, aligned on
 *    JADE_EYES, so it only needs the axis swap + the hero unit.
 *
 * Writes .voxel/trailer/jade/ (gitignored):
 *   jade.json                manifest (layers, joints, colours, head, hair, eyes)
 *   layers/<id>.bin          per layer: positions f32×3, normals f32×3,
 *                            indices u32, skinIndex u16×4, skinWeight f32×4, ao f32
 *                            (offsets/counts in jade.json)
 *   hair.bin                 strands: positions f32×3 per point, radius f32 per point,
 *                            then per strand: depth f32, var f32, kind u8
 *
 * Space: character space in model voxels (feet y = 0, front +z, Jade's right
 * −x). The engine scales it by HERO_UNIT_DEFAULT (= JADE_SCALE, 0.09 world
 * units per voxel); Blender maps game (x, y, z) → (x, −z, y).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { __setLocaleForTests } from "@/lib/i18n";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const OUT = join(ROOT, ".voxel/trailer/jade");
const DETAIL = (process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "portrait") as
  | "portrait"
  | "game";
const SHARE = Number(
  process.argv.find((a) => a.startsWith("--share="))?.slice("--share=".length) ?? "1",
);
/** Points per exported strand (the GPU walks the 16 guide particles; 24 keeps curls round). */
const STRAND_POINTS = 24;

type V3 = [number, number, number];

/** Same LCG as hair-render.ts (identical strand set for the same groom). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Concatenate typed arrays into one buffer, recording byte offsets (4-byte aligned). */
class Packer {
  private parts: Buffer[] = [];
  private size = 0;
  add(a: ArrayBufferView): { offset: number; bytes: number } {
    const pad = (4 - (this.size % 4)) % 4;
    if (pad) {
      this.parts.push(Buffer.alloc(pad));
      this.size += pad;
    }
    const offset = this.size;
    this.parts.push(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
    this.size += a.byteLength;
    return { offset, bytes: a.byteLength };
  }
  write(path: string): void {
    writeFileSync(path, Buffer.concat(this.parts));
  }
}

async function main(): Promise<void> {
  __setLocaleForTests("en");
  const { buildJadeBundle } = await import("@/lib/world/hero/build");
  const { JADE_HERO_JOINTS, JADE_BODY } = await import("@/lib/world/hero/skeleton");
  const { JADE_EYES, EYE_R, HAIR_TWIST } = await import("@/lib/world/hero/jade-sculpt");
  const { heroColorsForLook } = await import("@/lib/world/hero/look-colors");
  const { DEFAULT_LOOK } = await import("@/lib/world/content/wardrobe");
  const { JADE_SCALE } = await import("@/lib/world/models/jade-kit");

  mkdirSync(join(OUT, "layers"), { recursive: true });
  const t0 = Date.now();
  const bundle = buildJadeBundle(DETAIL);
  const tBuild = Date.now() - t0;
  const look = heroColorsForLook(DEFAULT_LOOK);

  // ── Layers ──────────────────────────────────────────────────
  /** Material → colour key of HeroColors (materials.ts createHeroMaterials). */
  const colourOf: Record<string, { base: string; accent?: string }> = {
    skin: { base: look.colors.skin, accent: look.colors.brows },
    hair: { base: look.colors.hair },
    shirt: { base: look.colors.shirt, accent: look.colors.shirtAccent },
    coat: { base: look.colors.coat },
    trousers: { base: look.colors.trousers },
    boots: { base: look.colors.boots, accent: "#d9c7a0" },
    trim: { base: "#d8d4cc" },
    belt: { base: look.colors.belt },
    watch: { base: look.colors.watch, accent: look.colors.watchFace },
  };
  /** Optional garments: shown only when the look wears them (engine recolorHero). */
  const wornOf: Record<string, boolean> = {
    coat: look.worn.coat,
    coatSleeves: look.worn.coat,
    belt: look.worn.belt,
    watch: look.worn.watch,
  };
  const layers = bundle.layers.map((l) => {
    const p = new Packer();
    const entry = {
      id: l.id,
      material: l.material,
      colour: colourOf[l.material] ?? { base: "#ffffff" },
      worn: wornOf[l.id] ?? true,
      /** The real head replaces this layer when jade-head.glb is used. */
      replacedByGlb: l.id === "head",
      vertices: l.positions.length / 3,
      triangles: l.indices.length / 3,
      file: `layers/${l.id}.bin`,
      positions: p.add(l.positions),
      normals: p.add(l.normals),
      indices: p.add(l.indices),
      skinIndex: p.add(l.skinIndex),
      skinWeight: p.add(l.skinWeight),
      ao: p.add(l.ao),
    };
    p.write(join(OUT, entry.file));
    return entry;
  });

  // ── Joints ──────────────────────────────────────────────────
  // Tails only orient the Blender bones (the game's bones are points with
  // identity rest rotation); they point down the chain like real bones.
  const B = JADE_BODY;
  const at = new Map(JADE_HERO_JOINTS.map((j) => [j.name, j.at as V3]));
  const tails: Record<string, V3> = {
    hips: at.get("torso")!,
    torso: at.get("head")!,
    head: [0, B.crown - 0.6, -0.7],
    hairBack: [0, 62.4, -2.6],
    upperArmR: at.get("forearmR")!,
    forearmR: [-B.wrist[0], B.wrist[1], B.wrist[2]],
    upperArmL: at.get("forearmL")!,
    forearmL: [B.wrist[0], B.wrist[1], B.wrist[2]],
    thighR: at.get("shinR")!,
    shinR: [-B.ankle[0], B.ankle[1], B.ankle[2]],
    thighL: at.get("shinL")!,
    shinL: [B.ankle[0], B.ankle[1], B.ankle[2]],
    coatTail: [0, B.hipJointY - 8, -3.6],
    brows: [0, 57.4, 4.2],
    lids: [0, B.eyeY, 4.0],
  };
  const joints = JADE_HERO_JOINTS.map((j) => ({
    name: j.name,
    parent: j.parent,
    head: j.at,
    tail: tails[j.name]!,
  }));

  // ── Hair strands (hair-render.ts, CPU port of its vertex shader) ─────
  const groom = bundle.groom;
  const P = groom.points;
  const r = rng(0x5eed);
  const pos: number[] = [];
  const rad: number[] = [];
  const sDepth: number[] = [];
  const sVar: number[] = [];
  const sKind: number[] = [];
  const KINDS = ["updo", "knot", "wisp", "flyaway"] as const;
  const last = P - 1;
  for (const g of groom.guides) {
    const gp = (i: number): V3 => [g.rest[i * 3]!, g.rest[i * 3 + 1]!, g.rest[i * 3 + 2]!];
    const gn = (i: number): V3 => [g.normals[i * 3]!, g.normals[i * 3 + 1]!, g.normals[i * 3 + 2]!];
    const n = Math.max(
      g.kind === "wisp" || g.kind === "flyaway" ? 1 : 2,
      Math.round(g.children * SHARE),
    );
    for (let c = 0; c < n; c++) {
      // Same random draws, same order as createHairStrands.
      const across = (r() + r() + r()) / 1.5 - 1;
      const depthR = Math.pow(r(), 1.6);
      const phase = r() * Math.PI * 2;
      const curlR = g.curl * (0.5 + r());
      const turns = g.curlTurns * (0.7 + 0.6 * r());
      const width = g.width * (0.7 + 0.6 * r());
      const vari = r();
      const lenK = 0.82 + 0.18 * r();
      for (let s = 0; s < STRAND_POINTS; s++) {
        const aSeg = (s / (STRAND_POINTS - 1)) * last;
        const i = aSeg * lenK;
        const i0 = Math.floor(i);
        const i1 = Math.min(i0 + 1, last);
        const f = i - i0;
        const a = gp(i0);
        const b1 = gp(i1);
        const p: V3 = [
          a[0] + (b1[0] - a[0]) * f,
          a[1] + (b1[1] - a[1]) * f,
          a[2] + (b1[2] - a[2]) * f,
        ];
        let t: V3 = [b1[0] - a[0], b1[1] - a[1], b1[2] - a[2]];
        if (t[0] * t[0] + t[1] * t[1] + t[2] * t[2] < 1e-10) {
          const e = gp(last);
          const o = gp(0);
          t = [e[0] - o[0], e[1] - o[1], e[2] - o[2]];
        }
        t = norm(t);
        const na = gn(i0);
        const nb = gn(i1);
        let nn = norm([
          na[0] + (nb[0] - na[0]) * f,
          na[1] + (nb[1] - na[1]) * f,
          na[2] + (nb[2] - na[2]) * f,
        ]);
        const k = dot(nn, t);
        nn = norm([nn[0] - t[0] * k + 1e-5, nn[1] - t[1] * k + 1e-5, nn[2] - t[2] * k + 1e-5]);
        const bb = norm(cross(t, nn));
        const u = i / last;
        const spread = g.spreadRoot + (g.spreadTip - g.spreadRoot) * u;
        const depth = (1 - depthR) * g.depth * smoothstep(0, 0.35, u);
        const ca = phase + u * turns * Math.PI * 2;
        const fz = phase * 3.1;
        const fa = Math.sin(u * 13 + fz) * (0.012 + 0.05 * u * u);
        const fb = Math.cos(u * 9 + fz * 1.7) * (0.012 + 0.05 * u * u);
        const cr = curlR * (0.4 + u);
        const kb = fa + across * spread + Math.cos(ca) * cr;
        const kn = fb + depth + Math.sin(ca) * cr;
        pos.push(
          p[0] + bb[0] * kb + nn[0] * kn,
          p[1] + bb[1] * kb + nn[1] * kn,
          p[2] + bb[2] * kb + nn[2] * kn,
        );
        // Ribbon width → radius: tapers to the tip, fine single hairs at the root.
        const w = width * (1 - 0.75 * u * u) * (0.35 + 0.65 * smoothstep(0, 0.1, u));
        rad.push(w * 0.5);
      }
      sDepth.push(depthR);
      sVar.push(vari);
      sKind.push(KINDS.indexOf(g.kind));
    }
  }
  const strands = sDepth.length;
  const hp = new Packer();
  const hair = {
    file: "hair.bin",
    strands,
    pointsPerStrand: STRAND_POINTS,
    share: SHARE,
    kinds: KINDS,
    colour: look.colors.hair,
    positions: hp.add(new Float32Array(pos)),
    radius: hp.add(new Float32Array(rad)),
    depth: hp.add(new Float32Array(sDepth)),
    var: hp.add(new Float32Array(sVar)),
    kind: hp.add(new Uint8Array(sKind)),
    /**
     * Strands are rigid to this joint (the game simulates them; the trailer poses them).
     * Shading (hair-render.ts FRAG): base = colour·(0.72+0.4·var), roots ×0.55, deep strands ×0.55.
     */
    bone: "head",
  };
  hp.write(join(OUT, hair.file));

  const manifest = {
    detail: DETAIL,
    /** World units per model voxel (engine: HERO_UNIT_DEFAULT = JADE_SCALE). */
    unit: JADE_SCALE,
    axes: "game (x, y, z) → Blender (x, −z, y); feet at y 0, facing game +z",
    body: JADE_BODY,
    joints,
    layers,
    colours: look.colors,
    worn: look.worn,
    eyes: {
      centres: JADE_EYES,
      radius: EYE_R,
      iris: look.colors.iris,
      /** Relaxed near gaze (hero-rig.ts): rotation.y = −x · 0.05 per eye. */
      inward: JADE_EYES.map((e) => -e[0] * 0.05),
      bone: "head",
    },
    hairTwist: HAIR_TWIST,
    head: {
      glb: join(ROOT, "public/hero/jade-head.glb"),
      skin: join(ROOT, "public/hero/jade-skin.jpg"),
      /**
       * The GLB is authored in character space (scripts/hero/blender/export_head.py
       * aligns its eye centres on JADE_EYES). glTF is y-up, so Blender's importer
       * already yields (x, −z, y): scale it by `unit` about the origin, nothing else.
       * It replaces the layer "head" (and the lid caps); shape key "blink" closes the lids.
       */
      transform: { scale: JADE_SCALE, translate: [0, 0, 0] },
      replaces: ["head"],
      /** Skin weights (hero-rig.ts headSkin): head ↔ torso, smoothstep over y 50.4 … 52.6. */
      weights: { blendFrom: 50.4, blendTo: 52.6, upper: "head", lower: "torso" },
    },
    hair,
    buildMs: tBuild,
  };
  writeFileSync(join(OUT, "jade.json"), JSON.stringify(manifest, null, 1));
  const tris = layers.reduce((s, l) => s + l.triangles, 0);
  console.log(
    `jade (${DETAIL}): ${layers.length} layers, ${tris} triangles, ${strands} strands, build ${(tBuild / 1000).toFixed(1)} s → ${OUT}`,
  );
}

function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
