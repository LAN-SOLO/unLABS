import { describe, it, expect } from "vitest";
import { parseAnsi, stripAnsi, hasAnsi } from "@/lib/terminal/ansi";

describe("parseAnsi", () => {
  it("returns a single plain span for text without escapes", () => {
    expect(parseAnsi("hello world")).toEqual([{ text: "hello world" }]);
  });

  it("parses a colored segment with reset", () => {
    expect(parseAnsi("ok \x1b[32mgreen\x1b[0m done")).toEqual([
      { text: "ok " },
      { text: "green", fg: "green" },
      { text: " done" },
    ]);
  });

  it("parses bold and italic", () => {
    expect(parseAnsi("\x1b[1mbold\x1b[0m and \x1b[3mitalic\x1b[0m")).toEqual([
      { text: "bold", bold: true },
      { text: " and " },
      { text: "italic", italic: true },
    ]);
  });

  it("supports bright foregrounds (90-97)", () => {
    expect(parseAnsi("\x1b[90mdim\x1b[0m")).toEqual([{ text: "dim", fg: "gray" }]);
  });

  it("combines color and bold until reset", () => {
    expect(parseAnsi("\x1b[1m\x1b[31mALERT\x1b[0mok")).toEqual([
      { text: "ALERT", fg: "red", bold: true },
      { text: "ok" },
    ]);
  });

  it("treats an empty SGR (\\x1b[m) as reset", () => {
    expect(parseAnsi("\x1b[33ma\x1b[mb")).toEqual([{ text: "a", fg: "yellow" }, { text: "b" }]);
  });

  it("ignores unknown codes without dropping text", () => {
    expect(parseAnsi("\x1b[45mtext\x1b[0m")).toEqual([{ text: "text" }]);
  });

  it("handles color changes without an intermediate reset", () => {
    expect(parseAnsi("\x1b[31mr\x1b[36mc\x1b[0m")).toEqual([
      { text: "r", fg: "red" },
      { text: "c", fg: "cyan" },
    ]);
  });
});

describe("stripAnsi / hasAnsi", () => {
  it("strips all SGR sequences", () => {
    expect(stripAnsi("\x1b[1m\x1b[32mhi\x1b[0m there")).toBe("hi there");
  });

  it("detects presence of escapes", () => {
    expect(hasAnsi("\x1b[32mhi\x1b[0m")).toBe(true);
    expect(hasAnsi("plain")).toBe(false);
  });
});
