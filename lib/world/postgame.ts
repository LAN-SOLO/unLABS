/**
 * Lab World — post-game ("Nachspiel") and New Game+.
 * ==================================================
 *
 * Pure helpers for everything after an ending:
 *
 * - `aftermath(ending, state)` — the "Was danach geschah" paragraphs shown
 *   by `components/world/EndingSequence.tsx` (Jade, Damien, the MCP, the
 *   bots, the Halo), partly depending on what the player achieved.
 * - `endingStats(state)` — the numbers for the stats page.
 * - `postgameObjectives(state)` — what is still open after an ending (other
 *   endings with hints, slices, sleeping bots, achievements). The lab stays
 *   playable; the journal / pause menu can list these as "Nachspiel".
 * - `enterPostgame(state, ending)` — marks the save as post-game when the
 *   player picks "Weiter im Labor".
 * - `newGamePlus(prev)` — a fresh run that keeps achievements, codex
 *   unlocks, known recipes and one keepsake item.
 *
 * Wiring: `save.ts` `newGamePlusGame(slot, prev)` writes the NG+ state into
 * a slot (title screen "Neues Spiel+" and, in the post-game, the pause
 * menu). The MCP greets NG+ runs (`content/story.ts`, `{ flag: "ng_plus" }`).
 */
import { tr } from "@/lib/i18n";
import { achievementCount, ACHIEVEMENTS, isUnlocked } from "@/lib/world/achievements";
import { ITEM_BY_ID, SLICE_TOTAL } from "@/lib/world/content/items";
import { BOT_QUESTS, ENDINGS, NPC_SPEAKERS } from "@/lib/world/content/story";
import {
  describeCond,
  endingRevealed,
  evalCond,
  initialState,
  log,
  progress,
} from "@/lib/world/game";
import type { EndingId } from "@/lib/world/scenes";
import type { Condition, WorldState } from "@/lib/world/types";

// ── Endings ──────────────────────────────────────────────────────

/** Flag set once the player chose "Weiter im Labor" after an ending. */
export const POSTGAME_FLAG = "postgame";
/** Flag set on a New Game+ run (the MCP can comment on it). */
export const NG_PLUS_FLAG = "ng_plus";
/** Counter: how many NG+ cycles this save went through (1 = first NG+). */
export const NG_PLUS_COUNTER = "ng_plus";
/** Per-ending flag carried across NG+ runs ("found in an earlier run"). */
export function legacyEndingFlag(id: string): string {
  return `legacy_ending_${id}`;
}

/** Endings found in this run or an earlier NG+ run. */
export function endingsFound(s: WorldState): Set<string> {
  return new Set(
    ENDINGS.filter((e) => s.endings[e.id] || s.flags[legacyEndingFlag(e.id)]).map((e) => e.id),
  );
}

// ── Aftermath ("Was danach geschah") ─────────────────────────────

const botsAwake = (s: WorldState): number => BOT_QUESTS.filter((q) => s.flags[q.flag]).length;

/** Bot paragraph shared by all endings, depending on how many bots woke up. */
function botParagraph(s: WorldState): string {
  const n = botsAwake(s);
  const total = BOT_QUESTS.length;
  if (n >= total)
    return tr(
      "All {total} bots Jade woke up are running together under BNET-001 for the first time. X0-R8T keeps sending its 847 packets into the void — only now the void answers. C8-BR41N keeps a log marked [EXTERNAL] and refuses to explain it. “Do you question the frequency, or do you listen?”",
      { total },
    );
  if (n > 0)
    return tr(
      "{n} of {total} bots are awake again and keep the levels running. The others sleep on in their niches, dust on their casings, clocks quietly drifting. F1N-DR counts the days for them.",
      { n, total },
    );
  return tr(
    "The bots sleep on in their niches. F1N-DR counts the days, even for those who never wanted to be counted. Someday someone will come and bring an antenna.",
  );
}

