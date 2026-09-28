/**
 * PZ_ARBITRAGE_LITE — a tiny exchange market of lab resources.
 *
 * Every directed pair has an exchange rate derived from hidden fair prices
 * times a fee factor below one, so almost every round trip loses value. One
 * planted cycle (2..maxHops hops, starting and ending at `_unSC`) carries
 * favourable rates and yields at least `target`.
 */
import { mulberry32, randInt, type Rng } from "@/components/world/puzzles/rng";
import { tr } from "@/lib/i18n";

/** Display names (translated); the seeded shuffle only depends on their order. */
export const MARKET_RESOURCES: readonly string[] = [
  "_unSC",
  "Abstractum",
  tr("Copper"),
  tr("Crystal Dust"),
  tr("Coolant"),
  tr("Memory Chips"),
];

export interface Market {
  names: string[];
  /** rates[i][j]: one unit of i buys rates[i][j] units of j (diagonal = 1). */
  rates: number[][];
  maxHops: number;
  target: number;
  /** The planted profitable cycle (node indices, starts and ends at 0). */
  planted: number[];
}

export interface CycleResult {
  path: number[];
  yield: number;
}

/** Round to 4 significant digits so displayed rates equal computed rates. */
export function roundRate(v: number): number {
  if (v <= 0 || !Number.isFinite(v)) return 0;
  const mag = Math.floor(Math.log10(v));
  const f = Math.pow(10, 3 - mag);
  return Math.round(v * f) / f;
}

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Product of the rates along `path` (consecutive pairs). */
export function pathYield(market: Pick<Market, "rates">, path: readonly number[]): number {
  let y = 1;
  for (let i = 1; i < path.length; i++) {
    const row = market.rates[path[i - 1]];
    const r = row?.[path[i]];
    if (r === undefined || path[i - 1] === path[i]) return 0;
    y *= r;
  }
  return y;
}

/** Best simple cycle from `start` back to `start` using 2..maxHops hops (brute force). */
export function bestCycle(
  market: Pick<Market, "rates">,
  start: number,
  maxHops: number,
): CycleResult {
  const n = market.rates.length;
  let best: CycleResult = { path: [], yield: 0 };
  const path = [start];
  const used = new Set<number>([start]);
  const dfs = (value: number) => {
    const cur = path[path.length - 1];
    const hops = path.length - 1;
    if (hops >= 1 && hops + 1 <= maxHops) {
      const closing = value * market.rates[cur][start];
      if (closing > best.yield) best = { path: [...path, start], yield: closing };
    }
    if (hops + 1 >= maxHops) return;
    for (let j = 0; j < n; j++) {
      if (used.has(j)) continue;
      used.add(j);
      path.push(j);
      dfs(value * market.rates[cur][j]);
      path.pop();
      used.delete(j);
    }
  };
  dfs(1);
  return best;
}

/** Is `route` a legal, closed trade route (starts/ends at 0, simple, ≤ maxHops)? */
export function isClosedRoute(route: readonly number[], maxHops: number): boolean {
  if (route.length < 3 || route[0] !== 0 || route[route.length - 1] !== 0) return false;
  if (route.length - 1 > maxHops) return false;
  const inner = route.slice(1, -1);
  return !inner.includes(0) && new Set(inner).size === inner.length;
}

export function generateMarket(
  seed: number,
  nodes: number,
  maxHops: number,
  target: number,
): Market {
  const n = Math.max(4, Math.min(MARKET_RESOURCES.length, Math.floor(nodes)));
  const hops = Math.max(3, Math.min(5, Math.floor(maxHops)));
  const goal = Math.max(1.01, Math.min(1.5, target));
  const rng = mulberry32(seed * 2654435761 + 17);
  const names = ["_unSC", ...shuffle(rng, MARKET_RESOURCES.slice(1)).slice(0, n - 1)];
  // Hidden fair prices (in _unSC per unit).
  const prices = names.map((_, i) => (i === 0 ? 1 : Math.round((0.4 + rng() * 30) * 100) / 100));
  const fee = () => 0.9 + rng() * 0.08;
  const rates: number[][] = names.map((_, i) =>
    names.map((__, j) => (i === j ? 1 : roundRate((prices[i] / prices[j]) * fee()))),
  );

  // Plant one profitable cycle of 3..hops hops (prefer the longer ones).
  const len = hops <= 3 ? 3 : 3 + randInt(rng, hops - 2);
  const others = shuffle(
    rng,
    names.map((_, i) => i).filter((i) => i !== 0),
  ).slice(0, len - 1);
  const planted = [0, ...others, 0];
  const edgeBoost = Math.pow(goal * 1.025, 1 / len);
  for (let k = 1; k < planted.length; k++) {
    const a = planted[k - 1];
    const b = planted[k];
    rates[a][b] = roundRate((prices[a] / prices[b]) * edgeBoost * (1 + rng() * 0.004));
  }
  return { names, rates, maxHops: hops, target: goal, planted };
}
