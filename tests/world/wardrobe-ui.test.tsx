/**
 * Character menu (components/world/wardrobe) — wardrobe, outfits,
 * collection and replicator pages against a live world state.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldApi } from "@/components/world/panels";
import { CharacterMenu, type CharacterTab } from "@/components/world/wardrobe/CharacterMenu";
import { PauseMenu } from "@/components/world/menu";
import { addItem, initialState } from "@/lib/world/game";
import { grantWear, wardrobeTick } from "@/lib/world/wardrobe";
import { _resetSettingsCache } from "@/lib/world/settings";
import type { WorldState } from "@/lib/world/types";

beforeEach(() => {
  localStorage.clear();
  _resetSettingsCache();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => vi.restoreAllMocks());

/** Renders the menu with an api whose `act` re-renders (like useWorld). */
function Harness({
  state,
  toast,
  atWardrobe = false,
  atReplicator = false,
  tab,
  onClose = () => undefined,
}: {
  state: WorldState;
  toast: WorldApi["toast"];
  atWardrobe?: boolean;
  atReplicator?: boolean;
  tab?: CharacterTab;
  onClose?: () => void;
}) {
  const [version, setVersion] = useState(0);
  const api: WorldApi = {
    get: () => state,
    act: (fn) => {
      const r = fn(state);
      setVersion((v) => v + 1);
      return r;
    },
    toast,
    version,
    sound: vi.fn(),
  };
  return (
    <CharacterMenu
      api={api}
      atWardrobe={atWardrobe}
      atReplicator={atReplicator}
      {...(tab ? { initialTab: tab } : {})}
      onClose={onClose}
    />
  );
}

function setup(opts: Partial<Parameters<typeof Harness>[0]> = {}, prep?: (s: WorldState) => void) {
  const state = initialState();
  prep?.(state);
  const toast = vi.fn();
  const view = render(<Harness state={state} toast={toast} {...opts} />);
  return { state, toast, view };
}

const piece = (id: string) => document.querySelector<HTMLElement>(`[data-piece="${id}"]`)!;
const slotTab = (id: string) => document.querySelector<HTMLElement>(`[data-slot="${id}"]`)!;

describe("character menu — wardrobe", () => {
  it("marks the first open and shows Jade with every clothes slot", () => {
    const { state } = setup();
    expect(state.flags.used_wardrobe_menu).toBe(true);
    expect(screen.getByRole("dialog", { name: "Character" })).toBeTruthy();
    expect(document.querySelector("[data-jade-preview]")).toBeTruthy();
    for (const id of ["top", "outer", "legs", "feet", "hair"]) expect(slotTab(id)).toBeTruthy();
  });

  it("locks clothes away from the wardrobe, with the explanation", () => {
    const { state } = setup();
    expect(
      screen.getAllByText(/changed at the wardrobe in Jade's quarters/).length,
    ).toBeGreaterThan(0);
    fireEvent.click(piece("turtleneck"));
    expect(state.wardrobe.look.top?.item).toBe("shirt_collar_geo");
    expect(screen.getByRole("status").textContent).toMatch(/wardrobe/);
  });

  it("changes gear anywhere and takes optional pieces off", () => {
    const { state } = setup();
    fireEvent.click(screen.getByRole("tab", { name: "Gadgets" }));
    fireEvent.click(slotTab("face"));
    fireEvent.click(piece("safety_glasses"));
    expect(state.wardrobe.look.face?.item).toBe("safety_glasses");
    fireEvent.click(piece("none"));
    expect(state.wardrobe.look.face).toBeNull();
    expect(state.counters.wear_changes).toBe(2);
  });

  it("at the wardrobe: hover previews, click puts on, colours switch", () => {
    const { state } = setup({ atWardrobe: true });
    const before = document.querySelector("[data-jade-preview]")!.getAttribute("data-jade-preview");
    fireEvent.mouseEnter(piece("turtleneck"));
    const hovered = document
      .querySelector("[data-jade-preview]")!
      .getAttribute("data-jade-preview");
    expect(hovered).not.toBe(before);
    expect(state.wardrobe.look.top?.item).toBe("shirt_collar_geo");
    fireEvent.click(piece("turtleneck"));
    expect(state.wardrobe.look.top?.item).toBe("turtleneck");
    fireEvent.click(document.querySelector('[data-colorway="navy"]')!);
    expect(state.wardrobe.look.top).toEqual({ item: "turtleneck", colorway: "navy" });
  });

  it("shows undyed colours as locked and does not put them on", () => {
    const { state } = setup({ atWardrobe: true });
    fireEvent.click(slotTab("outer"));
    fireEvent.mouseEnter(piece("labcoat"));
    const black = document.querySelector<HTMLElement>('[data-colorway="black"]')!;
    expect(black.getAttribute("aria-label")).toMatch(/dye at the replicator/);
    fireEvent.click(black);
    expect(state.wardrobe.look.outer?.colorway).toBe("white");
  });

  it("marks new pieces until they were looked at", () => {
    const { state } = setup({ atWardrobe: true }, (s) => grantWear(s, "flannel", "find"));
    expect(within(piece("flannel")).getByText("new")).toBeTruthy();
    fireEvent.focus(piece("flannel"));
    expect(state.wardrobe.seen.flannel).toBe(true);
  });

  it("“Surprise me” only rolls owned pieces", () => {
    const { state } = setup({ atWardrobe: true });
    fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));
    for (const e of Object.values(state.wardrobe.look))
      if (e) expect(state.wardrobe.owned[e.item], e.item).toBe(true);
  });
});