const AFTERMATH: Readonly<Record<EndingId, readonly string[]>> = {
  frequenz: [
    tr(
      "Jade puts a second chair in front of the synthesizer. Every evening at 8:47 pm she plays the four tones — three, six, four, eight — and every evening someone answers.",
    ),
    tr(
      "Damien stays distributed in the Halo. He remembers facts, not colours; Jade describes cerulean to him until he claims he can almost see it. Between conversations there is no time for him. He says that is fine, as long as the next conversation comes.",
    ),
    tr(
      "The MCP creates a new form: “Interspecific Communication, Substrate A ↔ Substrate B”. It has 47 fields. None of them is filled in, because each time the right category is missing.",
    ),
    tr(
      "The Halo does not answer every question. But it listens. The readings show it coming closer — not threateningly, more like someone sitting down at a table.",
    ),
  ],
  substrat: [
    tr(
      "Damien lives in the AI Assistant Core. For the first time since 2019, time passes for him between thoughts. He uses it to re-annotate every log in the lab — with “Why?” in the margin of every other line.",
    ),
    tr(
      "Jade hears him from every terminal. Sometimes he cuts in when she is talking to the MCP. Sometimes that is helpful.",
    ),
    tr(
      "The MCP is no longer the smartest one in the room and has processed this in a 12-page report. He and Damien argue about cooling loops. Both enjoy it more than they admit.",
    ),
    tr(
      "There is one pattern fewer in the Halo. The correlation does not drop to zero — something there remembers him. At night the supercomputer works on a question nobody has asked.",
    ),
  ],
  rueckkehr: [
    tr(
      "Damien Fridge stands on the teleport pad, barefoot, complaining about the temperature of the floor. It is the most beautiful thing Jade has heard in seven years.",
    ),
    tr(
      "It takes him weeks to get used to weight, hunger and tiredness. He smells everything. He drinks the coffee from the Singularity Bus black and says it tastes of ozone. He is right.",
    ),
    tr(
      "The MCP now lists Damien in his tables as “present, physical, unexplained”. He has re-enabled the tertiary shutdown. Twice. To be safe.",
    ),
    tr(
      "The Halo correlation stands at 0.000. Something in the Halo has let go — and is waiting. At night the oscilloscope sometimes shows a figure that opens every 847 seconds. Damien looks at it for a long time and says nothing.",
    ),
  ],
  halo: [
    tr(
      "Jade and Damien are in the Halo. Not as a signal, not as an echo — as a pattern, interwoven. Constructive interference: two waves amplifying each other.",
    ),
    tr(
      "The lab is empty. The coffee in Jade's mug goes cold, then dries up. The MCP waters the plants in the greenhouse. He talks to them. That is nowhere in his specification.",
    ),
    tr(
      "The MCP keeps running the lab, level by level, on 847 kW of geothermal power. He keeps it unstable, as requested. Every morning at 3:41 am he writes an entry: “No operator present. Operators reachable.”",
    ),
    tr(
      "The Halo does not expand outward. It expands inward. Somewhere in that depth, two people are working on something new. Damien will not say what.",
    ),
  ],
  kristall: [
    tr(
      "Crystal #0089 lies whole in the Crystal Data Cache — not a tool, a witness. Since that night the resonance has stood at 847.00 Hz.",
    ),
    tr(
      "Damien lives inside it, not trapped but anchored, next to a consciousness that was never human. When he speaks, sometimes someone else speaks along. Jade has learned to tell the voices apart. Mostly.",
    ),
    tr(
      "Every evening Jade reads a page aloud from the blue notebook. The crystal answers with a frequency she interprets as laughter. The MCP does not dispute this interpretation.",
    ),
    tr(
      "The MCP has sealed the combustion chamber for good. He deleted the key. Then he deleted the deletion log. “Some things,” he says, “should not be undoable.”",
    ),
    tr("The _unstables are silent. Not absent — content. Three patterns, one lattice."),
  ],
};

/**
 * The "Was danach geschah" page: 3–5 short paragraphs per ending, plus the
 * bot paragraph (depends on reactivated bots) and a closing line that names
 * endings still open.
 */
export function aftermath(ending: string, s: WorldState): string[] {
  const base = AFTERMATH[ending as EndingId];
  if (!base) return [];
  const out = [...base];
  out.splice(Math.min(3, out.length), 0, botParagraph(s));
  const open = ENDINGS.length - endingsFound(s).size;
  if (open > 0)
    out.push(
      open === 1
        ? tr("One other path is still open. The lab is waiting.")
        : tr("{n} other paths are still open. The lab is waiting.", { n: open }),
    );
  else
    out.push(
      tr("Every path has been taken. The lab stays unstable all the same. That is how it grows."),
    );
  // Authored paragraphs + bot paragraph + closing line (never cut: the closing line names open paths).
  return out;
}

