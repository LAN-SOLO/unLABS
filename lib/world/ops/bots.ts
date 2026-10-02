/**
 * Bot operations — duties, wear, service, upgrades (pure). docs/OPS.md.
 * =====================================================================
 *
 * Every reactivated lore bot has dedicated duties (content/bot-duties.ts,
 * from the design database). A duty run applies its effect to the lab,
 * wears the bot a little; a worn-out bot (wear ≥ 100) refuses duties until
 * it has been to its service dock (`service` duty). Upgrades (level 1…3,
 * materials from UPGRADE_COST) make duties faster and wear slower — and add
 * small visual elements to the bot (models/bots.ts `upgradeParts`).
 */
import { tr } from "@/lib/i18n";
import {
  DUTY_BY_ID,
  LEVEL_SPEED,
  LEVEL_WEAR,
  UPGRADE_COST,
  type BotDuty,
} from "@/lib/world/content/bot-duties";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { PICKUPS, ROOMS } from "@/lib/world/content/map";
import { NPCS, NPC_SPEAKERS } from "@/lib/world/content/story";
import { addItem, isOnline, pickupRespawnLeft, removeItem } from "@/lib/world/game";
import {
  ALGAE_ROOMS,
  VINE_ROOMS,
  algaeStage,
  harvestAlgae,
  tidyRoom,
  waterRoom,
  lookFor,
} from "@/lib/world/aging";
import { buffKey } from "@/lib/world/buffs";
import { freshBot, MAX_LEVEL } from "@/lib/world/ops/state";
import { runRoutine, routineById } from "@/lib/world/ops/routines";
import type { BotOps, WorldState } from "@/lib/world/types";

/** Wear that stops a bot until it is serviced. */
export const WORN = 100;
/** C8-BR41N's coordination: duties of every bot run this much faster while active. */
export const COORDINATION_SPEED = 0.85;
export const COORDINATION_SECONDS = 600;

export function botName(id: string): string {
  return NPC_SPEAKERS[id]?.name ?? id.toUpperCase();
}

export function botAwake(s: WorldState, id: string): boolean {
  return !!s.flags[`bot_${id}_awake`];
}

export function botOps(s: WorldState, id: string): BotOps {
  return (s.ops.bots[id] ??= freshBot());
}

/** Interval of a duty for this bot right now (upgrades, coordination). */
export function dutyInterval(s: WorldState, duty: BotDuty): number {
  const b = botOps(s, duty.bot);
  const coord = (s.counters.ops_coord_until ?? 0) > s.playTime ? COORDINATION_SPEED : 1;
  return Math.max(60, Math.round(duty.every * (LEVEL_SPEED[b.level] ?? 1) * coord));
}

export interface DutyResult {
  ok: boolean;
  text: string;
}

const done = (bot: string, text: string): DutyResult => ({
  ok: true,
  text: `${botName(bot)}: ${text}`,
});
const fail = (bot: string, text: string): DutyResult => ({
  ok: false,
  text: `${botName(bot)}: ${text}`,
});

/** Run a duty now (mutates `s`). `arg` = duty parameter (R3-TR0: routine id). */
export function runDuty(s: WorldState, dutyId: string, arg?: string): DutyResult {
  const duty = DUTY_BY_ID.get(dutyId);
  if (!duty) return { ok: false, text: tr("Unknown duty.") };
  const bot = duty.bot;
  if (!botAwake(s, bot)) return fail(bot, tr("still dormant."));
  const b = botOps(s, bot);
  if (duty.effect === "service") {
    b.wear = 0;
    b.serviced = s.playTime;
    return done(bot, tr("serviced at its dock — wear back to zero."));
  }
  if (b.wear >= WORN) return fail(bot, tr("worn out — needs its service dock first."));
  const res = applyEffect(s, duty, arg);
  if (res.ok) {
    b.runs++;
    b.wear = Math.min(WORN, b.wear + duty.wear * (LEVEL_WEAR[b.level] ?? 1));
  }
  return res;
}

