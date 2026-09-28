import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PuzzleView } from "@/components/world/puzzles/PuzzleView";
import { PUZZLES, PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import { _resetSettingsCache } from "@/lib/world/settings";
import type { PuzzleDef } from "@/lib/world/types";

beforeEach(() => {
  localStorage.clear();
  _resetSettingsCache();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function def(id: string): PuzzleDef {
  const d = PUZZLE_BY_ID.get(id);
  if (!d) throw new Error(`missing def ${id}`);
  return d;
}

describe("PuzzleView shell", () => {
  it("moves focus into the puzzle and closes on Escape", () => {
    const onClose = vi.fn();
    render(<PuzzleView def={def("pz_keypad_tresor")} onSolved={vi.fn()} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a backdrop click but not on a click inside", () => {
    const onClose = vi.fn();
    render(<PuzzleView def={def("pz_keypad_tresor")} onSolved={vi.fn()} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByRole("heading", { name: def("pz_keypad_tresor").title }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("plays the sweep sound the moment a puzzle is solved", () => {
    const onSound = vi.fn();
    const d = def("pz_temporal");
    render(<PuzzleView def={d} onSolved={vi.fn()} onClose={vi.fn()} onSound={onSound} />);
    const btn = screen.getAllByRole("listitem")[Number(d.params.answer)]?.querySelector("button");
    if (!btn) throw new Error("no log button");
    fireEvent.click(btn);
    expect(onSound).toHaveBeenCalledWith("scan_sweep");
  });

  it("every kind shows a keyboard help line", () => {
    const seen = new Set<string>();
    for (const d of PUZZLES) {
      if (seen.has(d.kind)) continue;
      seen.add(d.kind);
      const { container, unmount } = render(
        <PuzzleView def={d} onSolved={vi.fn()} onClose={vi.fn()} />,
      );
      expect(container.ownerDocument.querySelector("[data-pz-help]"), d.kind).not.toBeNull();
      unmount();
    }
  });
});
