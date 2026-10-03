// Render the lab skins in Blender (headless Cycles): node scripts/skins/render.mjs [--only a,b] [--frames] …
// Blender: $BLENDER or /Applications/Blender.app (5.1+). Input: pnpm skins:export → .voxel/skins/.
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
const args = [
  "-b",
  "--factory-startup",
  "-P",
  join(here, "blender/render.py"),
  "--",
  ...process.argv.slice(2),
];
const r = spawnSync(blender, args, {
  stdio: ["inherit", "pipe", "inherit"],
  encoding: "utf8",
  maxBuffer: 1 << 28,
});
for (const line of (r.stdout ?? "").split("\n"))
  if (/^\[skins\]|Traceback|Error/.test(line)) console.log(line);
process.exit(r.status ?? 1);
