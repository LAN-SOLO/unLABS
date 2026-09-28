import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrcPuzzle } from "@/components/world/puzzles/CrcPuzzle";
import { bitsEqual, colParities, generateCrc, rowParities } from "@/components/world/puzzles/logic";

afterEach(cleanup);

const bit = (r: number, c: number) =>
  screen.getByRole("button", { name: new RegExp(`^Bit row ${r + 1}, column ${c + 1}:`) });

describe("crc generator", () => {
  it("is deterministic per seed and fixable by exactly one flip", () => {
    for (const seed of [1, 7, 89, 2024]) {
      const a = generateCrc(6, 8, seed);
      expect(generateCrc(6, 8, seed)).toEqual(a);
      const fixed = a.corrupted.slice();
      fixed[a.flipped] ^= 1;
      expect(bitsEqual(fixed, a.original)).toBe(true);
      // The flipped bit is the unique cell whose row and column both fail parity.
      const rp = rowParities(a.corrupted, 6, 8).map((p, i) => p !== a.rowParity[i]);
      const cp = colParities(a.corrupted, 6, 8).map((p, i) => p !== a.colParity[i]);
      expect(rp.filter(Boolean)).toHaveLength(1);
      expect(cp.filter(Boolean)).toHaveLength(1);
      expect(rp.indexOf(true) * 8 + cp.indexOf(true)).toBe(a.flipped);
    }
  });
});

describe("crc ui", () => {
  it("arrow keys move the focus; Enter on the bad bit solves", () => {
    const g = generateCrc(4, 4, 5);
    const onSolve = vi.fn();
    render(<CrcPuzzle params={{ rows: 4, cols: 4, seed: 5 }} onSolve={onSolve} solved={false} />);
    bit(0, 0).focus();
    const r = Math.floor(g.flipped / 4);
    const c = g.flipped % 4;
    for (let i = 0; i < r; i++) fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    for (let i = 0; i < c; i++) fireEvent.keyDown(document.activeElement!, { key: "d" });
    expect(document.activeElement).toBe(bit(r, c));
    fireEvent.click(document.activeElement!);
    expect(onSolve).toHaveBeenCalledTimes(1);
  });

  it("reset restores the corrupted matrix", () => {
    const g = generateCrc(4, 4, 5);
    render(<CrcPuzzle params={{ rows: 4, cols: 4, seed: 5 }} onSolve={vi.fn()} solved={false} />);
    const other = (g.flipped + 1) % 16;
    const r = Math.floor(other / 4);
    const c = other % 4;
    fireEvent.click(bit(r, c));
    expect(bit(r, c).getAttribute("aria-label")).toMatch(`: ${g.corrupted[other] ^ 1}`);
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(bit(r, c).getAttribute("aria-label")).toMatch(`: ${g.corrupted[other]}`);
  });
});
