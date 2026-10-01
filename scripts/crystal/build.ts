/**
 * Crystal build: inventory → Blender (headless, parallel) → compressed GLBs
 * + manifest the engine reads (`public/crystal/manifest.json`).
 *
 *   pnpm crystal:build                    build what changed (cache by dump + config)
 *   pnpm crystal:build --only dev-,bot-   only models used by ids with these prefixes
 *   pnpm crystal:build --force            rebuild everything
 *   pnpm crystal:build --previews         also render Cycles stills + .crystal/previews/index.html
 *   pnpm crystal:build --workers 6        parallel Blender processes (default: cores / 3, max 6)
 *   pnpm crystal:build --limit 20         first N jobs only (look-dev rounds)
 *   pnpm crystal:build --adopt            mark the existing GLBs as current (after a
 *                                         config change that cannot affect geometry)
 *
 * Needs `pnpm crystal:export` first. Blender: $BLENDER, else the macOS app,
 * else `blender` on PATH. Every model gets a meshopt-compressed, quantised
 * GLB (`public/crystal/models/<key>.glb`); the manifest maps the engine's
 * grid hash → file, plus the surface table the engine builds its shared
 * crystal materials from.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Logger, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const WORK = join(ROOT, ".crystal");
const PUB = join(ROOT, "public/crystal");
const MANIFEST = join(PUB, "manifest.json");
const CLI = join(HERE, "blender/cli.py");

// ── Args ─────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n: string): boolean => argv.includes(`--${n}`);
const opt = (n: string): string | undefined => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ONLY = opt("only")?.split(",").filter(Boolean);
const FORCE = flag("force");
const PREVIEWS = flag("previews");
const LIMIT = opt("limit") ? Number(opt("limit")) : Infinity;
const ADOPT = flag("adopt");
const WORKERS = Math.max(
  1,
  Number(opt("workers") ?? Math.min(6, Math.max(1, Math.floor(cpus().length / 3)))),
);

function blenderBin(): string {
  if (process.env.BLENDER) return process.env.BLENDER;
  const mac = "/Applications/Blender.app/Contents/MacOS/Blender";
  return existsSync(mac) ? mac : "blender";
}

// ── Inputs ───────────────────────────────────────────────────────
interface InvModel {
  key: string;
  file: string;
  family: string;
  center: boolean;
  size: [number, number, number];
  voxels: number;
  sha: string;
  uses: string[];
}
interface ManifestModel {
  file: string;
  sha: string;
  cfg: string;
  family: string;
  profile: string;
  surfaces: string[];
  tris: number;
  bytes: number;
  uses: string[];
}
interface Manifest {
  version: 1;
  generated: string;
  cfg: string;
  surfaces: Record<string, Record<string, unknown>>;
  models: Record<string, ManifestModel>;
}

const invPath = join(WORK, "inventory.json");
if (!existsSync(invPath)) {
  console.error("No .crystal/inventory.json — run `pnpm crystal:export` first.");
  process.exit(1);
}
const inventory = JSON.parse(readFileSync(invPath, "utf8")) as { models: InvModel[] };

/**
 * Cache keys. A GLB changes with: the pipeline version, the bindings, the
 * per-surface wear, AO / wear / UV settings (shared by all models) and the
 * model's own profile + override. Library refs and texture settings only
 * change looks / engine textures — no rebuild.
 */
const readConfig = (f: string): unknown => {
  const p = join(HERE, "config", f);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as unknown) : null;
};
const PROFILES = readConfig("profiles.json") as {
  profiles: Record<string, unknown>;
  families: Record<string, string>;
  ao?: unknown;
  wear?: unknown;
  uvScale?: unknown;
};
const OVERRIDES = readConfig("overrides.json") as {
  models?: Record<string, { profile?: string }>;
} | null;

function sharedFingerprint(): string {
  const h = createHash("sha256");
  const py = readFileSync(join(HERE, "blender/crystal/config.py"), "utf8");
  h.update(/PIPELINE_VERSION = (\d+)/.exec(py)?.[1] ?? "0");
  const surf = readConfig("surfaces.json") as {
    bindings: unknown;
    surfaces: Record<string, { wear?: number }>;
  };
  h.update(JSON.stringify(surf.bindings));
  h.update(JSON.stringify(Object.entries(surf.surfaces).map(([k, v]) => [k, v.wear ?? null])));
  h.update(JSON.stringify([PROFILES.ao, PROFILES.wear, PROFILES.uvScale]));
  return h.digest("hex").slice(0, 16);
}

const cfg = sharedFingerprint();