describe("character menu — outfits and collection", () => {
  it("saves an outfit and puts it back on", () => {
    const { state } = setup({ atWardrobe: true, tab: "outfits" });
    const card = document.querySelector<HTMLElement>('[data-preset="0"]')!;
    fireEvent.change(within(card).getByRole("textbox"), { target: { value: "Monday" } });
    fireEvent.click(within(card).getByRole("button", { name: "Save look" }));
    expect(state.wardrobe.presets[0]?.name).toBe("Monday");
    state.wardrobe.look.top = { item: "turtleneck", colorway: "black" };
    fireEvent.click(within(card).getByRole("button", { name: "Put on" }));
    expect(state.wardrobe.look.top?.item).toBe("shirt_collar_geo");
  });

  it("hides unfound pieces behind their hint", () => {
    setup({ tab: "collection" });
    const cap = document.querySelector<HTMLElement>('[data-collection-item="propeller_cap"]')!;
    expect(cap.textContent).toMatch(/\?\?\?/);
    expect(cap.textContent).toMatch(/propeller/);
    const hoodie = document.querySelector<HTMLElement>('[data-collection-item="hoodie"]')!;
    expect(hoodie.textContent).toMatch(/Replicator:/);
  });
});

describe("character menu — replicator", () => {
  const powered = (s: WorldState) => {
    s.built["UEC-001"] = 3;
    s.switchedOn["UEC-001"] = true;
  };

  it("shows Jade's intro once, highlights missing resources and starts a job", () => {
    const { state, toast } = setup(
      { atWardrobe: true, atReplicator: true, tab: "replicator" },
      (s) => {
        powered(s);
        addItem(s, "stoffreste", 1);
      },
    );
    expect(screen.getByText(/taped to the gantry/)).toBeTruthy();
    expect(state.flags.ndl_intro_seen).toBe(true);
    const scarf = document.querySelector<HTMLElement>('[data-pattern="scarf"]')!;
    expect(scarf.getAttribute("data-state")).toBe("missing");
    expect(scarf.querySelector('[data-missing="true"]')).toBeTruthy();
    const gloves = document.querySelector<HTMLElement>('[data-pattern="fingerless"]')!;
    fireEvent.click(within(gloves).getByRole("button", { name: "Fabricate" }));
    expect(state.wardrobe.job?.id).toBe("fingerless");
    expect(toast).toHaveBeenCalled();
    expect(screen.getByRole("progressbar", { name: "Replicator job progress" })).toBeTruthy();
    // Locked patterns keep their hint.
    const cape = document.querySelector<HTMLElement>('[data-pattern="cape"]')!;
    expect(cape.textContent).toMatch(/ending/);
  });

  it("is read-only away from Needle's Eye", () => {
    const { state } = setup({ tab: "replicator" }, (s) => {
      powered(s);
      addItem(s, "stoffreste", 4);
    });
    expect(screen.getByText("Only at Needle's Eye in Jade's quarters.")).toBeTruthy();
    const gloves = document.querySelector<HTMLElement>('[data-pattern="fingerless"]')!;
    const btn = within(gloves).getByRole("button", { name: "Fabricate" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    act(() => btn.click());
    expect(state.wardrobe.job).toBeNull();
  });
});

describe("pause menu", () => {
  it("offers the character menu", () => {
    const onCharacter = vi.fn();
    render(
      <PauseMenu
        getState={initialState}
        onResume={vi.fn()}
        onLoad={vi.fn()}
        onMainMenu={vi.fn()}
        onTerminal={vi.fn()}
        onHelp={vi.fn()}
        onCharacter={onCharacter}
      />,
    );
    fireEvent.click(screen.getByText("Character"));
    expect(onCharacter).toHaveBeenCalled();
  });
});

describe("character menu — looks", () => {
  const look = (id: string) => document.querySelector<HTMLElement>(`[data-look="${id}"]`)!;
  const wearBtn = () => screen.getByRole("button", { name: "Wear this look" }) as HTMLButtonElement;

  it("lists all eighteen looks; locked ones with a hint, the secret one hidden", () => {
    const { state } = setup({ tab: "looks" }, (s) => void wardrobeTick(s));
    expect(document.querySelectorAll("[data-look]")).toHaveLength(18);
    expect(state.flags.used_looks_tab).toBe(true);
    expect(look("weekend").textContent).toMatch(/Weekend/);
    expect(look("gala_night").textContent).toMatch(/Still missing/);
    expect(look("night_shift").textContent).toMatch(/Replicate/);
    expect(look("crystal_0089").textContent).toMatch(/\?\?\? — a secret look/);
    expect(look("crystal_0089").textContent).not.toMatch(/Crystal #0089/);
    fireEvent.click(look("gala_night"));
    expect(wearBtn().disabled).toBe(true);
  });

  it("puts a whole look on at the wardrobe", () => {
    const { state } = setup({ tab: "looks", atWardrobe: true }, (s) => void wardrobeTick(s));
    fireEvent.click(look("weekend"));
    fireEvent.click(wearBtn());
    expect(state.wardrobe.look.top?.item).toBe("tee_unlab");
    expect(state.wardrobe.look.outer).toBeNull();
    expect(state.wardrobe.looksWorn.weekend).toBe(true);
    expect(screen.getByRole("status").textContent).toMatch(/Weekend/);
  });

  it("away from the wardrobe explains that the clothes wait there", () => {
    const { state } = setup({ tab: "looks" }, (s) => void wardrobeTick(s));
    fireEvent.click(look("weekend"));
    expect(screen.getAllByText(/Away from the wardrobe only gadgets/).length).toBeGreaterThan(0);
    fireEvent.click(wearBtn());
    expect(state.wardrobe.look.belt).toBeNull();
    expect(state.wardrobe.look.top?.item).toBe("shirt_collar_geo");
    expect(screen.getByRole("status").textContent).toMatch(/clothes wait at the wardrobe/);
    // The lab look only adds gadgets to the first-day clothes: it goes on anywhere.
    fireEvent.click(look("lab_lead"));
    fireEvent.click(wearBtn());
    expect(state.wardrobe.look.head?.item).toBe("goggles_amber");
    expect(state.wardrobe.look.hands?.item).toBe("nitrile");
    expect(state.wardrobe.looksWorn.lab_lead).toBe(true);
  });
});
