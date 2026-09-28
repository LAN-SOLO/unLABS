import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WiringPuzzle } from "@/components/world/puzzles/WiringPuzzle";
import { adjacent, endpointColor, generateWiring } from "@/components/world/puzzles/engine/wiring";

const PARAMS = { seed: 9, size: 6, pairs: 5 };
const puzzle = generateWiring(9, 6, 5);
const n = puzzle.size;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Arrow presses that walk the cursor from `from` to `to`. */
function walk(from: number, to: number) {
  const dr = Math.floor(to / n) - Math.floor(from / n);
  const dc = (to % n) - (from % n);
  for (let i = 0; i < Math.abs(dr); i++)
    fireEvent.keyDown(window, { key: dr > 0 ? "ArrowDown" : "ArrowUp" });
  for (let i = 0; i < Math.abs(dc); i++) fireEvent.keyDown(window, { key: dc > 0 ? "d" : "a" });
}

function stepKey(from: number, to: number): string {
  if (to === from + 1) return "ArrowRight";
  if (to === from - 1) return "ArrowLeft";
  return to > from ? "ArrowDown" : "ArrowUp";
}

/** A solution cell (of some colour) adjacent to another colour's wire end. */
function findBlock(): { color: number; upto: number; target: number } | null {
  for (const e of puzzle.endpoints) {
    const path = puzzle.solution[e.color];
    for (let i = 0; i < path.length - 1; i++) {
      for (const o of puzzle.endpoints) {
        if (o.color === e.color) continue;
        for (const t of [o.a, o.b])
          if (adjacent(n, path[i], t)) return { color: e.color, upto: i, target: t };
      }
    }
  }
  return null;
}

describe("WiringPuzzle UI", () => {
  it("generator differs between seeds and stays deterministic", () => {
    expect(generateWiring(9, 6, 5)).toEqual(puzzle);
    expect(generateWiring(10, 6, 5).endpoints).not.toEqual(puzzle.endpoints);
  });

  it("keyboard: pick up an end, lay the wire, connection beeps", () => {
    const sound = vi.fn();
    render(<WiringPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    const path = puzzle.solution[0];
    walk(0, path[0]);
    fireEvent.keyDown(window, { key: " " });
    for (let i = 1; i < path.length; i++)
      fireEvent.keyDown(window, { key: stepKey(path[i - 1], path[i]) });
    expect(sound).toHaveBeenLastCalledWith("keypad_beep");
    expect(screen.getByText(/Connected: 1/)).toBeInTheDocument();
  });

  it("running into a foreign wire end buzzes; reset clears all wires", () => {
    const found = findBlock();
    if (!found) throw new Error("no blocking configuration in this seed");
    const sound = vi.fn();
    render(<WiringPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    const path = puzzle.solution[found.color];
    walk(0, path[0]);
    fireEvent.keyDown(window, { key: "Enter" });
    for (let i = 1; i <= found.upto; i++)
      fireEvent.keyDown(window, { key: stepKey(path[i - 1], path[i]) });
    expect(endpointColor(puzzle, found.target)).not.toBe(found.color);
    fireEvent.keyDown(window, { key: stepKey(path[found.upto], found.target) });
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(screen.getByRole("application").getAttribute("class")).toMatch(/pz-fail-/);

    // Finish the wire, then reset.
    for (let i = found.upto + 1; i < path.length; i++)
      fireEvent.keyDown(window, { key: stepKey(path[i - 1], path[i]) });
    expect(screen.getByText(/Connected: 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(screen.getByText(/Connected: 0/)).toBeInTheDocument();
  });

  it("solving the whole harness calls onSolve once", () => {
    const onSolve = vi.fn();
    render(<WiringPuzzle params={PARAMS} onSolve={onSolve} solved={false} sound={vi.fn()} />);
    let cursor = 0;
    for (const path of puzzle.solution) {
      walk(cursor, path[0]);
      fireEvent.keyDown(window, { key: " " });
      for (let i = 1; i < path.length; i++)
        fireEvent.keyDown(window, { key: stepKey(path[i - 1], path[i]) });
      cursor = path[path.length - 1];
    }
    expect(onSolve).toHaveBeenCalledTimes(1);
  });
});
