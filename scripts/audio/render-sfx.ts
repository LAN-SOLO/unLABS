/**
 * Render every sound effect (and each footstep surface) into one reel +
 * per-effect peak stats.
 *
 *   node_modules/.bin/vite-node --config scripts/audio/vite.config.mjs scripts/audio/render-sfx.ts -- [--out DIR] [--mp3] [name ...]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { SFX, SFX_NAMES, SURFACES, FOOTSTEP_GAIN } from "@/lib/world/audio/sfx";
import { OfflineTarget, levelStats } from "@/lib/world/audio/songs/offline";

const args = process.argv.slice(2).filter((a) => a !== "--");
const outI = args.indexOf("--out");
const out = outI >= 0 ? args[outI + 1]! : "/tmp/unlabs-sfx";
const mp3 = args.includes("--mp3");
const picks = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
fs.mkdirSync(out, { recursive: true });
const sr = 32000;
const items: { name: string; surface?: (typeof SURFACES)[number]; gain: number }[] = [];
for (const n of SFX_NAMES) {
  if (picks.length && !picks.includes(n)) continue;
  if (n === "footstep")
    for (const s of SURFACES)
      for (let k = 0; k < 4; k++) items.push({ name: n, surface: s, gain: FOOTSTEP_GAIN[s] });
  else items.push({ name: n, gain: 1 });
}
const slot = (name: string) => (name === "footstep" ? 0.28 : 4.2);
const total = items.reduce((n, it) => n + slot(it.name), 0) + 1;
const L = new Float32Array(Math.ceil(total * sr));
const R = new Float32Array(L.length);
let at = 0.3;
for (const it of items) {
  const oneL = new Float32Array(Math.ceil(4.2 * sr));
  const oneR = new Float32Array(oneL.length);
  const t = new OfflineTarget(oneL, oneR, sr, 0, 3 + items.indexOf(it));
  SFX[it.name as keyof typeof SFX](t, it.surface ? { surface: it.surface } : {});
  const st = levelStats({ left: oneL, right: oneR, sampleRate: sr, seconds: 4.2 });
  if (!(it.name === "footstep" && items.indexOf(it) % 4)) {
    console.log(
      `${(it.surface ? `${it.name}:${it.surface}` : it.name).padEnd(22)} peak ${(st.peak * it.gain).toFixed(3)}  rms ${(st.rms * it.gain).toFixed(4)}`,
    );
  }
  const off = Math.floor(at * sr);
  for (let i = 0; i < oneL.length && off + i < L.length; i++) {
    L[off + i]! += oneL[i]! * it.gain;
    R[off + i]! += oneR[i]! * it.gain;
  }
  at += slot(it.name);
}
const file = path.join(out, "sfx-reel.wav");
const n = L.length;
const buf = Buffer.alloc(44 + n * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + n * 4, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(sr, 24);
buf.writeUInt32LE(sr * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  buf.writeInt16LE(Math.round(Math.tanh(L[i]! * 1.2) * 32000), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.tanh(R[i]! * 1.2) * 32000), 46 + i * 4);
}
fs.writeFileSync(file, buf);
if (mp3) {
  execFileSync("lame", ["--quiet", "-V", "4", file, file.replace(/\.wav$/, ".mp3")]);
  fs.rmSync(file);
}
console.log(`reel: ${items.length} sounds, ${total.toFixed(0)} s → ${out}`);
