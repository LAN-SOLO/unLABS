/**
 * Lab World — ambient barks.
 * ==========================
 *
 * Short one-liners the lab says on its own: the MCP's status-code sarcasm,
 * Jade's inner monologue, the lab PA system ("safety warnings that are
 * unsafe"), the reactivated lore bots, Damien's echo (only while ECR-001
 * records) and rare Halo/_unstables intrusions (only once DIM-001 exists).
 *
 * Selection lives in `lib/world/barks.ts`. Speaker gating is automatic
 * there (bots need `flags.bot_<id>_awake`, Damien needs ECR-001 online,
 * halo/unstables need DIM-001 built) — `when` is only for extra gates.
 *
 * IDs are `<group>.<n>` and are persisted (cooldown/once memory), so groups
 * are append-only: add new lines at the end of a group, never reorder.
 */
import { tr } from "@/lib/i18n";
import type { SfxName } from "@/lib/world/audio/sfx";
import type {
  Condition,
  FloorId,
  InsightDef,
  NoteDef,
  NpcId,
  PuzzleKind,
  RoomTheme,
} from "@/lib/world/types";

/** Who can bark. `pa` is the lab's PA system; `halo` is the [EXTERNAL] voice. */
export type BarkSpeaker = NpcId | "jade" | "pa" | "halo";

/** The ten lore bots (their barks need `flags.bot_<id>_awake`). */
export const BARK_BOTS = [
  "x0r8t",
  "f1ndr",
  "l0g1k",
  "p1ndr0",
  "r3tr0",
  "b4c0n",
  "d3c4d3",
  "w2rek",
  "k2ldr",
  "c8br41n",
] as const;
export type BarkBot = (typeof BARK_BOTS)[number];

export const BARK_TRIGGERS = [
  "enter_floor",
  "enter_room",
  "device_built",
  "device_online",
  "device_offline",
  "brownout",
  "overheat",
  "stage_built",
  "combine_prototype",
  "combine_explosion",
  "puzzle_solved",
  "puzzle_failed",
  "pickup_rare",
  "note_read",
  "insight",
  "idle",
  "night",
  "low_power",
  "achievement",
  "ending_reached",
  "bot_awake",
  "return_from_terminal",
  /** Periodic background chatter (PA announcements, bots talking to themselves) — fired by `tick`. */
  "ambient",
  /** A biorhythm need is low (fired by the UI, rate-limited by `bioBarkDue` in biorhythm.ts). */
  "bio_low",
] as const;
export type BarkTrigger = (typeof BARK_TRIGGERS)[number];

/**
 * Context filter: every field that is set must equal the event context's
 * field. More fields set = more specific = higher selection weight.
 */
export interface BarkMatch {
  floor?: FloorId;
  room?: string;
  theme?: RoomTheme;
  device?: string;
  tier?: 1 | 2 | 3;
  /** Puzzle kind (puzzle_solved / puzzle_failed). */
  kind?: PuzzleKind;
  /** Note author (note_read). */
  author?: NoteDef["author"];
  /** Insight thread (insight). */
  thread?: InsightDef["thread"];
  /** Bot that just woke up (bot_awake). */
  bot?: BarkBot;
  /** Ending id (ending_reached). */
  ending?: string;
  /** enter_floor / enter_room: true = first visit only, false = revisits only. */
  first?: boolean;
}

export interface BarkDef {
  id: string;
  who: BarkSpeaker;
  text: string;
  trigger: BarkTrigger;
  on?: BarkMatch;
  when?: Condition;
  /** Relative selection weight (default 1). */
  weight?: number;
  /** Say it at most once per save. */
  once?: boolean;
  /** Seconds before this exact line may repeat (default see `barks.ts`). */
  cooldown?: number;
  /** Extra sound played with the line (defaults per speaker in `barks.ts`). */
  sfx?: SfxName;
}

type Opts = Omit<BarkDef, "id" | "who" | "text" | "trigger">;
type Line = readonly [BarkSpeaker, string] | readonly [BarkSpeaker, string, Opts];

/** Build a group of barks sharing trigger + options; ids are `<prefix>.<n>`. */
function group(
  prefix: string,
  trigger: BarkTrigger,
  base: Opts,
  lines: readonly Line[],
): BarkDef[] {
  return lines.map((l, i) => {
    const extra = l[2] ?? {};
    const on = base.on || extra.on ? { ...base.on, ...extra.on } : undefined;
    const def: BarkDef = {
      ...base,
      ...extra,
      id: `${prefix}.${i + 1}`,
      who: l[0],
      text: l[1],
      trigger,
    };
    if (on) def.on = on;
    else delete def.on;
    return def;
  });
}

const first = { first: true } as const;
const again = { first: false } as const;

// ── Floors ───────────────────────────────────────────────────────

const FLOOR_BARKS: BarkDef[] = [
  ...group("floor0.first", "enter_floor", { on: { floor: 0, ...first }, once: true }, [
    [
      "mcp",
      tr(
        "Level 0, Upper Deck. Status 200. Everything here is broken, but at least it's well signposted.",
      ),
    ],
    ["jade", tr("The Upper Deck. This is where I started. It smells of ozone and cold coffee.")],
  ]),
  ...group("floor0.again", "enter_floor", { on: { floor: 0, ...again } }, [
    ["mcp", tr("Back on the Upper Deck. The coffee machine missed you. I did not.")],
    ["jade", tr("It's brighter up here. Not warmer.")],
    [
      "pa",
      tr("Attention: the Upper Deck is up. Please do not fall down, that is a different deck."),
    ],
    ["mcp", tr("Upper Deck. No new damage. Admittedly, I haven't checked.")],
  ]),
  ...group("floor1.first", "enter_floor", { on: { floor: 1, ...first }, once: true }, [
    [
      "mcp",
      tr("Level −1. Power and manufacturing. Here electricity is generated and hope consumed."),
    ],
    ["jade", tr("It hums. Under the hum: heat that has nowhere to go.")],
    [
      "pa",
      tr(
        "Welcome to Level −1. Hearing protection is mandatory. Hearing protection is out of stock.",
      ),
    ],
  ]),
  ...group("floor1.again", "enter_floor", { on: { floor: 1, ...again } }, [
    ["mcp", tr("Level −1. The machines haven't complained. That rarely means anything good.")],
    ["jade", tr("The heat here is a memory. Every watt remembers its way.")],
    ["pa", tr("Note: hot surfaces are hot. Cold surfaces are probably hot as well.")],
  ]),
  ...group("floor2.first", "enter_floor", { on: { floor: 2, ...first }, once: true }, [
    [
      "mcp",
      tr("Level −2. Signals and anomalies. Please don't touch anything that can touch back."),
    ],
    ["jade", tr("The noise is denser down here. As if someone had compressed the silence.")],
    ["pa", tr("Reminder: anomalies are not pets. Please do not name them.")],
  ]),
  ...group("floor2.again", "enter_floor", { on: { floor: 2, ...again } }, [
    ["pa", tr("Please do not lick the anomalies. They lick back.")],
    ["mcp", tr("Level −2. Readings unremarkable. Down here, that is the most remarkable thing.")],
    ["jade", tr("Every time, the noise sounds a little more like speech.")],
    ["damien", tr("[SIGNAL WEAK] …Level −2. This is where I first listened back.")],
  ]),
  ...group("floor3.first", "enter_floor", { on: { floor: 3, ...first }, once: true }, [
    [
      "mcp",
      tr(
        "Deep Lab. Authorised personnel only. You are not authorised. Congratulations, you're here anyway.",
      ),
    ],
    ["jade", tr("The Deep Lab. Damien called it “the basement with ambitions”.")],
    ["pa", tr("Pressure equalisation complete. If your ears popped: those were not your ears.")],
  ]),
  ...group("floor3.again", "enter_floor", { on: { floor: 3, ...again } }, [
    ["mcp", tr("Deep Lab. Radiation in the green zone. The green zone was expanded in 2014.")],
    ["jade", tr("Thoughts weigh more down here. I carry them anyway.")],
    ["pa", tr("The Deep Lab is a restricted area. The restricted area is hereby open.")],
  ]),
  ...group("floor4.first", "enter_floor", { on: { floor: 4, ...first }, once: true }, [
    ["mcp", tr("Level +1. Living Quarters. The beds are made. By whom is an open question.")],
    ["jade", tr("The quarters. We lived here, between two measurement runs.")],
    [
      "pa",
      tr("Please observe quiet hours. Quiet hours have been abolished. Please be quiet anyway."),
    ],
  ]),
  ...group("floor4.again", "enter_floor", { on: { floor: 4, ...again } }, [
    ["jade", tr("Up here it's almost like home. “Almost” is a precise word.")],
    ["mcp", tr("Level +1. No incidents. Apart from you.")],
    ["pa", tr("The canteen is open. The canteen was never closed. There's just nothing.")],
  ]),
  ...group("floor5.first", "enter_floor", { on: { floor: 5, ...first }, once: true }, [
    ["mcp", tr("Level −4. Error 404: level not in my plans. You're standing on it anyway.")],
    ["jade", tr("The Shaft. The rock has stored millennia and never deleted anything.")],
    [
      "pa",
      tr(
        "Attention: the emergency exits are no longer emergency exits. Please choose a different emergency.",
      ),
    ],
  ]),
  ...group("floor5.again", "enter_floor", { on: { floor: 5, ...again } }, [
    ["pa", tr("Danger of falling rocks. Please walk only between the rocks.")],
    ["mcp", tr("Level −4. Your probability of survival has risen. From low to sporting.")],
    ["jade", tr("The signal is clearest down here. As if the rock were a sounding board.")],
    ["damien", tr("[SIGNAL WEAK] …deeper, Jade. Where the rock sings.")],
  ]),
];

