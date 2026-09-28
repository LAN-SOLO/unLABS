import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CipherPuzzle } from "@/components/world/puzzles/CipherPuzzle";
import { ClampPuzzle } from "@/components/world/puzzles/ClampPuzzle";
import { StencilPuzzle } from "@/components/world/puzzles/StencilPuzzle";
import { TemporalPuzzle } from "@/components/world/puzzles/TemporalPuzzle";
import { TrendPuzzle } from "@/components/world/puzzles/TrendPuzzle";
import {
  generateStencil,
  parseShape,
  stencilStart,
  stencilStep,
} from "@/components/world/puzzles/engine/stencil";
import { num, str, strs } from "@/components/world/puzzles/logic";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import type { PuzzleDef } from "@/lib/world/types";

/**
 * Puzzle kinds reused on other devices must not show the flavour text of
 * their original host (σ-17 log, HALO hint, _unSLC slices, consensus stream).
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

const def = (id: string): PuzzleDef => {
  const d = PUZZLE_BY_ID.get(id);
  if (!d) throw new Error(`missing ${id}`);
  return d;
};

describe("temporal texts follow the puzzle", () => {
  it("chart table (3 σ, Level 0) shows no σ-17 / Level −3 text", () => {
    const d = def("pz_side_kartentisch");
    const answer = num(d.params, "answer", 0);
    const { container } = render(
      <TemporalPuzzle params={d.params} onSolve={vi.fn()} solved={false} />,
    );
    expect(container.textContent).not.toContain("LEVEL −3");
    expect(container.textContent).toContain("LEVEL 0");
    fireEvent.click(screen.getByRole("button", { name: /^Entry 1:/ })); // too early
    expect(container.textContent).toContain("below 3 σ");
    fireEvent.click(screen.getByRole("button", { name: /^Entry 2:/ }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Entry ${answer + 2}:`) }));
    expect(screen.getByRole("note")).toHaveTextContent("above 3 σ");
    expect(container.textContent).not.toContain("σ-17");
  });

  it("the Level −3 log keeps its σ-17 texts", () => {
    const d = def("pz_temporal");
    const { container } = render(
      <TemporalPuzzle params={d.params} onSolve={vi.fn()} solved={false} />,
    );
    expect(container.textContent).toContain("LOG · LEVEL −3");
    fireEvent.click(screen.getByRole("button", { name: /^Entry 1:/ }));
    expect(container.textContent).toContain("below σ-17");
  });

  it("pz_temporal intro matches its answer line (reached σ-17)", () => {
    const d = def("pz_temporal");
    const line = strs(d.params, "lines", [])[num(d.params, "answer", -1)];
    expect(line).toMatch(/Coherence σ-17$/);
    expect(d.intro).toContain("first reached σ-17");
    expect(d.intro).not.toContain("exceeded");
  });
});

describe("cipher second hint names the right key", () => {
  const hint2 = (id: string) => {
    const d = def(id);
    render(<CipherPuzzle params={d.params} onSolve={vi.fn()} solved={false} />);
    act(() => {
      vi.advanceTimersByTime(121_000);
    });
    return screen.getByRole("note").textContent ?? "";
  };

  it("HALO keeps Jade's favourite word", () => {
    const t = hint2("pz_cipher");
    expect(t).toContain("it begins with “H”");
    expect(t).toContain("Jade's favourite word.");
  });

  it("COPPER does not claim to be Jade's favourite word", () => {
    const t = hint2("pz_side_versorgung");
    expect(t).toContain("it begins with “C”");
    expect(t).not.toContain("Jade");
    expect(t).toContain("coils");
  });
});

describe("clamp / trend / stencil flavour on reused hosts", () => {
  it("battery-box clamp has no _unSLC / slice header", () => {
    const d = def("pz_side_reservezellen");
    const { container } = render(
      <ClampPuzzle params={d.params} onSolve={vi.fn()} solved={false} />,
    );
    expect(container.textContent).toContain("Charge curve · Round 1 / 3");
    expect(container.textContent).not.toContain("_unSLC");
    expect(container.innerHTML).not.toContain("Slices clamped");
  });

  it("the original clamp keeps its _unSLC header", () => {
    const d = def("pz_clamp_volatility");
    const { container } = render(
      <ClampPuzzle params={d.params} onSolve={vi.fn()} solved={false} />,
    );
    expect(container.textContent).toContain("_unSLC volatility · Round 1 / 3");
  });

  it("compute-core trend has no consensus stream", () => {
    const d = def("pz_side_rechenkern");
    const { container } = render(
      <TrendPuzzle params={d.params} onSolve={vi.fn()} solved={false} />,
    );
    expect(container.textContent).not.toContain("Consensus stream");
    expect(container.textContent).toContain("Load curve running");
  });

  it("material-cabinet stencil neither crystallises a slice nor cracks a shard", () => {
    const d = def("pz_side_materialschrank");
    expect(str(d.params, "done", "")).not.toMatch(/slice/i);
    const shape = str(d.params, "shape", "hex");
    const max = num(d.params, "maxStress", 15);
    const { path } = generateStencil(num(d.params, "seed", 3), parseShape(shape));
    const dir = (
      [
        ["8", 0, -1],
        ["2", 0, 1],
        ["4", -1, 0],
        ["6", 1, 0],
      ] as const
    ).find(([, dx, dy]) => {
      let s = stencilStart(path);
      for (let i = 0; i < 80 && !s.cracked; i++) s = stencilStep(s, dx, dy, path, max);
      return s.cracked;
    });
    if (!dir) throw new Error("no cracking direction");
    const { container } = render(
      <StencilPuzzle params={d.params} onSolve={vi.fn()} solved={false} />,
    );
    for (let i = 0; i < 80; i++) fireEvent.keyDown(window, { key: dir[0] });
    expect(container.textContent).toContain("jumps out of the groove");
    expect(container.textContent).not.toContain("micro-shard");
  });
});
