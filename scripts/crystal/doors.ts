/**
 * Door era renders: every door (and the data-center airlock) rendered in
 * Blender for all 42 clarity eras plus the crystal age — the exact voxel
 * meshes the engine draws in each era (`refinedModelMesh` at the era's mesh
 * tier, lib/world/clarity.ts), the era's look (surface detail, reflections,
 * saturation / contrast grade) and the Blender-built crystal surfaces.
 *
 *   pnpm crystal:doors                 all doors (needs crystal:export + crystal:build)
 *   pnpm crystal:doors d_mcp,d_geo     only these door ids (prefixes)
 *   pnpm crystal:doors --workers 2     parallel Blender processes (default 2)
 *   pnpm crystal:doors --samples 48    Cycles samples per still (default 48)
 *   pnpm crystal:doors --eras 0,18,41  look-dev: only these eras (no sheet)
 *   pnpm crystal:doors --plan          write meshes + doors.json only, no Blender
 *   pnpm crystal:doors --gallery       rewrite index.html from the renders on disk
 *
 * Output: .crystal/doors/<door>/era-00…41.png, crystal-front.png,
 * crystal-back.png, mech|iface-era41.png, mech|iface-crystal.png (close-ups), sheet.png (all eras
 * on one sheet) + .crystal/doors/index.html (gallery) and doors.json
 * (styles, eras). Reference: docs/DOORS.md § Blender renders.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { VoxelGrid } from "@/lib/voxel/grid";
import { MATERIAL_CLASSES } from "@/lib/voxel/mesher";
import { CLARITY_ERAS, ERA_NAMES, chapterOf, paramsAt } from "@/lib/world/clarity";
import { DOORS, ROOMS, doorSides } from "@/lib/world/content/map";
import { AIRLOCKS } from "@/lib/world/doors/airlock";
import {
  MECH_LABEL,
  MECH_TEXT,
  MOTION_LABEL,
  doorStyle,
  mechCount,
  mechHeavy,
  mechHigh,
} from "@/lib/world/doors/style";
import { C } from "@/lib/world/content/palette";
import { DOOR_SCALE } from "@/lib/world/models/doors";
import { MESH_TIERS, gridHash, refinedModelMesh, type MeshTier } from "@/lib/world/models/refine";
import {
  airlockAssembly,
  doorAssembly,
  doorVariant,
  restingLight,
  type DoorPart,
} from "./door-parts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const OUT = join(ROOT, ".crystal/doors");
const MESH = join(OUT, "mesh");
const RAW = join(ROOT, ".crystal/raw");
const PUB = join(ROOT, "public/crystal");

const argv = process.argv.slice(2);
const opt = (n: string): string | undefined => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const optVals = new Set(
  ["--workers", "--samples", "--size", "--eras"]
    .map((f) => argv.indexOf(f))
    .filter((i) => i >= 0)
    .map((i) => argv[i + 1]),
);
const ONLY = argv
  .find((a) => !a.startsWith("--") && !optVals.has(a))
  ?.split(",")
  .filter(Boolean);
const WORKERS = Number(opt("workers") ?? 2);
const SAMPLES = Number(opt("samples") ?? 48);
const SIZE = Number(opt("size") ?? 720);
const PLAN = argv.includes("--plan");
const GALLERY = argv.includes("--gallery");
/** Look-dev: only these era indices (e.g. `--eras 0,6,18,41`). */
const ERAS = opt("eras")?.split(",").map(Number);

mkdirSync(MESH, { recursive: true });

// ── Crystal GLBs by use id ───────────────────────────────────────
const manifest = JSON.parse(readFileSync(join(PUB, "manifest.json"), "utf8")) as {
  models: Record<string, { file: string; uses?: string[] }>;
};
const glbOf = new Map<string, string>();
for (const m of Object.values(manifest.models)) {
  const raw = join(RAW, m.file);
  for (const u of m.uses ?? []) glbOf.set(u, existsSync(raw) ? raw : join(PUB, m.file));
}

