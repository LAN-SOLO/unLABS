/**
 * Load the whole Lab World game graph in a given locale.
 * ======================================================
 *
 * Content modules evaluate `tr()` at import time, so a module instance is
 * bound to the locale that was active when it was first imported. This
 * helper drops the module registry, switches the *fresh* i18n instance to
 * `locale` and dynamic-imports every module the tests need — all of them
 * share that one fresh registry (and thus the locale).
 *
 * Only use the returned modules together; never mix them with statically
 * imported game modules of the test file (those belong to another registry).
 */
import { vi } from "vitest";
import type { Locale } from "@/lib/i18n";

export async function loadGame(locale: Locale) {
  vi.resetModules();
  const i18n = await import("@/lib/i18n");
  i18n.__setLocaleForTests(locale);
  const dict = await import("@/lib/i18n/de");
  const game = await import("@/lib/world/game");
  const story = await import("@/lib/world/content/story");
  const items = await import("@/lib/world/content/items");
  const devices = await import("@/lib/world/content/devices");
  const map = await import("@/lib/world/content/map");
  const puzzles = await import("@/lib/world/content/puzzles");
  const achievements = await import("@/lib/world/achievements");
  const postgame = await import("@/lib/world/postgame");
  const save = await import("@/lib/world/save");
  const bridge = await import("@/lib/world/bridge");
  const labSync = await import("@/lib/terminal/labSync");
  const sim = await import("./simPlayer");
  const cov = await import("./simCoverage");
  return {
    locale,
    i18n,
    DE: dict.DE,
    game,
    story,
    items,
    devices,
    map,
    puzzles,
    achievements,
    postgame,
    save,
    bridge,
    labSync,
    sim,
    cov,
  };
}

export type LoadedGame = Awaited<ReturnType<typeof loadGame>>;
