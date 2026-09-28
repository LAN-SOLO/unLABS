import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HuePuzzle } from "@/components/world/puzzles/HuePuzzle";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// The needle starts at 0° (top). Infrarot's band centre is 20°, so a ±25°
// window makes the very first stop a hit; the default window makes it a miss.
const HIT = { target: "infrarot", rounds: 3, tolerances: [25], speeds: [110] };
const MISS = { target: "gelb", rounds: 3, tolerances: [18], speeds: [110] };

describe("HuePuzzle UI", () => {
  it("Space stops the needle; a miss buzzes and shows red feedback", () => {
    const sound = vi.fn();
    render(<HuePuzzle params={MISS} onSolve={vi.fn()} solved={false} sound={sound} />);
    fireEvent.keyDown(window, { key: " " });
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(screen.getByText(/Missed/)).toBeInTheDocument();
    // Paused: a second press does nothing.
    sound.mockClear();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(sound).not.toHaveBeenCalled();
  });

  it("a hit beeps and advances the round; reset starts over", () => {
    const sound = vi.fn();
    render(<HuePuzzle params={HIT} onSolve={vi.fn()} solved={false} sound={sound} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(sound).toHaveBeenLastCalledWith("keypad_beep");
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/^Hits 1 \/ 3/),
    );
    fireEvent.click(screen.getByRole("button", { name: /Start over/ }));
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/^Hits 0 \/ 3/),
    );
    expect(sound).toHaveBeenLastCalledWith("ui_click");
  });

  it("key repeat does not fire extra stops", () => {
    const sound = vi.fn();
    render(<HuePuzzle params={MISS} onSolve={vi.fn()} solved={false} sound={sound} />);
    fireEvent.keyDown(window, { key: " ", repeat: true });
    expect(sound).not.toHaveBeenCalled();
  });

  it("unlocks the MCP hint (with hint_pop) after three misses", () => {
    const sound = vi.fn();
    render(<HuePuzzle params={MISS} onSolve={vi.fn()} solved={false} sound={sound} />);
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(window, { key: " " });
      act(() => {
        vi.advanceTimersByTime(800);
      });
    }
    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(sound).toHaveBeenCalledWith("hint_pop");
  });
});
