// Render a trailer's shots in Blender, one process per shot (docs/TRAILERS.md).
//
//   node scripts/trailer/render.mjs t1 h [--preview] [--only s2_control,s3_mcp] [--skip-done]
//
// --preview: 50 % size, 8 samples (motion check); final: 100 %, 32 samples.
// Frames: .voxel/trailer/frames/<t>/<fmt>[-preview]/<shot>/f####.png
// Blender: $BLENDER or /Applications/Blender.app (5.1+).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, renameSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TIMELINES } from "./timeline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../..");
const BLENDER = process.env.BLENDER ?? "/Applications/Blender.app/Contents/MacOS/Blender";
const [trailer, fmt = "h", ...rest] = process.argv.slice(2);
const preview = rest.includes("--preview");
const skipDone = rest.includes("--skip-done");
const onlyArg = rest[rest.indexOf("--only") + 1];
const only = rest.includes("--only") ? onlyArg.split(",") : null;
const tl = TIMELINES[trailer];
if (!tl) {
  console.error(`unknown trailer ${trailer} (${Object.keys(TIMELINES).join(", ")})`);
  process.exit(2);
}
const base = join(ROOT, ".voxel/trailer/frames", trailer);
for (const s of tl.shots) {
  if (only && !only.includes(s.id)) continue;
  if (s.src) continue; // borrowed frames (assemble.mjs)
  const final = join(base, preview ? `${fmt}-preview` : fmt, s.id);
  const frames = Math.round(s.seconds * 24);
  if (
    skipDone &&
    existsSync(final) &&
    readdirSync(final).filter((f) => f.endsWith(".png")).length >= frames
  ) {
    console.log(`[trailer] ${s.id}: done, skipped`);
    continue;
  }
  const t0 = Date.now();
  const args = ["-b", "--factory-startup", "-P", join(here, "blender/render.py"), "--"];
  args.push("--trailer", trailer, "--shot", s.id, "--fmt", fmt);
  if (preview) args.push("--scale", "50", "--samples", "8");
  const r = spawnSync(BLENDER, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });
  const log = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0 || /Traceback/.test(log)) {
    console.error(
      log
        .split("\n")
        .filter((l) => /Error|Traceback|File "/.test(l))
        .join("\n"),
    );
    console.error(`[trailer] ${s.id}: FAILED`);
    process.exit(1);
  }
  // render.py writes to <fmt>/<shot>; previews move to <fmt>-preview/<shot>.
  if (preview) {
    const src = join(base, fmt, s.id);
    mkdirSync(dirname(final), { recursive: true });
    if (existsSync(final)) rmSync(final, { recursive: true });
    renameSync(src, final);
  }
  console.log(`[trailer] ${s.id}: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.log(`[trailer] ${trailer} ${fmt}${preview ? " preview" : ""}: all shots rendered`);
