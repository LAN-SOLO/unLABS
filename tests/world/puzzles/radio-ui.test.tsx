import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RadioPuzzle } from "@/components/world/puzzles/RadioPuzzle";
import { phaseDelta, radioStart } from "@/components/world/puzzles/engine/radio";

const PARAMS = { seed: 7, freq: 94.7, phase: 135, line: "Test." };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const freqKnob = () => screen.getByRole("slider", { name: "Frequency" });
const phaseKnob = () => screen.getByRole("slider", { name: "Phase" });

describe("RadioPuzzle UI", () => {
  it("arrow keys / WASD tune; a focused knob owns its arrows", () => {
    const start = radioStart(7, 94.7, 135);
    render(<RadioPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(freqKnob()).toHaveAttribute("aria-valuetext", `${(start.freq + 0.1).toFixed(1)} MHz`);
    fireEvent.keyDown(window, { key: "w" });
    expect(phaseKnob()).toHaveAttribute("aria-valuetext", `${(start.phase + 5) % 360}°`);
    // Up on the focused phase knob turns the phase, not the frequency.
    fireEvent.keyDown(phaseKnob(), { key: "ArrowUp" });
    expect(phaseKnob()).toHaveAttribute("aria-valuetext", `${(start.phase + 10) % 360}°`);
    expect(freqKnob()).toHaveAttribute("aria-valuetext", `${(start.freq + 0.1).toFixed(1)} MHz`);
  });

  it("locking on noise buzzes; reset restores the start", () => {
    const start = radioStart(7, 94.7, 135);
    const sound = vi.fn();
    render(<RadioPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    fireEvent.keyDown(window, { key: "D", shiftKey: true });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(freqKnob()).toHaveAttribute("aria-valuetext", `${start.freq.toFixed(1)} MHz`);
  });

  it("tuning to the target by keyboard locks and solves", () => {
    const start = radioStart(7, 94.7, 135);
    const onSolve = vi.fn();
    render(<RadioPuzzle params={PARAMS} onSolve={onSolve} solved={false} sound={vi.fn()} />);
    const fSteps = Math.round((94.7 - start.freq) * 10);
    for (let i = 0; i < Math.abs(fSteps); i++)
      fireEvent.keyDown(window, { key: fSteps > 0 ? "ArrowRight" : "ArrowLeft" });
    const pSteps = Math.round(phaseDelta(start.phase, 135) / 5);
    for (let i = 0; i < Math.abs(pSteps); i++)
      fireEvent.keyDown(window, { key: pSteps > 0 ? "ArrowUp" : "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onSolve).toHaveBeenCalledTimes(1);
  });
});
