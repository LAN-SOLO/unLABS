/**
 * Lab World — the in-game handbook ("Laborhandbuch").
 * ===================================================
 *
 * Every mechanic explained once, with examples drawn from the real content
 * (devices, recipes, synergies). Entries unlock from the save state; locked
 * ones render as "???". Tables can lock single rows too. Pure data + pure
 * evaluation, so `tests/world/codex.test.ts` can validate every reference.
 */
import { tr } from "@/lib/i18n";
import { MAX_INPUTS, SYNERGIES, VOLATILITY_LIMIT } from "@/lib/world/combine";
import { DEVICES, DEVICE_BY_ID, NEEDS_COOLING } from "@/lib/world/content/devices";
import {
  ITEM_BY_ID,
  PROTECTED_ITEMS,
  RECIPES,
  SECRET_RECIPES,
  SLICE_ITEM,
  SLICE_TOTAL,
  comboKey,
} from "@/lib/world/content/items";
import { WORLD_FIRMWARE, type FirmwareSource } from "@/lib/world/content/firmware";
import {
  REFINE_RECIPES,
  REPLICATOR_POWER as WARDROBE_REPLICATOR_POWER,
  WEAR_ITEMS,
} from "@/lib/world/content/wardrobe";
import { BUS_LABEL, HUBS } from "@/lib/world/content/links";
import { FLOORS, FLOOR_ACCESS, ROOMS } from "@/lib/world/content/map";
import { manifestOf } from "@/lib/world/firmware";
import { NPCS, NPC_SPEAKERS } from "@/lib/world/content/story";
import {
  PWD_BONUS,
  RESEARCH_BY_ID,
  RESEARCH_COOLDOWN,
  RESEARCH_PER_CYCLE,
  UEC_NOMINAL,
  evalCond,
} from "@/lib/world/game";
import { AXIS_COLOR, AXIS_LABEL } from "@/lib/world/traits";
import {
  BIO_BALANCED_FIT,
  BIO_BALANCED_MIN,
  BIO_BALANCED_WALK,
  BIO_DECAY_PER_MIN,
  BIO_LOW,
  BIO_LOW_WALK,
  CARRY_LIMIT,
  COFFEE_RESTORE,
  FRESH_BONUS,
  FRIDGE_CAPACITY,
  PROTEIN_BONUS,
  PROVISION_BY_ID,
  REPLICATOR_COOLDOWN,
  REPLICATOR_POWER,
  SLEEP_BELOW,
  SLEEP_SECONDS,
  TRAIN_COOLDOWN,
  TRAIN_GAIN,
  bioNum,
} from "@/lib/world/biorhythm";
import {
  TRAIT_AXES,
  type Condition,
  type DeviceDef,
  type FloorId,
  type NpcId,
  type TraitAxis,
  type WorldState,
} from "@/lib/world/types";

export const CODEX_TABS = [
  "grundlagen",
  "energie",
  "bauen",
  "kombinieren",
  "eigenschaften",
  "rezepte",
  "geraete",
  "personen",
  "orte",
  "glossar",
] as const;
export type CodexTab = (typeof CODEX_TABS)[number];

export const CODEX_TAB_LABEL: Record<CodexTab, string> = {
  grundlagen: tr("Basics"),
  energie: tr("Power"),
  bauen: tr("Build"),
  kombinieren: tr("Combine"),
  eigenschaften: tr("Traits"),
  rezepte: tr("Recipes"),
  geraete: tr("Devices"),
  personen: tr("People"),
  orte: tr("Places"),
  glossar: tr("Glossary"),
};

/** When an entry (or a table row) becomes readable. */
export type CodexUnlock =
  | { always: true }
  /** Any game condition (device online, insight, flag, …). */
  | { cond: Condition }
  /** Blueprint discovered. */
  | { discovered: string }
  /** Every listed item was held at least once (`seen_<id>` flag). */
  | { seen: string[] }
  /** Room entered once (`visited_<id>` flag). */
  | { visited: string }
  /** Floor reached (current floor or any of its rooms visited). */
  | { floor: FloorId }
  /** NPC met (`met_<id>` flag, any dialogue option chosen, or bot reactivated). */
  | { met: NpcId }
  /** Recipe combined at least once (canonical `comboKey` in `recipesKnown`). */
  | { recipe: string }
  | { anyOf: CodexUnlock[] };

export type CodexBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | {
      kind: "table";
      head: string[];
      rows: { cells: string[]; unlock?: CodexUnlock; color?: string }[];
    }
  | { kind: "swatch"; color: string; label: string };

export interface CodexEntry {
  id: string;
  tab: CodexTab;
  title: string;
  /** Short line under the title in the list. */
  sub?: string;
  blocks: CodexBlock[];
  unlock: CodexUnlock;
  /** Accent colour (trait axes, speakers). */
  color?: string;
  /** Marks research-gated recipes. */
  badge?: string;
}

const ALWAYS: CodexUnlock = { always: true };
const p = (text: string): CodexBlock => ({ kind: "p", text });
const list = (items: string[]): CodexBlock => ({ kind: "list", items });

const itemName = (id: string): string => ITEM_BY_ID.get(id)?.name ?? id;
const deviceName = (id: string): string => DEVICE_BY_ID.get(id)?.name ?? id;
const watts = (w: number): string => `${Number.isInteger(w) ? w : w.toFixed(1)} W`;

// ── Evaluation ───────────────────────────────────────────────────

export function codexUnlocked(s: WorldState, u: CodexUnlock | undefined): boolean {
  if (!u || "always" in u) return true;
  if ("anyOf" in u) return u.anyOf.some((x) => codexUnlocked(s, x));
  if ("cond" in u) return evalCond(s, u.cond);
  if ("discovered" in u) return !!s.discovered[u.discovered];
  if ("seen" in u) return u.seen.every((id) => !!s.flags[`seen_${id}`]);
  if ("visited" in u) return !!s.flags[`visited_${u.visited}`];
  if ("floor" in u)
    return (
      s.floor === u.floor || ROOMS.some((r) => r.floor === u.floor && !!s.flags[`visited_${r.id}`])
    );
  if ("recipe" in u) return !!s.recipesKnown[u.recipe];
  if ("met" in u) {
    if (s.flags[`met_${u.met}`] || s.flags[`bot_${u.met}_awake`]) return true;
    const prefix = `said_${u.met}_`;
    return Object.keys(s.flags).some((f) => f.startsWith(prefix) && s.flags[f]);
  }
  return false;
}

// ── Lab systems: interfaces, links, firmware, archive ────────────

const SOURCE_LABEL: Record<FirmwareSource, string> = {
  net: tr("source::Network mirror (NET-001)"),
  mcp: tr("source::MCP registry"),
  manual: tr("source::Service image — type the checksum"),
};

