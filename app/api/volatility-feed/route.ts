import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";
import {
  computeAverageTps,
  computeBlockTimeMs,
  mapTpsToTier,
  parsePerformanceSamples,
  DEFAULT_BLOCK_TIME_MS,
} from "@/lib/solana/volatility";

/**
 * GET /api/volatility-feed — on-chain network telemetry (display only).
 *
 * Serves the freshest `volatility_snapshots` row when it is younger than
 * FRESH_WINDOW_MS; otherwise polls Solana `getRecentPerformanceSamples`,
 * persists a new snapshot with the service-role client (the table is
 * service-role-write-only per migration 20260203000005), and returns it.
 * Degradation order: fresh cache → fresh RPC reading → stale cache
 * (`stale: true`) → 502/503.
 *
 * NOT a price input — the deterministic daily price modifier is
 * `lib/game/volatility.ts` and does not read this feed.
 */

const RPC_ENDPOINTS = ["https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana"];
const RPC_TIMEOUT_MS = 4_000;
const PERFORMANCE_SAMPLE_COUNT = 4;
const FRESH_WINDOW_MS = 5 * 60_000;

// Rate limiting: simple in-memory store (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

/** Service-role client — bypasses RLS; required to write snapshots. */
function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface SnapshotRow {
  tps: number;
  block_time_ms: number;
  calculated_tier: Database["public"]["Enums"]["volatility_tier"];
  captured_at: string;
}

function toFeedResponse(row: SnapshotRow, stale: boolean) {
  return NextResponse.json({
    tps: Number(row.tps),
    blockTimeMs: row.block_time_ms,
    tier: row.calculated_tier,
    capturedAt: row.captured_at,
    stale,
    network: "solana",
  });
}

/**
 * Latest snapshot via the caller's (authenticated) server client — the
 * initial schema's "Anyone can view volatility" SELECT policy grants
 * read access; only writes are service-role-only.
 */
async function readLatestSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SnapshotRow | null> {
  const { data, error } = await supabase
    .from("volatility_snapshots")
    .select("tps, block_time_ms, calculated_tier, captured_at")
    .eq("network", "solana")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/** Poll the RPC fallback list; first endpoint with a valid result wins. */
async function fetchSolanaSamples() {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getRecentPerformanceSamples",
          params: [PERFORMANCE_SAMPLE_COUNT],
        }),
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      });

      if (!res.ok) continue;

      const data: unknown = await res.json();
      const result = (data as { error?: unknown; result?: unknown }).result;
      if ((data as { error?: unknown }).error || result === undefined) continue;

      const samples = parsePerformanceSamples(result);
      if (samples) return samples;
    } catch {
      // timeout / network error — try next endpoint
    }
  }
  return null;
}

export async function GET() {
  // SECURITY: Require authentication
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY: Rate limiting per user
  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  // (a) Cache hit: freshest snapshot younger than the fresh window.
  const latest = await readLatestSnapshot(supabase);
  if (latest && Date.now() - new Date(latest.captured_at).getTime() < FRESH_WINDOW_MS) {
    return toFeedResponse(latest, false);
  }

  // Without the service-role key we cannot persist a new reading; the
  // table is service-role-write-only. Serve the stale cache if any,
  // otherwise fail clearly. Checked before the RPC call so we don't
  // poll layer-1 for a reading we could not store.
  const service = createServiceClient();
  if (!service) {
    if (latest) return toFeedResponse(latest, true);
    return NextResponse.json(
      { error: "Telemetry archive offline: SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 },
    );
  }

  // (b) Poll Solana and persist a fresh snapshot.
  const samples = await fetchSolanaSamples();
  const tps = samples ? computeAverageTps(samples) : null;

  if (samples && tps !== null) {
    const row: SnapshotRow = {
      tps,
      block_time_ms: computeBlockTimeMs(samples) ?? DEFAULT_BLOCK_TIME_MS,
      calculated_tier: mapTpsToTier(tps),
      captured_at: new Date().toISOString(),
    };

    const { error: insertError } = await service
      .from("volatility_snapshots")
      .insert({ ...row, network: "solana" });
    if (insertError) {
      // Best effort: the reading is still valid for this response.
      console.error("volatility-feed: snapshot insert failed:", insertError.message);
    }
    return toFeedResponse(row, false);
  }

  // (c) RPC unreachable: fall back to the last snapshot of any age.
  if (latest) {
    return toFeedResponse(latest, true);
  }

  return NextResponse.json(
    { error: "uplink to layer-1 lost — no telemetry in the archive" },
    { status: 502 },
  );
}