/** Cache key of one model: shared config + its profile + its override. */
function modelFingerprint(m: InvModel): string {
  const ov = OVERRIDES?.models?.[m.uses[0]!];
  const pname = ov?.profile ?? PROFILES.families[m.family] ?? PROFILES.families.default!;
  return createHash("sha256")
    .update(cfg)
    .update(JSON.stringify(PROFILES.profiles[pname] ?? null))
    .update(JSON.stringify(ov ?? null))
    .digest("hex")
    .slice(0, 16);
}
const old: Manifest | null = existsSync(MANIFEST)
  ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest)
  : null;
const fileOf = (key: string): string => `models/${key.replace(/[^a-zA-Z0-9x-]/g, "-")}.glb`;

const wanted = inventory.models.filter(
  (m) => !ONLY || m.uses.some((u) => ONLY.some((p) => u.startsWith(p))),
);
const todo = wanted
  .filter((m) => {
    if (FORCE || PREVIEWS) return true;
    const prev = old?.models[m.key];
    return (
      !prev ||
      prev.sha !== m.sha ||
      prev.cfg !== modelFingerprint(m) ||
      !existsSync(join(PUB, prev.file))
    );
  })
  .slice(0, LIMIT);

console.log(
  `crystal build: ${wanted.length} models in scope, ${todo.length} to build, ${WORKERS} Blender worker(s), config ${cfg}`,
);

// ── Blender workers ──────────────────────────────────────────────
interface Report {
  id: string;
  key: string;
  family: string;
  profile: string;
  surfaces: string[];
  tris: number;
  bytes: number;
  glb: string;
  preview?: string;
}

async function runBatch(
  i: number,
  jobs: InvModel[],
  onReport: (r: Report) => void,
): Promise<string[]> {
  const jobFile = join(WORK, `jobs-${i}.json`);
  writeFileSync(
    jobFile,
    JSON.stringify(
      jobs.map((m) => ({
        dump: join(WORK, "dumps", m.file),
        glb: join(WORK, "raw", fileOf(m.key)),
        ...(PREVIEWS
          ? {
              preview: join(
                WORK,
                "previews",
                fileOf(m.key)
                  .replace(/^models\//, "")
                  .replace(/\.glb$/, ".png"),
              ),
            }
          : {}),
      })),
    ),
  );
  const errors: string[] = [];
  await new Promise<void>((resolve) => {
    const p = spawn(
      blenderBin(),
      ["-b", "--factory-startup", "-P", CLI, "--", "batch", "--jobs", jobFile],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let buf = "";
    p.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.startsWith("[crystal] ")) onReport(JSON.parse(line.slice(10)) as Report);
        else if (line.startsWith("[crystal-error] ")) errors.push(line.slice(16));
      }
    });
    p.stderr.on("data", () => {});
    p.on("close", () => resolve());
  });
  return errors;
}

async function compress(src: string, dst: string): Promise<number> {
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.ERROR))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  const doc = await io.read(src);
  await doc.transform(
    dedup(),
    weld(),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  mkdirSync(dirname(dst), { recursive: true });
  await io.write(dst, doc);
  return statSync(dst).size;
}

