/**
 * Minting preparation — slices and crystals as Solana devnet NFTs (pure).
 * ========================================================================
 *
 * Nothing is minted from here yet. This module fixes what a mint will need
 * so the pieces can be built against it (see docs/SLICES.md, "Minting"):
 *
 * - The device combination and setting that opens the uplink in the lab:
 *   the Crystal Data Cache holds the slice data, the network hub carries it
 *   out, the quantum analyzer signs its provenance — all three built and
 *   switched on, and the chamber's uplink set to devnet. Mainnet stays shut
 *   until the legal review is done (hard gate, `MINT_NETWORKS`).
 * - The metadata of a slice / crystal NFT (Metaplex JSON standard) built
 *   only from recorded data: the archive token's traits, the slice
 *   position, the ledger day the chamber was tuned to and when the slice
 *   materialised. The server re-derives and verifies all of it before it
 *   signs anything (the local save is never trusted).
 */
import { isBuilt, isSwitchedOn } from "@/lib/world/game";
import type { MatrixCrystal, MatrixSlice, WorldState } from "@/lib/world/types";
import { captureLabel, captureName } from "@/lib/world/uneth-crystal";
import { rarityOf, sliceCode, tokenById } from "@/lib/world/matrix/archive";
import { chainStateAt, dayAt, indexOf } from "@/lib/world/matrix/history";
import { matrixAwake } from "@/lib/world/matrix/rules";

/** Devices that must be built and switched on to open the mint uplink. */
export const MINT_DEVICES = ["CDC-001", "NET-001", "QAN-001"] as const;

/** Networks a mint may target. Mainnet only after the legal review (closed). */
export const MINT_NETWORKS = { devnet: true, mainnet: false } as const;
export type MintNetwork = keyof typeof MINT_NETWORKS;

/** NFT symbols (≤ 10 chars, Metaplex). */
export const SLICE_SYMBOL = "UNSLC";
export const CRYSTAL_SYMBOL = "UNITM";

export interface MintCheck {
  id: string;
  ok: boolean;
}

/** What the lab still lacks for a mint uplink (every check `ok` = ready). */
export function mintReadiness(s: WorldState): MintCheck[] {
  return [
    { id: "chamber", ok: matrixAwake(s) },
    ...MINT_DEVICES.map((id) => ({ id, ok: isBuilt(s, id) && isSwitchedOn(s, id) })),
  ];
}

export function mintReady(s: WorldState): boolean {
  return mintReadiness(s).every((c) => c.ok);
}

/** Metaplex NFT attribute. */
export interface NftAttribute {
  trait_type: string;
  value: string | number;
}

/** Off-chain metadata JSON (Metaplex token standard, non-fungible). */
export interface NftMetadata {
  name: string;
  symbol: string;
  description: string;
  /** Filled by the server (rendered capture / GIF upload). */
  image: string;
  animation_url?: string;
  attributes: NftAttribute[];
  properties: { category: "image"; files: { uri: string; type: string }[] };
}

/** Recorded provenance of a slice — what the server must be able to re-derive. */
export interface SliceProvenance {
  token: number;
  pos: number;
  day: string;
  field: number;
  /** Epoch ms when it materialised. */
  at: number;
}

export function sliceProvenance(x: MatrixSlice): SliceProvenance {
  return { token: x.token, pos: x.pos, day: x.day, field: x.field, at: x.at };
}

/** Metadata of one slice (null for a token the archive does not contain). */
export function sliceMetadata(x: MatrixSlice): NftMetadata | null {
  const t = tokenById(x.token);
  if (!t) return null;
  const i = indexOf(x.day);
  const d = i >= 0 ? dayAt(i) : null;
  const st = i >= 0 ? chainStateAt(i) : null;
  const tr = t.traits;
  return {
    name: sliceCode(x.token, x.pos),
    symbol: SLICE_SYMBOL,
    description:
      `Slice ${x.pos}/30 of unETH capture #${String(x.token).padStart(4, "0")} ` +
      `(${t.phase} ${captureLabel(tr)}), dissolved from the Ethereum matrix ` +
      `tuned to ${x.day}. _unSC · _unLABS Matrix Chamber.`,
    image: "",
    attributes: [
      { trait_type: "Token", value: x.token },
      { trait_type: "Position", value: x.pos },
      { trait_type: "Angle", value: (x.pos - 1) * 6 },
      { trait_type: "Phase", value: t.phase },
      { trait_type: "Line", value: captureLabel(tr) },
      { trait_type: "Color", value: tr.color },
      { trait_type: "Volatility", value: `T${tr.tier}` },
      { trait_type: "State", value: tr.io },
      { trait_type: "Stasis", value: tr.stasis },
      { trait_type: "Era", value: `${tr.era}bit` },
      { trait_type: "Rotation", value: tr.rotation },
      { trait_type: "Rarity", value: rarityOf(t) },
      { trait_type: "Capture", value: captureName(tr) },
      { trait_type: "Ledger day", value: x.day },
      ...(d ? [{ trait_type: "Block height", value: d.height }] : []),
      ...(st?.mono ? [{ trait_type: "Monochrome day", value: "yes" }] : []),
      { trait_type: "Field", value: x.field },
    ],
    properties: { category: "image", files: [] },
  };
}

/** Metadata of a composed crystal (its slices by position; empty positions stay empty). */
export function crystalMetadata(
  c: MatrixCrystal,
  sliceOf: (uid: string) => MatrixSlice | undefined,
): NftMetadata {
  const parts = c.slots.map((u) => (u ? sliceOf(u) : undefined));
  const filled = parts.filter((x): x is MatrixSlice => !!x);
  const tokens = [...new Set(filled.map((x) => x.token))];
  return {
    name: c.name,
    symbol: CRYSTAL_SYMBOL,
    description:
      `_unITM crystal of ${filled.length}/30 slices from ${tokens.length} unETH ` +
      `capture${tokens.length === 1 ? "" : "s"}, composed in the _unLABS Matrix Chamber.`,
    image: "",
    attributes: [
      { trait_type: "Slices", value: filled.length },
      { trait_type: "Captures", value: tokens.length },
      ...parts.map((x, i) => ({
        trait_type: `P${String(i + 1).padStart(2, "0")}`,
        value: x ? sliceCode(x.token, x.pos) : "—",
      })),
    ],
    properties: { category: "image", files: [] },
  };
}