// ── Voxel meshes per era tier (binary, deduplicated by content) ──
const keyFile = (k: string): string => k.replace(/[^a-zA-Z0-9x-]/g, "-");
const written = new Set<string>();

/** Write the engine's mesh of `grid` at `tier`: u32 nv, ni, ng · ng×(class, start, count) · f32 pos · f32 col · u32 idx. */
function meshFile(grid: VoxelGrid, tier: MeshTier): string {
  const file = join(MESH, `${keyFile(gridHash(grid))}-t${tier}.bin`);
  if (written.has(file) || existsSync(file)) {
    written.add(file);
    return file;
  }
  const d = refinedModelMesh(grid, "architecture", { center: true, tier });
  const nv = d.positions.length / 3;
  const head = new Uint32Array(3 + d.groups.length * 3);
  head[0] = nv;
  head[1] = d.indices.length;
  head[2] = d.groups.length;
  d.groups.forEach((g, i) => {
    head[3 + i * 3] = MATERIAL_CLASSES.indexOf(g.material);
    head[4 + i * 3] = g.start;
    head[5 + i * 3] = g.count;
  });
  const buf = Buffer.concat([
    Buffer.from(head.buffer),
    Buffer.from(d.positions.buffer, d.positions.byteOffset, d.positions.byteLength),
    Buffer.from(d.colors.buffer, d.colors.byteOffset, d.colors.byteLength),
    Buffer.from(d.indices.buffer, d.indices.byteOffset, d.indices.byteLength),
  ]);
  writeFileSync(file, buf);
  written.add(file);
  return file;
}

// ── Subjects ─────────────────────────────────────────────────────
interface JobPart {
  use: string;
  at: [number, number, number];
  rotY: number;
  size: [number, number, number];
  tiers: Record<string, string>;
  glb: string | null;
  /** Close-up subject: a locking part, the lock interface, or neither. */
  mech: "mech" | "iface" | "";
}
interface Job {
  id: string;
  out: string;
  parts: JobPart[];
  /** Camera: yaw / pitch (degrees) of the overview. */
  yaw: number;
  pitch: number;
}

const missingGlb: string[] = [];
function jobParts(parts: DoorPart[]): JobPart[] {
  return parts.map((p) => {
    const tiers: Record<string, string> = {};
    for (const t of MESH_TIERS) tiers[t] = meshFile(p.grid, t);
    const glb = glbOf.get(p.use) ?? null;
    if (!glb) missingGlb.push(p.use);
    return {
      use: p.use,
      at: p.at,
      rotY: p.rotY,
      size: [p.grid.sx, p.grid.sy, p.grid.sz],
      tiers,
      glb,
      mech: /\/mech\d+$/.test(p.use) ? "mech" : p.use.startsWith("door-iface-") ? "iface" : "",
    };
  });
}

