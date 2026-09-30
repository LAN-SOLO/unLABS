/**
 * Jade's wardrobe — content (lib/world/content/wardrobe.ts + map pickups).
 *
 * Every recipe uses real, non-unique items; every unlock / reward condition
 * points at something that exists; every hidden piece has exactly one map
 * pickup (and every `wear:` pickup a piece), spread over all six levels;
 * the textile economy covers every pattern plus a dye budget — computed
 * from the sources and proven by the simulated player, who replicates
 * every craftable piece from what the lab hands out.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ITEM_BY_ID, PROTECTED_ITEMS } from "@/lib/world/content/items";
import { FLOORS, PICKUPS, PROPS, roomAt } from "@/lib/world/content/map";
import { BOT_QUESTS, ENDINGS, INSIGHT_BY_ID } from "@/lib/world/content/story";
import { SIGNATURE_LOOKS } from "@/lib/world/content/looks";
import {
  REFINE_RECIPES,
  REPLICATOR_PROP,
  TEXTILE_ITEMS,
  WEAR_BY_ID,
  WEAR_ITEMS,
  WEAR_ITEM_PREFIX,
  WEAR_SLOTS,
} from "@/lib/world/content/wardrobe";
import { PROP_VARIANT_DECOR } from "@/lib/world/content/decor-actions";
import { DECOR_BY_ID } from "@/lib/world/models/decor";
import { evalWearCond, lookUnlocked, wardrobeCounters } from "@/lib/world/wardrobe";
import type { Condition } from "@/lib/world/types";
import { explode, fullRun } from "./simCoverage";
import { step } from "./simPlayer";
import { wardrobeRoutine } from "./simWardrobe";

const DERIVED_COUNTERS = new Set(["bots_awake", "explosions", "endings", "slices", "drone_runs"]);

function walk(c: Condition | undefined, out: Condition[]): void {
  if (!c) return;
  if ("all" in c) c.all.forEach((x) => walk(x, out));
  else if ("any" in c) c.any.forEach((x) => walk(x, out));
  else if ("not" in c) walk(c.not, out);
  else out.push(c);
}

/** Every source file under lib/world except the wardrobe content itself (flag writers). */
function worldSources(dir = "lib/world"): string {
  let text = "";
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) text += worldSources(p);
    else if (p.endsWith(".ts") && !p.endsWith("content/wardrobe.ts"))
      text += readFileSync(p, "utf8");
  }
  return text;
}

const finds = WEAR_ITEMS.filter((w) => w.source.kind === "find");
const crafts = WEAR_ITEMS.filter((w) => w.source.kind === "craft");
const wearPickups = PICKUPS.filter((p) => p.items.some((i) => i.item.startsWith(WEAR_ITEM_PREFIX)));

describe("wardrobe catalogue", () => {
  it("has unique ids, valid slots, colourways and a default for every required slot", () => {
    expect(new Set(WEAR_ITEMS.map((w) => w.id)).size).toBe(WEAR_ITEMS.length);
    for (const w of WEAR_ITEMS) {
      expect(WEAR_SLOTS, w.id).toContain(w.slot);
      expect(w.colorways.length, w.id).toBeGreaterThan(0);
      expect(w.colorways[0]!.dye, `${w.id}: first colourway is free`).toBeUndefined();
      expect(w.name.length && w.blurb.length, w.id).toBeTruthy();
    }
    // Every slot has at least one alternative to the first-day look.
    for (const slot of WEAR_SLOTS)
      expect(WEAR_ITEMS.filter((w) => w.slot === slot).length, slot).toBeGreaterThan(1);
  });

  it("recipes, refining and dyes use existing, non-unique items", () => {
    const costs: Record<string, number>[] = [
      ...crafts.map((w) => (w.source.kind === "craft" ? { ...w.source.recipe } : {})),
      ...REFINE_RECIPES.map((r) => ({ ...r.inputs, [r.output]: 1 })),
      ...WEAR_ITEMS.flatMap((w) => w.colorways.flatMap((c) => (c.dye ? [{ ...c.dye }] : []))),
    ];
    for (const c of costs)
      for (const id of Object.keys(c)) {
        expect(ITEM_BY_ID.has(id), id).toBe(true);
        expect(PROTECTED_ITEMS.has(id), `${id} is unique`).toBe(false);
      }
    for (const t of TEXTILE_ITEMS) expect(ITEM_BY_ID.get(t)?.kind, t).toBe("rohstoff");
  });

  it("every unlock / reward condition references existing devices, flags and counters", () => {
    const src = worldSources();
    const conds: Condition[] = [];
    for (const w of WEAR_ITEMS) {
      if (w.source.kind === "craft") walk(w.source.unlock, conds);
      if (w.source.kind === "reward") walk(w.source.when, conds);
    }
    expect(conds.length).toBeGreaterThan(10);
    for (const l of SIGNATURE_LOOKS) if (l.unlock.kind === "event") walk(l.unlock.when, conds);
    const botFlags = new Set(BOT_QUESTS.map((q) => q.flag));
    // Endings set `ending_<id>` (game.ts reachEnding).
    const endingFlags = new Set(ENDINGS.map((e) => `ending_${e.id}`));
    for (const c of conds) {
      if ("device" in c) expect(DEVICE_BY_ID.has(c.device), c.device).toBe(true);
      else if ("counter" in c) expect(DERIVED_COUNTERS.has(c.counter), c.counter).toBe(true);
      else if ("insight" in c) expect(INSIGHT_BY_ID.has(c.insight), c.insight).toBe(true);
      else if ("flag" in c)
        expect(
          botFlags.has(c.flag) || endingFlags.has(c.flag) || src.includes(`${c.flag}`),
          c.flag,
        ).toBe(true);
      else throw new Error(`unexpected condition ${JSON.stringify(c)}`);
    }
  });

  it("hints are written for every piece that is not in the wardrobe from the start", () => {
    for (const w of WEAR_ITEMS) {
      const s = w.source;
      if (s.kind === "find") expect(s.hint.length, w.id).toBeGreaterThan(20);
      if (s.kind === "reward") expect(s.hint.length, w.id).toBeGreaterThan(8);
      if (s.kind === "craft" && s.unlock)
        expect(s.unlockHint?.length ?? 0, w.id).toBeGreaterThan(8);
    }
  });
});

