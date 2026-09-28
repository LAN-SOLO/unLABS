import { describe, expect, it } from "vitest";
import { initialState, power, solvePuzzle } from "@/lib/world/game";
import {
  TRACK_FLAG_PREFIX,
  canTrack,
  compassTarget,
  hudObjective,
  objectiveSections,
  objectives,
  objectivesCached,
  setTrackedObjective,
  topObjective,
  trackedObjectiveId,
} from "@/lib/world/quests";

describe("HUD objective: one sweep per world version", () => {
  it("matches topObjective + compassTarget without a pin", () => {
    const s = initialState();
    const hud = hudObjective(s, objectives(s));
    expect(hud.objective?.id).toBe(topObjective(s)?.id);
    expect(hud.target).toEqual(compassTarget(s));
    expect(hud.tracked).toBe(false);
  });

  it("caches per state, version and floor", () => {
    const s = initialState();
    const a = objectivesCached(s, 1);
    expect(objectivesCached(s, 1)).toBe(a);
    // Another state never shares the entry.
    expect(objectivesCached(initialState(), 1)).not.toBe(a);
    // In-place mutation + version bump → recomputed.
    solvePuzzle(s, "pz_geo_valve");
    const b = objectivesCached(s, 2);
    expect(b).not.toBe(a);
    expect(b.map((o) => o.id)).not.toContain("strom_ventil");
    // Floor change alone also invalidates (elevator targets use the current floor).
    s.floor = 1;
    expect(objectivesCached(s, 2)).not.toBe(b);
  });

  it("feeds the journal sections from the same list", () => {
    const s = initialState();
    const list = objectivesCached(s, 7);
    expect(objectiveSections(s, list)).toEqual(objectiveSections(s));
  });
});

describe("tracked objective (journal pin)", () => {
  it("stores exactly one pin in the world flags", () => {
    const s = initialState();
    expect(trackedObjectiveId(s)).toBeNull();
    setTrackedObjective(s, "bot_f1ndr");
    setTrackedObjective(s, "bot_k2ldr");
    expect(trackedObjectiveId(s)).toBe("bot_k2ldr");
    expect(Object.keys(s.flags).filter((k) => k.startsWith(TRACK_FLAG_PREFIX))).toEqual([
      `${TRACK_FLAG_PREFIX}bot_k2ldr`,
    ]);
    setTrackedObjective(s, null);
    expect(trackedObjectiveId(s)).toBeNull();
  });

  it("points the compass at the pinned objective while it is open", () => {
    const s = initialState();
    const list = objectives(s);
    const pick = list.find((o, i) => i > 0 && canTrack(o))!;
    expect(pick).toBeDefined();
    setTrackedObjective(s, pick.id);
    const hud = hudObjective(s, objectives(s));
    expect(hud.tracked).toBe(true);
    expect(hud.objective?.id).toBe(pick.id);
    expect(hud.target).toEqual(pick.target);
  });

  it("falls back to the automatic objective once the pin is done or unknown", () => {
    const s = initialState();
    setTrackedObjective(s, "strom_ventil");
    expect(hudObjective(s, objectives(s)).tracked).toBe(true);
    solvePuzzle(s, "pz_geo_valve");
    const hud = hudObjective(s, objectives(s));
    expect(hud.tracked).toBe(false);
    expect(hud.objective?.id).toBe(topObjective(s)?.id);
    expect(hud.target).toEqual(compassTarget(s));

    setTrackedObjective(s, "does_not_exist");
    expect(hudObjective(s, objectives(s)).tracked).toBe(false);
  });

  it("never tracks objectives without a location", () => {
    const s = initialState();
    const unlocated = objectives(s).find((o) => !o.target);
    if (!unlocated) return;
    expect(canTrack(unlocated)).toBe(false);
    setTrackedObjective(s, unlocated.id);
    expect(hudObjective(s, objectives(s)).tracked).toBe(false);
  });
});

describe("power cache", () => {
  it("is per state and still correct after in-place changes", () => {
    const a = initialState();
    const b = initialState();
    b.flags.geo_routed = true;
    expect(power(a).generation).toBe(0);
    expect(power(b).generation).toBe(50);
    // Interleaved states keep their own cached result.
    expect(power(a)).toBe(power(a));
    expect(power(a).generation).toBe(0);
    a.flags.geo_routed = true;
    expect(power(a).generation).toBe(50);
  });
});
