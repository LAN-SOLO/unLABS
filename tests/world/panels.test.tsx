import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DevicePanel,
  InventoryPanel,
  JournalPanel,
  PowerPanel,
  WorkbenchPanel,
  type WorldApi,
} from "@/components/world/panels";
import {
  CONSUMER_PRIORITY,
  POWER_HISTORY_MAX,
  brownoutOrder,
  consumerRows,
  fillSlots,
  knownCombos,
  recipeUses,
  lightRows,
  parseComboKey,
  previewCombine,
  pushSample,
  salvageInfo,
  sortItems,
  stageUses,
  volatilityRisk,
} from "@/components/world/panels/derive";
import { panelPropsEqual, readSeen, writeSeen } from "@/components/world/panels/shared";
import { PowerGraph, _resetPowerHistory, samplePower } from "@/components/world/panels/power";
import { AchievementsPanel } from "@/components/world/AchievementsPanel";
import { Codex } from "@/components/world/Codex";
import { gridKeyNav } from "@/components/world/ui";
import { VOLATILITY_LIMIT } from "@/lib/world/combine";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ITEM_BY_ID, comboKey } from "@/lib/world/content/items";
import { ACHIEVEMENTS, achievementFlag } from "@/lib/world/achievements";
import { addItem, disassemble, doCombine, initialState, itemDef, power } from "@/lib/world/game";
import { traits } from "@/lib/world/traits";
import type { ItemDef, WorldState } from "@/lib/world/types";

function hot(id: string, volatility: number): ItemDef {
  return {
    id,
    name: `Heiß ${id}`,
    kind: "prototyp",
    description: "Test",
    traits: traits({ energie: 3 }),
    color: "rot",
    volatility,
    depth: 1,
    parents: ["kupferspule", "kondensator"],
  };
}

function build(s: WorldState, id: string, on = true): void {
  s.built[id] = DEVICE_BY_ID.get(id)!.stages.length;
  s.discovered[id] = true;
  s.switchedOn[id] = on;
}

function makeApi(setup?: (s: WorldState) => void): { api: WorldApi; state: WorldState } {
  const state = initialState();
  for (const id of ["kupferspule", "magnet", "kondensator", "abstractum", "kristall_0089"])
    addItem(state, id, 2);
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

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => vi.restoreAllMocks());

// ── Pure derivations ─────────────────────────────────────────────

