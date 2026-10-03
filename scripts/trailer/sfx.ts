/**
 * The game's sound effects as single WAV files for the trailer mix.
 *
 *   node_modules/.bin/vite-node --config scripts/audio/vite.config.mjs scripts/trailer/sfx.ts [name ...]
 *
 * Writes .voxel/trailer/sfx/<name>[-<k>].wav (48 kHz stereo, 4.2 s, three
 * seeded variants each) from lib/world/audio/sfx.ts — the same synthesis the
 * game plays.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SFX, SFX_NAMES } from "@/lib/world/audio/sfx";
import { OfflineTarget } from "@/lib/world/audio/songs/offline";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "../../.voxel/trailer/sfx");
const picks = process.argv.slice(2).filter((a) => a !== "--" && !a.startsWith("--"));
const SR = 48000;
const SECONDS = 4.2;
fs.mkdirSync(OUT, { recursive: true });

function wav(file: string, l: Float32Array, r: Float32Array): void {
  const n = l.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.tanh(l[i]! * 1.2) * 32000), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.tanh(r[i]! * 1.2) * 32000), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}

let count = 0;
for (const name of SFX_NAMES) {
  if (name === "footstep" || (picks.length && !picks.includes(name))) continue;
  for (let k = 0; k < 3; k++) {
    const l = new Float32Array(Math.ceil(SECONDS * SR));
    const r = new Float32Array(l.length);
    const t = new OfflineTarget(l, r, SR, 0, 11 + k * 7);
    SFX[name as keyof typeof SFX](t, {});
    wav(path.join(OUT, k ? `${name}-${k}.wav` : `${name}.wav`), l, r);
    count++;
  }
}
console.log(`[trailer] sfx: ${count} files → .voxel/trailer/sfx`);
