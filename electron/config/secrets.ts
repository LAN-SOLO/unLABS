import { randomBytes } from "crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

/**
 * Per-install secrets (JWT secret, database password, operator secret).
 *
 * Each secret is 32 random bytes, hex-encoded (URL- and SQL-literal-safe),
 * stored in its own file inside userData with owner-only permissions. On
 * Windows the mode is ignored and the per-user profile ACL applies.
 */
export function loadOrCreateSecret(file: string): string {
  if (existsSync(file)) {
    const value = readFileSync(file, "utf-8").trim();
    if (/^[0-9a-f]{64}$/.test(value)) {
      restrictFile(file);
      return value;
    }
  }
  const value = randomBytes(32).toString("hex");
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, value, { encoding: "utf-8", mode: 0o600 });
  restrictFile(file);
  return value;
}

/** Tighten permissions of an existing file (created by an older build with 0644). */
export function restrictFile(file: string): void {
  if (process.platform === "win32") return;
  try {
    chmodSync(file, 0o600);
  } catch {
    // best effort — the file may be gone or on a filesystem without modes
  }
}
