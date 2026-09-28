/**
 * On-chain NFT mint for crystals (devnet).
 *
 * Server-only: signs with the mint-authority keypair from
 * SOLANA_MINT_KEYPAIR and talks to SOLANA_RPC_URL (devnet fallback).
 * Mints a Metaplex-standard NFT (metadata + master edition, supply 1)
 * directly into the owner's linked wallet; the token URI points at the
 * public crystal-metadata route, which only serves crystals whose
 * mint_address is set — so the URI resolves as soon as the caller
 * writes the address back.
 */
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey,
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { createNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";

import { parseMintKeypair } from "@/lib/solana/mintKeypair";

export const DEVNET_RPC_FALLBACK = "https://api.devnet.solana.com";

export interface ChainMintParams {
  /** NFT display name (Metaplex caps at 32 chars; crystal names are ≤24). */
  name: string;
  /** Base58 address of the linked wallet that receives the NFT. */
  ownerAddress: string;
  /** Publicly resolvable token URI (crystal-metadata route). */
  metadataUri: string;
}

export interface ChainMintResult {
  mintAddress: string;
  signature: string;
}

export async function mintCrystalNftOnChain(params: ChainMintParams): Promise<ChainMintResult> {
  const secretKey = parseMintKeypair(process.env.SOLANA_MINT_KEYPAIR);
  if (!secretKey) {
    throw new Error("SOLANA_MINT_KEYPAIR is not configured");
  }

  const rpcUrl = process.env.SOLANA_RPC_URL ?? DEVNET_RPC_FALLBACK;
  const umi = createUmi(rpcUrl).use(mplTokenMetadata());
  umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(secretKey)));

  const mint = generateSigner(umi);
  const result = await createNft(umi, {
    mint,
    name: params.name.slice(0, 32),
    symbol: "UNCRY",
    uri: params.metadataUri,
    sellerFeeBasisPoints: percentAmount(0),
    tokenOwner: publicKey(params.ownerAddress),
  }).sendAndConfirm(umi);

  return {
    mintAddress: mint.publicKey.toString(),
    signature: base58.deserialize(result.signature)[0],
  };
}
