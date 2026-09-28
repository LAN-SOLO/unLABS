/**
 * Every authored puzzle is solvable — in English and in German.
 * ==============================================================
 *
 * `content-defs.test.ts` checks the generator-backed kinds (laser, era,
 * arbitrage, palette, layers, wiring, morse, radio) for the English defs.
 * This file covers the remaining kinds with their *authored* params and runs
 * everything per locale, because some params are translated text (cipher
 * plaintext/key, temporal log lines, radio lines):
 *
 *  - pipes / crc / sigils / lissajous / coolant / valve / heat / tones /
 *    keypad / temporal / hue / ethics / memetic / stencil / clamp / trend /
 *    solder: a concrete solution exists for the authored params;
 *  - cipher: plaintext and key come from the same locale, are pure A–Z, the
 *    key decrypts and is discoverable in that locale's text (HALO margin
 *    notes, the “six letters” hint);
 *  - morse: the signal decodes to the answer in both locales;
 *  - every puzzle (device hooks and pickup puzzles included) is reachable.
 */
import { afterAll, describe, expect, it } from "vitest";
import type { Locale } from "@/lib/i18n";
import type { PuzzleDef } from "@/lib/world/types";
import { loadGame, type LoadedGame } from "../localeGame";

async function loadAll(locale: Locale) {
  const g = await loadGame(locale);
  // Same registry as `g` (no reset in between): engine text follows the locale.
  const logic = await import("@/components/world/puzzles/logic");
  const clamp = await import("@/components/world/puzzles/engine/clamp");
  const ethics = await import("@/components/world/puzzles/engine/ethics");
  const memetic = await import("@/components/world/puzzles/engine/memetic");
  const stencil = await import("@/components/world/puzzles/engine/stencil");
  const solder = await import("@/components/world/puzzles/engine/solder");
  const trend = await import("@/components/world/puzzles/engine/trend");
  const hue = await import("@/components/world/puzzles/engine/hue");
  const morse = await import("@/components/world/puzzles/engine/morse");
  const types = await import("@/lib/world/types");
  return { g, logic, clamp, ethics, memetic, stencil, solder, trend, hue, morse, types };
}

type All = Awaited<ReturnType<typeof loadAll>>;

const loaded: Partial<Record<Locale, All>> = {};

afterAll(() => {
  for (const a of Object.values(loaded)) a?.g.i18n.__setLocaleForTests(null);
});

/** Everything a player can read in this locale (to find codes and keys). */
function readableText(g: LoadedGame): string {
  return [
    ...g.map.NOTES.map((n) => `${n.title}\n${n.body}`),
    ...g.story.INSIGHTS.map((i) => `${i.title}\n${i.text}`),
    ...g.story.NPCS.flatMap((n) => [
      ...n.greeting.map((l) => l.text),
      ...n.options.flatMap((o) => o.lines.map((l) => l.text)),
    ]),
    ...g.puzzles.PUZZLES.map((p) => p.intro),
    ...g.map.PROPS.map((p) => `${p.label}\n${p.requiresHint ?? ""}`),
  ].join("\n");
}

/**
 * A valve controller that cancels the disturbance must hold the band long
 * enough — with the UI's limits (±40 control units, 45 units/s via the keys).
 */
function valveHeld(a: All, low: number, high: number, hold: number): boolean {
  const { valveDisturbance, valveStep } = a.logic;
  const mid = (low + high) / 2;
  let v = 50;
  let control = 0;
  let run = 0;
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 30; i++) {
    const t = i * dt;
    const want = Math.max(-40, Math.min(40, mid - 50 - valveDisturbance(t)));
    control += Math.max(-45 * dt, Math.min(45 * dt, want - control));
    v = valveStep(v, control, t, dt);
    run = v >= low && v <= high ? run + dt : 0;
    if (run >= hold) return true;
  }
  return false;
}

function heatHeld(a: All, hold: number): boolean {
  const { heatStep, inZone, HEAT_ZONE, PRESSURE_ZONE } = a.logic;
  let s = { heat: 20, pressure: 10 };
  let run = 0;
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 40; i++) {
    const t = i * dt;
    const lever = 63 - (7 * Math.sin(0.55 * (t + 0.6)) + 4 * Math.sin(1.7 * (t + 0.6) + 1.3));
    s = heatStep(s, lever, t, dt);
    run = inZone(s.heat, HEAT_ZONE) && inZone(s.pressure, PRESSURE_ZONE) ? run + dt : 0;
    if (run >= hold) return true;
  }
  return false;
}

