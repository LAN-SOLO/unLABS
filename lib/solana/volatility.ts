/**
 * Solana network volatility feed — pure logic.
 * ============================================
 *
 * Maps raw Solana `getRecentPerformanceSamples` telemetry to the game's
 * `volatility_tier` enum ('1'..'5'). This is DISPLAY-ONLY network
 * telemetry (terminal `scan`, panel widgets); it feeds the
 * `volatility_snapshots` table and is deliberately NOT an input to any
 * price. The deterministic daily price modifier lives in
 * `lib/game/volatility.ts` and is a separate, untouched system.
 *
 * Tier calibration (documented, keep in sync with tests):
 * -------------------------------------------------------
 * Direction: HIGHER throughput = HIGHER volatility tier. Diegetically,
 * a hotter layer-1 means more energetic flux in the lab; practically,
 * this matches the existing simulated fallback in
 * `app/(game)/terminal/actions/data.ts` (tps thresholds ascending).
 *
 * Thresholds (TPS, including vote transactions — that is what
 * `numTransactions` reports; mainnet typically sits around 3000–4500
 * total, ~2000–4000 non-vote at peaks):
 *
 *   tier '1'  tps <  1000   (dormant — degraded or minor cluster)
 *   tier '2'  1000 ≤ tps < 2000
 *   tier '3'  2000 ≤ tps < 3000   (typical mainnet, calm)
 *   tier '4'  3000 ≤ tps < 4000   (typical mainnet, busy)
 *   tier '5'  tps ≥ 4000          (peak load)
 *
 * Non-finite or negative TPS clamps to tier '1' (no data = dormant).
 */

/** Matches the `volatility_tier` Postgres enum from the initial schema. */
export type VolatilityTier = "1" | "2" | "3" | "4" | "5";

/** One entry of the JSON-RPC `getRecentPerformanceSamples` result. */
export interface PerformanceSample {
  numTransactions: number;
  numSlots: number;
  samplePeriodSecs: number;
}

/** Ascending TPS thresholds; crossing the Nth threshold means tier N+1. */
export const TIER_THRESHOLDS_TPS: readonly number[] = [1000, 2000, 3000, 4000];

/** Used when samples carry no usable slot data (mainnet nominal slot time). */
export const DEFAULT_BLOCK_TIME_MS = 400;

/** Map an average TPS reading to a volatility tier. See module docs. */
export function mapTpsToTier(tps: number): VolatilityTier {
  if (!Number.isFinite(tps) || tps < 0) return "1";
  let tier = 1;
  for (const threshold of TIER_THRESHOLDS_TPS) {
    if (tps >= threshold) tier++;
  }
  return String(tier) as VolatilityTier;
}

function isUsableSample(s: PerformanceSample): boolean {
  return (
    Number.isFinite(s.numTransactions) &&
    s.numTransactions >= 0 &&
    Number.isFinite(s.samplePeriodSecs) &&
    s.samplePeriodSecs > 0
  );
}

/**
 * Mean TPS across samples (per-sample numTransactions/samplePeriodSecs,
 * averaged), rounded to 2 decimals to match `tps numeric(10,2)`.
 * Returns null when no sample is usable.
 */
export function computeAverageTps(samples: PerformanceSample[]): number | null {
  const usable = samples.filter(isUsableSample);
  if (usable.length === 0) return null;
  const sum = usable.reduce((acc, s) => acc + s.numTransactions / s.samplePeriodSecs, 0);
  return Math.round((sum / usable.length) * 100) / 100;
}

/**
 * Average slot ("block") time in ms, slot-weighted across samples:
 * total sampled seconds / total slots. Returns null when no sample has
 * slots (caller should fall back to DEFAULT_BLOCK_TIME_MS).
 */
export function computeBlockTimeMs(samples: PerformanceSample[]): number | null {
  let totalSecs = 0;
  let totalSlots = 0;
  for (const s of samples) {
    if (Number.isFinite(s.numSlots) && s.numSlots > 0 && isUsableSample(s)) {
      totalSecs += s.samplePeriodSecs;
      totalSlots += s.numSlots;
    }
  }
  if (totalSlots === 0) return null;
  return Math.round((totalSecs / totalSlots) * 1000);
}

/**
 * Narrow an unknown JSON-RPC `result` value to performance samples.
 * Returns the valid entries, or null when the value is not an array or
 * contains no valid entry (malformed RPC responses must not crash the
 * route).
 */
export function parsePerformanceSamples(value: unknown): PerformanceSample[] | null {
  if (!Array.isArray(value)) return null;
  const samples: PerformanceSample[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    if (
      typeof rec.numTransactions === "number" &&
      typeof rec.numSlots === "number" &&
      typeof rec.samplePeriodSecs === "number"
    ) {
      samples.push({
        numTransactions: rec.numTransactions,
        numSlots: rec.numSlots,
        samplePeriodSecs: rec.samplePeriodSecs,
      });
    }
  }
  return samples.length > 0 ? samples : null;
}
