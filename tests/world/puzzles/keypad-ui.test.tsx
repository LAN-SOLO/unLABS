import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeypadPuzzle } from "@/components/world/puzzles/KeypadPuzzle";

afterEach(cleanup);

describe("keypad ui", () => {
  it("number keys + Enter solve from the keyboard", () => {
    const onSolve = vi.fn();
    render(<KeypadPuzzle params={{ code: "0341" }} onSolve={onSolve} solved={false} />);
    for (const k of ["0", "3", "4", "1"]) fireEvent.keyDown(window, { key: k });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onSolve).toHaveBeenCalledTimes(1);
  });

  it("Backspace corrects, a wrong code buzzes and flashes the display", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    const { container } = render(
      <KeypadPuzzle params={{ code: "12" }} onSolve={onSolve} solved={false} sound={sound} />,
    );
    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "Backspace" });
    fireEvent.keyDown(window, { key: "9" });
    fireEvent.keyDown(window, { key: "9" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(container.querySelector(".pz-fail-a")).not.toBeNull();
    expect(screen.getByLabelText("Wrong code")).toBeInTheDocument();
    expect(onSolve).not.toHaveBeenCalled();
  });

  it("unlocks the MCP hint after three failures (with a hint chime)", () => {
    const sound = vi.fn();
    render(<KeypadPuzzle params={{ code: "12" }} onSolve={vi.fn()} solved={false} sound={sound} />);
    for (let i = 0; i < 3; i++) fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(sound).toHaveBeenCalledWith("hint_pop");
  });

  it("ignores Escape and shows a help line", () => {
    render(<KeypadPuzzle params={{ code: "12" }} onSolve={vi.fn()} solved={false} />);
    const ev = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(document.querySelector("[data-pz-help]")).not.toBeNull();
  });
});
