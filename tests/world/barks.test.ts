import { describe, expect, it } from "vitest";
import { SFX_NAMES } from "@/lib/world/audio/sfx";
import {
  BARK_SPEAKERS,
  BarkEngine,
  GLOBAL_GAP,
  SPEAKER_GAP,
  SPEAKER_SFX,
  barkSeconds,
  speakerAvailable,
  type BarkTrigger,
} from "@/lib/world/barks";
import { BARKS, BARK_BOTS, BARK_TRIGGERS, type BarkDef } from "@/lib/world/content/barks";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { FLOORS, ROOM_BY_ID, ROOMS } from "@/lib/world/content/map";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { ENDINGS, INSIGHT_BY_ID, INSIGHTS } from "@/lib/world/content/story";
import { initialState } from "@/lib/world/game";
import type { Condition, WorldState } from "@/lib/world/types";

function build(s: WorldState, ...ids: string[]): void {
  for (const id of ids) {
    const d = DEVICE_BY_ID.get(id)!;
    s.built[id] = d.stages.length;
    s.switchedOn[id] = true;
  }
}

function condOk(c: Condition | undefined): boolean {
  if (!c) return true;
  if ("all" in c) return c.all.every(condOk);
  if ("any" in c) return c.any.every(condOk);
  if ("not" in c) return condOk(c.not);
  if ("device" in c) return DEVICE_BY_ID.has(c.device);
  if ("insight" in c) return INSIGHT_BY_ID.has(c.insight);
  return true;
}

/** Only the given bark list, so tests control the pool. */
function engineWith(list: BarkDef[]): BarkEngine {
  const m = new Map<BarkTrigger, BarkDef[]>();
  for (const b of list) m.set(b.trigger, [...(m.get(b.trigger) ?? []), b]);
  return new BarkEngine(m);
}

describe("bark content", () => {
  it("has at least 250 lines with unique ids", () => {
    expect(BARKS.length).toBeGreaterThanOrEqual(250);
    expect(new Set(BARKS.map((b) => b.id)).size).toBe(BARKS.length);
  });

  it("references only valid ids", () => {
    const floors = new Set(FLOORS.map((f) => f.id));
    const themes = new Set(ROOMS.map((r) => r.theme ?? "generic"));
    const kinds = new Set(PUZZLES.map((p) => p.kind));
    const threads = new Set(INSIGHTS.map((i) => i.thread));
    const endings = new Set(ENDINGS.map((e) => e.id));
    const sfx = new Set<string>(SFX_NAMES);
    const triggers = new Set<string>(BARK_TRIGGERS);
    for (const b of BARKS) {
      const where = `${b.id}`;
      expect(triggers.has(b.trigger), where).toBe(true);
      expect(BARK_SPEAKERS[b.who], where).toBeDefined();
      expect(b.text.trim().length, where).toBeGreaterThan(3);
      expect(b.text.length, where).toBeLessThanOrEqual(140);
      const on = b.on ?? {};
      if (on.floor !== undefined) expect(floors.has(on.floor), where).toBe(true);
      if (on.room !== undefined) expect(ROOM_BY_ID.has(on.room), where).toBe(true);
      if (on.theme !== undefined) expect(themes.has(on.theme), where).toBe(true);
      if (on.device !== undefined) expect(DEVICE_BY_ID.has(on.device), where).toBe(true);
      if (on.kind !== undefined) expect(kinds.has(on.kind), where).toBe(true);
      if (on.thread !== undefined) expect(threads.has(on.thread), where).toBe(true);
      if (on.ending !== undefined) expect(endings.has(on.ending), where).toBe(true);
      if (on.bot !== undefined) expect(BARK_BOTS).toContain(on.bot);
      if (b.sfx) expect(sfx.has(b.sfx), where).toBe(true);
      if (on.first !== undefined) expect(["enter_room", "enter_floor"], where).toContain(b.trigger);
      expect(condOk(b.when), where).toBe(true);
    }
    for (const v of Object.values(SPEAKER_SFX)) expect(sfx.has(v)).toBe(true);
  });

  it("covers every trigger, floor and bot", () => {
    for (const t of BARK_TRIGGERS)
      expect(
        BARKS.some((b) => b.trigger === t),
        t,
      ).toBe(true);
    for (const f of FLOORS)
      expect(BARKS.some((b) => b.trigger === "enter_floor" && b.on?.floor === f.id)).toBe(true);
    for (const bot of BARK_BOTS) {
      expect(BARKS.some((b) => b.trigger === "bot_awake" && b.who === bot)).toBe(true);
      expect(BARKS.filter((b) => b.who === bot).length, bot).toBeGreaterThanOrEqual(4);
    }
    expect(BARKS.filter((b) => b.who === "pa").length).toBeGreaterThanOrEqual(30);
    expect(BARKS.filter((b) => b.who === "damien").length).toBeGreaterThanOrEqual(10);
    // Damien lines carry the echo tags.
    for (const b of BARKS.filter((x) => x.who === "damien"))
      expect(/\[(SIGNAL WEAK|PATTERN STABLE)\]/.test(b.text), b.id).toBe(true);
  });

  it("subtitle duration is bounded", () => {
    expect(barkSeconds("Hi")).toBe(3);
    expect(barkSeconds("x".repeat(500))).toBe(9);
  });
});

