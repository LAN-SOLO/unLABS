"use server";

/**
 * Crystal NFT mint server action (on-chain layer, step 4 — devnet)
 * ================================================================
 *
 * Mints an owned, unlisted, not-yet-minted crystal as a Metaplex NFT
 * into the caller's verified wallet (wallet_links — signature-proven,
 * see actions/wallet.ts). The chain call itself lives in
 * lib/solana/mintCrystalNft.ts and is dynamically imported so the
 * heavy umi stack only loads when a mint actually happens.
 *
 * mint_address is written back with the SERVICE-ROLE client under a
 * `is null` guard: crystals has no client UPDATE policy for the
 * column, and the conditional write makes a concurrent double-mint
 * lose the race loudly instead of silently overwriting. Devnet only —
 * before any mainnet framing, the legal gate in NEXT_STEPS.md applies.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { isMintKeypairConfigured } from "@/lib/solana/mintKeypair";

/** Service-role client — bypasses RLS; used ONLY for the guarded write-back. */
function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface MintNftResult {
  ok: boolean;
  crystalName?: string;
  mintAddress?: string;
  signature?: string;
  explorerUrl?: string;
  error?:
    | "not_authenticated"
    | "not_configured"
    | "crystal_not_found"
    | "already_minted"
    | "listed"
    | "no_wallet"
    | "mint_failed"
    | "write_failed";
}

export async function mintCrystalNft(crystalName: string): Promise<MintNftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  // Configuration gate first — cheap, and the command can explain the
  // missing keypair before any DB work happens.
  if (!isMintKeypairConfigured() || !createServiceClient()) {
    return { ok: false, error: "not_configured" };
  }

  // Owned crystal by name. mint_address predates the generated types
  // (same manual cast as the crystal-metadata route).
  const crystalRes = await supabase
    .from("crystals")
    .select("id, name, mint_address")
    .eq("owner_id", user.id)
    .ilike("name", crystalName)
    .maybeSingle();
  const crystal = crystalRes.data as {
    id: string;
    name: string;
    mint_address: string | null;
  } | null;
  if (!crystal) return { ok: false, error: "crystal_not_found" };
  if (crystal.mint_address) {
    return { ok: false, error: "already_minted", mintAddress: crystal.mint_address };
  }

  // A listed crystal can change owners mid-mint — refuse, same guard
  // the slice RPCs apply.
  const { data: activeListing } = await supabase
    .from("marketplace_listings")
    .select("id")
    .eq("crystal_id", crystal.id)
    .eq("status", "active")
    .maybeSingle();
  if (activeListing) return { ok: false, error: "listed" };

  // Signature-verified wallet link (RLS: read-own).
  const linkRes = await supabase
    .from("wallet_links")
    .select("address")
    .eq("user_id", user.id)
    .maybeSingle();
  const link = linkRes.data as { address: string } | null;
  if (!link) return { ok: false, error: "no_wallet" };

  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const metadataUri = `${appUrl}/api/crystal-metadata/${crystal.id}`;

  let mintAddress: string;
  let signature: string;
  try {
    const { mintCrystalNftOnChain } = await import("@/lib/solana/mintCrystalNft");
    const chainResult = await mintCrystalNftOnChain({
      name: crystal.name,
      ownerAddress: link.address,
      metadataUri,
    });
    mintAddress = chainResult.mintAddress;
    signature = chainResult.signature;
  } catch {
    return { ok: false, error: "mint_failed", crystalName: crystal.name };
  }

  // Guarded write-back: only the first mint for a crystal may land.
  const service = createServiceClient();
  if (!service) return { ok: false, error: "not_configured" };
  const updateRes = await service
    .from("crystals")
    .update({ mint_address: mintAddress } as never)
    .eq("id", crystal.id)
    .is("mint_address", null)
    .select("id");
  if (updateRes.error || !updateRes.data || updateRes.data.length === 0) {
    // The NFT exists on devnet but the DB row was taken (concurrent
    // mint) or the write failed — surface it, never pretend success.
    return { ok: false, error: "write_failed", mintAddress, signature };
  }

  return {
    ok: true,
    crystalName: crystal.name,
    mintAddress,
    signature,
    explorerUrl: `https://explorer.solana.com/address/${mintAddress}?cluster=devnet`,
  };
}