describe("hidden pieces on the map", () => {
  it("every find has exactly one pickup, and every wear: pickup is a find", () => {
    for (const w of finds) {
      const here = PICKUPS.filter((p) =>
        p.items.some((i) => i.item === `${WEAR_ITEM_PREFIX}${w.id}`),
      );
      expect(
        here.map((p) => p.id),
        w.id,
      ).toHaveLength(1);
      expect(here[0]!.items, w.id).toEqual([{ item: `${WEAR_ITEM_PREFIX}${w.id}`, count: 1 }]);
      expect(here[0]!.respawn, w.id).toBeUndefined();
    }
    for (const p of wearPickups) {
      const id = p.items[0]!.item.slice(WEAR_ITEM_PREFIX.length);
      expect(WEAR_BY_ID.get(id)?.source.kind, p.id).toBe("find");
    }
    expect(wearPickups).toHaveLength(finds.length);
  });

  it("spreads the finds over all six levels, inside rooms", () => {
    const floors = new Set(wearPickups.map((p) => p.floor));
    expect([...floors].sort()).toEqual(FLOORS.map((f) => f.id).sort());
    for (const p of wearPickups) expect(roomAt(p.floor, p.x, p.z), p.id).toBeDefined();
    // Some are behind a condition, a lock, or in a secret room.
    expect(wearPickups.filter((p) => p.hidden || p.puzzle).length).toBeGreaterThanOrEqual(3);
    const secret = wearPickups.filter((p) =>
      ["kartenraum", "kaeltearchiv"].includes(roomAt(p.floor, p.x, p.z)?.id ?? ""),
    );
    expect(secret.length).toBeGreaterThanOrEqual(2);
  });

  it("puts the replicator prop next to the wardrobe in Jade's quarters", () => {
    const p = PROPS.find((x) => x.id === REPLICATOR_PROP)!;
    expect(roomAt(p.floor, p.x, p.z)?.id).toBe("jadeq");
    expect(PROP_VARIANT_DECOR[p.variant ?? ""]).toBe("wardrobe_replicator");
    expect(DECOR_BY_ID.get("wardrobe_replicator")?.parts?.length).toBeGreaterThan(0);
  });
});

// ── Resource economy ─────────────────────────────────────────────

/** Textile demand of every pattern plus `dyes` of the cheapest dye colourways. */
function demand(dyes: number): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (c: Readonly<Record<string, number>>) => {
    for (const [id, n] of Object.entries(c))
      if ((TEXTILE_ITEMS as readonly string[]).includes(id)) out[id] = (out[id] ?? 0) + n;
  };
  for (const w of crafts) if (w.source.kind === "craft") add(w.source.recipe);
  const dyeCosts = WEAR_ITEMS.flatMap((w) => w.colorways.flatMap((c) => (c.dye ? [c.dye] : [])))
    .map((d) => d)
    .sort(
      (a, b) =>
        Object.values(a).reduce((x, y) => x + y, 0) - Object.values(b).reduce((x, y) => x + y, 0),
    );
  dyeCosts.slice(0, dyes).forEach(add);
  return out;
}

