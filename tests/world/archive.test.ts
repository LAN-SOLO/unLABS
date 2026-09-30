/**
 * The lab archive: spots exist, find modes are consistent, and the balance
 * rule holds — far-reaching knowledge is never lying around in plain sight.
 */
import { describe, expect, it } from "vitest";
import {
  ARCHIVE,
  ARCHIVE_BY_ID,
  SEARCHABLE_DECOR,
  combine,
  entriesAt,
  normAnswer,
  openCombos,
  visitSpot,
} from "@/lib/world/archive";
import type { ArchiveEntry, ArchiveRef } from "@/lib/world/content/archive";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { interiorFor } from "@/lib/world/content/interior";
import { SECRET_RECIPES } from "@/lib/world/content/items";
import { DOORS, NOTES, PROPS, ROOM_BY_ID } from "@/lib/world/content/map";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { ROOM_TERMINALS } from "@/lib/world/content/terminals";
import { BOT_QUESTS, ENDINGS, INSIGHT_BY_ID } from "@/lib/world/content/story";
import { evalCond, initialState } from "@/lib/world/game";
import type { FloorId } from "@/lib/world/types";
import { play, visitArchive } from "./simPlayer";

const DECOR = new Map(
  ([0, 1, 2, 3, 4, 5] as FloorId[]).flatMap((f) => interiorFor(f).map((p) => [p.id, p] as const)),
);

describe("archive content", () => {
  it("has unique ids", () => {
    expect(ARCHIVE_BY_ID.size).toBe(ARCHIVE.length);
  });

  it("every spot exists", () => {
    for (const e of ARCHIVE) {
      if (!e.at) continue;
      const a = e.at;
      if ("decor" in a) expect(DECOR.has(a.decor), `${e.id}: decor ${a.decor}`).toBe(true);
      if ("prop" in a)
        expect(
          PROPS.some((p) => p.id === a.prop),
          `${e.id}: prop ${a.prop}`,
        ).toBe(true);
      if ("device" in a)
        expect(DEVICE_BY_ID.has(a.device), `${e.id}: device ${a.device}`).toBe(true);
      if ("terminal" in a)
        expect(
          ROOM_TERMINALS.some((t) => t.id === a.terminal),
          `${e.id}: terminal ${a.terminal}`,
        ).toBe(true);
      if ("note" in a)
        expect(
          NOTES.some((n) => n.id === a.note),
          `${e.id}: note ${a.note}`,
        ).toBe(true);
    }
  });

  it("find modes are consistent with their spots", () => {
    for (const e of ARCHIVE) {
      if (e.find === "combine") {
        expect(e.at, `${e.id}: combine entries have no spot`).toBeUndefined();
        expect(e.needs?.length ?? 0, `${e.id}: needs ≥ 2`).toBeGreaterThanOrEqual(2);
        expect(e.answer && e.prompt, `${e.id}: answer + prompt`).toBeTruthy();
        for (const n of e.needs ?? [])
          expect(ARCHIVE_BY_ID.has(n), `${e.id} needs ${n}`).toBe(true);
        continue;
      }
      expect(e.at, `${e.id}: spot`).toBeDefined();
      if (e.find === "device") expect(e.at && "device" in e.at, `${e.id}: device spot`).toBe(true);
      if (e.find === "search") {
        const pl = e.at && "decor" in e.at ? DECOR.get(e.at.decor) : undefined;
        expect(
          pl && SEARCHABLE_DECOR.has(pl.decor),
          `${e.id}: search spot must be searchable furniture`,
        ).toBe(true);
      }
    }
  });

  it("granted insights exist", () => {
    for (const e of ARCHIVE)
      for (const g of e.grants ?? []) expect(INSIGHT_BY_ID.has(g), `${e.id}: ${g}`).toBe(true);
  });

  it("balance: the more an entry reveals, the harder it is to find", () => {
    for (const e of ARCHIVE) {
      expect(e.tier, `${e.id}: tier ≥ value − 1`).toBeGreaterThanOrEqual(e.value - 1);
      if (e.value === 5)
        expect(e.tier, `${e.id}: value 5 needs tier ≥ 4`).toBeGreaterThanOrEqual(4);
      if (e.find === "combine")
        expect(e.tier, `${e.id}: combinations are tier ≥ 4`).toBeGreaterThanOrEqual(4);
      if (e.find === "read" && !e.when)
        expect(e.tier, `${e.id}: unconditioned read spots are tier ≤ 2`).toBeLessThanOrEqual(2);
      if (e.tier >= 4 && e.find !== "combine")
        expect(e.when, `${e.id}: tier ≥ 4 spots need an extra condition`).toBeDefined();
    }
  });

  it("combination answers are never written in a single needed entry", () => {
    for (const e of ARCHIVE.filter((x) => x.find === "combine")) {
      const a = normAnswer(e.answer!);
      for (const n of e.needs!) {
        const t = normAnswer(ARCHIVE_BY_ID.get(n)!.text);
        expect(t.includes(a), `${e.id}: answer appears verbatim in ${n}`).toBe(false);
      }
    }
  });
});