describe("speaker gating", () => {
  it("gates bots, Damien and the rift voices", () => {
    const s = initialState();
    expect(speakerAvailable(s, "mcp")).toBe(true);
    expect(speakerAvailable(s, "pa")).toBe(true);
    expect(speakerAvailable(s, "r3tr0")).toBe(false);
    s.flags.bot_r3tr0_awake = true;
    expect(speakerAvailable(s, "r3tr0")).toBe(true);
    expect(speakerAvailable(s, "damien")).toBe(false);
    build(s, "UEC-001", "ECR-001");
    expect(speakerAvailable(s, "damien")).toBe(true);
    expect(speakerAvailable(s, "unstables")).toBe(false);
    expect(speakerAvailable(s, "halo")).toBe(false);
    build(s, "DIM-001");
    expect(speakerAvailable(s, "unstables")).toBe(true);
  });

  it("never picks a sleeping bot or Damien without ECR-001", () => {
    const e = new BarkEngine();
    const s = initialState();
    for (let i = 0; i < 400; i++) {
      const trig = BARK_TRIGGERS[i % BARK_TRIGGERS.length]!;
      const room = ROOMS[i % ROOMS.length]!.id;
      const b = e.event(trig, { room }, s, i * 60);
      if (b) {
        expect(BARK_BOTS as readonly string[]).not.toContain(b.who);
        expect(["damien", "halo", "unstables"]).not.toContain(b.who);
      }
    }
  });
});

