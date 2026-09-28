import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EraPuzzle } from "@/components/world/puzzles/EraPuzzle";
import { ERA_BITS } from "@/components/world/puzzles/engine/era";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const params = { seed: 16, target: 16, dither: 1 };
const key = (k: string) => fireEvent.keyDown(window, { key: k });

describe("EraPuzzle UI", () => {
  it("a wrong lock buzzes; number keys + D + Enter solve it silently", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<EraPuzzle params={params} onSolve={onSolve} solved={false} sound={sound} />);
    key("Enter"); // 8 bit, no dither → wrong
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(screen.getByText(/✗ rejected/)).toBeInTheDocument();
    key(String(ERA_BITS.indexOf(16) + 1));
    key("d");
    sound.mockClear();
    key("Enter");
    expect(onSolve).toHaveBeenCalledTimes(1);
    expect(sound).not.toHaveBeenCalledWith("fail_buzz");
  });

  it("arrow keys cycle eras and reset restores the start", () => {
    const sound = vi.fn();
    render(<EraPuzzle params={params} onSolve={vi.fn()} solved={false} sound={sound} />);
    key("ArrowRight");
    expect(screen.getByRole("button", { name: /Era 16 bit/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(sound).toHaveBeenLastCalledWith("ui_click");
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(screen.getByRole("button", { name: /Era 8 bit/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows a hint after three wrong locks and chimes once", () => {
    const sound = vi.fn();
    render(<EraPuzzle params={params} onSolve={vi.fn()} solved={false} sound={sound} />);
    for (let i = 0; i < 3; i++) key("Enter");
    expect(screen.getByRole("note")).toHaveTextContent("MCP HINT");
    expect(sound.mock.calls.filter((c) => c[0] === "hint_pop")).toHaveLength(1);
  });
});
