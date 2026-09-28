import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { evaluateAchievements } from "@/lib/world/achievements";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { FLOORS } from "@/lib/world/content/map";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import { ENDING_BY_ID, INSIGHT_BY_ID } from "@/lib/world/content/story";
import {
  SAVE_VERSION,
  floorAccessible,
  hint,
  initialState,
  itemDef,
  power,
  progress,
  prototypeHint,
  settle,
} from "@/lib/world/game";
import { endingStats, postgameObjectives } from "@/lib/world/postgame";
import { objectiveSections, objectives, topObjective } from "@/lib/world/quests";
import {
  META_KEY,
  MIGRATIONS,
  autosave,
  backupKey,
  computeMeta,
  corruptKey,
  deleteSlot,
  hasAnySave,
  hydrate,
  importSave,
  latestSlot,
  listSlots,
  loadSlot,
  loadWorld,
  migrateSave,
  saveToSlot,
  setActiveSlot,
  slotCorrupt,
  slotExists,
  slotKey,
} from "@/lib/world/save";
import { positionValid, sanitizeSave, spawnFor } from "@/lib/world/save-sanitize";
import type { FloorId, ItemDef, WorldState } from "@/lib/world/types";
import { play } from "./simPlayer";

beforeEach(() => {
  localStorage.clear();
});

const PROTO_ID = "p_0badc0de";

function prototype(): ItemDef {
  const src = ITEM_BY_ID.get("abstractum")!;
  return {
    ...src,
    id: PROTO_ID,
    name: "Summender Prototyp",
    kind: "prototyp",
    depth: 1,
    parents: ["abstractum", "energiezelle"],
  };
}

let midGame: WorldState;
beforeAll(() => {
  // ~10 simulated steps: most devices, many puzzles and prototypes, one ending.
  const run = play({ maxSteps: 10 });
  const s = run.s;
  if (floorAccessible(s, 1)) {
    s.floor = 1;
    s.pos = spawnFor(1);
  }
  s.generated[PROTO_ID] = prototype();
  s.inventory[PROTO_ID] = 2;
  s.recipesKnown["abstractum+energiezelle"] = PROTO_ID;
  midGame = JSON.parse(JSON.stringify(s)) as WorldState;
});

/** The checks every loaded state must pass for the UI not to crash. */
function assertPlayable(s: WorldState): void {
  expect(s.version).toBe(SAVE_VERSION);
  for (const [id, n] of Object.entries(s.inventory)) {
    expect(itemDef(s, id), `inventory ${id}`).toBeDefined();
    expect(Number.isInteger(n) && n >= 1).toBe(true);
  }
  for (const [id, def] of Object.entries(s.generated)) {
    expect(def.id).toBe(id);
    expect(ITEM_BY_ID.has(id)).toBe(false);
    for (const v of Object.values(def.traits)) expect(Number.isFinite(v)).toBe(true);
  }
  for (const [id, n] of Object.entries(s.built)) {
    const d = DEVICE_BY_ID.get(id);
    expect(d, `built ${id}`).toBeDefined();
    expect(n >= 1 && n <= d!.stages.length).toBe(true);
  }
  for (const id of [...Object.keys(s.discovered), ...Object.keys(s.switchedOn)])
    expect(DEVICE_BY_ID.has(id), `device ${id}`).toBe(true);
  for (const id of Object.keys(s.puzzles)) expect(PUZZLE_BY_ID.has(id), id).toBe(true);
  for (const id of Object.keys(s.insights)) expect(INSIGHT_BY_ID.has(id), id).toBe(true);
  for (const id of Object.keys(s.endings)) expect(ENDING_BY_ID.has(id), id).toBe(true);
  for (const out of Object.values(s.recipesKnown)) expect(itemDef(s, out)).toBeDefined();
  for (const v of [s.playTime, s.combos, ...Object.values(s.counters)]) {
    expect(Number.isFinite(v) && v >= 0).toBe(true);
  }
  expect(Array.isArray(s.log)).toBe(true);
  expect(floorAccessible(s, s.floor)).toBe(true);
  expect(positionValid(s.floor, s.pos)).toBe(true);

  // The game systems the UI calls every frame / on open.
  expect(() => settle(s)).not.toThrow();
  expect(() => power(s)).not.toThrow();
  expect(typeof hint(s)).toBe("string");
  expect(Array.isArray(objectives(s))).toBe(true);
  expect(() => objectiveSections(s)).not.toThrow();
  expect(() => topObjective(s)).not.toThrow();
  expect(() => progress(s)).not.toThrow();
  expect(() => computeMeta(s)).not.toThrow();
  expect(() => endingStats(s)).not.toThrow();
  expect(() => postgameObjectives(s)).not.toThrow();
  expect(() => prototypeHint(s)).not.toThrow();
  expect(() => evaluateAchievements(s)).not.toThrow();
}