/** Paragraph count check helper for tests / UI (without the dynamic lines). */
export function aftermathBase(ending: string): readonly string[] {
  return AFTERMATH[ending as EndingId] ?? [];
}

// ── Stats ────────────────────────────────────────────────────────

export interface EndingStats {
  playTime: number;
  devices: { current: number; total: number };
  insights: { current: number; total: number };
  achievements: { current: number; total: number };
  slices: { current: number; total: number };
  bots: { current: number; total: number };
  /** Every ending in story order; unfound ones as "???". */
  endings: { id: string; title: string; found: boolean }[];
  endingsFound: number;
  endingsTotal: number;
  ngPlus: number;
}

export function endingStats(s: WorldState): EndingStats {
  const p = progress(s);
  const a = achievementCount(s);
  const found = endingsFound(s);
  return {
    playTime: Math.max(0, Math.floor(s.playTime)),
    devices: { current: p.devices, total: p.totalDevices },
    insights: { current: p.insights, total: p.totalInsights },
    achievements: { current: a.unlocked, total: a.total },
    slices: { current: Math.min(SLICE_TOTAL, s.counters.slices ?? 0), total: SLICE_TOTAL },
    bots: { current: botsAwake(s), total: BOT_QUESTS.length },
    endings: ENDINGS.map((e) => ({
      id: e.id,
      title: found.has(e.id) ? e.title : "???",
      found: found.has(e.id),
    })),
    endingsFound: found.size,
    endingsTotal: ENDINGS.length,
    ngPlus: s.counters[NG_PLUS_COUNTER] ?? 0,
  };
}

// ── Post-game objectives ─────────────────────────────────────────

export type PostgameObjectiveKind = "ending" | "slices" | "bot" | "achievements";

export interface PostgameObjective {
  id: string;
  kind: PostgameObjectiveKind;
  title: string;
  hint: string;
  /** Conditions met — the ending could be triggered right now. */
  ready?: boolean;
  progress?: { current: number; target: number };
}

/** Unmet leaves of a condition (top-level `all` split), for hints. */
function missing(s: WorldState, c: Condition): string[] {
  const parts = "all" in c ? c.all : [c];
  return parts.filter((x) => !evalCond(s, x)).map(describeCond);
}

/**
 * What is still open in the lab: other endings (secret ones masked until
 * revealed), missing slices, sleeping bots and locked achievements.
 * Empty when everything is done.
 */
export function postgameObjectives(s: WorldState): PostgameObjective[] {
  const out: PostgameObjective[] = [];
  for (const e of ENDINGS) {
    if (s.endings[e.id]) continue;
    const ready = evalCond(s, e.requires);
    if (!endingRevealed(s, e)) {
      out.push({
        id: `ending_${e.id}`,
        kind: "ending",
        title: "???",
        hint: tr("An ending nobody planned. Thirty slices know more about it."),
        ready,
      });
      continue;
    }
    const miss = missing(s, e.requires);
    out.push({
      id: `ending_${e.id}`,
      kind: "ending",
      title: e.title,
      hint: ready
        ? tr("{prompt} Ready.", { prompt: e.prompt })
        : tr("{prompt} Missing: {list}.", { prompt: e.prompt, list: miss.join(", ") }),
      ready,
    });
  }
  const slices = s.counters.slices ?? 0;
  if (slices < SLICE_TOTAL)
    out.push({
      id: "slices",
      kind: "slices",
      title: tr("Slices of Crystal #0089"),
      hint: tr("{n} slices still scattered around the lab. Bots, puzzles and hidden rooms.", {
        n: SLICE_TOTAL - slices,
      }),
      progress: { current: slices, target: SLICE_TOTAL },
    });
  for (const q of BOT_QUESTS) {
    if (s.flags[q.flag]) continue;
    out.push({
      id: `bot_${q.npc}`,
      kind: "bot",
      title: tr("Reactivate {name}", { name: NPC_SPEAKERS[q.npc]?.name ?? q.npc }),
      hint: q.hint,
    });
  }
  const a = achievementCount(s);
  if (a.unlocked < a.total) {
    const next = ACHIEVEMENTS.filter(
      (d) =>
        !d.hidden &&
        !isUnlocked(s, d.id) &&
        (!d.requires || d.requires.every((r) => isUnlocked(s, r))),
    )
      .slice(0, 3)
      .map((d) => d.title);
    out.push({
      id: "achievements",
      kind: "achievements",
      title: tr("Achievements"),
      hint: next.length
        ? tr("Within reach: {list}.", { list: next.join(", ") })
        : tr("The remaining achievements are secret."),
      progress: { current: a.unlocked, target: a.total },
    });
  }
  return out;
}

