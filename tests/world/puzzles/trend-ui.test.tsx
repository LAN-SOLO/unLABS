import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrendPuzzle } from "@/components/world/puzzles/TrendPuzzle";
import { trendRound } from "@/components/world/puzzles/engine/trend";

beforeEach(() => {
  // Drive the rAF loops from the fake clock.
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const params = { seed: 512, streak: 5, window: 3, noise: 0.3 };
const key = (k: string) => fireEvent.keyDown(window, { key: k });
const toPrompt = () =>
  act(() => {
    vi.advanceTimersByTime(6500);
  });

describe("TrendPuzzle UI", () => {
  it("the right arrow key predicts; a correct call beeps", () => {
    const sound = vi.fn();
    render(<TrendPuzzle params={params} onSolve={vi.fn()} solved={false} sound={sound} />);
    toPrompt();
    expect(screen.getAllByText(/PREDICTION/).length).toBeGreaterThan(0);
    const a = trendRound(512, 0, 0.3).answer;
    key(a === "cw" ? "ArrowUp" : "ArrowDown");
    expect(sound).toHaveBeenLastCalledWith("keypad_beep");
    expect(screen.getByText(/✓ Correct/)).toBeInTheDocument();
  });

  it("a wrong call buzzes; reset starts a fresh series", () => {
    const sound = vi.fn();
    render(<TrendPuzzle params={params} onSolve={vi.fn()} solved={false} sound={sound} />);
    toPrompt();
    const a = trendRound(512, 0, 0.3).answer;
    key(a === "cw" ? "x" : "c");
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    fireEvent.click(screen.getByRole("button", { name: /New streak/ }));
    expect(sound).toHaveBeenLastCalledWith("ui_click");
    expect(screen.getByText("Round 2")).toBeInTheDocument();
  });
});
