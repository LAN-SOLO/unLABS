/**
 * Hero colours for a wardrobe look (pure — no three).
 * ===================================================
 *
 * The hero Jade is sculpted once; a look only recolours her. This maps a
 * `JadeLook` to plain sRGB hex strings per hero material (the renderer
 * turns them into `HeroColors`), using the same tones the voxel rig paints
 * with (`resolveLook` / `hairTone` / `browTone`), and reports which
 * optional garments the look wears (the lab coat, the tool belt, a watch).
 * Empty slots fall back to Jade's first-day colours.
 */
import { LAB_PALETTE } from "@/lib/world/content/palette";
import type { JadeLook } from "@/lib/world/content/wardrobe";
import { resolveLook } from "@/lib/world/models/jade-kit";
import { browTone, hairTone } from "@/lib/world/models/jade-hair";
import { shownLook } from "@/lib/world/models/jade-rig";

export type HeroColorKey =
  | "skin"
  | "hair"
  | "brows"
  | "shirt"
  | "shirtAccent"
  | "trousers"
  | "boots"
  | "coat"
  | "belt"
  | "watch"
  | "watchFace"
  | "iris";

/** Jade's first-day colours (sRGB hex). */
export const JADE_HEX: Readonly<Record<HeroColorKey, string>> = {
  skin: "#f3cfbb",
  hair: "#e2561c",
  brows: "#b8521f",
  shirt: "#f2f2ee",
  shirtAccent: "#94979b",
  trousers: "#2b2f3a",
  boots: "#5a3522",
  coat: "#f2f2ee",
  belt: "#4a2c1a",
  watch: "#1e1b1a",
  watchFace: "#6fe0ff",
  iris: "#2e1a10",
};

export interface HeroLookColors {
  colors: Record<HeroColorKey, string>;
  /** Optional garments the look wears. */
  worn: { coat: boolean; belt: boolean; watch: boolean };
}

/** Palette index → "#rrggbb". */
export function paletteHex(index: number): string {
  const [r, g, b] = LAB_PALETTE.get(index);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function heroColorsForLook(look: JadeLook): HeroLookColors {
  const ctx = resolveLook(shownLook(look));
  const colors: Record<HeroColorKey, string> = { ...JADE_HEX };
  colors.hair = paletteHex(hairTone(ctx).main);
  colors.brows = paletteHex(browTone(ctx).shade);
  if (ctx.top) {
    colors.shirt = paletteHex(ctx.top.t.main);
    colors.shirtAccent = paletteHex(ctx.top.t.accent);
  }
  if (ctx.legs) colors.trousers = paletteHex(ctx.legs.t.main);
  if (ctx.feet) colors.boots = paletteHex(ctx.feet.t.main);
  if (ctx.outer) colors.coat = paletteHex(ctx.outer.t.main);
  if (ctx.belt) colors.belt = paletteHex(ctx.belt.t.main);
  if (ctx.wrist) {
    colors.watch = paletteHex(ctx.wrist.t.main);
    colors.watchFace = paletteHex(ctx.wrist.t.accent);
  }
  return {
    colors,
    worn: { coat: ctx.outer !== null, belt: ctx.belt !== null, watch: ctx.wrist !== null },
  };
}
