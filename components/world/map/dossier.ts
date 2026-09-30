/**
 * Map dossier (pure): what the side panel says about one thing on the map
 * — details and what the player can do with it. Reuses the game rules
 * (`checkStage`, `missingParts`, `recipeChain`, `deviceHasUse`, …) and the
 * inventory panel's "uses" derivation; nothing here mutates the state.
 */
import { isWearPickupItem, wearItemName } from "@/lib/world/wardrobe";
import { tr } from "@/lib/i18n";
import { recipeUses, stageUses } from "@/components/world/panels/derive";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { DOORS, NOTES, PICKUPS, PROPS } from "@/lib/world/content/map";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import { BOT_QUESTS, NPCS, NPC_SPEAKERS } from "@/lib/world/content/story";
import { ROOM_TERMINAL_BY_ID, type TerminalRole } from "@/lib/world/content/terminals";
import type { DecorVerb } from "@/lib/world/content/decor-actions";
import { interiorFor } from "@/lib/world/content/interior";
import { decorActionFor, propDecorAction, cooldownLeft } from "@/lib/world/decor-actions";
import {
  checkStage,
  describeCond,
  deviceHasUse,
  evalCond,
  isBuilt,
  itemDef,
  maxCombineInputs,
  missingParts,
  pickupRespawnLeft,
  puzzleLockHint,
  stagesDone,
} from "@/lib/world/game";
import {
  CATEGORY_LABEL,
  ROOM_FOG_LABEL,
  STATUS_LABEL,
  npcMet,
  type MapEntity,
  type MapModel,
  type MapRoom,
} from "@/lib/world/map-data";
import type { DeviceEffect, NoteDef, PuzzleKind, WorldState } from "@/lib/world/types";

export interface DossierRow {
  label: string;
  value: string;
}

export interface DossierSection {
  title: string;
  rows?: DossierRow[];
  items?: string[];
  text?: string;
  /** Recipe chain lines ("High Alloy = 2 Base Alloy + Energy Cell"). */
  chain?: string[];
}

export interface Dossier {
  title: string;
  kicker: string;
  statusText: string;
  /** Flavour/summary paragraph. */
  lead?: string;
  sections: DossierSection[];
  /** Id of a read note (dossier offers "Open note"). */
  noteId?: string;
}

// ── Labels ───────────────────────────────────────────────────────

