/**
 * Lab World — shared types.
 * =========================
 *
 * The lab world is an isometric voxel game layered next to the terminal:
 * Jade Lawrence walks a multi-floor lab, salvages components, combines
 * them, builds the 38 devices stage by stage and follows many threads to
 * find Damien Fridge. Everything in `lib/world` except `render/` is pure
 * (no DOM, no three) so it runs in Vitest.
 */

/** The eight trait axes every item carries (0..∞, usually 0..12). */
export const TRAIT_AXES = [
  "energie",
  "signal",
  "optik",
  "thermik",
  "mechanik",
  "quantum",
  "resonanz",
  "daten",
] as const;
export type TraitAxis = (typeof TRAIT_AXES)[number];
export type Traits = Record<TraitAxis, number>;

/** The nine wavelengths of the crystal system. */
export const SPECTRUM = [
  "infrarot",
  "rot",
  "orange",
  "gelb",
  "gruen",
  "blau",
  "indigo",
  "violett",
  "gamma",
] as const;
export type SpectrumColor = (typeof SPECTRUM)[number];

/**
 * Item kinds. `verbrauch` = consumables of the biorhythm (lib/world/biorhythm.ts):
 * they live in counters, never in `inventory`, so no workbench / slot / salvage rule sees them.
 */
export type ItemKind =
  | "rohstoff"
  | "bauteil"
  | "prototyp"
  | "relikt"
  | "schlacke"
  | "werkzeug"
  | "verbrauch";

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  description: string;
  traits: Traits;
  color: SpectrumColor;
  /** 1..5 like crystal volatility tiers. */
  volatility: number;
  /** Generation depth: 0 for authored items, parents + 1 for prototypes. */
  depth: number;
  /** For generated prototypes: sorted parent ids. */
  parents?: string[];
  /** For generated prototypes: the named archetype it hit (see `ARCHETYPES` in combine.ts). */
  archetype?: string;
}

/** Where a piece of the world lives. */
export type FloorId = 0 | 1 | 2 | 3 | 4 | 5;

export interface RoomDef {
  id: string;
  floor: FloorId;
  name: string;
  /** Inclusive wall rectangle in voxel coords. */
  x: number;
  z: number;
  w: number;
  d: number;
  floorColor: number;
  wallColor: number;
  /** Flavor shown when entering. */
  blurb: string;
  /** Rooms filled with smoke hide pickups until VNT-001 is online. */
  smoky?: boolean;
  /** Dark rooms need this device online to be lit. */
  litBy?: string;
  /** Interior theme used by the decor generator (see content/interior.ts). */
  theme?: RoomTheme;
}

export type RoomTheme =
  | "control"
  | "server"
  | "office"
  | "corridor"
  | "workshop"
  | "archive"
  | "airlock"
  | "elevator"
  | "geothermal"
  | "power"
  | "cooling"
  | "factory"
  | "storage"
  | "audio"
  | "anomaly"
  | "lab"
  | "hangar"
  | "vault"
  | "botdepot"
  | "forge"
  | "reactor"
  | "containment"
  | "portal"
  | "cryo"
  | "quarters"
  | "greenhouse"
  | "observatory"
  | "generic";

export interface DoorDef {
  id: string;
  floor: FloorId;
  /** Center of the opening (on the wall line). */
  x: number;
  z: number;
  /** Wall orientation: 'x' = wall runs along x (door crossed along z). */
  axis: "x" | "z";
  width: number;
  lock?: Condition;
  /** Shown when locked. */
  lockHint?: string;
  /** If set, a keypad puzzle opens it. */
  keypad?: string;
  /** Hidden door: looks like plain wall until its lock condition holds (MSC scan / LCT cut). */
  secret?: boolean;
}

/** Declarative condition — evaluated against the game state. */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { device: string; state?: "built" | "online" }
  | { insight: string }
  | { flag: string }
  | { item: string; count?: number }
  | { puzzle: string }
  | { power: number }
  /** Numeric counter in `WorldState.counters` reaches `min` (e.g. slices found). */
  | { counter: string; min: number };

