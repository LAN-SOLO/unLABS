"use server";

/**
 * Crystal marketplace server actions
 * ==================================
 *
 * Client half of the player-to-player crystal market. The market itself is
 * server-authoritative: `marketplace_listings` has SELECT-only RLS and every
 * mutation goes through a SECURITY DEFINER RPC keyed on `auth.uid()`
 * (supabase/migrations/20260812000003_marketplace.sql):
 *
 *   - browseListings — active listings, newest first, with crystal details
 *                      via the `crystals(...)` PostgREST embed
 *   - myListings     — the caller's own active listings (same shape)
 *   - listCrystal    — validate + `market_list(p_crystal_id, p_price)`
 *   - unlistCrystal  — `market_unlist(p_listing_id)`
 *   - buyCrystal     — `market_buy(p_listing_id)`; atomic in the DB: buyer
 *                      pays `price`, seller receives `price − fee`, the 5%
 *                      fee is burned (leaves circulation), ownership moves,
 *                      both sides get 'trade' ledger rows
 *
 * Fee / unwrapping / error-mapping semantics live as pure helpers in
 * lib/game/market.ts (unit-tested in tests/game/market-actions.test.ts);
 * RPC unwrapping follows the same style as app/(game)/actions/prestige.ts.
 */

import { createClient } from "@/lib/supabase/server";
import {
  MARKET_BUY_ERRORS,
  MARKET_LIST_ERRORS,
  MARKET_UNLIST_ERRORS,
  computeFee,
  mapMarketError,
  normalizeListingPrice,
  toListingView,
  unwrapMarketRow,
  type MarketBuyDbError,
  type MarketListDbError,
  type MarketListingView,
  type MarketUnlistDbError,
  type RawListingRow,
} from "@/lib/game/market";

/** Columns + crystal embed used by both listing reads. */
const LISTING_SELECT =
  "id, crystal_id, seller_id, price, created_at, crystals(name, color, volatility, total_power, slice_count)";

/** Hard cap on a single browse page. */
const MAX_BROWSE_LIMIT = 100;

// ── browseListings / myListings ───────────────────────────────────────

export interface ListingsResult {
  ok: boolean;
  listings: MarketListingView[];
  error?: "not_authenticated" | "read_failed";
}

async function fetchListings(onlyMine: boolean, limit: number): Promise<ListingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, listings: [], error: "not_authenticated" };

  const capped = Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_BROWSE_LIMIT);

  let query = supabase
    .from("marketplace_listings")
    .select(LISTING_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(capped);
  if (onlyMine) query = query.eq("seller_id", user.id);

  const { data, error } = await query;
  if (error) return { ok: false, listings: [], error: "read_failed" };

  // The embed is typed by the generated schema; RawListingRow additionally
  // tolerates numeric-as-string (Postgres numeric over the wire).
  const rows = (data ?? []) as unknown as RawListingRow[];
  const listings = rows
    .map((row) => toListingView(row, user.id))
    .filter((view): view is MarketListingView => view !== null);
  return { ok: true, listings };
}

/** Active listings from all players, newest first (default page: 25). */
export async function browseListings(limit = 25): Promise<ListingsResult> {
  return fetchListings(false, limit);
}

/** The caller's own active listings, newest first. */
export async function myListings(): Promise<ListingsResult> {
  return fetchListings(true, MAX_BROWSE_LIMIT);
}

// ── listCrystal ───────────────────────────────────────────────────────

export interface ListCrystalResult {
  ok: boolean;
  /** New listing id on success, null otherwise. */
  listingId: string | null;
  /** Normalized (rounded-to-integer) price that was actually listed. */
  price: number;
  /** 5% fee the sale would burn (preview; buyer still pays full price). */
  feePreview: number;
  error?: MarketListDbError | "rpc_failed" | "rpc_no_row";
}

/**
 * List an owned crystal for `price` _unSC. Fractional prices are rounded
 * to the nearest integer before hitting the DB (the DB itself allows any
 * numeric >= 1, but the TS layer only lists whole-_unSC prices); prices
 * outside [1, 1_000_000] fail with "invalid_price" without an RPC call.
 */
