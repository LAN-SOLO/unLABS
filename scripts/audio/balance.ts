/**
 * Spectral balance per song: share of energy below 150 Hz and above 2 kHz
 * (offline render of 40 s from bar 8). Flags muddy mixes (low share high).
 *
 *   node_modules/.bin/vite-node --config scripts/audio/vite.config.mjs scripts/audio/balance.ts -- [id|genre ...]
 */
import { SONGS } from "@/lib/world/audio/songs/catalog";
import { renderSong } from "@/lib/world/audio/songs/offline";

const picks = process.argv.slice(2).filter((a) => a !== "--");
const list = SONGS.filter((s) => !picks.length || picks.includes(s.id) || picks.includes(s.genre));

/** One-pole filter energy split (cheap, good enough to compare songs). */
function bands(x: Float32Array, sr: number): { low: number; high: number; total: number } {
  const aL = 1 - Math.exp((-2 * Math.PI * 150) / sr);
  const aH = 1 - Math.exp((-2 * Math.PI * 2000) / sr);
  let lp = 0;
  let lp2 = 0;
  let low = 0;
  let high = 0;
  let total = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    lp += aL * (v - lp);
    lp2 += aH * (v - lp2);
    const h = v - lp2;
    low += lp * lp;
    high += h * h;
    total += v * v;
  }
  return { low, high, total };
}

for (const s of list) {
  const r = renderSong(s, { sampleRate: 16000, maxSeconds: 40, fromBar: 8, hall: false, tail: 0 });
  const mono = new Float32Array(r.left.length);
  for (let i = 0; i < mono.length; i++) mono[i] = (r.left[i]! + r.right[i]!) / 2;
  const b = bands(mono, r.sampleRate);
  const low = b.low / b.total;
  const high = b.high / b.total;
  console.log(
    `${s.id.padEnd(32)} low ${(low * 100).toFixed(0).padStart(3)}%  high ${(high * 100).toFixed(0).padStart(3)}%${low > 0.55 ? "  ← muddy?" : ""}`,
  );
}
