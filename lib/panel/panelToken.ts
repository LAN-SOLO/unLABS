import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Panel access token signing (HMAC-SHA256).
 *
 * Token format: `<userId>:<issuedAtMs>:<hexSignature>`.
 *
 * The HMAC secret is `PANEL_TOKEN_SECRET`, or — when unset — derived from
 * the FULL service-role key. Nothing public (anon key, JWT header) is ever
 * used. With neither available the module fails closed: no token can be
 * issued and every verification fails.
 */

export const PANEL_TOKEN_EXPIRY_MS = 5 * 60 * 1000;

/** Env source (defaults to `process.env`); reads PANEL_TOKEN_SECRET / SUPABASE_SERVICE_ROLE_KEY. */
export type PanelTokenEnv = Readonly<Record<string, string | undefined>>;

export function getPanelTokenSecret(env: PanelTokenEnv = process.env): string | null {
  const explicit = env.PANEL_TOKEN_SECRET;
  if (explicit) return explicit;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createHash("sha256").update(`panel-token:${serviceKey}`).digest("hex");
  }
  return null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Issue a token for `userId`, or null when no signing secret is configured. */
export function issuePanelToken(
  userId: string,
  nowMs: number = Date.now(),
  env: PanelTokenEnv = process.env,
): string | null {
  const secret = getPanelTokenSecret(env);
  if (!secret) return null;
  const payload = `${userId}:${nowMs}`;
  return `${payload}:${sign(payload, secret)}`;
}

export type PanelTokenCheck =
  | { valid: true }
  | {
      valid: false;
      reason: "no_secret" | "malformed" | "wrong_user" | "expired" | "bad_signature";
    };

/** Verify a token belongs to `userId`, is unexpired and correctly signed. */
export function verifyPanelToken(
  token: string,
  userId: string,
  nowMs: number = Date.now(),
  env: PanelTokenEnv = process.env,
): PanelTokenCheck {
  const secret = getPanelTokenSecret(env);
  if (!secret) return { valid: false, reason: "no_secret" };

  const parts = token.split(":");
  if (parts.length !== 3) return { valid: false, reason: "malformed" };
  const [tokenUser, issuedAtStr, signature] = parts;
  if (!/^\d+$/.test(issuedAtStr) || !/^[0-9a-f]{64}$/.test(signature)) {
    return { valid: false, reason: "malformed" };
  }
  if (tokenUser !== userId) return { valid: false, reason: "wrong_user" };

  const issuedAt = Number(issuedAtStr);
  if (issuedAt > nowMs || nowMs - issuedAt > PANEL_TOKEN_EXPIRY_MS) {
    return { valid: false, reason: "expired" };
  }

  const expected = sign(`${tokenUser}:${issuedAtStr}`, secret);
  const ok = timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  return ok ? { valid: true } : { valid: false, reason: "bad_signature" };
}
