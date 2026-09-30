/**
 * Lab World — achievements (Erfolge).
 * ============================================
 *
 * Pure definitions after 03_ACHIEVEMENTS (functional branches: energy,
 * resources, construction, breadth; narrative branches: anomaly, relic,
 * cosmic signal, AI, converging in Transcendence) plus lab-specific ones.
 * Every achievement is a predicate over `WorldState`; unlocked ones are
 * stored as `state.flags["ach_<id>"]` so saves need no new field.
 *
 * Call `evaluateAchievements(state)` after every state change (it is cheap)
 * and toast the returned ids.
 */
import { tr } from "@/lib/i18n";
import { DEVICES } from "@/lib/world/content/devices";
import { ITEMS, RECIPES, SECRET_RECIPES, SLICE_TOTAL, comboKey } from "@/lib/world/content/items";
import { NOTES, PICKUPS, ROOMS } from "@/lib/world/content/map";
import {
  DIARY_PUZZLES,
  PUZZLES,
  SHAFT_SIDE_PUZZLES,
  SIDE_PUZZLES,
} from "@/lib/world/content/puzzles";
import { BOT_QUESTS, ENDINGS, NPCS } from "@/lib/world/content/story";
import { isBuilt, isOnline, log, power } from "@/lib/world/game";
import { bioBalanced } from "@/lib/world/biorhythm";
import { WEAR_SLOTS } from "@/lib/world/content/wardrobe";
import { wardrobeStats } from "@/lib/world/wardrobe";
import type { WorldState } from "@/lib/world/types";

export type AchievementBranch =
  | "energie"
  | "ressourcen"
  | "konstruktion"
  | "vielseitigkeit"
  | "anomalie"
  | "relikt"
  | "kosmos"
  | "ki"
  | "transzendenz"
  | "labor"
  | "garderobe";

export interface AchievementDef {
  id: string;
  title: string;
  /** What it takes (shown when locked unless `hidden`). */
  description: string;
  branch: AchievementBranch;
  /** Achievements that must be unlocked first (tree edges). */
  requires?: string[];
  /** Hidden until unlocked (secret achievements). */
  hidden?: boolean;
  check: (s: WorldState) => boolean;
  /** Optional progress for the panel. */
  progress?: (s: WorldState) => { current: number; target: number };
}

export const BRANCH_LABEL: Record<AchievementBranch, string> = {
  energie: tr("branch::Energy"),
  ressourcen: tr("branch::Resources"),
  konstruktion: tr("branch::Construction"),
  vielseitigkeit: tr("branch::Versatility"),
  anomalie: tr("branch::Anomaly"),
  relikt: tr("branch::Relics & Lore"),
  kosmos: tr("branch::Cosmic Signal"),
  ki: tr("branch::AI Awakening"),
  transzendenz: tr("branch::Transcendence"),
  labor: tr("branch::Lab"),
  garderobe: tr("branch::Wardrobe"),
};

export const BRANCH_ORDER: readonly AchievementBranch[] = [
  "energie",
  "ressourcen",
  "konstruktion",
  "vielseitigkeit",
  "anomalie",
  "relikt",
  "kosmos",
  "ki",
  "transzendenz",
  "labor",
  "garderobe",
];

const built = (s: WorldState): number => DEVICES.filter((d) => isBuilt(s, d.id)).length;
const salvaged = (s: WorldState): number => s.counters.salvaged ?? 0;
const relicsSeen = (s: WorldState): number =>
  ITEMS.filter((i) => i.kind === "relikt" && s.flags[`seen_${i.id}`]).length;
const botsAwake = (s: WorldState): number => BOT_QUESTS.filter((q) => s.flags[q.flag]).length;
const slices = (s: WorldState): number => s.counters.slices ?? 0;
/** Named archetypes discovered (`doCombine` bumps this on each first `arch_<id>` flag). */
const archetypes = (s: WorldState): number => s.counters.archetypes ?? 0;
/** "Artenkunde" target — well below the 14 archetypes, reachable by ordinary play. */
const ARCHETYPE_GOAL = 6;
const mainEndings = ENDINGS.filter((e) => !e.secret).map((e) => e.id);
const puzzlesSolved = (s: WorldState): number => PUZZLES.filter((p) => s.puzzles[p.id]).length;
const solvedOf = (s: WorldState, ids: readonly string[]): number =>
  ids.filter((id) => s.puzzles[id]).length;
