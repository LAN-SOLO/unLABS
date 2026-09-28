import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TonesPuzzle } from "@/components/world/puzzles/TonesPuzzle";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("tones ui", () => {
  it("number keys play back the sequence and solve", () => {
    const onSolve = vi.fn();
    render(<TonesPuzzle params={{ tones: [2, 5, 3, 7] }} onSolve={onSolve} solved={false} />);
    for (const k of ["3", "6", "4", "8"]) fireEvent.keyDown(window, { key: k });
    expect(onSolve).toHaveBeenCalledTimes(1);
  });

  it("a wrong tone buzzes, shakes and clears the input", () => {
    const sound = vi.fn();
    const { container } = render(
      <TonesPuzzle params={{ tones: [2, 5] }} onSolve={vi.fn()} solved={false} sound={sound} />,
    );
    fireEvent.keyDown(window, { key: "3" });
    expect(screen.getByRole("img", { name: "Input: 1 / 2" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "1" });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(sound).toHaveBeenCalledWith("fail_buzz");
    expect(container.querySelector(".pz-fail-a")).not.toBeNull();
    expect(screen.getByRole("img", { name: "Input: 0 / 2" })).toBeInTheDocument();
  });

  it("Backspace / reset clears a partial input", () => {
    render(<TonesPuzzle params={{ tones: [2, 5] }} onSolve={vi.fn()} solved={false} />);
    fireEvent.keyDown(window, { key: "3" });
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(screen.getByRole("img", { name: "Input: 0 / 2" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "3" });
    fireEvent.click(screen.getByRole("button", { name: /Clear input/ }));
    expect(screen.getByRole("img", { name: "Input: 0 / 2" })).toBeInTheDocument();
  });

  it("falls back to a solvable sequence when every tone is out of range", () => {
    const onSolve = vi.fn();
    render(<TonesPuzzle params={{ tones: [42, -1] }} onSolve={onSolve} solved={false} />);
    for (const k of ["1", "2", "3", "4"]) fireEvent.keyDown(window, { key: k });
    expect(onSolve).toHaveBeenCalledTimes(1);
  });
});
