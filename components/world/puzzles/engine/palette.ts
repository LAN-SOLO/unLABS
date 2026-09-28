/**
 * PZ_PALETTE_WIRING — patch colour channels onto output channels.
 *
 * A hidden permutation (input i → output solution[i]) is described by
 * serialisable clues. Clues are added greedily until exactly one
 * permutation satisfies all of them.
 */
import { mulberry32, randInt, type Rng } from "@/components/world/puzzles/rng";
import { tr } from "@/lib/i18n";

export interface PaletteChannel {
  id: string;
  label: string;
  color: string;
  rgb: [number, number, number];
  warm: boolean;
}

export const PALETTE_CHANNELS: readonly PaletteChannel[] = [
  { id: "rot", label: tr("Red"), color: "#FF4040", rgb: [255, 64, 64], warm: true },
  { id: "gruen", label: tr("Green"), color: "#33FF33", rgb: [51, 255, 51], warm: false },
  { id: "blau", label: tr("Blue"), color: "#3AA0FF", rgb: [58, 160, 255], warm: false },
  { id: "gelb", label: tr("Yellow"), color: "#FFE040", rgb: [255, 224, 64], warm: true },
  { id: "violett", label: tr("Violet"), color: "#B060FF", rgb: [176, 96, 255], warm: false },
];

export type PaletteClue =
  | { type: "not"; input: number; out: number }
  | { type: "higher"; a: number; b: number }
  | { type: "adjacent"; a: number; b: number }
  | { type: "warmth"; out: number; warm: boolean }
  | { type: "on"; input: number; out: number };

/** perm[input] = output index, or null when not wired. */
export type Wiring = readonly (number | null)[];

export interface PalettePuzzle {
  channels: PaletteChannel[];
  solution: number[];
  clues: PaletteClue[];
}

/** Evaluate a clue; `null` when the wiring is too incomplete to judge. */
export function clueHolds(
  clue: PaletteClue,
  perm: Wiring,
  channels: readonly PaletteChannel[],
): boolean | null {
  switch (clue.type) {
    case "not": {
      const o = perm[clue.input];
      return o === null || o === undefined ? null : o !== clue.out;
    }
    case "on": {
      const o = perm[clue.input];
      return o === null || o === undefined ? null : o === clue.out;
    }
    case "higher": {
      const a = perm[clue.a];
      const b = perm[clue.b];
      return a === null || b === null || a === undefined || b === undefined ? null : a > b;
    }
    case "adjacent": {
      const a = perm[clue.a];
      const b = perm[clue.b];
      return a === null || b === null || a === undefined || b === undefined
        ? null
        : Math.abs(a - b) === 1;
    }
    case "warmth": {
      const input = perm.findIndex((o) => o === clue.out);
      if (input < 0) return null;
      return channels[input].warm === clue.warm;
    }
  }
}

export function clueText(clue: PaletteClue, channels: readonly PaletteChannel[]): string {
  const L = (i: number) => channels[i]?.label ?? "?";
  switch (clue.type) {
    case "not":
      return tr("{a} is not on channel {n}.", { a: L(clue.input), n: clue.out + 1 });
    case "on":
      return tr("{a} is on channel {n}.", { a: L(clue.input), n: clue.out + 1 });
    case "higher":
      return tr("{a} is on a higher channel than {b}.", { a: L(clue.a), b: L(clue.b) });
    case "adjacent":
      return tr("{a} and {b} sit right next to each other.", { a: L(clue.a), b: L(clue.b) });
    case "warmth":
      return clue.warm
        ? tr("Channel {n} carries a warm colour.", { n: clue.out + 1 })
        : tr("Channel {n} carries a cold colour.", { n: clue.out + 1 });
  }
}

export function permutations(n: number): number[][] {
  if (n <= 0) return [[]];
  const out: number[][] = [];
  for (const p of permutations(n - 1)) {
    for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  }
  return out;
}