export interface Requirement {
  label: string;
  /** Exact item that satisfies the slot. */
  item?: string;
  /** Any item whose traits reach these thresholds satisfies the slot. */
  traits?: Partial<Traits>;
  /** Optional volatility cap for trait-based slots. */
  maxVolatility?: number;
  count?: number;
}

export interface BuildStage {
  name: string;
  requires: Requirement[];
  /** Calibration stages may demand a solved puzzle. */
  puzzle?: string;
  /** Extra gate for this stage (e.g. another device online). */
  when?: Condition;
  whenHint?: string;
  text: string;
}

export type DeviceEffect =
  | "power"
  | "storage"
  | "workbench"
  | "disassemble"
  | "scan"
  | "magnet"
  | "vent"
  | "decode"
  | "record"
  | "tones"
  | "compass"
  | "rift"
  | "drone"
  | "research"
  | "fabricate"
  | "laser"
  | "contain"
  | "analyze"
  | "host"
  | "compute"
  | "teleport"
  | "clock"
  | "monitor"
  | "thermal"
  | "network"
  | "anomaly"
  | "optics";

export interface DeviceDef {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  room: string;
  /** Position of the model's bottom-center (voxel coords on its floor). */
  x: number;
  z: number;
  /** Rotation in quarter turns. */
  rot?: 0 | 1 | 2 | 3;
  /** Watts drawn when online (negative = generation). */
  power: number;
  /** Devices that must be online before this one can be discovered/built. */
  needs: string[];
  /** Additional discovery triggers; any of them reveals the blueprint. */
  discover: Condition[];
  stages: BuildStage[];
  effect: DeviceEffect;
  /** One-liner shown in the build panel. */
  summary: string;
  /** Short line spoken by the MCP when the device comes online. */
  mcp: string;
  /** Trait signature used to recognise prototypes as blueprint hints. */
  signature: Partial<Traits>;
}

export interface PickupDef {
  id: string;
  floor: FloorId;
  x: number;
  z: number;
  items: { item: string; count: number }[];
  /** Visible only when the condition holds (e.g. scanned, smoke cleared). */
  hidden?: Condition;
  label: string;
  /** Regrows after this many seconds (resource sources). */
  respawn?: number;
  model: "crate" | "scrap" | "shelf" | "seep" | "locker" | "canister" | "crystal";
  /** Puzzle that must be solved before the pickup can be opened. */
  puzzle?: string;
  /** Full salvage needs this device; otherwise only the first item is recovered. */
  tool?: string;
  /** Recycling containers: each opening yields `poolCount` items from this pool (deterministic rotation). */
  pool?: string[];
  poolCount?: number;
}

export type PropKind =
  | "terminal"
  | "workbench"
  | "puzzle"
  | "forge"
  | "elevator"
  | "station"
  | "decor";

export interface PropDef {
  id: string;
  floor: FloorId;
  x: number;
  z: number;
  kind: PropKind;
  label: string;
  puzzle?: string;
  /** Interaction is only possible when this holds. */
  requires?: Condition;
  requiresHint?: string;
  /** Insights granted on first interaction. */
  grants?: string[];
  model:
    | "console"
    | "bigterminal"
    | "bench"
    | "valve"
    | "junction"
    | "forge"
    | "elevator"
    | "desk"
    | "board"
    | "pult"
    | "chair"
    | "plant"
    | "pipe"
    | "cable"
    | "rack"
    | "lamp"
    | "barrel"
    | "sofa";
  rot?: 0 | 1 | 2 | 3;
  /** Finer look hint for the renderer (e.g. "telescope", "coffee", "bed"); falls back to `model`. */
  variant?: string;
}

export interface NoteDef {
  id: string;
  floor: FloorId;
  x: number;
  z: number;
  title: string;
  author: "jade" | "damien" | "mcp" | "bot" | "unbekannt";
  body: string;
  hidden?: Condition;
  /** Insights granted on reading. */
  grants?: string[];
  model: "paper" | "tape" | "screen" | "crystal";
}