const NAME_BY_INDEX = new Map<number, string>(Object.entries(C).map(([n, i]) => [i, n]));
const roomName = (id: string): string => ROOMS.find((r) => r.id === id)?.name ?? id;
const doors = [...DOORS].sort((a, b) => a.floor - b.floor || a.id.localeCompare(b.id));
const jobs: Job[] = [];
const meta: Record<string, unknown>[] = [];
for (const d of doors) {
  if (ONLY && !ONLY.some((p) => d.id.startsWith(p))) continue;
  const s = doorStyle(d.id);
  const sides = doorSides(d);
  jobs.push({
    id: d.id,
    out: join(OUT, d.id),
    parts: jobParts(doorAssembly(d)),
    yaw: 28,
    pitch: 10,
  });
  meta.push({
    id: d.id,
    floor: d.floor,
    rooms: [roomName(sides[0] ?? ""), roomName(sides[1] ?? sides[0] ?? "")],
    variant: doorVariant(d),
    light: restingLight(d),
    airlock: d.airlock ?? null,
    secret: !!d.secret,
    motion: s.motion,
    motionLabel: MOTION_LABEL[s.motion](),
    edge: s.edge,
    window: s.window,
    pattern: s.pattern,
    frame: s.frame,
    paint: NAME_BY_INDEX.get(s.paint) ?? s.paint,
    trim: NAME_BY_INDEX.get(s.trim) ?? s.trim,
    mech: s.mech,
    mechLabel: MECH_LABEL[s.mech](),
    mechText: MECH_TEXT[s.mech](),
    mechVariant: s.mechVariant,
    mechCount: mechCount(s),
    mechHigh: mechHigh(s),
    mechHeavy: mechHeavy(s),
  });
}
for (const a of AIRLOCKS) {
  const id = `airlock-${a.id}`;
  if (ONLY && !ONLY.some((p) => id.startsWith(p))) continue;
  const { parts } = airlockAssembly(a);
  const outer = DOORS.find((d) => d.id === a.outer)!;
  jobs.push({
    id,
    out: join(OUT, id),
    parts: jobParts([...doorAssembly(outer), ...parts]),
    yaw: 55,
    pitch: 38,
  });
  meta.push({ id, airlock: a.id, outer: a.outer, inner: a.inner, clean: roomName(a.clean) });
}

const eras = Array.from({ length: CLARITY_ERAS }, (_, i) => {
  const p = paramsAt(i);
  return {
    index: i,
    name: ERA_NAMES[i],
    chapter: chapterOf(i) + 1,
    tier: p.mesh,
    detail: p.detail,
    env: p.env,
    saturation: p.saturation,
    contrast: p.contrast,
  };
});

if (missingGlb.length)
  console.warn(
    `no crystal GLB for ${missingGlb.length} parts (run crystal:export + crystal:build): ${[...new Set(missingGlb)].slice(0, 6).join(", ")}…`,
  );
writeFileSync(
  join(OUT, "doors.json"),
  JSON.stringify(
    { generated: new Date().toISOString(), scale: DOOR_SCALE, eras, doors: meta },
    null,
    1,
  ),
);
console.log(
  `door era renders: ${jobs.length} subjects × ${eras.length} eras + crystal, ${written.size} meshes`,
);
if (PLAN) process.exit(0);
if (GALLERY) {
  gallery();
  process.exit(0);
}

// ── Blender (parallel workers over the subjects) ─────────────────
const blender = process.env.BLENDER ?? "/Applications/Blender.app/Contents/MacOS/Blender";
if (!existsSync(blender)) throw new Error(`Blender not found: ${blender}`);
const run = promisify(execFile);
const chunks: Job[][] = Array.from({ length: Math.max(1, WORKERS) }, () => []);
jobs.forEach((j, i) => chunks[i % chunks.length]!.push(j));
await Promise.all(
  chunks
    .filter((c) => c.length)
    .map(async (c, w) => {
      const file = join(OUT, `jobs-${w}.json`);
      writeFileSync(
        file,
        JSON.stringify({
          scale: DOOR_SCALE,
          eras: ERAS ? eras.filter((e) => ERAS.includes(e.index)) : eras,
          sheet: !ERAS,
          samples: SAMPLES,
          size: SIZE,
          jobs: c,
        }),
      );
      const child = run(
        blender,
        ["-b", "--factory-startup", "-P", join(HERE, "blender/doors.py"), "--", "--jobs", file],
        { maxBuffer: 1 << 28 },
      );
      child.child.stdout?.on("data", (s: Buffer) => {
        for (const line of s.toString().split("\n"))
          if (line.startsWith("[doors]")) console.log(`w${w} ${line}`);
      });
      child.child.stderr?.on("data", (s: Buffer) => {
        const t = s.toString();
        if (/Error|Traceback/.test(t)) console.error(`w${w} ${t}`);
      });
      await child;
    }),
);
gallery();
console.log(`done → ${OUT}`);

