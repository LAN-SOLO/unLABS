/**
 * Game version — single source of truth is `package.json` "version",
 * injected at build time as NEXT_PUBLIC_APP_VERSION (next.config.mjs).
 * Electron builds read the same field, so web, desktop and every in-game
 * version label always agree. Bump it with each `release:` commit.
 */
export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION || "dev";

/** "v0.2.0-beta" style label for footers and menus. */
export const VERSION_LABEL = `v${APP_VERSION}`;
