/**
 * Crystal marketplace — pure helpers
 * ==================================
 *
 * TypeScript-side companions to the SECURITY DEFINER RPCs in
 * supabase/migrations/20260812000003_marketplace.sql (`market_list`,
 * `market_unlist`, `market_buy`). Everything here is pure (no I/O) so the
 * server actions in app/(game)/actions/market.ts stay thin and the fee /
 * unwrapping / error-mapping semantics are directly unit-testable.
 *
 * Fee semantics: the DB computes `floor(price * 0.05 * 100) / 100` in exact
 * `numeric` arithmetic — a 5% fee floored to 2 decimal places. The fee
 * amount leaves circulation entirely (deflationary; the seller receives
 * `price - fee`). `computeFee` mirrors that formula bit-for-bit, see below.
 */

import type { CrystalColor, VolatilityTier } from "@/types/database";

// ── Constants (mirror the migration's checks) ─────────────────────────

/** DB check constraint: `price >= 1`. */
export const MARKET_MIN_PRICE = 1;
/** `market_list` rejects prices above this (`p_price > 1000000`). */
export const MARKET_MAX_PRICE = 1_000_000;
/** Market fee rate; the fee is burned (leaves circulation). */
export const MARKET_FEE_RATE = 0.05;

// ── Fee ───────────────────────────────────────────────────────────────

/**
 * 5% market fee, floored to 2 decimal places — exactly the SQL formula
 * `floor(price * 0.05 * 100) / 100` from `market_buy`.
 *
 * The DB evaluates that in exact decimal (`numeric`) arithmetic, while JS
 * doubles introduce binary noise: e.g. `8.2 * 5 === 40.99999999999999…`,
 * which a naive `Math.floor` would turn into 0.40 instead of the SQL
 * answer 0.41. Since `price` is `numeric(20,8)` (≤ 8 decimal places), the
 * exact value of `price * 0.05 * 100` equals `price * 5` and also has
 * ≤ 8 decimal places — so re-rounding the double to 8 decimals recovers
 * the exact decimal before flooring.
 */
export function computeFee(price: number): number {
  const cents = Number((price * 5).toFixed(8)); // exact price * 0.05 * 100
  return Math.floor(cents) / 100;
}

// ── Price validation ──────────────────────────────────────────────────

/**
 * Normalize a client-supplied listing price for `market_list`.
 *
 * The DB accepts any numeric in [1, 1_000_000]; the TS layer is stricter
 * and only lists whole-_unSC prices. Fractional input is rounded to the
 * nearest integer (documented behavior — callers see the normalized price
 * echoed back in the action result). Returns `null` when the input is not
 * finite or the rounded price falls outside [MARKET_MIN_PRICE,
 * MARKET_MAX_PRICE].
 */
export function normalizeListingPrice(input: number): number | null {
  if (!Number.isFinite(input)) return null;
  const price = Math.round(input);
  if (price < MARKET_MIN_PRICE || price > MARKET_MAX_PRICE) return null;
  return price;
}

// ── RPC unwrapping ────────────────────────────────────────────────────

/**
 * RPCs declared `RETURNS TABLE` surface through supabase-js as an array of
 * rows; every market RPC yields exactly one. Returns the first row or
 * `null` (transport quirk / empty result — callers map that to
 * `rpc_no_row`). Same convention as `firstRpcRow` in lib/game/economy.ts.
 */
export function unwrapMarketRow<T>(data: unknown): T | null {
  const rows = (Array.isArray(data) ? data : []) as T[];
  return rows[0] ?? null;
}

// ── Error mapping ─────────────────────────────────────────────────────

/** `error_message` values `market_list` can return. */
export const MARKET_LIST_ERRORS = [
  "unauthorized",
  "invalid_price",
  "crystal_not_found",
  "not_owner",
  "already_listed",
] as const;

/** `error_message` values `market_unlist` can return. */
export const MARKET_UNLIST_ERRORS = [
  "unauthorized",
  "not_found",
  "not_seller",
  "not_active",
] as const;

/** `error_message` values `market_buy` can return. */
export const MARKET_BUY_ERRORS = [
  "unauthorized",
  "not_found",
  "not_active",
  "own_listing",
  "insufficient_funds",
  "seller_missing",
  "seller_no_longer_owner",
] as const;

export type MarketListDbError = (typeof MARKET_LIST_ERRORS)[number];
export type MarketUnlistDbError = (typeof MARKET_UNLIST_ERRORS)[number];
export type MarketBuyDbError = (typeof MARKET_BUY_ERRORS)[number];

/**
 * Map a DB `error_message` onto one of the typed codes the calling RPC
 * documents, falling back (typically to "rpc_failed") for anything
 * unknown so new DB-side messages can never leak as untyped strings.
 */
export function mapMarketError<E extends string, F extends string>(
  message: string | null | undefined,
  known: readonly E[],
  fallback: F,
): E | F {
  return (known as readonly string[]).includes(message ?? "") ? (message as E) : fallback;
}

// ── Listing view ──────────────────────────────────────────────────────

/** Client-facing shape for one active listing (browse / my listings). */
export interface MarketListingView {
  listingId: string;
  crystalId: string;
  name: string;
  color: CrystalColor;
  volatility: VolatilityTier;
  totalPower: number;
  sliceCount: number;
  /** Listing price in _unSC (what the buyer pays). */
  price: number;
  /** 5% fee preview (burned on sale; seller receives price − feePreview). */
  feePreview: number;
  /** True when the viewer is the seller. */
  sellerIsMe: boolean;
  createdAt: string;
}

/**
 * Raw row shape from `marketplace_listings` with the `crystals(...)`
 * PostgREST embed (FK `marketplace_listings_crystal_id_fkey`). Numeric
 * columns may arrive as strings (Postgres `numeric` over the wire).
 */
export interface RawListingRow {
  id: string;
  crystal_id: string;
  seller_id: string;
  price: number | string;
  created_at: string;
  crystals: {
    name: string;
    color: string;
    volatility: string;
    total_power: number | string;
    slice_count: number | string;
  } | null;
}

/**
 * Map a raw listing row (+embed) onto the client view. Returns `null`
 * when the crystal embed is missing (deleted crystal racing the read) —
 * callers filter those out rather than surfacing a half-empty listing.
 */
export function toListingView(
  row: RawListingRow,
  viewerId: string | null,
): MarketListingView | null {
  const crystal = row.crystals;
  if (!crystal) return null;
  const price = Number(row.price);
  return {
    listingId: row.id,
    crystalId: row.crystal_id,
    name: crystal.name,
    color: crystal.color as CrystalColor,
    volatility: crystal.volatility as VolatilityTier,
    totalPower: Number(crystal.total_power),
    sliceCount: Number(crystal.slice_count),
    price,
    feePreview: computeFee(price),
    sellerIsMe: viewerId !== null && row.seller_id === viewerId,
    createdAt: row.created_at,
  };
}
