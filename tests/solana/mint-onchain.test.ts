// @vitest-environment node
/**
 * On-chain smoke test for the crystal NFT mint (opt-in).
 *
 * Skipped unless BOTH env vars are set — CI and normal `pnpm test`
 * runs never touch a network:
 *   SOLANA_SMOKE_RPC     e.g. http://127.0.0.1:8899 (solana-test-validator
 *                        started with --clone-upgradeable-program
 *                        metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s --url devnet)
 *   SOLANA_MINT_KEYPAIR  funded keypair for that endpoint (JSON array)
 */
import { describe, expect, it } from "vitest";

const rpc = process.env.SOLANA_SMOKE_RPC;
const keypair = process.env.SOLANA_MINT_KEYPAIR;

describe.skipIf(!rpc || !keypair)("mintCrystalNftOnChain (live RPC)", () => {
  it("mints an NFT into the owner wallet with metadata", { timeout: 90_000 }, async () => {
    process.env.SOLANA_RPC_URL = rpc;
    const { mintCrystalNftOnChain } = await import("@/lib/solana/mintCrystalNft");
    const { parseMintKeypair } = await import("@/lib/solana/mintKeypair");
    const { createUmi } = await import("@metaplex-foundation/umi-bundle-defaults");
    const { keypairIdentity, publicKey } = await import("@metaplex-foundation/umi");
    const { fetchDigitalAssetWithAssociatedToken, mplTokenMetadata } =
      await import("@metaplex-foundation/mpl-token-metadata");

    // The authority doubles as NFT recipient — the smoke test needs no
    // second funded wallet.
    const umi = createUmi(rpc as string).use(mplTokenMetadata());
    const secret = parseMintKeypair(keypair);
    expect(secret).not.toBeNull();
    const kp = umi.eddsa.createKeypairFromSecretKey(secret as Uint8Array);
    umi.use(keypairIdentity(kp));
    const owner = kp.publicKey.toString();

    const uri = "https://example.com/api/crystal-metadata/smoke-test";
    const result = await mintCrystalNftOnChain({
      name: "SMOKE-TEST",
      ownerAddress: owner,
      metadataUri: uri,
    });

    expect(result.mintAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(result.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/);

    // Read the asset back from the chain: metadata + the owner's token.
    // Devnet RPC nodes can lag a confirmed transaction by a few seconds,
    // so the fetch retries instead of racing the cluster.
    let asset: Awaited<ReturnType<typeof fetchDigitalAssetWithAssociatedToken>> | null = null;
    for (let attempt = 0; attempt < 10 && !asset; attempt++) {
      try {
        asset = await fetchDigitalAssetWithAssociatedToken(
          umi,
          publicKey(result.mintAddress),
          publicKey(owner),
        );
      } catch (err) {
        if (attempt === 9) throw err;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    if (!asset) throw new Error("unreachable");
    expect(asset.metadata.name).toBe("SMOKE-TEST");
    expect(asset.metadata.symbol).toBe("UNCRY");
    expect(asset.metadata.uri).toBe(uri);
    expect(asset.token.amount).toBe(BigInt(1));
    expect(asset.mint.supply).toBe(BigInt(1));
  });
});
