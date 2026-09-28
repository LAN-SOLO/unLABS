/**
 * Tiny source scanner for the i18n tests: finds string literals (skipping
 * comments and regex literals) and `tr(…)` call sites. Not a full parser —
 * good enough for our own code style (prettier-formatted TS/TSX).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(__dirname, "../..");

export interface StrToken {
  /** Decoded value (escape sequences resolved). */
  value: string;
  quote: '"' | "'" | "`";
  /** Template literal with `${…}`. */
  interpolated: boolean;
  start: number;
  end: number;
  line: number;
}

export interface Scan {
  file: string;
  source: string;
  /** Source with comments and string contents blanked (positions preserved). */
  code: string;
  strings: StrToken[];
}

const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  v: "\v",
  "0": "\0",
};

function decode(raw: string): string {
  return raw.replace(
    /\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r?\n|.)/g,
    (_m, e: string) => {
      if (e.startsWith("u{")) return String.fromCodePoint(parseInt(e.slice(2, -1), 16));
      if (e.startsWith("u") && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
      if (e.startsWith("x") && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16));
      if (e === "\n" || e === "\r\n") return "";
      return ESCAPES[e] ?? e;
    },
  );
}

function lineAt(src: string, pos: number): number {
  let n = 1;
  for (let i = 0; i < pos; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

const REGEX_PREV = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "", "\n"]);

export function scanSource(file: string, source: string): Scan {
  const out = source.split("");
  const strings: StrToken[] = [];
  const blank = (a: number, b: number) => {
    for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " ";
  };
  let i = 0;
  const n = source.length;

  const prevSignificant = (pos: number): string => {
    for (let k = pos - 1; k >= 0; k--) {
      const c = out[k]!;
      if (c !== " " && c !== "\t" && c !== "\r") return c;
    }
    return "";
  };

  /** Scan code until an unmatched `}` (for template `${…}`) or EOF. Returns the index after it. */
  const scanCode = (stopAtBrace: boolean): void => {
    let depth = 0;
    while (i < n) {
      const c = source[i]!;
      const d = source[i + 1];
      if (c === "/" && d === "/") {
        const e = source.indexOf("\n", i);
        const end = e < 0 ? n : e;
        blank(i, end);
        i = end;
      } else if (c === "/" && d === "*") {
        const e = source.indexOf("*/", i + 2);
        const end = e < 0 ? n : e + 2;
        blank(i, end);
        i = end;
      } else if (c === '"' || c === "'") {
        const start = i;
        i++;
        while (i < n && source[i] !== c && source[i] !== "\n") i += source[i] === "\\" ? 2 : 1;
        const raw = source.slice(start + 1, i);
        i++;
        strings.push({
          value: decode(raw),
          quote: c,
          interpolated: false,
          start,
          end: i,
          line: lineAt(source, start),
        });
        blank(start + 1, i - 1);
      } else if (c === "`") {
        const start = i;
        i++;
        let raw = "";
        let interpolated = false;
        while (i < n && source[i] !== "`") {
          if (source[i] === "\\") {
            raw += source.slice(i, i + 2);
            i += 2;
          } else if (source[i] === "$" && source[i + 1] === "{") {
            interpolated = true;
            raw += "${…}";
            blank(i, i + 2);
            i += 2;
            scanCode(true);
          } else {
            raw += source[i];
            out[i] = source[i] === "\n" ? "\n" : " ";
            i++;
          }
        }
        i++;
        strings.push({
          value: decode(raw),
          quote: "`",
          interpolated,
          start,
          end: i,
          line: lineAt(source, start),
        });
      } else if (c === "/" && REGEX_PREV.has(prevSignificant(i))) {
        // Regex literal.
        const start = i;
        i++;
        let inClass = false;
        while (i < n && source[i] !== "\n") {
          const r = source[i]!;
          if (r === "\\") i += 2;
          else {
            if (r === "[") inClass = true;
            else if (r === "]") inClass = false;
            else if (r === "/" && !inClass) break;
            i++;
          }
        }
        i++;
        blank(start + 1, i - 1);
      } else if (c === "{") {
        depth++;
        i++;
      } else if (c === "}") {
        if (stopAtBrace && depth === 0) {
          blank(i, i + 1);
          i++;
          return;
        }
        depth--;
        i++;
      } else i++;
    }
  };
  scanCode(false);
  return { file, source, code: out.join(""), strings };
}

export interface TrCall {
  file: string;
  line: number;
  /** The decoded first argument, or null when it is not a plain string literal. */
  key: string | null;
  problem?: string;
}

const TR_CALL = /\btr\(\s*/g;

export function trCalls(scan: Scan): TrCall[] {
  const byStart = new Map(scan.strings.map((s) => [s.start, s]));
  const calls: TrCall[] = [];
  for (const m of scan.code.matchAll(TR_CALL)) {
    // Skip the definition itself (`function tr(`).
    const before = scan.code.slice(Math.max(0, m.index - 9), m.index);
    if (/function\s+$/.test(before)) continue;
    const at = m.index + m[0].length;
    const line = lineAt(scan.source, m.index);
    const tok = byStart.get(at);
    if (!tok) {
      calls.push({ file: scan.file, line, key: null, problem: "first argument is not a literal" });
      continue;
    }
    if (tok.interpolated) {
      calls.push({ file: scan.file, line, key: null, problem: "template literal with ${}" });
      continue;
    }
    const after = /^\s*([,)])/.exec(scan.code.slice(tok.end));
    if (!after) {
      calls.push({
        file: scan.file,
        line,
        key: null,
        problem: "first argument is an expression (concatenation?)",
      });
      continue;
    }
    calls.push({ file: scan.file, line, key: tok.value });
  }
  return calls;
}

const EXT = /\.(ts|tsx)$/;

export function listSources(dirs: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    const abs = path.join(ROOT, rel);
    let st;
    try {
      st = statSync(abs);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      for (const e of readdirSync(abs).sort()) walk(path.posix.join(rel, e));
    } else if (EXT.test(rel)) out.push(rel);
  };
  dirs.forEach(walk);
  return out;
}

export function scanFile(rel: string): Scan {
  return scanSource(rel, readFileSync(path.join(ROOT, rel), "utf8"));
}

/** Placeholders in a string: `{name}` and `{key:action}` tokens, sorted. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{[A-Za-z_][A-Za-z0-9_]*(?::[A-Za-z]+)?\}/g)].map((m) => m[0]).sort();
}

const GERMAN_CHARS = /[äöüÄÖÜß»«„]/;
const GERMAN_WORDS =
  /(^|[\s(])(der|und|nicht|ist|mit|eine|einen|wird|werden|auf|dem|sich|auch|noch|oder|kein|keine|zum|zur|bitte|jetzt)([\s.,!?:;)]|$)/;

/** Heuristic: does this text look German? */
export function looksGerman(text: string): boolean {
  return GERMAN_CHARS.test(text) || GERMAN_WORDS.test(text);
}

/** JSX text between tags (`>Text<`) in the blanked code, with its line. */
export function jsxTexts(scan: Scan): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  for (const m of scan.code.matchAll(/>([^<>{}]*[A-Za-zÄÖÜäöüß][^<>{}]*)</g)) {
    const text = m[1]!.trim();
    // Skip generics / comparisons that happen to sit between > and <.
    if (!text || /[=;()]/.test(text)) continue;
    out.push({ text, line: lineAt(scan.source, m.index) });
  }
  return out;
}
