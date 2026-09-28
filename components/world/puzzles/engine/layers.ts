/**
 * PZ_MATERIAL_LAYERING — stack distinct shielding materials in a housing.
 *
 * Coverage: for RF / Thermik / Mechanik the best single layer must reach
 * 80 %. Seeded adjacency/position rules are added until only 1..3 valid
 * stacks remain (brute force over all ordered selections).
 */
import { mulberry32, randInt, type Rng } from "@/components/world/puzzles/rng";
import { tr } from "@/lib/i18n";

export type Interference = "rf" | "thermik" | "mechanik";
export const INTERFERENCES: readonly Interference[] = ["rf", "thermik", "mechanik"];
export const INTERFERENCE_LABEL: Record<Interference, string> = {
  rf: "RF",
  thermik: tr("Thermal"),
  mechanik: tr("Mechanical"),
};
export const COVERAGE_MIN = 80;

export interface Material {
  id: string;
  label: string;
  color: string;
  profile: Record<Interference, number>;
}

export const MATERIALS: readonly Material[] = [
  {
    id: "ferrit",
    label: tr("Ferrite"),
    color: "#8A8A9A",
    profile: { rf: 90, thermik: 10, mechanik: 30 },
  },
  {
    id: "aerogel",
    label: tr("Aerogel"),
    color: "#A0E0FF",
    profile: { rf: 5, thermik: 95, mechanik: 10 },
  },
  {
    id: "keramik",
    label: tr("Ceramic"),
    color: "#E8D8B0",
    profile: { rf: 20, thermik: 80, mechanik: 60 },
  },
  {
    id: "kupfer",
    label: tr("Copper Mesh"),
    color: "#D98A4A",
    profile: { rf: 85, thermik: 30, mechanik: 20 },
  },
  {
    id: "bleiglas",
    label: tr("Lead Glass"),
    color: "#6AA0A0",
    profile: { rf: 50, thermik: 20, mechanik: 85 },
  },
  {
    id: "graphen",
    label: tr("Graphene Foam"),
    color: "#4A4A4A",
    profile: { rf: 40, thermik: 60, mechanik: 82 },
  },
];

export type LayerRule =
  | { type: "notAdjacent"; a: number; b: number }
  | { type: "above"; a: number; b: number }
  | { type: "directlyAbove"; a: number; b: number }
  | { type: "outerMin"; trait: Interference; min: number }
  | { type: "notInner"; m: number }
  | { type: "exclude"; m: number }
  | { type: "at"; m: number; slot: number };

/** A stack: material index per slot (slot 0 = außen), null = empty. */
export type Stack = readonly (number | null)[];

export function ruleText(rule: LayerRule): string {
  const L = (i: number) => MATERIALS[i]?.label ?? "?";
  switch (rule.type) {
    case "notAdjacent":
      return tr("{a} never directly next to {b}.", { a: L(rule.a), b: L(rule.b) });
    case "above":
      return tr("{a} sits above {b} (both installed).", { a: L(rule.a), b: L(rule.b) });
    case "directlyAbove":
      return tr("{b} sits directly below {a}.", { a: L(rule.a), b: L(rule.b) });
    case "outerMin":
      return tr("Outside (layer 1) needs {trait} ≥ {min} %.", {
        trait: INTERFERENCE_LABEL[rule.trait],
        min: rule.min,
      });
    case "notInner":
      return tr("No {m} may sit inside (bottom layer).", { m: L(rule.m) });
    case "exclude":
      return tr("{m} is not used.", { m: L(rule.m) });
    case "at":
      return tr("{m} belongs in layer {n}.", { m: L(rule.m), n: rule.slot + 1 });
  }
}

export function ruleHolds(rule: LayerRule, stack: Stack): boolean {
  const idx = (m: number) => stack.indexOf(m);
  const last = stack.length - 1;
  switch (rule.type) {
    case "notAdjacent": {
      const a = idx(rule.a);
      const b = idx(rule.b);
      return a < 0 || b < 0 || Math.abs(a - b) !== 1;
    }
    case "above": {
      const a = idx(rule.a);
      const b = idx(rule.b);
      return a >= 0 && b >= 0 && a < b;
    }
    case "directlyAbove": {
      const a = idx(rule.a);
      const b = idx(rule.b);
      return a >= 0 && b === a + 1;
    }
    case "outerMin": {
      const m = stack[0];
      return m !== null && m !== undefined && MATERIALS[m].profile[rule.trait] >= rule.min;
    }
    case "notInner":
      return stack[last] !== rule.m;
    case "exclude":
      return idx(rule.m) < 0;
    case "at":
      return stack[rule.slot] === rule.m;
  }
}