/** Hold the iron from preheat and release inside the pad's window (60 fps). */
function solderable(a: All, pad: { lo: number; hi: number }): boolean {
  let t = a.solder.PREHEAT;
  for (let i = 0; i < 60 * 20; i++) {
    t = a.solder.heatStep(t, true, 1 / 60);
    if (a.solder.releaseResult(t, pad) === "ok") return true;
    if (t > pad.hi) return false;
  }
  return false;
}

function checkPuzzle(a: All, p: PuzzleDef, text: string): void {
  const { num, str, nums, strs } = a.logic;
  const pr = p.params;
  switch (p.kind) {
    case "pipes": {
      const g = a.logic.generatePipes(num(pr, "size", 6), num(pr, "seed", 1));
      const flow = (rots: readonly number[]) =>
        a.logic.pipeFlow(g.size, g.kinds, rots, g.sourceRow, g.sinkRow).solved;
      expect(flow(g.solution), "solution flows").toBe(true);
      expect(flow(g.start), "start is scrambled").toBe(false);
      break;
    }
    case "crc": {
      const g = a.logic.generateCrc(num(pr, "rows", 6), num(pr, "cols", 8), num(pr, "seed", 1));
      const rows = a.logic.rowParities(g.corrupted, g.rows, g.cols);
      const cols = a.logic.colParities(g.corrupted, g.rows, g.cols);
      expect(rows.filter((v, i) => v !== g.rowParity[i])).toHaveLength(1);
      expect(cols.filter((v, i) => v !== g.colParity[i])).toHaveLength(1);
      const fixed = g.corrupted.slice();
      fixed[g.flipped] = fixed[g.flipped] === 1 ? 0 : 1;
      expect(a.logic.bitsEqual(fixed, g.original)).toBe(true);
      break;
    }
    case "sigils": {
      const g = a.logic.generateLights(
        num(pr, "size", 5),
        num(pr, "seed", 1),
        num(pr, "presses", 8),
      );
      expect(g.start.some(Boolean), "not already dark").toBe(true);
      let board = g.start;
      for (const i of g.presses) board = a.logic.lightsToggle(board, g.size, i);
      expect(
        board.every((v) => !v),
        "the presses clear the board",
      ).toBe(true);
      break;
    }
    case "lissajous": {
      const ratio = str(pr, "ratio", "3:4");
      const phase = num(pr, "phase", 90);
      expect(a.logic.LISSAJOUS_RATIOS as readonly string[]).toContain(ratio);
      expect(phase % 15, "phase is on the 15° dial").toBe(0);
      expect(a.logic.lissajousMatches(ratio, phase, ratio, phase)).toBe(true);
      const start = a.logic.lissajousStartPhase(ratio, phase);
      expect(a.logic.lissajousMatches(ratio, start, ratio, phase)).toBe(false);
      break;
    }
    case "coolant": {
      const target = num(pr, "target", -12);
      let found = false;
      for (let x = 0; x <= 10 && !found; x++)
        for (let y = 0; y <= 10 && !found; y++)
          for (let z = 0; z <= 10 && !found; z++)
            found = a.logic.coolantOk(a.logic.coolantMix([x, y, z]), target);
      expect(found, `a mix for ${target} °C`).toBe(true);
      break;
    }
    case "valve": {
      const low = num(pr, "low", 42);
      const high = num(pr, "high", 58);
      expect(low).toBeLessThan(high);
      expect(valveHeld(a, low, high, num(pr, "hold", 3))).toBe(true);
      break;
    }
    case "heat":
      expect(heatHeld(a, num(pr, "hold", 4))).toBe(true);
      break;
    case "tones": {
      const scale = nums(pr, "scale", []);
      const tones = nums(pr, "tones", []);
      expect(tones).toHaveLength(4);
      for (const t of tones) expect(t >= 0 && t < scale.length && Number.isInteger(t)).toBe(true);
      break;
    }
    case "keypad": {
      const code = str(pr, "code", "");
      expect(code).toMatch(/^\d{4}$/);
      // The code must be findable in the player's language (as digits or a time).
      const time = `${code.slice(0, 2)}:${code.slice(2)}`;
      expect(text.includes(code) || text.includes(time), `${code} readable somewhere`).toBe(true);
      break;
    }
    case "temporal": {
      const lines = strs(pr, "lines", []);
      const answer = num(pr, "answer", -1);
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(answer >= 0 && answer < lines.length).toBe(true);
      break;
    }
    case "hue": {
      const rounds = num(pr, "rounds", 3);
      expect(a.types.SPECTRUM as readonly string[]).toContain(str(pr, "target", ""));
      expect(a.hue.spectrumIndex(str(pr, "target", ""))).toBeGreaterThanOrEqual(0);
      expect(nums(pr, "tolerances", []).length).toBeGreaterThanOrEqual(rounds);
      expect(nums(pr, "speeds", []).length).toBeGreaterThanOrEqual(rounds);
      for (const tol of nums(pr, "tolerances", [])) expect(tol).toBeGreaterThan(0);
      break;
    }
    case "ethics": {
      const pairs = num(pr, "pairs", 6);
      expect(pairs).toBeGreaterThanOrEqual(a.ethics.ETHICS_MIN_PAIRS);
      expect(pairs).toBeLessThanOrEqual(
        Math.min(a.ethics.ETHICS_MAX_PAIRS, a.ethics.ETHICS_PAIRS.length),
      );
      const cards = a.ethics.dealEthics(num(pr, "seed", 89), pairs);
      expect(cards).toHaveLength(pairs * 2);
      for (const c of cards) {
        expect(c.text.trim().length).toBeGreaterThan(10);
        expect(cards.filter((d) => a.ethics.isMatch(c, d))).toHaveLength(1);
      }
      break;
    }
    case "memetic": {
      const radius = num(pr, "radius", 0.08);
      expect(radius).toBeGreaterThanOrEqual(0.03);
      const target = a.memetic.memeticTarget(num(pr, "seed", 1016));
      expect(a.memetic.inTargetZone(target, target, radius)).toBe(true);
      expect(a.memetic.inTargetZone(a.memetic.CENTROID, target, radius)).toBe(false);
      break;
    }
    case "stencil": {
      const shape = str(pr, "shape", "hex");
      expect(a.stencil.parseShape(shape)).toBe(shape);
      const g = a.stencil.generateStencil(num(pr, "seed", 3), a.stencil.parseShape(shape));
      expect(g.path.length - 1).toBeGreaterThanOrEqual(a.stencil.STENCIL_MIN_STEPS);
      expect(g.path.length - 1).toBeLessThanOrEqual(a.stencil.STENCIL_MAX_STEPS);
      expect(num(pr, "maxStress", 15)).toBeGreaterThanOrEqual(3);
      break;
    }
    case "clamp": {
      const seed = num(pr, "seed", 2008);
      const noise = num(pr, "noise", 0.2);
      let prev: ReturnType<typeof a.clamp.makeWave>["kind"] | undefined;
      for (let r = 0; r < num(pr, "rounds", 3); r++) {
        const w = a.clamp.makeWave(seed, r, 0, noise, prev);
        expect(a.clamp.bestClamp(w.samples), `round ${r}`).toBe(w.kind);
        prev = w.kind;
      }
      break;
    }
    case "trend": {
      const streak = num(pr, "streak", 5);
      expect(streak).toBeGreaterThanOrEqual(1);
      expect(num(pr, "window", 3)).toBeGreaterThanOrEqual(1);
      for (let r = 0; r < streak; r++) {
        const t = a.trend.trendRound(num(pr, "seed", 512), r, num(pr, "noise", 0.3));
        const end = t.continuation[t.continuation.length - 1]!;
        expect(end > t.history[t.history.length - 1]! ? "cw" : "ccw").toBe(t.answer);
      }
      break;
    }
    case "solder": {
      const b = a.solder.generateBoard(
        num(pr, "seed", 38),
        num(pr, "pads", 6),
        num(pr, "width", 14),
      );
      expect(b.pads).toHaveLength(num(pr, "pads", 6));
      for (const pad of b.pads) expect(solderable(a, pad), `${pad.lo}–${pad.hi} °C`).toBe(true);
      break;
    }
    case "cipher": {
      const key = str(pr, "key", "");
      const plain = str(pr, "plain", "");
      expect(key).toMatch(/^[A-Z]+$/);
      expect(plain, "plaintext is pure A–Z (no umlauts that leak through)").toMatch(/^[A-Z ]+$/);
      const c = a.logic.vigenereEncrypt(plain, key);
      expect(c).not.toBe(plain);
      expect(a.logic.vigenereDecrypt(c, key)).toBe(plain);
      expect(a.logic.vigenereDecrypt(c, key.slice(1) + key[0])).not.toBe(plain);
      break;
    }
    case "morse": {
      const sol = a.morse.morseSolution(str(pr, "signal", ""), nums(pr, "groups", []));
      expect(sol.answer).toBe(str(pr, "answer", "LOVW"));
      break;
    }
    case "radio":
      expect(str(pr, "line", "").trim().length).toBeGreaterThan(10);
      break;
    default:
      // Covered by content-defs.test.ts (generator-backed kinds).
      expect(p.title.length).toBeGreaterThan(0);
  }
}

