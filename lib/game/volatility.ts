/**
 * Daily price volatility — pure and deterministic.
 * ================================================
 *
 * One global modifier per UTC day (same for every player — it models a
 * market day, not a personal discount), derived from an FNV-1a hash of
 * the day key. Client and server compute the identical value, so prices
 * can be displayed client-side and charged server-side without a table
 * or an extra round-trip.
 *
 * The modifier swings burn prices (production start burns, research
 * burns, rush fees) by ±25% in 1% steps. Fixed meta prices (daily
 * reroll, streak insurance) are deliberately NOT volatile — they are
 * priced as UI affordances, not market goods.
 */

/** Inclusive swing bounds, as fractions of the base price. */
export const VOLATILITY_MAX_SWING = 0.25;

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The day's global price multiplier in [0.75, 1.25], quantized to 1%
 * steps so displays are stable ("+18%" reads better than "+17.83%").
 */
export function dailyPriceModifier(dayKey: string): number {
  const swingSteps = Math.round(VOLATILITY_MAX_SWING * 100); // 25
  const roll = fnv1a(`unsc:volatility:${dayKey}`) % (swingSteps * 2 + 1); // 0..50
  return 1 + (roll - swingSteps) / 100;
}

/**
 * Apply the day's modifier to a base burn price. Free stays free;
 * anything charged costs at least 1 _unSC.
 */
export function applyVolatility(baseCost: number, dayKey: string): number {
  if (baseCost <= 0) return 0;
  return Math.max(1, Math.round(baseCost * dailyPriceModifier(dayKey)));
}

/** Signed percent for displays, e.g. -7 or +18 (0 on a flat day). */
export function volatilityPercent(dayKey: string): number {
  return Math.round((dailyPriceModifier(dayKey) - 1) * 100);
}
