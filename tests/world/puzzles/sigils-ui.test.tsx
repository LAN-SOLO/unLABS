import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SigilsPuzzle } from "@/components/world/puzzles/SigilsPuzzle";
import { generateLights, lightsToggle } from "@/components/world/puzzles/logic";

afterEach(cleanup);

const cell = (r: number, c: number) =>
  screen.getByRole("button", { name: new RegExp(`^Sigil ${r + 1}/${c + 1}:`) });

describe("sigils generator", () => {
  it("is deterministic per seed, never starts cleared, and its presses solve it", () => {
    for (const seed of [1, 2003, 2136, 99]) {
      const a = generateLights(5, seed, 8);
      expect(generateLights(5, seed, 8)).toEqual(a);
      expect(a.start.some(Boolean)).toBe(true);
      let b = a.start;
      for (const p of a.presses) b = lightsToggle(b, 5, p);
      expect(b.every((v) => !v)).toBe(true);
    }
  });
});

describe("sigils ui", () => {
  it("replaying the solution via the keyboard solves", () => {
    const params = { size: 5, seed: 2136 };
    const g = generateLights(5, 2136, 8);
    const onSolve = vi.fn();
    render(<SigilsPuzzle params={params} onSolve={onSolve} solved={false} />);
    cell(0, 0).focus();
    for (const p of g.presses) {
      const r = Math.floor(p / 5);
      const c = p % 5;
      // Walk home, then to the target with arrows.
      for (let i = 0; i < 5; i++) fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
      for (let i = 0; i < 5; i++) fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
      for (let i = 0; i < r; i++) fireEvent.keyDown(document.activeElement!, { key: "s" });
      for (let i = 0; i < c; i++) fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
      expect(document.activeElement).toBe(cell(r, c));
      fireEvent.click(document.activeElement!);
    }
    expect(onSolve).toHaveBeenCalledTimes(1);
  });

  it("reset restores the start board", () => {
    const g = generateLights(5, 7, 8);
    render(<SigilsPuzzle params={{ size: 5, seed: 7 }} onSolve={vi.fn()} solved={false} />);
    const label = () => cell(2, 2).getAttribute("aria-label");
    const before = label();
    fireEvent.click(cell(2, 2));
    expect(label()).not.toBe(before);
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(label()).toBe(before);
    expect(before).toContain(g.start[12] ? "active" : "neutral");
  });
});