/** One-time textile pickups and renewable textiles per hour (pools at their expected share). */
function supply(): { once: Record<string, number>; perHour: Record<string, number> } {
  const once: Record<string, number> = {};
  const perHour: Record<string, number> = {};
  for (const p of PICKUPS) {
    const give: Record<string, number> = {};
    if (p.pool?.length)
      for (const id of p.pool) give[id] = (give[id] ?? 0) + (p.poolCount ?? 3) / p.pool.length;
    else for (const i of p.items) give[i.item] = (give[i.item] ?? 0) + i.count;
    for (const [id, n] of Object.entries(give)) {
      if (!(TEXTILE_ITEMS as readonly string[]).includes(id)) continue;
      if (p.respawn) perHour[id] = (perHour[id] ?? 0) + (n * 3600) / p.respawn;
      else once[id] = (once[id] ?? 0) + n;
    }
  }
  return { once, perHour };
}

describe("resources for the replicator", () => {
  it("one hour of collecting plus refining covers every pattern and eight dyes", () => {
    const need = demand(8);
    const { once, perHour } = supply();
    // Refining from renewable salvage: glow algae (greenhouse, 2 per 90 s → 2 pigment each).
    const algae = PICKUPS.filter((p) => p.respawn && p.items.some((i) => i.item === "leuchtalgen"));
    const algaePerHour = algae.reduce(
      (a, p) =>
        a + ((p.items.find((i) => i.item === "leuchtalgen")?.count ?? 0) * 3600) / p.respawn!,
      0,
    );
    const pigmentRefine = REFINE_RECIPES.find((r) => r.id === "pigment_algae")!;
    const refined: Record<string, number> = {
      farbpigment: algaePerHour * pigmentRefine.count,
    };
    const report: string[] = [];
    for (const id of TEXTILE_ITEMS) {
      const have = (once[id] ?? 0) + (perHour[id] ?? 0) + (refined[id] ?? 0);
      report.push(
        `${id}: need ${need[id] ?? 0}, once ${once[id] ?? 0}, per hour ${(perHour[id] ?? 0).toFixed(1)}` +
          (refined[id] ? ` + refined ${refined[id]!.toFixed(1)}` : ""),
      );
      if (id === "leuchtfaden") continue; // spun from fibre optics + pigment (checked below)
      expect(have, `${id}\n${report.join("\n")}`).toBeGreaterThanOrEqual(need[id] ?? 0);
    }
    console.info(`[wardrobe economy]\n${report.join("\n")}`);
    // Glow thread: the sewing box plus the spinning recipe (fibre optics are salvage + pools).
    const thread = REFINE_RECIPES.find((r) => r.output === "leuchtfaden")!;
    expect((once.leuchtfaden ?? 0) + thread.count).toBeGreaterThanOrEqual(need.leuchtfaden ?? 0);
  });

  it("the simulated player replicates every craftable piece from what the lab hands out", () => {
    const { run } = fullRun();
    const s = run.s;
    let visits = 0;
    for (let i = 0; i < 300 && crafts.some((w) => !s.wardrobe.owned[w.id]); i++) {
      visits += 1;
      // Three workbench explosions for the plaster (a player gets there by accident).
      if (wardrobeCounters(s).explosions < 3) explode(s);
      wardrobeRoutine(s, { maxDyes: 8 });
      step(run);
    }
    const missing = crafts
      .filter((w) => !s.wardrobe.owned[w.id])
      .map(
        (w) =>
          `${w.id}${evalWearCond(s, w.source.kind === "craft" ? w.source.unlock : undefined) ? "" : " (locked)"}`,
      );
    expect(missing).toEqual([]);
    expect(Object.keys(s.wardrobe.dyes).length).toBeGreaterThanOrEqual(8);
    // Every hidden piece was picked up on the way, and every reward arrived.
    expect(finds.filter((w) => !s.wardrobe.owned[w.id]).map((w) => w.id)).toEqual([]);
    expect(
      WEAR_ITEMS.filter((w) => w.source.kind === "reward" && !s.wardrobe.owned[w.id]).map(
        (w) => w.id,
      ),
    ).toEqual([]);
    // Every signature look unlocks (events by playing, the rest by owning its pieces)
    // and is worn, one per visit.
    for (let i = 0; i < 120 && SIGNATURE_LOOKS.some((l) => !s.wardrobe.looksWorn[l.id]); i++) {
      visits += 1;
      wardrobeRoutine(s, { maxDyes: 8 });
      step(run);
    }
    expect(SIGNATURE_LOOKS.filter((l) => !lookUnlocked(s, l.id)).map((l) => l.id)).toEqual([]);
    expect(SIGNATURE_LOOKS.filter((l) => !s.wardrobe.looksWorn[l.id]).map((l) => l.id)).toEqual([]);
    console.info(
      `[wardrobe sim] all ${crafts.length} patterns ${visits} visits (1 play-minute each) after the completionist run, ${s.wardrobe.crafted} crafted, ${Object.keys(s.wardrobe.dyes).length} dyes, ${SIGNATURE_LOOKS.length} looks worn`,
    );
  }, 120_000);
});
