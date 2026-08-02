import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MonitorClient } from "./monitor-client";

/**
 * /monitor — resource ledger, device roster, and tech-tree overview.
 *
 * Protected by the root middleware (unauthenticated → /login). Thin server
 * component: live state (resources, quest flags, tech tree) is read from
 * the providers already mounted by app/(game)/layout.tsx, same as /lab.
 */
export default async function MonitorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult, balanceResult] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
    supabase
      .from("balances")
      .select("available, total_earned, total_spent")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const profile = profileResult.data as { username: string | null } | null;
  const bal = balanceResult.data as {
    available: number;
    total_earned: number;
    total_spent: number;
  } | null;

  return (
    <MonitorClient
      username={profile?.username ?? "operator"}
      balance={bal?.available ?? 0}
      unscTotalEarned={bal?.total_earned ?? 0}
      unscTotalSpent={bal?.total_spent ?? 0}
    />
  );
}
