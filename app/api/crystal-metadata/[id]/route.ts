import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Public Metaplex-standard metadata for a crystal (on-chain layer,
 * NFT scaffolding). NFT metadata URIs must be publicly resolvable, so
 * this route reads with the service-role client — but exposes ONLY
 * cosmetic trait fields, never the owner or any account linkage, and
 * only for crystals that have actually been minted on-chain
 * (mint_address set). Unminted crystals stay private to their owner.
 *
 * The eventual devnet mint flow points its token URI here:
 *   https://<host>/api/crystal-metadata/<crystalId>
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid crystal id" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Metadata service unavailable" }, { status: 503 });
  }
  const supabase = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const res = await supabase
    .from("crystals")
    .select(
      "id, name, color, volatility, rotation, state, era, is_genesis, total_power, slice_count, mint_address, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  const c = res.data as {
    id: string;
    name: string;
    color: string;
    volatility: string;
    rotation: string;
    state: string;
    era: string;
    is_genesis: boolean;
    total_power: number | string;
    slice_count: number;
    mint_address: string | null;
    created_at: string;
  } | null;

  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!c.mint_address) {
    // Unminted crystals are game-private; nothing to serve publicly.
    return NextResponse.json({ error: "Not minted" }, { status: 404 });
  }

  // Metaplex fungible/non-fungible JSON standard.
  return NextResponse.json(
    {
      name: c.name,
      symbol: "UNCRY",
      description:
        "An UnstableLabs crystal — grown, sliced, and stabilized inside the _unOS laboratory.",
      attributes: [
        { trait_type: "Color", value: c.color },
        { trait_type: "Volatility Tier", value: c.volatility },
        { trait_type: "Rotation", value: c.rotation },
        { trait_type: "State", value: c.state },
        { trait_type: "Era", value: c.era },
        { trait_type: "Genesis", value: c.is_genesis ? "yes" : "no" },
        { trait_type: "Total Power", value: Number(c.total_power) },
        { trait_type: "Slices", value: c.slice_count },
      ],
      properties: {
        category: "image",
        crystal_id: c.id,
        minted: c.mint_address,
        created_at: c.created_at,
      },
    },
    {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
    },
  );
}
