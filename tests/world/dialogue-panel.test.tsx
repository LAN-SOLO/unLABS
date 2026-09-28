import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DialoguePanel } from "@/components/world/panels/misc";
import type { WorldApi } from "@/components/world/panels";
import { initialState } from "@/lib/world/game";
import type { WorldState } from "@/lib/world/types";

function makeApi(): { api: WorldApi; state: WorldState } {
  const state = initialState();
  const api: WorldApi = {
    get: () => state,
    act: (fn) => fn(state),
    toast: vi.fn(),
    version: 0,
    sound: vi.fn(),
  };
  return { api, state };
}

function logText(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-entry] p")).map((p) => p.textContent ?? "");
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("DialoguePanel", () => {
  it("removes an asked question, logs it once and offers a replay without effects", () => {
    const { api, state } = makeApi();
    const { container } = render(<DialoguePanel npcId="p1ndr0" api={api} onClose={() => {}} />);
    const ask = screen.getByRole("button", { name: /› What are you looking for\?/ });
    fireEvent.click(ask);
    expect(screen.queryByRole("button", { name: /› What are you looking for\?/ })).toBeNull();
    const once = logText(container);
    expect(once.filter((t) => t.includes("Everything that was lost"))).toHaveLength(1);

    // "Already asked" list: replay shows the answer, no duplicate, no effects.
    const asked = screen.getByTestId("dialogue-asked");
    const flags = { ...state.flags };
    const counters = { ...state.counters };
    fireEvent.click(within(asked).getByRole("button", { name: /What are you looking for\?/ }));
    expect(logText(container)).toEqual(once);
    expect(state.flags).toEqual(flags);
    expect(state.counters).toEqual(counters);
  });

  it("shows an idle line and a Leave button when nothing is left to ask", () => {
    const { api } = makeApi();
    const onClose = vi.fn();
    const { container } = render(<DialoguePanel npcId="p1ndr0" api={api} onClose={onClose} />);
    for (;;) {
      const next = screen.queryAllByRole("button", { name: /^› / })[0];
      if (!next) break;
      fireEvent.click(next);
    }
    expect(screen.getByTestId("dialogue-idle").textContent).toContain("…");
    const lines = logText(container);
    expect(new Set(lines).size).toBe(lines.length);
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(onClose).toHaveBeenCalled();
  });
});