export async function listCrystal(crystalId: string, price: number): Promise<ListCrystalResult> {
  const fail = (
    error: NonNullable<ListCrystalResult["error"]>,
    extras?: Partial<ListCrystalResult>,
  ): ListCrystalResult => ({
    ok: false,
    listingId: null,
    price: 0,
    feePreview: 0,
    ...extras,
    error,
  });

  const normalized = normalizeListingPrice(price);
  if (normalized === null) return fail("invalid_price");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("market_list", {
    p_crystal_id: crystalId,
    p_price: normalized,
  });
  if (error) return fail("rpc_failed");

  const row = unwrapMarketRow<{
    success: boolean;
    listing_id: string | null;
    error_message: string | null;
  }>(data);
  if (!row) return fail("rpc_no_row");

  if (!row.success) {
    return fail(mapMarketError(row.error_message, MARKET_LIST_ERRORS, "rpc_failed"), {
      price: normalized,
      feePreview: computeFee(normalized),
    });
  }

  return {
    ok: true,
    listingId: row.listing_id,
    price: normalized,
    feePreview: computeFee(normalized),
  };
}

// ── unlistCrystal ─────────────────────────────────────────────────────

export interface UnlistCrystalResult {
  ok: boolean;
  error?: MarketUnlistDbError | "rpc_failed" | "rpc_no_row";
}

/** Cancel one of the caller's own active listings. */
export async function unlistCrystal(listingId: string): Promise<UnlistCrystalResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("market_unlist", { p_listing_id: listingId });
  if (error) return { ok: false, error: "rpc_failed" };

  const row = unwrapMarketRow<{ success: boolean; error_message: string | null }>(data);
  if (!row) return { ok: false, error: "rpc_no_row" };

  if (!row.success) {
    return {
      ok: false,
      error: mapMarketError(row.error_message, MARKET_UNLIST_ERRORS, "rpc_failed"),
    };
  }
  return { ok: true };
}

// ── buyCrystal ────────────────────────────────────────────────────────

export interface BuyCrystalResult {
  ok: boolean;
  /** Purchased crystal id on success, null otherwise. */
  crystalId: string | null;
  /** Price paid by the buyer (echoed by the RPC; 0 when unknown). */
  price: number;
  /** 5% fee burned by the sale (seller received price − fee). */
  fee: number;
  /** Buyer's available _unSC after the purchase (best-known on failure). */
  newAvailable: number;
  error?: MarketBuyDbError | "rpc_failed" | "rpc_no_row";
}

/**
 * Buy an active listing. The RPC is atomic: balance transfer (with the fee
 * leaving circulation), ownership transfer, listing close, and ledger rows
 * all happen in one transaction. On "insufficient_funds" the RPC reports
 * price / fee / the buyer's current balance, which is passed through here.
 */
export async function buyCrystal(listingId: string): Promise<BuyCrystalResult> {
  const fail = (
    error: NonNullable<BuyCrystalResult["error"]>,
    extras?: Partial<BuyCrystalResult>,
  ): BuyCrystalResult => ({
    ok: false,
    crystalId: null,
    price: 0,
    fee: 0,
    newAvailable: 0,
    ...extras,
    error,
  });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("market_buy", { p_listing_id: listingId });
  if (error) return fail("rpc_failed");

  const row = unwrapMarketRow<{
    success: boolean;
    crystal_id: string | null;
    price: number | string;
    fee: number | string;
    new_available: number | string;
    error_message: string | null;
  }>(data);
  if (!row) return fail("rpc_no_row");

  if (!row.success) {
    return fail(mapMarketError(row.error_message, MARKET_BUY_ERRORS, "rpc_failed"), {
      price: Number(row.price ?? 0),
      fee: Number(row.fee ?? 0),
      newAvailable: Number(row.new_available ?? 0),
    });
  }

  return {
    ok: true,
    crystalId: row.crystal_id,
    price: Number(row.price),
    fee: Number(row.fee),
    newAvailable: Number(row.new_available),
  };
}