describe("migration chain", () => {
  it("has a step for every version below the current one", () => {
    for (let v = 1; v < SAVE_VERSION; v++) expect(MIGRATIONS[v], `v${v}`).toBeTypeOf("function");
  });

  it("migrates a v1 save: held_ flags backfilled, version bumped", () => {
    const v1 = { ...JSON.parse(JSON.stringify(initialState())), version: 1 };
    v1.inventory = { abstractum: 2 };
    const s = hydrate(v1);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.flags.held_abstractum).toBe(true);
    expect(s.inventory.abstractum).toBe(2);
  });

  it("accepts a versionless state, rejects shapeless blobs and future versions", () => {
    const raw = JSON.parse(JSON.stringify(midGame)) as Record<string, unknown>;
    delete raw.version;
    expect(migrateSave(raw).ok).toBe(true);
    expect(migrateSave({ version: 2 }).ok).toBe(false);
    expect(migrateSave([]).ok).toBe(false);
    expect(migrateSave("x").ok).toBe(false);
    expect(migrateSave({ ...midGame, version: SAVE_VERSION + 5 })).toMatchObject({
      ok: false,
      reason: "future",
    });
  });
});

describe("sanitising", () => {
  it("is idempotent on a healthy mid-game save", () => {
    const { state, issues } = sanitizeSave(JSON.parse(JSON.stringify(midGame)));
    expect(issues).toEqual([]);
    expect(state.inventory).toEqual(midGame.inventory);
    expect(state.generated[PROTO_ID]).toEqual(midGame.generated[PROTO_ID]);
    expect(state.built).toEqual(midGame.built);
    expect(state.pos).toEqual(midGame.pos);
    assertPlayable(state);
  });

  it("drops unknown ids and keeps prototypes consistent with the inventory", () => {
    const raw = JSON.parse(JSON.stringify(midGame)) as Record<string, Record<string, unknown>>;
    raw.inventory!.alte_waffel = 3;
    raw.inventory!.p_ffffffff = 1; // prototype without a definition
    raw.generated!.p_eeeeeeee = { id: "p_eeeeeeee", traits: "kaputt" }; // no name → dropped
    raw.inventory!.p_eeeeeeee = 1;
    raw.generated!.abstractum = { ...prototype(), id: "abstractum" }; // shadows authored item
    raw.built!["XXX-999"] = 2;
    raw.built!["MCP-000"] = 99;
    raw.discovered!["XXX-999"] = true;
    raw.puzzles!.pz_entfernt = true;
    raw.insights!.nie_gab_es = 12;
    raw.endings!.e_alt = true;
    raw.recipesKnown!["a+b"] = "p_ffffffff";
    const s = hydrate(raw);
    expect(s.inventory.alte_waffel).toBeUndefined();
    expect(s.inventory.p_ffffffff).toBeUndefined();
    expect(s.inventory.p_eeeeeeee).toBeUndefined();
    expect(s.inventory[PROTO_ID]).toBe(2);
    expect(s.generated.abstractum).toBeUndefined();
    expect(s.built["XXX-999"]).toBeUndefined();
    expect(s.built["MCP-000"]).toBe(DEVICE_BY_ID.get("MCP-000")!.stages.length);
    expect(s.recipesKnown["a+b"]).toBeUndefined();
    assertPlayable(s);
  });

  it("clamps NaN / negative / wrongly typed numbers", () => {
    const raw = JSON.parse(JSON.stringify(midGame)) as Record<string, unknown>;
    raw.playTime = Number.NaN;
    raw.combos = -4;
    raw.counters = { slices: -3, drone_runs: Number.POSITIVE_INFINITY, research: "viel" };
    raw.inventory = { abstractum: 2.7, energiezelle: -1 };
    raw.log = "nope";
    const { state } = sanitizeSave(raw);
    expect(state.playTime).toBe(0);
    expect(state.combos).toBe(0);
    expect(state.counters).toEqual({ slices: 0 });
    expect(state.inventory).toEqual({ abstractum: 2 });
    expect(state.log.length).toBeGreaterThan(0);
    assertPlayable(state);
  });

  it("respawns positions outside the map or on unreachable floors", () => {
    for (const f of FLOORS) expect(positionValid(f.id, spawnFor(f.id)), `floor ${f.id}`).toBe(true);
    const raw = JSON.parse(JSON.stringify(midGame)) as Record<string, unknown>;
    raw.pos = [-500, 3, 9999];
    expect(hydrate(raw).pos).toEqual(spawnFor(hydrate(raw).floor));
    raw.pos = ["a", null];
    expect(positionValid(hydrate(raw).floor, hydrate(raw).pos)).toBe(true);
    // A deep floor the fresh-ish save cannot reach → back to floor 0.
    const fresh = JSON.parse(JSON.stringify(initialState())) as Record<string, unknown>;
    const locked = FLOORS.map((f) => f.id).find((f) => !floorAccessible(initialState(), f));
    expect(locked).toBeDefined();
    fresh.floor = locked as FloorId;
    fresh.pos = spawnFor(locked as FloorId);
    const s = hydrate(fresh);
    expect(s.floor).toBe(0);
    expect(s.pos).toEqual(spawnFor(0));
    fresh.floor = 17;
    expect(hydrate(fresh).floor).toBe(0);
  });
});

