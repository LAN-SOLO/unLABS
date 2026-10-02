/**
 * Crystal-age stills of every bot (awake, upgrade levels 0–3) and the service
 * dock, assembled from their crystal GLBs (base + rig parts at rest) and
 * rendered in Blender — for the undevbook's era tables (docs/OPS.md).
 *
 *   pnpm crystal:assemble            → .crystal/assembled/<id>-l<level>.png
 *
 * Needs `pnpm crystal:export` + `pnpm crystal:build` first (the manifest maps
 * each `bot-<id>[-l<level>]/<part>` use to its GLB).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BOT_IDS, botVisual } from "@/lib/world/models/characters";
import { decorModel, decorVisual } from "@/lib/world/models/decor";
import { MAX_LEVEL } from "@/lib/world/ops/state";
import type { AnimPart, DeviceVisual } from "@/lib/world/models/anim";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const OUT = join(ROOT, ".crystal/assembled");
const PUB = join(ROOT, "public/crystal");
mkdirSync(OUT, { recursive: true });

interface ManifestModel {
  file: string;
  uses?: string[];
}
const manifest = JSON.parse(readFileSync(join(PUB, "manifest.json"), "utf8")) as {
  models: Record<string, ManifestModel>;
};
const fileOf = new Map<string, string>();
// Blender reads the uncompressed build output (.crystal/raw); the public GLBs are meshopt-compressed.
const RAW = join(ROOT, ".crystal/raw");
for (const m of Object.values(manifest.models)) {
  const raw = join(RAW, m.file);
  for (const u of m.uses ?? []) fileOf.set(u, existsSync(raw) ? raw : join(PUB, m.file));
}

/** Rest-pose origin of a part in the base frame (offsets along the parent chain). */
function partAt(v: DeviceVisual, p: AnimPart): [number, number, number] {
  const byName = new Map(v.parts.map((x) => [x.name, x]));
  const at: [number, number, number] = [0, 0, 0];
  for (let q: AnimPart | undefined = p; q; q = q.parent ? byName.get(q.parent) : undefined) {
    at[0] += q.offset[0];
    at[1] += q.offset[1];
    at[2] += q.offset[2];
  }
  return at;
}

interface Job {
  out: string;
  pieces: { glb: string; at: [number, number, number] }[];
  size: number;
}
const jobs: Job[] = [];
const missing: string[] = [];

function job(tag: string, v: DeviceVisual, out: string): void {
  const pieces: Job["pieces"] = [];
  // Static decor is exported without a "/base" suffix.
  const base = fileOf.get(`${tag}/base`) ?? fileOf.get(tag);
  if (!base) {
    missing.push(`${tag}/base`);
    return;
  }
  pieces.push({ glb: base, at: [0, 0, 0] });
  for (const p of v.parts) {
    const f = fileOf.get(`${tag}/${p.name}`);
    if (f) pieces.push({ glb: f, at: partAt(v, p) });
    else missing.push(`${tag}/${p.name}`);
  }
  jobs.push({ out, pieces, size: 640 });
}

for (const id of BOT_IDS)
  for (let level = 0; level <= MAX_LEVEL; level++)
    job(
      level ? `bot-${id}-l${level}` : `bot-${id}`,
      botVisual(id, true, level),
      join(OUT, `${id}-l${level}.png`),
    );
{
  // Static decor: no rig, the whole model is one grid.
  const v = decorVisual("service_dock") ?? {
    base: decorModel("service_dock"),
    parts: [],
    lights: [],
  };
  job("decor-service_dock", v, join(OUT, "service_dock.png"));
}

if (missing.length)
  console.warn(`missing GLBs (${missing.length}): ${missing.slice(0, 8).join(", ")}…`);
const jobsFile = join(OUT, "jobs.json");
writeFileSync(jobsFile, JSON.stringify(jobs, null, 1));
const blender = process.env.BLENDER ?? "/Applications/Blender.app/Contents/MacOS/Blender";
if (!existsSync(blender)) throw new Error(`Blender not found: ${blender}`);
console.log(`assembling ${jobs.length} stills…`);
execFileSync(
  blender,
  ["-b", "--factory-startup", "-P", join(HERE, "blender/assemble.py"), "--", "--jobs", jobsFile],
  { stdio: "inherit" },
);
