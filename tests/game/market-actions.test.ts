import { describe, it, expect } from "vitest";

import {
  MARKET_BUY_ERRORS,
  MARKET_FEE_RATE,
  MARKET_LIST_ERRORS,
  MARKET_MAX_PRICE,
  MARKET_MIN_PRICE,
  MARKET_UNLIST_ERRORS,
  computeFee,
  mapMarketError,
  normalizeListingPrice,
  toListingView,
  unwrapMarketRow,
  type RawListingRow,
} from "@/lib/game/market";

/**
 * The RPCs themselves (market_list/market_unlist/market_buy) are exercised
 * against a live DB by the integration tests. These unit tests pin the
 * TypeScript-side semantics — fee formula parity with the SQL
 * `floor(price * 0.05 * 100) / 100`, RPC row unwrapping, and error-code
 * mapping — so the actions in app/(game)/actions/market.ts never drift
 * from the migration (same testing split as economy-reserve.test.ts).
 */

// ── computeFee — SQL parity ───────────────────────────────────────────

/**
 * Exact reference for `floor(price * 0.05 * 100) / 100` on prices with at
 * most 2 decimal places: work in integer hundredths (BigInt), where
 * price * 5 = (hundredths * 5) / 100 exactly.
 */
function sqlFeeRef(priceHundredths: bigint): number {
  // BigInt division floors (tsconfig targets < ES2020, so no literals).
  const centsFloored = (priceHundredths * BigInt(5)) / BigInt(100);
  return Number(centsFloored) / 100;
}

describe("computeFee — matches SQL floor(price * 0.05 * 100) / 100", () => {
  it("minimum listable price: 1 → 0.05", () => {
    expect(computeFee(1)).toBe(0.05);
  });

  it("integer prices floor cleanly", () => {
    expect(computeFee(20)).toBe(1);
    expect(computeFee(41)).toBe(2.05);
    expect(computeFee(999)).toBe(49.95);
    expect(computeFee(MARKET_MAX_PRICE)).toBe(50_000);
  });

  it("fractional prices use SQL floor semantics (never round up)", () => {
    // 1.5 * 5 = 7.5 cents → floor 7 → 0.07 (not 0.08)
    expect(computeFee(1.5)).toBe(0.07);
    // 1.99 * 5 = 9.95 → floor 9 → 0.09
    expect(computeFee(1.99)).toBe(0.09);
    // 33.33 * 5 = 166.65 → floor 166 → 1.66
    expect(computeFee(33.33)).toBe(1.66);
  });

  it("is immune to binary float noise below the floor boundary", () => {
    // 8.2 * 5 === 40.99999999999999… in doubles; SQL numeric says exactly
    // 41 cents. A naive Math.floor would produce 0.40.
    expect(computeFee(8.2)).toBe(0.41);
    expect(computeFee(16.4)).toBe(0.82);
    expect(computeFee(0.29)).toBe(0.01);
  });

  it("agrees with an exact BigInt reference across integer prices", () => {
    for (let price = MARKET_MIN_PRICE; price <= 5000; price++) {
      expect(computeFee(price)).toBe(sqlFeeRef(BigInt(price * 100)));
    }
  });

  it("agrees with the exact reference on 2-decimal prices", () => {
    // Every hundredth step across [1, 3): exercises all *5 remainders.
    for (let h = 100; h < 300; h++) {
      const price = h / 100;
      expect(computeFee(price)).toBe(sqlFeeRef(BigInt(h)));
    }
  });

  it("fee never exceeds the nominal 5% and is within one cent of it", () => {
    for (const price of [1, 7, 13.37, 250, 9999, 123456.78]) {
      const fee = computeFee(price);
      expect(fee).toBeLessThanOrEqual(price * MARKET_FEE_RATE + 1e-9);
      expect(fee).toBeGreaterThan(price * MARKET_FEE_RATE - 0.01);
    }
  });
});

// ── normalizeListingPrice ─────────────────────────────────────────────