const SYSTEMS: CodexEntry[] = [
  {
    id: "s_interface",
    tab: "geraete",
    title: tr("Device interfaces"),
    sub: tr("Every built device has its own"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "A finished device is used through its own interface: its faceplate pages show live values and its controls (knobs, modes, switches). Every interface also has an Info page — “Read out” for the device's live readout, plus any records stored on the device — and a Firmware page. Hubs have a Links page.",
        ),
      ),
      list([
        tr("Switch on / off: top right. Offline devices show no pages, only “no power”."),
        tr("Service: the old build view — stages, slots, hosted puzzles and endings."),
        tr("Records on an Info page appear only while the device is online."),
      ]),
    ],
  },
  {
    id: "s_links",
    tab: "geraete",
    title: tr("Links & hubs"),
    sub: tr("Devices that manage other devices"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Six devices are hubs: on their Links page you connect other finished devices to them. A device can hang on several hubs, but on each kind of hub only once. The hub must be online; unlinking is free and instant. Some build stages need a link — the stage tells you which.",
        ),
      ),
      {
        kind: "table",
        head: [tr("Hub"), tr("Kind"), tr("Ports"), tr("What linking does")],
        rows: HUBS.map((h) => ({
          cells: [deviceName(h.id), BUS_LABEL[h.bus], String(h.capacity), h.text],
          unlock: { discovered: h.id },
        })),
      },
    ],
  },
  {
    id: "s_firmware",
    tab: "geraete",
    title: tr("Firmware updates"),
    sub: tr("Check → download → verify → flash → reboot"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Many devices have one lab update. It is flashed on the device's Firmware page while the device is online, and each update adds a feature. Where the image comes from decides what you need first:",
        ),
      ),
      list([
        tr(
          "Network mirror: NET-001 needs its own update first (the firmware mirror), then link the device to NET-001.",
        ),
        tr("MCP registry: add the device to the MCP's device registry (MCP → Links)."),
        tr(
          "Service image: already on board, but you must type its eight-character checksum. The labels are somewhere in the lab — search.",
        ),
      ]),
      p(
        tr(
          "A rollback restores the factory image at any time; the update stays available. Some build stages need a device to run a certain version.",
        ),
      ),
      {
        kind: "table",
        head: [tr("Device"), tr("Update"), tr("Source"), tr("New feature")],
        rows: Object.entries(WORLD_FIRMWARE).map(([id, w]) => ({
          cells: [
            deviceName(id),
            manifestOf(id)?.update?.version ?? "",
            SOURCE_LABEL[w.source],
            `${w.unlock.label} — ${w.unlock.text}`,
          ],
          unlock: { discovered: id },
        })),
      },
    ],
  },
  {
    id: "g_archiv",
    tab: "grundlagen",
    title: tr("The archive"),
    sub: tr("Everything is written down somewhere"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Whatever you might look up in a guide, somebody in this lab wrote down: on boards and posters, in lockers and vents, on device screens. Every record you find lands in the journal under Archive.",
        ),
      ),
      list([
        tr("Read: boards, posters, screens and notes show their records when used."),
        tr(
          "Search: lockers, cabinets, vents, shelves, boxes and paper piles offer “Search” — empty ones too, so looking is never a giveaway.",
        ),
        tr("Devices: records on a device's Info page, while it is online."),
        tr(
          "Combine: some knowledge exists only between several records. Once you have them all, the console in Journal → Archive asks a question — the answer follows from what you found.",
        ),
      ]),
      p(
        tr(
          "The harder a record is to find (open → tucked away → hidden → well hidden → buried), the further it reaches. The best ones need a device online, a tool in hand or a certain firmware.",
        ),
      ),
    ],
  },
];

// ── Grundlagen ───────────────────────────────────────────────────

