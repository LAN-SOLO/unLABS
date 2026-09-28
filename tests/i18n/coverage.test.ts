/**
 * i18n coverage for the Lab World.
 *
 * - Every `tr("…")` literal in an ENFORCED path must have a German entry.
 * - `tr`'s first argument must be a plain string literal (no `${}`, no `+`).
 * - Enforced paths must not contain German-looking literals or JSX text
 *   (put the German into lib/i18n/de/<area>.ts instead). Escape hatch for a
 *   deliberate exception: `// i18n-ignore` on the same line.
 * - Dictionaries: no key with two different German values across areas, and
 *   the `{placeholders}` of key and value must match.
 *
 * Non-enforced paths are only reported (console), unless I18N_STRICT=1.
 * TRANSLATORS: after converting a file/folder, add it to ENFORCED_PATHS.
 */

import { describe, expect, it } from "vitest";
import { DE, DE_AREAS } from "@/lib/i18n/de";
import {
  jsxTexts,
  listSources,
  looksGerman,
  placeholders,
  scanFile,
  trCalls,
  type TrCall,
} from "./scan";

/** Files or folders (prefix match, repo-relative) that are fully converted. */
/** The whole Lab World is converted — every scanned file is enforced. */
export const ENFORCED_PATHS: readonly string[] = ["lib/world/", "components/world/", "app/world/"];

const SCANNED_DIRS = ["lib/world", "components/world", "app/world"] as const;

const STRICT = process.env.I18N_STRICT === "1";

function enforced(file: string): boolean {
  return (
    STRICT || ENFORCED_PATHS.some((p) => file === p || (p.endsWith("/") && file.startsWith(p)))
  );
}

const files = listSources(SCANNED_DIRS);
const scans = files.map(scanFile);
const calls: TrCall[] = scans.flatMap(trCalls);

function fmt(c: { file: string; line: number }, what: string): string {
  return `${c.file}:${c.line}  ${what}`;
}

describe("i18n coverage", () => {
  it("scans the Lab World sources", () => {
    expect(files.length).toBeGreaterThan(50);
    for (const p of ENFORCED_PATHS)
      expect(
        files.some((f) => f === p || f.startsWith(p)),
        `ENFORCED_PATHS entry matches nothing: ${p}`,
      ).toBe(true);
  });

  it("tr() is always called with a plain string literal (enforced paths)", () => {
    const bad = calls.filter((c) => c.problem && enforced(c.file));
    expect(bad.map((c) => fmt(c, c.problem!))).toEqual([]);
  });

  it("every tr() literal has a German translation (enforced paths)", () => {
    const missing = calls.filter((c) => c.key !== null && !DE.has(c.key));
    const hard = missing.filter((c) => enforced(c.file));
    const soft = missing.length - hard.length;
    if (soft > 0) console.info(`[i18n] ${soft} tr() keys without German in non-enforced files`);
    expect(hard.map((c) => fmt(c, JSON.stringify(c.key)))).toEqual([]);
  });

  it("enforced paths contain no German-looking literals or JSX text", () => {
    const found: string[] = [];
    for (const s of scans) {
      if (!enforced(s.file)) continue;
      const lines = s.source.split("\n");
      const ignored = (line: number) => lines[line - 1]?.includes("i18n-ignore") ?? false;
      for (const t of s.strings)
        if (looksGerman(t.value) && !ignored(t.line))
          found.push(fmt({ file: s.file, line: t.line }, JSON.stringify(t.value)));
      for (const t of jsxTexts(s))
        if (looksGerman(t.text) && !ignored(t.line))
          found.push(fmt({ file: s.file, line: t.line }, `JSX text ${JSON.stringify(t.text)}`));
    }
    expect(found).toEqual([]);
  });

  it("reports overall progress (informational)", () => {
    const pending = scans.filter(
      (s) => !enforced(s.file) && s.strings.some((t) => looksGerman(t.value)),
    );
    console.info(
      `[i18n] ${calls.length} tr() calls, ${DE.size} German entries, ${pending.length} files still German`,
    );
    expect(true).toBe(true);
  });
});

describe("German dictionaries", () => {
  it("a key never has two different German values across areas", () => {
    const seen = new Map<string, { area: string; value: string }>();
    const conflicts: string[] = [];
    for (const [area, dict] of Object.entries(DE_AREAS)) {
      for (const [k, v] of Object.entries(dict)) {
        const prev = seen.get(k);
        if (prev && prev.value !== v)
          conflicts.push(
            `${JSON.stringify(k)}: ${prev.area}=${JSON.stringify(prev.value)} vs ${area}=${JSON.stringify(v)} — use a context key like "door::Open"`,
          );
        else if (!prev) seen.set(k, { area, value: v });
      }
    }
    expect(conflicts).toEqual([]);
  });

  it("placeholders in key and translation match", () => {
    const bad: string[] = [];
    for (const [area, dict] of Object.entries(DE_AREAS))
      for (const [k, v] of Object.entries(dict)) {
        const a = [...new Set(placeholders(k))].join(" ");
        const b = [...new Set(placeholders(v))].join(" ");
        if (a !== b) bad.push(`${area}: ${JSON.stringify(k)} {${a}} ≠ {${b}}`);
      }
    expect(bad).toEqual([]);
  });

  it("no empty translations", () => {
    const empty = Object.entries(DE_AREAS).flatMap(([area, d]) =>
      Object.entries(d)
        .filter(([, v]) => v.trim() === "")
        .map(([k]) => `${area}: ${JSON.stringify(k)}`),
    );
    expect(empty).toEqual([]);
  });
});
