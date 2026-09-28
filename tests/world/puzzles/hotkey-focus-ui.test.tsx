import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClampPuzzle } from "@/components/world/puzzles/ClampPuzzle";
import { EraPuzzle } from "@/components/world/puzzles/EraPuzzle";
import { KeypadPuzzle } from "@/components/world/puzzles/KeypadPuzzle";
import { RadioPuzzle } from "@/components/world/puzzles/RadioPuzzle";
import { CLAMPS, makeWave } from "@/components/world/puzzles/engine/clamp";
import { ERA_BITS } from "@/components/world/puzzles/engine/era";
import { radioStart } from "@/components/world/puzzles/engine/radio";

/**
 * Documented Enter/Space hotkeys must work while a puzzle control has focus
 * (autofocus on open, or a button the mouse just clicked). A real keydown
 * targets the focused element, so the events are fired there.
 */
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const press = (k: string, init: Record<string, unknown> = {}) =>
  fireEvent.keyDown(document.activeElement ?? window, { key: k, ...init });

describe("clamp: Enter commits the selection, not the focused card", () => {
  const PARAMS = { seed: 2008, rounds: 1, noise: 0.2 };
  const truth = makeWave(PARAMS.seed, 0, 0, PARAMS.noise).kind;
  const rightIdx = CLAMPS.findIndex((c) => c.kind === truth);
  const otherIdx = (rightIdx + 1) % CLAMPS.length;

  it("number key + Enter with another card focused clamps the chosen one", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<ClampPuzzle params={PARAMS} onSolve={onSolve} solved={false} sound={sound} />);
    const cards = screen.getAllByRole("radio");
    cards[otherIdx]!.focus(); // e.g. the autofocused first card
    press(String(rightIdx + 1));
    expect(document.activeElement).toBe(cards[rightIdx]); // focus follows
    press("Enter");
    expect(sound).not.toHaveBeenCalledWith("fail_buzz");
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onSolve).toHaveBeenCalledTimes(1);
  });

  it("Space on a focused card clamps the selection too", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<ClampPuzzle params={PARAMS} onSolve={onSolve} solved={false} sound={sound} />);
    screen.getAllByRole("radio")[otherIdx]!.focus();
    press(String(rightIdx + 1));
    press(" ");
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(sound).not.toHaveBeenCalledWith("fail_buzz");
    expect(onSolve).toHaveBeenCalledTimes(1);
  });
});

describe("era: Enter/Space work while an era button has focus", () => {
  const params = { seed: 16, target: 16, dither: 1 };

  it("2, D, Enter on the autofocused 8-bit button locks in", () => {
    const onSolve = vi.fn();
    render(<EraPuzzle params={params} onSolve={onSolve} solved={false} sound={vi.fn()} />);
    screen.getByRole("button", { name: /Era 8 bit/ }).focus();
    press(String(ERA_BITS.indexOf(16) + 1));
    press("d");
    press("Enter");
    expect(onSolve).toHaveBeenCalledTimes(1);
  });

  it("Space toggles dither while an era button has focus", () => {
    render(<EraPuzzle params={params} onSolve={vi.fn()} solved={false} sound={vi.fn()} />);
    screen.getByRole("button", { name: /Era 8 bit/ }).focus();
    press(" ");
    expect(screen.getByRole("button", { name: /Dither: on/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("action buttons keep native Enter/Space (not intercepted)", () => {
    const onSolve = vi.fn();
    const sound = vi.fn();
    render(<EraPuzzle params={params} onSolve={onSolve} solved={false} sound={sound} />);
    screen.getByRole("button", { name: /Dither: off/ }).focus();
    press("Enter"); // native click on the dither button, not a lock-in
    screen.getByRole("button", { name: /Lock in/ }).focus();
    press(" "); // native click on lock-in, not a dither toggle
    screen.getByRole("button", { name: /Reset/ }).focus();
    press("Enter");
    expect(sound).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Dither: off/ })).toBeInTheDocument();
  });
});

describe("keypad: Enter reaches OK after mouse clicks", () => {
  it("a clicked key remounts (flash), so focus cannot stick to a digit", () => {
    const onSolve = vi.fn();
    render(<KeypadPuzzle params={{ code: "0341" }} onSolve={onSolve} solved={false} />);
    for (const d of ["0", "3", "4", "1"]) {
      const b = screen.getByRole("button", { name: `Digit ${d}` });
      b.focus(); // mousedown focuses the button …
      fireEvent.click(b); // … the click re-keys it for the flash
      expect(b.isConnected).toBe(false);
    }
    expect(document.activeElement).toBe(document.body);
    press("Enter");
    expect(onSolve).toHaveBeenCalledTimes(1);
  });
});

describe("radio: arrows match the help text whichever knob has focus", () => {
  const PARAMS = { seed: 7, freq: 94.7, phase: 135, line: "Test." };
  const freqKnob = () => screen.getByRole("slider", { name: "Frequency" });
  const phaseKnob = () => screen.getByRole("slider", { name: "Phase" });

  it("↑/W on the autofocused frequency knob turn the phase", () => {
    const start = radioStart(7, 94.7, 135);
    render(<RadioPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} />);
    fireEvent.keyDown(freqKnob(), { key: "ArrowUp" });
    fireEvent.keyDown(freqKnob(), { key: "w" });
    expect(phaseKnob()).toHaveAttribute("aria-valuetext", `${(start.phase + 10) % 360}°`);
    expect(freqKnob()).toHaveAttribute("aria-valuetext", `${start.freq.toFixed(1)} MHz`);
    fireEvent.keyDown(freqKnob(), { key: "ArrowRight" });
    expect(freqKnob()).toHaveAttribute("aria-valuetext", `${(start.freq + 0.1).toFixed(1)} MHz`);
  });

  it("←/→/D on the focused phase knob tune the frequency", () => {
    const start = radioStart(7, 94.7, 135);
    render(<RadioPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} />);
    fireEvent.keyDown(phaseKnob(), { key: "ArrowRight" });
    fireEvent.keyDown(phaseKnob(), { key: "d" });
    expect(freqKnob()).toHaveAttribute("aria-valuetext", `${(start.freq + 0.2).toFixed(1)} MHz`);
    expect(phaseKnob()).toHaveAttribute("aria-valuetext", `${start.phase}°`);
  });
});