/** Wardrobe targets: look changes, pieces owned, pieces replicated. */
const WEAR_CHANGE_GOAL = 10;
const WEAR_OWN_GOAL = 25;
const WEAR_CRAFT_GOAL = 5;
/** "Nebenschauplätze" target — ten of the optional side caches. */
const SIDE_GOAL = 10;
const visitable = ROOMS.filter((r) => r.theme !== "elevator" && r.theme !== "hub");
const roomsVisited = (s: WorldState): number =>
  visitable.filter((r) => s.flags[`visited_${r.id}`]).length;
const notesRead = (s: WorldState): number => NOTES.filter((n) => s.read[n.id]).length;
const has = (s: WorldState, ...ids: string[]): boolean => ids.every((id) => !!s.insights[id]);
const unlocked = (s: WorldState, id: string): boolean => !!s.flags[achievementFlag(id)];
const tier = (s: WorldState, t: 1 | 2 | 3): boolean =>
  DEVICES.some((d) => d.tier === t && isBuilt(s, d.id));
const secretKeys = SECRET_RECIPES.map((r) => comboKey(r.inputs));
const secretsFound = (s: WorldState): number =>
  secretKeys.filter((k) => !!s.recipesKnown[k]).length;
/** Plain recipes: no research, no secret — the ones the handbook lists from the start. */
const basicKeys = RECIPES.filter((r) => !r.research && !r.secret).map((r) => comboKey(r.inputs));
const basicsDone = (s: WorldState): number => basicKeys.filter((k) => !!s.recipesKnown[k]).length;
const prototypes = (s: WorldState) => Object.values(s.generated);
const protoColors = (s: WorldState): number => new Set(prototypes(s).map((p) => p.color)).size;
const botNotes = NOTES.filter((n) => n.author === "bot").map((n) => n.id);
/** Speakers worth a conversation: the MCP and every bot (Damien and the rift answer on their own). */
const talkers = NPCS.filter((n) => n.id !== "damien" && n.id !== "unstables").map((n) => n.id);
const talkedTo = (s: WorldState): number =>
  talkers.filter((id) => {
    if (s.flags[`met_${id}`] || s.flags[`bot_${id}_awake`]) return true;
    const prefix = `said_${id}_`;
    return Object.keys(s.flags).some((f) => f.startsWith(prefix) && s.flags[f]);
  }).length;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // ── Energie ──────────────────────────────────────────────────
  {
    id: "first_spark",
    title: tr("First Spark"),
    description: tr("Put 50 W of power on the grid. “Fifty units should do. Then we will talk.”"),
    branch: "energie",
    check: (s) => power(s).generation >= 50,
    progress: (s) => ({ current: Math.min(50, power(s).generation), target: 50 }),
  },
  {
    id: "power_grid",
    title: tr("Power Grid"),
    description: tr("Reach 300 W of simultaneous generation."),
    branch: "energie",
    requires: ["first_spark"],
    check: (s) => power(s).generation >= 300,
    progress: (s) => ({ current: Math.min(300, power(s).generation), target: 300 }),
  },
  {
    id: "perpetual_energy",
    title: tr("Perpetual Energy"),
    description: tr("Micro-fusion reactor online and at least 500 W on the grid."),
    branch: "energie",
    requires: ["power_grid"],
    check: (s) => isOnline(s, "MFR-001") && power(s).generation >= 500,
  },
  // ── Ressourcen ───────────────────────────────────────────────
  {
    id: "resource_dabbler",
    title: tr("Resource Dabbler"),
    description: tr("Salvage 25 parts from crates, scrap and sources."),
    branch: "ressourcen",
    check: (s) => salvaged(s) >= 25,
    progress: (s) => ({ current: Math.min(25, salvaged(s)), target: 25 }),
  },
  {
    id: "resource_hoarder",
    title: tr("Resource Hoarder"),
    description: tr("Salvage 150 parts. The lab is a warehouse if you let it be."),
    branch: "ressourcen",
    requires: ["resource_dabbler"],
    check: (s) => salvaged(s) >= 150,
    progress: (s) => ({ current: Math.min(150, salvaged(s)), target: 150 }),
  },
  {
    id: "resource_tycoon",
    title: tr("Resource Tycoon"),
    description: tr("Salvage 400 parts. The recyclers know you by name."),
    branch: "ressourcen",
    requires: ["resource_hoarder"],
    check: (s) => salvaged(s) >= 400,
    progress: (s) => ({ current: Math.min(400, salvaged(s)), target: 400 }),
  },
  // ── Konstruktion ─────────────────────────────────────────────
  {
    id: "tinkerer",
    title: tr("Tinkerer"),
    description: tr("Fully build 5 devices. “Steady hands, clearer head.”"),
    branch: "konstruktion",
    check: (s) => built(s) >= 5,
    progress: (s) => ({ current: Math.min(5, built(s)), target: 5 }),
  },
  {
    id: "engineer",
    title: tr("Engineer"),
    description: tr("Fully build 20 devices."),
    branch: "konstruktion",
    requires: ["tinkerer"],
    check: (s) => built(s) >= 20,
    progress: (s) => ({ current: Math.min(20, built(s)), target: 20 }),
  },
  {
    id: "master_inventor",
    title: tr("Master Inventor"),
    description: tr("Fully build all 38 devices and the MCP."),
    branch: "konstruktion",
    requires: ["engineer"],
    check: (s) => built(s) >= DEVICES.length,
    progress: (s) => ({ current: built(s), target: DEVICES.length }),
  },
  // ── Vielseitigkeit ───────────────────────────────────────────
  {
    id: "jack_of_all_trades",
    title: tr("Jack of All Trades"),
    description: tr("Build one device each from tier 1, 2 and 3 and solve 10 puzzles."),
    branch: "vielseitigkeit",
    check: (s) => tier(s, 1) && tier(s, 2) && tier(s, 3) && puzzlesSolved(s) >= 10,
  },
  {
    id: "master_of_all_trades",
    title: tr("Master of All Trades"),
    description: tr("Build every device and solve every puzzle in the lab."),
    branch: "vielseitigkeit",
    requires: ["jack_of_all_trades"],
    check: (s) => built(s) >= DEVICES.length && puzzlesSolved(s) >= PUZZLES.length,
    progress: (s) => ({ current: puzzlesSolved(s), target: PUZZLES.length }),
  },
  // ── Anomalie ─────────────────────────────────────────────────
  {
    id: "first_glimpse",
    title: tr("First Glimpse"),
    description: tr("See the first anomaly. “I call it Tuesday.”"),
    branch: "anomalie",
    check: (s) => isOnline(s, "AND-001") || has(s, "anomalie_hoert"),
  },
  {
    id: "anomaly_investigator",
    title: tr("Anomaly Investigator"),
    description: tr("Build the Anomaly Detector, Quantum Compass and Dimension Monitor."),
    branch: "anomalie",
    requires: ["first_glimpse"],
    check: (s) => isBuilt(s, "AND-001") && isBuilt(s, "QCP-001") && isBuilt(s, "DIM-001"),
  },
  {
    id: "anomaly_tamer",
    title: tr("Anomaly Tamer"),
    description: tr("Tame an anomaly in containment."),
    branch: "anomalie",
    requires: ["anomaly_investigator"],
    check: (s) => !!s.flags.anomaly_tamed || has(s, "anomalie_gezaehmt"),
  },
  // ── Relikt ───────────────────────────────────────────────────
  {
    id: "cryptic_clue",
    title: tr("Cryptic Clue"),
    description: tr("Find Jade's first margin note."),
    branch: "relikt",
    check: (s) => has(s, "halo_h") || has(s, "halo_a") || has(s, "halo_l") || has(s, "halo_o"),
  },
  {
    id: "code_breaker",
    title: tr("Code Breaker"),
    description: tr("Fully decrypt an encrypted relic."),
    branch: "relikt",
    requires: ["cryptic_clue"],
    check: (s) => !!s.puzzles.pz_cipher,
  },
  {
    id: "archivist_of_secrets",
    title: tr("Archivist of Secrets"),
    description: tr("Hold five different relics in your hands."),
    branch: "relikt",
    requires: ["code_breaker"],
    check: (s) => relicsSeen(s) >= 5,
    progress: (s) => ({ current: Math.min(5, relicsSeen(s)), target: 5 }),
  },
  // ── Kosmos ───────────────────────────────────────────────────
  {
    id: "whispers_beyond",
    title: tr("Whispers Beyond"),
    description: tr("Receive a signal that does not come from us."),
    branch: "kosmos",
    check: (s) => has(s, "halo_atmet") || has(s, "kosmischer_kontakt"),
  },
  {
    id: "answering_the_call",
    title: tr("Answering the Call"),
    description: tr("Play the four-tone handshake back."),
    branch: "kosmos",
    requires: ["whispers_beyond"],
    check: (s) => has(s, "handshake"),
  },
  {
    id: "cosmic_conversation",
    title: tr("Cosmic Conversation"),
    description: tr("Two-way contact: speak with the voice in the rift."),
    branch: "kosmos",
    requires: ["answering_the_call", "code_breaker"],
    check: (s) => has(s, "handshake", "unstables") && !!s.puzzles.pz_cipher,
  },
  // ── KI ───────────────────────────────────────────────────────
  {
    id: "awakened_ai",
    title: tr("Awakened AI"),
    description: tr("Bring the AI Assistant Core online. “I have preferences.”"),
    branch: "ki",
    check: (s) => isOnline(s, "AIC-001"),
  },
  // ── Transzendenz ─────────────────────────────────────────────
  {
    id: "transcendence",
    title: tr("Transcendence"),
    description: tr(
      "Anomaly Tamer, Archivist of Secrets, Cosmic Conversation and Awakened AI. “Three voices, braided.”",
    ),
    branch: "transzendenz",
    requires: ["anomaly_tamer", "archivist_of_secrets", "cosmic_conversation", "awakened_ai"],
    check: (s) =>
      ["anomaly_tamer", "archivist_of_secrets", "cosmic_conversation", "awakened_ai"].every((id) =>
        unlocked(s, id),
      ),
  },
  // ── Labor ────────────────────────────────────────────────────
  {
    id: "kaltstart",
    title: tr("Cold Start"),
    description: tr(
      "Read the printout at the console printer. 2,561 days of silence, 0.3 % residual charge.",
    ),
    branch: "labor",
    check: (s) => has(s, "cold_start"),
  },
  {
    id: "fuenfzig",
    title: tr("Fifty. Not forty-nine."),
    description: tr("Solve the geothermal distribution panel."),
    branch: "labor",
    check: (s) => !!s.puzzles.pz_power_flow,
  },
  {
    id: "drei_explodiert",
    title: tr("Three Exploded, One Works"),
    description: tr("Make a combination explode and invent a prototype."),
    branch: "labor",
    check: (s) => !!s.flags.explosion_seen && (s.counters.combo_prototype ?? 0) >= 1,
  },
  {
    id: "achthundertsiebenundvierzig",
    title: tr("847"),
    description: tr("Get behind the number: kW, sensors, packets, metres. Not chosen. Given."),
    branch: "labor",
    check: (s) => has(s, "lab_847", "x0r8t_audit"),
  },
  {
    id: "halo_key",
    title: tr("H · A · L · O"),
    description: tr("Read all four margin notes and recognise the key."),
    branch: "labor",
    check: (s) => has(s, "halo_schluessel"),
  },
  {
    id: "alle_bots_wach",
    title: tr("All Bots Awake"),
    description: tr("Reactivate all ten lore bots of BNET-001."),
    branch: "labor",
    check: (s) => botsAwake(s) >= BOT_QUESTS.length,
    progress: (s) => ({ current: botsAwake(s), target: BOT_QUESTS.length }),
  },
  {
    id: "alle_slices",
    title: tr("All 30 Slices"),
    description: tr("Find all thirty slices of Crystal #0089."),
    branch: "labor",
    check: (s) => slices(s) >= SLICE_TOTAL,
    progress: (s) => ({ current: Math.min(SLICE_TOTAL, slices(s)), target: SLICE_TOTAL }),
  },
  {
    id: "singularitaetsbus",
    title: tr("Coffee at the Singularity Bus"),
    description: tr("Get the coffee machine in the Canteen running again."),
    branch: "labor",
    check: (s) => has(s, "kaffeemaschine"),
  },
  {
    id: "gesunder_geist",
    title: tr("Healthy Mind"),
    description: tr(
      "Get Jade balanced: every need at 60 or more and fitness at 70 or more (biorhythm).",
    ),
    branch: "labor",
    check: (s) => bioBalanced(s),
  },
  {
    id: "fruehsport",
    title: tr("Morning Workout"),
    description: tr("Sleep in your bed, then train on the ergometer right after waking up."),
    branch: "labor",
    check: (s) => !!s.flags.bio_fruehsport,
  },
  {
    id: "tiefer",
    title: tr("Do Not Open. Do Not Forget."),
    description: tr("Open the sealed shaft and find X9-DUST."),
    branch: "labor",
    check: (s) => has(s, "schacht_frei", "x9_botschaft"),
  },
  {
    id: "radiohoerer",
    title: tr("Radio Direction Finding"),
    description: tr("Tune both radio direction finders and decipher the whisper."),
    branch: "labor",
    check: (s) =>
      !!s.flags.radio_voice_heard && !!s.flags.radio_unstables && !!s.flags.whisper_decoded,
  },
  {
    id: "kartograf",
    title: tr("Cartographer"),
    description: tr("Enter every room on all six levels — including the ones that are on no plan."),
    branch: "labor",
    check: (s) => roomsVisited(s) >= visitable.length,
    progress: (s) => ({ current: roomsVisited(s), target: visitable.length }),
  },
  {
    id: "leser",
    title: tr("The Lab Tells Its Story"),
    description: tr("Read every note, every tape, every screen."),
    branch: "labor",
    check: (s) => notesRead(s) >= NOTES.length,
    progress: (s) => ({ current: notesRead(s), target: NOTES.length }),
  },
  {
    id: "keep_unstable",
    title: tr("Keep the lab unstable"),
    description: tr("Take all four paths to Damien."),
    branch: "labor",
    check: (s) => mainEndings.every((id) => s.endings[id]),
    progress: (s) => ({
      current: mainEndings.filter((id) => s.endings[id]).length,
      target: mainEndings.length,
    }),
  },
  {
    id: "zeuge",
    title: tr("The Witness"),
    description: tr("Reach the secret ending “Crystal #0089”."),
    branch: "labor",
    hidden: true,
    check: (s) => !!s.endings.kristall,
  },
  {
    id: "tonmeister",
    title: tr("Sound Engineer"),
    description: tr("Find Damien's hidden sound studio."),
    branch: "labor",
    hidden: true,
    check: (s) => !!s.flags.visited_studio,
  },
  {
    id: "recycler",
    title: tr("Circular Economy"),
    description: tr("Empty every recycling source at least once."),
    branch: "labor",
    hidden: true,
    check: (s) => PICKUPS.filter((p) => p.pool).every((p) => (s.counters[`pool_${p.id}`] ?? 0) > 0),
  },
  // ── Experimentieren & Erkunden ───────────────────────────────
  {
    id: "nach_vorschrift",
    title: tr("By the Book"),
    description: tr(
      "Combine every basic recipe from the lab handbook yourself at least once (no research).",
    ),
    branch: "vielseitigkeit",
    check: (s) => basicsDone(s) >= basicKeys.length,
    progress: (s) => ({ current: basicsDone(s), target: basicKeys.length }),
  },
  {
    id: "zufallsfund",
    title: tr("Lucky Find"),
    description: tr("Find a recipe that is in no handbook. Just try combining something unusual."),
    branch: "vielseitigkeit",
    check: (s) => secretsFound(s) >= 1,
  },
  {
    id: "verbotenes_kochbuch",
    title: tr("The Unwritten Cookbook"),
    description: tr(
      "Discover all {n} secret recipes. “Why before how” — try first, understand later.",
      {
        n: SECRET_RECIPES.length,
      },
    ),
    branch: "vielseitigkeit",
    requires: ["zufallsfund"],
    check: (s) => secretsFound(s) >= secretKeys.length,
    progress: (s) => ({ current: secretsFound(s), target: secretKeys.length }),
  },
  {
    id: "wunderkammer",
    title: tr("Cabinet of Curiosities"),
    description: tr("Invent ten different prototypes."),
    branch: "vielseitigkeit",
    requires: ["drei_explodiert"],
    check: (s) => prototypes(s).length >= 10,
    progress: (s) => ({ current: Math.min(10, prototypes(s).length), target: 10 }),
  },
  {
    id: "vierte_generation",
    title: tr("Fourth Generation"),
    description: tr(
      "Build a prototype of generation Mk.4 or higher — prototypes from prototypes from prototypes.",
    ),
    branch: "vielseitigkeit",
    check: (s) => prototypes(s).some((p) => p.depth >= 4),
  },
  {
    id: "farbgedaechtnis",
    title: tr("Colour Memory"),
    description: tr("Invent prototypes in five different wavelengths. “Colour is memory.”"),
    branch: "vielseitigkeit",
    check: (s) => protoColors(s) >= 5,
    progress: (s) => ({ current: Math.min(5, protoColors(s)), target: 5 }),
  },
  {
    id: "archetyp",
    title: tr("Not an Accident, a Species"),
    description: tr("Invent a named archetype — a prototype that brings a property of its own."),
    branch: "vielseitigkeit",
    check: (s) => archetypes(s) >= 1,
  },
  {
    id: "artenkunde",
    title: tr("Taxonomy"),
    description: tr("Invent {n} different archetypes. The handbook keeps count.", {
      n: ARCHETYPE_GOAL,
    }),
    branch: "vielseitigkeit",
    requires: ["archetyp"],
    check: (s) => archetypes(s) >= ARCHETYPE_GOAL,
    progress: (s) => ({ current: Math.min(ARCHETYPE_GOAL, archetypes(s)), target: ARCHETYPE_GOAL }),
  },
  {
    id: "messers_schneide",
    title: tr("On a Knife's Edge"),
    description: tr("Create a prototype with volatility 5 without the workbench exploding."),
    branch: "anomalie",
    check: (s) => prototypes(s).some((p) => p.volatility >= 5),
  },
  {
    id: "bot_archaeologie",
    title: tr("Bot Archaeology"),
    description: tr(
      "Read every log a bot has left behind — from T3R-M4X's sighs to Z3-R0N's LED patterns.",
    ),
    branch: "ki",
    check: (s) => botNotes.every((id) => !!s.read[id]),
    progress: (s) => ({
      current: botNotes.filter((id) => !!s.read[id]).length,
      target: botNotes.length,
    }),
  },
  {
    id: "stammtisch",
    title: tr("Regulars' Table"),
    description: tr(
      "Talk to the MCP and all ten lore bots at least once — including the ones still asleep.",
    ),
    branch: "ki",
    check: (s) => talkedTo(s) >= talkers.length,
    progress: (s) => ({ current: talkedTo(s), target: talkers.length }),
  },
  // ── Nebenrätsel (optionale Verstecke, puzzles.ts `pz_side_*`) ──
  {
    id: "schlossknacker",
    title: tr("Lockpicker"),
    description: tr("Open the first locked cache — a maintenance hatch, a locker, a diary."),
    branch: "labor",
    check: (s) => solvedOf(s, SIDE_PUZZLES) >= 1,
  },
  {
    id: "nebenschauplaetze",
    title: tr("Side Stages"),
    description: tr("Crack {n} optional caches in the lab. Nobody asked you to.", { n: SIDE_GOAL }),
    branch: "labor",
    requires: ["schlossknacker"],
    check: (s) => solvedOf(s, SIDE_PUZZLES) >= SIDE_GOAL,
    progress: (s) => ({
      current: Math.min(SIDE_GOAL, solvedOf(s, SIDE_PUZZLES)),
      target: SIDE_GOAL,
    }),
  },
  {
    id: "alle_verstecke",
    title: tr("No Drawer Stays Shut"),
    description: tr("Open all {n} optional caches, from the Upper Deck down into the Shaft.", {
      n: SIDE_PUZZLES.length,
    }),
    branch: "labor",
    requires: ["nebenschauplaetze"],
    check: (s) => solvedOf(s, SIDE_PUZZLES) >= SIDE_PUZZLES.length,
    progress: (s) => ({ current: solvedOf(s, SIDE_PUZZLES), target: SIDE_PUZZLES.length }),
  },
  {
    id: "tagebuecher",
    title: tr("Between the Lines"),
    description: tr(
      "Open both diary locks: B4C-0N's box in the bot depot and Jade's box in her quarters.",
    ),
    branch: "relikt",
    check: (s) => solvedOf(s, DIARY_PUZZLES) >= DIARY_PUZZLES.length,
    progress: (s) => ({ current: solvedOf(s, DIARY_PUZZLES), target: DIARY_PUZZLES.length }),
  },
  {
    id: "schachtknacker",
    title: tr("Shaft Cracker"),
    description: tr(
      "Open all three caches in the Shaft: the crystal niche, C8-BR41N's thinking machine and the sample chamber at the drill head.",
    ),
    branch: "anomalie",
    check: (s) => solvedOf(s, SHAFT_SIDE_PUZZLES) >= SHAFT_SIDE_PUZZLES.length,
    progress: (s) => ({
      current: solvedOf(s, SHAFT_SIDE_PUZZLES),
      target: SHAFT_SIDE_PUZZLES.length,
    }),
  },
  // ── Garderobe (Jade's wardrobe, lib/world/wardrobe.ts) ──
  {
    id: "umgezogen",
    title: tr("Change of Clothes"),
    description: tr("Change something about Jade's look in the character menu."),
    branch: "garderobe",
    check: (s) => (s.counters.wear_changes ?? 0) >= 1,
  },
  {
    id: "modenschau",
    title: tr("Fashion Show"),
    description: tr("Change {n} pieces of Jade's look. The bots have started rating them.", {
      n: WEAR_CHANGE_GOAL,
    }),
    branch: "garderobe",
    requires: ["umgezogen"],
    check: (s) => (s.counters.wear_changes ?? 0) >= WEAR_CHANGE_GOAL,
    progress: (s) => ({
      current: Math.min(WEAR_CHANGE_GOAL, s.counters.wear_changes ?? 0),
      target: WEAR_CHANGE_GOAL,
    }),
  },
  {
    id: "kleiderschrank",
    title: tr("Walk-in Wardrobe"),
    description: tr("Own {n} pieces for Jade's wardrobe.", { n: WEAR_OWN_GOAL }),
    branch: "garderobe",
    check: (s) => wardrobeStats(s).owned >= WEAR_OWN_GOAL,
    progress: (s) => ({
      current: Math.min(WEAR_OWN_GOAL, wardrobeStats(s).owned),
      target: WEAR_OWN_GOAL,
    }),
  },
  {
    id: "fundbuero",
    title: tr("Lost and Found"),
    description: tr(
      "Find every hidden piece of clothing in the lab — from the Upper Deck down into the Shaft.",
    ),
    branch: "garderobe",
    check: (s) => {
      const st = wardrobeStats(s);
      return st.found >= st.totalFinds;
    },
    progress: (s) => {
      const st = wardrobeStats(s);
      return { current: st.found, target: st.totalFinds };
    },
  },
  {
    id: "erste_naht",
    title: tr("First Stitch"),
    description: tr("Replicate a piece of clothing at Jade's wardrobe replicator."),
    branch: "garderobe",
    check: (s) => s.wardrobe.crafted >= 1,
  },
  {
    id: "schneiderin",
    title: tr("Tailor of the Deep"),
    description: tr("Replicate {n} pieces. Fabric scraps are a renewable resource, apparently.", {
      n: WEAR_CRAFT_GOAL,
    }),
    branch: "garderobe",
    requires: ["erste_naht"],
    check: (s) => s.wardrobe.crafted >= WEAR_CRAFT_GOAL,
    progress: (s) => ({
      current: Math.min(WEAR_CRAFT_GOAL, s.wardrobe.crafted),
      target: WEAR_CRAFT_GOAL,
    }),
  },
  {
    id: "gefaerbt",
    title: tr("Dyed in the Wool"),
    description: tr("Dye a piece in a new colour at the replicator."),
    branch: "garderobe",
    check: (s) => (s.counters.wear_dyed ?? 0) >= 1,
  },
  {
    id: "von_kopf_bis_fuss",
    title: tr("Head to Toe"),
    description: tr("Wear something different from the first day in every one of the {n} slots.", {
      n: WEAR_SLOTS.length,
    }),
    branch: "garderobe",
    check: (s) => wardrobeStats(s).changedSlots >= WEAR_SLOTS.length,
    progress: (s) => ({ current: wardrobeStats(s).changedSlots, target: WEAR_SLOTS.length }),
  },
  {
    id: "dresscode_optional",
    title: tr("Dress Code: Optional"),
    description: tr("Propeller cap, bunny slippers and a fake moustache — at the same time."),
    branch: "garderobe",
    hidden: true,
    check: (s) =>
      s.wardrobe.look.head?.item === "propeller_cap" &&
      s.wardrobe.look.feet?.item === "slippers" &&
      s.wardrobe.look.face?.item === "fake_mustache",
  },
];

