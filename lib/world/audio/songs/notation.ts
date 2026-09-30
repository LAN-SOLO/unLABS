/**
 * Song notation (pure).
 * =====================
 *
 * Melody lines are written as space-separated tokens on an eighth-note grid:
 *
 *   `5`      scale degree 5 (1–7, relative to the song key), one eighth
 *   `5:3`    … three eighths long (`:0.5` = a sixteenth, `:1.5` dotted eighth)
 *   `5'` `5,`  an octave up / down (repeatable: `1''`)
 *   `#4` `b7` chromatic alteration
 *   `5!`     accented
 *   `-` `-:4` rest
 *   `_` `_:2` extend the previous note
 *   `|`      bar line (ignored; `lineBars()` checks it for tests)
 *
 * Example (a four-bar phrase in 4/4):  `3 5 6:2 5 3 1:2 | 2:6 -:2 | …`
 *
 * Chords: one token per bar — see `SectionDef.chords`.
 */
import {
  SONG_MODES,
  type BarChord,
  type MelodyNote,
  type ModeName,
  type ParsedLine,
} from "@/lib/world/audio/songs/types";

const NOTE_RE = /^([#b]?)([1-7])([',]*)(!?)(?::(\d+(?:\.\d+)?))?(!?)$/;
const REST_RE = /^-(?::(\d+(?:\.\d+)?))?$/;
const TIE_RE = /^_(?::(\d+(?:\.\d+)?))?$/;

const cache = new Map<string, ParsedLine>();

/** Parse a melody line. Throws on unknown tokens (content tests catch typos). */
export function parseLine(src: string): ParsedLine {
  const hit = cache.get(src);
  if (hit) return hit;
  const notes: MelodyNote[] = [];
  let at = 0;
  /** A tie after a rest is just more rest. */
  let sounding = false;
  for (const tok of src.split(/\s+/)) {
    if (!tok || tok === "|") continue;
    const rest = REST_RE.exec(tok);
    if (rest) {
      at += rest[1] ? Number(rest[1]) : 1;
      sounding = false;
      continue;
    }
    const tie = TIE_RE.exec(tok);
    if (tie) {
      const len = tie[1] ? Number(tie[1]) : 1;
      const last = notes[notes.length - 1];
      if (last && sounding) last.len += len;
      at += len;
      continue;
    }
    const m = NOTE_RE.exec(tok);
    if (!m) throw new Error(`bad melody token "${tok}" in "${src}"`);
    const len = m[5] ? Number(m[5]) : 1;
    let oct = 0;
    for (const c of m[3] ?? "") oct += c === "'" ? 1 : -1;
    notes.push({
      at,
      len,
      degree: Number(m[2]) - 1 + oct * 7,
      acc: m[1] === "#" ? 1 : m[1] === "b" ? -1 : 0,
      accent: m[4] === "!" || m[6] === "!",
    });
    sounding = true;
    at += len;
  }
  const out = { notes, length: at };
  cache.set(src, out);
  return out;
}

/** Bar lengths (eighths) of a line split at `|` — for content tests. */
export function lineBars(src: string): number[] {
  return src
    .split("|")
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => parseLine(b).length);
}

const CHORD_RE = /^(b?)([1-7])([79s2]*)$/;

function chordOf(tok: string, at: number, len: number, prev: BarChord | null): BarChord {
  if (tok === ".") {
    if (!prev) throw new Error(`"." without a previous chord`);
    return { ...prev, at, len };
  }
  const m = CHORD_RE.exec(tok);
  if (!m) throw new Error(`bad chord token "${tok}"`);
  const suf = m[3] ?? "";
  return {
    at,
    len,
    degree: Number(m[2]) - 1,
    flat: m[1] === "b",
    seventh: suf.includes("7"),
    ninth: suf.includes("9"),
    sus: suf.includes("s") ? 4 : suf.includes("2") ? 2 : 0,
  };
}

const chordCache = new Map<string, BarChord[][]>();

/** Parse a chord string into one list of chords per bar. */
export function parseChords(src: string, barEighths: number): BarChord[][] {
  const key = `${barEighths}|${src}`;
  const hit = chordCache.get(key);
  if (hit) return hit;
  const bars: BarChord[][] = [];
  let prev: BarChord | null = null;
  for (const tok of src.split(/\s+/)) {
    if (!tok || tok === "|") continue;
    const parts = tok.split("-");
    const len = barEighths / parts.length;
    const bar = parts.map((p, i) => {
      const c = chordOf(p, i * len, len, prev);
      prev = c;
      return c;
    });
    bars.push(bar);
  }
  if (!bars.length) throw new Error("empty chord string");
  chordCache.set(key, bars);
  return bars;
}

/** MIDI note of a scale degree (degrees wrap into octaves). */
export function degreeMidi(key: number, mode: ModeName, degree: number, acc = 0): number {
  const scale = SONG_MODES[mode];
  const n = scale.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return key + oct * 12 + scale[idx]! + acc;
}

/** Chord tones as MIDI notes above the chord root (root position, root near `key`). */
export function chordMidi(key: number, mode: ModeName, c: BarChord): number[] {
  if (c.flat) {
    // Major chord a semitone below the degree of the song's mode: in major
    // b7 = ♭VII, b6 = ♭VI, b3 = ♭III; in minor b6 = V, b2 = ♭II (Neapolitan).
    const root = degreeMidi(key, mode, c.degree) - 1;
    const out = [root, root + (c.sus === 4 ? 5 : c.sus === 2 ? 2 : 4), root + 7];
    if (c.seventh) out.push(root + 10);
    if (c.ninth) out.push(root + 14);
    return out;
  }
  const d = c.degree;
  const third = c.sus === 4 ? d + 3 : c.sus === 2 ? d + 1 : d + 2;
  const degs = [d, third, d + 4];
  if (c.seventh) degs.push(d + 6);
  if (c.ninth) degs.push(d + 8);
  return degs.map((x) => degreeMidi(key, mode, x));
}

/** Put a pitch class near `center` (nearest octave). */
export function nearest(midi: number, center: number): number {
  let m = midi;
  while (m - center > 6) m -= 12;
  while (center - m > 6) m += 12;
  return m;
}

/** Close voicing around `center`, sorted low → high. */
export function voiceNear(notes: readonly number[], center: number): number[] {
  return notes.map((n) => nearest(n, center)).sort((a, b) => a - b);
}
