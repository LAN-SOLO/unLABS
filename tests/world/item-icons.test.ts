import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ItemIcon } from "@/components/world/ItemIcon";
import { InventoryPanel, WorkbenchPanel, type WorldApi } from "@/components/world/panels";
import { ItemChip, ItemTile } from "@/components/world/ui";
import { bakeIsoSprite } from "@/lib/voxel/iso-baker";
import { combine } from "@/lib/world/combine";
import { ITEMS, ITEM_BY_ID } from "@/lib/world/content/items";
import { LAB_PALETTE } from "@/lib/world/content/palette";
import { addItem, initialState } from "@/lib/world/game";
import {
  AUTHORED_ICON_IDS,
  finishIcon,
  ICON_MAX,
  itemIconModel,
  prototypeIconModel,
} from "@/lib/world/models/items";
import { traits } from "@/lib/world/traits";
import { TRAIT_AXES, type ItemDef, type WorldState } from "@/lib/world/types";

function proto(over: Partial<ItemDef> = {}): ItemDef {
  return {
    id: "p_test0001",
    name: "Test-Prototyp",
    kind: "prototyp",
    description: "Test",
    traits: traits({ energie: 4 }),
    color: "gelb",
    volatility: 1,
    depth: 1,
    parents: ["kondensator", "kupferspule"],
    ...over,
  };
}

describe("item icon models", () => {
  it("every authored item has a hand-built icon within the size limit", () => {
    for (const def of ITEMS) {
      expect(AUTHORED_ICON_IDS.has(def.id), def.id).toBe(true);
      const m = itemIconModel(def);
      expect(Math.max(m.w, m.h, m.d), def.id).toBeLessThanOrEqual(ICON_MAX);
      expect(m.grid.count(), def.id).toBeGreaterThan(20);
      const sprite = bakeIsoSprite(m.grid, LAB_PALETTE, { scale: 2 });
      let opaque = 0;
      for (let i = 3; i < sprite.data.length; i += 4) if (sprite.data[i]! > 0) opaque++;
      expect(opaque, def.id).toBeGreaterThan(40);
    }
  });

  it("authored icons are distinct from each other", () => {
    const seen = new Map<string, string>();
    for (const def of ITEMS) {
      const sig = Array.from(itemIconModel(def).grid.data).join(",");
      expect(seen.get(sig), `${def.id} duplicates ${seen.get(sig)}`).toBeUndefined();
      seen.set(sig, def.id);
    }
  });

  it("the finishing pass highlights metal rims without adding voxels", () => {
    const raw = prototypeIconModel(proto({ traits: traits({ mechanik: 6 }) }));
    const before = raw.grid.count();
    const data = Array.from(raw.grid.data);
    const done = finishIcon(raw);
    expect(done.grid.count()).toBe(before);
    expect(Array.from(done.grid.data)).not.toEqual(data);
    data.forEach((v, i) => expect(Boolean(done.grid.data[i]), `voxel ${i}`).toBe(v > 0));
  });

  it("prototype icons are deterministic", () => {
    const gen: Record<string, ItemDef> = {};
    const r = combine({ kupferspule: 1, kondensator: 1 }, gen);
    expect(r.kind).toBe("prototype");
    const def = r.output!;
    const a = prototypeIconModel(def).grid.data;
    const b = prototypeIconModel({ ...def }).grid.data;
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(itemIconModel(def).grid.count()).toBeGreaterThan(20);
  });

  it("prototype icons vary with the dominant traits", () => {
    const sigs = new Set<string>();
    for (const axis of TRAIT_AXES) {
      const m = prototypeIconModel(proto({ traits: traits({ [axis]: 6, daten: 1 }) }));
      expect(Math.max(m.w, m.h, m.d)).toBeLessThanOrEqual(ICON_MAX);
      sigs.add(Array.from(m.grid.data).join(","));
    }
    expect(sigs.size).toBe(TRAIT_AXES.length);
  });

  it("volatility adds glow and depth adds rings", () => {
    const calm = prototypeIconModel(proto());
    const hot = prototypeIconModel(proto({ volatility: 5 }));
    expect(Array.from(hot.grid.data)).not.toEqual(Array.from(calm.grid.data));
    const deep = prototypeIconModel(proto({ depth: 4 }));
    expect(deep.grid.count()).toBeGreaterThan(calm.grid.count());
  });

  it("colour follows the spectrum colour", () => {
    const a = prototypeIconModel(proto({ color: "gelb" }));
    const b = prototypeIconModel(proto({ color: "blau" }));
    expect(Array.from(a.grid.data)).not.toEqual(Array.from(b.grid.data));
  });
});

