import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DevicePanel,
  InventoryPanel,
  PrototypeUse,
  WorkbenchPanel,
  runPrototypeUse,
  type WorldApi,
} from "@/components/world/panels";
import { Codex } from "@/components/world/Codex";
import { ACHIEVEMENT_BY_ID, evaluateAchievements, isUnlocked } from "@/lib/world/achievements";
import { ARCHETYPES, archetypeFlag } from "@/lib/world/combine";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import {
  addItem,
  count,
  doCombine,
  initialState,
  protoEffectFlag,
  prototypeUseOptions,
} from "@/lib/world/game";
import { traits } from "@/lib/world/traits";
import type { ItemDef, Traits, WorldState } from "@/lib/world/types";

function giveProto(
  s: WorldState,
  id: string,
  t: Partial<Traits>,
  extra: Partial<ItemDef> = {},
): ItemDef {
  const def: ItemDef = {
    id,
    name: `Testprototyp ${id}`,
    kind: "prototyp",
    traits: traits(t),
    color: "blau",
    volatility: 2,
    depth: 1,
    parents: ["linse", "linse"],
    description: "Test",
    ...extra,
  };
  s.generated[id] = def;
  addItem(s, id, 1);
  return def;
}

function build(s: WorldState, id: string): void {
  s.built[id] = DEVICE_BY_ID.get(id)!.stages.length;
  s.discovered[id] = true;
}

function makeApi(state: WorldState): WorldApi & { toast: ReturnType<typeof vi.fn> } {
  return {
    get: () => state,
    act: (fn) => fn(state),
    toast: vi.fn(),
    version: 0,
    sound: vi.fn(),
  };
}

const toasts = (api: { toast: ReturnType<typeof vi.fn> }): string[] =>
  api.toast.mock.calls.map((c: unknown[]) => String(c[0]));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => vi.restoreAllMocks());

describe("PrototypeUse picker", () => {
  it("renders nothing when no carried prototype would do anything", () => {
    const s = initialState();
    build(s, "CLK-001");
    const { container } = render(<PrototypeUse api={makeApi(s)} target="CLK-001" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists matching prototypes with preview and consumption, and applies one", () => {
    const s = initialState();
    build(s, "CLK-001");
    giveProto(s, "p_akku", { energie: 8 });
    const api = makeApi(s);
    render(<PrototypeUse api={api} target="CLK-001" />);
    fireEvent.click(screen.getByRole("button", { name: /Use with prototype/ }));
    const opt = screen.getByRole("button", { name: /Testprototyp p_akku/ });
    expect(opt).toHaveTextContent(/Charge/);
    expect(opt).toHaveTextContent(/Charge buffer/);
    expect(opt).toHaveTextContent(/will be used up/);
    fireEvent.click(opt);
    expect(count(s, "p_akku")).toBe(0);
    expect(s.flags[protoEffectFlag("ladung")]).toBe(true);
    expect(toasts(api)).toContain("New effect discovered: Charge");
    expect(api.sound).toHaveBeenCalledWith("device_on");
  });

  it("runPrototypeUse reports a failed use without consuming", () => {
    const s = initialState();
    build(s, "CLK-001");
    giveProto(s, "p_akku", { energie: 8 });
    const api = makeApi(s);
    const opt = prototypeUseOptions(s, "CLK-001")[0]!;
    expect(runPrototypeUse(api, "CLK-001", opt).ok).toBe(true);
    giveProto(s, "p_akku2", { energie: 8 });
    const again = runPrototypeUse(api, "CLK-001", { ...opt, protoId: "p_akku2" });
    expect(again.ok).toBe(false);
    expect(count(s, "p_akku2")).toBe(1);
    expect(api.sound).toHaveBeenCalledWith("fail_buzz");
  });

  it("DevicePanel hands the use to the host handler", () => {
    const s = initialState();
    build(s, "CLK-001");
    s.switchedOn["CLK-001"] = true;
    giveProto(s, "p_akku", { energie: 8 });
    const api = makeApi(s);
    const onProto = vi.fn((target: string, o: Parameters<typeof runPrototypeUse>[2]) =>
      runPrototypeUse(api, target, o),
    );
    render(
      <DevicePanel
        id="CLK-001"
        api={api}
        onClose={() => {}}
        openPuzzle={() => {}}
        onTalk={() => {}}
        onWorkbench={() => {}}
        onInventory={() => {}}
        onEnding={() => {}}
        onPower={() => {}}
        onProto={onProto}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Use with prototype/ }));
    fireEvent.click(screen.getByRole("button", { name: /Testprototyp p_akku/ }));
    expect(onProto).toHaveBeenCalledWith("CLK-001", expect.objectContaining({ family: "ladung" }));
    expect(count(s, "p_akku")).toBe(0);
  });

  it("InventoryPanel: Kühlung calms the selected prototype", () => {
    const s = initialState();
    giveProto(s, "p_wild", { energie: 7 }, { volatility: 4, name: "Wilder Test" });
    giveProto(s, "p_kalt", { thermik: 7 }, { name: "Kalter Test" });
    const api = makeApi(s);
    render(<InventoryPanel api={api} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Wilder Test/ }));
    expect(screen.getAllByText(/Good for/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Use with prototype/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kalter Test.*Cooling/ }));
    expect(s.generated.p_wild!.volatility).toBe(3);
    expect(count(s, "p_kalt")).toBe(0);
  });
});