describe("panel derivations", () => {
  it("sorts items by kind, name, amount, volatility and trait", () => {
    const a = ITEM_BY_ID.get("kupferspule")!;
    const b = ITEM_BY_ID.get("abstractum")!;
    const c = hot("p_hot", 5);
    const inv = { kupferspule: 1, abstractum: 9, p_hot: 3 };
    expect(sortItems([a, b, c], "name", inv).map((x) => x.id)).toEqual(
      [a, b, c].sort((x, y) => x.name.localeCompare(y.name, "de")).map((x) => x.id),
    );
    expect(sortItems([a, b, c], "menge", inv)[0]!.id).toBe("abstractum");
    expect(sortItems([a, b, c], "volatilitaet", inv)[0]!.id).toBe("p_hot");
    expect(sortItems([c, a], "art", inv)[1]!.id).toBe("p_hot");
    expect(sortItems([a, b, c], "eigenschaft", inv, "energie")[0]!.traits.energie).toBe(
      Math.max(a.traits.energie, b.traits.energie, c.traits.energie),
    );
  });

  it("previews a combination without mutating the state", () => {
    const { state } = makeApi();
    const before = JSON.stringify(state);
    const recipe = previewCombine(state, ["kupferspule", "magnet"]);
    expect(recipe.result?.kind).toBe("recipe");
    expect(recipe.safe).toBe(true);
    expect(recipe.blocked).toBeNull();
    const proto = previewCombine(state, ["kupferspule", "kondensator"]);
    expect(proto.result?.kind).toBe("prototype");
    expect(proto.result?.output?.kind).toBe("prototyp");
    expect(proto.isNew).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    // The preview equals what the real combination produces.
    const real = doCombine(state, { kupferspule: 1, kondensator: 1 });
    expect(real.output?.id).toBe(proto.result?.output?.id);
    expect(previewCombine(state, ["kupferspule", "kondensator"]).isNew).toBe(false);
  });

  it("flags explosions, protected parts and short slots", () => {
    const { state } = makeApi((s) => {
      for (const [i, v] of [5, 5, 4].entries()) {
        const def = hot(`p_hot${i}`, v);
        s.generated[def.id] = def;
        addItem(s, def.id, 1);
      }
    });
    const p = previewCombine(state, ["p_hot0", "p_hot1", "p_hot2"]);
    expect(p.volSum).toBe(14);
    expect(p.volSum).toBeGreaterThan(VOLATILITY_LIMIT);
    expect(p.result?.kind).toBe("explosion");
    expect(volatilityRisk(p.volSum)).toBe("explosion");
    expect(volatilityRisk(2)).toBe("ruhig");
    expect(previewCombine(state, ["kristall_0089", "magnet"]).blocked).toMatch(/one-of-a-kind/i);
    expect(previewCombine(state, ["magnet"]).blocked).toMatch(/two/);
  });

  it("parses combo keys and lists known combos with fill slots", () => {
    const inputs = { magnet: 1, kupferspule: 2 };
    expect(parseComboKey(comboKey(inputs))).toEqual(inputs);
    const { state } = makeApi();
    doCombine(state, { kupferspule: 1, kondensator: 1 });
    const combos = knownCombos(state);
    expect(combos.some((c) => c.source === "entdeckt")).toBe(true);
    expect(combos.some((c) => c.output?.id === "induktor")).toBe(true);
    const ok = fillSlots(state, { magnet: 1, kupferspule: 1 });
    expect("slots" in ok && ok.slots.sort()).toEqual(["kupferspule", "magnet"]);
    expect("error" in fillSlots(state, { magnet: 9 })).toBe(true);
    expect("error" in fillSlots(state, { kristall_0089: 1, magnet: 1 })).toBe(true);
  });

  it("keeps secret recipes hidden until they were combined once", () => {
    const state = initialState();
    addItem(state, "leuchtalgen", 2);
    addItem(state, "prisma", 2);
    const key = comboKey({ leuchtalgen: 1, prisma: 1 });
    expect(knownCombos(state).some((c) => c.key === key)).toBe(false);
    expect(recipeUses(state, "prisma").some((r) => r.output === "lichtleiter")).toBe(false);
    expect(doCombine(state, { leuchtalgen: 1, prisma: 1 }).ok).toBe(true);
    expect(knownCombos(state).some((c) => c.key === key && c.source === "entdeckt")).toBe(true);
    expect(recipeUses(state, "prisma").some((r) => r.output === "lichtleiter")).toBe(true);
  });

  it("salvage info mirrors disassemble", () => {
    const { state } = makeApi();
    const r = doCombine(state, { kupferspule: 1, kondensator: 1 });
    const id = r.output!.id;
    expect(salvageInfo(state, id).ok).toBe(false); // BTK-001 not built yet
    state.flags.geo_routed = true;
    build(state, "BTK-001");
    const info = salvageInfo(state, id);
    expect(info.ok).toBe(true);
    const done = disassemble(state, id);
    expect(done.returned).toEqual(info.returns);
    expect(salvageInfo(state, "abstractum").ok).toBe(false);
  });

  it("finds open build stages an item fits", () => {
    const { state } = makeApi();
    for (const d of DEVICES) state.discovered[d.id] = true;
    const withNamed = DEVICES.flatMap((d) =>
      d.stages.flatMap((st) => st.requires.filter((r) => r.item).map((r) => r.item!)),
    );
    const item = ITEM_BY_ID.get(withNamed[0]!)!;
    const uses = stageUses(state, item);
    expect(uses.length).toBeGreaterThan(0);
    expect(uses[0]!.exact).toBe(true);
    // Finished stages are skipped.
    for (const d of DEVICES) state.built[d.id] = d.stages.length;
    expect(stageUses(state, item)).toEqual([]);
  });

  it("consumer rows follow the brownout priority of power()", () => {
    const s = initialState();
    s.flags.geo_routed = true;
    for (const id of ["BTK-001", "VNT-001", "CLK-001", "PWB-001", "BAT-001"]) build(s, id);
    s.switchedOn["MCP-000"] = true;
    const p = power(s);
    const rows = consumerRows(s, p);
    const prio = rows.map((r) => CONSUMER_PRIORITY.indexOf(r.device.id));
    expect([...prio].sort((a, b) => a - b)).toEqual(prio);
    for (const r of rows) {
      expect(r.online).toBe(p.online.has(r.device.id));
      expect(r.starved).toBe(p.starved.find((x) => x.id === r.device.id)?.reason);
    }
    const order = brownoutOrder(rows);
    expect(order.every((r) => r.online)).toBe(true);
    expect(order[0]?.priority ?? 0).toBeGreaterThanOrEqual(order[order.length - 1]?.priority ?? 0);
    expect(lightRows(s, p).every((l) => typeof l.lit === "boolean")).toBe(true);
  });

  it("power history is bounded and collapses same-second samples", () => {
    let list = pushSample([], { t: 1, generation: 10, demand: 5 });
    list = pushSample(list, { t: 1, generation: 12, demand: 5 });
    expect(list).toEqual([{ t: 1, generation: 12, demand: 5 }]);
    for (let i = 2; i < POWER_HISTORY_MAX + 20; i++)
      list = pushSample(list, { t: i, generation: i, demand: 1 });
    expect(list.length).toBe(POWER_HISTORY_MAX);
    _resetPowerHistory();
    const s = initialState();
    expect(samplePower(power(s), 5000).length).toBe(1);
    expect(samplePower(power(s), 6000).length).toBe(2);
  });

  it("panel props compare api by version and ignore callbacks", () => {
    const { api } = makeApi();
    expect(
      panelPropsEqual(
        { api, onClose: () => 1, id: "a" },
        { api: { ...api }, onClose: () => 2, id: "a" },
      ),
    ).toBe(true);
    expect(panelPropsEqual({ api, id: "a" }, { api: { ...api, version: 1 }, id: "a" })).toBe(false);
    expect(panelPropsEqual({ api, id: "a" }, { api, id: "b" })).toBe(false);
  });

  it("seen markers persist per scope", () => {
    expect(readSeen("items").size).toBe(0);
    writeSeen("items", ["a", "b"]);
    writeSeen("codex", ["x"]);
    expect([...readSeen("items")].sort()).toEqual(["a", "b"]);
    expect(readSeen("codex").has("x")).toBe(true);
  });
});