function applyEffect(s: WorldState, duty: BotDuty, arg?: string): DutyResult {
  const bot = duty.bot;
  const lvl = botOps(s, bot).level;
  switch (duty.effect) {
    case "patrol": {
      const npcFloor = ROOMS.filter((r) => r.floor === floorOfBot(s, bot));
      for (const r of npcFloor) tidyRoom(s, r.id);
      return done(bot, tr("patrolled {n} rooms and swept the dust.", { n: npcFloor.length }));
    }
    case "signal": {
      // Own schedule: every run drops something it "heard" from its level's finds.
      const pool = PICKUPS.filter((p) => p.floor === floorOfBot(s, bot)).flatMap((p) => p.items);
      const pick = pool[(s.ops.next * 7 + Math.floor(s.playTime)) % Math.max(1, pool.length)];
      if (!pick) return done(bot, tr("listened to the void. Nothing."));
      addItem(s, pick.item, 1);
      return done(
        bot,
        tr("dropped what it heard: {item}.", {
          item: ITEM_BY_ID.get(pick.item)?.name ?? pick.item,
        }),
      );
    }
    case "verify":
      if (!isOnline(s, "NXS-01")) return fail(bot, tr("no Nexus online to verify."));
      s.counters.research_last = 0;
      return done(bot, tr("verified the research chain — the next cycle is ready."));
    case "recover": {
      const waiting = PICKUPS.filter(
        (p) => s.taken[p.id] !== undefined && pickupRespawnLeft(s, p) > 0,
      ).sort((a, b) => pickupRespawnLeft(s, b) - pickupRespawnLeft(s, a));
      const n = 1 + lvl;
      const found = waiting.slice(0, n);
      if (!found.length) return done(bot, tr("found nothing missing."));
      for (const p of found) delete s.taken[p.id];
      return done(
        bot,
        tr("tracked down the parts of {name}.", { name: found.map((p) => p.label).join(", ") }),
      );
    }
    case "macro": {
      const r = arg ? routineById(s, arg) : s.ops.routines.find((x) => x.source !== "learned");
      if (!r) return fail(bot, tr("no routine to run."));
      const run = runRoutine(s, r.id);
      return {
        ok: run.done > 0,
        text: `${botName(bot)}: ${tr("ran “{name}” ({done}/{total}).", { name: r.name, done: run.done, total: run.total })}`,
      };
    }
    case "optimise": {
      const relief = 15 + 5 * lvl;
      for (const [id, o] of Object.entries(s.ops.bots))
        if (id !== bot) o.wear = Math.max(0, o.wear - relief);
      return done(bot, tr("reviewed every agent — their wear is down by {n}.", { n: relief }));
    }
    case "monitor": {
      const issues = surveillanceIssues(s);
      s.counters.ops_watch = s.playTime;
      return done(bot, issues.length ? issues.slice(0, 3).join(" · ") : tr("all cameras quiet."));
    }
    case "crawl": {
      for (const r of VINE_ROOMS) waterRoom(s, r);
      let algae = 0;
      for (const r of ALGAE_ROOMS) if (algaeStage(s, r) >= 2) algae += harvestAlgae(s, r);
      return done(
        bot,
        algae
          ? tr("watered the green rooms and harvested {n} glow algae.", { n: algae })
          : tr("watered the green rooms."),
      );
    }
    case "catalogue":
      s.counters[buffKey("klarer_kopf")] = s.playTime + 150 + 60 * lvl;
      return done(bot, tr("catalogued the day's finds — Jade thinks more clearly."));
    case "coordinate":
      s.counters.ops_coord_until = s.playTime + COORDINATION_SECONDS + 120 * lvl;
      return done(bot, tr("synchronised the agents — every duty runs faster for a while."));
    case "service":
      return done(bot, "");
  }
}

function floorOfBot(_s: WorldState, bot: string): number {
  return NPCS.find((n) => n.id === bot)?.floor ?? 0;
}

/** What the surveillance cameras see that needs attention (wilting plants, overflowing algae, dust, worn bots). */
export function surveillanceIssues(s: WorldState): string[] {
  const out: string[] = [];
  for (const r of ROOMS) {
    const l = lookFor(s, r.id, "plant_ficus", 0);
    if ((VINE_ROOMS as readonly string[]).includes(r.id) && l.wilt > 0)
      out.push(tr("{room}: plants need water", { room: r.name }));
    if (!l.damp && l.weather >= 3) out.push(tr("{room}: dusty", { room: r.name }));
  }
  for (const r of ALGAE_ROOMS)
    if (algaeStage(s, r) >= 2)
      out.push(tr("{room}: algae overflowing", { room: ROOMS.find((x) => x.id === r)?.name ?? r }));
  for (const [id, b] of Object.entries(s.ops.bots))
    if (b.wear >= 80) out.push(tr("{bot}: needs service", { bot: botName(id) }));
  return out;
}

// ── Upgrades ─────────────────────────────────────────────────────

export function upgradeCost(s: WorldState, bot: string): Record<string, number> | null {
  const lvl = botOps(s, bot).level;
  return lvl >= MAX_LEVEL ? null : (UPGRADE_COST[lvl + 1] ?? null);
}

export function canUpgrade(s: WorldState, bot: string): boolean {
  const cost = upgradeCost(s, bot);
  return (
    !!cost &&
    botAwake(s, bot) &&
    Object.entries(cost).every(([id, n]) => (s.inventory[id] ?? 0) >= n)
  );
}

/** Upgrade a bot one level (consumes the materials). */
export function upgradeBot(s: WorldState, bot: string): DutyResult {
  const cost = upgradeCost(s, bot);
  if (!cost) return fail(bot, tr("fully upgraded."));
  if (!canUpgrade(s, bot)) return fail(bot, tr("missing materials for the upgrade."));
  for (const [id, n] of Object.entries(cost)) removeItem(s, id, n);
  const b = botOps(s, bot);
  b.level++;
  return done(bot, tr("upgraded to level {n}.", { n: b.level }));
}
