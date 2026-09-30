/**
 * Damien's reveal gate — the single source of truth for whether the game may
 * show Damien Fridge clearly.
 * ==================================================================
 *
 * Damien is fully modelled (`damienRig` in models/rig.ts: tall, heavy-set,
 * slicked-back grey-blond hair in a knot, a long pointed grey beard, winged
 * liner, a white shirt), but he stays a mystery until he has been found.
 * Until then every appearance is veiled: the echo NPC and the scene figure
 * (models/veil.ts, LabEngine), his workstation / Echo Recorder screens
 * (screen-content.ts `drawDamien`), the Cottbus photo (washed out) and the
 * merch motif.
 *
 * `DAMIEN_FOUND_FLAG` is RESERVED for the future "find Damien" story arc.
 * Nothing in the current game sets it — no scene, ending, reward, dialogue
 * or bridge event (tests/world/damien-reveal.test.ts guards this). It is a
 * plain state flag, so saves keep it (save-sanitize accepts every non-empty
 * flag key) and a dev save can set it to preview the revealed model in game.
 * Outside the game, the revealed model is previewed by calling
 * `damienRig(false)` directly (the undevbook sprite baker, iso renders).
 */

/** State flag set once Jade has found Damien (future arc — never set today). */
export const DAMIEN_FOUND_FLAG = "damien_found";

/** Minimal state shape the gate needs (any WorldState fits). */
export interface DamienRevealState {
  flags: Readonly<Record<string, boolean | undefined>>;
}

/** True only once Damien has been found: then he may be shown clearly. */
export function isDamienRevealed(state: DamienRevealState | null | undefined): boolean {
  return state?.flags[DAMIEN_FOUND_FLAG] === true;
}
