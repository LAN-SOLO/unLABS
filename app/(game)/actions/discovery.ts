"use server";

/**
 * Discovery server actions
 * ========================
 *
 * Server-authoritative logging of resonance protocol discoveries.
 * Enables leaderboards and first-discoverer tracking.
 */

import { createClient } from "@/lib/supabase/server";

export interface DiscoveryResult {
  ok: boolean;
  error?: string;
}

export interface PlayerDiscovery {
  id: string;
  discoveryId: string;
  discoveredAt: string;
  metadata: Record<string, unknown>;
}

export interface DiscoveryListResult {
  ok: boolean;
  discoveries: PlayerDiscovery[];
  error?: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  discoveredAt: string;
}

export interface LeaderboardResult {
  ok: boolean;
  entries: LeaderboardEntry[];
  error?: string;
}

/**
 * Log a resonance protocol discovery. Idempotent — duplicate inserts
 * are silently ignored via the unique constraint.
 */
export async function logDiscovery(discoveryId: string): Promise<DiscoveryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase.from("player_discoveries").upsert(
    {
      user_id: user.id,
      discovery_id: discoveryId,
    } as never,
    { onConflict: "user_id,discovery_id", ignoreDuplicates: true },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Get all discoveries for the current player.
 */
export async function getPlayerDiscoveries(): Promise<DiscoveryListResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, discoveries: [], error: "not_authenticated" };
  }

  const { data, error } = await supabase
    .from("player_discoveries")
    .select("id, discovery_id, discovered_at, metadata")
    .eq("user_id", user.id)
    .order("discovered_at", { ascending: true });

  if (error) {
    return { ok: false, discoveries: [], error: error.message };
  }

  const rows = (data ?? []) as Array<{
    id: string;
    discovery_id: string;
    discovered_at: string;
    metadata: Record<string, unknown>;
  }>;

  const discoveries: PlayerDiscovery[] = rows.map((row) => ({
    id: row.id,
    discoveryId: row.discovery_id,
    discoveredAt: row.discovered_at,
    metadata: row.metadata,
  }));

  return { ok: true, discoveries };
}

/**
 * Get the first 10 players to discover a specific protocol.
 */
export async function getFirstDiscoverers(discoveryId: string): Promise<LeaderboardResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("player_discoveries")
    .select("user_id, discovered_at, profiles!inner(username)")
    .eq("discovery_id", discoveryId)
    .order("discovered_at", { ascending: true })
    .limit(10);

  if (error) {
    return { ok: false, entries: [], error: error.message };
  }

  const rows = (data ?? []) as Array<{
    user_id: string;
    discovered_at: string;
    profiles: { username: string };
  }>;

  const entries: LeaderboardEntry[] = rows.map((row) => ({
    userId: row.user_id,
    username: row.profiles.username,
    discoveredAt: row.discovered_at,
  }));

  return { ok: true, entries };
}