// ── Workbench ────────────────────────────────────────────────────

describe("WorkbenchPanel", () => {
  it("drag & drop puts a part on the bench and previews the result", () => {
    const { api, state } = makeApi();
    render(<WorkbenchPanel api={api} onClose={() => {}} />);
    const slots = screen.getByRole("group", { name: "Slots" });
    const drop = (name: RegExp | string, target: HTMLElement) => {
      const tile = screen.getByRole("button", { name });
      fireEvent.dragStart(tile);
      fireEvent.dragOver(target);
      fireEvent.drop(target);
    };
    drop("Copper Coil, 2 pcs", within(slots).getByRole("button", { name: "Slot 1: empty" }));
    expect(screen.getByRole("button", { name: /Slot 1: Copper Coil/ })).toBeInTheDocument();
    drop("Capacitor, 2 pcs", slots);
    expect(screen.getByText(/New prototype/)).toBeInTheDocument();
    const expected = previewCombine(state, ["kupferspule", "kondensator"]).result!.output!;
    expect(screen.getAllByText(new RegExp(expected.name)).length).toBeGreaterThan(0);
    // Nothing was consumed by the preview.
    expect(state.inventory.kupferspule).toBe(2);
    // Dragging a slot back to the inventory removes it.
    const slot = screen.getByRole("button", { name: /Slot 2: Capacitor/ });
    fireEvent.dragStart(slot);
    fireEvent.drop(screen.getByRole("region", { name: "Inventory" }));
    expect(screen.getByRole("button", { name: "Slot 2: empty" })).toBeInTheDocument();
  });

  it("keyboard: Enter adds, Delete removes, the risk bar shows recipes as safe", () => {
    const { api } = makeApi();
    render(<WorkbenchPanel api={api} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Copper Coil, 2 pcs" }));
    fireEvent.click(screen.getByRole("button", { name: "Neodymium Magnet, 2 pcs" }));
    expect(screen.getByText("Recipe — safe")).toBeInTheDocument();
    expect(screen.getByText(/Standard recipe/)).toBeInTheDocument();
    const slot = screen.getByRole("button", { name: /Slot 2: Neodymium Magnet/ });
    fireEvent.keyDown(slot, { key: "Delete" });
    expect(screen.getByRole("button", { name: "Slot 2: empty" })).toBeInTheDocument();
  });

  it("known recipes fill the slots", () => {
    const { api, state } = makeApi((s) => {
      s.flags.seen_kupferspule = true;
      s.flags.seen_magnet = true;
    });
    render(<WorkbenchPanel api={api} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Load recipe for Inductor/ }));
    expect(screen.getByRole("button", { name: /Slot 1:/ })).not.toHaveAccessibleName(
      "Slot 1: empty",
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Combine" }));
    });
    expect(state.inventory.induktor).toBe(1);
  });
});