export function countSolutions(
  n: number,
  clues: readonly PaletteClue[],
  channels: readonly PaletteChannel[],
): number {
  return permutations(n).filter((p) => clues.every((c) => clueHolds(c, p, channels) === true))
    .length;
}

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generatePalette(seed: number, channelCount: number): PalettePuzzle {
  const n = Math.max(3, Math.min(PALETTE_CHANNELS.length, Math.floor(channelCount)));
  const rng = mulberry32(seed * 7919 + 3);
  const channels = PALETTE_CHANNELS.slice(0, n);
  let solution = shuffle(
    rng,
    channels.map((_, i) => i),
  );
  // Never the identity wiring — that would be too kind.
  if (solution.every((o, i) => o === i)) solution = [...solution.slice(1), solution[0]];

  const pool: PaletteClue[] = [];
  for (let i = 0; i < n; i++) {
    for (let o = 0; o < n; o++) if (solution[i] !== o) pool.push({ type: "not", input: i, out: o });
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (solution[i] > solution[j]) pool.push({ type: "higher", a: i, b: j });
      if (i < j && Math.abs(solution[i] - solution[j]) === 1)
        pool.push({ type: "adjacent", a: i, b: j });
    }
  }
  for (let o = 0; o < n; o++) {
    const input = solution.indexOf(o);
    pool.push({ type: "warmth", out: o, warm: channels[input].warm });
  }

  const all = permutations(n);
  let alive = all;
  const clues: PaletteClue[] = [];
  for (const clue of shuffle(rng, pool)) {
    if (alive.length <= 1) break;
    const next = alive.filter((p) => clueHolds(clue, p, channels) === true);
    if (next.length < alive.length) {
      clues.push(clue);
      alive = next;
    }
  }
  // Last resort: pin inputs directly.
  for (let i = 0; alive.length > 1 && i < n; i++) {
    const clue: PaletteClue = { type: "on", input: i, out: solution[i] };
    const next = alive.filter((p) => clueHolds(clue, p, channels) === true);
    if (next.length < alive.length) {
      clues.push(clue);
      alive = next;
    }
  }
  return { channels, solution, clues };
}

/** Channel weights: Kanal 1 dominates the mix. */
export function channelWeight(out: number, n: number): number {
  return (n - out) / ((n * (n + 1)) / 2);
}

/** Weighted RGB mix of the wiring (unwired inputs contribute nothing). */
export function mixColor(
  perm: Wiring,
  channels: readonly PaletteChannel[],
): [number, number, number] {
  const n = channels.length;
  const acc: [number, number, number] = [0, 0, 0];
  let total = 0;
  perm.forEach((o, i) => {
    if (o === null || o === undefined) return;
    const w = channelWeight(o, n);
    total += w;
    for (let k = 0; k < 3; k++) acc[k] += channels[i].rgb[k] * w;
  });
  if (total <= 0) return [0, 0, 0];
  return [Math.round(acc[0] / total), Math.round(acc[1] / total), Math.round(acc[2] / total)];
}

const NAMED: readonly { name: string; rgb: [number, number, number] }[] = [
  { name: tr("Red"), rgb: [255, 60, 60] },
  { name: tr("Orange"), rgb: [255, 150, 50] },
  { name: tr("Yellow"), rgb: [240, 230, 60] },
  { name: tr("Green"), rgb: [60, 230, 60] },
  { name: tr("Cyan"), rgb: [60, 220, 230] },
  { name: tr("Blue"), rgb: [60, 110, 255] },
  { name: tr("Violet"), rgb: [160, 80, 255] },
  { name: tr("Magenta"), rgb: [240, 70, 200] },
  { name: tr("White"), rgb: [230, 230, 230] },
];

export function colorName(rgb: readonly [number, number, number]): string {
  let best = NAMED[0];
  let bestD = Infinity;
  for (const c of NAMED) {
    const d = c.rgb.reduce((s, v, k) => s + (v - rgb[k]) ** 2, 0);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.name;
}

export function toHex(rgb: readonly [number, number, number]): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

export function wiringSolved(perm: Wiring, solution: readonly number[]): boolean {
  return perm.length === solution.length && perm.every((o, i) => o === solution[i]);
}