describe("normalizeListingPrice", () => {
  it("accepts the documented range boundaries", () => {
    expect(normalizeListingPrice(MARKET_MIN_PRICE)).toBe(1);
    expect(normalizeListingPrice(MARKET_MAX_PRICE)).toBe(1_000_000);
  });

  it("rounds fractional input to the nearest integer (documented)", () => {
    expect(normalizeListingPrice(1.4)).toBe(1);
    expect(normalizeListingPrice(1.6)).toBe(2);
    expect(normalizeListingPrice(999.5)).toBe(1000);
  });

  it("rejects out-of-range and non-finite input", () => {
    expect(normalizeListingPrice(0)).toBeNull();
    expect(normalizeListingPrice(0.4)).toBeNull(); // rounds to 0 → below min
    expect(normalizeListingPrice(-5)).toBeNull();
    expect(normalizeListingPrice(1_000_000.6)).toBeNull(); // rounds above max
    expect(normalizeListingPrice(Number.NaN)).toBeNull();
    expect(normalizeListingPrice(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

// ── unwrapMarketRow ───────────────────────────────────────────────────

describe("unwrapMarketRow", () => {
  it("returns the first row of a RETURNS TABLE payload", () => {
    const row = { success: true, error_message: null };
    expect(unwrapMarketRow([row])).toBe(row);
    expect(unwrapMarketRow([row, { success: false, error_message: "x" }])).toBe(row);
  });

  it("returns null for empty or non-array payloads", () => {
    expect(unwrapMarketRow([])).toBeNull();
    expect(unwrapMarketRow(null)).toBeNull();
    expect(unwrapMarketRow(undefined)).toBeNull();
    expect(unwrapMarketRow({ success: true })).toBeNull();
  });
});

// ── mapMarketError ────────────────────────────────────────────────────

describe("mapMarketError", () => {
  it("passes every documented market_list code through unchanged", () => {
    for (const code of MARKET_LIST_ERRORS) {
      expect(mapMarketError(code, MARKET_LIST_ERRORS, "rpc_failed")).toBe(code);
    }
  });

  it("passes every documented market_unlist code through unchanged", () => {
    for (const code of MARKET_UNLIST_ERRORS) {
      expect(mapMarketError(code, MARKET_UNLIST_ERRORS, "rpc_failed")).toBe(code);
    }
  });

  it("passes every documented market_buy code through unchanged", () => {
    for (const code of MARKET_BUY_ERRORS) {
      expect(mapMarketError(code, MARKET_BUY_ERRORS, "rpc_failed")).toBe(code);
    }
  });

  it("covers the codes the migration can emit", () => {
    // Spot-check the semantically important ones stay registered.
    expect(MARKET_BUY_ERRORS).toContain("own_listing");
    expect(MARKET_BUY_ERRORS).toContain("insufficient_funds");
    expect(MARKET_BUY_ERRORS).toContain("not_active");
    expect(MARKET_BUY_ERRORS).toContain("seller_no_longer_owner");
    expect(MARKET_LIST_ERRORS).toContain("already_listed");
    expect(MARKET_LIST_ERRORS).toContain("not_owner");
    expect(MARKET_LIST_ERRORS).toContain("crystal_not_found");
    expect(MARKET_LIST_ERRORS).toContain("invalid_price");
    expect(MARKET_UNLIST_ERRORS).toContain("not_seller");
  });

  it("maps unknown / missing messages onto the fallback", () => {
    expect(mapMarketError("something_weird", MARKET_BUY_ERRORS, "rpc_failed")).toBe("rpc_failed");
    expect(mapMarketError(null, MARKET_LIST_ERRORS, "rpc_failed")).toBe("rpc_failed");
    expect(mapMarketError(undefined, MARKET_UNLIST_ERRORS, "rpc_failed")).toBe("rpc_failed");
    expect(mapMarketError("", MARKET_BUY_ERRORS, "rpc_failed")).toBe("rpc_failed");
  });

  it("does not leak codes across RPCs", () => {
    // market_list has no "own_listing"; must fall back instead of leaking.
    expect(mapMarketError("own_listing", MARKET_LIST_ERRORS, "rpc_failed")).toBe("rpc_failed");
    expect(mapMarketError("already_listed", MARKET_BUY_ERRORS, "rpc_failed")).toBe("rpc_failed");
  });
});

// ── toListingView ─────────────────────────────────────────────────────

function rawRow(overrides: Partial<RawListingRow> = {}): RawListingRow {
  return {
    id: "listing-1",
    crystal_id: "crystal-1",
    seller_id: "seller-1",
    price: 100,
    created_at: "2026-08-12T00:00:00Z",
    crystals: {
      name: "prism",
      color: "blue",
      volatility: "3",
      total_power: 12.5,
      slice_count: 8,
    },
    ...overrides,
  };
}

describe("toListingView", () => {
  it("maps a raw embed row onto the client view with a fee preview", () => {
    const view = toListingView(rawRow(), "viewer-1");
    expect(view).toEqual({
      listingId: "listing-1",
      crystalId: "crystal-1",
      name: "prism",
      color: "blue",
      volatility: "3",
      totalPower: 12.5,
      sliceCount: 8,
      price: 100,
      feePreview: 5, // computeFee(100)
      sellerIsMe: false,
      createdAt: "2026-08-12T00:00:00Z",
    });
  });

  it("marks the seller's own listings", () => {
    expect(toListingView(rawRow(), "seller-1")?.sellerIsMe).toBe(true);
    expect(toListingView(rawRow(), "someone-else")?.sellerIsMe).toBe(false);
    expect(toListingView(rawRow(), null)?.sellerIsMe).toBe(false);
  });

  it("coerces numeric-as-string wire values (Postgres numeric)", () => {
    const view = toListingView(
      rawRow({
        price: "250",
        crystals: {
          name: "prism",
          color: "red",
          volatility: "5",
          total_power: "16.8",
          slice_count: "8",
        },
      }),
      null,
    );
    expect(view?.price).toBe(250);
    expect(view?.totalPower).toBe(16.8);
    expect(view?.sliceCount).toBe(8);
    expect(view?.feePreview).toBe(12.5); // computeFee(250)
  });

  it("returns null when the crystal embed is missing", () => {
    expect(toListingView(rawRow({ crystals: null }), "viewer-1")).toBeNull();
  });
});
