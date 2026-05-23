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

  if (!user) redirect("/login");

  const [profileResult, balanceResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, is_dev, current_episode")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("balances").select("available").eq("user_id", user.id).maybeSingle(),
  ]);

  const profile = profileResult.data as {
    id: string;
    username: string | null;
    is_dev: boolean;
    current_episode: string;
  } | null;

  if (!profile?.is_dev) {
    redirect("/terminal");
  }

  const bal = (balanceResult.data as { available: number } | null)?.available ?? 0;

  return (
    <DevClient
      userId={user.id}
      username={profile.username ?? "unknown"}
      balance={bal}
      currentEpisode={profile.current_episode ?? "EP0"}
    />
  );
}
