import { describe, expect, it } from "vitest";

import {
  PANEL_TOKEN_EXPIRY_MS,
  getPanelTokenSecret,
  issuePanelToken,
  verifyPanelToken,
} from "@/lib/panel/panelToken";

// A realistic service-role JWT: the first 32 chars are the public JWT header.
const HEADER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX";
const SERVICE_KEY = `${HEADER}VCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJl`;
const ENV = { SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY };
const USER = "11111111-2222-3333-4444-555555555555";
const NOW = 1_800_000_000_000;

describe("panel token secret", () => {
  it("prefers PANEL_TOKEN_SECRET", () => {
    expect(getPanelTokenSecret({ PANEL_TOKEN_SECRET: "s3cret", ...ENV })).toBe("s3cret");
  });

  it("derives from the full service-role key, not its public header", () => {
    const secret = getPanelTokenSecret(ENV);
    expect(secret).not.toBeNull();
    expect(secret).not.toContain(HEADER);
    const sameHeader = getPanelTokenSecret({ SUPABASE_SERVICE_ROLE_KEY: `${HEADER}.other.key` });
    expect(sameHeader).not.toBe(secret);
  });

  it("fails closed without any secret (anon key is never used)", () => {
    expect(getPanelTokenSecret({})).toBeNull();
    expect(issuePanelToken(USER, NOW, {})).toBeNull();
    const token = issuePanelToken(USER, NOW, ENV);
    expect(token).not.toBeNull();
    expect(verifyPanelToken(token ?? "", USER, NOW, {})).toEqual({
      valid: false,
      reason: "no_secret",
    });
  });

  it("rejects a token forged with the old header-derived secret", async () => {
    const { createHmac } = await import("crypto");
    const payload = `${USER}:${NOW}`;
    const forgedSig = createHmac("sha256", `panel_token_${SERVICE_KEY.slice(0, 32)}`)
      .update(payload)
      .digest("hex");
    expect(verifyPanelToken(`${payload}:${forgedSig}`, USER, NOW, ENV)).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });
});

describe("panel token verify", () => {
  const token = issuePanelToken(USER, NOW, ENV) ?? "";

  it("accepts a fresh token for the same user", () => {
    expect(verifyPanelToken(token, USER, NOW + 1000, ENV)).toEqual({ valid: true });
  });

  it("rejects another user, expiry, tampering and malformed input", () => {
    expect(verifyPanelToken(token, "someone-else", NOW, ENV)).toMatchObject({ valid: false });
    expect(verifyPanelToken(token, USER, NOW + PANEL_TOKEN_EXPIRY_MS + 1, ENV)).toEqual({
      valid: false,
      reason: "expired",
    });
    const [u, t, sig] = token.split(":");
    const flipped = `${sig.slice(0, -1)}${sig.endsWith("0") ? "1" : "0"}`;
    expect(verifyPanelToken(`${u}:${t}:${flipped}`, USER, NOW, ENV)).toEqual({
      valid: false,
      reason: "bad_signature",
    });
    expect(verifyPanelToken("garbage", USER, NOW, ENV)).toEqual({
      valid: false,
      reason: "malformed",
    });
    expect(verifyPanelToken(`${u}:${t}:zz`, USER, NOW, ENV)).toEqual({
      valid: false,
      reason: "malformed",
    });
  });
});
