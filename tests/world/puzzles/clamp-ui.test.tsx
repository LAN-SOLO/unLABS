import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClampPuzzle } from "@/components/world/puzzles/ClampPuzzle";
import { CLAMPS, makeWave } from "@/components/world/puzzles/engine/clamp";

const PARAMS = { seed: 2008, rounds: 1, noise: 0.2 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const truth = makeWave(PARAMS.seed, 0, 0, PARAMS.noise).kind;
const rightIdx = CLAMPS.findIndex((c) => c.kind === truth);
const wrongIdx = (rightIdx + 1) % CLAMPS.length;

function checked(): string[] {
  return screen
    .getAllByRole("radio")
    .filter((r) => r.getAttribute("aria-checked") === "true")
    .map((r) => r.getAttribute("aria-label") ?? "");
}

describe("ClampPuzzle UI", () => {
  it("number keys and arrows select a pattern", () => {
    const sound = vi.fn();
    render(<ClampPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    fireEvent.keyDown(window, { key: "2" });
    expect(checked()[0]).toMatch(/^Parkes/);
    expect(sound).toHaveBeenLastCalledWith("ui_click");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(checked()[0]).toMatch(/^Jodrell/);
    fireEvent.keyDown(window, { key: "a" });
    expect(checked()[0]).toMatch(/^Parkes/);
  });

  it("a wrong clamp buzzes and shakes; the right one solves silently", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    const { container } = render(
      <ClampPuzzle params={PARAMS} onSolve={onSolve} solved={false} sound={sound} />,
    );
    fireEvent.keyDown(window, { key: String(wrongIdx + 1) });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(container.querySelector(".pz-fail-a, .pz-fail-b")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(900);
    });
    // New attempt → new wave, but the kind must be re-derived for attempt 1.
    const kind1 = makeWave(PARAMS.seed, 0, 1, PARAMS.noise).kind;
    fireEvent.keyDown(window, { key: String(CLAMPS.findIndex((c) => c.kind === kind1) + 1) });
    sound.mockClear();
    fireEvent.keyDown(window, { key: " " });
    expect(sound).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onSolve).toHaveBeenCalledTimes(1);
  });

  it("reset clears the selection", () => {
    render(<ClampPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} />);
    fireEvent.keyDown(window, { key: "3" });
    expect(checked()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(checked()).toHaveLength(0);
  });

  it("does not react to Escape", () => {
    const sound = vi.fn();
    render(<ClampPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    const ev = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(sound).not.toHaveBeenCalled();
  });
});
