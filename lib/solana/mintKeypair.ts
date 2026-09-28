/**
 * Parses the NFT mint-authority keypair from its env representation:
 * the raw content of a `solana-keygen` file — a JSON array of exactly
 * 64 byte values (secret + public half). Returns null on any deviation
 * so callers can degrade gracefully instead of throwing at import time.
 */
export function parseMintKeypair(raw: string | undefined): Uint8Array | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== 64) return null;
  if (
    !parsed.every(
      (n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255,
    )
  ) {
    return null;
  }
  return Uint8Array.from(parsed);
}

/** True when the server holds a usable mint keypair. */
export function isMintKeypairConfigured(): boolean {
  return parseMintKeypair(process.env.SOLANA_MINT_KEYPAIR) !== null;
}