export function coverage(stack: Stack): Record<Interference, number> {
  const out: Record<Interference, number> = { rf: 0, thermik: 0, mechanik: 0 };
  for (const m of stack) {
    if (m === null || m === undefined) continue;
    for (const t of INTERFERENCES) out[t] = Math.max(out[t], MATERIALS[m].profile[t]);
  }
  return out;
}

/** First slot index that stops interference `t` (≥ COVERAGE_MIN), or -1. */
export function blockingSlot(stack: Stack, t: Interference): number {
  return stack.findIndex(
    (m) => m !== null && m !== undefined && MATERIALS[m].profile[t] >= COVERAGE_MIN,
  );
}

export interface StackEvaluation {
  coverage: Record<Interference, number>;
  covered: boolean;
  complete: boolean;
  violations: number[];
  ok: boolean;
}

export function evaluateStack(stack: Stack, rules: readonly LayerRule[]): StackEvaluation {
  const cov = coverage(stack);
  const covered = INTERFERENCES.every((t) => cov[t] >= COVERAGE_MIN);
  const complete = stack.every((m) => m !== null && m !== undefined);
  const violations = rules.map((r, i) => (ruleHolds(r, stack) ? -1 : i)).filter((i) => i >= 0);
  return {
    coverage: cov,
    covered,
    complete,
    violations,
    ok: covered && complete && violations.length === 0,
  };
}

/** All ordered selections of `slots` distinct materials. */
export function allStacks(slots: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const rec = () => {
    if (cur.length === slots) {
      out.push(cur.slice());
      return;
    }
    for (let m = 0; m < MATERIALS.length; m++) {
      if (cur.includes(m)) continue;
      cur.push(m);
      rec();
      cur.pop();
    }
  };
  rec();
  return out;
}

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface LayersPuzzle {
  slots: number;
  rules: LayerRule[];
  solutions: number[][];
}

export function generateLayers(seed: number, slotCount: number): LayersPuzzle {
  const slots = Math.max(4, Math.min(5, Math.floor(slotCount)));
  const rng = mulberry32(seed * 40503 + 11);
  const valid = allStacks(slots).filter((s) => evaluateStack(s, []).covered);
  const target = valid[randInt(rng, valid.length)];

  const n = MATERIALS.length;
  const pool: LayerRule[] = [];
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const cand: LayerRule[] = [
        { type: "notAdjacent", a, b },
        { type: "above", a, b },
        { type: "directlyAbove", a, b },
      ];
      for (const r of cand) {
        if (r.type === "notAdjacent" && a > b) continue;
        if (ruleHolds(r, target)) pool.push(r);
      }
    }
    const inner: LayerRule = { type: "notInner", m: a };
    if (ruleHolds(inner, target) && target.includes(a)) pool.push(inner);
    const ex: LayerRule = { type: "exclude", m: a };
    if (ruleHolds(ex, target)) pool.push(ex);
  }
  for (const t of INTERFERENCES) {
    const min = MATERIALS[target[0]].profile[t] >= 60 ? 60 : 0;
    if (min > 0) pool.push({ type: "outerMin", trait: t, min });
  }

  let alive = valid;
  const rules: LayerRule[] = [];
  let remaining = shuffle(rng, pool);
  // Greedy with a little randomness: from a few sampled candidates take the
  // one that eliminates the most stacks — keeps the rule list short.
  while (alive.length > 3 || (alive.length > 1 && rules.length < 3)) {
    let bestIdx = -1;
    let bestNext: number[][] = alive;
    const samples = Math.min(remaining.length, 5);
    for (let k = 0; k < samples; k++) {
      const i = randInt(rng, remaining.length);
      const next = alive.filter((st) => ruleHolds(remaining[i], st));
      if (next.length < bestNext.length) {
        bestIdx = i;
        bestNext = next;
      }
    }
    if (bestIdx < 0) {
      // Nothing sampled helped: drop useless rules and retry, or give up.
      remaining = remaining.filter((r) => alive.some((st) => !ruleHolds(r, st)));
      if (remaining.length === 0) break;
      continue;
    }
    rules.push(remaining[bestIdx]);
    remaining = remaining.filter((_, i) => i !== bestIdx);
    alive = bestNext;
  }
  for (let slot = 0; alive.length > 3 && slot < slots; slot++) {
    const r: LayerRule = { type: "at", m: target[slot], slot };
    rules.push(r);
    alive = alive.filter((s) => ruleHolds(r, s));
  }
  return { slots, rules, solutions: alive };
}
