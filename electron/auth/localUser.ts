const LOCAL_EMAIL = "operator@unstablelabs.local";
const LOCAL_PASSWORD = "unstable-local-operator-2026";

interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Create the local operator user via GoTrue admin API.
 * This triggers the on_auth_user_created trigger which bootstraps
 * the profile, balance, research progress, and system preferences.
 */
export async function createLocalUser(gotruePort: number, serviceRoleKey: string): Promise<void> {
  const url = `http://127.0.0.1:${gotruePort}/admin/users`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({
      email: LOCAL_EMAIL,
      password: LOCAL_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: "operator",
        display_name: "Operator",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // User may already exist from a previous partial init
    if (body.includes("already") || body.includes("duplicate")) {
      console.log("[auth] Local user already exists");
      return;
    }
    throw new Error(`Failed to create local user: ${res.status} ${body}`);
  }

  console.log("[auth] Local operator user created");
}

/**
 * Sign in as the local operator user and return the session tokens.
 */
export async function signInLocalUser(
  gotruePort: number,
  anonKey: string,
): Promise<AuthSession | null> {
  const url = `http://127.0.0.1:${gotruePort}/token?grant_type=password`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({
      email: LOCAL_EMAIL,
      password: LOCAL_PASSWORD,
    }),
  });

  if (!res.ok) {
    console.error("[auth] Sign-in failed:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as AuthSession;
  return data;
}
