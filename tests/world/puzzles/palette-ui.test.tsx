import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PalettePuzzle } from "@/components/world/puzzles/PalettePuzzle";
import { generatePalette } from "@/components/world/puzzles/engine/palette";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PARAMS = { seed: 2400, channels: 4 };
const puzzle = generatePalette(2400, 4);
const KEYS = ["a", "b", "c", "d"];

function inputLabel(i: number): string {
  return screen
    .getByRole("button", { name: new RegExp(`^Input ${i + 1}:`) })
    .getAttribute("aria-label") as string;
}

describe("PalettePuzzle UI", () => {
  it("number + letter keys patch a cable", () => {
    const sound = vi.fn();
    render(<PalettePuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.keyDown(window, { key: "c" });
    expect(inputLabel(1)).toContain("channel 3");
    expect(sound).toHaveBeenLastCalledWith("ui_click");
  });

  it("arrow keys select and plug into the next free channel", () => {
    render(<PalettePuzzle params={PARAMS} onSolve={vi.fn()} solved={false} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(inputLabel(0)).toContain("channel 1");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(inputLabel(0)).toContain("channel 2");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(inputLabel(0)).not.toContain("channel");
  });

  it("a wrong full wiring buzzes; reset unplugs everything", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<PalettePuzzle params={PARAMS} onSolve={onSolve} solved={false} sound={sound} />);
    // The identity wiring is never the solution.
    for (let i = 0; i < 4; i++) {
      fireEvent.keyDown(window, { key: String(i + 1) });
      fireEvent.keyDown(window, { key: KEYS[i] });
    }
    fireEvent.keyDown(window, { key: "Enter" });
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(onSolve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    for (let i = 0; i < 4; i++) expect(inputLabel(i)).not.toContain("channel");
  });

  it("a channel key without a selected input buzzes", () => {
    const sound = vi.fn();
    render(<PalettePuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    fireEvent.keyDown(window, { key: "a" });
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
  });

  it("the correct wiring solves silently", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<PalettePuzzle params={PARAMS} onSolve={onSolve} solved={false} sound={sound} />);
    puzzle.solution.forEach((o, i) => {
      fireEvent.keyDown(window, { key: String(i + 1) });
      fireEvent.keyDown(window, { key: KEYS[o] });
    });
    sound.mockClear();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onSolve).toHaveBeenCalledTimes(1);
    expect(sound).not.toHaveBeenCalled();
  });
});
