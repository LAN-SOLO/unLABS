"use server";

/**
 * Setup actions — Desktop-only onboarding flow.
 *
 * These actions create a local operator user (via GoTrue), sign in as
 * an existing user, or import a save file. They are refused outside the
 * desktop app's bundled server (see isLocalOperatorMode): on a web
 * deployment they would let anyone list, log into or delete accounts.
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  LOCAL_OPERATOR_DOMAIN,
  isLocalOperatorMode,
  localOperatorEmail,
  localOperatorPassword,
} from "@/lib/auth/localOperator";
import { isLoopbackHost } from "@/lib/auth/loopback";

const DESKTOP_ONLY = "Local operators are only available in the desktop app.";
const MAX_SAVE_BYTES = 8 * 1024 * 1024;

/** Desktop server, reached directly on the loopback interface. */
async function allowed(): Promise<boolean> {
  if (!isLocalOperatorMode()) return false;
  return isLoopbackHost((await headers()).get("host"));
}

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
  if (!(await allowed())) return { operators: [], error: DESKTOP_ONLY };
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
  if (!(await allowed())) return { error: DESKTOP_ONLY };
  const supabase = await createClient();

  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email) return { error: "No email provided" };
  if (!email.endsWith(`@${LOCAL_OPERATOR_DOMAIN}`)) return { error: "Operator not found" };

  // Local operators have no password prompt: the password is derived from
  // this install's secret (older builds used one fixed password for all).
  const standardPassword = localOperatorPassword(email);
  if (!standardPassword) return { error: "Server configuration error" };

  // Try sign in directly
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: standardPassword,
  });

  if (!signInError) {
    revalidatePath("/", "layout");
    redirect("/world");
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
      redirect("/world");
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
  redirect("/world");
}

/**
 * Delete an operator profile and all associated data.
 * Requires typing the username to confirm.
 */
export async function deleteOperator(formData: FormData) {
  if (!(await allowed())) return { error: DESKTOP_ONLY };
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
  if (!(await allowed())) return { error: DESKTOP_ONLY };
  const supabase = await createClient();

  const username = (formData.get("username") as string)?.trim() || "operator";
  const displayName = (formData.get("displayName") as string)?.trim() || username;

  // In desktop mode, use a deterministic email and a per-install password
  const email = localOperatorEmail(username);
  const password = localOperatorPassword(email);
  if (!password) return { error: "Server configuration error" };

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
  redirect("/world");
}

/**
 * Import a save file. Creates a local user first (if not exists), then
 * writes the imported save data into player_saves.
 */
export async function importSaveFile(formData: FormData) {
  if (!(await allowed())) return { error: DESKTOP_ONLY };
  const supabase = await createClient();

  const username = (formData.get("username") as string)?.trim() || "operator";
  const saveDataRaw = formData.get("saveData");

  if (typeof saveDataRaw !== "string" || !saveDataRaw) {
    return { error: "No save data provided" };
  }
  if (saveDataRaw.length > MAX_SAVE_BYTES) {
    return { error: "Save file is too large." };
  }

  let saveData: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(saveDataRaw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "Invalid save file format. Expected a JSON object." };
    }
    saveData = parsed as Record<string, unknown>;
  } catch {
    return { error: "Invalid save file format. Expected JSON." };
  }

  // Check if user is already authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Create a new user first
    const email = localOperatorEmail(username);
    const password = localOperatorPassword(email);
    if (!password) return { error: "Server configuration error" };

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
  redirect("/world");
}