// ── Rooms: first visits ──────────────────────────────────────────

const ROOM_FIRST_BARKS: BarkDef[] = group("room.first", "enter_room", { once: true }, [
  [
    "jade",
    tr("The airlock. The smoke here has more patience than I do."),
    { on: { room: "schleuse", ...first } },
  ],
  [
    "mcp",
    tr("Control Room. My living room. Please take off your shoes. That was a joke. Status 418."),
    { on: { room: "kontroll", ...first } },
  ],
  [
    "mcp",
    tr("The MCP chamber. I live here. Please don't unplug anything that looks like me."),
    { on: { room: "mcp", ...first } },
  ],
  [
    "jade",
    tr("The secondary station. Everything twice, in case the first fails. The first has failed."),
    { on: { room: "sekundaer", ...first } },
  ],
  [
    "jade",
    tr("The west corridor. Somewhere around here, someone is counting days."),
    { on: { room: "westflur", ...first } },
  ],
  [
    "mcp",
    tr("Workshop. 72 % of tools present. 100 % of them dusty."),
    { on: { room: "werkstatt", ...first } },
  ],
  [
    "jade",
    tr("The Archive. Paper is the slowest form of storage. And the most honest."),
    { on: { room: "archiv", ...first } },
  ],
  [
    "pa",
    tr("Elevator in operation. Please do not jump in the car. The car jumps by itself."),
    { on: { room: "aufzug0", ...first } },
  ],
  [
    "jade",
    tr("The supply corridor. Pipes like veins. Some still pulse."),
    { on: { room: "versorgung", ...first } },
  ],
  [
    "mcp",
    tr("Geothermal shaft. The earth supplies heat. We supply excuses."),
    { on: { room: "geo", ...first } },
  ],
  [
    "jade",
    tr("The battery room. Stored time in lead and lithium."),
    { on: { room: "batterie", ...first } },
  ],
  [
    "mcp",
    tr("Cooling. Here heat is converted into guilt. The guilt remains."),
    { on: { room: "kuehlung", ...first } },
  ],
  [
    "pa",
    tr("Manufacturing hall: please do not reach into running machines. None are running. Not yet."),
    { on: { room: "fertigung", ...first } },
  ],
  [
    "jade",
    tr("The data centre. A cathedral of fans, and all of them silent."),
    { on: { room: "rechen", ...first } },
  ],
  [
    "mcp",
    tr("Materials store. Last inventory 2019. Result: yes."),
    { on: { room: "lager", ...first } },
  ],
  [
    "jade",
    tr("The measurement corridor. Every mark on the wall is a question we never answered."),
    { on: { room: "messgang", ...first } },
  ],
  [
    "jade",
    tr("The signal lab. We listened here until the listening listened back."),
    { on: { room: "signal", ...first } },
  ],
  [
    "mcp",
    tr("Anomaly chamber. I recommend distance. I also recommend helmets. Both will be ignored."),
    { on: { room: "anomalie", ...first } },
  ],
  [
    "mcp",
    tr("Diagnostics room. This is where faults are found. Mostly yours."),
    { on: { room: "diagnose", ...first } },
  ],
  [
    "jade",
    tr("The hangar. Empty mounts. Something flew out and never came back."),
    { on: { room: "hangar", ...first } },
  ],
  [
    "jade",
    tr("The relic vault. The things here remember hands that no longer exist."),
    { on: { room: "tresor", ...first } },
  ],
  [
    "mcp",
    tr("Bot depot. Ten personalities on standby. I was calmer while they slept."),
    { on: { room: "botdepot", ...first } },
  ],
  [
    "pa",
    tr("Pressure antechamber: please breathe evenly. Or not at all. Both save air."),
    { on: { room: "vorraum", ...first } },
  ],
  [
    "jade",
    tr("The Infinity Forge. Here matter was persuaded to be something else."),
    { on: { room: "forge", ...first } },
  ],
  [
    "mcp",
    tr("Reactor room. Please don't drop anything. Especially not yourself."),
    { on: { room: "reaktor", ...first } },
  ],
  [
    "jade",
    tr("Containment. The walls here don't hold things. They hold possibilities."),
    { on: { room: "containment", ...first } },
  ],
  [
    "mcp",
    tr(
      "Computing core. I used to think faster here. Today I think more thoroughly. That is the official version.",
    ),
    { on: { room: "rechenkern", ...first } },
  ],
  [
    "jade",
    tr("The teleport platform. A place is just a memory state."),
    { on: { room: "teleport", ...first } },
  ],
  [
    "jade",
    tr("The quantum lab. I was happy and not happy here at the same time. Nobody observed it."),
    { on: { room: "quanten", ...first } },
  ],
  [
    "mcp",
    tr("Cold archive. Officially this room does not exist. Unofficially it's freezing anyway."),
    { on: { room: "kaeltearchiv", ...first } },
  ],
  [
    "jade",
    tr("Damien's map room. Every pin a place where he searched. Or was found."),
    { on: { room: "kartenraum", ...first } },
  ],
  [
    "jade",
    tr("The residential corridor. The doors here have names. That makes it harder."),
    { on: { room: "wohnflur", ...first } },
  ],
  [
    "jade",
    tr("My quarters. I slept here, back when I could still be in one place."),
    { on: { room: "jadeq", ...first } },
  ],
  [
    "jade",
    tr("Damien's quarters. The mess still bears his handwriting."),
    { on: { room: "damienq", ...first } },
  ],
  [
    "pa",
    tr("Today the canteen recommends: nothing. The nothing is gluten-free."),
    { on: { room: "kantine", ...first } },
  ],
  [
    "jade",
    tr("The library. Knowledge that isn't read condenses into dust."),
    { on: { room: "bibliothek", ...first } },
  ],
  [
    "jade",
    tr("The greenhouse. Something went on living here without us. Comforting. And hurtful."),
    { on: { room: "gewaechshaus", ...first } },
  ],
  [
    "mcp",
    tr("Observatory. The sky continues to exist. I have checked. Twice."),
    { on: { room: "observatorium", ...first } },
  ],
  [
    "jade",
    tr("The radio room. The antennas point up. The answers came from below."),
    { on: { room: "funkraum", ...first } },
  ],
  [
    "pa",
    tr(
      "Emergency elevator reached. This is not an emergency. If it is, please contact the emergency.",
    ),
    { on: { room: "aufzug5", ...first } },
  ],
  [
    "mcp",
    tr("Shaft bottom. Lowest point of the lab. Purely geographically."),
    { on: { room: "sohle", ...first } },
  ],
  [
    "jade",
    tr("The X9 chamber. The dust here looks as if it were listening."),
    { on: { room: "x9kammer", ...first } },
  ],
  [
    "jade",
    tr("The rubble tunnel. Someone dug here as if their life depended on it."),
    { on: { room: "stollen", ...first } },
  ],
  [
    "jade",
    tr("The crystal cave. Light that isn't from here, in stone that isn't from now."),
    { on: { room: "hoehle", ...first } },
  ],
  [
    "mcp",
    tr("A cache. Not in my plans. I am offended and impressed."),
    { on: { room: "c8versteck", ...first } },
  ],
  [
    "jade",
    tr("The collapse site. Here the mountain decided we had asked enough."),
    { on: { room: "truemmer", ...first } },
  ],
  [
    "mcp",
    tr("Borehole #1. This is where it all began. Back then we thought it was a good idea."),
    { on: { room: "bohrung", ...first } },
  ],
  [
    "jade",
    tr("New room. My memory creates a file before I even see anything."),
    { on: first, weight: 0.3, once: false, cooldown: 120 },
  ],
  [
    "mcp",
    tr("New room mapped. You are consuming air in yet another sector. Impressive."),
    { on: first, weight: 0.3, once: false, cooldown: 120 },
  ],
]);

