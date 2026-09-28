import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SolderPuzzle } from "@/components/world/puzzles/SolderPuzzle";
import { generateBoard } from "@/components/world/puzzles/engine/solder";

const PARAMS = { seed: 38, pads: 6, width: 14 };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SolderPuzzle UI", () => {
  it("generator is deterministic per seed", () => {
    expect(generateBoard(38, 6, 14)).toEqual(generateBoard(38, 6, 14));
    expect(generateBoard(38, 6, 14)).not.toEqual(generateBoard(39, 6, 14));
  });

  it("Space held and released on the board heats the active pad (cold joint → click)", () => {
    const sound = vi.fn();
    render(<SolderPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    const board = screen.getByRole("application");
    board.focus();
    fireEvent.keyDown(board, { key: " " });
    fireEvent.keyUp(board, { key: " " });
    expect(sound).toHaveBeenLastCalledWith("ui_click");
    expect(screen.getByText(/Cold joint/)).toBeInTheDocument();
  });

  it("pressing a later pad out of order buzzes and shakes", () => {
    const sound = vi.fn();
    render(<SolderPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    const pad3 = screen.getByRole("button", { name: "Pad 3" });
    fireEvent.pointerDown(pad3);
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(screen.getByRole("application").getAttribute("class")).toMatch(/pz-fail-/);
  });

  it("reset returns to pad 1 and Space on the reset button does not heat", () => {
    const sound = vi.fn();
    render(<SolderPuzzle params={PARAMS} onSolve={vi.fn()} solved={false} sound={sound} />);
    const btn = screen.getByRole("button", { name: /Reset/ });
    btn.focus();
    fireEvent.keyDown(btn, { key: " " });
    fireEvent.keyUp(btn, { key: " " });
    expect(screen.queryByText(/Cold joint/)).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText(/From the top: pad 1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pad 1 (active)" })).toBeInTheDocument();
  });
});