export interface InsightDef {
  id: string;
  title: string;
  text: string;
  /** Thread this insight belongs to (for the journal). */
  thread: "strom" | "signal" | "anomalie" | "relikt" | "damien" | "halo" | "bots";
  /** Automatically granted when this condition holds. */
  auto?: Condition;
}

export type PuzzleKind =
  | "pipes"
  | "valve"
  | "lissajous"
  | "cipher"
  | "tones"
  | "heat"
  | "coolant"
  | "keypad"
  | "crc"
  | "sigils"
  | "temporal"
  | "laser"
  | "hue"
  | "era"
  | "arbitrage"
  | "ethics"
  | "memetic"
  | "stencil"
  | "clamp"
  | "trend"
  | "palette"
  | "layers"
  | "solder"
  | "wiring"
  | "morse"
  | "radio";

export interface PuzzleDef {
  id: string;
  kind: PuzzleKind;
  title: string;
  intro: string;
  /** Kind-specific parameters. */
  params: Record<string, number | string | number[] | string[]>;
  reward?: { items?: { item: string; count: number }[]; insights?: string[]; flags?: string[] };
  mcpSolved: string;
}

export interface DialogueLine {
  who: NpcId | "jade" | "halo" | "unstables";
  text: string;
}

export interface DialogueOption {
  label: string;
  when?: Condition;
  lines: DialogueLine[];
  grants?: string[];
  flags?: string[];
  /**
   * Offer again after it was asked. Every option is asked ONCE by default;
   * mark only options whose answer changes over time (e.g. `__HINT__`) —
   * the panel still hides it while its answer is the one already shown.
   * Its flags/insights apply only the first time.
   */
  repeatable?: true;
  /** Items handed over when choosing this option (quest deliveries). */
  takes?: { item: string; count: number }[];
}

/** Lore bots (09_NARRATIVE) plus the MCP and Damien's echo. */
export type NpcId =
  | "mcp"
  | "damien"
  | "x0r8t"
  | "f1ndr"
  | "l0g1k"
  | "p1ndr0"
  | "r3tr0"
  | "b4c0n"
  | "d3c4d3"
  | "w2rek"
  | "k2ldr"
  | "c8br41n"
  /** The voice at the rift (DIM-001) — not a bot, not a person. */
  | "unstables";

export interface NpcDef {
  id: NpcId;
  name: string;
  floor: FloorId;
  x: number;
  z: number;
  /** Idle wander radius in voxels (0 = stationary). */
  wander: number;
  visible?: Condition;
  greeting: (DialogueLine & { when?: Condition })[];
  options: DialogueOption[];
}

export interface EndingDef {
  id: string;
  title: string;
  requires: Condition;
  /** Where it is triggered. */
  device: string;
  prompt: string;
  lines: DialogueLine[];
  epilogue: string;
  /** Hidden from the journal until reached or until its first clue holds. */
  secret?: boolean;
}

export interface ElevatorDef {
  floor: FloorId;
  x: number;
  z: number;
}

/** Serializable game state. */
export interface WorldState {
  /** Save format version (`SAVE_VERSION` in game.ts; migrated on load by save.ts). */
  version: number;
  floor: FloorId;
  pos: [number, number, number];
  inventory: Record<string, number>;
  /** Prototypes generated by combination (id → def). */
  generated: Record<string, ItemDef>;
  /** Device id → completed stage count. */
  built: Record<string, number>;
  /** Devices switched on by the player (only effective with enough power). */
  switchedOn: Record<string, boolean>;
  discovered: Record<string, boolean>;
  insights: Record<string, number>;
  flags: Record<string, boolean>;
  puzzles: Record<string, boolean>;
  taken: Record<string, number>;
  read: Record<string, boolean>;
  doorsOpen: Record<string, boolean>;
  endings: Record<string, boolean>;
  /** Discovered recipes (sorted input key → output id). */
  recipesKnown: Record<string, string>;
  log: { t: number; text: string }[];
  playTime: number;
  combos: number;
  /** Misc numeric counters (drone runs, timers). */
  counters: Record<string, number>;
}