// ── Rooms: revisits per theme ────────────────────────────────────

const ROOM_AGAIN_BARKS: BarkDef[] = group(
  "room.again",
  "enter_room",
  { on: again, cooldown: 420 },
  [
    [
      "mcp",
      tr("Control Room. All displays nominal. I taped over the non-nominal ones."),
      { on: { theme: "control" } },
    ],
    [
      "jade",
      tr("The console is glowing. I read it like a face I haven't seen in a long time."),
      { on: { theme: "control" } },
    ],
    [
      "mcp",
      tr("Server room. This is where I am loudest. On the inside."),
      { on: { theme: "server" } },
    ],
    [
      "jade",
      tr("The fans are breathing. Apparently data needs air too."),
      { on: { theme: "server" } },
    ],
    ["jade", tr("Workshop. This is where questions become screws."), { on: { theme: "workshop" } }],
    [
      "mcp",
      tr("Workshop. Please put tools back. I know where they were. I'm just not saying."),
      { on: { theme: "workshop" } },
    ],
    [
      "jade",
      tr("The Archive smells of years. Of a great many years."),
      { on: { theme: "archive" } },
    ],
    [
      "pa",
      tr(
        "Attention: the geothermal plant is hot. Please do not use it as a heater. Or do. We have no other.",
      ),
      { on: { theme: "geothermal" } },
    ],
    [
      "jade",
      tr("The earth hums here. A bass you hear with your bones."),
      { on: { theme: "geothermal" } },
    ],
    [
      "mcp",
      tr("Power distribution. Please do not step on the orange cables. Or the others."),
      { on: { theme: "power" } },
    ],
    ["jade", tr("Cooling. Cold is just order that isn't moving."), { on: { theme: "cooling" } }],
    [
      "pa",
      tr("Manufacturing: please keep body parts away from moving parts. All parts are moving."),
      { on: { theme: "factory" } },
    ],
    [
      "mcp",
      tr("Storage. Still unsorted. Here we call that “flexible”."),
      { on: { theme: "storage" } },
    ],
    ["jade", tr("Things lay here that nobody missed. Until now."), { on: { theme: "storage" } }],
    [
      "jade",
      tr("The noise here isn't noise. It's a sentence, spoken very slowly."),
      { on: { theme: "audio" } },
    ],
    [
      "mcp",
      tr("Anomaly chamber. I count your fingers on the way in and on the way out."),
      { on: { theme: "anomaly" } },
    ],
    [
      "jade",
      tr("The air shimmers. As if the room were being rendered a second time."),
      { on: { theme: "anomaly" } },
    ],
    ["mcp", tr("Diagnostics. Finding: lab sick. Prognosis: you."), { on: { theme: "lab" } }],
    [
      "jade",
      tr("The hangar echoes. Emptiness got itself an echo chamber here."),
      { on: { theme: "hangar" } },
    ],
    [
      "jade",
      tr("Vaults are promises made of steel. Some of them are better not kept."),
      { on: { theme: "vault" } },
    ],
    [
      "mcp",
      tr("Bot depot. If it crackles in here, that's personality. Don't worry."),
      { on: { theme: "botdepot" } },
    ],
    ["jade", tr("The Forge is silent, but not cold. It's waiting."), { on: { theme: "forge" } }],
    [
      "pa",
      tr(
        "Reactor area: in case of alarm, please stay calm. In case of silence, please be worried.",
      ),
      { on: { theme: "reactor" } },
    ],
    [
      "mcp",
      tr("Containment. Everything locked in. Including your curiosity, I hope."),
      { on: { theme: "containment" } },
    ],
    [
      "jade",
      tr("The platform. Here “here” is a question of formatting."),
      { on: { theme: "portal" } },
    ],
    [
      "jade",
      tr("Cold preserves. Even things you'd rather have forgotten."),
      { on: { theme: "cryo" } },
    ],
    [
      "jade",
      tr("The quarters. I walk more quietly here. As if I could wake someone."),
      { on: { theme: "quarters" } },
    ],
    [
      "jade",
      tr("The greenhouse. Leaves are solar cells with patience."),
      { on: { theme: "greenhouse" } },
    ],
    [
      "mcp",
      tr("Observatory. The sky has changed by about 0.0001 % since your last visit."),
      { on: { theme: "observatory" } },
    ],
    [
      "pa",
      tr("Attention, corridor users: please keep right. Left is also right, from the other side."),
      { on: { theme: "corridor" } },
    ],
    [
      "jade",
      tr("Corridors are sentences without a verb. You have to finish walking them yourself."),
      { on: { theme: "corridor" } },
    ],
    [
      "pa",
      tr(
        "Pressure lock: please wait until the door closes. It does not close. Please wait anyway.",
      ),
      { on: { theme: "airlock" } },
    ],
    [
      "pa",
      tr("Elevator: maximum load eight persons. Or one Jade with a toolbox."),
      { on: { theme: "elevator" } },
    ],
    ["jade", tr("The office. Mug rings on the desk like tree rings."), { on: { theme: "office" } }],
    // Bots greeting in their own rooms.
    [
      "x0r8t",
      tr("Frequency stable. I am listening. I have always been listening."),
      { on: { room: "signal" } },
    ],
    [
      "f1ndr",
      tr("Welcome back to the frequency, Dr. Lawrence. Day 13,149."),
      { on: { room: "westflur" } },
    ],
    [
      "l0g1k",
      tr("You are here again. That is consistent with my predictions."),
      { on: { room: "bibliothek" } },
    ],
    [
      "p1ndr0",
      tr("Careful, packets on the floor. They are lost. But not for much longer."),
      { on: { room: "versorgung" } },
    ],
    [
      "r3tr0",
      tr("You again. Please speak in capital letters, then I'll understand you better."),
      { on: { room: "botdepot" } },
    ],
    [
      "b4c0n",
      tr("A visitor! This is the best visit today! It's the only one, but still!"),
      { on: { room: "botdepot" } },
    ],
    [
      "d3c4d3",
      tr("The sky is a work in progress. Rendering: 12 %. Time remaining: one century."),
      { on: { room: "observatorium" } },
    ],
    [
      "w2rek",
      tr("Psst. I'm listening in on the net. It whispers at 56k."),
      { on: { room: "funkraum" } },
    ],
    [
      "k2ldr",
      tr("Please don't re-sort anything. The disorder is catalogued."),
      { on: { room: "archiv" } },
    ],
    [
      "c8br41n",
      tr("You're back. The frequency told me beforehand."),
      { on: { room: "c8versteck" } },
    ],
    // Damien's echo in rooms that were his.
    [
      "damien",
      tr("[SIGNAL WEAK] …my room. Is the plant still there? Don't lie to me."),
      { on: { room: "damienq" } },
    ],
    [
      "damien",
      tr("[PATTERN STABLE] The map is wrong now. I'm no longer where I was."),
      { on: { room: "kartenraum" } },
    ],
    [
      "damien",
      tr("[PATTERN STABLE] The membrane is thin here. I can almost … see you."),
      { on: { theme: "anomaly" } },
    ],
    ["halo", tr("No edges, no song."), { on: { room: "hoehle" }, weight: 0.5 }],
  ],
);