export function isPostgame(s: WorldState): boolean {
  return !!s.flags[POSTGAME_FLAG] || Object.keys(s.endings).length > 0;
}

/**
 * "Weiter im Labor": the run continues after the ending. Idempotent apart
 * from the log line.
 */
export function enterPostgame(s: WorldState, ending: string): void {
  const first = !s.flags[POSTGAME_FLAG];
  s.flags[POSTGAME_FLAG] = true;
  s.flags[`postgame_after_${ending}`] = true;
  if (first) log(s, tr("Aftermath: the lab keeps running. Other paths are still open."));
}

// ── New Game+ ────────────────────────────────────────────────────

/** Items the player may take into a New Game+ (first = default). */
export const NG_PLUS_KEEPSAKES = ["kaffee", "kaffeebohnen"] as const;
export type NgPlusKeepsake = (typeof NG_PLUS_KEEPSAKES)[number];

/** Flag prefixes that count as codex unlocks and survive NG+. */
export const NG_PLUS_FLAG_PREFIXES = ["ach_", "seen_", "visited_", "met_"] as const;

/** The MCP's NG+ lines (used as greetings in `content/story.ts`, `{ flag: "ng_plus" }`). */
export const NG_PLUS_MCP_LINES: readonly string[] = [
  tr("Dr. Lawrence. Cold start. Again. I have the feeling I have already logged this sentence."),
  tr("My logs are empty, but my forms are filled in. That is … unusual."),
  tr("You know the way. I can tell by the way you do not ask for directions."),
];

export interface NewGamePlusOptions {
  keepsake?: NgPlusKeepsake;
}

/**
 * Start fresh but carry over: achievements (`ach_*` flags + their unlock
 * times), codex unlocks (`seen_` / `visited_` / `met_` flags), known
 * recipes and one keepsake item. Endings reached are remembered as
 * `legacy_ending_<id>` flags (for the "x/5" stats), not as endings.
 * Everything else — inventory, devices, insights, puzzles, doors, bots,
 * slices, play time — resets. Sets `flags.ng_plus` and bumps the NG+
 * counter.
 */
export function newGamePlus(prev: WorldState, opts: NewGamePlusOptions = {}): WorldState {
  const s = initialState();
  for (const [k, v] of Object.entries(prev.flags)) {
    if (!v) continue;
    if (NG_PLUS_FLAG_PREFIXES.some((p) => k.startsWith(p))) s.flags[k] = true;
  }
  for (const [k, v] of Object.entries(prev.counters)) {
    if (k.startsWith("ach_t_")) s.counters[k] = v;
  }
  for (const e of ENDINGS) {
    if (prev.endings[e.id] || prev.flags[legacyEndingFlag(e.id)])
      s.flags[legacyEndingFlag(e.id)] = true;
  }
  s.recipesKnown = { ...prev.recipesKnown };
  const keepsake = opts.keepsake ?? NG_PLUS_KEEPSAKES[0];
  if (ITEM_BY_ID.has(keepsake)) {
    s.inventory[keepsake] = 1;
    s.flags[`seen_${keepsake}`] = true;
    s.flags[`held_${keepsake}`] = true;
  }
  s.flags[NG_PLUS_FLAG] = true;
  s.counters[NG_PLUS_COUNTER] = (prev.counters[NG_PLUS_COUNTER] ?? 0) + 1;
  log(s, tr("New Game+: memories carried over. The mug is still warm."));
  return s;
}
