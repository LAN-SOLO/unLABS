// Contact sheets and GIF loops from the skin renders (ffmpeg).
//   node scripts/skins/sheets.mjs [--only a,b]
// In:  .voxel/skins/<room>/render/{overview.png, eye-<n>-<preset>.png, frames/f<k>.png}
// Out: .voxel/skins/sheets/<L>-<room>.jpg  (overview + signature on top, further moods below)
//      .voxel/skins/gif/<room>.gif          (one loop of the signature mood)
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SK = join(ROOT, ".voxel/skins");
const OUT = join(SK, "sheets");
const GIF = join(SK, "gif");
mkdirSync(OUT, { recursive: true });
mkdirSync(GIF, { recursive: true });
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(",") : null;
const FLOOR = ["L0", "L-1", "L-2", "L-3", "L-4", "L-5"];

const ff = (args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(r.stderr);
};

const { rooms } = JSON.parse(readFileSync(join(SK, "index.json"), "utf8"));
let n = 0;
for (const { room, floor } of rooms) {
  if (only && !only.includes(room)) continue;
  const dir = join(SK, room, "render");
  if (!existsSync(join(dir, "overview.png"))) continue;
  const eyes = readdirSync(dir)
    .filter((f) => f.startsWith("eye-") && f.endsWith(".png"))
    .sort();
  const W = 1600;
  const top = ["overview.png", eyes[0]].map((f) => join(dir, f));
  const rest = eyes.slice(1).map((f) => join(dir, f));
  const inputs = [...top, ...rest].flatMap((f) => ["-i", f]);
  const half = W / 2;
  const cell = rest.length ? Math.floor(W / rest.length) : 0;
  const parts = [
    `[0]scale=${half}:${Math.round((half * 9) / 16)}:force_original_aspect_ratio=increase,crop=${half}:${Math.round((half * 9) / 16)}[o]`,
    `[1]scale=${half}:-2[e]`,
    `[o][e]hstack[t]`,
  ];
  let last = "[t]";
  if (rest.length) {
    rest.forEach((_, i) =>
      parts.push(`[${i + 2}]scale=${cell}:${Math.round((cell * 9) / 16)}[r${i}]`),
    );
    parts.push(`${rest.map((_, i) => `[r${i}]`).join("")}hstack=${rest.length}[b]`);
    parts.push(`[b]scale=${W}:-2[b2]`, `[t][b2]vstack[s]`);
    last = "[s]";
  }
  if (rest.length === 1) parts.splice(parts.indexOf(`[r0]hstack=1[b]`), 1, `[r0]null[b]`);
  ff([
    ...inputs,
    "-filter_complex",
    parts.join(";"),
    "-map",
    last,
    "-q:v",
    "3",
    join(OUT, `${FLOOR[floor]}-${room}.jpg`),
  ]);
  const frames = join(dir, "frames");
  if (existsSync(join(frames, "f0.png"))) {
    ff([
      "-framerate",
      "6",
      "-i",
      join(frames, "f%d.png"),
      "-vf",
      "scale=560:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none",
      "-loop",
      "0",
      join(GIF, `${room}.gif`),
    ]);
  }
  n++;
}
console.log(`[skins] sheets: ${n} rooms → .voxel/skins/sheets, gif/`);
