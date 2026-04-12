import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DevClient } from "./dev-client";

/**
 * Developer area — gated on `profiles.is_dev`.
 *
 * Non-dev users are bounced to `/terminal`. Dev users land on a client panel
 * with live state inspection, resource grants, quest jumper, and raw save
 * dump/restore. Strictly an internal tool, not a player-facing feature.
 */
export default async function DevPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guarantees `user` exists inside (game), but we
  // re-check defensively since we're about to fetch sensitive profile data.
  if (!user) redirect("/login");

  const result = await supabase
    .from("profiles")
    .select("id, username, is_dev, current_episode")
    .eq("id", user.id)
    .maybeSingle();

  // Cast — existing codebase convention (see terminal/page.tsx).
  const profile = result.data as {
    id: string;
    username: string | null;
    is_dev: boolean;
    current_episode: string;
  } | null;

  if (!profile?.is_dev) {
    redirect("/terminal");
  }

  return (
    <DevClient
      username={profile.username ?? "unknown"}
      currentEpisode={profile.current_episode ?? "EP0"}
    />
  );
}
