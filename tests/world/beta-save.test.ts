// @vitest-environment node
/**
 * Beta-save links (`/world#beta-save=<code>`, lib/world/beta-save.ts):
 * fragment parsing/stripping, gzip codes, size limits and the preview that
 * the confirmation dialog shows. Storage-free (node environment for the
 * Web-streams DecompressionStream).
 */
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  GZ_PREFIX,
  MAX_BETA_LINK,
  PENDING_BETA_SAVE_KEY,
  PENDING_BETA_SAVE_TTL,
  decodeBetaSave,
  parkBetaSave,
  previewBetaSave,
  readBetaSaveHash,
  stripBetaSaveHash,
  takeParkedBetaSave,
} from "@/lib/world/beta-save";
import { initialState } from "@/lib/world/game";
import { ROOMS } from "@/lib/world/content/map";

function envelope(state: unknown, label = "beta test"): string {
  return JSON.stringify({ format: "unlabs-world", version: 1, meta: { label }, state });
}
const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");
const gz = (text: string) =>
  GZ_PREFIX +
  gzipSync(Buffer.from(text, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

describe("readBetaSaveHash / stripBetaSaveHash", () => {
  it("finds the code alone or among other parameters and URL-decodes it", () => {
    expect(readBetaSaveHash("#beta-save=abc%2B%2F%3D")).toBe("abc+/=");
    expect(readBetaSaveHash("#x=1&beta-save=gz.AAA&y=2")).toBe("gz.AAA");
    expect(readBetaSaveHash("beta-save=q")).toBe("q");
  });
  it("returns null without the parameter and '' for an empty value", () => {
    expect(readBetaSaveHash("")).toBeNull();
    expect(readBetaSaveHash("#")).toBeNull();
    expect(readBetaSaveHash("#other=1")).toBeNull();
    expect(readBetaSaveHash("#beta-saved=1")).toBeNull();
    expect(readBetaSaveHash("#beta-save=")).toBe("");
    expect(readBetaSaveHash("#beta-save")).toBe("");
  });
  it("keeps a malformed escape as-is instead of throwing", () => {
    expect(readBetaSaveHash("#beta-save=%E0%A4%A")).toBe("%E0%A4%A");
  });
  it("strips only the beta-save parameter", () => {
    expect(stripBetaSaveHash("#beta-save=abc")).toBe("");
    expect(stripBetaSaveHash("#x=1&beta-save=abc&y=2")).toBe("#x=1&y=2");
    expect(stripBetaSaveHash("#x=1")).toBe("#x=1");
    expect(stripBetaSaveHash("")).toBe("");
  });
});

describe("decodeBetaSave", () => {
  it("passes a plain import code through", async () => {
    const code = b64(envelope(initialState()));
    expect(await decodeBetaSave(code)).toEqual({ ok: true, text: code });
  });
  it("inflates a gz. code to the envelope JSON", async () => {
    const text = envelope(initialState());
    expect(await decodeBetaSave(gz(text))).toEqual({ ok: true, text });
  });
  it("rejects empty, oversized and damaged codes with the import error texts", async () => {
    expect(await decodeBetaSave("  ")).toEqual({ ok: false, error: "No save code entered." });
    expect(await decodeBetaSave("x".repeat(MAX_BETA_LINK + 1))).toEqual({
      ok: false,
      error: "Save code is too large.",
    });
    expect(await decodeBetaSave(`${GZ_PREFIX}not*base64`)).toEqual({
      ok: false,
      error: "Save code is damaged or incomplete.",
    });
    expect(await decodeBetaSave(`${GZ_PREFIX}${b64("plain, not gzip")}`)).toEqual({
      ok: false,
      error: "Save code is damaged or incomplete.",
    });
  });
  it("stops inflating a gzip bomb at the import limit", async () => {
    const bomb = gz(" ".repeat(9_000_000));
    expect(bomb.length).toBeLessThan(40_000);
    expect(await decodeBetaSave(bomb)).toEqual({ ok: false, error: "Save code is too large." });
  });
});

describe("previewBetaSave", () => {
  it("shows the meta of a valid save without touching storage", async () => {
    const s = initialState();
    const room = ROOMS.find((r) => r.floor === 0 && r.id === "kontroll") ?? ROOMS[0]!;
    s.playTime = 3723;
    s.pos = [room.x + Math.floor(room.w / 2), 1, room.z + Math.floor(room.d / 2)];
    const p = await previewBetaSave(gz(envelope(s, "Beta · before UEC")));
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.meta.label).toBe("Beta · before UEC");
    expect(p.meta.playTime).toBe(3723);
    expect(p.meta.floor).toBe(0);
    expect(p.state.playTime).toBe(3723);
    expect(p.text.startsWith("{")).toBe(true);
  });
  it("counts sanitiser repairs and rejects non-saves / future versions", async () => {
    const s = initialState() as unknown as Record<string, unknown>;
    s.inventory = { not_an_item: 3 };
    const repaired = await previewBetaSave(b64(envelope(s)));
    expect(repaired.ok && repaired.repaired).toBeGreaterThan(0);

    expect(await previewBetaSave(b64(JSON.stringify({ hello: "world" })))).toEqual({
      ok: false,
      error: "Not a valid _unLAB save.",
    });
    const future = await previewBetaSave(b64(envelope({ ...s, version: 999 })));
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.error).toContain("v999");
  });
});

describe("parked beta-save codes (login round-trip)", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };
  it("returns a fresh code once", () => {
    const s = mem();
    parkBetaSave("gz.abc", s, 1000);
    expect(takeParkedBetaSave(s, 2000)).toBe("gz.abc");
    expect(takeParkedBetaSave(s, 2000)).toBeNull();
  });
  it("drops stale, future-dated and malformed entries", () => {
    const s = mem();
    parkBetaSave("x", s, 0);
    expect(takeParkedBetaSave(s, PENDING_BETA_SAVE_TTL + 1)).toBeNull();
    parkBetaSave("x", s, 5000);
    expect(takeParkedBetaSave(s, 1000)).toBeNull();
    s.setItem(PENDING_BETA_SAVE_KEY, "{not json");
    expect(takeParkedBetaSave(s, 1000)).toBeNull();
    s.setItem(PENDING_BETA_SAVE_KEY, JSON.stringify({ code: 1, at: 1 }));
    expect(takeParkedBetaSave(s, 2)).toBeNull();
  });
});
