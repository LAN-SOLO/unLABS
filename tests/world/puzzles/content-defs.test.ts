import { describe, expect, it } from "vitest";
import { bestCycle, generateMarket } from "@/components/world/puzzles/engine/arbitrage";
import { generateEra } from "@/components/world/puzzles/engine/era";
import { generateLaser, laserSolved } from "@/components/world/puzzles/engine/laser";
import { evaluateStack, generateLayers } from "@/components/world/puzzles/engine/layers";
import { morseSolution } from "@/components/world/puzzles/engine/morse";
import { countSolutions, generatePalette } from "@/components/world/puzzles/engine/palette";
import { radioClarity, radioStart } from "@/components/world/puzzles/engine/radio";
import { generateWiring, validatePaths } from "@/components/world/puzzles/engine/wiring";
import { num, nums, str } from "@/components/world/puzzles/logic";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { SPECTRUM } from "@/lib/world/types";

/** Authored PuzzleDefs must produce solvable, non-trivial instances. */
describe("authored puzzle defs", () => {
  for (const p of PUZZLES) {
    const pr = p.params;
    it(`${p.id} (${p.kind}) is playable`, () => {
      switch (p.kind) {
        case "laser": {
          const g = generateLaser(
            num(pr, "seed", 1),
            num(pr, "size", 6),
            num(pr, "colors", 2),
            num(pr, "receivers", 3),
          );
          expect(laserSolved(g, g.solution)).toBe(true);
          expect(laserSolved(g, g.start)).toBe(false);
          break;
        }
        case "era": {
          const g = generateEra(
            num(pr, "seed", 16),
            num(pr, "target", 16),
            num(pr, "dither", 1) === 1,
          );
          expect(new Set(Object.values(g.sums)).size).toBe(8);
          break;
        }
        case "arbitrage": {
          const maxHops = num(pr, "maxHops", 4);
          const target = num(pr, "target", 1.08);
          const m = generateMarket(num(pr, "seed", 7), num(pr, "nodes", 5), maxHops, target);
          expect(bestCycle(m, 0, m.maxHops).yield).toBeGreaterThanOrEqual(m.target);
          break;
        }
        case "palette": {
          const g = generatePalette(num(pr, "seed", 2400), num(pr, "channels", 4));
          expect(countSolutions(g.channels.length, g.clues, g.channels)).toBe(1);
          break;
        }
        case "layers": {
          const g = generateLayers(num(pr, "seed", 5), num(pr, "slots", 5));
          expect(g.solutions.length).toBeGreaterThan(0);
          for (const s of g.solutions) expect(evaluateStack(s, g.rules).ok).toBe(true);
          break;
        }
        case "wiring": {
          const g = generateWiring(num(pr, "seed", 9), num(pr, "size", 6), num(pr, "pairs", 5));
          expect(validatePaths(g, g.solution)).toBe(true);
          break;
        }
        case "morse": {
          // The signal itself must decode to the authored answer (the whisper: LOVW).
          const sol = morseSolution(str(pr, "signal", ""), nums(pr, "groups", []));
          expect(sol.answer).toBe(str(pr, "answer", "LOVW"));
          break;
        }
        case "radio": {
          const f = num(pr, "freq", 94.7);
          const ph = num(pr, "phase", 135);
          expect(f).toBeGreaterThanOrEqual(87.5);
          expect(f).toBeLessThanOrEqual(108);
          expect(str(pr, "line", "").length).toBeGreaterThan(10);
          const s = radioStart(num(pr, "seed", 1), f, ph);
          expect(radioClarity(s.freq, s.phase, f, ph)).toBeLessThan(0.3);
          expect(radioClarity(f, ph, f, ph)).toBeGreaterThanOrEqual(0.9);
          break;
        }
        case "hue":
          expect(SPECTRUM as readonly string[]).toContain(str(pr, "target", "gelb"));
          break;
        default:
          expect(p.title.length).toBeGreaterThan(0);
      }
    });
  }
});