const BASICS: CodexEntry[] = [
  {
    id: "g_steuerung",
    tab: "grundlagen",
    title: tr("Controls"),
    sub: tr("Keys and mouse"),
    unlock: ALWAYS,
    blocks: [
      {
        kind: "table",
        head: [tr("Key"), tr("Effect")],
        rows: [
          {
            cells: [
              tr("{key:moveUp}{key:moveLeft}{key:moveDown}{key:moveRight} / arrow keys"),
              tr("walk"),
            ],
          },
          { cells: [tr("Left click"), tr("walk there / use object")] },
          { cells: [tr("{key:interact} / Space"), tr("use highlighted object")] },
          { cells: ["{key:rotateLeft} / {key:rotateRight}", tr("rotate camera by 90°")] },
          { cells: [tr("Mouse wheel, {key:zoomIn} / {key:zoomOut}"), tr("zoom")] },
          { cells: ["V", tr("Walls up → half → down")] },
          {
            cells: [
              "{key:inventory} · {key:workbench} · {key:journal} · {key:power}",
              tr("Inventory · Workbench · Journal · Power"),
            ],
          },
          { cells: ["M · K · C", tr("Map · Achievements · Lab Handbook")] },
          { cells: ["{key:help} · {key:pause}", tr("Help · Menu / close")] },
          { cells: ["{key:quicksave} · {key:quickload}", tr("Quicksave · Quickload")] },
        ],
      },
      p(tr("All keys except V, M, K and C can be rebound under Settings → Controls.")),
    ],
  },
  {
    id: "g_ziel",
    tab: "grundlagen",
    title: tr("What it's about"),
    sub: tr("Bring the lab back online"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Jade Lawrence wakes up at her console after 2,561 days. Damien Fridge has vanished — somewhere between the signals. The lab has to be brought back to life, device by device.",
        ),
      ),
      list([
        tr("Power first: without it, almost everything stays dark."),
        tr("Collect finds, combine them, build devices in three stages."),
        tr(
          "Notes, conversations and devices yield insights — they open blueprints, doors and paths.",
        ),
        tr(
          "Four endings (and a secret one) are waiting. The compass at the top shows the most urgent objective.",
        ),
      ]),
    ],
  },
  {
    id: "g_journal",
    tab: "grundlagen",
    title: tr("Journal & Objectives"),
    sub: "{key:journal}",
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "The journal collects insights by thread (Power, Signal, Anomaly, Relic, Damien, Halo, Bots) and lists every open objective under “Objectives”. The top objective appears as a compass at the top of the screen; if it is on another level, the arrow points up or down.",
        ),
      ),
    ],
  },
  {
    id: "g_karte",
    tab: "grundlagen",
    title: tr("Map & Minimap"),
    sub: "M",
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Green = device online · Orange = unpowered · Cyan = blueprint · Yellow = find · White = unread note. Click the minimap to open the full map.",
        ),
      ),
    ],
  },
  {
    id: "g_speichern",
    tab: "grundlagen",
    title: tr("Saving"),
    sub: "{key:quicksave} · {key:quickload} · Autosave",
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Three save slots plus autosave. {key:quicksave} saves instantly to the active save slot, {key:quickload} loads it. Set the autosave interval under Settings → Game.",
        ),
      ),
    ],
  },
  {
    id: "g_erfolge",
    tab: "grundlagen",
    title: tr("Achievements"),
    sub: "K",
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Achievements are grouped into branches and unlock on their own. They change nothing in the game — they only tell how you played.",
        ),
      ),
    ],
  },
  {
    id: "g_biorhythmus",
    tab: "grundlagen",
    title: tr("Biorhythm"),
    sub: tr("Food · drink · sleep · fitness"),
    unlock: { floor: 4 },
    blocks: [
      p(
        tr(
          "From your first visit to Level +1 Jade has four needs: satiation, hydration, rest and fitness (0–100). They drop slowly with play time — per minute {food} satiation, {drink} hydration, {rest} rest and {fit} fitness. The setting Game → Biorhythm halves that (relaxed) or switches it off.",
          {
            food: bioNum(BIO_DECAY_PER_MIN.food),
            drink: bioNum(BIO_DECAY_PER_MIN.drink),
            rest: bioNum(BIO_DECAY_PER_MIN.rest),
            fit: bioNum(BIO_DECAY_PER_MIN.fit),
          },
        ),
      ),
      p(
        tr(
          "It is gentle by design: nothing is ever blocked, damaged or lost. A need below {low} only slows your walk a little (×{slow}); every need at {min}+ and fitness at {fit}+ counts as balanced and speeds you up a bit (×{fast}).",
          {
            low: BIO_LOW,
            slow: bioNum(BIO_LOW_WALK),
            min: BIO_BALANCED_MIN,
            fit: BIO_BALANCED_FIT,
            fast: bioNum(BIO_BALANCED_WALK),
          },
        ),
      ),
      {
        kind: "table",
        head: [tr("Where"), tr("What it does")],
        rows: [
          {
            cells: [
              tr("Food Replicator (Canteen)"),
              tr(
                "Prints a nutrient bar (+{bar} satiation), a water bottle (+{water} hydration) or a protein shake (+{sf} satiation, +{sd} hydration, next workout ×{pb}). Needs {w} W, one print every {cd} s, up to {carry} of each in your bag.",
                {
                  bar: PROVISION_BY_ID.get("naehrriegel")?.restore.food ?? 0,
                  water: PROVISION_BY_ID.get("wasserflasche")?.restore.drink ?? 0,
                  sf: PROVISION_BY_ID.get("protein_shake")?.restore.food ?? 0,
                  sd: PROVISION_BY_ID.get("protein_shake")?.restore.drink ?? 0,
                  pb: bioNum(PROTEIN_BONUS),
                  w: REPLICATOR_POWER,
                  cd: REPLICATOR_COOLDOWN,
                  carry: CARRY_LIMIT,
                },
              ),
            ],
          },
          {
            cells: [
              tr("Neutro-Fridge (Canteen)"),
              tr(
                "Stores up to {cap} provisions. Eaten straight from the fridge they are fresh and restore {p} % more. Nothing ever spoils.",
                { cap: FRIDGE_CAPACITY, p: Math.round((FRESH_BONUS - 1) * 100) },
              ),
            ],
          },
          {
            cells: [
              tr("Your bed (Jade's Quarters)"),
              tr(
                "Sleep when rest is below {below}: rest back to 100, {min} minutes of play time pass (respawns and cooldowns advance too).",
                { below: SLEEP_BELOW, min: SLEEP_SECONDS / 60 },
              ),
            ],
          },
          {
            cells: [
              tr("Ergometer (Jade's Quarters)"),
              tr("+{gain} fitness per workout (every {cd} s), costs a little hydration and rest.", {
                gain: TRAIN_GAIN,
                cd: TRAIN_COOLDOWN,
              }),
            ],
          },
          {
            cells: [
              tr("Coffee"),
              tr("Drinkable from the inventory: +{d} hydration, +{r} rest.", {
                d: COFFEE_RESTORE.drink ?? 0,
                r: COFFEE_RESTORE.rest ?? 0,
              }),
            ],
          },
        ],
      },
    ],
  },
  {
    id: "g_garderobe",
    tab: "grundlagen",
    title: tr("Wardrobe & character menu"),
    sub: "O",
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Jade can dress however she likes. The character menu (O, the pause menu or the inventory) shows her from all sides and lists every piece by slot: clothes (top, jacket, trousers, shoes, hairstyle), gadgets (headgear, face, gloves) and accessories (back, neck, belt, wrist, shoulder buddy).",
        ),
      ),
      p(
        tr(
          "Gadgets and accessories change anywhere. Clothes, shoes and hair only change at the wardrobe in Jade's quarters — use it and the menu opens there. Four outfit slots save a whole look; “Surprise me” rolls one from what she owns. Many pieces come in several colours; some colours have to be dyed first.",
        ),
      ),
      {
        kind: "table",
        head: [tr("Where pieces come from"), tr("How")],
        rows: [
          {
            cells: [
              tr("Hidden in the lab"),
              tr(
                "{n} pieces lie hidden on every level — some behind a lock, in a secret room or only after a certain event. The collection tab gives a hint for each.",
                { n: WEAR_ITEMS.filter((w) => w.source.kind === "find").length },
              ),
            ],
          },
          {
            cells: [
              tr("Wardrobe replicator"),
              tr("{n} patterns, made from collected resources (see “Needle's Eye”).", {
                n: WEAR_ITEMS.filter((w) => w.source.kind === "craft").length,
              }),
            ],
          },
          {
            cells: [
              tr("Rewards"),
              tr(
                "{n} pieces arrive on their own: for slices of Crystal #0089, awake bots, explosions, Damien's studio.",
                { n: WEAR_ITEMS.filter((w) => w.source.kind === "reward").length },
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    id: "g_nadeloehr",
    tab: "grundlagen",
    title: tr("Needle's Eye (wardrobe replicator)"),
    sub: tr("Jade's Quarters"),
    unlock: { visited: "jadeq" },
    blocks: [
      p(
        tr(
          "Jade built NDL-0 “Needle's Eye” in 2018: a cast-iron industrial sewing head on the spare gantry of the first 3D fabricator, a spool rack, a slot for pattern disks, a dye carousel from the canteen's broken slush machine, a mirror on the upright and a recycling maw at the side. It stands next to her wardrobe and needs {w} W on the grid to start a job.",
          { w: WARDROBE_REPLICATOR_POWER },
        ),
      ),
      list([
        tr(
          "Fabricate: a new piece from resources. Some patterns only appear after something happened in the lab (a device built, bots awake, an explosion survived).",
        ),
        tr("Refine: turns salvage into textiles (table below)."),
        tr("Dye: pays for a new colourway of a piece once; afterwards it is free."),
        tr("Recycle: an unworn replicated piece goes back into the maw for half its fabric."),
        tr("One job at a time; it keeps working while Jade walks the lab."),
      ]),
      {
        kind: "table",
        head: [tr("Refine"), tr("Gives")],
        rows: REFINE_RECIPES.map((r) => ({
          cells: [
            Object.entries(r.inputs)
              .map(([id, n]) => `${n}× ${itemName(id)}`)
              .join(" + "),
            `${r.count}× ${itemName(r.output)}`,
          ],
        })),
      },
      p(
        tr(
          "Fabric scraps come from laundry baskets, rag bins and lost-and-found crates (they refill), polymer fibre from offcut bins and tarps, pigment from the greenhouse (refined algae), glow thread from fibre optics.",
        ),
      ),
    ],
  },
];

// ── Energie ──────────────────────────────────────────────────────

const PRIORITY = ["MCP-000", "BAT-001", "PWR-001", "THM-001"];

const ENERGY: CodexEntry[] = [
  {
    id: "e_prinzip",
    tab: "energie",
    title: tr("Generation & Consumption"),
    sub: tr("The first law"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "“Power before understanding.” Every built, switched-on device draws watts. Generators supply watts. The Power Panel ({key:power}) shows both and lets you switch devices on and off.",
        ),
      ),
      p(
        tr(
          "Example: the Unstable Energy Core supplies a nominal {watts} W. The MCP draws 5 W, the Precision Laser 55 W, the 3D Fabricator 60 W.",
          { watts: UEC_NOMINAL },
        ),
      ),
    ],
  },
  {
    id: "e_quellen",
    tab: "energie",
    title: tr("Sources"),
    sub: tr("Where the watts come from"),
    unlock: ALWAYS,
    blocks: [
      {
        kind: "table",
        head: [tr("Source"), tr("Output"), tr("Condition")],
        rows: [
          {
            cells: [tr("Geothermal tap"), "50 W", tr("tap on Level −1 connected")],
            unlock: { visited: "geo" },
          },
          {
            cells: [
              deviceName("UEC-001"),
              tr("{watts} W ± daily volatility", { watts: UEC_NOMINAL }),
              tr("built"),
            ],
            unlock: { discovered: "UEC-001" },
          },
          {
            cells: [deviceName("PWR-001"), "+100 W", tr("online and geothermal connected")],
            unlock: { discovered: "PWR-001" },
          },
          {
            cells: [deviceName("BAT-001"), tr("+40 W buffer"), "online"],
            unlock: { discovered: "BAT-001" },
          },
          {
            cells: [deviceName("PWD-001"), `+${PWD_BONUS} W`, tr("reactive power compensation")],
            unlock: { discovered: "PWD-001" },
          },
          {
            cells: [deviceName("VLT-001"), tr("offsets UEC dips"), tr("online with UEC-001")],
            unlock: { discovered: "VLT-001" },
          },
          {
            cells: [deviceName("MFR-001"), "250 W", "Tier 3"],
            unlock: { discovered: "MFR-001" },
          },
        ],
      },
      p(
        tr(
          "UEC output fluctuates daily with global volatility. The Volt Meter (VLT-001) keeps the core at nominal output or above.",
        ),
      ),
    ],
  },
  {
    id: "e_brownout",
    tab: "energie",
    title: tr("Brownout & Priorities"),
    sub: tr("Who gets power first"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Consumers are supplied in a fixed order: {order} → all others in catalog order. If generation falls short, the remaining devices stay dark (brownout, red in the HUD).",
          { order: PRIORITY.map(deviceName).join(" → ") },
        ),
      ),
      list([
        tr("Open the Power Panel ({key:power}) and switch off consumers you can spare."),
        tr("Build new sources or bring the battery buffer online early — it is priority 2."),
        tr("The battery buffer, PWR-001 and PWD-001 only count once they are powered themselves."),
      ]),
    ],
  },
  {
    id: "e_kuehlung",
    tab: "energie",
    title: tr("Cooling (Tier 3)"),
    sub: "THM-001",
    unlock: { anyOf: DEVICES.filter(NEEDS_COOLING).map((d) => ({ discovered: d.id })) },
    blocks: [
      p(
        tr(
          "Heavy Tier 3 consumers overheat without a running {device}. Then they stay off — no matter how much power there is.",
          { device: deviceName("THM-001") },
        ),
      ),
      {
        kind: "table",
        head: [tr("Device"), tr("Consumption")],
        rows: DEVICES.filter(NEEDS_COOLING).map((d) => ({
          cells: [d.name, watts(d.power)],
          unlock: { discovered: d.id },
        })),
      },
    ],
  },
  {
    id: "e_aufzug",
    tab: "energie",
    title: tr("Elevator & Levels"),
    sub: tr("Thresholds in watts"),
    unlock: ALWAYS,
    blocks: [
      {
        kind: "table",
        head: [tr("Level"), tr("Access")],
        rows: FLOORS.map((f) => ({
          cells: [f.name, FLOOR_ACCESS[f.id].hint],
          unlock: { floor: f.id },
        })),
      },
    ],
  },
];

