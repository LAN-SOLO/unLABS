import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TemporalPuzzle } from "@/components/world/puzzles/TemporalPuzzle";

afterEach(cleanup);

const params = { lines: ["a", "b", "c", "d"], answer: 2 };

describe("temporal ui", () => {
  it("arrow keys walk the log and a wrong pick is marked early/late", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    const { container } = render(
      <TemporalPuzzle params={params} onSolve={onSolve} solved={false} sound={sound} />,
    );
    const first = screen.getByRole("button", { name: /^Entry 1:/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Entry 2:/ }));
    fireEvent.click(document.activeElement!);
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(container.querySelector(".pz-fail-a")).not.toBeNull();
    expect(screen.getByRole("button", { name: /^Entry 2: b — too early/ })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    fireEvent.click(document.activeElement!);
    expect(screen.getByRole("button", { name: /^Entry 4: d — too late/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Clear marks/ }));
    expect(screen.getByRole("button", { name: /^Entry 2: b$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Entry 3:/ }));
    expect(onSolve).toHaveBeenCalledTimes(1);
  });

  it("clamps an out-of-range answer so the puzzle stays solvable", () => {
    const onSolve = vi.fn();
    render(
      <TemporalPuzzle params={{ lines: ["a", "b"], answer: 9 }} onSolve={onSolve} solved={false} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Entry 2:/ }));
    expect(onSolve).toHaveBeenCalledTimes(1);
  });
});
