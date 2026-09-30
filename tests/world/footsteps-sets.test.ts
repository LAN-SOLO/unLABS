import { describe, expect, it } from "vitest";
import { averageFeatures, featureDistance, type SoundFeatures } from "@/lib/world/audio/analysis";
import {
  FOOTWEAR_SETS,
  FOOTWEAR_SPEC,
  MOTION_LAYER_KINDS,
  STEP_KINDS,
  SURFACE_RESP,
  renderMotion,
  renderStep,
  type Footwear,
} from "@/lib/world/audio/footfall";
import { NOMINAL_STEP_INTERVAL, StepTracker } from "@/lib/world/audio/footsteps";
import { FOOTSTEP_GAIN, SFX, SURFACES, surfaceForTheme, type Surface } from "@/lib/world/audio/sfx";
import {
  DECOR_SURFACE,
  spotSurfaceAt,
  surfaceSpots,
  surfaceUnder,
} from "@/lib/world/audio/surfaces";
import { RecordingTarget } from "@/lib/world/audio/synth";
import { FOOTWEAR_SOUNDS, MOTION_LAYERS } from "@/lib/world/content/wardrobe";
import { DECOR_BY_ID } from "@/lib/world/models/decor";
import type { FloorId } from "@/lib/world/types";

const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);

function rec(surface: Surface, footwear: Footwear, seed = 1, extra: object = {}): RecordingTarget {
  const t = new RecordingTarget(seed);
  renderStep(t, { surface, footwear, interval: 0.3, ...extra });
  return t;
}