describe("Workbench: archetypes", () => {
  it("announces a new archetype and what it is good for", () => {
    const s = initialState();
    addItem(s, "abstractum", 1);
    addItem(s, "exotische_materie", 2);
    const api = makeApi(s);
    render(<WorkbenchPanel api={api} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^Abstractum, \d+ pcs?/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Exotic Matter, \d+ pcs?/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Exotic Matter, \d+ pcs?/ }));
    // Undiscovered: the preview only teases it.
    expect(screen.getByText(/Archetype: \?\?\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Combine" }));
    expect(toasts(api)).toContain("Archetype discovered: Pocket Singularity");
    expect(toasts(api).some((t) => t.startsWith("Good for:"))).toBe(true);
    expect(screen.getAllByText(/Pocket Singularity/).length).toBeGreaterThan(0);
  });
});

describe("Codex sandbox chapters", () => {
  it("lists archetypes (??? until built) and effect families", () => {
    const s = initialState();
    s.flags[archetypeFlag("singularitaet")] = true;
    s.flags[protoEffectFlag("ladung")] = true;
    render(<Codex state={s} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: /Archetypes/ }));
    const list = screen.getByRole("list", { name: "Entries" });
    expect(within(list).getAllByRole("button")).toHaveLength(ARCHETYPES.length);
    expect(within(list).getByText(/Pocket Singularity/)).toBeInTheDocument();
    expect(within(list).getAllByText(/\?\?\?/)).toHaveLength(ARCHETYPES.length - 1);
    fireEvent.click(screen.getByRole("tab", { name: /Prototype effects/ }));
    const list2 = screen.getByRole("list", { name: "Entries" });
    fireEvent.click(within(list2).getByText("Charge"));
    expect(screen.getAllByText(/used/).length).toBeGreaterThan(0);
  });
});

describe("archetype achievements", () => {
  it("unlock from the archetype counter", () => {
    expect(ACHIEVEMENT_BY_ID.has("archetyp")).toBe(true);
    expect(ACHIEVEMENT_BY_ID.has("artenkunde")).toBe(true);
    const s = initialState();
    addItem(s, "abstractum", 1);
    addItem(s, "exotische_materie", 2);
    doCombine(s, { abstractum: 1, exotische_materie: 2 });
    evaluateAchievements(s);
    expect(isUnlocked(s, "archetyp")).toBe(true);
    expect(isUnlocked(s, "artenkunde")).toBe(false);
    s.counters.archetypes = 6;
    evaluateAchievements(s);
    expect(isUnlocked(s, "artenkunde")).toBe(true);
  });
});
