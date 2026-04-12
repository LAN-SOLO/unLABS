import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LabClient } from "./lab-client";

/**
 * /lab — the production hub.
 *
 * Protected by the root middleware (unauthenticated → /login). This page
 * is a thin server component that hands control to LabClient — all of the
 * live state (jobs, balance, resources, quest flags) is read from the
 * providers already mounted by app/(game)/layout.tsx.
 */
export default async function LabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();

  const profile = result.data as { username: string | null } | null;

  return <LabClient username={profile?.username ?? "operator"} />;
}