describe("footwear sets", () => {
  it("mirror the wardrobe's footwear sounds and motion layers", () => {
    expect([...FOOTWEAR_SETS]).toEqual([...FOOTWEAR_SOUNDS]);
    expect([...MOTION_LAYER_KINDS]).toEqual([...MOTION_LAYERS]);
  });

  it("render every footwear × surface × kind with sane, cheap events", () => {
    for (const f of FOOTWEAR_SETS)
      for (const s of SURFACES)
        for (const kind of STEP_KINDS)
          for (const foot of [0, 1] as const)
            for (const pace of [0.6, 1, 1.6]) {
              const t = rec(s, f, 3 + foot, { kind, foot, pace });
              const where = `${f}:${s}:${kind}`;
              expect(t.events.length, where).toBeGreaterThan(0);
              // Budget: every event is one short node chain; a step stays small.
              expect(t.events.length, where).toBeLessThanOrEqual(kind === "land" ? 28 : 14);
              for (const e of t.events) {
                expect(Number.isFinite(e.gain) && e.gain > 0 && e.gain <= 0.5, where).toBe(true);
                expect(Number.isFinite(e.freq) && e.freq > 15, where).toBe(true);
                expect(e.at ?? 0, where).toBeGreaterThanOrEqual(0);
              }
              // Steps are short; only the skate roll lasts until the next step.
              expect(t.duration(), where).toBeLessThan(f === "skate" ? 0.75 : 0.9);
            }
  });

  it("vary from step to step (micro-variants) and between the feet", () => {
    for (const f of FOOTWEAR_SETS) {
      const sigs = new Set<string>();
      for (let seed = 1; seed <= 8; seed++)
        sigs.add(
          JSON.stringify(rec("concrete", f, seed).events.map((e) => [e.kind, e.at, e.freq])),
        );
      expect(sigs.size, f).toBeGreaterThanOrEqual(6);
      const left = rec("metal", f, 5, { foot: 0 }).events.map((e) => e.freq);
      const right = rec("metal", f, 5, { foot: 1 }).events.map((e) => e.freq);
      expect(left, f).not.toEqual(right);
    }
  });

  it("run faster: quicker heel-to-toe and louder than a creep", () => {
    const peakGain = (t: RecordingTarget) => Math.max(...t.events.map((e) => e.gain));
    for (const f of FOOTWEAR_SETS) {
      expect(peakGain(rec("tile", f, 2, { pace: 1.6 })), f).toBeGreaterThan(
        peakGain(rec("tile", f, 2, { pace: 0.6 })),
      );
    }
  });

  it("carry each sole's signature", () => {
    const has = (t: RecordingTarget, p: (e: RecordingTarget["events"][number]) => boolean) =>
      t.events.some(p);
    // Magnetic boots clamp with an electromagnet buzz on steel, a servo whine elsewhere.
    expect(has(rec("metal", "magnetic"), (e) => e.kind === "tone" && e.wave === "square")).toBe(
      true,
    );
    expect(
      has(rec("concrete", "magnetic"), (e) => e.kind === "tone" && e.wave === "sawtooth"),
    ).toBe(true);
    // Sneakers squeak when turning on smooth floors.
    let squeaks = 0;
    for (let seed = 1; seed <= 20; seed++)
      if (
        has(
          rec("tile", "sneaker", seed, { kind: "scuff" }),
          (e) => e.kind === "tone" && !!e.vibrato,
        )
      )
        squeaks++;
    expect(squeaks).toBeGreaterThanOrEqual(18);
    // Skates roll until the next step (longer interval = longer roll).
    expect(rec("tile", "skate", 1, { interval: 0.5 }).duration()).toBeGreaterThan(
      rec("tile", "skate", 1, { interval: 0.2 }).duration(),
    );
    // Clogs: two woody knocks (triangle tones), heel then toe.
    const knocks = rec("wood", "clog").events.filter(
      (e) => e.kind === "tone" && e.wave === "triangle",
    );
    expect(knocks.length).toBeGreaterThanOrEqual(2);
    // Rubber boots on water splash much more than on concrete.
    const noise = (t: RecordingTarget) =>
      t.events.filter((e) => e.kind === "noise").reduce((n, e) => n + e.gain * e.dur, 0);
    expect(noise(rec("water", "rubber"))).toBeGreaterThan(noise(rec("concrete", "rubber")) * 1.5);
  });

  it("are measurably different on every surface (A-weighted spectrum, envelope, level)", () => {
    const feats = new Map<string, SoundFeatures>();
    const feat = (f: Footwear, s: Surface, seeds = SEEDS) => {
      const k = `${f}:${s}:${seeds[0]}`;
      let v = feats.get(k);
      if (!v) {
        v = averageFeatures(
          (t) => renderStep(t, { surface: s, footwear: f, interval: 0.3 }),
          seeds,
          {
            sampleRate: 16000,
            seconds: 0.7,
          },
        );
        feats.set(k, v);
      }
      return v;
    };
    const other = SEEDS.map((x) => x + 100);
    // Noise floor: the same set against itself with other seeds (micro-variants,
    // occasional scuffs and creaks make single renders differ).
    const selfs: number[] = [];
    for (const f of FOOTWEAR_SETS)
      for (const s of ["metal", "concrete", "carpet", "water"] as const)
        selfs.push(featureDistance(feat(f, s), feat(f, s, other)));
    selfs.sort((x, y) => x - y);
    const self = selfs[Math.floor(selfs.length / 2)]!;
    let closest = Infinity;
    let pair = "";
    for (const s of SURFACES)
      for (const a of FOOTWEAR_SETS)
        for (const b of FOOTWEAR_SETS) {
          if (a >= b) continue;
          const d = featureDistance(feat(a, s), feat(b, s));
          if (d < closest) {
            closest = d;
            pair = `${a}~${b} on ${s}`;
          }
        }
    expect(closest, pair).toBeGreaterThan(0.15);
    // Even the most similar pair of sets differs clearly more than a set from itself.
    expect(closest, `${pair} vs self ${self.toFixed(2)}`).toBeGreaterThan(self * 1.5);
  }, 120_000);
});

describe("motion layers", () => {
  it("every layer sounds (quietly) and landings jingle more", () => {
    for (const layer of MOTION_LAYER_KINDS) {
      let sounded = 0;
      for (let index = 0; index < 6; index++) {
        const t = new RecordingTarget(index + 1);
        sounded += renderMotion(t, [layer], { index, foot: (index % 2) as 0 | 1, pace: 1.5 });
        for (const e of t.events) expect(e.gain, layer).toBeLessThan(0.08);
      }
      expect(sounded, layer).toBeGreaterThan(0);
    }
    const loud = (kind: "step" | "land") => {
      const t = new RecordingTarget(4);
      renderMotion(t, ["keys"], { kind, pace: 1.6 });
      return Math.max(0, ...t.events.map((e) => e.gain));
    };
    expect(loud("land")).toBeGreaterThan(loud("step"));
  });
});