describe("BarkEngine selection", () => {
  const mk = (id: string, extra: Partial<BarkDef> = {}): BarkDef => ({
    id,
    who: "mcp",
    text: `Zeile ${id}`,
    trigger: "idle",
    ...extra,
  });

  it("respects the global gap and the speaker gap", () => {
    const e = engineWith([mk("a", { cooldown: 0 }), mk("b", { who: "jade", cooldown: 0 })]);
    const s = initialState();
    const first = e.event("idle", {}, s, 100);
    expect(first).not.toBeNull();
    expect(e.event("idle", {}, s, 100 + GLOBAL_GAP - 1)).toBeNull();
    const second = e.event("idle", {}, s, 100 + GLOBAL_GAP + 1);
    expect(second).not.toBeNull();
    expect(second!.who).not.toBe(first!.who);
    // Both speakers are now inside their speaker gap.
    expect(e.event("idle", {}, s, 100 + 2 * GLOBAL_GAP + 2)).toBeNull();
    expect(e.event("idle", {}, s, 100 + SPEAKER_GAP + GLOBAL_GAP + 2)).not.toBeNull();
  });

  it("respects per-line cooldown and once", () => {
    const e = engineWith([mk("once", { once: true })]);
    const s = initialState();
    expect(e.event("idle", {}, s, 10)?.id).toBe("once");
    expect(e.event("idle", {}, s, 10_000)).toBeNull();

    const e2 = engineWith([mk("cd", { cooldown: 500 })]);
    const s2 = initialState();
    expect(e2.event("idle", {}, s2, 10)?.id).toBe("cd");
    expect(e2.event("idle", {}, s2, 300)).toBeNull();
    expect(e2.event("idle", {}, s2, 520)?.id).toBe("cd");
  });

  it("evaluates conditions and context filters", () => {
    const e = engineWith([
      mk("cond", { when: { flag: "testflag" } }),
      mk("room", { on: { room: "archiv" }, who: "jade" }),
    ]);
    const s = initialState();
    expect(e.event("idle", { room: "kontroll" }, s, 10)).toBeNull();
    expect(e.event("idle", { room: "archiv" }, s, 30)?.id).toBe("room");
    s.flags.testflag = true;
    expect(e.event("idle", { room: "kontroll" }, s, 100)?.id).toBe("cond");
  });

  it("fills theme/floor from the room and tier from the device", () => {
    const e = engineWith([
      mk("theme", { on: { theme: "server", floor: 1 } }),
      mk("tier", { trigger: "device_built", on: { tier: 3 }, who: "jade" }),
    ]);
    const s = initialState();
    expect(e.event("idle", { room: "rechen" }, s, 10)?.id).toBe("theme");
    let hit = false;
    for (let t = 100; t < 400 && !hit; t += 13) {
      hit = e.event("device_built", { device: "MFR-001" }, s, t)?.id === "tier";
    }
    expect(hit).toBe(true);
  });

  it("gates Damien lines on ECR-001", () => {
    const e = engineWith([mk("dam", { who: "damien", text: "[SIGNAL SCHWACH] …" })]);
    const s = initialState();
    expect(e.event("idle", {}, s, 10)).toBeNull();
    build(s, "UEC-001", "ECR-001");
    expect(e.event("idle", {}, s, 30)?.who).toBe("damien");
  });

  it("tracks first visits itself", () => {
    const e = engineWith([
      mk("f", { trigger: "enter_room", on: { room: "archiv", first: true } }),
      mk("r", { trigger: "enter_room", on: { room: "archiv", first: false }, cooldown: 0 }),
    ]);
    const s = initialState();
    const firstHit = e.event("enter_room", { room: "archiv" }, s, 10);
    expect(firstHit === null || firstHit.id === "f").toBe(true);
    expect(s.counters["bark:seen:room:archiv"]).toBe(1);
    for (let t = 100; t < 2000; t += 60) {
      const b = e.event("enter_room", { room: "archiv" }, s, t);
      if (b) expect(b.id).toBe("r");
    }
  });

  it("is deterministic", () => {
    const run = () => {
      const e = new BarkEngine();
      const s = initialState();
      build(s, "UEC-001", "ECR-001", "DIM-001");
      s.flags.bot_r3tr0_awake = true;
      s.flags.bot_b4c0n_awake = true;
      const out: string[] = [];
      for (let i = 0; i < 300; i++) {
        const trig = BARK_TRIGGERS[(i * 7) % BARK_TRIGGERS.length]!;
        const b = e.event(trig, { room: ROOMS[(i * 3) % ROOMS.length]!.id }, s, i * 20);
        out.push(b ? b.id : "-");
      }
      return out;
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a.filter((x) => x !== "-").length).toBeGreaterThan(20);
  });

  it("tick fires idle, night and ambient barks", () => {
    const e = new BarkEngine();
    const s = initialState();
    build(s, "UEC-001");
    const seen = new Set<string>();
    for (let t = 1; t <= 4000; t++) {
      s.playTime = t;
      const b = e.tick(s, t, { room: "kontroll", idleSeconds: t % 400 });
      if (b) seen.add(b.id.split(".")[0]!);
    }
    expect(seen.has("idle")).toBe(true);
    expect(seen.has("night")).toBe(true);
    expect(seen.has("amb")).toBe(true);
    expect(s.counters["bark:night"]).toBe(2);
  });

  it("tick reports low power", () => {
    const e = new BarkEngine();
    const s = initialState();
    let low = false;
    for (let t = 1; t <= 400 && !low; t++) {
      s.playTime = t;
      low = e.tick(s, t, { room: "kontroll", idleSeconds: 0 })?.id.startsWith("lowpower") ?? false;
    }
    expect(low).toBe(true);
  });
});
