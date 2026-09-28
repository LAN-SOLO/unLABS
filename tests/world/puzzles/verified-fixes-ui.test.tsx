import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUZZLE_KIND_LABEL } from "@/components/world/map/dossier";
import { CoolantPuzzle } from "@/components/world/puzzles/CoolantPuzzle";
import { EthicsPuzzle } from "@/components/world/puzzles/EthicsPuzzle";
import { LayersPuzzle } from "@/components/world/puzzles/LayersPuzzle";
import { PuzzleView, SOLVED_DELAY_MS } from "@/components/world/puzzles/PuzzleView";
import { TonesPuzzle } from "@/components/world/puzzles/TonesPuzzle";
import { MATERIALS } from "@/components/world/puzzles/engine/layers";
import { generatePalette } from "@/components/world/puzzles/engine/palette";
import { num } from "@/components/world/puzzles/logic";
import { __setLocaleForTests, tr } from "@/lib/i18n";
import { PUZZLES, PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import { _resetSettingsCache } from "@/lib/world/settings";
import type { PuzzleDef } from "@/lib/world/types";

beforeEach(() => {
  localStorage.clear();
  _resetSettingsCache();
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  __setLocaleForTests(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const def = (id: string): PuzzleDef => {
  const d = PUZZLE_BY_ID.get(id);
  if (!d) throw new Error(`missing ${id}`);
  return d;
};

/**
 * A real keydown targets the focused element; a focused button then gets a
 * native click unless a handler called preventDefault. jsdom has no such
 * default action, so it is simulated here.
 */
const press = (key: string) => {
  const el = document.activeElement ?? document.body;
  const notPrevented = fireEvent.keyDown(el, { key });
  if (notPrevented && (key === "Enter" || key === " ") && el instanceof HTMLButtonElement)
    fireEvent.click(el);
};

const view = (id: string, onSolved = vi.fn(), onClose = vi.fn(), onSound = vi.fn()) =>
  render(<PuzzleView def={def(id)} onSolved={onSolved} onClose={onClose} onSound={onSound} />);

describe("#1 kind label in the puzzle header is localized", () => {
  it("shows the label map, not the raw kind id", () => {
    view("pz_power_flow");
    const header = screen.getByRole("heading", { name: def("pz_power_flow").title }).parentElement;
    expect(header?.textContent).toContain(PUZZLE_KIND_LABEL.pipes);
    expect(header?.textContent).not.toMatch(/pipes$/);
  });

  it("every kind has a German label", () => {
    __setLocaleForTests("de");
    expect(tr("puzzle kind::Pipe routing")).toBe("Rohrleitungen");
    for (const d of PUZZLES) expect(PUZZLE_KIND_LABEL[d.kind]).toBeTruthy();
  });
});

describe("#2 coolant viscosity band uses locale decimals", () => {
  it("German shows 1,4–2,2", () => {
    __setLocaleForTests("de");
    const { container } = render(
      <CoolantPuzzle params={def("pz_coolant").params} onSolve={vi.fn()} solved={false} />,
    );
    expect(container.textContent).toContain("(1,4–2,2)");
    expect(container.textContent).not.toContain("1.4");
  });
});

describe("#3 trend: opening focus is not on »New streak«", () => {
  it("Enter right after opening does not start a new round", () => {
    view("pz_trend_ticker");
    expect(document.activeElement?.tagName).toBe("CANVAS");
    press("Enter");
    press(" ");
    expect(screen.getByText("Round 1")).toBeInTheDocument();
  });
});

describe("#4 ethics card face keeps label and text on separate lines", () => {
  it("label and text are block spans inside the flip face", () => {
    const { container } = render(
      <EthicsPuzzle params={{ seed: 89, pairs: 6 }} onSolve={vi.fn()} solved={false} />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /card/ })[0]!);
    const face = container.querySelector("[data-card-face]");
    expect(face).not.toBeNull();
    const parts = [...(face?.children ?? [])];
    expect(parts).toHaveLength(2);
    for (const p of parts) expect(p.className.split(/\s+/)).toContain("block");
  });
});

describe("#5 palette", () => {
  const d = def("pz_palette_int");
  const puzzle = generatePalette(num(d.params, "seed", 2400), num(d.params, "channels", 4));
  const KEYS = ["a", "b", "c", "d", "e"];

  it("Enter after patching feeds in instead of hitting »Reset«", () => {
    const onSolved = vi.fn();
    const onSound = vi.fn();
    view("pz_palette_int", onSolved, vi.fn(), onSound);
    expect(document.activeElement?.tagName.toLowerCase()).toBe("svg");
    puzzle.solution.forEach((out, i) => {
      press(String(i + 1));
      press(KEYS[out]!);
    });
    press("Enter");
    expect(onSound).toHaveBeenCalledWith("scan_sweep");
    act(() => {
      vi.advanceTimersByTime(SOLVED_DELAY_MS);
    });
    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it("channel labels fit the viewBox (en + de)", () => {
    for (const locale of ["en", "de"] as const) {
      __setLocaleForTests(locale);
      const { container, unmount } = view("pz_palette_int");
      const svg = container.querySelector("svg[role='group']");
      const width = Number(svg?.getAttribute("viewBox")?.split(" ")[2]);
      for (const t of svg?.querySelectorAll("text") ?? []) {
        const x = Number(t.getAttribute("x"));
        const size = Number(t.getAttribute("font-size"));
        const w = (t.textContent ?? "").length * size * 0.62; // monospace advance
        const anchor = t.getAttribute("text-anchor");
        const [left, right] =
          anchor === "end" ? [x - w, x] : anchor === "middle" ? [x - w / 2, x + w / 2] : [x, x + w];
        expect(left, `${locale}: ${t.textContent}`).toBeGreaterThanOrEqual(0);
        expect(right, `${locale}: ${t.textContent}`).toBeLessThanOrEqual(width);
      }
      unmount();
    }
  });
});

describe("#6 layers: focus follows the ↑/↓ cursor", () => {
  const slot = (i: number) =>
    screen.getByRole("listitem", { name: new RegExp(`^Layer ${i + 1}:`) });

  it("5, Enter, ↓, 6, Enter fills layers 1 and 2", () => {
    render(<LayersPuzzle params={{ seed: 5, slots: 5 }} onSolve={vi.fn()} solved={false} />);
    slot(0).focus(); // PuzzleView's autofocus lands on the first layer
    press("5");
    press("Enter");
    press("ArrowDown");
    expect(document.activeElement).toBe(slot(1));
    press("6");
    press("Enter");
    expect(slot(0)).toHaveAttribute("aria-label", `Layer 1: ${MATERIALS[4]!.label}`);
    expect(slot(1)).toHaveAttribute("aria-label", `Layer 2: ${MATERIALS[5]!.label}`);
  });
});

describe("#8 tones: the waveform help already reveals every tone", () => {
  it("the MCP hint (incl. the first tone) is redundant while the help is open", () => {
    render(<TonesPuzzle params={{ tones: [2, 5, 3, 7] }} onSolve={vi.fn()} solved={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Help: show waveform/ }));
    expect(screen.getByLabelText("Target waveform: 3, 6, 4, 8")).toBeInTheDocument();
  });
});

describe("#10 a solve is never lost by closing during the solved animation", () => {
  const solveKeypad = () => {
    for (const k of "0341") press(k);
    press("Enter");
  };

  for (const [how, close] of [
    ["Esc", () => fireEvent.keyDown(window, { key: "Escape" })],
    ["backdrop click", () => fireEvent.mouseDown(screen.getByRole("dialog"))],
    ["Cancel", () => fireEvent.click(screen.getByRole("button", { name: "Cancel" }))],
  ] as const) {
    it(`${how} commits the pending solve instead of cancelling`, () => {
      const onSolved = vi.fn();
      const onClose = vi.fn();
      view("pz_keypad_tresor", onSolved, onClose);
      solveKeypad();
      expect(screen.getByTestId("puzzle-solved-overlay")).toBeInTheDocument();
      expect(onSolved).not.toHaveBeenCalled();
      close();
      expect(onSolved).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(SOLVED_DELAY_MS * 2);
      });
      expect(onSolved).toHaveBeenCalledTimes(1);
    });
  }

  it("an unmount by the host flushes the pending solve", () => {
    const onSolved = vi.fn();
    const { unmount } = view("pz_keypad_tresor", onSolved);
    solveKeypad();
    unmount();
    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it("Esc before solving still just closes", () => {
    const onSolved = vi.fn();
    const onClose = vi.fn();
    view("pz_keypad_tresor", onSolved, onClose);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSolved).not.toHaveBeenCalled();
  });
});
