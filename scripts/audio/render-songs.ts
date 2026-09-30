/**
 * Render songs to WAV / MP3 and print level stats.
 *
 *   node_modules/.bin/vite-node scripts/audio/render-songs.ts -- [--out DIR] [--seconds N] [--mp3] [--length standard|long|epic] [id|genre ...]
 *
 * Without ids renders the whole catalogue. Stats: peak, RMS, quietest /
 * loudest 2-second window, clipped share. MP3 needs `lame` on PATH.
 * `--length` renders the extended arrangement (default: standard = as composed).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { SONGS } from "@/lib/world/audio/songs/catalog";
import { levelStats, renderSong } from "@/lib/world/audio/songs/offline";
import { songSeconds } from "@/lib/world/audio/songs/arrange";
import { songGain } from "@/lib/world/audio/songs/level";
import { SONG_LENGTHS, type SongLength } from "@/lib/world/audio/songs/styles";

const args = process.argv.slice(2).filter((a) => a !== "--");
const flag = (n: string) => args.includes(n);
const val = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const out = val("--out") ?? "/tmp/unlabs-songs";
const seconds = val("--seconds") ? Number(val("--seconds")) : undefined;
const mp3 = flag("--mp3");
const gain = val("--gain") ? Number(val("--gain")) : 1.6;
const lengthArg = val("--length") ?? "standard";
const length: SongLength = (SONG_LENGTHS as readonly string[]).includes(lengthArg)
  ? (lengthArg as SongLength)
  : "standard";
const picks = args.filter(
  (a, i) =>
    !a.startsWith("--") &&
    !["--out", "--seconds", "--gain", "--length"].includes(args[i - 1] ?? ""),
);
const list = SONGS.filter((s) => !picks.length || picks.includes(s.id) || picks.includes(s.genre));
fs.mkdirSync(out, { recursive: true });

function wav(file: string, l: Float32Array, r: Float32Array, sr: number, g: number): void {
  const n = l.length;
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
  // Soft limiter (tanh) like the game's master compressor, then 16 bit.
  for (let i = 0; i < n; i++) {
    const a = Math.tanh(l[i]! * g);
    const b = Math.tanh(r[i]! * g);
    buf.writeInt16LE(Math.round(a * 32000), 44 + i * 4);
    buf.writeInt16LE(Math.round(b * 32000), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}

const rows: string[] = [];
for (const s of list) {
  const t0 = Date.now();
  const r = renderSong(s, {
    sampleRate: mp3 ? 32000 : 22050,
    length,
    ...(seconds ? { maxSeconds: seconds } : {}),
  });
  const st = levelStats(r);
  const inner = st.windows.slice(1, -2);
  const lo = Math.min(...inner);
  const hi = Math.max(...inner);
  const file = path.join(out, `${s.id}.wav`);
  // Game level (loudness table) × export gain, soft-limited like the master compressor.
  wav(file, r.left, r.right, r.sampleRate, gain * songGain(s));
  if (mp3) {
    execFileSync("lame", ["--quiet", "-V", "4", file, file.replace(/\.wav$/, ".mp3")]);
    fs.rmSync(file);
  }
  rows.push(
    `${s.id.padEnd(30)} ${s.genre.padEnd(10)} ${songSeconds(s, length).toFixed(0).padStart(4)}s  peak ${st.peak.toFixed(2)}  rms ${st.rms.toFixed(3)}  win ${lo.toFixed(3)}–${hi.toFixed(3)}  clip ${(st.clipped * 100).toFixed(2)}%  (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
  );
  console.log(rows[rows.length - 1]);
}
