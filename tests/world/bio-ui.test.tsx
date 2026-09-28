/**
 * Biorhythm UI (components/world/BioPanels.tsx): HUD meters per HUD mode,
 * the Bio panel, the station panels and the provisions strip.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  BioHud,
  BioPanel,
  BioStationPanel,
  ProvisionList,
  gainText,
} from "@/components/world/BioPanels";
import { InventoryPanel, type WorldApi } from "@/components/world/panels";
import { bagCount, bioActivate, bioValue, fridgeCount } from "@/lib/world/biorhythm";
import { DEVICES } from "@/lib/world/content/devices";
import { initialState, power } from "@/lib/world/game";
import type { WorldState } from "@/lib/world/types";

beforeAll(() => {
  // jsdom has no canvas: ItemIcon then simply skips painting.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

function makeApi(setup?: (s: WorldState) => void): { api: WorldApi; state: WorldState } {
  const state = initialState();
  state.floor = 4;
  bioActivate(state);
  setup?.(state);
  const api: WorldApi = {
    get: () => state,
    act: (fn) => fn(state),
    toast: vi.fn(),
    version: 0,
    sound: vi.fn(),
  };
  return { api, state };
}

function powerUp(s: WorldState): void {
  for (const d of DEVICES.filter((x) => x.power < 0)) {
    if (power(s).generation >= 50) return;
    s.built[d.id] = d.stages.length;
    s.discovered[d.id] = true;
    s.switchedOn[d.id] = true;
  }
}

describe("BioHud", () => {
  it("renders nothing before the rhythm starts or when switched off", () => {
    const s = initialState();
    const { container, rerender } = render(
      <BioHud getState={() => s} mode="normal" hud="full" onOpen={() => undefined} />,
    );
    expect(container.innerHTML).toBe("");
    const { state } = makeApi();
    rerender(<BioHud getState={() => state} mode="off" hud="full" onOpen={() => undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows four meters (full), bars only (compact), a chip only when low (minimal)", () => {
    const { state } = makeApi();
    const onOpen = vi.fn();
    const { container, rerender } = render(
      <BioHud getState={() => state} mode="normal" hud="full" onOpen={onOpen} />,
    );
    expect(screen.getAllByRole("progressbar")).toHaveLength(4);
    expect(container.querySelector("[data-bio-hud='full']")).not.toBeNull();
    fireEvent.click(container.querySelector("button")!);
    expect(onOpen).toHaveBeenCalled();
    rerender(<BioHud getState={() => state} mode="normal" hud="compact" onOpen={onOpen} />);
    expect(container.querySelector("[data-bio-hud='compact']")).not.toBeNull();
    rerender(<BioHud getState={() => state} mode="normal" hud="minimal" onOpen={onOpen} />);
    expect(container.innerHTML).toBe("");
    state.counters.bio_drink = 5;
    rerender(<BioHud getState={() => state} mode="relaxed" hud="minimal" onOpen={onOpen} />);
    expect(container.querySelector("[data-bio-hud='minimal']")?.textContent).toContain("Worn out");
  });
});

describe("Bio panel", () => {
  it("lists the four needs with trends, the effect and tips", () => {
    const { api, state } = makeApi((s) => {
      s.counters.bio_food = 30;
      s.counters["bio_inv:naehrriegel"] = 2;
    });
    render(<BioPanel api={api} mode="normal" onClose={() => undefined} />);
    expect(screen.getByRole("dialog", { name: "Biorhythm" })).toBeTruthy();
    expect(screen.getAllByRole("progressbar")).toHaveLength(4);
    expect(screen.getAllByText(/per minute/).length).toBe(4);
    expect(screen.getByText(/nutrient bar from the replicator/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Eat" }));
    expect(bioValue(state, "food")).toBe(65);
    expect(bagCount(state, "naehrriegel")).toBe(1);
    expect(api.toast).toHaveBeenCalledWith(expect.stringContaining("+35"), "good", "naehrriegel");
  });
});

describe("stations", () => {
  it("replicator prints into the bag", () => {
    const { api, state } = makeApi(powerUp);
    render(
      <BioStationPanel
        api={api}
        station="replicator"
        mode="normal"
        onClose={() => undefined}
        onSleep={() => undefined}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Print" })[1]!);
    expect(bagCount(state, "wasserflasche")).toBe(1);
  });

  it("fridge stores and serves fresh, with the lasagne line on first open", () => {
    const { api, state } = makeApi((s) => {
      s.counters["bio_inv:wasserflasche"] = 1;
      s.counters.bio_drink = 10;
    });
    const { rerender } = render(
      <BioStationPanel
        api={api}
        station="fridge"
        mode="normal"
        first
        onClose={() => undefined}
        onSleep={() => undefined}
      />,
    );
    expect(screen.getByText(/lasagne stays/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Store" }));
    expect(fridgeCount(state, "wasserflasche")).toBe(1);
    rerender(
      <BioStationPanel
        api={{ ...api, version: 1 }}
        station="fridge"
        mode="normal"
        onClose={() => undefined}
        onSleep={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Drink" }));
    expect(bioValue(state, "drink")).toBe(60);
  });

  it("bed offers sleep only when tired; ergometer trains", () => {
    const onSleep = vi.fn();
    const { api, state } = makeApi();
    const { rerender } = render(
      <BioStationPanel
        api={api}
        station="bed"
        mode="normal"
        onClose={() => undefined}
        onSleep={onSleep}
      />,
    );
    const btn = screen.getByRole("button", { name: "Sleep" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    state.counters.bio_rest = 40;
    rerender(
      <BioStationPanel
        api={{ ...api, version: 1 }}
        station="bed"
        mode="normal"
        onClose={() => undefined}
        onSleep={onSleep}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sleep" }));
    expect(onSleep).toHaveBeenCalled();
    rerender(
      <BioStationPanel
        api={{ ...api, version: 2 }}
        station="trainer"
        mode="normal"
        onClose={() => undefined}
        onSleep={onSleep}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Train" }));
    expect(bioValue(state, "fit")).toBe(65);
  });
});

describe("provisions", () => {
  it("the inventory shows carried provisions (never in the item grid)", () => {
    const { api } = makeApi((s) => {
      s.counters["bio_inv:protein_shake"] = 1;
    });
    const { container } = render(<InventoryPanel api={api} onClose={() => undefined} />);
    expect(container.querySelector("[data-provisions]")).not.toBeNull();
    expect(screen.getByText("Protein Shake")).toBeTruthy();
  });

  it("renders nothing without provisions", () => {
    const { api } = makeApi();
    const { container } = render(<ProvisionList api={api} />);
    expect(container.innerHTML).toBe("");
  });

  it("formats gains", () => {
    expect(gainText({ food: 35, drink: -5 })).toBe("+35 Satiation, −5 Hydration");
  });
});