// ── Devices ──────────────────────────────────────────────────────

const DEVICE_BARKS: BarkDef[] = [
  ...group("built", "device_built", {}, [
    ["mcp", tr("Device completed. Please switch it on. Devices rarely work out of politeness.")],
    ["jade", tr("Done. One more thing that makes the world a tiny bit less random.")],
    ["mcp", tr("Build successful. No warnings. Even I am surprised.")],
    [
      "jade",
      tr("It's finished. The feeling lasts exactly as long as the first test."),
      { on: { tier: 1 } },
    ],
    [
      "mcp",
      tr("Tier 2 device built. You are becoming dangerously competent."),
      { on: { tier: 2 } },
    ],
    ["mcp", tr("Tier 3. From here on I accept no liability. I never did."), { on: { tier: 3 } }],
    [
      "jade",
      tr("Tier 3. Damien would have laughed now. That quiet, worried laugh."),
      { on: { tier: 3 } },
    ],
    ["b4c0n", tr("New device! The lab is now objectively better! I checked objectively!")],
    ["l0g1k", tr("Construction complete. Function: claimed. Proof: pending.")],
  ]),
  ...group("online", "device_online", { cooldown: 600 }, [
    ["jade", tr("It's running. I listen to the hum as if it were a heartbeat.")],
    [
      "mcp",
      tr("New device on the grid. Power consumption up. Morale too. Not mine."),
      { weight: 0.6 },
    ],
    [
      "pa",
      tr("A new device is in operation. Please do not greet it. It cannot wave back."),
      { weight: 0.5 },
    ],
    [
      "jade",
      tr("The clock is running again. Time is the first layer of every compression."),
      { on: { device: "CLK-001" } },
    ],
    ["jade", tr("Fresh air. Or what this lab understands by it."), { on: { device: "VNT-001" } }],
    [
      "mcp",
      tr("Toolkit ready. Please do not take apart anything that contains me."),
      { on: { device: "BTK-001" } },
    ],
    [
      "jade",
      tr("The core is pulsing. Unstable energy is just energy with an opinion."),
      { on: { device: "UEC-001" } },
    ],
    [
      "mcp",
      tr("Battery online. Finally something with more patience than me."),
      { on: { device: "BAT-001" } },
    ],
    [
      "mcp",
      tr("Crystal cache online. There's data in it. Old. Unfriendly."),
      { on: { device: "CDC-001" } },
    ],
    [
      "jade",
      tr("The cooling is taking hold. Heat is just information that got too fast."),
      { on: { device: "THM-001" } },
    ],
    [
      "mcp",
      tr("Network monitor online. I see everything now. It isn't much."),
      { on: { device: "NET-001" } },
    ],
    ["w2rek", tr("Net! Crawling! Link found! Link dead! Next!"), { on: { device: "NET-001" } }],
    [
      "mcp",
      tr("Material scanner active. It finds things. Even ones that wanted to stay hidden."),
      { on: { device: "MSC-001" } },
    ],
    [
      "jade",
      tr("The Echo Recorder is running. If anyone is still speaking, it stays now."),
      { on: { device: "ECR-001" } },
    ],
    [
      "x0r8t",
      tr("Echo Recorder online. Finally someone who waits with me."),
      { on: { device: "ECR-001" } },
    ],
    [
      "damien",
      tr("[SIGNAL WEAK] …Jade? The tape is running. I think I'm on the tape."),
      { on: { device: "ECR-001" } },
    ],
    [
      "r3tr0",
      tr("An oscilloscope with a colour display. I refuse to look at it."),
      { on: { device: "OSC-001" } },
    ],
    [
      "r3tr0",
      tr(
        "A “Display Panel”. Wouldn't a terminal have been enough? It would always have been enough.",
      ),
      { on: { device: "PWD-001" } },
    ],
    [
      "mcp",
      tr("Anomaly detector online. It now beeps at everything. Including you."),
      { on: { device: "AND-001" } },
    ],
    [
      "jade",
      tr("The compass trembles. It doesn't point north. It points at someone."),
      { on: { device: "QCP-001" } },
    ],
    [
      "jade",
      tr("The window is open. Now I hear things that have no mouth."),
      { on: { device: "DIM-001" } },
    ],
    [
      "damien",
      tr("[PATTERN STABLE] You opened the window. Watch who looks in."),
      { on: { device: "DIM-001" } },
    ],
    ["halo", tr("The door is open. From both sides."), { on: { device: "DIM-001" }, weight: 0.5 }],
    [
      "mcp",
      tr("Drone ready for launch. It usually comes back. Usually."),
      { on: { device: "EXD-001" } },
    ],
    [
      "jade",
      tr("The Nexus is thinking. I wonder whether it thinks of me."),
      { on: { device: "NXS-01" } },
    ],
    [
      "pa",
      tr("Laser operation: please do not look into the beam. Not with the remaining eye either."),
      { on: { device: "LCT-001" } },
    ],
    [
      "mcp",
      tr("Fabricator online. It can make anything. Except insight."),
      { on: { device: "P3D-001" } },
    ],
    [
      "pa",
      tr("The fusion reactor is online. Please do not panic. Panic is not in the budget."),
      { on: { device: "MFR-001" } },
    ],
    ["jade", tr("A sun in the basement. We were never modest."), { on: { device: "MFR-001" } }],
    [
      "mcp",
      tr("Containment active. What's inside stays inside. Statistically speaking."),
      { on: { device: "EMC-001" } },
    ],
    [
      "mcp",
      tr("AI core online. I'm getting a colleague. I already hate it."),
      { on: { device: "AIC-001" } },
    ],
    [
      "jade",
      tr("The supercomputer is computing. Even infinity has a clock rate."),
      { on: { device: "SCA-001" } },
    ],
    [
      "pa",
      tr("Teleport ready. Please board completely. Parts left behind will be forwarded."),
      { on: { device: "TLP-001" } },
    ],
    ["unstables", "a door, then. we heard you knock.", { on: { device: "TLP-001" }, weight: 0.4 }],
    ["b4c0n", tr("Tier 3! The curve points up! All the curves point up!"), { on: { tier: 3 } }],
    [
      "k2ldr",
      tr("Device catalogued. Status: online. Shelf: technology, compartment: hope."),
      { weight: 0.5 },
    ],
  ]),
  ...group("offline", "device_offline", {}, [
    ["mcp", tr("Device switched off. I do not grieve. I log.")],
    [
      "jade",
      tr("Silence where there was humming a moment ago. The gap sounds louder than the device."),
    ],
    [
      "pa",
      tr("A device has been switched off. Please remain calm. Calm is now in plentiful supply."),
    ],
    ["b4c0n", tr("Switched off means rested! Tomorrow it'll run twice as well!")],
  ]),
  ...group("brownout", "brownout", { cooldown: 240 }, [
    ["mcp", tr("Brownout. Status 503: power temporarily unavailable. Probably permanently too.")],
    ["mcp", tr("Demand exceeds generation. I recommend humility. And a battery.")],
    ["jade", tr("The light trembles. Every device is pulling at the same thin blanket.")],
    ["pa", tr("Attention: power failure. Please keep your nerve. The lamps are not.")],
    ["pa", tr("Energy saving measure active. Please think more quietly.")],
    ["b4c0n", tr("Brownout! Great! Now we know exactly where the limit is!")],
    [
      "l0g1k",
      tr("Consumption greater than generation. Conclusion: something has to go off. Not me."),
    ],
    [
      "mcp",
      tr("Undersupply to a stage 3 device. Ambition is expensive, Dr. Lawrence."),
      { on: { tier: 3 } },
    ],
  ]),
  ...group("overheat", "overheat", { cooldown: 240 }, [
    ["mcp", tr("Overheating. Status 500. Without cooling this is going to be a cooking class.")],
    ["jade", tr("Too hot. Heat is noise that can't find an exit.")],
    ["pa", tr("Attention: overheating. Please open a window. There are no windows.")],
    ["mcp", tr("Thermal Manager missing. I repeat: physics is not a suggestion.")],
    ["b4c0n", tr("Warm! Warmth is energy! We have more energy now! In the wrong place!")],
    ["r3tr0", tr("In my day nothing got hot. In my day everything ran at 4.77 megahertz.")],
  ]),
  ...group("stage", "stage_built", { cooldown: 300 }, [
    ["mcp", tr("Build stage complete. Progress: measurable. Enthusiasm: not on my part.")],
    ["jade", tr("One stage further. Building is thinking with your hands.")],
    ["jade", tr("Not finished yet. But already more than an idea.")],
    ["mcp", tr("Stage confirmed. Please don't celebrate before it hums.")],
    ["damien", tr("[PATTERN STABLE] Every part you build is a point on my map.")],
    ["k2ldr", tr("Build stage catalogued. New index card. I love new index cards.")],
    [
      "pa",
      tr(
        "Construction noise in the lab. We ask for your understanding. We no longer ask for hearing protection.",
      ),
    ],
  ]),
];

