/**
 * Clarity mode setting (shared by settings.ts and clarity.ts, no deps).
 *  - "story": the world sharpens as Jade invents (the game's design),
 *  - "clear": always crystal clear (accessibility, photo mode),
 *  - "pixel": always the first-day pixels (nostalgia).
 */
export const CLARITY_MODES = ["story", "clear", "pixel"] as const;
export type ClarityMode = (typeof CLARITY_MODES)[number];
