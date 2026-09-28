import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LayersPuzzle } from "@/components/world/puzzles/LayersPuzzle";
import { MATERIALS, generateLayers } from "@/components/world/puzzles/engine/layers";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PARAMS = { seed: 5, slots: 5 };
const puzzle = generateLayers(5, 5);

function slot(i: number): HTMLElement {
  return screen.getByRole("listitem", { name: new RegExp(`^Layer ${i + 1}:`) });
}

describe("LayersPuzzle UI", () => {
  it("number key picks a material, Enter places it at the cursor, W/S move", () => {
    const sound = vi.fn();
    render(<LayersPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(slot(0)).toHaveAttribute("aria-label", `Layer 1: ${MATERIALS[0].label}`);
    fireEvent.keyDown(window, { key: "s" });
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.keyDown(window, { key: " " });
    expect(slot(1)).toHaveAttribute("aria-label", `Layer 2: ${MATERIALS[1].label}`);
    expect(sound).toHaveBeenLastCalledWith("ui_click");
  });

  it("testing an open housing buzzes; reset empties it", () => {
    const sound = vi.fn();
    render(<LayersPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    fireEvent.keyDown(window, { key: "3" });
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "t" });
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(slot(0)).toHaveAttribute("aria-label", "Layer 1: empty");
  });

  it("the generated solution solves silently by keyboard", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<LayersPuzzle params={PARAMS} onSolve={onSolve} solved={false} sound={sound} />);
    puzzle.solutions[0].forEach((m, i) => {
      if (i > 0) fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: String(m + 1) });
      fireEvent.keyDown(window, { key: "Enter" });
    });
    sound.mockClear();
    fireEvent.keyDown(window, { key: "T" });
    expect(onSolve).toHaveBeenCalledTimes(1);
    expect(sound).not.toHaveBeenCalled();
  });
});
