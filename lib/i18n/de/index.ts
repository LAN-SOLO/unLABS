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
import { DE_FLOORPLAN } from "@/lib/i18n/de/floorplan";
import { DE_TITLE } from "@/lib/i18n/de/title";
import { DE_MENU } from "@/lib/i18n/de/menu";
import { DE_MERCH } from "@/lib/i18n/de/merch";
import { DE_PUZZLES } from "@/lib/i18n/de/puzzles";
import { DE_SCENES } from "@/lib/i18n/de/scenes";
import { DE_STORY } from "@/lib/i18n/de/story";
import { DE_SYSTEMS } from "@/lib/i18n/de/systems";
import { DE_TERMINALS } from "@/lib/i18n/de/terminals";
import { DE_UI } from "@/lib/i18n/de/ui";
import { DE_BIO } from "@/lib/i18n/de/bio";
import { DE_ARCHIVE } from "@/lib/i18n/de/archive";
import { DE_KNOWLEDGE } from "@/lib/i18n/de/knowledge";
import { DE_COURSES } from "@/lib/i18n/de/courses";
import { DE_PC } from "@/lib/i18n/de/pc";
import { DE_MESSAGES } from "@/lib/i18n/de/messages";
import { DE_QUARTERS } from "@/lib/i18n/de/quarters";
import { DE_FIRMWARE } from "@/lib/i18n/de/firmware";
import { DE_LINKS } from "@/lib/i18n/de/links";
import { DE_DEVICE_UI } from "@/lib/i18n/de/device-ui";
import { DE_DEVICE_UI_T1 } from "@/lib/i18n/de/device-ui-tier1";
import { DE_DEVICE_UI_T2 } from "@/lib/i18n/de/device-ui-tier2";
import { DE_DEVICE_UI_T3 } from "@/lib/i18n/de/device-ui-tier3";
import { DE_ARCHIVE_F01 } from "@/lib/i18n/de/archive-f01";
import { DE_ARCHIVE_F23 } from "@/lib/i18n/de/archive-f23";
import { DE_ARCHIVE_F45 } from "@/lib/i18n/de/archive-f45";
import { DE_ARCHIVE_COMBOS } from "@/lib/i18n/de/archive-combos";
import { DE_ARCHIVE_SYSTEMS } from "@/lib/i18n/de/archive-systems";
import { DE_STUDIO } from "@/lib/i18n/de/studio";
import { DE_SONGS_CALM } from "@/lib/i18n/de/songs-calm";
import { DE_SONGS_RHYTHMIC } from "@/lib/i18n/de/songs-rhythmic";
import { DE_SONGS_ELECTRONIC } from "@/lib/i18n/de/songs-electronic";
import { DE_SONGS_CHILL } from "@/lib/i18n/de/songs-chill";
import { DE_SONGS_AMBIENT } from "@/lib/i18n/de/songs-ambient";
import { DE_SONGS_CLASSIC } from "@/lib/i18n/de/songs-classic";
import { DE_WARDROBE } from "@/lib/i18n/de/wardrobe";
import { DE_WARDROBE_UI } from "@/lib/i18n/de/wardrobe-ui";
import { DE_AUDIO_V2 } from "@/lib/i18n/de/audio-v2";
import { DE_MERCH_DROP3 } from "@/lib/i18n/de/merch-drop3";

/**
 * All German dictionaries by area. One file per area so translators can work
 * in parallel without merge conflicts. A key may appear in several areas only
 * with the SAME German value (tests/i18n/coverage.test.ts checks this).
 */
export const DE_AREAS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ui: DE_UI,
  wardrobe: DE_WARDROBE,
  wardrobeUi: DE_WARDROBE_UI,
  audioV2: DE_AUDIO_V2,
  merchDrop3: DE_MERCH_DROP3,
  studio: DE_STUDIO,
  songsCalm: DE_SONGS_CALM,
  songsRhythmic: DE_SONGS_RHYTHMIC,
  songsElectronic: DE_SONGS_ELECTRONIC,
  songsChill: DE_SONGS_CHILL,
  songsAmbient: DE_SONGS_AMBIENT,
  songsClassic: DE_SONGS_CLASSIC,
  archive: DE_ARCHIVE,
  knowledge: DE_KNOWLEDGE,
  courses: DE_COURSES,
  pc: DE_PC,
  messages: DE_MESSAGES,
  quarters: DE_QUARTERS,
  firmware: DE_FIRMWARE,
  links: DE_LINKS,
  deviceUi: DE_DEVICE_UI,
  deviceUiTier1: DE_DEVICE_UI_T1,
  deviceUiTier2: DE_DEVICE_UI_T2,
  deviceUiTier3: DE_DEVICE_UI_T3,
  archiveF01: DE_ARCHIVE_F01,
  archiveF23: DE_ARCHIVE_F23,
  archiveF45: DE_ARCHIVE_F45,
  archiveCombos: DE_ARCHIVE_COMBOS,
  archiveSystems: DE_ARCHIVE_SYSTEMS,
  menu: DE_MENU,
  floorplan: DE_FLOORPLAN,
  title: DE_TITLE,
  merch: DE_MERCH,
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
