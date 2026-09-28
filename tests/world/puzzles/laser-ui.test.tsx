import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LaserPuzzle } from "@/components/world/puzzles/LaserPuzzle";
import {
  generateLaser,
  isRotatable,
  receiverLit,
  traceBeams,
} from "@/components/world/puzzles/engine/laser";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PARAMS = { seed: 2019, size: 6, colors: 2, receivers: 3 };
const puzzle = generateLaser(2019, 6, 2, 3);
const n = puzzle.size;

function litCount(orient: readonly number[]): number {
  const tr = traceBeams(n, puzzle.cells, orient, puzzle.emitterRow);
  return puzzle.receivers.filter((r) => receiverLit(r, tr.exits)).length;
}

function grid(): HTMLElement {
  return screen.getByRole("grid");
}

describe("LaserPuzzle UI", () => {
  it("arrows/WASD move the cursor, Enter rotates the piece under it", () => {
    const sound = vi.fn();
    render(<LaserPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    expect(grid()).toHaveAttribute("aria-label", expect.stringContaining("row"));
    const target = puzzle.cells.findIndex((c) => isRotatable(c));
    const tr = Math.floor(target / n);
    const tc = target % n;
    // Park the cursor in the top-left corner, then walk to the target.
    for (let i = 0; i < n; i++) {
      fireEvent.keyDown(window, { key: "w" });
      fireEvent.keyDown(window, { key: "ArrowLeft" });
    }
    for (let i = 0; i < tr; i++) fireEvent.keyDown(window, { key: "s" });
    for (let i = 0; i < tc; i++) fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(grid().getAttribute("aria-label")).toContain(`row ${tr + 1}, column ${tc + 1}`);
    const before = grid().getAttribute("aria-label");
    fireEvent.keyDown(window, { key: "Enter" });
    expect(grid().getAttribute("aria-label")).not.toBe(before);
    expect(sound).toHaveBeenCalled();
  });

  it("turning a working mirror back out of the beam buzzes", () => {
    // Find a piece whose flip lights more receivers from the start state.
    const idx = puzzle.cells.findIndex((c, i) => {
      if (!isRotatable(c)) return false;
      const o = puzzle.start.slice();
      o[i] ^= 1;
      return litCount(o) > litCount(puzzle.start) && litCount(o) < puzzle.receivers.length;
    });
    expect(idx).toBeGreaterThanOrEqual(0);
    const sound = vi.fn();
    render(<LaserPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    const cells = screen.getAllByRole("gridcell");
    fireEvent.click(cells[idx]);
    expect(sound).toHaveBeenLastCalledWith("keypad_beep");
    fireEvent.click(cells[idx]);
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
  });

  it("reset restores the scrambled start", () => {
    const sound = vi.fn();
    render(<LaserPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    const start = screen.getByText(/Moves: 0/).textContent;
    const idx = puzzle.cells.findIndex((c) => isRotatable(c));
    fireEvent.click(screen.getAllByRole("gridcell")[idx]);
    expect(screen.getByText(/Moves: 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(screen.getByText(/Moves: 0/).textContent).toBe(start);
    expect(sound).toHaveBeenLastCalledWith("ui_click");
  });

  it("solving by keyboard reaches onSolve without a sound of its own", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<LaserPuzzle params={PARAMS} onSolve={onSolve} solved={false} sound={sound} />);
    const cells = screen.getAllByRole("gridcell");
    const wrong = puzzle.cells
      .map((_, i) => i)
      .filter((i) => isRotatable(puzzle.cells[i]) && puzzle.start[i] !== puzzle.solution[i]);
    wrong.forEach((i, k) => {
      if (k === wrong.length - 1) sound.mockClear();
      fireEvent.click(cells[i]);
    });
    expect(onSolve).toHaveBeenCalledTimes(1);
    expect(sound).not.toHaveBeenCalled();
  });
});