/** .crystal/doors/index.html: every door — style, mechanism, sheet, crystal views, close-ups. */
function gallery(): void {
  const esc = (t: unknown): string =>
    String(t).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
    );
  const img = (id: string, f: string, alt: string): string =>
    existsSync(join(OUT, id, f))
      ? `<figure><a href="${id}/${f}"><img loading="lazy" src="${id}/${f}" alt="${esc(alt)}"></a><figcaption>${esc(alt)}</figcaption></figure>`
      : "";
  const last = eras[eras.length - 1]!.index;
  const cards = meta.map((m) => {
    const id = String(m.id);
    const facts =
      m.airlock && !m.motion
        ? `<p>Airlock <b>${esc(m.airlock)}</b>: outer <code>${esc(m.outer)}</code>, inner <code>${esc(m.inner)}</code>, keeps <b>${esc(m.clean)}</b> clean. Chamber hardware: nozzle rails, ducts, lamps, extraction grate.</p>`
        : `<p><b>${esc((m.rooms as string[]).join(" ↔ "))}</b> · floor ${esc(m.floor)} · ${esc(m.variant)}${m.airlock ? ` · airlock ${esc(m.airlock)}` : ""}</p>
<p>${esc(m.motionLabel)} · edge ${esc(m.edge)} · window ${esc(m.window)} · pattern ${esc(m.pattern)} · frame ${esc(m.frame)} · paint ${esc(m.paint)} / trim ${esc(m.trim)}</p>
<p><b>${esc(m.mechLabel)}</b> (variant ${esc(m.mechVariant)}: ${esc(m.mechCount)} parts, ${m.mechHigh ? "high" : "low"}${m.mechHeavy ? ", both faces" : ""}) — ${esc(m.mechText)}</p>`;
    const eraTiles = eras
      .map((e) =>
        img(
          id,
          `era-${String(e.index).padStart(2, "0")}.png`,
          `${e.index + 1} ${e.name} · ${e.tier}×`,
        ),
      )
      .join("");
    return `<section id="${esc(id)}"><h2>${esc(id)}</h2>${facts}
<div class="row">${img(id, "crystal-front.png", "Crystal — front")}${img(id, "crystal-back.png", "Crystal — back")}${img(id, "mech-crystal.png", "Mechanism — crystal")}${img(id, `mech-era${last}.png`, `Mechanism — era ${last + 1}`)}${img(id, "iface-crystal.png", "Lock interface — crystal")}${img(id, `iface-era${last}.png`, `Lock interface — era ${last + 1}`)}</div>
<details><summary>All ${eras.length} eras</summary><div class="eras">${eraTiles}</div></details></section>`;
  });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Door Eras</title><style>
:root{color-scheme:dark;--bg:#0d0e10;--fg:#e6e6e6;--mut:#9aa0a6;--line:#24262a}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1400px;margin:0 auto;padding:16px}
h1{font-size:22px}h2{font-size:18px;margin:28px 0 4px}p{margin:4px 0;color:var(--mut)}p b{color:var(--fg)}
section{border-top:1px solid var(--line);padding-bottom:12px}
.row,.eras{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));margin-top:8px}
figure{margin:0}img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;background:#000}
figcaption{font-size:12px;color:var(--mut)}nav a{color:var(--mut);margin-right:10px;font-size:13px}
</style></head><body><main><h1>Door eras — ${meta.length} subjects × ${eras.length} eras + crystal age</h1>
<p>Blender (Cycles) renders of the engine's door meshes at every clarity era's voxel tier and look, then the crystal surfaces. Generated by <code>pnpm crystal:doors</code> (docs/DOORS.md).</p>
<nav>${meta.map((m) => `<a href="#${esc(m.id)}">${esc(m.id)}</a>`).join("")}</nav>
${cards.join("\n")}</main></body></html>`;
  writeFileSync(join(OUT, "index.html"), html);
}
