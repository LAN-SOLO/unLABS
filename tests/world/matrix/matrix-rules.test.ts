import { describe, expect, it } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import { initialState, power } from "@/lib/world/game";
import {
  ARCHIVE_TOKENS,
  TOKENS_BY_LINE,
  rarityOf,
  sliceCode,
  tokenById,
} from "@/lib/world/matrix/archive";
import {
  HISTORY_DAYS,
  HISTORY_END,
  HISTORY_START,
  chainStateAt,
  dateOf,
  dayAt,
  indexOf,
  monochromeDays,
} from "@/lib/world/matrix/history";
import {
  FIELD_COST,
  MAX_HOURS,
  MIN_HOURS,
  autoArrange,
  composeBlock,
  crystalMotion,
  dismantleCrystal,
  finishExtraction,
  freeSlices,
  lineChances,
  outcomeOf,
  sanitizeMatrix,
  saveCrystal,
  startBlock,
  startExtraction,
} from "@/lib/world/matrix/rules";
import type { MatrixField, WorldState } from "@/lib/world/types";

const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 1, 12);

/** A finished lab: every device built and switched on. */
function fullLab(): WorldState {
  const s = initialState();
  for (const d of DEVICES) {
    s.built[d.id] = d.stages.length;
    s.switchedOn[d.id] = true;
  }
  return s;
}

function feed(s: WorldState, field: MatrixField, times = 1): void {
  for (const [id, n] of Object.entries(FIELD_COST[field]))
    s.inventory[id] = (s.inventory[id] ?? 0) + n * times;
}

describe("unETH archive", () => {
  it("holds exactly the released captures", () => {
    expect(ARCHIVE_TOKENS).toHaveLength(880);
    expect(TOKENS_BY_LINE.mono).toHaveLength(160);
    expect(TOKENS_BY_LINE.pure).toHaveLength(630);
    expect(TOKENS_BY_LINE.rgb).toHaveLength(90);
    expect(new Set(ARCHIVE_TOKENS.map((t) => t.id)).size).toBe(880);
  });

  it("knows the reference captures", () => {
    expect(tokenById(1)!.line).toBe("pure");
    expect(rarityOf(tokenById(1)!)).toBe("common");
    expect(tokenById(31)!.line).toBe("rgb");
    expect(tokenById(961)!.line).toBe("mono");
    expect(rarityOf(tokenById(961)!)).toBe("legendary");
    expect(tokenById(89)!.traits.color).toBe("orange");
    expect(sliceCode(89, 7)).toBe("SLC#0089-07");
  });
});

describe("ETH ledger", () => {
  it("covers the genesis to the past, day by day, nothing from the future", () => {
    expect(HISTORY_START).toBe("2015-07-30");
    expect(HISTORY_DAYS).toBeGreaterThan(4000);
    expect(dateOf(HISTORY_DAYS - 1)).toBe(HISTORY_END);
    expect(HISTORY_END < new Date().toISOString().slice(0, 10)).toBe(true);
    expect(indexOf("2016-06-17")).toBeGreaterThan(0);
    expect(indexOf("2015-07-29")).toBe(-1);
    // Heights grow, no market before the first trade.
    expect(dayAt(HISTORY_DAYS - 1).height).toBeGreaterThan(dayAt(0).height);
    expect(dayAt(indexOf("2015-08-01")).priceUsd).toBe(0);
    expect(dayAt(indexOf("2017-12-31")).priceUsd).toBeGreaterThan(100);
  });

  it("has rare monochrome days (the DAO hack among them)", () => {
    const days = monochromeDays().map(dateOf);
    expect(days.length).toBeGreaterThan(5);
    expect(days.length).toBeLessThan(HISTORY_DAYS / 50);
    expect(days).toContain("2016-06-17");
  });
});