export const ACHIEVEMENT_BY_ID: ReadonlyMap<string, AchievementDef> = new Map(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

export function achievementFlag(id: string): string {
  return `ach_${id}`;
}

export function isUnlocked(s: WorldState, id: string): boolean {
  return unlocked(s, id);
}

/**
 * Unlock every achievement whose condition (and prerequisites) now hold.
 * Returns the newly unlocked ids in definition order. Idempotent.
 */
export function evaluateAchievements(s: WorldState): string[] {
  const fresh: string[] = [];
  // Two passes so chains (e.g. Transcendence) unlock in one call.
  for (let pass = 0; pass < 2; pass++) {
    for (const a of ACHIEVEMENTS) {
      if (unlocked(s, a.id)) continue;
      if (a.requires && !a.requires.every((r) => unlocked(s, r))) continue;
      if (!a.check(s)) continue;
      s.flags[achievementFlag(a.id)] = true;
      s.counters[`ach_t_${a.id}`] = Math.round(s.playTime);
      log(s, tr("Achievement: {title}", { title: a.title }));
      fresh.push(a.id);
    }
  }
  return fresh;
}

export interface AchievementView {
  def: AchievementDef;
  unlocked: boolean;
  /** Prerequisites met — the achievement is "in reach". */
  available: boolean;
  progress?: { current: number; target: number };
}

/** Achievements grouped by branch for the panel (secret ones stay masked). */
export function achievementsByBranch(
  s: WorldState,
): { branch: AchievementBranch; label: string; items: AchievementView[] }[] {
  return BRANCH_ORDER.map((branch) => ({
    branch,
    label: BRANCH_LABEL[branch],
    items: ACHIEVEMENTS.filter((a) => a.branch === branch).map((def) => ({
      def,
      unlocked: unlocked(s, def.id),
      available: !def.requires || def.requires.every((r) => unlocked(s, r)),
      progress: def.progress?.(s),
    })),
  }));
}

export function achievementCount(s: WorldState): { unlocked: number; total: number } {
  return {
    unlocked: ACHIEVEMENTS.filter((a) => unlocked(s, a.id)).length,
    total: ACHIEVEMENTS.length,
  };
}