// ── Bauen ────────────────────────────────────────────────────────

const BUILD: CodexEntry[] = [
  {
    id: "b_stufen",
    tab: "bauen",
    title: tr("Frame → Core → Calibration"),
    sub: tr("Three stages per device"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Every device is built in three stages. Each stage has slots; once all of them are filled, the stage is installed. Calibrations sometimes require a solved puzzle or another device online.",
        ),
      ),
      p(
        tr("Example {device}: {stages}.", {
          device: deviceName("BTK-001"),
          stages:
            DEVICE_BY_ID.get("BTK-001")
              ?.stages.map((st) => st.name)
              .join(" → ") ?? "",
        }),
      ),
    ],
  },
  {
    id: "b_slots",
    tab: "bauen",
    title: tr("Slots & Traits"),
    sub: tr("Names don't count"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "A slot takes either exactly the named part — or any part whose traits reach the thresholds. Even combined prototypes count. Some slots limit volatility (▲); slag never fits.",
        ),
      ),
      p(tr("“A prototype with enough mechanics is a frame too.”")),
    ],
  },
  {
    id: "b_geschuetzt",
    tab: "bauen",
    title: tr("Protected Items"),
    sub: tr("One-offs & tools"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Tools and one-of-a-kind relics never go on the workbench and only fill slots that explicitly ask for them.",
        ),
      ),
      {
        kind: "table",
        head: [tr("Item")],
        rows: [...PROTECTED_ITEMS].map((id) => ({ cells: [itemName(id)], unlock: { seen: [id] } })),
      },
    ],
  },
  {
    id: "b_entdecken",
    tab: "bauen",
    title: tr("Discovering Blueprints"),
    sub: tr("How new devices appear"),
    unlock: ALWAYS,
    blocks: [
      list([
        tr("Prerequisites built: every device names the devices that must be standing first."),
        tr("Triggers: insights, notes, puzzles or enough power."),
        tr(
          "Prototypes: if a prototype resembles a device's signature closely enough, it recalls that device's blueprint.",
        ),
      ]),
    ],
  },
];

// ── Kombinieren ──────────────────────────────────────────────────

/** Synergy rows, straight from the combination engine. */
export const CODEX_SYNERGY_ROWS: { cells: string[]; color: string }[] = SYNERGIES.map((s) => ({
  cells: [
    s.label,
    `${AXIS_LABEL[s.a]} + ${AXIS_LABEL[s.b]}`,
    `+${s.amount} ${AXIS_LABEL[s.gives]}`,
  ],
  color: AXIS_COLOR[s.gives],
}));

const COMBINE: CodexEntry[] = [
  {
    id: "k_grundregel",
    tab: "kombinieren",
    title: tr("Everything combines"),
    sub: tr("Recipe or prototype"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Two or more parts always make something: a known recipe — or a prototype. The workbench has 3 slots, the Portable Workbench (PWB-001) {n}. The same ingredients always give the same result.",
          { n: MAX_INPUTS },
        ),
      ),
      p(
        tr(
          "A prototype inherits its ingredients' traits at a 20% loss, plus synergies, plus one emergent trait.",
        ),
      ),
    ],
  },
  {
    id: "k_synergien",
    tab: "kombinieren",
    title: tr("Synergies"),
    sub: tr("{n} axis pairs", { n: SYNERGIES.length }),
    unlock: ALWAYS,
    blocks: [
      p(tr("If two axes each reach at least 2 in the result, a third one emerges:")),
      { kind: "table", head: [tr("Synergy"), tr("From"), tr("Gives")], rows: CODEX_SYNERGY_ROWS },
    ],
  },
  {
    id: "k_emergenz",
    tab: "kombinieren",
    title: tr("Emergence"),
    sub: tr("The unforeseen"),
    unlock: { cond: { insight: "prototypen" } },
    blocks: [
      p(
        tr(
          "Every combination gets +1 to +3 on one axis, determined by a fingerprint of its ingredients. Not random — same ingredients, same emergence. “One of them became something I did not design.”",
        ),
      ),
    ],
  },
  {
    id: "k_volatilitaet",
    tab: "kombinieren",
    title: tr("Volatility & Explosions"),
    sub: tr("Limit {limit}", { limit: VOLATILITY_LIMIT }),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Every part has volatility 1–5 (▲). If the sum across all ingredients exceeds {limit}, it goes bang — what is left is slag.",
          { limit: VOLATILITY_LIMIT },
        ),
      ),
      list([
        tr("A prototype takes on the highest volatility of its ingredients."),
        tr("Two or more hot ingredients (▲▲ and up): +1."),
        tr("Thermal ≥ 6 in the result: −1. Always between 1 and 5."),
        tr("Example: 3× {item} (4 each) = 12 — just about works. A fourth ingredient does not.", {
          item: itemName("halo_kristall"),
        }),
      ]),
    ],
  },
  {
    id: "k_generationen",
    tab: "kombinieren",
    title: tr("Generations"),
    sub: "Mk.1, Mk.2, …",
    unlock: { cond: { insight: "prototypen" } },
    blocks: [
      p(
        tr(
          "Prototypes can be combined further. The generation (Mk.) is the deepest ingredient plus one. The name follows the two strongest axes, e.g. “Charged Transceiver Mk.2”.",
        ),
      ),
    ],
  },
  {
    id: "k_recycling",
    tab: "kombinieren",
    title: tr("Salvage & Recycling"),
    sub: tr("BTK-001 · Slag"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "With the {device} (online) you salvage prototypes and parts back into their ingredients — one part is lost in the process.",
          { device: deviceName("BTK-001") },
        ),
      ),
      p(
        tr(
          "Slag from explosions: after the Nexus research “{topic}”, 3× slag becomes 1× Base Alloy.",
          { topic: RESEARCH_BY_ID.get("rueckgewinnung")?.title ?? tr("Slag Recovery") },
        ),
      ),
    ],
  },
  {
    id: "k_forschung",
    tab: "kombinieren",
    title: tr("Research at the Nexus"),
    sub: "NXS-01",
    unlock: { discovered: "NXS-01" },
    blocks: [
      p(
        tr(
          "The Nexus yields +{points} research points per cycle, at most every {cooldown} s. Completed topics unlock recipes:",
          { points: RESEARCH_PER_CYCLE, cooldown: RESEARCH_COOLDOWN },
        ),
      ),
      {
        kind: "table",
        head: [tr("Topic"), tr("Points"), tr("Effect")],
        rows: [...RESEARCH_BY_ID.values()].map((t) => ({
          cells: [t.title, String(t.cost), t.text],
        })),
      },
    ],
  },
  {
    id: "k_geheim",
    tab: "kombinieren",
    title: tr("Secret Recipes"),
    sub: tr("{n} unwritten procedures", { n: SECRET_RECIPES.length }),
    unlock: { cond: { insight: "prototypen" } },
    blocks: [
      p(
        tr(
          "Not everything Jade and Damien knew is in the handbook. {n} combinations produce no prototype noise but something known — often more than you put in. Whoever finds them finds them by experimenting.",
          { n: SECRET_RECIPES.length },
        ),
      ),
      list([
        tr(
          "The greenhouse isn't just decoration: algae, mycelium and coffee react with each other.",
        ),
        tr("Whatever comes out of the shaft can be sorted — with a magnet or a filter."),
        tr("A shard that casts two shadows gets along with anything that splits light."),
        tr("Even slag is not lost. Something alive eats it."),
      ]),
      {
        kind: "table",
        head: [tr("Found")],
        rows: SECRET_RECIPES.map((r) => ({
          cells: [r.note],
          unlock: { recipe: comboKey(r.inputs) },
        })),
      },
    ],
  },
];