describe("ItemIcon + UI", () => {
  const putImageData = vi.fn();
  beforeEach(() => {
    putImageData.mockClear();
    const fake = {
      createImageData: (w: number, h: number) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData,
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      fake as unknown as CanvasRenderingContext2D,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders and paints a baked sprite", () => {
    const def = ITEM_BY_ID.get("abstractum")!;
    render(createElement(ItemIcon, { item: def, size: 48 }));
    const icon = screen.getByRole("img", { name: "Abstractum" });
    expect(icon.querySelector("canvas")).not.toBeNull();
    expect(putImageData).toHaveBeenCalled();
  });

  it("renders without a canvas context (jsdom default)", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(createElement(ItemIcon, { item: proto({ volatility: 4 }), size: 32 }));
    expect(screen.getByRole("img", { name: "Test-Prototyp" })).toBeInTheDocument();
  });

  it("ItemChip and ItemTile show name, count and click", () => {
    const def = ITEM_BY_ID.get("kondensator")!;
    const onClick = vi.fn();
    render(createElement(ItemChip, { item: def, count: 3, onClick }));
    expect(screen.getByText("×3")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Capacitor"));
    expect(onClick).toHaveBeenCalled();
    render(createElement(ItemTile, { item: def, count: 7 }));
    expect(screen.getByRole("button", { name: "Capacitor, 7 pcs" })).toBeInTheDocument();
  });
});

describe("inventory + workbench panels", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => vi.restoreAllMocks());

  function makeApi(): { api: WorldApi; state: WorldState } {
    const state = initialState();
    for (const id of ["kupferspule", "magnet", "kondensator", "abstractum", "kristall_0089"])
      addItem(state, id, 2);
    const api: WorldApi = {
      get: () => state,
      act: (fn) => fn(state),
      toast: vi.fn(),
      version: 0,
      sound: vi.fn(),
    };
    return { api, state };
  }

  it("inventory filters by category and search", () => {
    const { api } = makeApi();
    render(createElement(InventoryPanel, { api, onClose: () => {} }));
    expect(screen.getByRole("button", { name: "Abstractum, 2 pcs" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Relics/ }));
    expect(screen.queryByRole("button", { name: "Abstractum, 2 pcs" })).toBeNull();
    expect(screen.getByRole("button", { name: "Crystal #0089, 2 pcs" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /All/ }));
    fireEvent.change(screen.getByLabelText("Search the inventory"), {
      target: { value: "magnet" },
    });
    expect(screen.getByRole("button", { name: "Neodymium Magnet, 2 pcs" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Capacitor, 2 pcs" })).toBeNull();
  });

  it("workbench combines a recipe, reveals it and records history", () => {
    const { api, state } = makeApi();
    render(createElement(WorkbenchPanel, { api, onClose: () => {} }));
    const protectedTile = screen.getByRole("button", { name: "Crystal #0089, 2 pcs" });
    fireEvent.click(protectedTile);
    expect(screen.getAllByText("empty").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Copper Coil, 2 pcs" }));
    fireEvent.click(screen.getByRole("button", { name: "Neodymium Magnet, 2 pcs" }));
    expect(screen.getByText(/Slot traits/)).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Combine" }));
    });
    expect(state.inventory.induktor).toBe(1);
    expect(api.sound).toHaveBeenCalledWith("combine");
    expect(screen.getByText("Recent combinations")).toBeInTheDocument();
    expect(screen.getAllByText(/Inductor/).length).toBeGreaterThan(0);
  });
});
