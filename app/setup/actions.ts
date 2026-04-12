"use server";

/**
 * Setup actions — Desktop-only onboarding flow.
 *
 * These actions create a local operator user (via GoTrue), sign in as
 * an existing user, or import a save file.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * List existing local operator profiles.
 */
export async function listOperators(): Promise<{
  operators: Array<{
    id: string;
    username: string;
    displayName: string;
    email: string;
    episode: string;
    lastTickAt: string | null;
  }>;
  error?: string;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, current_episode, last_tick_at");

  if (error) {
    return { operators: [], error: error.message };
  }

  type Operator = {
    id: string;
    username: string;
    displayName: string;
    email: string;
    episode: string;
    lastTickAt: string | null;
  };

  const profileRows = (data ?? []) as Array<Record<string, unknown>>;
  const operators: Operator[] = profileRows.map((p) => ({
    id: p.id as string,
    username: (p.username as string) ?? "operator",
    displayName: (p.display_name as string) ?? (p.username as string) ?? "Operator",
    email: `${((p.username as string) ?? "operator").toLowerCase()}@unstablelabs.local`,
    episode: (p.current_episode as string) ?? "EP0",
    lastTickAt: (p.last_tick_at as string) ?? null,
  }));

  // Also surface orphaned auth.users rows that have no matching profile
  // (can happen when app data is wiped but pgdata persists, or after a
  // partial delete). Without this, a fresh install can't recognize or
  // remove the old user — signUp just fails with "User already registered".
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (adminUrl && serviceKey) {
    try {
      const res = await fetch(`${adminUrl}/auth/v1/admin/users?per_page=1000`, {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          users?: Array<{
            id: string;
            email?: string;
            user_metadata?: { username?: string; display_name?: string };
          }>;
        };
        const profileIds = new Set(operators.map((o) => o.id));
        for (const u of json.users ?? []) {
          if (profileIds.has(u.id)) continue;
          const rawUsername =
            u.user_metadata?.username ?? (u.email ? u.email.split("@")[0] : "operator");
          const displayName = u.user_metadata?.display_name ?? rawUsername;
          operators.push({
            id: u.id,
            username: rawUsername,
            displayName: `${displayName} (orphaned)`,
            email: u.email ?? `${rawUsername}@unstablelabs.local`,
            episode: "EP0",
            lastTickAt: null,
          });
        }
      }
    } catch {
      // Orphan detection is best-effort — existing profile list still works
    }
  }

  return { operators };
}

/**
 * Sign in as an existing operator. Tries to authenticate with the
 * deterministic local email/password pattern.
 */
export async function signInOperator(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  if (!email) return { error: "No email provided" };

  // In desktop mode, we use a well-known password for all local users.
  // First try signing in with the standard local password.
  const standardPassword = "unstable-local-operator";

  // Try sign in directly
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: standardPassword,
  });

  if (!signInError) {
    revalidatePath("/", "layout");
    redirect("/terminal");
  }

  // If standard password didn't work, the user was created with a different
  // password. Use the service role to update it via GoTrue admin API.
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminUrl || !serviceKey) return { error: "Server configuration error" };

  // Find the user's auth ID from the profiles table
  const { data: profiles } = await supabase.from("profiles").select("id, username");
  const allProfiles = (profiles ?? []) as Array<{ id: string; username: string }>;
  const profile = allProfiles.find(
    (p) => `${(p.username ?? "").toLowerCase()}@unstablelabs.local` === email,
  );
  if (!profile) return { error: "Operator not found" };

  // Update password via GoTrue admin API
  const updateRes = await fetch(`${adminUrl}/auth/v1/admin/users/${profile.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({ password: standardPassword }),
  });

  if (!updateRes.ok) {
    // If admin API fails too, try a different approach: just sign up again
    // with the same email (GoTrue may return the existing user's session)
    const { data: signUpData } = await supabase.auth.signUp({ email, password: standardPassword });
    if (signUpData?.session) {
      revalidatePath("/", "layout");
      redirect("/terminal");
    }
    return { error: "Failed to prepare login session. Try creating a new operator instead." };
  }

  // Now sign in with the updated password
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: standardPassword,
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/terminal");
}

/**
 * Delete an operator profile and all associated data.
 * Requires typing the username to confirm.
 */
export async function deleteOperator(formData: FormData) {
  const operatorId = formData.get("operatorId") as string;
  const confirmUsername = formData.get("confirmUsername") as string;
  const expectedUsername = formData.get("expectedUsername") as string;

  if (!operatorId || !confirmUsername || !expectedUsername) {
    return { error: "Missing required fields" };
  }

  // Safety: confirm username must match exactly
  if (confirmUsername.trim() !== expectedUsername.trim()) {
    return { error: `Type "${expectedUsername}" exactly to confirm deletion.` };
  }

  const supabase = await createClient();

  // Delete profile (cascades to player_saves, balances, etc. via ON DELETE CASCADE)
  const { error: profileError } = await supabase.from("profiles").delete().eq("id", operatorId);

  if (profileError) {
    return { error: `Failed to delete profile: ${profileError.message}` };
  }

  // Delete auth user via GoTrue admin API using raw fetch with service role
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (adminUrl && serviceKey) {
    await fetch(`${adminUrl}/auth/v1/admin/users/${operatorId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    }).catch(() => {
      // Auth user deletion is best-effort — profile is already gone
    });
  }

  return { success: true };
}