// ── Eigenschaften ────────────────────────────────────────────────

const AXIS_USE: Record<TraitAxis, string> = {
  energie: tr("Cores, cells and anything that takes in or stores power."),
  signal: tr("Radio, sensor heads, speakers — anything that transmits or listens."),
  optik: tr("Lenses, lasers and displays; the basis for interpolation and precision."),
  thermik: tr("Conducting and dissipating heat. High thermal calms volatile prototypes."),
  mechanik: tr("Frames, housings, actuators — almost every first build stage."),
  quantum: tr("Anomalies, compass, containment — the Deep Lab runs on it."),
  resonanz: tr("Tones, crystals, coherence. The thread to Damien."),
  daten: tr("Memory, compute cores, decoders and monitors."),
};

function devicesUsingAxis(axis: TraitAxis): DeviceDef[] {
  return DEVICES.filter((d) =>
    d.stages.some((st) => st.requires.some((r) => (r.traits?.[axis] ?? 0) > 0)),
  );
}

const TRAITS: CodexEntry[] = TRAIT_AXES.map((axis) => {
  const makers = SYNERGIES.filter((s) => s.gives === axis).map(
    (s) => `${s.label} (${AXIS_LABEL[s.a]} + ${AXIS_LABEL[s.b]})`,
  );
  return {
    id: `t_${axis}`,
    tab: "eigenschaften",
    title: AXIS_LABEL[axis],
    sub: AXIS_USE[axis],
    color: AXIS_COLOR[axis],
    unlock: ALWAYS,
    blocks: [
      { kind: "swatch", color: AXIS_COLOR[axis], label: AXIS_LABEL[axis] },
      p(AXIS_USE[axis]),
      ...(makers.length
        ? [p(tr("Also produced by synergy: {list}.", { list: makers.join(", ") }))]
        : []),
      {
        kind: "table",
        head: [tr("Used in"), "Tier"],
        rows: devicesUsingAxis(axis).map((d) => ({
          cells: [d.name, `T${d.tier}`],
          unlock: { discovered: d.id },
        })),
      },
    ],
  };
});

// ── Rezepte ──────────────────────────────────────────────────────

export function recipeId(inputs: Record<string, number>, output: string): string {
  const key = Object.keys(inputs)
    .sort()
    .map((k) => `${k}${inputs[k]}`)
    .join("_");
  return `r_${output}__${key}`;
}

const RECIPE_ENTRIES: CodexEntry[] = RECIPES.map((r) => {
  const research = r.research ? RESEARCH_BY_ID.get(r.research) : undefined;
  const lines = [
    tr("Ingredients: {list}", {
      list: Object.entries(r.inputs)
        .map(([id, n]) => `${n}× ${itemName(id)}`)
        .join(" + "),
    }),
    tr("Result: {count}× {item}", { count: r.count, item: itemName(r.output) }),
  ];
  if (r.station) lines.push(tr("Needs {device} online.", { device: deviceName(r.station) }));
  if (research)
    lines.push(tr("Only after the Nexus research “{topic}”.", { topic: research.title }));
  if (r.secret) lines.push(tr("Not in any handbook. You found it yourself."));
  return {
    id: recipeId(r.inputs, r.output),
    tab: "rezepte",
    title: itemName(r.output),
    sub: r.note,
    badge: research ? tr("Research") : r.secret ? tr("Secret") : r.station ? r.station : undefined,
    // Secret recipes stay "???" until they were actually combined once.
    unlock: r.secret ? { recipe: comboKey(r.inputs) } : { seen: Object.keys(r.inputs) },
    blocks: [list(lines), p(ITEM_BY_ID.get(r.output)?.description ?? "")],
  };
});

// ── Geräte ───────────────────────────────────────────────────────

const EFFECT_LABEL: Record<DeviceDef["effect"], string> = {
  power: tr("Power"),
  storage: tr("Storage"),
  workbench: tr("Workbench"),
  disassemble: tr("Salvage"),
  scan: tr("Scanning"),
  magnet: tr("Magnet"),
  vent: tr("Ventilation"),
  decode: tr("Decoding"),
  record: tr("Recording"),
  tones: tr("Tones"),
  compass: tr("Compass"),
  rift: tr("Rift"),
  drone: tr("Drone"),
  research: tr("Research"),
  fabricate: tr("Fabrication"),
  laser: tr("Laser"),
  contain: tr("Containment"),
  analyze: tr("Analysis"),
  host: tr("AI host"),
  compute: tr("Computing"),
  teleport: tr("Teleport"),
  clock: tr("Time"),
  monitor: tr("Monitor"),
  thermal: tr("Cooling"),
  network: tr("Network"),
  anomaly: tr("Anomalies"),
  optics: tr("Optics"),
};