describe("corrupt slots", () => {
  it("lists a corrupt slot as beschädigt without breaking title-screen helpers", () => {
    localStorage.setItem(slotKey("slot2"), "{kaputt");
    localStorage.setItem(slotKey("slot3"), JSON.stringify({ hallo: "welt" }));
    const infos = listSlots();
    expect(infos.find((x) => x.id === "slot2")).toMatchObject({ empty: true, corrupt: true });
    expect(infos.find((x) => x.id === "slot3")).toMatchObject({ empty: true, corrupt: true });
    expect(infos.find((x) => x.id === "slot1")).toMatchObject({ empty: true, corrupt: false });
    expect(slotCorrupt("slot2")).toBe(true);
    expect(hasAnySave()).toBe(false);
    expect(latestSlot()).toBeNull();
    expect(loadSlot("slot2")).toBeNull();
  });

  it("stashes an unreadable active slot before a fresh game overwrites it", () => {
    setActiveSlot("slot2");
    localStorage.setItem(slotKey("slot2"), "{kaputt");
    const s = loadWorld();
    expect(s.playTime).toBe(0);
    expect(localStorage.getItem(corruptKey("slot2"))).toBe("{kaputt");
    deleteSlot("slot2");
    expect(localStorage.getItem(corruptKey("slot2"))).toBeNull();
    expect(listSlots().find((x) => x.id === "slot2")?.corrupt).toBe(false);
  });

  it("rebuilds a malformed meta record instead of rendering junk", () => {
    saveToSlot("slot1", initialState());
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ slot1: { savedAt: "x", playTime: 5, label: { evil: true }, floor: 9 } }),
    );
    const m = listSlots().find((x) => x.id === "slot1")!.meta!;
    expect(typeof m.label).toBe("string");
    expect(typeof m.floorName).toBe("string");
  });

  it("keeps the previous autosave as .bak and falls back to it", () => {
    const a = initialState();
    a.playTime = 100;
    autosave(a);
    expect(localStorage.getItem(backupKey("auto"))).toBeNull();
    const b = initialState();
    b.playTime = 200;
    autosave(b);
    expect(JSON.parse(localStorage.getItem(backupKey("auto"))!).playTime).toBe(100);
    localStorage.setItem(slotKey("auto"), "{abgeschnitten");
    expect(loadSlot("auto")!.playTime).toBe(100);
    expect(slotExists("auto")).toBe(true);
    const info = listSlots().find((x) => x.id === "auto")!;
    expect(info.empty).toBe(false);
    expect(info.meta?.label).toMatch(/backup/);
    // A corrupt main never replaces a good backup.
    autosave(b);
    expect(JSON.parse(localStorage.getItem(backupKey("auto"))!).playTime).toBe(100);
    deleteSlot("auto");
    expect(localStorage.getItem(backupKey("auto"))).toBeNull();
    expect(loadSlot("auto")).toBeNull();
  });
});