describe("surfaces", () => {
  it("extends the floor set and keeps per-surface loudness", () => {
    for (const s of ["water", "glass", "rubber", "gravel", "ice", "cable", "paper"] as const)
      expect(SURFACES).toContain(s);
    for (const s of SURFACES) {
      expect(FOOTSTEP_GAIN[s]).toBeGreaterThan(0);
      expect(SURFACE_RESP[s]).toBeDefined();
    }
    expect(surfaceForTheme("cryo")).toBe("ice");
    expect(surfaceForTheme("greenhouse")).toBe("gravel");
    // The plain footstep recipe (studio, old callers) is the work boot.
    const t = new RecordingTarget(2);
    SFX.footstep(t, { surface: "gravel" });
    expect(t.events.length).toBeGreaterThan(3);
  });

  it("maps real flat decor to floor spots and finds them under the player", () => {
    for (const id of Object.keys(DECOR_SURFACE)) expect(DECOR_BY_ID.has(id), id).toBe(true);
    const found = new Set<Surface>();
    for (const f of [0, 1, 2, 3, 4, 5] as FloorId[]) {
      const spots = surfaceSpots(f);
      for (const s of spots) {
        found.add(s.surface);
        const cx = (s.x0 + s.x1) / 2;
        const cz = (s.z0 + s.z1) / 2;
        // The centre of a spot reports a spot surface (a stronger one may overlap).
        const hit = spotSurfaceAt(spots, cx, cz);
        expect(hit).not.toBeNull();
        expect(surfaceUnder(f, cx, cz, "metal")).toBe(hit);
      }
    }
    for (const s of ["carpet", "water", "glass", "cable", "paper"] as const)
      expect(found.has(s), s).toBe(true);
    expect(spotSurfaceAt([], 1, 1)).toBeNull();
    expect(surfaceUnder(0, -999, -999, "wood")).toBe("wood");
  });
});

describe("step tracker", () => {
  it("alternates feet, reads pace from the cadence, scuffs on turns, lands after a ride", () => {
    const tr = new StepTracker();
    const a = tr.step(0, 0, 0);
    expect(a).toHaveLength(1);
    expect(a[0]!.pace).toBeCloseTo(1);
    // Straight ahead at a running cadence.
    let t = 0;
    let x = 0;
    let feet: number[] = [a[0]!.foot];
    for (let i = 0; i < 6; i++) {
      t += 0.18;
      x += 1.7;
      const ev = tr.step(t, x, 0);
      expect(ev.every((e) => e.kind === "step")).toBe(true);
      feet.push(ev[0]!.foot);
    }
    expect(new Set(feet).size).toBe(2);
    expect(feet[1]).not.toBe(feet[2]);
    expect(tr.step((t += 0.18), (x += 1.7), 0)[0]!.pace).toBeGreaterThan(1.3);
    // A sharp turn: scuff first, then the step.
    const turn = tr.step((t += 0.18), x, 1.7);
    expect(turn.map((e) => e.kind)).toEqual(["scuff", "step"]);
    // Stopping: one settle event, once.
    expect(tr.poll(t + 0.05)).toBeNull();
    const stop = tr.poll(t + 0.6);
    expect(stop?.kind).toBe("stop");
    expect(stop?.at).toEqual([x, 1.7]);
    expect(tr.poll(t + 1)).toBeNull();
    // After a ladder / elevator the first step lands.
    tr.landNext();
    expect(tr.step(t + 3, 0, 0)[0]!.kind).toBe("land");
    expect(tr.step(t + 3 + NOMINAL_STEP_INTERVAL, 1.7, 0)[0]!.kind).toBe("step");
    feet = [];
  });
});

describe("footwear spec", () => {
  it("has a spec per set with sane ranges", () => {
    for (const f of FOOTWEAR_SETS) {
      const s = FOOTWEAR_SPEC[f];
      expect(s.heelToe[0]).toBeLessThan(s.heelToe[1]);
      expect(s.gain).toBeGreaterThan(0.3);
      expect(s.gain).toBeLessThanOrEqual(1);
    }
  });
});