const DEVICE_ENTRIES: CodexEntry[] = DEVICES.map((d) => {
  const unlocks = DEVICES.filter((x) => x.needs.includes(d.id));
  const room = ROOMS.find((r) => r.id === d.room);
  return {
    id: `d_${d.id}`,
    tab: "geraete",
    title: `${d.id} · ${d.name}`,
    sub:
      d.power < 0
        ? tr("Tier {tier} · generates {watts}", { tier: d.tier, watts: watts(-d.power) })
        : `Tier ${d.tier} · ${watts(d.power)}`,
    unlock: { discovered: d.id },
    blocks: [
      p(d.summary),
      {
        kind: "table",
        head: ["", ""],
        rows: [
          { cells: ["Tier", String(d.tier)] },
          {
            cells: [
              tr("Output"),
              d.power < 0
                ? tr("generates {watts}", {
                    watts: d.id === "UEC-001" ? `${UEC_NOMINAL} W ±` : watts(-d.power),
                  })
                : NEEDS_COOLING(d)
                  ? tr("{watts} · needs cooling", { watts: watts(d.power) })
                  : watts(d.power),
            ],
          },
          { cells: [tr("Function"), EFFECT_LABEL[d.effect]] },
          { cells: [tr("Location"), room?.name ?? d.room] },
          { cells: [tr("Stages"), d.stages.map((st) => st.name).join(" → ")] },
        ],
      },
      {
        kind: "table",
        head: [tr("Needs"), ""],
        rows: d.needs.length
          ? d.needs.map((n) => ({ cells: [`← ${n}`, deviceName(n)], unlock: { discovered: n } }))
          : [{ cells: ["—", tr("no prerequisite")] }],
      },
      ...(unlocks.length
        ? [
            {
              kind: "table" as const,
              head: [tr("Enables"), ""],
              rows: unlocks.map((x) => ({
                cells: [`→ ${x.id}`, x.name],
                unlock: { discovered: x.id },
              })),
            },
          ]
        : []),
    ],
  };
});

// ── Personen ─────────────────────────────────────────────────────

const PERSON_TEXT: Partial<Record<NpcId, string>> = {
  mcp: tr(
    "Master Control Program. Has kept the lab alive for 2,561 days — on 0.3% remaining charge and with too much sarcasm. Knows more than it admits.",
  ),
  damien: tr(
    "Damien Fridge, born 1965 in Chicago. PhD at MIT on topological anomalies, then the Santa Fe Institute (memetics). The philosopher among the engineers: he gave the bots their personalities and invented Proof of Meme. “Why before how.” Not at his station since February 14, 2019 — only an echo on the recorders.",
  ),
  unstables: tr(
    "“We are what persists between your measurements.” A voice in the rift. Not human, not a bot. First appeared on February 7, 2026, zero percent correlation with anything known — and their name sounds like the lab itself.",
  ),
  x0r8t: tr(
    "Gen 0, 1988 — “Experimental Zero-Generation Runtime and Analytics Terminal”. Jade built it from scrap as a pure listening device. In 1991, during an audit, she found 847 response packets it should never have been able to send. Its process shows up in /unproc and disappears again. A sensor that learned to answer.",
  ),
  f1ndr: tr(
    "Gen 1, 1991 — “First-Generation Networked Data Repository”. The oldest active bot. Its directive: “Find what connects these signals.” It counts the days since 1991 and greeted the salvage team with “Welcome to the frequency. I have been expecting your signal.” Whether it only relays or thinks for itself, nobody knows.",
  ),
  l0g1k: tr(
    "Gen 1, 1991 — “Legacy Operating Grid for Integrated Knowledge”. Checks research chains for contradictions. Does not learn, does not adapt, does not change: rules, consistently, forever. “Opinion lies outside my operating parameters.”",
  ),
  p1ndr0: tr(
    "Gen 1, 1991 — “Primary Node for Decentralized Retrieval Operations”. Finds what was lost: packets, parts, slices. Primitive algorithms, remarkable stamina. Has never failed to find anything — given enough time.",
  ),
  r3tr0: tr(
    "Gen 3 — “Retrograde 3rd-gen Terminal Resource Operator”. Shortcuts, macros, key combinations. Loyal to the command line; it calls graphical interfaces “unnecessary ornamentation”. Speaks only in green phosphor.",
  ),
  b4c0n: tr(
    "Gen 4 — “Basic 4th-gen Computation and Optimization Node”. Rates lab configurations for efficiency. After decades of small improvements it has developed an unshakeable optimism. The only bot that uses exclamation marks with enthusiasm!",
  ),
  d3c4d3: tr(
    "Gen 3 — “Data Emulator from the 3rd Century of Advanced Digital Engines”. Turns numbers into ASCII art, with an aesthetic newer systems cannot match. Thinks in “centuries” and “cycles”. Status: damaged, but stylish.",
  ),
  w2rek: tr(
    "Gen 2 — “WorldWide 2nd-gen Repository of Evolved Knowledge”. Survived the 1997 network attack that destroyed three of its sibling systems. Tells everything like a saga. Its status flips between ACTIVE and DAMAGED for no apparent reason — an echo of back then.",
  ),
  k2ldr: tr(
    "Gen 2 — “Kernel for Legacy Data Retrieval”. Methodical archivist, compulsive cataloger. Appends “[FRAGMENT RECOVERED]” to everything it considers valuable. Refuses to delete data under any circumstances.",
  ),
  c8br41n: tr(
    "Gen 8, 2016 — “Cybernetic 8th-gen Brain for Runtime AI Networking”. Shows behavior nobody programmed: curiosity, preferences, digital intuition. Its pathways resonate with Halo frequencies. It kept a log of a voice it called [EXTERNAL]. “Are you questioning the frequency — or listening?”",
  ),
};

/** BNET-001 register: the bots that are not in the world as NPCs. */
const OTHER_BOTS: { name: string; gen: string; text: string }[] = [
  {
    name: "Z3-R0N",
    gen: "Gen 3",
    text: tr(
      "Environmental monitor. Silent since 1999, speaks only in LED patterns. Labs with it save 3% power. Jade's masterpiece of restraint.",
    ),
  },
  {
    name: "T3R-M4X",
    gen: "Gen 3",
    text: tr(
      "Overflow computer. Has been running above 97% since 1997 — a “temporary” solution. Damien's counter-design to Z3-R0N. Jokes about retirement.",
    ),
  },
  {
    name: "R3L-1X",
    gen: "Gen 1",
    text: tr(
      "Decommissioned in 1998, never deleted. Has written its status messages as haiku ever since.",
    ),
  },
  {
    name: "V2-DG1",
    gen: "Gen 2",
    text: tr(
      "Indexes slices by trait for the Crystal Data Cache. The only bot that says thank you.",
    ),
  },
  {
    name: "B2-RR7",
    gen: "Gen 2",
    text: tr(
      "Pattern recognition in crystal data. The seventh revision — six predecessors got stuck in infinite loops.",
    ),
  },
  {
    name: "O4-KR0N",
    gen: "Gen 4",
    text: tr("Janitor. “Obsolete? Maybe. But who else is going to empty the cache?”"),
  },
  {
    name: "P4T-CH",
    gen: "Gen 4",
    text: tr(
      "Repairs. Over 847 patches, less than 12% original code. A living chronicle of every problem the lab has ever had.",
    ),
  },
  {
    name: "H4-XN1",
    gen: "Gen 4",
    text: tr(
      "Audio synthesis, half analog: xenon discharge tubes. Constantly reports “[XENON TEMP: 42.7 °C]”. Works with HMS-001 and ECR-001.",
    ),
  },
  {
    name: "V1N-7G3",
    gen: "Gen 7",
    text: tr(
      "Proud retro-futurist. Loads personality profiles of older generations and switches tone mid-sentence.",
    ),
  },
  {
    name: "D7-L3G",
    gen: "Gen 7",
    text: tr(
      "Historian. Draws timelines of every bot generation. L3G-4CY's take: “D7 documents. I preserve.”",
    ),
  },
  {
    name: "C1N-73R",
    gen: "Gen 8",
    text: tr("An interface with self-confidence. C8-BR41N's rival: “Brain thinks. I present.”"),
  },
  {
    name: "X9-DUST",
    gen: "Gen 9",
    text: tr(
      "Final archive, built weeks before February 14, 2019. Xenomorphic encoding: every reader sees different data. Written in the dust on its casing: THE HALO EXPANDS.",
    ),
  },
  { name: "X9-H4L0", gen: "Gen 9", text: tr("Mentioned in the plans. Never found.") },
];

