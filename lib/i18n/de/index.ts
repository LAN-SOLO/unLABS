import { DE_GAME } from "@/lib/i18n/de/game";
import { DE_SCREENS } from "@/lib/i18n/de/screens";
import { DE_BRIDGE } from "@/lib/i18n/de/bridge";
import { DE_PANELS } from "@/lib/i18n/de/panels";
import { DE_WORLD } from "@/lib/i18n/de/world";
import { DE_CONTENT_PUZZLES } from "@/lib/i18n/de/content-puzzles";
import { DE_BARKS } from "@/lib/i18n/de/barks";
import { DE_CODEX } from "@/lib/i18n/de/codex";
import { DE_DECOR } from "@/lib/i18n/de/decor";
import { DE_DEVICES } from "@/lib/i18n/de/devices";
import { DE_ITEMS } from "@/lib/i18n/de/items";
import { DE_MAP } from "@/lib/i18n/de/map";
import { DE_MAP_UI } from "@/lib/i18n/de/map-ui";
import { DE_MENU } from "@/lib/i18n/de/menu";
import { DE_PUZZLES } from "@/lib/i18n/de/puzzles";
import { DE_SCENES } from "@/lib/i18n/de/scenes";
import { DE_STORY } from "@/lib/i18n/de/story";
import { DE_SYSTEMS } from "@/lib/i18n/de/systems";
import { DE_TERMINALS } from "@/lib/i18n/de/terminals";
import { DE_UI } from "@/lib/i18n/de/ui";
import { DE_BIO } from "@/lib/i18n/de/bio";

/**
 * All German dictionaries by area. One file per area so translators can work
 * in parallel without merge conflicts. A key may appear in several areas only
 * with the SAME German value (tests/i18n/coverage.test.ts checks this).
 */
export const DE_AREAS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ui: DE_UI,
  menu: DE_MENU,
  puzzles: DE_PUZZLES,
  story: DE_STORY,
  map: DE_MAP,
  mapUi: DE_MAP_UI,
  devices: DE_DEVICES,
  items: DE_ITEMS,
  codex: DE_CODEX,
  barks: DE_BARKS,
  decor: DE_DECOR,
  terminals: DE_TERMINALS,
  systems: DE_SYSTEMS,
  scenes: DE_SCENES,
  game: DE_GAME,
  screens: DE_SCREENS,
  bridge: DE_BRIDGE,
  panels: DE_PANELS,
  world: DE_WORLD,
  contentPuzzles: DE_CONTENT_PUZZLES,
  bio: DE_BIO,
};

/** English source string → German. */
export const DE: ReadonlyMap<string, string> = new Map(
  Object.values(DE_AREAS).flatMap((area) => Object.entries(area)),
);
