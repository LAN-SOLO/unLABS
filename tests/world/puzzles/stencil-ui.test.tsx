import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StencilPuzzle } from "@/components/world/puzzles/StencilPuzzle";
import {
  generateStencil,
  stencilStart,
  stencilStep,
} from "@/components/world/puzzles/engine/stencil";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const PARAMS = { seed: 3, shape: "hex", maxStress: 15 };
const { path } = generateStencil(3, "hex");
/** Numpad digit for a direction (dx, dy). */
const NUMPAD: Record<string, string> = {
  "-1,-1": "7",
  "0,-1": "8",
  "1,-1": "9",
  "-1,0": "4",
  "1,0": "6",
  "-1,1": "1",
  "0,1": "2",
  "1,1": "3",
};

function progress(): string {
  return screen.getByRole("progressbar").getAttribute("aria-label") ?? "";
}

/** A direction that, repeated from the start, cracks the blank. */
function crackingDir(max: number): readonly [number, number] {
  for (const d of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    let s = stencilStart(path);
    for (let i = 0; i < 60 && !s.cracked; i++) s = stencilStep(s, d[0], d[1], path, max);
    if (s.cracked) return d;
  }
  throw new Error("no cracking direction");
}

describe("StencilPuzzle UI", () => {
  it("numpad digits trace the stencil step by step", () => {
    const sound = vi.fn();
    render(<StencilPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    for (let i = 1; i <= 5; i++) {
      const key = NUMPAD[`${path[i][0] - path[i - 1][0]},${path[i][1] - path[i - 1][1]}`];
      fireEvent.keyDown(window, { key });
    }
    expect(progress()).toMatch(/^Progress: 5 \//);
  });

  it("tracing the whole path by keyboard solves without a solve sound", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<StencilPuzzle params={PARAMS} onSolve={onSolve} solved={false} sound={sound} />);
    for (let i = 1; i < path.length; i++) {
      if (i === path.length - 1) sound.mockClear();
      fireEvent.keyDown(window, {
        key: NUMPAD[`${path[i][0] - path[i - 1][0]},${path[i][1] - path[i - 1][1]}`],
      });
    }
    expect(onSolve).toHaveBeenCalledTimes(1);
    expect(sound).not.toHaveBeenCalled();
  });

  it("wandering off cracks the blank (fail_buzz) and a new blank is laid in", () => {
    const sound = vi.fn();
    render(<StencilPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    const [dx, dy] = crackingDir(15);
    for (let i = 0; i < 60; i++) fireEvent.keyDown(window, { key: NUMPAD[`${dx},${dy}`] });
    expect(sound).toHaveBeenCalledWith("fail_buzz");
    expect(progress()).toContain("Cracks: 1");
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getByText(/New blank/)).toBeInTheDocument();
  });

  it("reset returns the cursor to the start", () => {
    render(<StencilPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={vi.fn()} />);
    for (let i = 1; i <= 3; i++) {
      fireEvent.keyDown(window, {
        key: NUMPAD[`${path[i][0] - path[i - 1][0]},${path[i][1] - path[i - 1][1]}`],
      });
    }
    expect(progress()).toMatch(/^Progress: 3 \//);
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(progress()).toMatch(/^Progress: 0 \//);
  });
});
