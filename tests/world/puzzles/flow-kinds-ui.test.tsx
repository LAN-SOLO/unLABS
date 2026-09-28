import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoolantPuzzle } from "@/components/world/puzzles/CoolantPuzzle";
import { HeatPuzzle } from "@/components/world/puzzles/HeatPuzzle";
import { LissajousPuzzle } from "@/components/world/puzzles/LissajousPuzzle";
import { PipesPuzzle } from "@/components/world/puzzles/PipesPuzzle";
import { ValvePuzzle } from "@/components/world/puzzles/ValvePuzzle";
import {
  LISSAJOUS_RATIOS,
  coolantMix,
  coolantOk,
  lissajousMatches,
  lissajousStartPhase,
  normPhase,
  num,
  str,
} from "@/components/world/puzzles/logic";
import { PUZZLES } from "@/lib/world/content/puzzles";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const key = (k: string) => fireEvent.keyDown(window, { key: k });

describe("lissajous logic", () => {
  it("accepts phases that draw the identical figure", () => {
    // 3:4 traces the same curve every 45°.
    expect(lissajousMatches("3:4", 0, "3:4", 90)).toBe(true);
    expect(lissajousMatches("3:4", 45, "3:4", 90)).toBe(true);
    expect(lissajousMatches("3:4", 15, "3:4", 90)).toBe(false);
    // 1:1 at 0° and 180° are the two different diagonals.
    expect(lissajousMatches("1:1", 180, "1:1", 0)).toBe(false);
    expect(lissajousMatches("1:1", 270, "1:1", 90)).toBe(true);
  });

  it("every authored target is reachable and never pre-solved", () => {
    for (const def of PUZZLES.filter((p) => p.kind === "lissajous")) {
      const ratio = str(def.params, "ratio", "3:4");
      const phase = normPhase(num(def.params, "phase", 90));
      expect((LISSAJOUS_RATIOS as readonly string[]).includes(ratio)).toBe(true);
      expect(phase % 15).toBe(0);
      const start = lissajousStartPhase(ratio, phase);
      expect(lissajousMatches(ratio, start, ratio, phase)).toBe(false);
    }
  });
});

describe("coolant logic", () => {
  it("every authored target has an integer mix within the slider range", () => {
    for (const def of PUZZLES.filter((p) => p.kind === "coolant")) {
      const target = num(def.params, "target", -12);
      let found = false;
      for (let g = 0; g <= 10 && !found; g++)
        for (let n = 0; n <= 10 && !found; n++)
          for (let w = 0; w <= 10 && !found; w++)
            if (coolantOk(coolantMix([g, n, w]), target)) found = true;
      expect(found, def.id).toBe(true);
    }
  });
});

describe("lissajous UI", () => {
  it("number keys pick a ratio, A/D turn the phase, R resets", () => {
    const sound = vi.fn();
    render(
      <LissajousPuzzle
        params={{ ratio: "3:4", phase: 90 }}
        onSolve={vi.fn()}
        solved={false}
        sound={sound}
      />,
    );
    key("2");
    expect(screen.getByRole("button", { name: "1:2" })).toHaveAttribute("aria-pressed", "true");
    const slider = screen.getByRole("slider", { name: "Phase" });
    const before = Number((slider as HTMLInputElement).value);
    key("d");
    expect(Number((slider as HTMLInputElement).value)).toBe(before + 15);
    key("r");
    expect(screen.getByRole("button", { name: "1:1" })).toHaveAttribute("aria-pressed", "true");
    expect(Number((slider as HTMLInputElement).value)).toBe(before);
    expect(sound).toHaveBeenCalledWith("ui_click");
  });

  it("solves as soon as an equivalent figure is dialled", () => {
    const onSolve = vi.fn();
    render(
      <LissajousPuzzle params={{ ratio: "3:4", phase: 90 }} onSolve={onSolve} solved={false} />,
    );
    key("4"); // 3:4 at the start phase (15°) — not yet
    expect(onSolve).not.toHaveBeenCalled();
    key("a"); // 0° draws the same figure as 90°
    expect(onSolve).toHaveBeenCalledTimes(1);
  });
});

describe("pipes UI", () => {
  it("arrows move the focus, Enter rotates, reset restores", () => {
    render(<PipesPuzzle params={{ size: 4, seed: 1 }} onSolve={vi.fn()} solved={false} />);
    const first = screen.getByRole("gridcell", { name: /^Segment row 1, column 1/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("gridcell", { name: /^Segment row 1, column 2/ });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "d" });
    expect(document.activeElement).toBe(
      screen.getByRole("gridcell", { name: /^Segment row 1, column 3/ }),
    );
    fireEvent.keyDown(document.activeElement as Element, { key: "Enter" });
    expect(screen.getByText("Moves: 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(screen.getByText("Moves: 0")).toBeInTheDocument();
  });
});

describe("coolant UI", () => {
  it("number keys focus a fluid, reset drains", () => {
    render(<CoolantPuzzle params={{ target: -15 }} onSolve={vi.fn()} solved={false} />);
    key("2");
    const n2 = screen.getByRole("slider", { name: "Nitrogen, parts" });
    expect(document.activeElement).toBe(n2);
    fireEvent.change(n2, { target: { value: "4" } });
    expect((n2 as HTMLInputElement).value).toBe("4");
    fireEvent.click(screen.getByRole("button", { name: /Drain/ }));
    expect((n2 as HTMLInputElement).value).toBe("0");
  });
});

describe("heat UI", () => {
  it("number keys jump the lever to a detent, R returns it", () => {
    const sound = vi.fn();
    render(<HeatPuzzle params={{ hold: 4 }} onSolve={vi.fn()} solved={false} sound={sound} />);
    const lever = screen.getByRole("slider", { name: "Lever" }) as HTMLInputElement;
    key("6");
    expect(lever.value).toBe("60");
    expect(sound).toHaveBeenLastCalledWith("ui_click");
    key("d");
    expect(lever.value).toBe("65");
    key("r");
    expect(lever.value).toBe("20");
    expect(screen.getByText(/jumps to/)).toBeInTheDocument();
  });
});

describe("valve UI", () => {
  it("N re-centres the counter-steer and the footer offers Neutral", () => {
    render(
      <ValvePuzzle params={{ low: 42, high: 58, hold: 4 }} onSolve={vi.fn()} solved={false} />,
    );
    const slider = screen.getByRole("slider", { name: "Countersteer" }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "20" } });
    expect(slider.value).toBe("20");
    key("n");
    expect(slider.value).toBe("0");
    fireEvent.change(slider, { target: { value: "-10" } });
    fireEvent.click(screen.getByRole("button", { name: /Neutral/ }));
    expect(slider.value).toBe("0");
  });
});
