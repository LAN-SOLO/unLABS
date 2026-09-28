import { describe, expect, it } from "vitest";
import { PUZZLE_AXIS, archetypeOf, combine } from "@/lib/world/combine";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { DOORS, NOTES, PICKUPS, PROPS, roomAt } from "@/lib/world/content/map";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { NPCS } from "@/lib/world/content/story";
import {
  PROTO_PUFFER_MAX,
  addItem,
  applyPrototype,
  count,
  doorIsOpen,
  evalCond,
  hint,
  initialState,
  isOnline,
  noteVisible,
  pickupAvailable,
  pickupVisible,
  power,
  protoEffectFlag,
  prototypeHint,
  prototypeUseOptions,
  puzzleAvailable,
  takePickup,
  usePrototype,
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
}

const NO_BYPASS = new Set(["pz_power_flow", "pz_geo_valve"]);

/** A puzzle of this family whose host is usable in a fresh state, plus a target id for it. */
function puzzleFixture(family: string): { puzzle: string; target: string; axis: string } {
  const s = initialState();
  for (const p of PUZZLES) {
    const m = PUZZLE_AXIS[p.kind];
    if (!m || m.family !== family || NO_BYPASS.has(p.id) || !puzzleAvailable(s, p.id)) continue;
    const prop = PROPS.find((x) => x.puzzle === p.id);
    return { puzzle: p.id, target: prop?.id ?? p.id, axis: m.axis };
  }
  throw new Error(`no fixture for ${family}`);
}

