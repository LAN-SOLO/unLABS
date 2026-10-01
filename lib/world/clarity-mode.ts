/**
 * Clarity mode setting (shared by settings.ts and clarity.ts, no deps).
 *  - "story": the world sharpens as Jade invents (the game's design),
 *  - "clear": always crystal clear (accessibility, photo mode),
 *  - "pixel": always the first-day pixels (nostalgia).
 */
export const CLARITY_MODES = ["story", "clear", "pixel"] as const;
export type ClarityMode = (typeof CLARITY_MODES)[number];

/**
 * Crystal age setting (docs/CRYSTAL.md):
 *  - "story": the lab crystallises into real surfaces after era 42,
 *  - "always": real surfaces from the start (photo mode, showcase),
 *  - "off": stay voxels for good (older GPUs, purists).
 */
export const CRYSTAL_MODES = ["story", "always", "off"] as const;
export type CrystalMode = (typeof CRYSTAL_MODES)[number];