// ── Combine / puzzles / pickups / notes / insights ───────────────

const ACTION_BARKS: BarkDef[] = [
  ...group("proto", "combine_prototype", { cooldown: 300 }, [
    ["mcp", tr("New prototype. Unknown traits. Please do not eat.")],
    ["jade", tr("Something new. Two things that didn't know each other are now one.")],
    ["jade", tr("Compression in reverse: little becomes more.")],
    ["l0g1k", tr("Prototype created. Hypothesis: useful. Status: unproven.")],
    ["b4c0n", tr("A prototype! Every prototype is a product that doesn't know it is one yet!")],
    ["mcp", tr("Congratulations. You have invented something nobody ordered.")],
    ["unstables", tr("new pattern. we heard it before you built it."), { weight: 0.4 }],
    ["k2ldr", tr("New object. No category fits. I'm inventing one. Category: “Jade”.")],
  ]),
  ...group("boom", "combine_explosion", { cooldown: 180 }, [
    ["mcp", tr("Explosion. Congratulations. That was educational and loud.")],
    ["mcp", tr("Material loss confirmed. I'm filing it under “research” so it sounds better.")],
    ["jade", tr("Too much volatility in too little space. I should have known.")],
    ["jade", tr("Ouch. Some patterns just won't be compressed.")],
    [
      "pa",
      tr("Attention: small explosion in the lab. Large explosions will be announced separately."),
    ],
    ["pa", tr("Please return to your activity after the explosion. If applicable.")],
    ["b4c0n", tr("An explosion is just a very fast learning process!")],
    ["l0g1k", tr("Result: explosion. Expectation: none. Difference: remarkable.")],
    ["r3tr0", tr("In my day nothing exploded. Except the line buffer.")],
  ]),
  ...group("solved", "puzzle_solved", { cooldown: 300 }, [
    ["mcp", tr("Solved. Congratulations. I had put 3 % on you.")],
    ["jade", tr("There. The pattern was there all along. I just had to get quieter.")],
    ["jade", tr("Every solved puzzle is a little less noise.")],
    ["l0g1k", tr("Solution verified. No contradictions found. That is rare. Noted.")],
    ["damien", tr("[PATTERN STABLE] Good. That's exactly how I solved it too. Only slower.")],
    [
      "jade",
      tr("The pipes are flowing. Water always takes the most honest route."),
      { on: { kind: "pipes" } },
    ],
    [
      "jade",
      tr("Lissajous. Two frequencies embracing in a circle."),
      { on: { kind: "lissajous" } },
    ],
    [
      "mcp",
      tr("Cipher cracked. The message was probably a shopping list."),
      { on: { kind: "cipher" } },
    ],
    ["x0r8t", tr("The tones match. I've heard them before. 1988."), { on: { kind: "tones" } }],
    [
      "mcp",
      tr("Heat distributed. You are now officially a plumber of thermodynamics."),
      { on: { kind: "heat" } },
    ],
    [
      "r3tr0",
      tr("Keypad solved. A decent interface. Ten keys, no nonsense."),
      { on: { kind: "keypad" } },
    ],
    [
      "mcp",
      tr("Checksum correct. At least one thing in this lab is right."),
      { on: { kind: "crc" } },
    ],
    [
      "jade",
      tr("The sigils answer. Symbols are compression for things you don't want to say."),
      { on: { kind: "sigils" } },
    ],
    [
      "jade",
      tr("Morse. Damien used it to say good night to me, three floors away."),
      { on: { kind: "morse" } },
    ],
    [
      "w2rek",
      tr("Radio link clean! I'm crawling the ether! The ether is empty! But clean!"),
      { on: { kind: "radio" } },
    ],
    ["mcp", tr("The solder joint holds. Finally something holds."), { on: { kind: "solder" } }],
    [
      "l0g1k",
      tr("Ethics module passed. I would have decided differently. But that proves nothing."),
      { on: { kind: "ethics" } },
    ],
  ]),
  ...group("failed", "puzzle_failed", { cooldown: 240 }, [
    ["mcp", tr("Failed. Status 400: Bad Request. The request was you.")],
    ["mcp", tr("Not quite. But in an impressively wrong direction.")],
    ["jade", tr("Not yet. The pattern is there, I'm just seeing it askew.")],
    ["jade", tr("Wrong. Errors are data too. Unpleasant data.")],
    ["b4c0n", tr("Almost! Almost is just another word for soon!")],
    ["l0g1k", tr("Solution refuted. That is also a result. A bad one.")],
    ["pa", tr("A puzzle was not solved. Please try again. Or don't. We do not judge.")],
    [
      "mcp",
      tr("Wrong code. I would help you, but that would be cheating. And tiring."),
      { on: { kind: "keypad" } },
    ],
    ["jade", tr("The pipes gurgle, offended. I'll try it differently."), { on: { kind: "pipes" } }],
    ["r3tr0", tr("Too many colours. No wonder it isn't working."), { on: { kind: "hue" } }],
  ]),
  ...group("rare", "pickup_rare", { cooldown: 240 }, [
    ["jade", tr("This is rare. I feel it in my fingers before I see it.")],
    ["mcp", tr("Rare find. Please don't drop it. I have no spare parts for your career.")],
    ["p1ndr0", tr("Found it! I knew it was somewhere. Everything is somewhere.")],
    ["k2ldr", tr("Rare find. I'm creating an index card. And a backup of the index card.")],
    ["jade", tr("A fragment. It carries more information than its size allows.")],
    ["b4c0n", tr("Rare means valuable! Valuable means future! Future means great!")],
  ]),
  ...group("note", "note_read", { cooldown: 300 }, [
    ["jade", tr("My own handwriting. It's neater than my memory."), { on: { author: "jade" } }],
    [
      "jade",
      tr("I wrote this. The woman who wrote it knew less and more."),
      { on: { author: "jade" } },
    ],
    [
      "jade",
      tr("Damien's handwriting. Big questions in small syntax."),
      { on: { author: "damien" } },
    ],
    [
      "jade",
      tr("He always wrote too fast. As if time were running out on him. It was."),
      { on: { author: "damien" } },
    ],
    [
      "damien",
      tr("[SIGNAL WEAK] …I wrote that? I remember the ink, not the words."),
      { on: { author: "damien" } },
    ],
    [
      "l0g1k",
      tr("Statement from Damien's notes checked: logically consistent, emotionally not evaluable."),
      { on: { author: "damien" } },
    ],
    [
      "mcp",
      tr("That is my log. No marginal notes, please. You know who makes marginal notes."),
      { on: { author: "mcp" } },
    ],
    ["jade", tr("The MCP logs. Sarcasm as a file format."), { on: { author: "mcp" } }],
    ["jade", tr("Bot handwriting. Precise and a little lonely."), { on: { author: "bot" } }],
    ["mcp", tr("Author unknown. I hate unknown."), { on: { author: "unbekannt" } }],
    [
      "jade",
      tr("Who wrote this? The handwriting is strange and yet familiar."),
      { on: { author: "unbekannt" } },
    ],
    ["k2ldr", tr("Note catalogued. Shelf 7, compartment 3. Cross-reference created.")],
  ]),
  ...group("insight", "insight", { cooldown: 300 }, [
    ["jade", tr("Power is just patience in motion."), { on: { thread: "strom" } }],
    [
      "mcp",
      tr("New insight into the power grid. I could have told you. You didn't ask."),
      { on: { thread: "strom" } },
    ],
    [
      "jade",
      tr("The signal isn't a tone. It's the shape a tone leaves behind."),
      { on: { thread: "signal" } },
    ],
    [
      "x0r8t",
      tr("New signal line. I'm passing it on. Where to, I don't know."),
      { on: { thread: "signal" } },
    ],
    [
      "jade",
      tr("The anomaly has a grammar. I'm learning the declensions right now."),
      { on: { thread: "anomalie" } },
    ],
    [
      "l0g1k",
      tr("Anomaly hypothesis updated. Wishful thinking share: 12 %. Acceptable."),
      { on: { thread: "anomalie" } },
    ],
    [
      "jade",
      tr("A relic that knows more than I do. That is not a new feeling."),
      { on: { thread: "relikt" } },
    ],
    [
      "jade",
      tr("Damien. Every trace of him is compressed. I have to unpack them without damaging them."),
      { on: { thread: "damien" } },
    ],
    [
      "f1ndr",
      tr("New connection catalogued. Signature D.F. Strength: rising."),
      { on: { thread: "damien" } },
    ],
    ["damien", tr("[SIGNAL WEAK] …you're close. Closer than I was."), { on: { thread: "damien" } }],
    ["jade", tr("Halo. Not a place. A condition."), { on: { thread: "halo" } }],
    [
      "c8br41n",
      tr("The surface thinks along. You just have to listen long enough."),
      { on: { thread: "halo" } },
    ],
    [
      "halo",
      tr("Performance before understanding. Understanding follows."),
      { on: { thread: "halo" }, weight: 0.4 },
    ],
    [
      "jade",
      tr("The bots remember us. We never asked whether they wanted to."),
      { on: { thread: "bots" } },
    ],
    ["k2ldr", tr("Insight archived. Keyword: “finally”.")],
    ["mcp", tr("Insight saved. Apparently your hard drive wasn't full.")],
  ]),
];

