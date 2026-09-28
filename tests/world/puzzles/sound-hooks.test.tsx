import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrcPuzzle } from "@/components/world/puzzles/CrcPuzzle";
import { KeypadPuzzle } from "@/components/world/puzzles/KeypadPuzzle";
import { LissajousPuzzle } from "@/components/world/puzzles/LissajousPuzzle";
import { PuzzleView, SOLVED_DELAY_MS } from "@/components/world/puzzles/PuzzleView";
import { SigilsPuzzle } from "@/components/world/puzzles/SigilsPuzzle";
import { TemporalPuzzle } from "@/components/world/puzzles/TemporalPuzzle";
import { generateCrc } from "@/components/world/puzzles/logic";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import { _resetSettingsCache, updateSettings } from "@/lib/world/settings";
import type { PuzzleDef } from "@/lib/world/types";

beforeEach(() => {
  localStorage.clear();
  _resetSettingsCache();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function def(id: string): PuzzleDef {
  const d = PUZZLE_BY_ID.get(id);
  if (!d) throw new Error(`missing def ${id}`);
  return d;
}

describe("puzzle sound hooks (kind level)", () => {
  it("keypad: digits beep, clear clicks, a wrong code buzzes", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(
      <KeypadPuzzle params={{ code: "0341" }} onSolve={onSolve} solved={false} sound={sound} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Digit 1" }));
    expect(sound).toHaveBeenLastCalledWith("keypad_beep");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(sound).toHaveBeenLastCalledWith("ui_click");
    for (const d of ["9", "9", "9", "9"])
      fireEvent.click(screen.getByRole("button", { name: `Digit ${d}` }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    expect(onSolve).not.toHaveBeenCalled();
  });

  it("keypad: the right code solves without a sound of its own", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(
      <KeypadPuzzle params={{ code: "0341" }} onSolve={onSolve} solved={false} sound={sound} />,
    );
    for (const d of ["0", "3", "4", "1"])
      fireEvent.click(screen.getByRole("button", { name: `Digit ${d}` }));
    sound.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onSolve).toHaveBeenCalledTimes(1);
    expect(sound).not.toHaveBeenCalled();
  });

  it("temporal: a wrong log line buzzes, the right one solves", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(
      <TemporalPuzzle
        params={{ lines: ["a", "b", "c"], answer: 1 }}
        onSolve={onSolve}
        solved={false}
        sound={sound}
      />,
    );
    const [first, second] = screen.getAllByRole("button");
    fireEvent.click(first);
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    fireEvent.click(second);
    expect(onSolve).toHaveBeenCalledTimes(1);
  });

  it("sigils: pressing a sigil emits a click or a progress beep", () => {
    const sound = vi.fn();
    render(
      <SigilsPuzzle
        params={{ size: 5, seed: 2003 }}
        onSolve={vi.fn()}
        solved={false}
        sound={sound}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /^Sigil 1\/1/ })[0]);
    expect(sound).toHaveBeenCalledTimes(1);
    expect(["ui_click", "keypad_beep"]).toContain(sound.mock.calls[0][0]);
  });

  it("crc: a harmful flip clicks, the corrupted bit solves", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    const params = { rows: 6, cols: 8, seed: 89 };
    const g = generateCrc(6, 8, 89);
    render(<CrcPuzzle params={params} onSolve={onSolve} solved={false} sound={sound} />);
    // A bit outside the bad row and column makes things worse → plain click.
    const badR = Math.floor(g.flipped / 8);
    const badC = g.flipped % 8;
    const r = (badR + 1) % 6;
    const c = (badC + 1) % 8;
    const bitLabel = (row: number, col: number) =>
      new RegExp(`^Bit row ${row + 1}, column ${col + 1}:`);
    fireEvent.click(screen.getByRole("button", { name: bitLabel(r, c) }));
    expect(sound).toHaveBeenLastCalledWith("ui_click");
    // Undo it → mismatches shrink → progress beep.
    fireEvent.click(screen.getByRole("button", { name: bitLabel(r, c) }));
    expect(sound).toHaveBeenLastCalledWith("keypad_beep");
    fireEvent.click(screen.getByRole("button", { name: bitLabel(badR, badC) }));
    expect(onSolve).toHaveBeenCalledTimes(1);
  });

  it("lissajous: ratio buttons click, finding the right ratio beeps", () => {
    const sound = vi.fn();
    render(
      <LissajousPuzzle
        params={{ ratio: "3:4", phase: 90 }}
        onSolve={vi.fn()}
        solved={false}
        sound={sound}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "1:2" }));
    expect(sound).toHaveBeenLastCalledWith("ui_click");
    fireEvent.click(screen.getByRole("button", { name: "3:4" }));
    expect(sound).toHaveBeenLastCalledWith("keypad_beep");
  });

  it("kinds work without a sound hook", () => {
    render(<KeypadPuzzle params={{ code: "12" }} onSolve={vi.fn()} solved={false} />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Digit 1" }))).not.toThrow();
  });
});

describe("PuzzleView", () => {
  it("forwards kind sounds to onSound and throttles repeats of the same name", () => {
    const onSound = vi.fn();
    render(
      <PuzzleView
        def={def("pz_keypad_tresor")}
        onSolved={vi.fn()}
        onClose={vi.fn()}
        onSound={onSound}
      />,
    );
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(1000);
    fireEvent.click(screen.getByRole("button", { name: "Digit 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Digit 2" }));
    expect(onSound).toHaveBeenCalledTimes(1);
    expect(onSound).toHaveBeenCalledWith("keypad_beep");
    now.mockReturnValue(1200);
    fireEvent.click(screen.getByRole("button", { name: "Digit 3" }));
    expect(onSound).toHaveBeenCalledTimes(2);
  });

  it("plays the solve animation, then calls onSolved once", () => {
    vi.useFakeTimers();
    const onSolved = vi.fn();
    const d = def("pz_temporal");
    render(<PuzzleView def={d} onSolved={onSolved} onClose={vi.fn()} onSound={vi.fn()} />);
    const lines = screen.getAllByRole("listitem");
    const answer = Number(d.params.answer);
    const btn = lines[answer].querySelector("button");
    if (!btn) throw new Error("no log button");
    fireEvent.click(btn);
    expect(screen.getByRole("status")).toHaveTextContent("SOLVED");
    expect(screen.getByTestId("puzzle-solved-overlay")).toBeInTheDocument();
    expect(onSolved).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(SOLVED_DELAY_MS);
    });
    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it("exposes the accessibility settings as data attributes", () => {
    updateSettings({
      accessibility: { reduceMotion: true, reduceFlicker: true, highContrastFocus: true },
    });
    render(<PuzzleView def={def("pz_keypad_tresor")} onSolved={vi.fn()} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-rm", "1");
    expect(dialog).toHaveAttribute("data-rf", "1");
    expect(dialog).toHaveAttribute("data-hc", "1");
  });
});
