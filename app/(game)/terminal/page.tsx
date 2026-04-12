import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";
import { TerminalPowerWrapper } from "./terminal-power-wrapper";
import { TerminalFrame } from "./terminal-frame";
import { QuestOverlay } from "@/components/quest/QuestOverlay";
import { AnomalyOverlay } from "@/components/quest/AnomalyOverlay";

interface ProfileData {
  username: string | null;
  display_name: string | null;
}

interface BalanceData {
  available: number;
  staked: number;
}

export default async function TerminalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile and balance in parallel
  const [profileResult, balanceResult] = await Promise.all([
    supabase.from("profiles").select("username, display_name").eq("id", user.id).single(),
    supabase.from("balances").select("available, staked").eq("user_id", user.id).single(),
  ]);

  const profile = (profileResult.data as ProfileData | null) ?? null;
  const balance = (balanceResult.data as BalanceData | null) ?? null;

  const username = profile?.username || profile?.display_name || user.email?.split("@")[0] || null;
  const availableBalance = balance?.available || 0;

  return (
    <div className="min-h-screen bg-black font-mono text-green-500">
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)",
        }}
      />

      {/* CRT glow effect */}
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          boxShadow: "inset 0 0 100px rgba(34, 197, 94, 0.1)",
        }}
      />

      <TerminalFrame username={username} availableBalance={availableBalance} logoutAction={logout}>
        <TerminalPowerWrapper userId={user.id} username={username} balance={availableBalance} />
      </TerminalFrame>

      {/* Phase 2: quest overlay. Renders null when there is no active step. */}
      <QuestOverlay />

      {/* Phase 3: ambient anomaly effect. Active once EP1 ep1.reveal fires. */}
      <AnomalyOverlay />

      {/* Phase 4: persistent link to the production hub. */}
      <a
        href="/lab"
        className="fixed right-4 bottom-4 z-40 border border-green-500/60 bg-black/80 px-3 py-1 font-mono text-xs text-green-300 hover:bg-green-500/20"
      >
        &gt; /lab · production
      </a>
    </div>
  );
}
