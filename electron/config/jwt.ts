import * as jwt from "jsonwebtoken";

// The secret itself is created per install by config/secrets.ts.

/**
 * Generate the anon key — a JWT that PostgREST uses for unauthenticated requests.
 */
export function generateAnonKey(secret: string): string {
  return jwt.sign(
    {
      role: "anon",
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60, // 10 years
    },
    secret,
  );
}

/**
 * Generate the service_role key — a JWT that bypasses RLS.
 */
export function generateServiceRoleKey(secret: string): string {
  return jwt.sign(
    {
      role: "service_role",
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60, // 10 years
    },
    secret,
  );
}