/**
 * Create a new local operator user.
 */
export async function createOperator(formData: FormData) {
  const supabase = await createClient();

  const username = (formData.get("username") as string)?.trim() || "operator";
  const displayName = (formData.get("displayName") as string)?.trim() || username;

  // In desktop mode, use a deterministic email and standard password
  const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, "")}@unstablelabs.local`;
  const password = "unstable-local-operator";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: displayName,
      },
    },
  });

  if (error) {
    // Orphan auth.users row left over from a previous install. Tell the
    // user to pick it from the list (listOperators now surfaces orphans)
    // and delete it from there, instead of silently swallowing the error.
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return {
        error:
          `An operator with this name already exists from a previous install. ` +
          `Go back and remove it from the "Existing Operators" list, then try again.`,
      };
    }
    return { error: error.message };
  }

  if (!data?.session) {
    return { error: "Failed to create session. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/terminal");
}

/**
 * Import a save file. Creates a local user first (if not exists), then
 * writes the imported save data into player_saves.
 */
export async function importSaveFile(formData: FormData) {
  const supabase = await createClient();

  const username = (formData.get("username") as string)?.trim() || "operator";
  const saveDataRaw = formData.get("saveData") as string;

  if (!saveDataRaw) {
    return { error: "No save data provided" };
  }

  let saveData: Record<string, unknown>;
  try {
    saveData = JSON.parse(saveDataRaw);
  } catch {
    return { error: "Invalid save file format. Expected JSON." };
  }

  // Check if user is already authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Create a new user first
    const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, "")}@unstablelabs.local`;
    const password = "unstable-local-operator";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username,
        },
      },
    });

    if (error) return { error: `Failed to create user: ${error.message}` };
    if (!data?.session) return { error: "Failed to create session" };
  }

  // Now authenticated — get the user ID
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Not authenticated after user creation" };

  // Extract save components
  const resources = (saveData as { resources?: unknown }).resources;
  const questState = (saveData as { questState?: unknown }).questState;
  const currentEpisode = (saveData as { currentEpisode?: string }).currentEpisode;

  // Upsert the save data into player_saves
  const { error: saveError } = await supabase.from("player_saves").upsert(
    {
      user_id: currentUser.id,
      data: saveData,
      version: 1,
    } as never,
    { onConflict: "user_id" },
  );

  if (saveError) {
    return { error: `Failed to import save: ${saveError.message}` };
  }

  // Update profile with quest state if present
  if (questState || currentEpisode) {
    const profileUpdate: Record<string, unknown> = {};
    if (questState) profileUpdate.quest_state = questState;
    if (currentEpisode) profileUpdate.current_episode = currentEpisode;

    await supabase
      .from("profiles")
      .update(profileUpdate as never)
      .eq("id", currentUser.id);
  }

  revalidatePath("/", "layout");
  redirect("/terminal");
}
