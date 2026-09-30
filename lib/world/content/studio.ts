/**
 * Damien's Sound Studio — a hidden room on Level −2 (content hooks).
 * ==================================================================
 *
 * The trail: three scraps of "Damien's song" (notes n_studio_frag1–3 in
 * floorplan.ts PLAN_NOTES: Archive on Level 0, Cold Archive on Level −3,
 * Radio Room on Level +1) grant `studio_frag1–3`; together they grant
 * `studio_song`. Then the foam panel with eight keys in the Measurement
 * Ring (prop STUDIO_PANEL) takes the tune (puzzle `pz_studio_door`,
 * 3 · 5 · 8 · 6 · 7 · 5) and the secret door `d_studio` opens. Hints:
 * L0G-1K's foam note in the ring, Damien's legal pad #18 in his quarters,
 * the MCP's hint (lib/world/game.ts) and the lab archive.
 *
 * Inside, the mixing desk (prop STUDIO_PROP) opens the studio
 * (components/world/studio/StudioPanel.tsx): jukebox of every song, mixer,
 * keyboard, step sequencer, sound library.
 */
export const STUDIO_ROOM = "studio";
export const STUDIO_PROP = "studio_console";
export const STUDIO_PANEL = "studio_panel";
export const STUDIO_PUZZLE = "pz_studio_door";
/** The tune on the panel's eight keys (1-based, as the scraps write it). */
export const STUDIO_TUNE = [3, 5, 8, 6, 7, 5] as const;