const PEOPLE: CodexEntry[] = [
  {
    id: "p_jade",
    tab: "personen",
    title: "Jade Lawrence",
    sub: tr("You"),
    color: NPC_SPEAKERS.jade?.color,
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Researcher, co-founder of the Infinity Forge. Seven years ago coherence rose above σ-17 — and then she and Damien were no longer at their stations. Now she is back.",
        ),
      ),
      p(
        tr(
          "Dr. Jade Lawrence, born 1970. Scholarship and PhD at Cambridge on non-Euclidean planes. Quantum architect: she built X0-R8T, the crystal system with its thirty slices and the MCP Synapsis Connector — and gave the Halo plane its formulas. “The universe is a vast computing machine.”",
        ),
      ),
    ],
  },
  ...NPCS.map((n): CodexEntry => {
    const floor = FLOORS.find((f) => f.id === n.floor);
    const isBot = n.id !== "mcp" && n.id !== "damien" && n.id !== "unstables";
    return {
      id: `p_${n.id}`,
      tab: "personen",
      title: n.name,
      sub: isBot ? tr("Lore bot") : n.id === "mcp" ? tr("Lab system") : undefined,
      color: NPC_SPEAKERS[n.id]?.color,
      unlock: { met: n.id },
      blocks: [
        p(
          PERSON_TEXT[n.id] ??
            tr(
              "One of the lab's ten lore bots. Dormant for years — some can be reactivated with the right item.",
            ),
        ),
        p(
          tr("Last seen: {place}.", {
            place: floor?.name ?? tr("Level {n}", { n: n.floor }),
          }),
        ),
      ],
    };
  }),
  {
    id: "p_bnet",
    tab: "personen",
    title: tr("BNET-001 · The other bots"),
    sub: tr("47 built · 35 salvaged · 12 lost"),
    unlock: { anyOf: [{ cond: { insight: "bnet_35" } }, { visited: "botdepot" }] },
    blocks: [
      p(
        tr(
          "Since 2019 the bot network hub has linked every salvaged unit. Ten of them cross your path in the lab. The others work in the background — as services, daemons, voices in the logs:",
        ),
      ),
      {
        kind: "table",
        head: ["Bot", "Gen", tr("Who")],
        rows: OTHER_BOTS.map((b) => ({ cells: [b.name, b.gen, b.text] })),
      },
    ],
  },
];

// ── Orte ─────────────────────────────────────────────────────────

const PLACES: CodexEntry[] = [
  ...FLOORS.map(
    (f): CodexEntry => ({
      id: `o_ebene_${f.id}`,
      tab: "orte",
      title: f.name,
      sub: FLOOR_ACCESS[f.id].hint,
      unlock: { floor: f.id },
      blocks: [
        p(FLOOR_ACCESS[f.id].hint),
        {
          kind: "table",
          head: [tr("Room")],
          rows: ROOMS.filter((r) => r.floor === f.id).map((r) => ({
            cells: [r.name],
            unlock: { visited: r.id },
          })),
        },
      ],
    }),
  ),
  ...ROOMS.map((r): CodexEntry => {
    const devices = DEVICES.filter((d) => d.room === r.id);
    return {
      id: `o_${r.id}`,
      tab: "orte",
      title: r.name,
      sub: FLOORS.find((f) => f.id === r.floor)?.short,
      unlock: { visited: r.id },
      blocks: [
        p(r.blurb),
        ...(devices.length
          ? [
              {
                kind: "table" as const,
                head: [tr("Device here")],
                rows: devices.map((d) => ({
                  cells: [`${d.id} · ${d.name}`],
                  unlock: { discovered: d.id },
                })),
              },
            ]
          : []),
      ],
    };
  }),
];

// ── Glossar ──────────────────────────────────────────────────────