for (const locale of ["en", "de"] as const) {
  describe(`authored puzzles (${locale})`, () => {
    const all = async (): Promise<All> => {
      loaded[locale] ??= await loadAll(locale);
      return loaded[locale]!;
    };

    it("load in the right language", async () => {
      const a = await all();
      const cipher = a.g.puzzles.PUZZLE_BY_ID.get("pz_cipher")!;
      expect(
        a.logic.str(cipher.params, "plain", "").startsWith(locale === "de" ? "DER" : "THE"),
      ).toBe(true);
    });

    it("every puzzle has a concrete solution for its authored params", async () => {
      const a = await all();
      const text = readableText(a.g);
      for (const p of a.g.puzzles.PUZZLES) {
        try {
          checkPuzzle(a, p, text);
        } catch (e) {
          throw new Error(`${p.id} (${p.kind}): ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    });

    it("Jade's cipher key is spelled by the margin notes in this language", async () => {
      const a = await all();
      const key = a.logic.str(a.g.puzzles.PUZZLE_BY_ID.get("pz_cipher")!.params, "key", "");
      const initials = ["halo_h", "halo_a", "halo_l", "halo_o"]
        .map((id) => a.g.story.INSIGHT_BY_ID.get(id)!.text)
        .map((t) => t.replace(/^[^A-Za-zÄÖÜäöü]+/, "")[0]!.toUpperCase())
        .join("");
      expect(initials).toBe(key);
    });

    it("the supply-cabinet key has the promised six letters", async () => {
      const a = await all();
      const p = a.g.puzzles.PUZZLE_BY_ID.get("pz_side_versorgung")!;
      expect(a.logic.str(p.params, "key", "")).toHaveLength(6);
      expect(p.intro).toMatch(locale === "de" ? /sechs/i : /six/i);
    });

    it("temporal / radio / cipher params differ from English only in text", async () => {
      const a = await all();
      const en = loaded.en ?? (locale === "en" ? a : undefined);
      if (!en || en === a) return;
      en.g.puzzles.PUZZLES.forEach((p, i) => {
        const q = a.g.puzzles.PUZZLES[i]!;
        expect(q.id).toBe(p.id);
        for (const [k, v] of Object.entries(p.params)) {
          const w = q.params[k];
          if (typeof v === "number" || typeof v === "boolean") expect(w, `${p.id}.${k}`).toBe(v);
          else if (Array.isArray(v)) expect((w as unknown[]).length, `${p.id}.${k}`).toBe(v.length);
          else expect(typeof w, `${p.id}.${k}`).toBe(typeof v);
        }
      });
    });
  });
}

describe("puzzle reachability", () => {
  it("every puzzle is hosted somewhere a player can reach", async () => {
    const a = loaded.en ?? (loaded.en = await loadAll("en"));
    const { g } = a;
    const hosts = new Map<string, string[]>();
    const add = (id: string, where: string) => hosts.set(id, [...(hosts.get(id) ?? []), where]);
    for (const d of g.map.DOORS) if (d.keypad) add(d.keypad, `door ${d.id}`);
    for (const p of g.map.PICKUPS) if (p.puzzle) add(p.puzzle, `pickup ${p.id}`);
    for (const p of g.map.PROPS) if (p.puzzle) add(p.puzzle, `prop ${p.id}`);
    for (const d of g.devices.DEVICES)
      for (const st of d.stages) if (st.puzzle) add(st.puzzle, `stage ${d.id}`);
    for (const [dev, hooks] of Object.entries(g.devices.DEVICE_PUZZLES))
      for (const h of hooks) add(h.puzzle, `device ${dev}`);
    for (const acc of Object.values(g.map.FLOOR_ACCESS))
      if (acc.keypad) add(acc.keypad, "elevator");
    const orphans = g.puzzles.PUZZLES.filter((p) => !hosts.has(p.id)).map((p) => p.id);
    expect(orphans).toEqual([]);
    // And a real playthrough solves every one of them.
    const { report } = g.cov.fullRun();
    expect(report.puzzles).toEqual([]);
  });

  it("device-hosted puzzles use known kinds and valid params", async () => {
    const a = loaded.en ?? (loaded.en = await loadAll("en"));
    for (const [dev, hooks] of Object.entries(a.g.devices.DEVICE_PUZZLES)) {
      expect(a.g.devices.DEVICE_BY_ID.has(dev), dev).toBe(true);
      for (const h of hooks) {
        const p = a.g.puzzles.PUZZLE_BY_ID.get(h.puzzle);
        expect(p, `${dev}: ${h.puzzle}`).toBeDefined();
        expect(h.label.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