// ── Inventory ────────────────────────────────────────────────────

describe("InventoryPanel", () => {
  it("shows uses, salvage state and quick filters", () => {
    const { api, state } = makeApi();
    const r = doCombine(state, { kupferspule: 1, kondensator: 1 });
    render(<InventoryPanel api={api} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: `${r.output!.name}, 1 pc` }));
    expect(screen.getByText("Uses")).toBeInTheDocument();
    const salvage = screen.getByRole("button", { name: "Salvage (BTK-001)" });
    expect(salvage).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Volatile ≥ 3" }));
    expect(screen.queryByRole("button", { name: "Abstractum, 2 pcs" })).toBeNull();
  });

  it("marks new items until the panel was closed once", () => {
    const { api } = makeApi();
    const first = render(<InventoryPanel api={api} onClose={() => {}} />);
    expect(screen.getAllByText("new").length).toBeGreaterThan(0);
    first.unmount();
    render(<InventoryPanel api={api} onClose={() => {}} />);
    expect(screen.queryAllByText("new")).toHaveLength(0);
  });

  it("sorts by volatility", () => {
    const { api } = makeApi((s) => {
      const def = hot("p_hot", 5);
      s.generated[def.id] = def;
      addItem(s, def.id, 1);
    });
    render(<InventoryPanel api={api} onClose={() => {}} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "volatilitaet" } });
    const tiles = within(screen.getByRole("group", { name: "Items" })).getAllByRole("button");
    expect(tiles[0]).toHaveAccessibleName("Heiß p_hot, 1 pc");
  });
});

// ── Power / device / journal ─────────────────────────────────────

describe("PowerPanel", () => {
  it("lists consumers with toggles, brownout order and lights", () => {
    _resetPowerHistory();
    const { api, state } = makeApi((s) => {
      s.flags.geo_routed = true;
      build(s, "BTK-001");
      build(s, "VNT-001");
      s.switchedOn["MCP-000"] = true;
    });
    render(<PowerPanel api={api} onClose={() => {}} />);
    expect(screen.getByText(/Consumers/)).toBeInTheDocument();
    expect(screen.getByText(/First to go dark/)).toBeInTheDocument();
    expect(screen.getByText("Room lighting")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Switch off Basic Toolkit/ });
    fireEvent.click(toggle);
    expect(state.switchedOn["BTK-001"]).toBe(false);
  });

  it("graph renders polylines once there are two samples", () => {
    const { container } = render(
      <PowerGraph
        samples={[
          { t: 1, generation: 50, demand: 20 },
          { t: 2, generation: 60, demand: 30 },
        ]}
      />,
    );
    expect(container.querySelectorAll("polyline").length).toBe(3);
  });
});