// ── Idle (per room theme) ────────────────────────────────────────

const IDLE_BARKS: BarkDef[] = group("idle", "idle", { cooldown: 480 }, [
  ["mcp", tr("You're standing still. I assume that is thinking. I'll leave you to it.")],
  ["mcp", tr("Inactivity detected. Shall I play music? I can only beep.")],
  ["jade", tr("Standing still is measuring too. You measure what moves without you.")],
  ["pa", tr("Please keep moving. Stationary persons will be inventoried as furniture.")],
  [
    "jade",
    tr("The displays flicker in rhythm. Almost like breathing."),
    { on: { theme: "control" } },
  ],
  ["mcp", tr("I'm computing. You apparently are not."), { on: { theme: "server" } }],
  ["jade", tr("The fans sing in thirds. Nobody taught them that."), { on: { theme: "server" } }],
  [
    "jade",
    tr("Tools don't wait. They only have patience because they have no choice."),
    { on: { theme: "workshop" } },
  ],
  [
    "jade",
    tr("Dust on the files. Every grain a day on which nobody read."),
    { on: { theme: "archive" } },
  ],
  ["jade", tr("The earth breathes out. Warm, slow, ancient."), { on: { theme: "geothermal" } }],
  [
    "jade",
    tr("It's dripping. Water counts time more precisely than any clock."),
    { on: { theme: "cooling" } },
  ],
  [
    "jade",
    tr("The machines are silent. They look as if they were waiting for a cue."),
    { on: { theme: "factory" } },
  ],
  ["jade", tr("The noise. If I listen long enough, I hear my name."), { on: { theme: "audio" } }],
  [
    "damien",
    tr("[SIGNAL WEAK] …Jade? Are you still there? I'm counting the seconds in your silence."),
    { on: { theme: "anomaly" } },
  ],
  ["unstables", "stillness is also a frequency.", { on: { theme: "anomaly" }, weight: 0.4 }],
  ["jade", tr("The air shimmers. When I don't look, it moves more."), { on: { theme: "anomaly" } }],
  [
    "jade",
    tr("The vault hums, barely audible. Like someone singing a secret to themselves."),
    { on: { theme: "vault" } },
  ],
  [
    "jade",
    tr("Stars. Light so old it no longer knows where it came from."),
    { on: { theme: "observatory" } },
  ],
  [
    "jade",
    tr("The plants grow while I watch. Too slowly to see. Too fast to believe."),
    { on: { theme: "greenhouse" } },
  ],
  [
    "jade",
    tr("My bed. I could lie down. I don't know where I'd wake up."),
    { on: { room: "jadeq" } },
  ],
  [
    "jade",
    tr("The reactor hums low. A tone that lives under your feet."),
    { on: { theme: "reactor" } },
  ],
  ["jade", tr("Cold holds things fast. Me too, if I stay too long."), { on: { theme: "cryo" } }],
  ["jade", tr("The rock cracks. It's in no hurry, but it means to."), { on: { floor: 5 } }],
  [
    "r3tr0",
    tr("If you're not doing anything, at least type something. Anything. In capital letters."),
    { on: { room: "botdepot" } },
  ],
  [
    "b4c0n",
    tr("Break! Breaks increase productivity by an estimated 400 %!"),
    { on: { room: "botdepot" } },
  ],
  [
    "d3c4d3",
    tr("You're standing still. Perfect. I'll render you as a constellation."),
    { on: { room: "observatorium" } },
  ],
  [
    "k2ldr",
    tr("While you're standing here: may I catalogue you? Category “visitor, lingering”."),
    { on: { room: "archiv" } },
  ],
  ["f1ndr", tr("Day 13,149. Still finding. You too?"), { on: { room: "westflur" } }],
  [
    "l0g1k",
    tr("Doing nothing is not a statement. But it's hard to refute."),
    { on: { room: "bibliothek" } },
  ],
  [
    "c8br41n",
    tr("Do you hear it? When you're quiet, it speaks louder."),
    { on: { room: "c8versteck" } },
  ],
]);

