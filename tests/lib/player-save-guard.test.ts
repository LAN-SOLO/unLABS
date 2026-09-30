import { describe, expect, it } from "vitest";

import { PLAYER_SAVE_MAX_BYTES, guardPlayerSave } from "@/lib/panel/playerSaveGuard";

const NOW = 1_800_000_000_000;

describe("guardPlayerSave", () => {
  it("accepts a normal save unchanged", () => {
    const r = guardPlayerSave({ data: { a: 1 }, lastTickAt: NOW - 5000 }, NOW);
    expect(r).toEqual({ ok: true, data: { a: 1 }, lastTickAt: NOW - 5000 });
  });

  it("clamps a future lastTickAt to now", () => {
    const r = guardPlayerSave({ data: {}, lastTickAt: NOW + 86_400_000 }, NOW);
    expect(r).toMatchObject({ ok: true, lastTickAt: NOW });
  });

  it("rejects invalid lastTickAt values", () => {
    for (const lastTickAt of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0, "123", null]) {
      expect(guardPlayerSave({ data: {}, lastTickAt }, NOW)).toEqual({
        ok: false,
        error: "invalid_last_tick_at",
      });
    }
  });

  it("rejects non-object payloads and data", () => {
    expect(guardPlayerSave(null, NOW)).toMatchObject({ ok: false, error: "invalid_payload" });
    expect(guardPlayerSave({ data: [], lastTickAt: NOW }, NOW)).toMatchObject({
      ok: false,
      error: "invalid_payload",
    });
  });

  it("rejects saves over the size cap", () => {
    const big = { blob: "x".repeat(PLAYER_SAVE_MAX_BYTES) };
    expect(guardPlayerSave({ data: big, lastTickAt: NOW }, NOW)).toEqual({
      ok: false,
      error: "save_too_large",
    });
  });
});
