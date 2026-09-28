import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemeticPuzzle } from "@/components/world/puzzles/MemeticPuzzle";

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
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const params = { seed: 1016, radius: 0.08, hold: 2, drift: 0 };
const fitness = () => {
  const name = screen.getByRole("application").getAttribute("aria-label") ?? "";
  return Number(/fitness (\d+)/i.exec(name)?.[1]);
};

describe("MemeticPuzzle UI", () => {
  it("holding WASD moves the marker; releasing stops it", () => {
    render(<MemeticPuzzle params={params} onSolve={vi.fn()} solved={false} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const before = screen.getByText("MEMETIC FITNESS").nextSibling?.textContent;
    fireEvent.keyDown(window, { key: "w" });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.keyUp(window, { key: "w" });
    const after = screen.getByText("MEMETIC FITNESS").nextSibling?.textContent;
    expect(after).not.toBe(before);
    const f = fitness();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(fitness()).toBe(f);
  });

  it("reset clicks and returns the marker to the centre", () => {
    const sound = vi.fn();
    render(<MemeticPuzzle params={params} onSolve={vi.fn()} solved={false} sound={sound} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const start = fitness();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    act(() => {
      vi.advanceTimersByTime(700);
    });
    fireEvent.keyUp(window, { key: "ArrowLeft" });
    expect(fitness()).not.toBe(start);
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(sound).toHaveBeenLastCalledWith("ui_click");
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(fitness()).toBe(start);
  });
});
