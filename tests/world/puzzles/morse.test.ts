import { describe, expect, it } from "vitest";
import {
  answerMatches,
  classifyPress,
  decodeCode,
  decodeGroups,
  DEFAULT_GROUPS,
  DEFAULT_WHISPER,
  MORSE,
  morseSolution,
  morseTimeline,
  parseSignal,
  splitGroups,
  timelineDuration,
} from "@/components/world/puzzles/engine/morse";

describe("morse", () => {
  it("the EP6 whisper decodes to LOVW", () => {
    const symbols = parseSignal(DEFAULT_WHISPER);
    expect(symbols).toHaveLength(14);
    const codes = splitGroups(symbols, DEFAULT_GROUPS);
    expect(codes).toEqual([".-..", "---", "...-", ".--"]);
    expect(decodeGroups(codes ?? [])).toBe("LOVW");
    expect(morseSolution(DEFAULT_WHISPER, DEFAULT_GROUPS).answer).toBe("LOVW");
  });

  it("parses alternative dash glyphs and ignores separators", () => {
    expect(parseSignal(".- / –· −").join("")).toBe(".--.-");
  });

  it("rejects groups that do not fit", () => {
    const s = parseSignal("...");
    expect(splitGroups(s, [1, 1])).toBeNull();
    expect(splitGroups(s, [0, 3])).toBeNull();
    expect(splitGroups(s, [])).toBeNull();
    expect(splitGroups(s, [1.5, 1.5])).toBeNull();
    expect(morseSolution("...", [2]).answer).toBe("LOVW");
  });

  it("uses an explicit answer only if it has the right length", () => {
    expect(morseSolution("... ---", [3, 3], "so").answer).toBe("SO");
    expect(morseSolution("... ---", [3, 3], "sos").answer).toBe("SO");
  });

  it("table roundtrips", () => {
    for (const [letter, code] of Object.entries(MORSE)) expect(decodeCode(code)).toBe(letter);
    expect(decodeCode("......")).toBeNull();
    expect(decodeGroups(["......", "."])).toBe("?E");
  });

  it("timeline follows standard timing", () => {
    const ev = morseTimeline([".-", "."], 100);
    expect(ev.map((e) => [e.on, e.ms])).toEqual([
      [true, 100],
      [false, 100],
      [true, 300],
      [false, 300],
      [true, 100],
    ]);
    expect(ev.filter((e) => e.on).map((e) => e.symbol)).toEqual([0, 1, 2]);
    expect(timelineDuration(ev)).toBe(900);
  });

  it("classifies presses and compares answers", () => {
    expect(classifyPress(120)).toBe(".");
    expect(classifyPress(400)).toBe("-");
    expect(answerMatches(" lovw ", "LOVW")).toBe(true);
    expect(answerMatches("LOVE", "LOVW")).toBe(false);
  });
});
