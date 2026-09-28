/**
 * Dependency graph of the Lab World — beyond "ids exist".
 * ========================================================
 *
 * `content.test.ts` checks that every referenced id exists and that the
 * `needs` graph is acyclic; `connectivity.test.ts` proves by play that
 * everything is reachable. This file closes the gaps in between:
 *
 *  - the *full* device graph (needs + devices named in discovery / stage
 *    conditions + stations of recipes whose output a stage needs and that no
 *    pickup provides) has no cycle, so no device waits on itself;
 *  - every item has a purpose (named by id somewhere, fills a trait slot of
 *    some build stage, or is a relic / slag with its own mechanics);
 *  - every item can actually be obtained by play (the completionist run held
 *    it at least once), so every recipe input and every build slot is
 *    satisfiable;
 *  - every flag a condition waits for is set somewhere (content or code) and
 *    is really set during play.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DEVICES, DEVICE_BY_ID, DEVICE_PUZZLES } from "@/lib/world/content/devices";
import { ITEMS, ITEM_BY_ID, RECIPES } from "@/lib/world/content/items";
import { DOORS, FLOOR_ACCESS, NOTES, PICKUPS, PROPS } from "@/lib/world/content/map";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { DEVICE_INSIGHTS, ENDINGS, INSIGHTS, NPCS } from "@/lib/world/content/story";
import { combine } from "@/lib/world/combine";
import { meetsTraits } from "@/lib/world/traits";
import type { Condition, ItemDef, WorldState } from "@/lib/world/types";
import { fullRun } from "./simCoverage";

/** Positive references of a condition (things that must be reached, not avoided). */
function positive(
  c: Condition | undefined,
  out: { devices: string[]; flags: string[]; items: string[] },
  negated = false,
): void {
  if (!c) return;
  if ("all" in c) c.all.forEach((x) => positive(x, out, negated));
  else if ("any" in c) c.any.forEach((x) => positive(x, out, negated));
  else if ("not" in c) positive(c.not, out, !negated);
  else if (negated) return;
  else if ("device" in c) out.devices.push(c.device);
  else if ("flag" in c) out.flags.push(c.flag);
  else if ("item" in c) out.items.push(c.item);
}

/** Every condition in the content, labelled by where it sits. */
function allConditions(): [string, Condition | undefined][] {
  const out: [string, Condition | undefined][] = [];
  for (const d of DEVICES) {
    d.discover.forEach((c, i) => out.push([`${d.id} discover#${i}`, c]));
    d.stages.forEach((st, i) => out.push([`${d.id} stage#${i}`, st.when]));
  }
  for (const d of DOORS) out.push([`door ${d.id}`, d.lock]);
  for (const p of PICKUPS) out.push([`pickup ${p.id}`, p.hidden]);
  for (const n of NOTES) out.push([`note ${n.id}`, n.hidden]);
  for (const p of PROPS) out.push([`prop ${p.id}`, p.requires]);
  for (const n of NPCS) {
    out.push([`npc ${n.id}`, n.visible]);
    n.greeting.forEach((g, i) => out.push([`npc ${n.id} greeting#${i}`, g.when]));
    n.options.forEach((o, i) => out.push([`npc ${n.id} option#${i}`, o.when]));
  }
  for (const e of ENDINGS) out.push([`ending ${e.id}`, e.requires]);
  for (const i of INSIGHTS) out.push([`insight ${i.id}`, i.auto]);
  for (const [f, a] of Object.entries(FLOOR_ACCESS)) out.push([`floor ${f}`, a.requires]);
  for (const [dev, hooks] of Object.entries(DEVICE_PUZZLES))
    hooks.forEach((h, i) => out.push([`${dev} puzzle#${i}`, h.requires]));
  for (const [dev, hooks] of Object.entries(DEVICE_INSIGHTS))
    hooks.forEach((h, i) => out.push([`${dev} insight#${i}`, h.requires]));
  return out;
}

