"use server";

/**
 * Wallet link server actions (on-chain layer, step 1)
 * ===================================================
 *
 * Links exactly one Solana wallet to the account, proven by an ed25519
 * signature over a server-derived challenge:
 *
 *   - walletChallenge  — returns the message the client must sign with
 *                        Phantom's signMessage. Stateless: the message
 *                        embeds the user id and the current UTC hour, so
 *                        no nonce table is needed. Verification accepts
 *                        the current and the previous hour (clock skew /
 *                        slow signing); a captured signature is useless
 *                        to anyone else (user-bound) and expires fast.
 *   - linkWallet       — verifies the signature (tweetnacl) against the
 *                        claimed address, then upserts wallet_links with
 *                        the SERVICE-ROLE client. The table has no client
 *                        write policies — a link can only exist if this
 *                        code path verified a signature. This matters the
 *                        moment links gate NFT claims or token exports.
 *   - getWalletLink    — read-own (RLS).
 *   - unlinkWallet     — service-role delete of the caller's link.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const CHALLENGE_PREFIX = "UnstableLabs wallet link";

/** UTC hour window key, e.g. "2026-08-12T14". */
function hourKey(offsetHours = 0): string {
  return new Date(Date.now() + offsetHours * 3_600_000).toISOString().slice(0, 13);
}

function challengeMessage(userId: string, hour: string): string {
  return `${CHALLENGE_PREFIX}\nuser:${userId}\nissued:${hour}`;
}

/** Service-role client — bypasses RLS; used ONLY after verification. */
function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface WalletChallengeResult {
  ok: boolean;
  message: string;
  error?: "not_authenticated";
}

export async function walletChallenge(): Promise<WalletChallengeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "", error: "not_authenticated" };
  return { ok: true, message: challengeMessage(user.id, hourKey()) };
}

export interface WalletLinkRow {
  address: string;
  network: string;
  verifiedAt: string;
}

export interface GetWalletLinkResult {
  ok: boolean;
  link: WalletLinkRow | null;
  error?: "not_authenticated";
}

export async function getWalletLink(): Promise<GetWalletLinkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, link: null, error: "not_authenticated" };

  const res = await supabase
    .from("wallet_links")
    .select("address, network, verified_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const row = res.data as { address: string; network: string; verified_at: string } | null;
  return {
    ok: true,
    link: row ? { address: row.address, network: row.network, verifiedAt: row.verified_at } : null,
  };
}

export interface LinkWalletResult {
  ok: boolean;
  address: string;
  error?:
    | "not_authenticated"
    | "invalid_address"
    | "invalid_signature"
    | "address_taken"
    | "service_unavailable"
    | "write_failed";
}

export async function linkWallet(
  address: string,
  signatureBase64: string,
): Promise<LinkWalletResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, address, error: "not_authenticated" };

  let pubkeyBytes: Uint8Array;
  try {
    pubkeyBytes = new PublicKey(address).toBytes();
  } catch {
    return { ok: false, address, error: "invalid_address" };
  }

  let signature: Uint8Array;
  try {
    signature = Uint8Array.from(Buffer.from(signatureBase64, "base64"));
    if (signature.length !== 64) throw new Error("bad length");
  } catch {
    return { ok: false, address, error: "invalid_signature" };
  }

  // Accept the current and previous hour windows.
  const verified = [hourKey(0), hourKey(-1)].some((hour) => {
    const message = new TextEncoder().encode(challengeMessage(user.id, hour));
    return nacl.sign.detached.verify(message, signature, pubkeyBytes);
  });
  if (!verified) return { ok: false, address, error: "invalid_signature" };

  const service = createServiceClient();
  if (!service) return { ok: false, address, error: "service_unavailable" };

  const { error } = await service.from("wallet_links").upsert(
    {
      user_id: user.id,
      address,
      network: "solana",
      verified_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" },
  );
  if (error) {
    // Unique violation on address → someone else already linked it.
    return {
      ok: false,
      address,
      error: error.code === "23505" ? "address_taken" : "write_failed",
    };
  }

  return { ok: true, address };
}

export interface UnlinkWalletResult {
  ok: boolean;
  error?: "not_authenticated" | "service_unavailable" | "write_failed";
}

export async function unlinkWallet(): Promise<UnlinkWalletResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const service = createServiceClient();
  if (!service) return { ok: false, error: "service_unavailable" };

  const { error } = await service.from("wallet_links").delete().eq("user_id", user.id);
  if (error) return { ok: false, error: "write_failed" };
  return { ok: true };
}
