import { randomBytes } from "crypto";
import * as jwt from "jsonwebtoken";

/**
 * Generate a random 32-byte hex JWT secret.
 */
export function generateJwtSecret(): string {
  return randomBytes(32).toString("hex");
}

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