export const EFFECT_LABEL: Record<DeviceEffect, string> = {
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

export const PUZZLE_KIND_LABEL: Record<PuzzleKind, string> = {
  pipes: tr("puzzle kind::Pipe routing"),
  valve: tr("puzzle kind::Valve"),
  lissajous: tr("puzzle kind::Lissajous figure"),
  cipher: tr("puzzle kind::Cipher"),
  tones: tr("puzzle kind::Tone sequence"),
  heat: tr("puzzle kind::Heat balance"),
  coolant: tr("puzzle kind::Coolant mix"),
  keypad: tr("puzzle kind::Keypad code"),
  crc: tr("puzzle kind::Checksum"),
  sigils: tr("puzzle kind::Sigils"),
  temporal: tr("puzzle kind::Time logs"),
  laser: tr("puzzle kind::Laser optics"),
  hue: tr("puzzle kind::Colour gradient"),
  era: tr("puzzle kind::Era sorting"),
  arbitrage: tr("puzzle kind::Trading"),
  ethics: tr("puzzle kind::Ethics"),
  memetic: tr("puzzle kind::Memetics"),
  stencil: tr("puzzle kind::Stencil"),
  clamp: tr("puzzle kind::Clamp"),
  trend: tr("puzzle kind::Trend"),
  palette: tr("puzzle kind::Palette"),
  layers: tr("puzzle kind::Layers"),
  solder: tr("puzzle kind::Soldering"),
  wiring: tr("puzzle kind::Wiring"),
  morse: tr("puzzle kind::Morse"),
  radio: tr("puzzle kind::Radio tuning"),
};

/** Localized decor verb (focus label, dossier). */
export const VERB_LABEL: Record<DecorVerb, string> = {
  benutzen: tr("verb::Use"),
  lesen: tr("verb::Read"),
  hören: tr("verb::Listen"),
  ansehen: tr("verb::Look"),
  sitzen: tr("verb::Sit down"),
  liegen: tr("verb::Lie down"),
  trinken: tr("verb::Drink"),
};

const ROLE_LABEL: Record<TerminalRole, string> = {
  wartung: tr("terminal role::Maintenance"),
  archiv: tr("terminal role::Archive"),
  privat: tr("terminal role::Private"),
  leitstand: tr("terminal role::Control desk"),
  forschung: tr("terminal role::Research"),
  kantine: tr("terminal role::Canteen"),
};

const AUTHOR_LABEL: Record<NoteDef["author"], string> = {
  jade: "Jade Lawrence",
  damien: "Damien Fridge",
  mcp: "MCP-000",
  bot: tr("note author::a lab bot"),
  unbekannt: tr("note author::unknown"),
};

// ── Helpers ──────────────────────────────────────────────────────

const itemName = (id: string): string => ITEM_BY_ID.get(id)?.name ?? wearItemName(id) ?? id;

function snippet(text: string, max = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

function place(model: MapModel, e: { floor: MapEntity["floor"]; room: string | null }): string {
  const fl = model.floors[e.floor];
  const room = e.room ? model.rooms.get(`room:${e.room}`) : undefined;
  if (!room) return fl.short;
  return room.fog === "unknown"
    ? `${room.code} · ${fl.short}`
    : tr("{room} ({code}) · {floor}", { room: room.name, code: room.code, floor: fl.short });
}

function watts(w: number): string {
  return w < 0
    ? tr("generates {watts} W", { watts: -w })
    : w === 0
      ? tr("no power draw")
      : tr("draws {watts} W", { watts: w });
}

/** Where an item is used: next build stages and recipes (inventory panel logic). */
function itemUses(s: WorldState, id: string): string[] {
  const def = itemDef(s, id) ?? ITEM_BY_ID.get(id);
  if (!def) return [];
  const out: string[] = [];
  for (const u of stageUses(s, def).slice(0, 3))
    out.push(
      tr("{item} → {device}, stage “{stage}” ({slot})", {
        item: def.name,
        device: u.device.name,
        stage: u.stageName,
        slot: u.label,
      }),
    );
  for (const r of recipeUses(s, id).slice(0, 2))
    out.push(tr("{item} → recipe for {output}", { item: def.name, output: itemName(r.output) }));
  return out;
}

// ── Per category ─────────────────────────────────────────────────

function deviceDossier(s: WorldState, model: MapModel, e: MapEntity): Dossier {
  const d = DEVICE_BY_ID.get(e.id)!;
  const done = stagesDone(s, d.id);
  const sections: DossierSection[] = [
    {
      title: tr("dossier::Overview"),
      rows: [
        { label: tr("dossier::Tier"), value: String(d.tier) },
        { label: tr("dossier::Location"), value: place(model, e) },
        { label: tr("dossier::Function"), value: EFFECT_LABEL[d.effect] },
        { label: tr("dossier::Power"), value: watts(d.power) },
        {
          label: tr("dossier::Build stage"),
          value: tr("{done}/{total}", { done, total: d.stages.length }),
        },
      ],
    },
  ];
  const check = checkStage(s, d.id);
  if (check && !check.complete) {
    const stage = d.stages[check.stageIndex]!;
    sections.push({
      title: tr("Next stage: {name}", { name: stage.name }),
      items: check.blockers.length
        ? check.blockers
        : [tr("Everything is ready — build it at the device.")],
    });
    const missing = missingParts(s, d.id);
    if (missing.length)
      sections.push({
        title: tr("dossier::Missing parts"),
        items: missing.map((m) =>
          tr("{label}: {have}/{count}× {item}", {
            label: m.label,
            have: m.have,
            count: m.count,
            item: itemName(m.item),
          }),
        ),
        chain: missing.flatMap((m) => m.chain.map((c) => c.text)),
      });
  }
  const unlocks = DEVICES.filter((x) => x.needs.includes(d.id));
  const needs = d.needs.filter((n) => !isBuilt(s, n));
  const provides: string[] = [];
  if (unlocks.length)
    provides.push(
      tr("Required for: {list}", {
        list: unlocks.map((u) => (s.discovered[u.id] ? u.name : "???")).join(", "),
      }),
    );
  if (needs.length)
    provides.push(
      tr("Needs first: {list}", {
        list: needs.map((n) => DEVICE_BY_ID.get(n)?.name ?? n).join(", "),
      }),
    );
  if (deviceHasUse(d.id)) provides.push(tr("Can be operated while online (“Use” at the device)."));
  if (provides.length) sections.push({ title: tr("dossier::Connections"), items: provides });
  return {
    title: e.name,
    kicker: CATEGORY_LABEL.device,
    statusText: e.statusText,
    lead: d.summary,
    sections,
  };
}

function pickupDossier(s: WorldState, model: MapModel, e: MapEntity): Dossier {
  const p = PICKUPS.find((x) => x.id === e.id)!;
  const rows = [{ label: tr("dossier::Location"), value: place(model, e) }];
  const sections: DossierSection[] = [];
  const contents = p.pool?.length
    ? [tr("{n} random parts per opening (recycling pool)", { n: p.poolCount ?? 3 })]
    : p.items.map((it) => {
        // Wardrobe finds stay a surprise until picked up.
        if (!isWearPickupItem(it.item)) return `${it.count}× ${itemName(it.item)}`;
        const name = wearItemName(it.item);
        return s.taken[p.id] !== undefined && name
          ? tr("{name} (in Jade's wardrobe)", { name })
          : tr("Something for Jade's wardrobe");
      });
  sections.push({ title: tr("dossier::Contents"), items: contents });
  const how: string[] = [];
  if (p.puzzle) {
    const pz = PUZZLE_BY_ID.get(p.puzzle);
    if (pz) {
      rows.push({
        label: tr("dossier::Puzzle"),
        value: `${pz.title} · ${PUZZLE_KIND_LABEL[pz.kind]}`,
      });
      if (s.puzzles[p.puzzle]) how.push(tr("Puzzle solved — the lock is open."));
      else {
        const lock = puzzleLockHint(s, p.puzzle);
        how.push(lock ?? tr("Solve the puzzle at the container to open it."));
        if (pz.intro) sections.push({ title: tr("dossier::Hint"), text: snippet(pz.intro, 260) });
      }
    }
  }
  if (p.hidden && !evalCond(s, p.hidden))
    how.push(tr("Hidden until: {cond}", { cond: describeCond(p.hidden) }));
  if (p.tool)
    how.push(
      tr("Full salvage needs {tool}; by hand you only get the first part.", {
        tool: DEVICE_BY_ID.get(p.tool)?.name ?? p.tool,
      }),
    );
  if (p.respawn) {
    const left = Math.ceil(pickupRespawnLeft(s, p));
    how.push(
      left > 0
        ? tr("Refills — next load in {n} s.", { n: left })
        : tr("Refills over time after you empty it."),
    );
  }
  if (how.length) sections.push({ title: tr("dossier::How to get it"), items: how });
  const uses = p.pool?.length ? [] : p.items.flatMap((it) => itemUses(s, it.item)).slice(0, 6);
  if (uses.length) sections.push({ title: tr("dossier::Where it is used"), items: uses });
  const first = p.items[0] ? ITEM_BY_ID.get(p.items[0].item) : undefined;
  return {
    title: e.name,
    kicker: CATEGORY_LABEL[e.category],
    statusText: e.statusText,
    lead: first && !p.pool?.length ? snippet(first.description, 180) : undefined,
    sections: [{ title: tr("dossier::Overview"), rows }, ...sections],
  };
}

function noteDossier(s: WorldState, model: MapModel, e: MapEntity): Dossier {
  const n = NOTES.find((x) => x.id === e.id)!;
  const read = !!s.read[n.id];
  return {
    title: n.title,
    kicker: CATEGORY_LABEL.note,
    statusText: e.statusText,
    lead: read ? snippet(n.body) : tr("Not read yet — go there and read it."),
    sections: [
      {
        title: tr("dossier::Overview"),
        rows: [
          { label: tr("dossier::Location"), value: place(model, e) },
          { label: tr("dossier::Author"), value: read ? AUTHOR_LABEL[n.author] : "???" },
          {
            label: tr("dossier::Insights"),
            value: n.grants?.length
              ? tr("{n} insight(s)", { n: n.grants.length })
              : tr("dossier::none"),
          },
        ],
      },
    ],
    ...(read ? { noteId: n.id } : {}),
  };
}

function npcDossier(s: WorldState, model: MapModel, e: MapEntity): Dossier {
  const n = NPCS.find((x) => x.id === e.id)!;
  const quest = BOT_QUESTS.find((q) => q.npc === n.id);
  const met = npcMet(s, n.id);
  const sections: DossierSection[] = [
    {
      title: tr("dossier::Overview"),
      rows: [
        { label: tr("dossier::Location"), value: place(model, e) },
        {
          label: tr("dossier::Met"),
          value: met ? tr("dossier::yes") : tr("dossier::not yet"),
        },
      ],
    },
  ];
  if (quest) {
    const awake = !!s.flags[quest.flag];
    sections.push(
      awake
        ? { title: tr("dossier::Reactivated"), text: quest.reward }
        : { title: tr("dossier::What it needs"), text: quest.hint },
    );
  }
  return {
    title: NPC_SPEAKERS[n.id]?.name ?? n.name,
    kicker: quest ? tr("Lore bot") : CATEGORY_LABEL.npc,
    statusText: e.statusText,
    lead: met ? undefined : tr("Talk to them to learn more."),
    sections,
  };
}

function propDossier(s: WorldState, model: MapModel, e: MapEntity): Dossier {
  const p = PROPS.find((x) => x.id === e.id)!;
  const usable = evalCond(s, p.requires);
  const rows = [{ label: tr("dossier::Location"), value: place(model, e) }];
  const actions: string[] = [];
  const sections: DossierSection[] = [];
  let lead: string | undefined;
  if (p.kind === "workbench")
    actions.push(
      tr("Combine up to {n} items into parts or prototypes.", { n: maxCombineInputs(s) }),
    );
  if (p.kind === "forge") actions.push(tr("Forge crystal slices at the Infinity Forge."));
  if (p.kind === "terminal") actions.push(tr("Opens the big _unOS terminal."));
  if (p.kind === "elevator") {
    actions.push(tr("Travel between levels."));
    for (const stop of model.shaft)
      actions.push(
        stop.accessible
          ? tr("{floor}: reachable", { floor: stop.name })
          : tr("{floor}: {hint}", { floor: stop.name, hint: stop.hint }),
      );
  }
  if (p.kind === "puzzle" && p.puzzle) {
    const pz = PUZZLE_BY_ID.get(p.puzzle);
    if (pz) {
      rows.push({
        label: tr("dossier::Puzzle"),
        value: `${pz.title} · ${PUZZLE_KIND_LABEL[pz.kind]}`,
      });
      if (s.puzzles[p.puzzle]) actions.push(tr("Solved."));
      else {
        actions.push(tr("Solve the puzzle here."));
        const lock = puzzleLockHint(s, p.puzzle);
        if (lock) actions.push(lock);
      }
      lead = snippet(pz.intro, 260);
      const reward = pz.reward?.items?.map((it) => `${it.count}× ${itemName(it.item)}`) ?? [];
      if (reward.length) sections.push({ title: tr("dossier::Reward"), items: reward });
    }
  }
  if (p.kind === "station") actions.push(tr("Interact with it."));
  if (p.grants?.length) {
    const fresh = p.grants.filter((g) => !s.insights[g]).length;
    actions.push(
      fresh
        ? tr("Reveals {n} insight(s) on first use.", { n: fresh })
        : tr("Its insights are already in your journal."),
    );
  }
  const decor = propDecorAction(p);
  if (decor) {
    rows.push({ label: tr("dossier::Action"), value: VERB_LABEL[decor.action.verb] });
    if (decor.action.requires && !evalCond(s, decor.action.requires))
      actions.push(decor.action.requiresHint ?? describeCond(decor.action.requires));
  }
  if (!usable)
    actions.unshift(
      p.requiresHint ?? tr("Needs: {cond}", { cond: p.requires ? describeCond(p.requires) : "?" }),
    );
  return {
    title: p.label,
    kicker: CATEGORY_LABEL[e.category],
    statusText: e.statusText,
    lead,
    sections: [
      { title: tr("dossier::Overview"), rows },
      ...(actions.length ? [{ title: tr("dossier::What you can do"), items: actions }] : []),
      ...sections,
    ],
  };
}

function terminalDossier(s: WorldState, model: MapModel, e: MapEntity): Dossier {
  const t = ROOM_TERMINAL_BY_ID.get(e.id)!;
  const items: string[] = [];
  if (!evalCond(s, t.requires))
    items.push(
      t.requiresHint ?? tr("Needs: {cond}", { cond: t.requires ? describeCond(t.requires) : "?" }),
    );
  if (t.mail?.length) items.push(tr("{n} mail(s) to read", { n: t.mail.length }));
  if (t.files?.length) items.push(tr("{n} file(s)", { n: t.files.length }));
  if (t.caps?.includes("power")) items.push(tr("Shows the power grid."));
  if (t.caps?.includes("signal")) items.push(tr("Can tune the lab signal."));
  return {
    title: t.label,
    kicker: CATEGORY_LABEL.terminal,
    statusText: e.statusText,
    lead: t.purpose,
    sections: [
      {
        title: tr("dossier::Overview"),
        rows: [
          { label: tr("dossier::Location"), value: place(model, e) },
          { label: tr("dossier::Role"), value: ROLE_LABEL[t.role] },
        ],
      },
      ...(items.length ? [{ title: tr("dossier::What you can do"), items }] : []),
    ],
  };
}

function decorDossier(s: WorldState, model: MapModel, e: MapEntity): Dossier {
  const placement = interiorFor(e.floor).find((p) => p.id === e.id);
  const action = placement ? decorActionFor(placement.decor, placement.room) : undefined;
  const items: string[] = [];
  if (action) {
    if (action.requires && !evalCond(s, action.requires))
      items.push(action.requiresHint ?? describeCond(action.requires));
    const cd = Math.ceil(cooldownLeft(s, action.id, s.playTime));
    if (cd > 0) items.push(tr("Ready again in {n} s.", { n: cd }));
  }
  return {
    title: e.name,
    kicker: CATEGORY_LABEL.decor,
    statusText: e.statusText,
    sections: [
      {
        title: tr("dossier::Overview"),
        rows: [
          { label: tr("dossier::Location"), value: place(model, e) },
          ...(action ? [{ label: tr("dossier::Action"), value: VERB_LABEL[action.verb] }] : []),
        ],
      },
      ...(items.length ? [{ title: tr("dossier::What you can do"), items }] : []),
    ],
  };
}

function doorDossier(model: MapModel, e: MapEntity): Dossier {
  const d = DOORS.find((x) => x.id === e.id);
  const items: string[] = [];
  if (e.status === "door_keypad") items.push(tr("Enter the code at the keypad next to the door."));
  if (e.status === "door_suspected")
    items.push(tr("You suspect a hidden passage here. A scan or a laser cut would reveal it."));
  if (e.status === "door_secret") items.push(tr("A hidden passage you uncovered."));
  const locked = e.status === "door_locked" || e.status === "door_keypad";
  const hint =
    d && locked ? (d.lockHint ?? (d.lock ? describeCond(d.lock) : undefined)) : undefined;
  return {
    title: e.name,
    kicker: CATEGORY_LABEL.door,
    statusText: STATUS_LABEL[e.status],
    lead: hint,
    sections: [
      {
        title: tr("dossier::Overview"),
        rows: [{ label: tr("dossier::Location"), value: place(model, e) }],
      },
      ...(items.length ? [{ title: tr("dossier::What you can do"), items }] : []),
    ],
  };
}

/** Dossier of one map entity. */
export function entityDossier(s: WorldState, model: MapModel, e: MapEntity): Dossier {
  switch (e.category) {
    case "device":
      return deviceDossier(s, model, e);
    case "item":
    case "slice":
    case "cache":
      return pickupDossier(s, model, e);
    case "note":
      return noteDossier(s, model, e);
    case "npc":
      return npcDossier(s, model, e);
    case "terminal":
      return ROOM_TERMINAL_BY_ID.has(e.id)
        ? terminalDossier(s, model, e)
        : propDossier(s, model, e);
    case "decor":
      return PROPS.some((p) => p.id === e.id)
        ? propDossier(s, model, e)
        : decorDossier(s, model, e);
    case "door":
      return doorDossier(model, e);
    default:
      return propDossier(s, model, e);
  }
}

/** Dossier of a room: fog, light, blurb and what is known inside. */
export function roomDossier(model: MapModel, r: MapRoom): Dossier {
  const fl = model.floors[r.floor];
  const inside = fl.entities.filter((e) => e.room === r.id && e.category !== "decor");
  const byCat = new Map<string, number>();
  for (const e of inside)
    byCat.set(CATEGORY_LABEL[e.category], (byCat.get(CATEGORY_LABEL[e.category]) ?? 0) + 1);
  const unknown = r.fog === "unknown";
  return {
    title: unknown ? `${r.code} · ?` : r.name,
    kicker: tr("dossier::Room"),
    statusText: ROOM_FOG_LABEL[r.fog],
    lead: r.fog === "visited" ? r.blurb : undefined,
    sections: [
      {
        title: tr("dossier::Overview"),
        rows: [
          { label: tr("dossier::Code"), value: r.code },
          { label: tr("dossier::Level"), value: fl.name },
          {
            label: tr("dossier::Light"),
            value: r.fog === "visited" ? (r.lit ? tr("dossier::on") : tr("dossier::dark")) : "?",
          },
          ...(r.secret ? [{ label: tr("dossier::Access"), value: tr("secret passage") }] : []),
        ],
      },
      ...(byCat.size
        ? [
            {
              title: tr("dossier::Known here"),
              items: [...byCat.entries()].map(([label, n]) => tr("{label}: {n}", { label, n })),
            },
          ]
        : []),
    ],
  };
}