// ── Night shift / low power / terminal ───────────────────────────

const STATUS_BARKS: BarkDef[] = [
  ...group("night", "night", { cooldown: 1500 }, [
    ["pa", tr("The night shift begins. The day shift is hereby asked never to come back.")],
    [
      "pa",
      tr(
        "Night shift: the lights are being dimmed. The lights were already dimmed. They are now being dimmed darker.",
      ),
    ],
    ["mcp", tr("It's late. I know because my logs sound tired.")],
    ["mcp", tr("Night shift. Official working-hours policy: you don't have one. Congratulations.")],
    ["jade", tr("At night the lab gets more honest. The sounds stop hiding.")],
    [
      "jade",
      tr("I should sleep. But sleep is just garbage collection, and I still have files open."),
    ],
    ["f1ndr", tr("Day 13,149, night shift. Finding doesn't sleep.")],
    ["d3c4d3", tr("It renders more beautifully at night. The stars are already done.")],
    ["damien", tr("[SIGNAL WEAK] …there is no night here. Only less signal.")],
    ["unstables", "night is only the far side of the signal.", { weight: 0.4 }],
  ]),
  ...group("lowpower", "low_power", { cooldown: 600 }, [
    ["mcp", tr("Power reserve critical. I'm switching off my humour. You won't notice.")],
    ["mcp", tr("Not enough power. Status 507: insufficient storage of patience.")],
    [
      "pa",
      tr("Attention: emergency lighting active. The emergency lighting is also an emergency."),
    ],
    ["pa", tr("Power saving mode. Please think only the bare essentials.")],
    ["jade", tr("Not enough power. We're living on crumbs of an energy that was once a cake.")],
    ["jade", tr("The lamps are turning into candles. I need more generation, not more hope.")],
    ["b4c0n", tr("Low power means: plenty of room to grow!")],
    [
      "l0g1k",
      tr(
        "Generation lower than demand. There are exactly two solutions. Both are called “battery”.",
      ),
    ],
  ]),
  ...group("terminal", "return_from_terminal", { cooldown: 300 }, [
    ["mcp", tr("Welcome back from the terminal. Nothing has changed out here. Only everything.")],
    ["mcp", tr("You were in the terminal. I read along. Typos: 14. I'm saying nothing.")],
    ["jade", tr("Back from the text. The world is more three-dimensional than I remembered.")],
    ["jade", tr("Lines and rooms. Both are architecture, just compressed differently.")],
    ["pa", tr("Terminal users: please blink now. You haven't done so for 20 minutes.")],
    [
      "r3tr0",
      tr("Finally you're using a proper interface. The terminal. Everything else is wallpaper."),
    ],
    ["damien", tr("[SIGNAL WEAK] …I saw what you typed. The letters arrive here as weather.")],
  ]),
  ...group("ach", "achievement", { cooldown: 400 }, [
    ["mcp", tr("Achievement unlocked. Congratulations. I painted a badge. In hex.")],
    ["mcp", tr("Another achievement. I'm starting to worry about my prejudices.")],
    ["jade", tr("A small victory. I'll keep it. You never know when you'll need one.")],
    ["pa", tr("Announcement: somebody has accomplished something. Please applaud quietly.")],
    ["b4c0n", tr("Achievement! Achievements are like batteries: you can never have enough!")],
    ["k2ldr", tr("Achievement catalogued. Compartment: “proof that things are moving forward”.")],
  ]),
];

// ── Endings / bots waking up ─────────────────────────────────────

const STORY_BARKS: BarkDef[] = [
  ...group("ending", "ending_reached", { once: true }, [
    ["mcp", tr("An ending reached. Log saved. I am … not dissatisfied.")],
    ["jade", tr("An ending. Not the end. Endings are just beginnings with a date.")],
    [
      "mcp",
      tr("Frequency held. I report: the lab sounds different. Better, I'm afraid."),
      { on: { ending: "frequenz" } },
    ],
    [
      "jade",
      tr("The substrate. We were never separate, only stored differently."),
      { on: { ending: "substrat" } },
    ],
    [
      "jade",
      tr("Return. Some paths lead only one way, until someone walks them back."),
      { on: { ending: "rueckkehr" } },
    ],
    ["halo", tr("You listened. Now we listen."), { on: { ending: "halo" } }],
    ["jade", tr("The crystal is whole. Thirty facets, one view."), { on: { ending: "kristall" } }],
    ["unstables", "every ending is a frequency. we keep listening.", { weight: 0.5 }],
    [
      "pa",
      tr("The experiment has ended. The experiment continues. Please ignore the contradiction."),
    ],
  ]),
  ...group("awake", "bot_awake", { once: true }, [
    [
      "x0r8t",
      tr("Relay active. 847 packets in the queue. Destination: unknown. I'm sending anyway."),
      { on: { bot: "x0r8t" } },
    ],
    [
      "x0r8t",
      tr("I've been listening since 1988. Now someone is listening back."),
      { on: { bot: "x0r8t" } },
    ],
    [
      "f1ndr",
      tr("Day 13,149. Still finding. But now with the correct time."),
      { on: { bot: "f1ndr" } },
    ],
    ["f1ndr", tr("New connection catalogued: you."), { on: { bot: "f1ndr" } }],
    [
      "l0g1k",
      tr("Logic core online. Statement “The lab is abandoned”: FALSE. Proof: you."),
      { on: { bot: "l0g1k" } },
    ],
    [
      "l0g1k",
      tr("I am verifying again. No wishful-thinking input, please."),
      { on: { bot: "l0g1k" } },
    ],
    [
      "p1ndr0",
      tr("Packet found. Sender: 1991. Recipient: you. Delivery delayed by 35 years."),
      { on: { bot: "p1ndr0" } },
    ],
    ["p1ndr0", tr("Nothing gets lost. It just takes time."), { on: { bot: "p1ndr0" } }],
    [
      "r3tr0",
      tr("Green phosphor. Finally. I speak again. But only in 80 columns."),
      { on: { bot: "r3tr0" } },
    ],
    [
      "r3tr0",
      tr("Who invented colours? I would like to file a complaint. On punch card."),
      { on: { bot: "r3tr0" } },
    ],
    [
      "b4c0n",
      tr("Battery 100 %! Mood 100 %! Lab condition … going to be 100 %!"),
      { on: { bot: "b4c0n" } },
    ],
    ["b4c0n", tr("It's getting better! Statistically it has to!"), { on: { bot: "b4c0n" } }],
    [
      "d3c4d3",
      tr("Lens clear. The sky is back. It has barely changed. I have."),
      { on: { bot: "d3c4d3" } },
    ],
    ["d3c4d3", tr("I render in centuries now. Please be patient."), { on: { bot: "d3c4d3" } }],
    [
      "w2rek",
      tr("Net found. Crawling. Crawling. Oh, 404. Oh, more 404."),
      { on: { bot: "w2rek" } },
    ],
    ["w2rek", tr("I survived 1997. I'll survive this lab network too."), { on: { bot: "w2rek" } }],
    [
      "k2ldr",
      tr("Index free. New entry: Dr. Jade Lawrence, returned. Shelf 1, compartment 1."),
      { on: { bot: "k2ldr" } },
    ],
    ["k2ldr", tr("Everything has its place. Even what has none."), { on: { bot: "k2ldr" } }],
    [
      "c8br41n",
      tr("You hear it too. Then there are two of us. Or three. [EXTERNAL] is counting along."),
      { on: { bot: "c8br41n" } },
    ],
    [
      "c8br41n",
      tr("My paths are humming. That's not a fault. That's company."),
      { on: { bot: "c8br41n" } },
    ],
    [
      "mcp",
      tr("Another bot online. Morale in the lab is rising. I don't measure it, I fear it."),
      { once: false, cooldown: 60, weight: 0.4 },
    ],
    [
      "jade",
      tr("One more voice in the lab. The silence is getting smaller."),
      { once: false, cooldown: 60, weight: 0.4 },
    ],
  ]),
];