describe("archive rules", () => {
  it("read spots give their entries, search finds hidden ones, nothing twice", () => {
    const s = initialState();
    const read = ARCHIVE.find((e) => e.find === "read" && !e.when && e.at);
    if (read?.at) {
      const v = visitSpot(s, read.at, "read");
      expect(v.fresh.map((e) => e.id)).toContain(read.id);
      expect(visitSpot(s, read.at, "read").fresh).toHaveLength(0);
    }
    const hidden = ARCHIVE.find((e) => e.find === "search" && !e.when && e.at);
    if (hidden?.at) {
      expect(visitSpot(s, hidden.at, "read").fresh.map((e) => e.id)).not.toContain(hidden.id);
      expect(visitSpot(s, hidden.at, "search").fresh.map((e) => e.id)).toContain(hidden.id);
      expect(entriesAt(hidden.at).length).toBeGreaterThan(0);
    }
  });

  it("combinations open only after all needs, and only with the right answer", () => {
    const c = ARCHIVE.find((e) => e.find === "combine");
    if (!c) return;
    const s = initialState();
    expect(combine(s, c.answer!)).toHaveLength(0);
    for (const n of c.needs!) s.archive[n] = 1;
    s.tuning = {};
    if (c.when) return; // conditioned combos are exercised by the playthrough
    expect(openCombos(s).map((e) => e.id)).toContain(c.id);
    expect(combine(s, "definitely wrong")).toHaveLength(0);
    expect(combine(s, `  ${c.answer!.toUpperCase()} `).map((e) => e.id)).toContain(c.id);
  });
});

/** Floor an entry's spot lies on (combinations have none). */
function floorOf(e: ArchiveEntry): FloorId | undefined {
  const a = e.at;
  if (!a) return undefined;
  if ("decor" in a) return ROOM_BY_ID.get(a.decor.split(":")[1] ?? "")?.floor;
  if ("prop" in a) return PROPS.find((p) => p.id === a.prop)?.floor;
  if ("note" in a) return NOTES.find((n) => n.id === a.note)?.floor;
  if ("terminal" in a) return ROOM_TERMINALS.find((t) => t.id === a.terminal)?.floor;
  const d = DEVICE_BY_ID.get(a.device);
  return d ? ROOM_BY_ID.get(d.room)?.floor : undefined;
}

const REFS: readonly ArchiveRef[] = ARCHIVE.flatMap((e) => e.about ?? []);
const refers = (kind: ArchiveRef["kind"], id: string): boolean =>
  REFS.some((r) => r.kind === kind && r.id === id);

describe("archive balance and completeness", () => {
  it("every tier has entries; tier 1 ≥ 15 %, tier 5 ≥ 5 %", () => {
    const n = (t: number) => ARCHIVE.filter((e) => e.tier === t).length;
    for (const t of [1, 2, 3, 4, 5]) expect(n(t), `tier ${t}`).toBeGreaterThan(0);
    expect(n(1) / ARCHIVE.length).toBeGreaterThanOrEqual(0.15);
    expect(n(5) / ARCHIVE.length).toBeGreaterThanOrEqual(0.05);
  });

  it("every floor holds at least 12 entries", () => {
    for (const f of [0, 1, 2, 3, 4, 5] as FloorId[]) {
      const k = ARCHIVE.filter((e) => floorOf(e) === f).length;
      expect(k, `floor ${f}`).toBeGreaterThanOrEqual(12);
    }
  });

  it("there are 10+ combinations and most of them join finds from different floors", () => {
    const combos = ARCHIVE.filter((e) => e.find === "combine");
    expect(combos.length).toBeGreaterThanOrEqual(10);
    const cross = combos.filter((c) => {
      const floors = new Set(
        c.needs!.map((n) => floorOf(ARCHIVE_BY_ID.get(n)!)).filter((f) => f !== undefined),
      );
      return floors.size >= 2;
    });
    expect(cross.length / combos.length).toBeGreaterThanOrEqual(0.6);
  });

  it("every keypad code is covered", () => {
    for (const p of PUZZLES.filter((x) => x.kind === "keypad"))
      expect(refers("puzzle", p.id), p.id).toBe(true);
    for (const d of DOORS.filter((x) => x.keypad)) expect(refers("door", d.id), d.id).toBe(true);
  });

  it("every secret door is covered", () => {
    for (const d of DOORS.filter((x) => x.secret)) expect(refers("door", d.id), d.id).toBe(true);
  });

  it("every ending, including the secret one, is covered", () => {
    for (const e of ENDINGS) expect(refers("ending", e.id), e.id).toBe(true);
    // Endings are far-reaching: at least one tier-5 entry spells each one out.
    for (const e of ENDINGS)
      expect(
        ARCHIVE.some((a) => a.tier === 5 && (a.about ?? []).some((r) => r.id === e.id)),
        `tier-5 entry for ${e.id}`,
      ).toBe(true);
  });

  it("every secret recipe is covered", () => {
    for (const r of SECRET_RECIPES) {
      const inputs = Object.keys(r.inputs);
      const hit = REFS.some(
        (x) => x.kind === "recipe" && (x.id === r.output || inputs.every((i) => x.id.includes(i))),
      );
      expect(hit, `${r.output} from ${inputs.join("+")}`).toBe(true);
    }
  });

  it("every puzzle and every bot quest is covered", () => {
    for (const p of PUZZLES) expect(refers("puzzle", p.id), p.id).toBe(true);
    for (const q of BOT_QUESTS) expect(refers("npc", q.npc), q.npc).toBe(true);
  });
});

describe("archive reachability (simulated full playthrough)", () => {
  const run = play();
  const s = run.s;
  // A thorough player sweeps the lab once more at the end.
  for (let i = 0; i < 3; i++) visitArchive(s);

  it("every entry's condition holds by the end of the game", () => {
    const blocked = ARCHIVE.filter((e) => !evalCond(s, e.when)).map((e) => e.id);
    expect(blocked).toEqual([]);
  });

  it("every combination's needs are findable, and every entry is found", () => {
    for (const c of ARCHIVE.filter((e) => e.find === "combine"))
      for (const n of c.needs!) expect(s.archive[n], `${c.id} needs ${n}`).toBeDefined();
    const missing = ARCHIVE.filter((e) => s.archive[e.id] === undefined).map((e) => e.id);
    expect(missing).toEqual([]);
  });
});
