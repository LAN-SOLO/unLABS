import { describe, expect, it } from "vitest";
import { PICKUPS, SLICE_PICKUPS } from "@/lib/world/content/map";
import { BOT_QUESTS } from "@/lib/world/content/story";
import { addItem, grant, initialState, solvePuzzle } from "@/lib/world/game";
import {
  GROUP_TITLE,
  compassTarget,
  objectiveSections,
  objectives,
  questItemsInInventory,
  topObjective,
} from "@/lib/world/quests";

describe("objective tracker (Aufträge)", () => {
  it("starts with power: open the seep valve on floor −1", () => {
    const s = initialState();
    const top = topObjective(s)!;
    expect(top.id).toBe("strom_ventil");
    expect(top.text).toMatch(/Seep Valve/);
    expect(compassTarget(s)).toMatchObject({ floor: 1 });
  });

  it("moves on once the geothermal puzzles are solved", () => {
    const s = initialState();
    solvePuzzle(s, "pz_geo_valve");
    solvePuzzle(s, "pz_power_flow");
    const ids = objectives(s).map((o) => o.id);
    expect(ids).not.toContain("strom_ventil");
    expect(ids).not.toContain("strom_verteiler");
    expect(ids).toContain("geraet_UEC-001");
  });

  it("lists sleeping bots on reachable floors and drops them once awake", () => {
    const s = initialState();
    const bots = objectives(s).filter((o) => o.group === "bots");
    expect(bots.map((b) => b.id)).toContain("bot_f1ndr");
    expect(bots.map((b) => b.id)).toContain("bot_k2ldr");
    // Floor +1 needs power — its bots are not listed yet.
    expect(bots.map((b) => b.id)).not.toContain("bot_l0g1k");
    s.flags.bot_f1ndr_awake = true;
    expect(objectives(s).map((o) => o.id)).not.toContain("bot_f1ndr");
  });

  it("marks a bot quest as ready when the part is in the inventory", () => {
    const s = initialState();
    addItem(s, "speicherchip", 2);
    // The archive door is still locked (no power, no toolkit): first get in.
    const locked = objectives(s).find((o) => o.id === "bot_k2ldr")!;
    expect(locked.detail).toMatch(/Get there first/);
    s.built["BTK-001"] = 3;
    const k2 = objectives(s).find((o) => o.id === "bot_k2ldr")!;
    expect(k2.detail).toMatch(/Ready/);
    expect(questItemsInInventory(s)).toContain("speicherchip");
  });

  it("shows slice locations only after K2-LDR's catalogue", () => {
    const s = initialState();
    const before = objectives(s).filter((o) => o.group === "slices");
    expect(before).toHaveLength(1);
    expect(before[0]!.text).toMatch(/0\/30/);
    grant(s, ["k2ldr_katalog"]);
    const after = objectives(s).filter((o) => o.group === "slices");
    expect(after.length).toBeGreaterThan(1);
    const located = after.filter((o) => o.target);
    for (const o of located) {
      const p = PICKUPS.find((x) => `slice_${x.id}` === o.id)!;
      expect(SLICE_PICKUPS).toContain(p.id);
      expect(o.target!.floor).toBe(p.floor);
    }
  });

  it("lists the four ways to Damien but keeps the secret one hidden at first", () => {
    const s = initialState();
    const ways = objectives(s)
      .filter((o) => o.group === "wege")
      .map((o) => o.id);
    expect(ways).toEqual(
      expect.arrayContaining(["weg_frequenz", "weg_substrat", "weg_rueckkehr", "weg_halo"]),
    );
    expect(ways).not.toContain("weg_kristall");
    s.counters.slices = 12;
    expect(objectives(s).map((o) => o.id)).toContain("weg_kristall");
  });

  it("names locked floors with their access hint", () => {
    const s = initialState();
    const floors = objectives(s).filter((o) => o.group === "ebenen");
    expect(floors.map((f) => f.id)).toEqual(
      expect.arrayContaining(["ebene_2", "ebene_3", "ebene_4", "ebene_5"]),
    );
    expect(floors.find((f) => f.id === "ebene_5")!.detail).toMatch(/shaft/);
  });

  it("groups sections with German titles and stable order", () => {
    const s = initialState();
    const sections = objectiveSections(s);
    expect(sections.length).toBeGreaterThan(3);
    for (const sec of sections) {
      expect(sec.title).toBe(GROUP_TITLE[sec.group]);
      expect(sec.items.length).toBeGreaterThan(0);
    }
    expect(BOT_QUESTS.length).toBe(10);
  });
});