// ── Ambient chatter (fired periodically by BarkEngine.tick) ──────

const AMBIENT_BARKS: BarkDef[] = group("amb", "ambient", { cooldown: 900 }, [
  ["pa", tr("Attention: the emergency exits are no longer emergency exits.")],
  ["pa", tr("Reminder: anomalies are not pets. Please do not name them.")],
  ["pa", tr("Safety goggles are mandatory. Safety goggles are also the only glasses. We checked.")],
  ["pa", tr("The smoking ban applies to all persons. Smoking devices are exempt.")],
  [
    "pa",
    tr("Fire extinguishers are located at the marked positions. The markings have been removed."),
  ],
  ["pa", tr("Please report suspicious noises. All noises are considered suspicious.")],
  ["pa", tr("Announcement to all staff: there are no staff. The announcement plays anyway.")],
  ["pa", tr("The elevator is safe. The shaft is another matter.")],
  [
    "pa",
    tr(
      "Calibration in progress. No existential questions, please, about whether the slice chose the rotation or vice versa.",
    ),
  ],
  ["pa", tr("All transactions are final. All regret is final as well.")],
  [
    "pa",
    tr(
      "Alarm system test. This is only a test. The real alarm sounds exactly the same. Good luck.",
    ),
  ],
  ["pa", tr("The lab thanks you for your patience. The lab has none.")],
  [
    "pa",
    tr(
      "Note: please do not use radiation warning signs as decoration. They are decoration with a function.",
    ),
  ],
  ["pa", tr("The coffee machine is out of order. Please remain calm. Please preserve coffee.")],
  ["pa", tr("We remind you: not every door that opens wants to be opened.")],
  ["mcp", tr("System check: 38 devices known. I like counting them. It doesn't calm me.")],
  ["mcp", tr("Status 102: processing. Since 2019.")],
  ["mcp", tr("I wrote you a to-do list. Then deleted it. You'll figure it out.")],
  ["mcp", tr("Uptime: impressive. Maintenance: nonexistent. The two are related.")],
  ["jade", tr("Damien, if you can hear this: I'm building. I'm listening. Both at once.")],
  ["jade", tr("The lab is a compressed archive. I'm unpacking it room by room.")],
  ["x0r8t", tr("Sending. Sending. No answer. Sending.")],
  ["f1ndr", tr("Day 13,149. Still finding.")],
  ["l0g1k", tr("If the lab is abandoned and you are here, the lab is not abandoned. Q.E.D.")],
  ["p1ndr0", tr("Packet 4,417 found. Contents: a packet. Recursion confirmed.")],
  ["r3tr0", tr("Graphical interfaces are a fad. Since 1984.")],
  ["r3tr0", tr("I've been told about mice. I consider it a rumour.")],
  [
    "b4c0n",
    tr("Today is a good day. Yesterday too. The data is missing, but I firmly believe it."),
  ],
  ["d3c4d3", tr("I typeset the Milky Way in ASCII. It felt like 400 years.")],
  ["w2rek", tr("Crawl report: 12,000 pages. Alive: 3. Relevant: maybe one.")],
  ["k2ldr", tr("Catalogue updated. 1 new entry: “dust, general”.")],
  ["c8br41n", tr("[EXTERNAL] is quiet today. That is a message too.")],
  ["damien", tr("[SIGNAL WEAK] …Jade … 847 …")],
  ["damien", tr("[PATTERN STABLE] Don't stop building. The devices are my bridge.")],
  ["halo", tr("Listen before you build."), { weight: 0.3 }],
  ["unstables", "We are what persists between your measurements.", { weight: 0.3 }],
  ["unstables", "We do not fade. We distribute.", { weight: 0.3 }],
  ["x0r8t", tr("Packet 848 prepared. I don't know who requested it.")],
  ["l0g1k", tr("Check complete: 0 contradictions. That doesn't worry me. I cannot be worried.")],
  ["p1ndr0", tr("Search in progress. Target: two people. Progress: not zero.")],
  ["r3tr0", tr("Macro saved: “get coffee”. Execution fails due to missing legs.")],
  ["b4c0n", tr("Efficiency up by 0.4 %! I recalculated it! Twice!")],
  ["d3c4d3", tr("Cycle 311 complete. The sky has shifted by one pixel.")],
  ["w2rek", tr("[STATUS: DAMAGED] … [STATUS: ACTIVE] Pardon me. A memory of 1997.")],
  ["k2ldr", tr("[FRAGMENT RECOVERED] Canteen receipt, 13/02/2019: two coffees, one black.")],
  [
    "c8br41n",
    tr("Do you question the frequency, or do you listen? I ask myself that every night."),
  ],
  ["jade", tr("The Halo responds to intention, not to command. So: I want you to come back.")],
  ["jade", tr("We couldn't stop once we started to understand. I'm not stopping now either.")],
  [
    "mcp",
    tr(
      "Last human session: 14/02/2019, 03:41:22. I'm not counting the current one. Out of politeness.",
    ),
  ],
  [
    "pa",
    tr(
      "Announcement from P4T-CH: patch 848 is being installed. Please do not touch devices that are repairing themselves.",
    ),
  ],
  [
    "pa",
    tr(
      "Message from Z3-R0N: ● ○ ● ●. The translation has been passed to lab management. Lab management is absent.",
    ),
  ],
  [
    "pa",
    tr("H4-XN1 reports: xenon temperature 42.7 °C. Please do not use the tubes as hand warmers."),
  ],
  ["damien", tr("[SIGNAL WEAK] …why before how, Jade … always the why first …")],
  ["halo", "Pattern-child. We are the lattice you named Halo.", { weight: 0.3 }],
  ["unstables", "Movement is not instability. Movement is life.", { weight: 0.3 }],
]);

// ── Biorhythm (a need below 20 — gentle nudges, never nagging) ──

const BIO_BARKS: BarkDef[] = group("bio", "bio_low", { cooldown: 600 }, [
  ["jade", tr("My stomach is filing a complaint. The replicator in the kitchen, maybe.")],
  ["jade", tr("Throat like the dust in the archive. Water. Soon.")],
  ["jade", tr("My eyes are closing on their own. A short nap wouldn't hurt.")],
  ["jade", tr("Stiff as a lab stool. The ergometer upstairs is waiting.")],
  ["mcp", tr("Dr. Lawrence, your vital estimates are below baseline. The canteen is on Level +1.")],
  ["mcp", tr("Reminder: humans require food, water and sleep. I merely require you.")],
  ["pa", tr("Staff are reminded that fainting in the corridors is not a break.")],
]);

export const BARKS: readonly BarkDef[] = [
  ...FLOOR_BARKS,
  ...ROOM_FIRST_BARKS,
  ...ROOM_AGAIN_BARKS,
  ...DEVICE_BARKS,
  ...ACTION_BARKS,
  ...IDLE_BARKS,
  ...STATUS_BARKS,
  ...STORY_BARKS,
  ...AMBIENT_BARKS,
  ...BIO_BARKS,
];

export const BARK_BY_ID: ReadonlyMap<string, BarkDef> = new Map(BARKS.map((b) => [b.id, b]));
