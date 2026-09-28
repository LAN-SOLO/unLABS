import { describe, expect, it } from "vitest";
import { salvageInfo } from "@/components/world/panels/derive";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { BOT_QUESTS, ENDINGS } from "@/lib/world/content/story";
import { PROTECTED_ITEMS, RECIPES, comboKey } from "@/lib/world/content/items";
import {
  disassemble,
  hint,
  initialState,
  missingParts,
  power,
  recipeChain,
} from "@/lib/world/game";
import { DE } from "@/lib/i18n/de";
import type { WorldState } from "@/lib/world/types";

function build(s: WorldState, id: string, on = true): void {
  s.built[id] = DEVICE_BY_ID.get(id)!.stages.length;
  s.discovered[id] = true;
  s.switchedOn[id] = on;
}

describe("protected items cannot be disassembled", () => {
  it("the Anomalous Core stays whole with BTK-001 online", () => {
    const s = initialState();
    s.flags.geo_routed = true;
    build(s, "BTK-001");
    s.inventory.anomaler_kern = 1;
    const r = disassemble(s, "anomaler_kern");
    expect(r.ok).toBe(false);
    expect(r.returned).toEqual([]);
    expect(r.message).toContain("one of a kind");
    expect(s.inventory.anomaler_kern).toBe(1);
    expect(s.inventory.energiezelle ?? 0).toBe(0);
    expect(s.inventory.halo_kristall ?? 0).toBe(0);
  });

  it("no protected item is ever offered or accepted for salvage", () => {
    const s = initialState();
    s.flags.geo_routed = true;
    build(s, "BTK-001");
    for (const id of PROTECTED_ITEMS) {
      s.inventory[id] = 1;
      const info = salvageInfo(s, id);
      expect(info.ok, id).toBe(false);
      expect(info.returns, id).toEqual([]);
      expect(disassemble(s, id).ok, id).toBe(false);
      expect(s.inventory[id], id).toBe(1);
    }
  });
});

describe("recipeChain hides undiscovered secret recipes", () => {
  const secret = RECIPES.find((r) => r.secret && r.output === "halo_kristall")!;

  it("a secret recipe is only listed once it is known", () => {
    const s = initialState();
    const has = () => recipeChain("halo_kristall", s).some((l) => l.item === "halo_kristall");
    expect(has()).toBe(false);
    s.recipesKnown[comboKey(secret.inputs)] = secret.output;
    expect(has()).toBe(true);
  });

  it("without a state every recipe is listed (codex behaviour)", () => {
    expect(recipeChain("halo_kristall").some((l) => l.item === "halo_kristall")).toBe(true);
  });

  it("no chain from missingParts leaks an unknown secret recipe", () => {
    const s = initialState();
    for (const d of DEVICES) s.discovered[d.id] = true;
    const secretOutputs = new Set(
      RECIPES.filter(
        (r) => r.secret && !RECIPES.some((o) => !o.secret && o.output === r.output),
      ).map((r) => r.output),
    );
    for (const d of DEVICES)
      for (const part of missingParts(s, d.id))
        for (const line of part.chain) expect(secretOutputs.has(line.item), line.text).toBe(false);
  });
});

describe("hint() about the remaining paths", () => {
  function lateGame(remaining: number): WorldState {
    const s = initialState();
    for (const d of DEVICES) build(s, d.id, false);
    for (const p of PUZZLES) s.puzzles[p.id] = true;
    for (const q of BOT_QUESTS) s.flags[q.flag] = true;
    const open = ENDINGS.filter((e) => !e.secret);
    open.slice(remaining).forEach((e) => (s.endings[e.id] = true));
    return s;
  }

  it("uses the singular for one path left", () => {
    const h = hint(lateGame(1));
    expect(h).toMatch(/^There is one path to Dr\. Fridge/);
    expect(h).not.toContain("There are 1 paths");
  });

  it("keeps the plural for several paths", () => {
    expect(hint(lateGame(2))).toMatch(/^There are 2 paths to Dr\. Fridge/);
  });

  it("both variants have German entries", () => {
    expect(DE.get("There is one path to Dr. Fridge you have not taken yet. {where}")).toBeTruthy();
    expect(DE.get("{name} is one of a kind. It does not get taken apart.")).toBeTruthy();
  });
});

describe("puzzle titles are translated", () => {
  it("every puzzle title has a German entry", () => {
    for (const p of PUZZLES) expect(DE.get(p.title), p.id).toBeTruthy();
  });
});

describe("power order: battery before MCP", () => {
  it("a battery as the only source keeps the MCP online", () => {
    const s = initialState();
    s.built["BAT-001"] = DEVICE_BY_ID.get("BAT-001")!.stages.length;
    const p = power(s);
    expect(p.online.has("BAT-001")).toBe(true);
    expect(p.online.has("MCP-000")).toBe(true);
    expect(p.starved.map((x) => x.id)).not.toContain("MCP-000");
  });
});
