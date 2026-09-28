import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PuzzleView } from "@/components/world/puzzles/PuzzleView";
import { PUZZLES } from "@/lib/world/content/puzzles";
import type { PuzzleKind } from "@/lib/world/types";
import { _resetSettingsCache } from "@/lib/world/settings";

beforeEach(() => {
  localStorage.clear();
  _resetSettingsCache();
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Every authored def must mount (and run a few animation frames) without throwing. */
describe("puzzle render smoke", () => {
  for (const def of PUZZLES) {
    it(`${def.id} (${def.kind}) renders with its authored params`, () => {
      const onSound = vi.fn();
      const { unmount } = render(
        <PuzzleView def={def} onSolved={vi.fn()} onClose={vi.fn()} onSound={onSound} />,
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: def.title })).toBeInTheDocument();
      // Let rAF loops / intervals tick once.
      act(() => {
        vi.advanceTimersByTime(120);
      });
      // Nothing is emitted before the player acts, except rising-edge beeps of
      // self-running gauges — never a failure buzz.
      expect(onSound).not.toHaveBeenCalledWith("fail_buzz");
      unmount();
    });
  }

  it("covers every kind at least once", () => {
    const kinds = new Set<PuzzleKind>(PUZZLES.map((p) => p.kind));
    expect(kinds.size).toBe(26);
  });
});
