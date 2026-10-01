/**
 * The unETH archive — every released capture the Matrix can give up (pure).
 * =========================================================================
 *
 * `content/uneth-release.json` lists the 880 captures of the 2018-03-07
 * release (P01 mono 160 · P02 pure 630 · P03 RGB 90) with their recorded
 * traits, exported from the research archive (`scripts/uneth/export-release.mjs`).
 * Only what was released exists here — no IDs or traits are invented.
 *
 * A slice is one frame of a capture: token ID + position 1…30
 * (`SLC#0089-17`). How special a slice is follows from how rare its state
 * was: the pure line is the common one, RGB needed a lot of energy, the
 * mono line a very special state of every indicator at once.
 */
import data from "@/lib/world/content/uneth-release.json";
import type { SliceTraits } from "@/lib/world/uneth-crystal";
import { tr } from "@/lib/i18n";

export type ReleasePhase = "P01" | "P02" | "P03";
/** Production line of a capture: P01 mono, P02 pure, P03 RGB. */
export type SliceLine = "mono" | "pure" | "rgb";

export interface ArchiveToken {
  id: number;
  phase: ReleasePhase;
  line: SliceLine;
  traits: SliceTraits;
}

/** Positions per crystal (frames of one capture: 180° in 6° steps). */
export const SLICE_POSITIONS = 30;

type Row = [number, string, string, string, number, string, string, string, number];

function lineOf(phase: string): SliceLine {
  return phase === "P01" ? "mono" : phase === "P03" ? "rgb" : "pure";
}

export const ARCHIVE_TOKENS: readonly ArchiveToken[] = (data.tokens as Row[]).map(
  ([id, phase, style, color, tier, rotation, stasis, io, era]) => ({
    id,
    phase: phase as ReleasePhase,
    line: lineOf(phase),
    traits: {
      id,
      style: style === "mono" ? "mono" : "px",
      color: color as SliceTraits["color"],
      tier: tier as SliceTraits["tier"],
      rotation: rotation === "CCW" ? "CCW" : "CW",
      stasis: stasis === "S" ? "S" : "NOS",
      io: io === "I" ? "I" : io === "IO" ? "IO" : "O",
      era: era as SliceTraits["era"],
    },
  }),
);

const BY_ID = new Map(ARCHIVE_TOKENS.map((t) => [t.id, t]));

/** A released token, or undefined for IDs the release lists do not contain. */
export function tokenById(id: number): ArchiveToken | undefined {
  return BY_ID.get(id);
}

/** Tokens of one production line. */
export const TOKENS_BY_LINE: Readonly<Record<SliceLine, readonly ArchiveToken[]>> = {
  mono: ARCHIVE_TOKENS.filter((t) => t.line === "mono"),
  pure: ARCHIVE_TOKENS.filter((t) => t.line === "pure"),
  rgb: ARCHIVE_TOKENS.filter((t) => t.line === "rgb"),
};

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** Player-facing rarity names. */
export const RARITY_NAME: Readonly<Record<Rarity, string>> = {
  common: tr("rarity::common"),
  uncommon: tr("rarity::uncommon"),
  rare: tr("rarity::rare"),
  epic: tr("rarity::epic"),
  legendary: tr("rarity::legendary"),
};
export const RARITIES: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/**
 * How special a slice is: mono (P01) legendary, RGB (P03) epic, pure (P02)
 * by its volatility tier — T5 rare, T3–T4 uncommon, T1–T2 common.
 */
export function rarityOf(t: ArchiveToken): Rarity {
  if (t.line === "mono") return "legendary";
  if (t.line === "rgb") return "epic";
  if (t.traits.tier >= 5) return "rare";
  if (t.traits.tier >= 3) return "uncommon";
  return "common";
}

/** Database-style slice id, e.g. `SLC#0089-17` (position 1…30). */
export function sliceCode(token: number, pos: number): string {
  return `SLC#${String(token).padStart(4, "0")}-${String(pos).padStart(2, "0")}`;
}
