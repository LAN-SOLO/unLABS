/**
 * The simulated player at Jade's wardrobe and replicator.
 * =======================================================
 *
 * Used by the completionist coverage run (`simCoverage.ts`) once the main
 * goals are reached, and by `wardrobe-content.test.ts` to prove that every
 * craftable piece can really be made from what the lab hands out. Only
 * what a player can do: stand at the replicator (reachable, powered), run
 * one job at a time, refine textiles from salvage, dye, and dress up at the
 * wardrobe. Finds come from the ordinary pickup sweep in `simPlayer.step`.
 */
import {
  DEFAULT_LOOK,
  REFINE_RECIPES,
  REPLICATOR_PROP,
  TEXTILE_ITEMS,
  WEAR_BY_ID,
  WEAR_ITEMS,
  WEAR_SLOTS,
  type WearItem,
  type WearSlot,
} from "@/lib/world/content/wardrobe";
import { PROPS } from "@/lib/world/content/map";
import { count, evalCond } from "@/lib/world/game";
import { isUnlocked } from "@/lib/world/achievements";
import { SIGNATURE_LOOKS } from "@/lib/world/content/looks";
import {
  colorwayAvailable,
  lookUnlocked,
  wearLook,
  craftStatus,
  dyeStatus,
  equip,
  ownsWear,
  refineStatus,
  replicatorIntro,
  startCraft,
  startDye,
  startRefine,
  wardrobeTick,
} from "@/lib/world/wardrobe";
import type { WorldState } from "@/lib/world/types";
import { inReach, tryCraft } from "./simPlayer";

const REPLICATOR = PROPS.find((p) => p.id === REPLICATOR_PROP)!;

/** Standing in Jade's quarters with the replicator usable (reachable + powered). */
export function atReplicator(s: WorldState): boolean {
  return (
    inReach(s, REPLICATOR.floor, REPLICATOR.x, REPLICATOR.z) && evalCond(s, REPLICATOR.requires)
  );
}

const isTextile = (id: string): boolean => (TEXTILE_ITEMS as readonly string[]).includes(id);

/** Pieces made only from textiles (they never compete with device parts). */
export function textileOnly(w: WearItem): boolean {
  return w.source.kind === "craft" && Object.keys(w.source.recipe).every(isTextile);
}

/** Try to cover one missing resource: refine a textile, or craft a component at the workbench. */
function supply(s: WorldState, item: string): boolean {
  if (isTextile(item)) {
    for (const r of REFINE_RECIPES)
      if (r.output === item && refineStatus(s, r.id).state === "ready") return startRefine(s, r.id);
    // Glow thread needs pigment first.
    if (item === "leuchtfaden" && count(s, "farbpigment") < 1) return supply(s, "farbpigment");
    return false;
  }
  return tryCraft(s, item);
}

export interface WardrobeRoutineOptions {
  /** Only replicate textile-only pieces (the coverage run keeps device parts for devices). */
  textileOnly?: boolean;
  /** Dye at most this many colourways (pigment is shared with crafting). */
  maxDyes?: number;
}

/**
 * One visit: hand in the finished job, start the next (craft → dye →
 * refine for the cheapest missing piece), then dress up at the wardrobe.
 */
export function wardrobeRoutine(s: WorldState, o: WardrobeRoutineOptions = {}): void {
  wardrobeTick(s);
  if (!atReplicator(s)) return;
  replicatorIntro(s);
  if (!s.wardrobe.job) startNextJob(s, o);
  dressUp(s);
}

function startNextJob(s: WorldState, o: WardrobeRoutineOptions): void {
  const wanted = WEAR_ITEMS.filter(
    (w) => w.source.kind === "craft" && !ownsWear(s, w.id) && (!o.textileOnly || textileOnly(w)),
  );
  // The first dye as soon as one is affordable (a player tries the colours early).
  if (!(s.counters.wear_dyed ?? 0))
    for (const w of WEAR_ITEMS)
      for (const c of w.colorways)
        if (c.dye && dyeStatus(s, w.id, c.id).state === "ready")
          return void startDye(s, w.id, c.id);
  for (const w of wanted)
    if (craftStatus(s, w.id).state === "ready") return void startCraft(s, w.id);
  const dyed = Object.keys(s.wardrobe.dyes).length;
  if (dyed < (o.maxDyes ?? 2))
    for (const w of WEAR_ITEMS)
      for (const c of w.colorways)
        if (c.dye && dyeStatus(s, w.id, c.id).state === "ready")
          return void startDye(s, w.id, c.id);
  // Nothing ready: work towards the cheapest missing piece.
  const missing = wanted
    .map((w) => ({ w, st: craftStatus(s, w.id) }))
    .filter((x) => x.st.state === "missing")
    .sort(
      (a, b) =>
        Object.values(a.st.missing).reduce((x, y) => x + y, 0) -
        Object.values(b.st.missing).reduce((x, y) => x + y, 0),
    );
  for (const { st } of missing)
    for (const item of Object.keys(st.missing)) if (supply(s, item) && s.wardrobe.job) return;
}

/**
 * At the wardrobe, one thing per visit (achievements are counted between
 * visits): something other than the first-day look in every slot and a dyed
 * colour, then the secret combination, then every unlocked signature look
 * in turn.
 */
function dressUp(s: WorldState): void {
  if (!isUnlocked(s, "von_kopf_bis_fuss")) {
    headToToe(s);
    return;
  }
  const secret: [WearSlot, string][] = [
    ["head", "propeller_cap"],
    ["feet", "slippers"],
    ["face", "fake_mustache"],
  ];
  if (!isUnlocked(s, "dresscode_optional") && secret.every(([, id]) => ownsWear(s, id))) {
    for (const [slot, id] of secret) equip(s, slot, id, undefined, true);
    return;
  }
  const next = SIGNATURE_LOOKS.find((l) => lookUnlocked(s, l.id) && !s.wardrobe.looksWorn[l.id]);
  if (next) wearLook(s, next.id, true);
}

/** Something other than the first-day look in every slot, and a dyed colour once there is one. */
function headToToe(s: WorldState): void {
  for (const slot of WEAR_SLOTS) {
    const first = DEFAULT_LOOK[slot];
    const alt = WEAR_ITEMS.find(
      (w) => w.slot === slot && ownsWear(s, w.id) && w.id !== first?.item,
    );
    if (!alt) continue;
    const cw = alt.colorways.find((c) => colorwayAvailable(s, alt.id, c.id))!;
    equip(s, slot, alt.id, cw.id, true);
  }
  // A dyed colour, once there is one.
  for (const key of Object.keys(s.wardrobe.dyes)) {
    const [item, cw] = key.split(".") as [string, string];
    const w = WEAR_BY_ID.get(item);
    if (w && !["head", "feet", "face"].includes(w.slot)) equip(s, w.slot, item, cw, true);
  }
}