describe("extraction", () => {
  it("sleeps until every device is built", () => {
    const s = initialState();
    feed(s, 1);
    expect(startBlock(s, 1, "2018-03-07")).toBe("asleep");
  });

  it("checks the day, the power and the materials", () => {
    const s = fullLab();
    expect(startBlock(s, 1, "2015-01-01")).toBe("day");
    expect(startBlock(s, 1, "2018-03-07")).toBe("materials");
    feed(s, 1);
    expect(power(s).generation).toBeGreaterThanOrEqual(60);
    expect(startBlock(s, 1, "2018-03-07")).toBe(null);
  });

  it("runs on wall-clock time for 2…24 h and finishes even after the game was closed", () => {
    const s = fullLab();
    feed(s, 1);
    expect(startExtraction(s, 1, "2018-03-07", T0, () => 0.5)).toBe(null);
    expect(s.inventory.halo_kristall ?? 0).toBe(0);
    const j = s.matrix.job!;
    expect(j.end - j.start).toBeGreaterThanOrEqual(MIN_HOURS * H);
    expect(j.end - j.start).toBeLessThanOrEqual(MAX_HOURS * H);
    expect(startBlock(s, 1, "2018-03-07")).toBe("busy");
    expect(finishExtraction(s, j.end - 1)).toBe(null);
    // Two days later (game closed in between): done.
    const slice = finishExtraction(s, j.end + 48 * H)!;
    expect(slice).toBeTruthy();
    expect(slice.at).toBe(j.end);
    expect(tokenById(slice.token)).toBeTruthy();
    expect(slice.pos).toBeGreaterThanOrEqual(1);
    expect(slice.pos).toBeLessThanOrEqual(30);
    expect(s.matrix.job).toBe(null);
    expect(s.matrix.slices).toHaveLength(1);
  });

  it("decides the outcome by seed, independent of the duration", () => {
    const job = { seed: 1234, field: 3 as MatrixField, day: "2018-03-07" };
    expect(outcomeOf(job)).toEqual(outcomeOf(job));
  });

  it("gates the lines: RGB needs field 4, mono field 5 on a monochrome day", () => {
    const normal = "2018-03-07";
    const mono = "2016-06-17";
    expect(chainStateAt(indexOf(normal)).mono).toBe(false);
    expect(chainStateAt(indexOf(mono)).mono).toBe(true);
    const lines = (field: MatrixField, day: string) => {
      const seen = new Set<string>();
      for (let seed = 1; seed < 3000; seed++) seen.add(outcomeOf({ seed, field, day }).line);
      return seen;
    };
    expect([...lines(3, mono)]).toEqual(["pure"]);
    expect(lines(4, mono).has("rgb")).toBe(true);
    expect(lines(4, mono).has("mono")).toBe(false);
    expect(lines(5, normal).has("mono")).toBe(false);
    expect(lines(5, mono).has("mono")).toBe(true);
    const c = lineChances(5, chainStateAt(indexOf(mono)));
    expect(c.mono).toBeLessThan(c.rgb);
    expect(c.rgb).toBeLessThan(c.pure);
  });
});

describe("composer", () => {
  function withSlices(list: [number, number][]): WorldState {
    const s = fullLab();
    for (const [token, pos] of list)
      s.matrix.slices.push({
        uid: `m${s.matrix.next++}`,
        token,
        pos,
        at: T0,
        day: "2018-03-07",
        field: 1,
      });
    return s;
  }

  it("turns when one capture fills every position in order", () => {
    const s = withSlices(Array.from({ length: 30 }, (_, i) => [89, i + 1] as [number, number]));
    const slots = autoArrange(s);
    expect(crystalMotion(s, slots)).toBe("turning");
    const c = saveCrystal(s, "Orange", slots, T0)!;
    expect(c).toBeTruthy();
    expect(freeSlices(s)).toHaveLength(0);
    expect(dismantleCrystal(s, c.id)).toBe(true);
    expect(freeSlices(s)).toHaveLength(30);
  });

  it("knows still and exotic arrangements and refuses double use", () => {
    const s = withSlices([
      [89, 5],
      [89, 5],
      [1, 2],
    ]);
    const [a, b, c] = s.matrix.slices.map((x) => x.uid);
    const slots: (string | null)[] = Array.from({ length: 30 }, () => null);
    slots[0] = a!;
    slots[1] = b!;
    expect(crystalMotion(s, slots)).toBe("still");
    slots[2] = c!;
    expect(crystalMotion(s, slots)).toBe("exotic");
    const twice = [...slots];
    twice[3] = a!;
    expect(composeBlock(s, twice)).toBe("twice");
    saveCrystal(s, "", slots, T0);
    expect(composeBlock(s, slots)).toBe("taken");
    expect(
      composeBlock(
        s,
        Array.from({ length: 30 }, () => null),
      ),
    ).toBe("empty");
  });
});

describe("save robustness", () => {
  it("rebuilds the chamber from garbage and drops impossible data", () => {
    expect(sanitizeMatrix(null)).toEqual({ job: null, slices: [], crystals: [], next: 1 });
    const m = sanitizeMatrix({
      next: 9,
      job: { start: T0, end: T0 + 100 * H, field: 2, day: "2018-03-07", seed: 1 }, // > 24 h
      slices: [
        { uid: "m1", token: 89, pos: 3, at: T0, day: "2018-03-07", field: 1 },
        { uid: "m1", token: 89, pos: 4, at: T0, day: "2018-03-07", field: 1 }, // duplicate uid
        { uid: "m2", token: 99999, pos: 3, at: T0, day: "2018-03-07", field: 1 }, // unknown token
        { uid: "m3", token: 1, pos: 31, at: T0, day: "2018-03-07", field: 1 }, // bad position
      ],
      crystals: [
        { id: "k1", name: "a", slots: ["m1", ...Array(29).fill(null)], at: T0 },
        { id: "k2", name: "b", slots: ["m1", ...Array(29).fill(null)], at: T0 }, // m1 taken
      ],
    });
    expect(m.next).toBe(9);
    expect(m.job).toBe(null);
    expect(m.slices.map((x) => x.uid)).toEqual(["m1"]);
    expect(m.crystals.map((c) => c.id)).toEqual(["k1"]);
  });
});
