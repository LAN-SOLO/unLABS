import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  RESERVE_SOURCES,
  awardFromReserve,
  getReserveStatus,
  isReserveSource,
} from "@/lib/game/economy";

/**
 * The RPC itself is exercised by the integration tests against a live DB.
 * These unit tests cover the TypeScript-side validation and response
 * marshaling so we never ship the wrong error code, source tag, or number
 * coercion.
 */

function mockSupabase(impl: {
  rpc?: (name: string, params: unknown) => Promise<{ data: unknown; error: unknown }>;
}): SupabaseClient {
  return {
    rpc:
      impl.rpc ??
      (async () => ({
        data: null,
        error: { message: "no mock set" },
      })),
  } as unknown as SupabaseClient;
}

describe("isReserveSource", () => {
  it("accepts every documented source", () => {
    for (const s of RESERVE_SOURCES) {
      expect(isReserveSource(s)).toBe(true);
    }
  });
  it("rejects unknown sources", () => {
    expect(isReserveSource("admin")).toBe(false);
    expect(isReserveSource("")).toBe(false);
    expect(isReserveSource("Achievement")).toBe(false); // case sensitive
  });

  it("accepts 'daily' (requires migration 20260808000001 on the DB side)", () => {
    expect(isReserveSource("daily")).toBe(true);
  });
});

describe("awardFromReserve — validation", () => {
  it("rejects zero / negative / non-finite amounts before touching the RPC", async () => {
    const rpc = vi.fn();
    const supabase = mockSupabase({ rpc });
    for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = await awardFromReserve(supabase, {
        userId: "u1",
        amount,
        source: "achievement",
      });
      expect(r.ok).toBe(false);
      expect(r.error).toBe("invalid_amount");
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects unknown sources before touching the RPC", async () => {
    const rpc = vi.fn();
    const supabase = mockSupabase({ rpc });
    const r = await awardFromReserve(supabase, {
      userId: "u1",
      amount: 10,
      // Cast to bypass compile-time check — simulates a runtime misuse.
      source: "admin_grant" as unknown as "achievement",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_source");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("awardFromReserve — RPC response handling", () => {
  it("marshals a successful RPC row into {ok, balances}", async () => {
    const supabase = mockSupabase({
      rpc: async (name, params) => {
        expect(name).toBe("reserve_burn_and_award");
        expect(params).toMatchObject({
          p_user_id: "u1",
          p_amount: 25,
          p_source: "achievement",
          p_ref: "ach.resource_dabbler.t1",
        });
        return {
          data: [
            {
              success: true,
              reserve_available: "99_999_975",
              new_user_balance: "42.5",
              error_message: null,
            },
          ],
          error: null,
        };
      },
    });
    const r = await awardFromReserve(supabase, {
      userId: "u1",
      amount: 25,
      source: "achievement",
      ref: "ach.resource_dabbler.t1",
    });
    expect(r.ok).toBe(true);
    // Numeric coercion should handle strings (Postgres numeric -> JS string over the wire)
    expect(r.newUserBalance).toBe(42.5);
  });

  it("maps DB-level error_message to our typed error code", async () => {
    const cases: Array<[string, string]> = [
      ["reserve_insufficient", "reserve_insufficient"],
      ["unauthorized", "unauthorized"],
      ["source_not_allowed", "source_not_allowed"],
      ["invalid_amount", "invalid_amount"],
      ["something_weird", "rpc_failed"],
    ];
    for (const [dbMsg, expected] of cases) {
      const supabase = mockSupabase({
        rpc: async () => ({
          data: [
            {
              success: false,
              reserve_available: 0,
              new_user_balance: 0,
              error_message: dbMsg,
            },
          ],
          error: null,
        }),
      });
      const r = await awardFromReserve(supabase, {
        userId: "u1",
        amount: 1,
        source: "test",
      });
      expect(r.ok).toBe(false);
      expect(r.error).toBe(expected);
    }
  });

  it("returns rpc_failed when supabase.rpc errors out", async () => {
    const supabase = mockSupabase({
      rpc: async () => ({ data: null, error: { message: "network" } }),
    });
    const r = await awardFromReserve(supabase, {
      userId: "u1",
      amount: 1,
      source: "test",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("rpc_failed");
  });

  it("returns rpc_no_row when the RPC returns an empty array", async () => {
    const supabase = mockSupabase({
      rpc: async () => ({ data: [], error: null }),
    });
    const r = await awardFromReserve(supabase, {
      userId: "u1",
      amount: 1,
      source: "test",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("rpc_no_row");
  });
});

describe("getReserveStatus", () => {
  it("returns null on RPC error (dev-only gate inside the DB)", async () => {
    const supabase = mockSupabase({
      rpc: async () => ({ data: null, error: { message: "forbidden" } }),
    });
    expect(await getReserveStatus(supabase)).toBeNull();
  });

  it("coerces numeric string fields", async () => {
    const supabase = mockSupabase({
      rpc: async () => ({
        data: [
          {
            available: "100000000",
            total_burned: "250",
            total_emitted: "0",
          },
        ],
        error: null,
      }),
    });
    const r = await getReserveStatus(supabase);
    expect(r).toEqual({
      available: 100_000_000,
      totalBurned: 250,
      totalEmitted: 0,
    });
  });
});