describe("DevicePanel", () => {
  it("shows a stage stepper with have/need and a rotating preview", () => {
    const { api } = makeApi();
    render(
      <DevicePanel
        id="PWB-001"
        api={api}
        onClose={() => {}}
        openPuzzle={() => {}}
        onTalk={() => {}}
        onWorkbench={() => {}}
        onInventory={() => {}}
        onEnding={() => {}}
        onPower={() => {}}
      />,
    );
    // PWB-001 is not discovered in a fresh game.
    expect(screen.getByText(/blueprint is still unknown/)).toBeInTheDocument();
  });

  it("navigates stages of a known blueprint", () => {
    const { api } = makeApi((s) => {
      s.discovered["PWB-001"] = true;
    });
    render(
      <DevicePanel
        id="PWB-001"
        api={api}
        onClose={() => {}}
        openPuzzle={() => {}}
        onTalk={() => {}}
        onWorkbench={() => {}}
        onInventory={() => {}}
        onEnding={() => {}}
        onPower={() => {}}
      />,
    );
    const steps = within(screen.getByRole("list", { name: "Build stages" })).getAllByRole("button");
    expect(steps.length).toBe(DEVICE_BY_ID.get("PWB-001")!.stages.length);
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    fireEvent.click(steps[1]!);
    expect(steps[1]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("progressbar").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /Model Portable/ })).toBeInTheDocument();
  });
});

describe("JournalPanel", () => {
  it("search filters the log and progress bars are shown", () => {
    const { api, state } = makeApi();
    state.log.push({ t: 5, text: "Etwas Seltsames im Keller" });
    render(<JournalPanel api={api} onClose={() => {}} />);
    expect(screen.getByRole("progressbar", { name: /Insights/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Log/ }));
    fireEvent.change(screen.getByLabelText("Search the journal"), {
      target: { value: "seltsames" },
    });
    expect(screen.getByText(/Etwas Seltsames/)).toBeInTheDocument();
    expect(screen.queryByText(/cold start/i)).toBeNull();
  });
});

// ── Achievements / Codex ─────────────────────────────────────────

describe("AchievementsPanel + Codex", () => {
  it("marks newly unlocked achievements once and searches", () => {
    const s = initialState();
    const a = ACHIEVEMENTS.find((x) => !x.hidden)!;
    s.flags[achievementFlag(a.id)] = true;
    const first = render(<AchievementsPanel state={s} onClose={() => {}} />);
    expect(screen.getAllByText("new").length).toBe(1);
    fireEvent.change(screen.getByLabelText("Search achievements"), {
      target: { value: a.title },
    });
    expect(screen.getAllByText(new RegExp(a.title)).length).toBeGreaterThan(0);
    first.unmount();
    render(<AchievementsPanel state={s} onClose={() => {}} />);
    expect(screen.queryAllByText("new")).toHaveLength(0);
  });

  it("codex entries lose the marker once opened", () => {
    const s = initialState();
    render(<Codex state={s} onClose={() => {}} />);
    const list = screen.getByRole("list", { name: "Entries" });
    const badges = within(list).queryAllByText("new").length;
    const buttons = within(list).getAllByRole("button");
    fireEvent.click(buttons[1]!);
    expect(within(list).queryAllByText("new").length).toBeLessThanOrEqual(badges);
    expect(readSeen("codex").size).toBeGreaterThan(0);
  });
});

describe("gridKeyNav", () => {
  it("moves focus with the arrow keys", () => {
    render(
      <div role="group" aria-label="g" onKeyDown={gridKeyNav}>
        <button data-nav="">a</button>
        <button data-nav="">b</button>
        <button data-nav="">c</button>
      </div>,
    );
    const [a, b, c] = screen.getAllByRole("button");
    a!.focus();
    fireEvent.keyDown(a!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(b);
    fireEvent.keyDown(b!, { key: "End" });
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(c!, { key: "Home" });
    expect(document.activeElement).toBe(a);
  });
});

it("item defs used in tests exist", () => {
  const s = initialState();
  for (const id of ["kupferspule", "magnet", "kondensator", "abstractum", "kristall_0089"])
    expect(itemDef(s, id), id).toBeDefined();
});
