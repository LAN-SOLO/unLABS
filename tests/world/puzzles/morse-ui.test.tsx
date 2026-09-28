import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MorsePuzzle } from "@/components/world/puzzles/MorsePuzzle";
import {
  DEFAULT_GROUPS,
  DEFAULT_WHISPER,
  morseSolution,
} from "@/components/world/puzzles/engine/morse";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const answer = morseSolution(DEFAULT_WHISPER, [...DEFAULT_GROUPS]).answer;
const type = (s: string) => {
  for (const ch of s) fireEvent.keyDown(window, { key: ch });
};
const entry = () => screen.getByRole("textbox").getAttribute("aria-label") ?? "";

describe("MorsePuzzle UI", () => {
  it("typing a wrong word and Enter buzzes and shakes", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<MorsePuzzle params={{}} onSolve={onSolve} solved={false} sound={sound} />);
    type("Z".repeat(answer.length));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(screen.getByRole("textbox").getAttribute("class")).toMatch(/pz-fail-/);
    expect(onSolve).not.toHaveBeenCalled();
  });

  it("the right word solves without a kind sound", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<MorsePuzzle params={{}} onSolve={onSolve} solved={false} sound={sound} />);
    type(answer.toLowerCase());
    sound.mockClear();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onSolve).toHaveBeenCalledTimes(1);
    expect(sound).not.toHaveBeenCalled();
  });

  it("Backspace deletes, reset clears everything", () => {
    render(<MorsePuzzle params={{}} onSolve={vi.fn()} solved={false} />);
    type("AB");
    expect(entry()).toMatch(/Input: A B\./);
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(entry()).toMatch(/Input: A\./);
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(entry()).toMatch(/Input: empty/);
  });

  it("Enter on a focused button acts as that button, not as submit", () => {
    const sound = vi.fn();
    render(<MorsePuzzle params={{}} onSolve={vi.fn()} solved={false} sound={sound} />);
    type("Z".repeat(answer.length));
    const btn = screen.getByRole("button", { name: /Reset/ });
    btn.focus();
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(sound).not.toHaveBeenCalledWith("fail_buzz");
  });
});