describe("usePrototype — effect families", () => {
  it("Ladung charges a device buffer once, adds power and is deterministic", () => {
    const s = initialState();
    build(s, "CLK-001");
    giveProto(s, "p_akku", { energie: 8 });
    const before = power(s).generation;
    const r = applyPrototype(s, "p_akku", "CLK-001");
    expect(r.ok).toBe(true);
    expect(r.family).toBe("ladung");
    expect(r.consumed).toBe(true);
    expect(r.firstOfFamily).toBe(true);
    expect(count(s, "p_akku")).toBe(0);
    const gain = power(s).generation - before;
    expect([10, 15]).toContain(gain);
    expect(s.flags[protoEffectFlag("ladung")]).toBe(true);
    // Same device again: nothing happens, nothing is consumed.
    giveProto(s, "p_akku2", { energie: 8 });
    const again = applyPrototype(s, "p_akku2", "CLK-001");
    expect(again.ok).toBe(false);
    expect(count(s, "p_akku2")).toBe(1);
    // Determinism: an identical state gives an identical outcome.
    const a = initialState();
    const b = initialState();
    for (const x of [a, b]) {
      build(x, "CLK-001");
      giveProto(x, "p_akku", { energie: 8 });
    }
    expect(applyPrototype(a, "p_akku", "CLK-001")).toEqual(applyPrototype(b, "p_akku", "CLK-001"));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("Ladung buffers are capped", () => {
    const s = initialState();
    const ids = ["CLK-001", "VNT-001", "BTK-001", "UEC-001", "PWB-001", "CDC-001"];
    for (const [i, id] of ids.entries()) {
      build(s, id);
      giveProto(s, `p_a${i}`, { energie: 9 }, { archetype: "sturmzelle" });
      applyPrototype(s, `p_a${i}`, id);
    }
    expect(s.counters.proto_puffer).toBeLessThanOrEqual(PROTO_PUFFER_MAX);
  });

  it("Kühlung calms another prototype; the Ruhepol archetype is not used up", () => {
    const s = initialState();
    giveProto(s, "p_wild", { energie: 5 }, { volatility: 4 });
    giveProto(s, "p_kalt", { thermik: 7 });
    const r = applyPrototype(s, "p_kalt", "p_wild");
    expect(r.ok).toBe(true);
    expect(r.family).toBe("kuehlung");
    expect(s.generated.p_wild!.volatility).toBe(3);
    expect(count(s, "p_kalt")).toBe(0);
    giveProto(
      s,
      "p_ruhe",
      { energie: 5, signal: 5, optik: 4, thermik: 0 },
      { archetype: "ruhepol" },
    );
    const r2 = applyPrototype(s, "p_ruhe", "p_wild");
    expect(r2.ok).toBe(true);
    expect(r2.consumed).toBe(false);
    expect(count(s, "p_ruhe")).toBe(1);
    expect(s.generated.p_wild!.volatility).toBe(2);
  });

  it("Lichtbild reveals notes/pickups that a device would otherwise show", () => {
    const s = initialState();
    const note = NOTES.find(
      (n) => n.hidden && "device" in n.hidden && n.hidden.device === "VNT-001",
    );
    const pile = PICKUPS.find(
      (p) => p.hidden && "device" in p.hidden && p.hidden.device === "VNT-001",
    );
    const obj = note ?? pile;
    expect(obj).toBeDefined();
    const room = roomAt(obj!.floor, obj!.x, obj!.z)!;
    const host =
      PROPS.find((p) => roomAt(p.floor, p.x, p.z)?.id === room.id)?.id ??
      PICKUPS.find((p) => p.id !== obj!.id && roomAt(p.floor, p.x, p.z)?.id === room.id)?.id;
    expect(host, room.id).toBeDefined();
    expect(isOnline(s, "VNT-001")).toBe(false);
    giveProto(s, "p_licht", { optik: 7 });
    const r = applyPrototype(s, "p_licht", host!);
    expect(r.ok).toBe(true);
    expect(r.family).toBe("lichtbild");
    expect(r.revealed).toContain(obj!.id);
    if (note && obj === note) expect(noteVisible(s, note.id)).toBe(true);
    else expect(pickupVisible(s, pile!)).toBe(true);
  });

  for (const family of ["dekodierung", "stimmung", "kalibrierung"] as const) {
    it(`${family} solves a matching puzzle with its reward`, () => {
      const fx = puzzleFixture(family);
      const s = initialState();
      giveProto(s, "p_weak", { [fx.axis]: 6 });
      expect(applyPrototype(s, "p_weak", fx.target).ok).toBe(false);
      expect(count(s, "p_weak")).toBe(1);
      giveProto(s, "p_strong", { [fx.axis]: 9 });
      const r = applyPrototype(s, "p_strong", fx.target);
      expect(r.ok, r.message).toBe(true);
      expect(r.family).toBe(family);
      expect(r.puzzle).toBe(fx.puzzle);
      expect(s.puzzles[fx.puzzle]).toBe(true);
    });
  }

  it("onboarding puzzles cannot be bypassed", () => {
    const s = initialState();
    giveProto(s, "p_mech", { mechanik: 12 });
    for (const pz of NO_BYPASS) {
      const host = PROPS.find((p) => p.puzzle === pz)?.id ?? pz;
      applyPrototype(s, "p_mech", host);
      expect(s.puzzles[pz]).toBeFalsy();
    }
  });

  it("Hebel finishes a half-salvaged pile without the tool", () => {
    const s = initialState();
    const p = PICKUPS.find(
      (x) =>
        x.tool &&
        !x.pool &&
        !x.puzzle &&
        x.items.length >= 2 &&
        evalCond(s, x.hidden) &&
        !isOnline(s, x.tool),
    );
    expect(p).toBeDefined();
    expect(takePickup(s, p!.id).ok).toBe(true);
    expect(s.flags[`partial_${p!.id}`]).toBe(true);
    giveProto(s, "p_hebel", { mechanik: 7 });
    const r = applyPrototype(s, "p_hebel", p!.id);
    expect(r.ok).toBe(true);
    expect(r.family).toBe("hebel");
    expect(r.items).toEqual(p!.items.slice(1));
    expect(s.flags[`partial_${p!.id}`]).toBeFalsy();
    expect(s.taken[p!.id]).toBeDefined();
    if (!p!.respawn) expect(pickupAvailable(s, p!)).toBe(false);
  });

  it("Peilung locates slice signatures; the Leuchtfeuer finds three", () => {
    const s = initialState();
    giveProto(s, "p_funk", { signal: 7 });
    const r = applyPrototype(s, "p_funk", "MCP-000");
    expect(r.ok).toBe(true);
    expect(r.family).toBe("peilung");
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatch(/847 Hz/);
    expect(Object.keys(s.flags).filter((f) => f.startsWith("peil_"))).toHaveLength(1);
    giveProto(s, "p_feuer", { signal: 9, energie: 4 }, { archetype: "leuchtfeuer" });
    const r2 = applyPrototype(s, "p_feuer", "MCP-000");
    expect(r2.lines).toHaveLength(3);
    expect(Object.keys(s.flags).filter((f) => f.startsWith("peil_"))).toHaveLength(4);
  });

  it("Resonanzschlüssel opens a secret door; the Halo-Stimmgabel keeps ringing", () => {
    const s = initialState();
    const secret = DOORS.filter((d) => d.secret);
    expect(secret.length).toBeGreaterThanOrEqual(2);
    giveProto(s, "p_weak", { resonanz: 5, quantum: 3 });
    expect(applyPrototype(s, "p_weak", secret[0]!.id).ok).toBe(false);
    giveProto(s, "p_gabel", { resonanz: 7, quantum: 7 }, { archetype: "halo_stimmgabel" });
    for (const d of secret.slice(0, 2)) {
      expect(doorIsOpen(s, d)).toBe(false);
      const r = applyPrototype(s, "p_gabel", d.id);
      expect(r.ok).toBe(true);
      expect(r.family).toBe("resonanzschluessel");
      expect(r.opened).toBe(d.id);
      expect(doorIsOpen(s, d)).toBe(true);
    }
    expect(count(s, "p_gabel")).toBe(1);
  });

  it("Reanimation wakes a bot with a prototype instead of the part — rewards included", () => {
    const s = initialState();
    const x0 = NPCS.find((n) => n.id === "x0r8t")!;
    expect(evalCond(s, x0.visible)).toBe(true);
    const slice = PICKUPS.find(
      (p) => p.hidden && "flag" in p.hidden && p.hidden.flag === "bot_x0r8t_awake",
    )!;
    expect(pickupVisible(s, slice)).toBe(false);
    giveProto(s, "p_sender", { signal: 7 });
    const r = applyPrototype(s, "p_sender", "x0r8t");
    expect(r.ok).toBe(true);
    expect(r.family).toBe("reanimation");
    expect(r.dialogue.length).toBeGreaterThan(0);
    expect(s.flags.bot_x0r8t_awake).toBe(true);
    expect(s.insights.x0r8t_relay).toBeTruthy();
    expect(pickupVisible(s, slice)).toBe(true);
    // Bots that need a device, not a part, are not woken by a prototype.
    giveProto(s, "p_golem", { mechanik: 7, resonanz: 6 }, { archetype: "resonanzgolem" });
    expect(applyPrototype(s, "p_golem", "f1ndr").ok).toBe(false);
    // … but the golem stands in for any part.
    const b4 = NPCS.find((n) => n.id === "b4c0n")!;
    if (evalCond(s, b4.visible)) {
      expect(applyPrototype(s, "p_golem", "b4c0n").ok).toBe(true);
      expect(s.flags.bot_b4c0n_awake).toBe(true);
    }
  });

  it("Kohärenz at the Infinity-Forge reads the Halo state (alternative ending path)", () => {
    const s = initialState();
    giveProto(s, "p_q", { quantum: 9, resonanz: 4 });
    expect(s.insights.halo_zustand).toBeFalsy();
    const r = applyPrototype(s, "p_q", "infinity_forge");
    expect(r.ok, r.message).toBe(true);
    expect(r.family).toBe("kohaerenz");
    expect(s.insights.halo_zustand).toBeTruthy();
    // Portal: only once built.
    giveProto(s, "p_q2", { quantum: 9, resonanz: 4 });
    expect(applyPrototype(s, "p_q2", "TLP-001").ok).toBe(false);
    build(s, "TLP-001");
    expect(applyPrototype(s, "p_q2", "TLP-001").ok).toBe(true);
    expect(s.insights.sigma17).toBeTruthy();
  });
});

describe("usePrototype — safety", () => {
  it("never touches authored or protected items, unknown targets or missing prototypes", () => {
    const s = initialState();
    addItem(s, "schraubendreher", 1);
    addItem(s, "energiezelle", 3);
    build(s, "CLK-001");
    expect(applyPrototype(s, "schraubendreher", "CLK-001").ok).toBe(false);
    expect(applyPrototype(s, "energiezelle", "CLK-001").ok).toBe(false);
    expect(count(s, "schraubendreher")).toBe(1);
    expect(count(s, "energiezelle")).toBe(3);
    giveProto(s, "p_x", { energie: 9 });
    expect(applyPrototype(s, "p_x", "gibt_es_nicht").ok).toBe(false);
    expect(applyPrototype(s, "p_nope", "CLK-001").ok).toBe(false);
    expect(count(s, "p_x")).toBe(1);
  });

  it("a failed use explains what the prototype is good for and consumes nothing", () => {
    const s = initialState();
    giveProto(s, "p_x", { energie: 9 });
    const r = applyPrototype(s, "p_x", "x0r8t");
    expect(r.ok).toBe(false);
    expect(r.lines.join(" ")).toMatch(/Charge/);
    expect(count(s, "p_x")).toBe(1);
  });

  it("forcing a family picks that effect or fails", () => {
    const s = initialState();
    build(s, "CLK-001");
    giveProto(s, "p_multi", { energie: 9, signal: 7 });
    expect(applyPrototype(s, "p_multi", "CLK-001", "peilung").family).toBe("peilung");
    giveProto(s, "p_multi2", { energie: 9, signal: 7 });
    expect(applyPrototype(s, "p_multi2", "CLK-001", "kohaerenz").ok).toBe(false);
  });

  it("usePrototype is the same function as applyPrototype", () => {
    expect(usePrototype).toBe(applyPrototype);
  });
});

describe("discoverability", () => {
  it("prototypeUseOptions lists what would work at a target, best first, without mutating", () => {
    const s = initialState();
    build(s, "CLK-001");
    giveProto(s, "p_e", { energie: 8 });
    giveProto(s, "p_s", { signal: 9 });
    giveProto(s, "p_nix", { mechanik: 2 });
    const snap = JSON.stringify(s);
    const opts = prototypeUseOptions(s, "CLK-001");
    expect(JSON.stringify(s)).toBe(snap);
    expect(opts.map((o) => o.protoId)).toEqual(["p_s", "p_e"]);
    expect(opts[0]!.family).toBe("peilung");
    expect(opts[1]!.familyName).toBe("Charge");
    expect(opts.every((o) => o.consumes)).toBe(true);
  });

  it("prototypeHint nudges towards an untried effect, and the MCP falls back to it", () => {
    const s = initialState();
    expect(prototypeHint(s)).toBeUndefined();
    giveProto(s, "p_e", { energie: 8 });
    expect(prototypeHint(s)).toMatch(/Charge/);
    s.flags[protoEffectFlag("ladung")] = true;
    // Energie 8 also stands in for B4C-0N's battery.
    expect(prototypeHint(s)).toMatch(/Reanimation/);
    s.flags[protoEffectFlag("reanimation")] = true;
    expect(prototypeHint(s)).toBeUndefined();
    expect(typeof hint(s)).toBe("string");
  });

  it("combined archetype prototypes carry their archetype into use", () => {
    const g: Record<string, ItemDef> = {};
    const r = combine({ abstractum: 1, exotische_materie: 2 }, g);
    expect(archetypeOf(r.output)?.id).toBe("singularitaet");
  });
});
