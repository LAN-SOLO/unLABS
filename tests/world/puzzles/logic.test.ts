import { describe, expect, it } from "vitest";
import {
  bitsEqual,
  colParities,
  coolantMix,
  coolantOk,
  generateCrc,
  generateLights,
  generatePipes,
  heatStep,
  inZone,
  HEAT_ZONE,
  lightsToggle,
  lissajousMatches,
  num,
  nums,
  pipeFlow,
  PRESSURE_ZONE,
  rotateMask,
  rowParities,
  str,
  strs,
  vigenereDecrypt,
  vigenereEncrypt,
} from "@/components/world/puzzles/logic";
import { mulberry32 } from "@/components/world/puzzles/rng";
import { PUZZLES } from "@/lib/world/content/puzzles";

describe("rng", () => {
  it("is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
});

describe("param helpers", () => {
  const p = { a: 3, b: "x", c: [1, 2], d: ["q"] };
  it("narrows values and falls back", () => {
    expect(num(p, "a", 0)).toBe(3);
    expect(num(p, "b", 7)).toBe(7);
    expect(str(p, "b", "")).toBe("x");
    expect(nums(p, "c", [])).toEqual([1, 2]);
    expect(nums(p, "d", [9])).toEqual([9]);
    expect(strs(p, "d", [])).toEqual(["q"]);
    expect(strs(p, "missing", ["f"])).toEqual(["f"]);
  });
});

describe("vigenere", () => {
  it("roundtrips and keeps spaces", () => {
    const plain = "DER HALO IST KEIN ORT";
    const c = vigenereEncrypt(plain, "HALO");
    expect(c).not.toBe(plain);
    expect(c.split(" ").map((w) => w.length)).toEqual(plain.split(" ").map((w) => w.length));
    expect(vigenereDecrypt(c, "halo")).toBe(plain);
    expect(vigenereDecrypt(c, "HALX")).not.toBe(plain);
  });

  it("key advances only on letters", () => {
    expect(vigenereEncrypt("A A", "BC")).toBe("B C");
  });
});

describe("pipes", () => {
  it("rotates masks clockwise", () => {
    expect(rotateMask(1, 1)).toBe(2);
    expect(rotateMask(8, 1)).toBe(1);
    expect(rotateMask(5, 2)).toBe(5);
  });

  for (const [size, seed] of [
    [6, 847],
    [4, 1],
    [7, 12345],
    [5, 99],
  ]) {
    it(`generated puzzle (size ${size}, seed ${seed}) is solvable and scrambled`, () => {
      const p = generatePipes(size, seed);
      expect(p.kinds).toHaveLength(size * size);
      expect(pipeFlow(p.size, p.kinds, p.solution, p.sourceRow, p.sinkRow).solved).toBe(true);
      expect(pipeFlow(p.size, p.kinds, p.start, p.sourceRow, p.sinkRow).solved).toBe(false);
      expect(generatePipes(size, seed)).toEqual(p);
    });
  }
});

describe("lights-out", () => {
  it("start is solvable by re-applying the same presses", () => {
    const p = generateLights(5, 2003);
    expect(p.start.some(Boolean)).toBe(true);
    let board = p.start;
    for (const idx of p.presses) board = lightsToggle(board, p.size, idx);
    expect(board.every((v) => !v)).toBe(true);
  });

  it("toggles a cell and its neighbours", () => {
    const b = lightsToggle(new Array<boolean>(9).fill(false), 3, 0);
    expect(b.map((v) => (v ? 1 : 0))).toEqual([1, 1, 0, 1, 0, 0, 0, 0, 0]);
  });
});

describe("crc", () => {
  it("original has consistent parity; flipped matrix does not", () => {
    const p = generateCrc(6, 8, 89);
    expect(rowParities(p.original, p.rows, p.cols)).toEqual(p.rowParity);
    expect(colParities(p.original, p.rows, p.cols)).toEqual(p.colParity);
    expect(rowParities(p.corrupted, p.rows, p.cols)).not.toEqual(p.rowParity);
    expect(colParities(p.corrupted, p.rows, p.cols)).not.toEqual(p.colParity);
    expect(bitsEqual(p.original, p.corrupted)).toBe(false);
    const fixed = p.corrupted.slice();
    fixed[p.flipped] ^= 1;
    expect(bitsEqual(fixed, p.original)).toBe(true);
  });
});

describe("lissajous", () => {
  it("matches ratio and phase modulo 360", () => {
    expect(lissajousMatches("3:4", 90, "3:4", 90)).toBe(true);
    expect(lissajousMatches("3:4", 450, "3:4", 90)).toBe(true);
    expect(lissajousMatches("2:3", 90, "3:4", 90)).toBe(false);
    expect(lissajousMatches("3:4", 75, "3:4", 90)).toBe(false);
  });
});

describe("coolant", () => {
  it("has an integer solution for -12 °C", () => {
    let found = false;
    for (let g = 0; g <= 10; g++)
      for (let n = 0; n <= 10; n++)
        for (let w = 0; w <= 10; w++) if (coolantOk(coolantMix([g, n, w]), -12)) found = true;
    expect(found).toBe(true);
    expect(coolantOk(coolantMix([0, 0, 0]), -12)).toBe(false);
  });
});

describe("heat", () => {
  it("a steady lever with anticipation can keep both gauges green", () => {
    let s = { heat: 20, pressure: 10 };
    let best = 0;
    let run = 0;
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 30; i++) {
      const t = i * dt;
      // Counter the disturbance a bit ahead of time.
      const lever = 63 - (7 * Math.sin(0.55 * (t + 0.6)) + 4 * Math.sin(1.7 * (t + 0.6) + 1.3));
      s = heatStep(s, lever, t, dt);
      run = inZone(s.heat, HEAT_ZONE) && inZone(s.pressure, PRESSURE_ZONE) ? run + dt : 0;
      best = Math.max(best, run);
    }
    expect(best).toBeGreaterThan(4);
  });
});

describe("content", () => {
  it("every puzzle kind has usable params", () => {
    for (const p of PUZZLES) {
      if (p.kind === "keypad") expect(str(p.params, "code", "")).toMatch(/^\d{4}$/);
      if (p.kind === "tones") {
        // Four-tone sequences, and Damien's six-note studio song (pz_studio_door).
        const n = nums(p.params, "tones", []).length;
        expect(n).toBeGreaterThanOrEqual(4);
        expect(n).toBeLessThanOrEqual(8);
      }
      if (p.kind === "temporal") {
        const lines = strs(p.params, "lines", []);
        expect(num(p.params, "answer", -1)).toBeLessThan(lines.length);
      }
    }
  });
});