describe("import validation", () => {
  it("rejects clearly and sanitises what it accepts", () => {
    const future = importSave("slot1", JSON.stringify({ ...midGame, version: SAVE_VERSION + 1 }));
    expect(future).toMatchObject({ ok: false });
    if (!future.ok) expect(future.error).toMatch(/newer version/);
    const shapeless = importSave("slot1", JSON.stringify({ format: "unlabs-world", state: 7 }));
    expect(shapeless).toMatchObject({ ok: false, error: "Not a valid _unLAB save." });
    expect(loadSlot("slot1")).toBeNull();

    const dirty = { ...midGame, inventory: { ...midGame.inventory, alte_waffel: 1 } };
    const r = importSave("slot1", JSON.stringify(dirty));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.repaired).toBeGreaterThan(0);
    const s = loadSlot("slot1")!;
    expect(s.inventory.alte_waffel).toBeUndefined();
    assertPlayable(s);
  });
});

// ── Fuzz ─────────────────────────────────────────────────────────

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const JUNK: readonly unknown[] = [
  null,
  42,
  -7,
  1e308,
  "x",
  "",
  true,
  false,
  [],
  [1, "a"],
  {},
  { a: 1 },
];

function mutate(raw: Record<string, unknown>, r: () => number): void {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const keys = Object.keys(raw);
  const key = pick(keys);
  const kind = Math.floor(r() * 5);
  if (kind === 0) {
    delete raw[key];
  } else if (kind === 1) {
    raw[key] = pick(JUNK);
  } else {
    const obj = raw[key];
    if (typeof obj !== "object" || obj === null) {
      raw[key] = pick(JUNK);
      return;
    }
    const inner = obj as Record<string, unknown>;
    const innerKeys = Object.keys(inner);
    if (kind === 2 || innerKeys.length === 0)
      inner[`unbekannt_${Math.floor(r() * 1e6)}`] = pick(JUNK);
    else if (kind === 3) inner[pick(innerKeys)] = pick(JUNK);
    else delete inner[pick(innerKeys)];
  }
}

describe("fuzz: mutated mid-game saves", () => {
  it("always load into a playable state (or are rejected as a whole)", () => {
    const r = rng(0x5eed);
    let loaded = 0;
    for (let i = 0; i < 300; i++) {
      localStorage.clear();
      const raw = JSON.parse(JSON.stringify(midGame)) as Record<string, unknown>;
      const n = 1 + Math.floor(r() * 6);
      for (let k = 0; k < n; k++) mutate(raw, r);
      localStorage.setItem(slotKey("slot1"), JSON.stringify(raw));
      const loadable = migrateSave(raw).ok;
      expect(() => listSlots()).not.toThrow();
      const s = loadSlot("slot1");
      if (!loadable) {
        expect(s).toBeNull();
        expect(listSlots()[0]!.corrupt).toBe(true);
        continue;
      }
      expect(s, `iteration ${i}`).not.toBeNull();
      assertPlayable(s!);
      // Re-saving and re-loading is stable.
      saveToSlot("slot1", s!);
      expect(loadSlot("slot1")!.inventory).toEqual(s!.inventory);
      loaded++;
    }
    expect(loaded).toBeGreaterThan(250);
  });
});
