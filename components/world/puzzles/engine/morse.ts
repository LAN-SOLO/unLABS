/**
 * Morse whisper (EP6) — pure logic.
 *
 * The whisper arrived without letter gaps: `. _ . . _ _ _ . . . _ . _ _`.
 * Only the timing carries the letter boundaries (`groups` = symbols per letter).
 */

export type MorseSymbol = "." | "-";

export const MORSE: Readonly<Record<string, string>> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
};

const REVERSE: ReadonlyMap<string, string> = new Map(
  Object.entries(MORSE).map(([letter, code]) => [code, letter]),
);

export const DEFAULT_WHISPER = ". _ . . _ _ _ . . . _ . _ _";
export const DEFAULT_GROUPS: readonly number[] = [4, 3, 4, 3];

/** Accepts `.`, `·`, `_`, `-`, `–`, `−`; everything else (spaces, slashes) is ignored. */
export function parseSignal(signal: string): MorseSymbol[] {
  const out: MorseSymbol[] = [];
  for (const ch of signal) {
    if (ch === "." || ch === "·") out.push(".");
    else if (ch === "_" || ch === "-" || ch === "–" || ch === "−") out.push("-");
  }
  return out;
}

/** Split symbols into per-letter codes; null when groups don't fit exactly. */
export function splitGroups(
  symbols: readonly MorseSymbol[],
  groups: readonly number[],
): string[] | null {
  if (groups.length === 0) return null;
  let total = 0;
  for (const g of groups) {
    if (!Number.isInteger(g) || g <= 0) return null;
    total += g;
  }
  if (total !== symbols.length) return null;
  const out: string[] = [];
  let i = 0;
  for (const g of groups) {
    out.push(symbols.slice(i, i + g).join(""));
    i += g;
  }
  return out;
}

export function decodeCode(code: string): string | null {
  return REVERSE.get(code) ?? null;
}

/** Decode codes to letters; unknown codes become "?". */
export function decodeGroups(codes: readonly string[]): string {
  return codes.map((c) => decodeCode(c) ?? "?").join("");
}

export interface MorseSolution {
  symbols: MorseSymbol[];
  codes: string[];
  answer: string;
}

/** Resolve signal/groups/answer with fallbacks to the canonical whisper. */
export function morseSolution(
  signal: string,
  groups: readonly number[],
  answer?: string,
): MorseSolution {
  let symbols = parseSignal(signal);
  let codes = splitGroups(symbols, groups);
  if (!codes) {
    symbols = parseSignal(DEFAULT_WHISPER);
    codes = splitGroups(symbols, DEFAULT_GROUPS) ?? [];
  }
  const decoded = decodeGroups(codes);
  const cleaned = (answer ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  return { symbols, codes, answer: cleaned.length === codes.length ? cleaned : decoded };
}

export interface MorseEvent {
  on: boolean;
  ms: number;
  /** Index into the flat symbol list for "on" events. */
  symbol: number;
}

/** Standard timing: dot 1, dash 3, intra-letter gap 1, letter gap 3 units. */
export function morseTimeline(codes: readonly string[], unitMs: number): MorseEvent[] {
  const u = Math.max(1, unitMs);
  const out: MorseEvent[] = [];
  let idx = 0;
  codes.forEach((code, li) => {
    for (let k = 0; k < code.length; k++) {
      out.push({ on: true, ms: (code[k] === "-" ? 3 : 1) * u, symbol: idx });
      idx++;
      const lastSym = k === code.length - 1;
      const lastLetter = li === codes.length - 1;
      if (!lastSym) out.push({ on: false, ms: u, symbol: -1 });
      else if (!lastLetter) out.push({ on: false, ms: 3 * u, symbol: -1 });
    }
  });
  return out;
}

export function timelineDuration(events: readonly MorseEvent[]): number {
  return events.reduce((s, e) => s + e.ms, 0);
}

/** Classify a key-press duration: shorter than `dashMs` = dot. */
export function classifyPress(ms: number, dashMs = 240): MorseSymbol {
  return ms < dashMs ? "." : "-";
}

export function answerMatches(input: string, answer: string): boolean {
  return input.trim().toUpperCase() === answer.toUpperCase();
}
