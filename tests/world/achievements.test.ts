import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BY_ID,
  BRANCH_ORDER,
  achievementCount,
  achievementFlag,
  achievementsByBranch,
  evaluateAchievements,
  isUnlocked,
} from "@/lib/world/achievements";
import { DEVICES } from "@/lib/world/content/devices";
import { SLICE_TOTAL } from "@/lib/world/content/items";
import { BOT_QUESTS } from "@/lib/world/content/story";
import { grant, initialState, reachEnding } from "@/lib/world/game";
import type { WorldState } from "@/lib/world/types";

function everythingBuilt(): WorldState {
  const s = initialState();
  for (const d of DEVICES) s.built[d.id] = d.stages.length;
  s.flags.geo_routed = true;
  return s;
}

describe("achievements", () => {
  it("has unique ids, known branches and prerequisites defined earlier", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    ACHIEVEMENTS.forEach((a, i) => {
      expect(BRANCH_ORDER).toContain(a.branch);
      for (const r of a.requires ?? []) {
        const at = ACHIEVEMENTS.findIndex((x) => x.id === r);
        expect(at, `${a.id} requires ${r}`).toBeGreaterThanOrEqual(0);
        expect(at, `${a.id} requires ${r} (order)`).toBeLessThan(i);
      }
    });
    for (const id of [
      "first_spark",
      "resource_dabbler",
      "resource_hoarder",
      "resource_tycoon",
      "tinkerer",
      "engineer",
      "master_inventor",
      "transcendence",
      "drei_explodiert",
      "achthundertsiebenundvierzig",
      "alle_bots_wach",
      "alle_slices",
    ])
      expect(ACHIEVEMENT_BY_ID.has(id), id).toBe(true);
  });

  it("starts empty and unlocks once, storing ach_<id> flags", () => {
    const s = initialState();
    expect(evaluateAchievements(s)).toEqual([]);
    grant(s, ["cold_start"]);
    expect(evaluateAchievements(s)).toEqual(["kaltstart"]);
    expect(s.flags[achievementFlag("kaltstart")]).toBe(true);
    expect(isUnlocked(s, "kaltstart")).toBe(true);
    expect(evaluateAchievements(s)).toEqual([]);
  });

  it("respects the tree: later tiers need earlier ones, chains resolve in one call", () => {
    const s = everythingBuilt();
    const fresh = evaluateAchievements(s);
    expect(fresh).toContain("tinkerer");
    expect(fresh).toContain("engineer");
    expect(fresh).toContain("master_inventor");
    expect(fresh.indexOf("tinkerer")).toBeLessThan(fresh.indexOf("engineer"));
    expect(fresh).toContain("first_spark");
    expect(fresh).toContain("awakened_ai");
  });

  it("counts salvaged parts for the resource branch", () => {
    const s = initialState();
    s.counters.salvaged = 24;
    expect(evaluateAchievements(s)).not.toContain("resource_dabbler");
    s.counters.salvaged = 160;
    const fresh = evaluateAchievements(s);
    expect(fresh).toEqual(expect.arrayContaining(["resource_dabbler", "resource_hoarder"]));
    expect(fresh).not.toContain("resource_tycoon");
  });

  it("tracks bots, slices, explosions and the secret ending", () => {
    const s = initialState();
    for (const q of BOT_QUESTS) s.flags[q.flag] = true;
    s.counters.slices = SLICE_TOTAL;
    s.flags.explosion_seen = true;
    s.counters.combo_prototype = 1;
    const fresh = evaluateAchievements(s);
    expect(fresh).toEqual(
      expect.arrayContaining(["alle_bots_wach", "alle_slices", "drei_explodiert"]),
    );
    expect(isUnlocked(s, "zeuge")).toBe(false);
    s.endings.kristall = true;
    expect(evaluateAchievements(s)).toContain("zeuge");
  });

  it("reaches Transcendence when the four branch finals hold", () => {
    const s = everythingBuilt();
    s.flags.anomaly_tamed = true;
    s.puzzles.pz_cipher = true;
    grant(s, ["halo_h", "handshake", "unstables", "halo_atmet"]);
    for (const id of [
      "synapsis_splitter",
      "halo_staub",
      "kristall_0089",
      "damien_band",
      "x0r8t_paket",
    ])
      s.flags[`seen_${id}`] = true;
    evaluateAchievements(s);
    for (const id of [
      "anomaly_tamer",
      "archivist_of_secrets",
      "cosmic_conversation",
      "awakened_ai",
      "transcendence",
    ])
      expect(isUnlocked(s, id), id).toBe(true);
  });

  it("groups by branch for the panel and masks hidden ones until unlocked", () => {
    const s = initialState();
    const groups = achievementsByBranch(s);
    expect(groups.map((g) => g.branch)).toEqual([...BRANCH_ORDER]);
    const hidden = groups.flatMap((g) => g.items).filter((v) => v.def.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    for (const v of hidden) expect(v.unlocked).toBe(false);
    expect(achievementCount(s)).toEqual({ unlocked: 0, total: ACHIEVEMENTS.length });
    const main = groups
      .find((g) => g.branch === "labor")!
      .items.find((v) => v.def.id === "alle_slices")!;
    expect(main.progress).toEqual({ current: 0, target: SLICE_TOTAL });
  });

  it("keep_unstable needs the four original endings, not the secret one", () => {
    const s = initialState();
    s.endings.kristall = true;
    evaluateAchievements(s);
    expect(isUnlocked(s, "keep_unstable")).toBe(false);
    for (const id of ["frequenz", "substrat", "rueckkehr", "halo"]) s.endings[id] = true;
    expect(evaluateAchievements(s)).toContain("keep_unstable");
    // reachEnding also leaves a flag for dialogue conditions.
    const t = initialState();
    expect(reachEnding(t, "frequenz")).toBe(false);
  });
});
