/**
 * Game logic never branches on translated text.
 * ==============================================
 *
 * Since the translation, every player-visible string can differ per locale.
 * Code that compares such text (`msg.startsWith("Missing")`,
 * `label === tr("Open")`, …) silently breaks in the other language. Logic
 * must compare ids, flags, enum values or status fields instead.
 *
 * This is a source scan over the Lab World and the terminal ↔ world sync.
 * The only allowed hits are purely cosmetic line colouring in the room
 * terminal, whose prefixes are guarded by the dictionary check below.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTEXT_SEPARATOR } from "@/lib/i18n";
import { DE } from "@/lib/i18n/de";

const ROOT = path.resolve(__dirname, "../..");

const SCAN = [
  "lib/world",
  "components/world",
  "lib/terminal/labSync.ts",
  "lib/terminal/labWorld.ts",
];

function files(rel: string): string[] {
  const abs = path.join(ROOT, rel);
  if (statSync(abs).isFile()) return [rel];
  return readdirSync(abs).flatMap((name) => {
    const child = path.join(rel, name);
    if (statSync(path.join(ROOT, child)).isDirectory()) return files(child);
    return /\.(ts|tsx)$/.test(name) ? [child] : [];
  });
}

/** Comparisons against the output of `tr()` (the text the player sees). */
const AGAINST_TR = [
  /\b(startsWith|endsWith|includes|indexOf|lastIndexOf|localeCompare)\(\s*tr\(/,
  /[!=]==\s*tr\(/,
  /\btr\([^()]*\)\s*[!=]==/,
  /\bcase\s+tr\(/,
];

/** Prefix/substring checks of message-like fields against a string literal. */
const AGAINST_LITERAL =
  /\b(msg|message|text|reason|label|title|line|hint|blurb|description|name)\??\.(startsWith|endsWith|includes)\(\s*["'`]/;

/** Cosmetic colouring of already-rendered terminal lines (see the prefix test). */
const ALLOWED = new Set(["components/world/RoomTerminal.tsx:lineColor"]);

function enclosingFunction(lines: string[], i: number): string {
  for (let k = i; k >= 0; k--) {
    const m = /function\s+([A-Za-z0-9_]+)/.exec(lines[k]!);
    if (m) return m[1]!;
  }
  return "?";
}

describe("no branching on translated text", () => {
  const all = SCAN.flatMap(files);

  it("scans the lab world sources", () => {
    expect(all.length).toBeGreaterThan(50);
    expect(all).toContain("lib/world/game.ts");
  });

  it("never compares against tr() output or message text literals", () => {
    const hits: string[] = [];
    for (const rel of all) {
      const lines = readFileSync(path.join(ROOT, rel), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        const bad = AGAINST_TR.some((re) => re.test(line)) || AGAINST_LITERAL.test(line);
        if (!bad) return;
        if (ALLOWED.has(`${rel}:${enclosingFunction(lines, i)}`)) return;
        hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });

  it("room-terminal colour prefixes survive translation", () => {
    // RoomTerminal colours lines by these prefixes; `[ACCEPTED]` is compared via tr().
    const prefixes = ["MCP>", "[EXTERNAL]", "R3-TR0>", "!"];
    const broken: string[] = [];
    for (const [key, de] of DE) {
      const i = key.indexOf(CONTEXT_SEPARATOR);
      const en = i < 0 ? key : key.slice(i + CONTEXT_SEPARATOR.length);
      for (const p of prefixes)
        if (en.startsWith(p) !== de.startsWith(p)) broken.push(`${p}: ${en} → ${de}`);
    }
    expect(broken).toEqual([]);
  });

  it("the dialogue hint placeholder is not in any dictionary", () => {
    expect(DE.has("__HINT__")).toBe(false);
  });
});
