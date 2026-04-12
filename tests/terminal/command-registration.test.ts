import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Guardrail against the "most common bug" noted in CLAUDE.md:
// forgetting to add a new terminal command to the `commands[]` array at
// the bottom of lib/terminal/commands.ts. This test parses the source
// file textually, then diffs declared commands against registered ones.

const COMMANDS_FILE = path.resolve(__dirname, "../../lib/terminal/commands.ts");

function loadSource(): string {
  return readFileSync(COMMANDS_FILE, "utf8");
}

// Match: `const fooCommand: Command = {` (with optional export)
const DECLARATION_RE = /(?:^|\n)\s*(?:export\s+)?const\s+(\w+Command)\s*:\s*Command\s*=\s*\{/g;

function collectDeclaredCommands(source: string): Set<string> {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = DECLARATION_RE.exec(source)) !== null) {
    names.add(m[1]);
  }
  return names;
}

function collectRegisteredCommands(source: string): Set<string> {
  // Isolate the `export const commands: Command[] = [ ... ]` array body.
  const startMarker = "export const commands: Command[] = [";
  const startIdx = source.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error("Could not locate `export const commands: Command[] = [` in commands.ts");
  }
  const bodyStart = startIdx + startMarker.length;
  // Walk forward until we hit the matching closing `]` at depth 0.
  let depth = 1;
  let i = bodyStart;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = source.slice(bodyStart, i);
  // Strip line comments before extracting identifiers so commented-out
  // references are not counted as registered.
  const stripped = body.replace(/\/\/[^\n]*/g, "");
  const names = new Set<string>();
  const re = /\b(\w+Command)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    names.add(m[1]);
  }
  return names;
}

describe("terminal command registration", () => {
  const source = loadSource();
  const declared = collectDeclaredCommands(source);
  const registered = collectRegisteredCommands(source);

  it("finds at least some declared commands (sanity check)", () => {
    expect(declared.size).toBeGreaterThan(20);
    expect(registered.size).toBeGreaterThan(20);
  });

  it("every declared command is registered in the commands[] array", () => {
    const missing = [...declared].filter((name) => !registered.has(name)).sort();
    expect(missing, `Declared but not registered: ${missing.join(", ")}`).toEqual([]);
  });

  it("every registered command is a real declaration", () => {
    const orphans = [...registered].filter((name) => !declared.has(name)).sort();
    expect(orphans, `Registered but not declared: ${orphans.join(", ")}`).toEqual([]);
  });
});
