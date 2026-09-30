/**
 * Footstep sets — render every footwear × surface, measure, compare.
 *
 *   pnpm exec vite-node --config scripts/audio/vite.config.mjs scripts/audio/footsteps.ts -- [--out DIR] [--png]
 *
 * Prints a feature table (centroid, band shares, length, level) per
 * footwear × surface, the closest pair of footwear sets per surface (how
 * distinct they are) and writes one WAV reel per footwear (a short walk on
 * every surface incl. a turn and a stop); `--png` adds ffmpeg spectrograms.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { averageFeatures, featureDistance, type SoundFeatures } from "@/lib/world/audio/analysis";
import {
  FOOTWEAR_SETS,
  MOTION_LAYER_KINDS,
  renderMotion,
  renderStep,
  type Footwear,
} from "@/lib/world/audio/footfall";
import { FOOTSTEP_GAIN, SURFACES, type Surface } from "@/lib/world/audio/sfx";
import { OfflineTarget } from "@/lib/world/audio/songs/offline";

const args = process.argv.slice(2).filter((a) => a !== "--");
const outI = args.indexOf("--out");
const out = outI >= 0 ? args[outI + 1]! : "/tmp/unlabs-footsteps";
const png = args.includes("--png");
fs.mkdirSync(out, { recursive: true });

const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
const table = new Map<string, SoundFeatures>();
const key = (f: Footwear, s: Surface) => `${f}:${s}`;
for (const f of FOOTWEAR_SETS)
  for (const s of SURFACES)
    table.set(
      key(f, s),
      averageFeatures((t) => renderStep(t, { surface: s, footwear: f, interval: 0.3 }), SEEDS),
    );

const pad = (v: string, n: number) => v.padEnd(n);
console.log(`${pad("footwear:surface", 20)} centroid   <250  250-1k  1k-4k  >4k   length  loud(A)`);
for (const f of FOOTWEAR_SETS)
  for (const s of SURFACES) {
    const x = table.get(key(f, s))!;
    console.log(
      `${pad(key(f, s), 20)} ${x.centroid.toFixed(0).padStart(6)} Hz  ${x.bands.map((b) => b.toFixed(2)).join("   ")}  ${x.length.toFixed(3)}s  ${x.loud.toFixed(4)}`,
    );
  }

console.log("\nclosest footwear pair per surface (distance, higher = more distinct):");
let worst = Infinity;
for (const s of SURFACES) {
  let best: [number, string] = [Infinity, ""];
  for (const a of FOOTWEAR_SETS)
    for (const b of FOOTWEAR_SETS) {
      if (a >= b) continue;
      const d = featureDistance(table.get(key(a, s))!, table.get(key(b, s))!);
      if (d < best[0]) best = [d, `${a} ~ ${b}`];
    }
  worst = Math.min(worst, best[0]);
  console.log(`  ${pad(s, 9)} ${best[0].toFixed(2)}  (${best[1]})`);
}
console.log(`minimum over all surfaces: ${worst.toFixed(2)}`);

// ── Reels: per footwear, 6 steps + scuff + stop on every surface ──
const sr = 32000;
for (const f of FOOTWEAR_SETS) {
  const per = 2.6;
  const n = Math.ceil((SURFACES.length * per + 0.5) * sr);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  SURFACES.forEach((s, si) => {
    const base = 0.3 + si * per;
    const g = FOOTSTEP_GAIN[s];
    for (let i = 0; i < 7; i++) {
      const bufL = new Float32Array(Math.ceil(1.2 * sr));
      const bufR = new Float32Array(bufL.length);
      const t = new OfflineTarget(bufL, bufR, sr, 0, 11 + i + si * 7);
      const kind = i === 6 ? "stop" : "step";
      renderStep(t, { surface: s, footwear: f, foot: i % 2 === 0 ? 0 : 1, interval: 0.28, kind });
      renderMotion(t, f === "magnetic" ? ["hum"] : [], { foot: i % 2 === 0 ? 0 : 1, index: i });
      const off = Math.floor((base + i * 0.28 + (i === 6 ? 0.12 : 0)) * sr);
      for (let k = 0; k < bufL.length && off + k < n; k++) {
        L[off + k]! += bufL[k]! * g;
        R[off + k]! += bufR[k]! * g;
      }
    }
  });
  const file = path.join(out, `steps-${f}.wav`);
  writeWav(file, L, R, sr);
  if (png)
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      file,
      "-lavfi",
      "showspectrumpic=s=1600x400:legend=0:scale=log:fscale=log",
      file.replace(/\.wav$/, ".png"),
    ]);
}
console.log(`reels → ${out} (motion layers: ${MOTION_LAYER_KINDS.join(", ")})`);

function writeWav(file: string, L: Float32Array, R: Float32Array, rate: number): void {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.tanh(L[i]! * 1.5) * 32000), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.tanh(R[i]! * 1.5) * 32000), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}
