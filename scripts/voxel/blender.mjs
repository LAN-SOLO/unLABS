// Run the voxelgod Blender CLI (headless) or open Blender with the add-on.
//   node scripts/voxel/blender.mjs verify|selftest|uitest|beauty|hero [args…]
//   node scripts/voxel/blender.mjs gui [devices|doors|airlocks|frames]
// Blender: $BLENDER or /Applications/Blender.app (5.1+).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const blender = process.env.BLENDER ?? "/Applications/Blender.app/Contents/MacOS/Blender";
if (!existsSync(blender)) {
  console.error(`Blender not found at ${blender} — set $BLENDER`);
  process.exit(1);
}
const [cmd = "verify", ...rest] = process.argv.slice(2);
const args =
  cmd === "gui"
    ? ["--python", join(here, "blender/open.py"), "--", ...rest]
    : ["-b", "--factory-startup", "-P", join(here, "blender/cli.py"), "--", cmd, ...rest];
const r = spawnSync(blender, args, { stdio: ["inherit", "pipe", "inherit"], encoding: "utf8" });
// Only the pipeline's own lines (Blender is chatty).
for (const line of (r.stdout ?? "").split("\n"))
  if (/^\[(verify|selftest|uitest|beauty|hero|voxelgod)\]|Traceback|Error/.test(line))
    console.log(line);
process.exit(r.status ?? 1);