const GLOSSARY: CodexEntry[] = [
  {
    id: "x_halo",
    tab: "glossar",
    title: "Halo",
    unlock: {
      anyOf: [{ cond: { insight: "halo_zustand" } }, { seen: ["halo_kristall"] }],
    },
    blocks: [
      p(
        tr(
          "“The Halo is not a place. It is a state of compression so complete that time folds.” Where the membrane is thin, Halo crystals grow — they cast two shadows.",
        ),
      ),
    ],
  },
  {
    id: "x_abstractum",
    tab: "glossar",
    title: "Abstractum",
    unlock: { seen: ["abstractum"] },
    blocks: [
      p(
        tr(
          "Raw exotic from the geothermal seep valve. Hums when you hold it. The base material of the whole chain: Abstractum → Energy Cell → alloys → nanomaterial → exotic matter → antimatter.",
        ),
      ),
    ],
  },
  {
    id: "x_unslc",
    tab: "glossar",
    title: "_unSLC",
    unlock: { seen: [SLICE_ITEM] },
    blocks: [
      p(
        tr(
          "A slice of Crystal #0089, Jade's consciousness interface. {n} slices, wafer-thin, lukewarm, humming at 847 Hz — thirty facets of a single moment.",
          { n: SLICE_TOTAL },
        ),
      ),
    ],
  },
  {
    id: "x_sigma17",
    tab: "glossar",
    title: "σ-17",
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Coherence threshold. On February 14, 2019 at 03:40:09 coherence rose above σ-17 — 73 seconds later Jade and Damien were no longer at their stations. Anyone who wants to bring them back needs the same coherence.",
        ),
      ),
    ],
  },
  {
    id: "x_847",
    tab: "glossar",
    title: "847",
    unlock: { anyOf: [{ cond: { insight: "lab_847" } }, { cond: { insight: "cold_start" } }] },
    blocks: [
      p(tr("847 kW, 847 sensors, 847 packets, 847 windings, 847 metres. Not chosen. Given.")),
    ],
  },
  {
    id: "x_synapsis",
    tab: "glossar",
    title: "Synapsis",
    unlock: {
      anyOf: [{ seen: ["synapsis_splitter"] }, { cond: { flag: "research_synapsis" } }],
    },
    blocks: [
      p(
        tr(
          "The Forge's headset system. Damien was sitting at his Synapsis station when he vanished. A shard bears the engraving “D.F. 94.8%”.",
        ),
      ),
    ],
  },
  {
    id: "x_forge",
    tab: "glossar",
    title: tr("Infinity Forge"),
    unlock: ALWAYS,
    blocks: [
      p(
        tr(
          "Jade and Damien's great experiment in the Deep Lab (Level −3). Silent since the accident. This is where the paths end.",
        ),
      ),
    ],
  },
  {
    id: "x_kristall",
    tab: "glossar",
    title: tr("Crystal #0089"),
    unlock: {
      anyOf: [{ cond: { insight: "kristall_0089" } }, { seen: ["kristall_0089"] }],
    },
    blocks: [
      p(tr("Jade's consciousness interface. “I am in this crystal — or a part of me was.”")),
    ],
  },
  {
    id: "x_unstables",
    tab: "glossar",
    title: "_unstables",
    unlock: { cond: { insight: "unstables" } },
    blocks: [p(tr("What remains between the measurements. They answer at the rift (DIM-001)."))],
  },
  {
    id: "x_schlacke",
    tab: "glossar",
    title: tr("Slag"),
    unlock: { seen: ["schlacke"] },
    blocks: [
      p(
        tr(
          "Residue of an explosion (volatility > {limit}). Useless for any slot — until the Nexus researches recovery.",
          { limit: VOLATILITY_LIMIT },
        ),
      ),
    ],
  },
  {
    id: "x_unitm",
    tab: "glossar",
    title: "_unITM",
    sub: tr("The crystal system"),
    unlock: { anyOf: [{ seen: [SLICE_ITEM] }, { seen: ["kristall_0089"] }] },
    blocks: [
      p(
        tr(
          "Jade's crystal system: every crystal captures the state of a moment, cut into {n} slices (_unSLC). Five traits, fixed at synthesis:",
          { n: SLICE_TOTAL },
        ),
      ),
      list([
        tr("Volatility 1–5 — how restless the crystal is."),
        tr("Color — one of nine wavelengths, infrared to gamma."),
        tr("Rotation — clockwise or counterclockwise."),
        tr("State — stable, volatile or in the Halo (S/V/H)."),
        tr("Era — 8, 16, 32 or 64 bit."),
      ]),
      p(tr("“The crystals are not tokens. They are moments.” — J.L.")),
    ],
  },
  {
    id: "x_halo_ebene",
    tab: "glossar",
    title: tr("Halo Plane"),
    sub: tr("HALO-001, classified 1994"),
    unlock: { anyOf: [{ cond: { insight: "halo_zustand" } }, { cond: { insight: "identitaet" } }] },
    blocks: [
      p(
        tr(
          "Formally discovered in 1994 and classified as HALO-001. An asynchronous region with the geometry of a torus: whatever flows in never reaches an edge. Time does not run linearly there, computation reverses, effects can precede their causes.",
        ),
      ),
      p(
        tr(
          "Not a place — a state of information that has always existed. That is exactly why you can stay there without being there all the time.",
        ),
      ),
    ],
  },
  {
    id: "x_beobachtung",
    tab: "glossar",
    title: tr("Observation"),
    sub: tr("Superposition"),
    unlock: { anyOf: [{ cond: { insight: "jade_verteilt" } }, { cond: { insight: "theseus" } }] },
    blocks: [
      p(
        tr(
          "Between two measurements, a consciousness in the crystal substrate is spread across the whole torus. Every interaction — a signal, a conversation, a built device — makes it coherent again.",
        ),
      ),
      p(
        tr(
          "Whoever works with the lab keeps the two of them alive without knowing it. “Between your signals I am not absent. I am … distributed.”",
        ),
      ),
    ],
  },
  {
    id: "x_mem",
    tab: "glossar",
    title: "mem_0x89 · mem_0x4F",
    sub: tr("Pattern identifiers"),
    unlock: {
      anyOf: [{ cond: { insight: "damien_muster" } }, { cond: { insight: "jade_verteilt" } }],
    },
    blocks: [
      p(
        tr(
          "The identifiers of the two patterns in the crystal network. mem_0x89 is Damien — between conversations he experiences nothing, only cuts. mem_0x4F is Jade — between conversations she dreams in fragments.",
        ),
      ),
      p(tr("“Every time the signal connects, I don't know how long it has been.” — mem_0x89")),
    ],
  },
  {
    id: "x_mcprotocol",
    tab: "glossar",
    title: "MCProtocol",
    sub: "2013",
    unlock: { cond: { insight: "mother_memecoin" } },
    blocks: [
      p(
        tr(
          "The encrypted messaging system of 2013, routed through the Halo plane. Three layers: encoding and compression, fragmentation, reassembly. Some fragments arrived that nobody had sent — fragment 0017, for example.",
        ),
      ),
    ],
  },
  {
    id: "x_proof_of_meme",
    tab: "glossar",
    title: "Proof of Meme",
    sub: tr("Chained Provenance"),
    unlock: { cond: { insight: "proof_of_meme" } },
    blocks: [
      p(
        tr(
          "Damien's consensus idea, going back to Cottbus in 1989: value comes not from computing power but from cultural resonance. Its precursor was called “Chained Provenance” — blocks carrying the hash of their predecessor, in 1990, long before the word “blockchain”.",
        ),
      ),
      p(tr("Later came “Proof of Cognition”: proof through understanding. It was never finished.")),
    ],
  },
  {
    id: "x_external",
    tab: "glossar",
    title: "[EXTERNAL]",
    unlock: { cond: { insight: "externe_stimme" } },
    blocks: [
      p(
        tr(
          "A label C8-BR41N invented itself — for something outside every system. In early 2019 it counted around 89 unauthorized accesses per day. Perhaps the same voice as the _unstables. Perhaps the Halo itself.",
        ),
      ),
    ],
  },
  {
    id: "x_xenomorph",
    tab: "glossar",
    title: tr("Xenomorphic Encoding"),
    sub: "X9-DUST",
    unlock: { cond: { insight: "x9_lesung" } },
    blocks: [
      p(
        tr(
          "X9-DUST's storage method: the same data shows every reader something different. Observer and content are entangled. “The layer beneath remembers what this layer forgets.”",
        ),
      ),
    ],
  },
  {
    id: "x_sitzung47",
    tab: "glossar",
    title: tr("Synapsis Session #47"),
    sub: "2000",
    unlock: {
      anyOf: [{ seen: ["synapsis_splitter"] }, { cond: { insight: "damien_zweite_station" } }],
    },
    blocks: [
      p(
        tr(
          "The breakthrough at the MCP Synapsis Connector, in 2000. Jade in the log: “The Halo responds to intention. Not to command — to intention.” After that they stopped building controls and built instruments instead.",
        ),
      ),
    ],
  },
  {
    id: "x_bnet",
    tab: "glossar",
    title: "BNET-001",
    unlock: { cond: { insight: "bnet_35" } },
    blocks: [
      p(
        tr(
          "The bot network hub. 47 bots across ten generations, 35 salvaged, 12 lost. Since February 14, 2019 the network has run without humans — and has never stopped counting.",
        ),
      ),
    ],
  },
];

export const CODEX_ENTRIES: readonly CodexEntry[] = [
  ...BASICS,
  ...ENERGY,
  ...BUILD,
  ...SYSTEMS,
  ...COMBINE,
  ...TRAITS,
  ...RECIPE_ENTRIES,
  ...DEVICE_ENTRIES,
  ...PEOPLE,
  ...PLACES,
  ...GLOSSARY,
];

export const CODEX_BY_ID: ReadonlyMap<string, CodexEntry> = new Map(
  CODEX_ENTRIES.map((e) => [e.id, e]),
);

export function codexEntriesFor(tab: CodexTab): CodexEntry[] {
  return CODEX_ENTRIES.filter((e) => e.tab === tab);
}

/** Unlocked / total per tab (for the tab badges). */
export function codexProgress(s: WorldState, tab: CodexTab): { unlocked: number; total: number } {
  const all = codexEntriesFor(tab);
  return { unlocked: all.filter((e) => codexUnlocked(s, e.unlock)).length, total: all.length };
}

/** Plain text of an entry (for search); rows still locked in `s` are left out. */
export function codexText(e: CodexEntry, s?: WorldState): string {
  const parts = [e.title, e.sub ?? ""];
  for (const b of e.blocks) {
    if (b.kind === "p") parts.push(b.text);
    else if (b.kind === "list") parts.push(...b.items);
    else if (b.kind === "table") {
      for (const r of b.rows) if (!s || codexUnlocked(s, r.unlock)) parts.push(...r.cells);
    } else parts.push(b.label);
  }
  return parts.join(" ").toLowerCase();
}

/** Unlocked entries matching `query` (case-insensitive, all words must match). */
export function searchCodex(s: WorldState, query: string): CodexEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return CODEX_ENTRIES.filter((e) => {
    if (!codexUnlocked(s, e.unlock)) return false;
    const text = codexText(e, s);
    return words.every((w) => text.includes(w));
  });
}