async function main(): Promise<void> {
  if (ADOPT) {
    if (!old) throw new Error("--adopt needs an existing manifest");
    let n = 0;
    for (const m of inventory.models) {
      const e = old.models[m.key];
      if (e && e.sha === m.sha && existsSync(join(PUB, e.file))) {
        e.cfg = modelFingerprint(m);
        n++;
      }
    }
    old.cfg = cfg;
    old.surfaces = manifestSurfaces();
    writeFileSync(MANIFEST, JSON.stringify(old, null, 1) + "\n");
    console.log(`✓ adopted ${n} models for config ${cfg}`);
    return;
  }
  const manifest: Manifest = {
    version: 1,
    generated: new Date().toISOString(),
    cfg,
    surfaces: (
      JSON.parse(readFileSync(join(HERE, "config/surfaces.json"), "utf8")) as {
        surfaces: Manifest["surfaces"];
      }
    ).surfaces,
    models: { ...(old?.models ?? {}) },
  };
  // Drop models no longer in the inventory.
  const live = new Set(inventory.models.map((m) => m.key));
  for (const k of Object.keys(manifest.models)) if (!live.has(k)) delete manifest.models[k];

  const byKey = new Map(todo.map((m) => [m.key, m]));
  const chunks: InvModel[][] = Array.from({ length: Math.min(WORKERS, todo.length) }, () => []);
  // Big models first, dealt round-robin so the workers finish together.
  [...todo]
    .sort((a, b) => b.voxels - a.voxels)
    .forEach((m, i) => chunks[i % chunks.length]!.push(m));

  let done = 0;
  const t0 = Date.now();
  const pending: Promise<void>[] = [];
  const onReport = (r: Report): void => {
    const m = byKey.get(r.key);
    if (!m) return;
    const file = fileOf(m.key);
    pending.push(
      compress(r.glb, join(PUB, file)).then((bytes) => {
        manifest.models[m.key] = {
          file,
          sha: m.sha,
          cfg: modelFingerprint(m),
          family: m.family,
          profile: r.profile,
          surfaces: r.surfaces,
          tris: r.tris,
          bytes,
          uses: m.uses,
        };
      }),
    );
    done++;
    const eta = ((Date.now() - t0) / done) * (todo.length - done);
    process.stdout.write(
      `\r  ${done}/${todo.length}  ${m.uses[0]!.padEnd(36).slice(0, 36)}  ${String(r.tris).padStart(6)} tris  ETA ${Math.round(eta / 1000)}s   `,
    );
  };
  const errors = (await Promise.all(chunks.map((c, i) => runBatch(i, c, onReport)))).flat();
  await Promise.all(pending);
  process.stdout.write("\n");

  mkdirSync(PUB, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
  const models = Object.values(manifest.models);
  const mb = models.reduce((s, m) => s + m.bytes, 0) / 1048576;
  const tris = models.reduce((s, m) => s + m.tris, 0);
  console.log(
    `✓ ${done} built in ${Math.round((Date.now() - t0) / 1000)}s · manifest: ${models.length} models, ${tris.toLocaleString()} tris, ${mb.toFixed(1)} MB → ${relative(ROOT, MANIFEST)}`,
  );
  if (errors.length) {
    console.error(`✗ ${errors.length} failed:`);
    for (const e of errors.slice(0, 20)) {
      const j = JSON.parse(e) as { dump: string; error: string };
      console.error(`  ${relative(ROOT, j.dump)}: ${j.error}`);
    }
    process.exitCode = 1;
  }
  if (PREVIEWS) writeContactSheet(manifest);
}

/** Surface table for the engine: PBR factors + exported library maps (public/crystal/textures/<sid>/). */
function manifestSurfaces(): Manifest["surfaces"] {
  const raw = (
    JSON.parse(readFileSync(join(HERE, "config/surfaces.json"), "utf8")) as {
      surfaces: Record<string, Record<string, unknown>>;
    }
  ).surfaces;
  const out: Manifest["surfaces"] = {};
  for (const [sid, s] of Object.entries(raw)) {
    // The library ref is machine-specific (catalog ids) — the engine only needs the maps.
    const rest = Object.fromEntries(Object.entries(s).filter(([k]) => k !== "library"));
    const tex: Record<string, unknown> = {};
    for (const [k, f] of [
      ["normal", "normal.jpg"],
      ["roughness", "rough.jpg"],
      ["albedo", "albedo.jpg"],
    ] as const) {
      if (existsSync(join(PUB, "textures", sid, f))) tex[k] = `textures/${sid}/${f}`;
    }
    if (Object.keys(tex).length) tex.scale = (s.texScale as number | undefined) ?? 0.25;
    out[sid] = Object.keys(tex).length ? { ...rest, textures: tex } : rest;
  }
  return out;
}

/** .crystal/previews/index.html — every preview with its ids, for review. */
function writeContactSheet(manifest: Manifest): void {
  const rows = Object.entries(manifest.models)
    .filter(([k]) => byKeyPreview(k))
    .map(([k, m]) => {
      const img = fileOf(k)
        .replace(/^models\//, "")
        .replace(/\.glb$/, ".png");
      return `<figure><img loading="lazy" src="${img}"><figcaption><b>${m.uses[0]}</b><br>${m.profile} · ${m.tris} tris · ${(m.bytes / 1024).toFixed(0)} KB<br><small>${m.surfaces.join(" ")}</small></figcaption></figure>`;
    })
    .join("\n");
  writeFileSync(
    join(WORK, "previews/index.html"),
    `<!doctype html><meta charset="utf-8"><title>Crystal previews</title><style>body{background:#111;color:#ccc;font:12px system-ui;margin:16px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}img{width:100%;border-radius:6px}figure{margin:0}small{color:#888}</style><main>${rows}</main>`,
  );
  console.log(`  previews: ${relative(ROOT, join(WORK, "previews/index.html"))}`);
}

function byKeyPreview(k: string): boolean {
  return existsSync(
    join(
      WORK,
      "previews",
      fileOf(k)
        .replace(/^models\//, "")
        .replace(/\.glb$/, ".png"),
    ),
  );
}

void main();
