import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EthicsPuzzle } from "@/components/world/puzzles/EthicsPuzzle";
import { dealEthics } from "@/components/world/puzzles/engine/ethics";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const params = { seed: 89, pairs: 6 };
const cards = dealEthics(89, 6);
const buttons = () => screen.getAllByRole("button", { name: /card|Scenario|Principle/ });

describe("EthicsPuzzle UI", () => {
  it("arrow keys move the cursor and Enter flips the card", () => {
    const sound = vi.fn();
    render(<EthicsPuzzle params={params} onSolve={vi.fn()} solved={false} sound={sound} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(buttons()[1]).not.toHaveAccessibleName("Face-down card 2");
    expect(sound).toHaveBeenLastCalledWith("ui_click");
  });

  it("a mismatch buzzes; a match beeps; reset hides everything again", () => {
    vi.useFakeTimers();
    const sound = vi.fn();
    render(<EthicsPuzzle params={params} onSolve={vi.fn()} solved={false} sound={sound} />);
    const partner = cards.findIndex((c, i) => i > 0 && c.pairId === cards[0].pairId);
    const stranger = cards.findIndex((c) => c.pairId !== cards[0].pairId);
    fireEvent.click(buttons()[0]);
    fireEvent.click(buttons()[stranger]);
    expect(sound).toHaveBeenLastCalledWith("fail_buzz");
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    fireEvent.click(buttons()[0]);
    fireEvent.click(buttons()[partner]);
    expect(sound).toHaveBeenLastCalledWith("keypad_beep");
    expect(buttons()[0]).toHaveAccessibleName(/^Matched/);
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(buttons()[0]).toHaveAccessibleName("Face-down card 1");
  });

  it("matching every pair solves without a sound of its own", () => {
    const sound = vi.fn();
    const onSolve = vi.fn();
    render(<EthicsPuzzle params={params} onSolve={onSolve} solved={false} sound={sound} />);
    const seen = new Set<string>();
    cards.forEach((c, i) => {
      if (seen.has(c.pairId)) return;
      seen.add(c.pairId);
      const j = cards.findIndex((d, k) => k !== i && d.pairId === c.pairId);
      fireEvent.click(buttons()[i]);
      sound.mockClear();
      fireEvent.click(buttons()[j]);
    });
    expect(onSolve).toHaveBeenCalledTimes(1);
    expect(sound).not.toHaveBeenCalled();
  });
});