let run: { s: WorldState };

beforeAll(() => {
  run = fullRun().run;
});

describe("full device dependency graph", () => {
  /** Items some pickup hands out directly (no station needed). */
  const picked = new Set<string>();
  for (const p of PICKUPS) {
    p.items.forEach((i) => picked.add(i.item));
    p.pool?.forEach((i) => picked.add(i));
  }

  const edges = new Map<string, Set<string>>();
  for (const d of DEVICES) {
    const out = new Set<string>(d.needs);
    const refs = { devices: [] as string[], flags: [] as string[], items: [] as string[] };
    d.discover.forEach((c) => positive(c, refs));
    for (const st of d.stages) {
      positive(st.when, refs);
      for (const r of st.requires) {
        if (!r.item || picked.has(r.item)) continue;
        // Only craftable at stations: every recipe for it needs one of them.
        const recipes = RECIPES.filter((x) => x.output === r.item);
        if (recipes.length && recipes.every((x) => x.station)) {
          const stations = new Set(recipes.map((x) => x.station!));
          if (stations.size === 1) out.add([...stations][0]!);
        }
      }
    }
    refs.devices.forEach((x) => out.add(x));
    out.delete(d.id); // a stage may check the device's own earlier stage
    edges.set(d.id, out);
  }

  it("only points at real devices", () => {
    for (const [d, out] of edges)
      for (const x of out) expect(DEVICE_BY_ID.has(x), `${d} → ${x}`).toBe(true);
  });

  it("has no cycle (no device waits on itself through conditions or stations)", () => {
    const state = new Map<string, "visiting" | "done">();
    const cycles: string[] = [];
    const visit = (id: string, trail: string[]): void => {
      const st = state.get(id);
      if (st === "done") return;
      if (st === "visiting") {
        cycles.push([...trail.slice(trail.indexOf(id)), id].join(" → "));
        return;
      }
      state.set(id, "visiting");
      for (const x of edges.get(id) ?? []) visit(x, [...trail, id]);
      state.set(id, "done");
    };
    for (const d of DEVICES) visit(d.id, []);
    expect(cycles).toEqual([]);
  });

  it("gives every device a finite build depth (longest chain of prerequisites)", () => {
    const depth = new Map<string, number>();
    const of = (id: string): number => {
      const known = depth.get(id);
      if (known !== undefined) return known;
      depth.set(id, Number.POSITIVE_INFINITY); // guards against cycles
      const d = 1 + Math.max(0, ...[...(edges.get(id) ?? [])].map(of));
      depth.set(id, d);
      return d;
    };
    for (const d of DEVICES) expect(Number.isFinite(of(d.id)), d.id).toBe(true);
    expect(Math.max(...DEVICES.map((d) => of(d.id)))).toBeGreaterThan(3);
  });

  it("every device and stage is built in the completionist run", () => {
    for (const d of DEVICES) expect(run.s.built[d.id] ?? 0, d.id).toBe(d.stages.length);
  });
});

