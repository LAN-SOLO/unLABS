/**
 * Authenticated E2E fixture (Playwright setup project)
 * ====================================================
 *
 * Provides a deterministic, freshly-provisioned test user for the authed
 * E2E suite (`e2e/authed.spec.ts`) and persists a logged-in browser
 * storageState to `e2e/.auth/user.json` (gitignored).
 *
 * User strategy — fresh user per run:
 *   A timestamped email (`e2e+auth-<ts>@unlabs.test`) is created via the
 *   Supabase Admin API with `email_confirm: true`. A fresh user guarantees
 *   the whole onboarding surface is deterministic in every run:
 *     - tutorial_state.difficulty is null   → DifficultyPicker shows
 *     - quest spine sits at EP0 "ep0.wake"  → `dmesg` trigger untouched
 *     - balances.available is exactly 120   → cold-start bonus assertable
 *   Users from previous runs (matching the e2e+auth-* pattern) are deleted
 *   best-effort so the local DB doesn't accumulate garbage. The DB trigger
 *   `handle_new_user` (migration 20260410000001_phase1_foundation.sql)
 *   creates profile / balance / research / save rows automatically.
 *
 * Service-role key acquisition — env vars with documented fallback:
 *   We deliberately do NOT shell out to `npx supabase status -o json`:
 *   during development of this fixture the CLI hard-hung (no timeout, no
 *   output) whenever the Docker engine was wedged, which would stall the
 *   whole test run with zero diagnostics. Resolution order instead:
 *     1. process.env  E2E_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY
 *     2. .env.local at the repo root (same source the dev server uses, so
 *        fixture and app can never disagree about which stack they talk to)
 *     3. the well-known local `supabase-demo` service-role JWT that every
 *        local Supabase CLI stack ships with (signed with the fixed local
 *        JWT secret — public knowledge, not a secret)
 *   A guard refuses to run against anything that is not localhost, so the
 *   admin cleanup can never touch a remote/production project.
 *
 * Login happens through the real login UI (/login form → server action →
 * redirect to /terminal), NOT via the API, so the cookie flow the app
 * actually uses (@supabase/ssr) is what lands in the storage state.
 */

import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

/** Where the logged-in storage state lands. Mirrored in playwright.config.ts. */
export const STORAGE_STATE = path.join(__dirname, "..", ".auth", "user.json");

const REPO_ROOT = path.join(__dirname, "..", "..");

/** Well-known local-dev demo keys (supabase CLI default stack; not secrets). */
const LOCAL_FALLBACK_URL = "http://127.0.0.1:54321";
const LOCAL_FALLBACK_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
  "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const RUN_STAMP = Date.now();

export const TEST_USER = {
  email: `e2e+auth-${RUN_STAMP}@unlabs.test`,
  password: "e2e-unlabs-Passw0rd!",
  username: `e2e_auth_${RUN_STAMP}`,
} as const;

/** Emails of previous runs, safe to delete on the local stack. */
const STALE_USER_PATTERN = /^e2e\+auth-\d+@unlabs\.test$/;

/** Minimal .env.local parser — enough for KEY=VALUE lines, no expansion. */
function readEnvLocal(): Record<string, string> {
  const file = path.join(REPO_ROOT, ".env.local");
  const result: Record<string, string> = {};
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return result;
  }
  for (const line of raw.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    result[match[1]] = value;
  }
  return result;
}

function resolveSupabaseAdmin(): { url: string; serviceRoleKey: string } {
  const envLocal = readEnvLocal();
  const url =
    process.env.E2E_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    envLocal.NEXT_PUBLIC_SUPABASE_URL ??
    LOCAL_FALLBACK_URL;
  const serviceRoleKey =
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    envLocal.SUPABASE_SERVICE_ROLE_KEY ??
    LOCAL_FALLBACK_SERVICE_ROLE_KEY;

  // Hard guard: admin operations (incl. user deletion) only against localhost.
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `Refusing to run the auth fixture against non-local Supabase URL "${url}". ` +
        "The setup deletes e2e+auth-* users and must never point at a remote project.",
    );
  }
  return { url, serviceRoleKey };
}

setup("provision test user and capture authenticated storage state", async ({ page }) => {
  const { url, serviceRoleKey } = resolveSupabaseAdmin();
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Best-effort cleanup of users from previous runs.
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const user of data?.users ?? []) {
      if (user.email && STALE_USER_PATTERN.test(user.email) && user.email !== TEST_USER.email) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
  } catch {
    // Cleanup is cosmetic — never fail the run over it.
  }

  // 2. Create this run's user, confirmed, with the same metadata the real
  //    register flow sends (handle_new_user hydrates profile + 120 _unSC).
  const created = await admin.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
    user_metadata: {
      username: TEST_USER.username,
      display_name: TEST_USER.username,
    },
  });
  if (created.error && !/already.*registered/i.test(created.error.message)) {
    throw new Error(`Admin createUser failed: ${created.error.message}`);
  }

  // 3. Log in through the real UI. The login page plays a short boot
  //    animation overlay first; click() auto-waits until it is gone.
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(TEST_USER.email);
  await page.locator('input[type="password"]').fill(TEST_USER.password);
  await page.locator('button[type="submit"]').click();

  // Server action → redirect. Generous timeout: first hit compiles /terminal
  // in dev mode.
  await page.waitForURL("**/terminal", { timeout: 120_000 });
  await expect(page.locator("body")).not.toBeEmpty();

  // 4. Persist cookies (+ localStorage) for the authed project.
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
