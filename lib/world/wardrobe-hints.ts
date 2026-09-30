/**
 * Lab World — first-time hints for Jade's wardrobe.
 * =================================================
 *
 * Three one-off bubbles in the same system as `tutorial.ts` (same flags
 * `tut_<id>`, same spacing after the previous hint and after a bark), asked
 * only when the tutorial itself has nothing to say: the first found piece
 * (the character menu, key O), the first textile in the bag, and the
 * replicator once Jade is in her quarters with power on the grid.
 */
import { tr } from "@/lib/i18n";
import { LOOK_BY_ID } from "@/lib/world/content/looks";
import {
  REPLICATOR_INTRO_FLAG,
  REPLICATOR_POWER,
  TEXTILE_ITEMS,
} from "@/lib/world/content/wardrobe";
import {
  HINT_AFTER_BARK,
  HINT_LAST_COUNTER,
  hintSeen,
  hintSpacing,
  type Hint,
  type TutorialContext,
} from "@/lib/world/tutorial";
import type { WorldState } from "@/lib/world/types";

/** Set the first time the character menu is opened (UI). */
export const WARDROBE_MENU_FLAG = "used_wardrobe_menu";
/** Set the first time the Looks tab is opened (UI). */
export const LOOKS_TAB_FLAG = "used_looks_tab";

/** A look beyond the two starter looks is unlocked. */
const earnedLook = (s: WorldState): boolean =>
  Object.keys(s.wardrobe.looks).some((id) => LOOK_BY_ID.get(id)?.unlock.kind !== "start");

interface WardrobeHintDef {
  id: string;
  title: string;
  keys?: string[];
  when: (s: WorldState, ctx: TutorialContext) => string | null;
}

const hasTextile = (s: WorldState): boolean =>
  TEXTILE_ITEMS.some((id) => (s.inventory[id] ?? 0) > 0);

export const WARDROBE_HINTS: readonly WardrobeHintDef[] = [
  {
    id: "wear_found",
    title: tr("New in the wardrobe"),
    keys: ["O"],
    when: (s) =>
      Object.keys(s.wardrobe.found).length > 0 && !s.flags[WARDROBE_MENU_FLAG]
        ? tr(
            "Jade found something to wear. The character menu (O) changes her look: gadgets and accessories anywhere, clothes, shoes and hair at the wardrobe in her quarters.",
          )
        : null,
  },
  {
    id: "wear_textiles",
    title: tr("Fabric for the replicator"),
    when: (s) =>
      hasTextile(s)
        ? tr(
            "Fabric scraps, polymer fibre, pigment and glow thread are for Jade's wardrobe replicator. Laundry baskets and rag bins refill over time; salvage can be refined at the replicator.",
          )
        : null,
  },
  {
    id: "wear_looks",
    title: tr("Signature looks"),
    keys: ["O"],
    when: (s) =>
      earnedLook(s) && !s.flags[LOOKS_TAB_FLAG]
        ? tr(
            "Jade has a new signature look. The Looks tab in the character menu (O) puts a whole outfit on in one go — the clothes part at the wardrobe.",
          )
        : null,
  },
  {
    id: "wear_replicator",
    title: tr("Needle's Eye"),
    when: (s, ctx) =>
      ctx.room === "jadeq" &&
      !s.flags[REPLICATOR_INTRO_FLAG] &&
      ctx.powerGeneration >= REPLICATOR_POWER
        ? tr(
            "Next to her wardrobe stands the replicator Jade built herself. It sews, prints, dyes and recycles clothes — from resources she collects in the lab.",
          )
        : null,
  },
];

/** The next wardrobe hint to show, or null (call after `nextHint` returned null). */
export function nextWardrobeHint(s: WorldState, ctx: TutorialContext, now: number): Hint | null {
  if (!ctx.hintsEnabled || ctx.cinematic || ctx.overlay) return null;
  const last = s.counters[HINT_LAST_COUNTER];
  if (last !== undefined && now - last < hintSpacing(s, now)) return null;
  const bark = s.counters["bark:last"];
  if (bark !== undefined && now >= bark && now - bark < HINT_AFTER_BARK) return null;
  for (const def of WARDROBE_HINTS) {
    if (hintSeen(s, def.id)) continue;
    const text = def.when(s, ctx);
    if (!text) continue;
    return def.keys
      ? { id: def.id, title: def.title, text, keys: [...def.keys] }
      : { id: def.id, title: def.title, text };
  }
  return null;
}
