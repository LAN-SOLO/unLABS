"use server";

/**
 * Dev-area server actions. Every mutation re-verifies `is_dev` on the server
 * so that a non-dev account can't just POST to these endpoints directly.
 */

import { createClient } from "@/lib/supabase/server";
import { earnUnsc } from "@/lib/game/economy";

const VALID_EPISODES = new Set(["EP0", "EP1", "EP2", "EP3", "EP4", "EP5", "EP6"]);

export async function setDevEpisode(next: string): Promise<{ ok: boolean; error?: string }> {
  if (!VALID_EPISODES.has(next)) {
    return { ok: false, error: "invalid_episode" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const profileResult = await supabase
    .from("profiles")
    .select("is_dev")
    .eq("id", user.id)
    .maybeSingle();

  // Cast — existing codebase convention (see terminal/page.tsx).
  const profile = profileResult.data as { is_dev: boolean } | null;

  if (!profile?.is_dev) {
    return { ok: false, error: "not_authorized" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ current_episode: next } as never)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Dev-only: grant _unSC to the current operator. Re-checks is_dev. */
export async function grantDevUnsc(
  amount: number,
): Promise<{ ok: boolean; newAvailable?: number; error?: string }> {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return { ok: false, error: "invalid_amount" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const profileResult = await supabase
    .from("profiles")
    .select("is_dev")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileResult.data as { is_dev: boolean } | null;
  if (!profile?.is_dev) return { ok: false, error: "not_authorized" };

  const result = await earnUnsc(supabase, {
    userId: user.id,
    amount,
    type: "mint",
    description: `dev:grant ${amount}`,
    metadata: { dev: true },
  });
  if (!result.ok) return { ok: false, error: result.error ?? "grant_failed" };
  return { ok: true, newAvailable: result.newAvailable };
}