describe("items", () => {
  const named = new Set<string>();
  const refs = { devices: [] as string[], flags: [] as string[], items: [] as string[] };
  for (const [, c] of allConditions()) positive(c, refs);
  refs.items.forEach((i) => named.add(i));
  for (const r of RECIPES) Object.keys(r.inputs).forEach((i) => named.add(i));
  for (const d of DEVICES)
    for (const st of d.stages) for (const r of st.requires) if (r.item) named.add(r.item);
  for (const n of NPCS) for (const o of n.options) for (const t of o.takes ?? []) named.add(t.item);

  const traitSlots = DEVICES.flatMap((d) =>
    d.stages.flatMap((st) => st.requires.filter((r) => r.traits && !r.item)),
  );

  const fitsSlot = (it: ItemDef) =>
    traitSlots.some(
      (r) =>
        meetsTraits(it.traits, r.traits!) &&
        (r.maxVolatility === undefined || it.volatility <= r.maxVolatility),
    );

  /** Workbench-only material: some 2-part prototype made with it fills a trait slot. */
  const combinesIntoSlot = (id: string) =>
    ITEMS.some((other) => {
      const inputs = other.id === id ? { [id]: 2 } : { [id]: 1, [other.id]: 1 };
      const res = combine(inputs, {});
      return res.kind === "prototype" && !!res.output && fitsSlot(res.output);
    });

  it("every item has a purpose (named, fills a trait slot, workbench material, relic/slag)", () => {
    const idle = ITEMS.filter((it) => {
      if (named.has(it.id)) return false;
      if (it.kind === "relikt" || it.kind === "schlacke") return false;
      return !fitsSlot(it) && !combinesIntoSlot(it.id);
    }).map((it) => it.id);
    expect(idle).toEqual([]);
  });

  it("every item is obtained at least once by play", () => {
    const never = ITEMS.filter((it) => !run.s.flags[`held_${it.id}`]).map((it) => it.id);
    expect(never).toEqual([]);
  });

  it("every recipe has obtainable inputs, a real station and is learned by play", () => {
    for (const r of RECIPES) {
      for (const id of Object.keys(r.inputs)) {
        expect(ITEM_BY_ID.has(id), id).toBe(true);
        expect(run.s.flags[`held_${id}`], `${r.output} needs ${id}`).toBe(true);
      }
      if (r.station) expect(DEVICE_BY_ID.has(r.station), r.station).toBe(true);
      expect(Object.values(r.inputs).every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    }
  });

  it("every puzzle reward item exists", () => {
    for (const p of PUZZLES)
      for (const it of p.reward?.items ?? []) expect(ITEM_BY_ID.has(it.item), p.id).toBe(true);
  });
});

describe("flags", () => {
  const ROOT = path.resolve(__dirname, "../..");
  const src = [...readdirSync(path.join(ROOT, "lib/world")).filter((f) => f.endsWith(".ts"))]
    .map((f) => readFileSync(path.join(ROOT, "lib/world", f), "utf8"))
    .join("\n");

  /** Flags content sets directly. */
  const setByContent = new Set<string>();
  for (const n of NPCS)
    for (const o of n.options) (o.flags ?? []).forEach((f) => setByContent.add(f));
  for (const p of PUZZLES) (p.reward?.flags ?? []).forEach((f) => setByContent.add(f));

  /** Families written by code with a computed suffix. */
  const FAMILIES = [
    "said_",
    "visited_",
    "seen_",
    "held_",
    "met_",
    "bot_",
    "research_",
    "ending_",
    "ach_",
    "legacy_ending_",
    "buff:",
  ];

  const referenced = new Map<string, string[]>();
  for (const [where, c] of allConditions()) {
    const refs = { devices: [] as string[], flags: [] as string[], items: [] as string[] };
    positive(c, refs);
    for (const f of refs.flags) referenced.set(f, [...(referenced.get(f) ?? []), where]);
  }

  it("every flag a condition waits for is set by content or code", () => {
    const orphans = [...referenced.keys()].filter(
      (f) =>
        !setByContent.has(f) &&
        !src.includes(`"${f}"`) &&
        !src.includes(`'${f}'`) &&
        !FAMILIES.some((p) => f.startsWith(p)),
    );
    expect(
      orphans,
      orphans.map((f) => `${f} ← ${referenced.get(f)!.join(", ")}`).join("\n"),
    ).toEqual([]);
  });

  it("every flag a condition waits for is really set during play", () => {
    // `ng_plus` only exists in a New Game+ (played through in save-locale.test.ts).
    const unset = [...referenced.keys()].filter((f) => !run.s.flags[f] && f !== "ng_plus");
    expect(unset, unset.map((f) => `${f} ← ${referenced.get(f)!.join(", ")}`).join("\n")).toEqual(
      [],
    );
  });
});
