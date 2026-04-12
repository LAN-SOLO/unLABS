"use server";

/**
 * Player save server actions
 * ==========================
 *
 * The client tick engine owns gameplay state in memory and mirrors a single
 * JSON blob (matches `PanelSaveData`) to `public.player_saves.data`. These two
 * actions are the only interface for reading/writing that blob. Keeping it as
 * a single blob is deliberate — fragmenting across tables would force a
 * cross-table transaction on every auto-save and explode our migration
 * footprint for Phase 1. We will decompose selectively when specific slices
 * (inventory, balances) need server-authoritative writes.
 */

import { createClient } from "@/lib/supabase/server";

export interface PlayerSavePayload {
  /** Opaque save blob — shape matches `PanelSaveData` on the client. */
  data: Record<string, unknown>;
  /** Epoch ms of the last tick applied locally. Used for offline catch-up. */
  lastTickAt: number;
}

export interface PlayerSaveLoadResult {
  ok: boolean;
  data: Record<string, unknown> | null;
  lastTickAt: number | null;
  error?: string;
}

export async function loadPlayerSave(): Promise<PlayerSaveLoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, data: null, lastTickAt: null, error: "not_authenticated" };
  }

  const saveResult = await supabase
    .from("player_saves")
    .select("data")
    .eq("user_id", user.id)
    .maybeSingle();

  if (saveResult.error) {
    return {
      ok: false,
      data: null,
      lastTickAt: null,
      error: saveResult.error.message,
    };
  }

  const profileResult = await supabase
    .from("profiles")
    .select("last_tick_at")
    .eq("id", user.id)
    .maybeSingle();

  // Existing codebase convention: cast through `unknown` because Database
  // generic inference on `.from()` currently resolves to `never` here.
  // See app/(game)/terminal/page.tsx for the same pattern.
  const saveRow = saveResult.data as { data: Record<string, unknown> } | null;
  const profileRow = profileResult.data as { last_tick_at: string | null } | null;

  const lastTickAtIso = profileRow?.last_tick_at ?? null;
  const lastTickAt = lastTickAtIso ? new Date(lastTickAtIso).getTime() : null;

  return {
    ok: true,
    data: saveRow?.data ?? null,
    lastTickAt,
  };
}

export interface PlayerSaveWriteResult {
  ok: boolean;
  error?: string;
}

export async function savePlayerSave(payload: PlayerSavePayload): Promise<PlayerSaveWriteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "not_authenticated" };
  }

  // Upsert the blob. RLS policies restrict writes to auth.uid() = user_id.
  // Cast through `never` — Database generic inference on `.upsert()` resolves
  // to `never` in this project; see app/(game)/terminal/page.tsx convention.
  const { error: saveError } = await supabase.from("player_saves").upsert(
    {
      user_id: user.id,
      data: payload.data,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" },
  );

  if (saveError) {
    return { ok: false, error: saveError.message };
  }

  // Record last_tick_at so the next session can compute offline progress.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      last_tick_at: new Date(payload.lastTickAt).toISOString(),
    } as never)
    .eq("id", user.id);

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  return { ok: true };
}
