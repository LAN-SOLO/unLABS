import { describe, expect, it } from "vitest";
import { entityDossier, roomDossier } from "@/components/world/map/dossier";
import {
  clampView,
  focusOn,
  HOME_VIEW,
  panBy,
  scaleBar,
  zoomAt,
} from "@/components/world/map/view";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { NOTES, PICKUPS, PROPS, ROOMS, roomAt } from "@/lib/world/content/map";
import { initialState } from "@/lib/world/game";
import {
  DEFAULT_MAP_FILTER,
  buildMapModel,
  filterEntities,
  floorProgress,
  foundByCategory,
  isCachePickup,
  isSlicePickup,
  mapModelCached,
  mapPin,
  searchMap,
  setMapPin,
  totalProgress,
} from "@/lib/world/map-data";
import type { WorldState } from "@/lib/world/types";

function build(s: WorldState, id: string, on = true): void {
  s.built[id] = DEVICE_BY_ID.get(id)!.stages.length;
  s.discovered[id] = true;
  s.switchedOn[id] = on;
}

function visit(s: WorldState, ...rooms: string[]): void {
  for (const r of rooms) s.flags[`visited_${r}`] = true;
}

describe("map model — rooms, fog and doors", () => {
  it("has all six floors top-down with every non-secret room", () => {
    const m = buildMapModel(initialState());
    expect(m.order).toEqual([4, 0, 1, 2, 3, 5]);
    expect(m.shaft.map((x) => x.floor)).toEqual(m.order);
    const secret = ["kartenraum", "kaeltearchiv", "c8versteck", "studio"];
    for (const r of ROOMS) {
      const listed = m.floors[r.floor].rooms.some((x) => x.id === r.id);
      expect(listed, r.id).toBe(!secret.includes(r.id));
    }
  });

  it("fog: visited, known through a visible door, unknown elsewhere", () => {
    const s = initialState();
    visit(s, "kontroll");
    const rooms = new Map(buildMapModel(s).floors[0].rooms.map((r) => [r.id, r]));
    expect(rooms.get("kontroll")!.fog).toBe("visited");
    // The airlock borders the Control Room through an open door.
    expect(rooms.get("schleuse")!.fog).toBe("known");
    // The archive is far away (behind the workshop / MCP chamber).
    expect(rooms.get("archiv")!.fog).toBe("unknown");
  });

  it("room codes are unique and carry the floor short", () => {
    const m = buildMapModel(initialState());
    const codes = m.order.flatMap((f) => m.floors[f].rooms.map((r) => r.code));
    expect(new Set(codes).size).toBe(codes.length);
    expect(m.floors[0].rooms.every((r) => r.code.startsWith(m.floors[0].short))).toBe(true);
  });

  it("door states: locked, keypad, secret found", () => {
    const s = initialState();
    let doors = new Map(buildMapModel(s).floors[0].doors.map((d) => [d.id, d]));
    expect(doors.get("d_archiv")!.state).toBe("locked");
    expect(doors.get("d_archiv")!.hint).toBeTruthy();
    expect(doors.has("d_kartenraum")).toBe(false);
    const tresor = buildMapModel(s).floors[2].doors.find((d) => d.id === "d_tresor")!;
    expect(tresor.state).toBe("keypad");
    build(s, "BTK-001");
    // Scanned open (MSC-001 online / laser cut) — the engine records it in doorsOpen.
    s.doorsOpen.d_kartenraum = true;
    doors = new Map(buildMapModel(s).floors[0].doors.map((d) => [d.id, d]));
    expect(doors.get("d_archiv")!.state).toBe("open");
    expect(doors.get("d_kartenraum")!.state).toBe("secret");
    // The secret room shows up once its door is found.
    expect(buildMapModel(s).floors[0].rooms.some((r) => r.id === "kartenraum")).toBe(true);
  });

  it("locked doors are entities with a lock hint; open ones are not", () => {
    const m = buildMapModel(initialState());
    const door = m.entities.get("door:d_archiv")!;
    expect(door.status).toBe("door_locked");
    expect(door.category).toBe("door");
    expect(m.entities.has("door:d_schleuse")).toBe(false);
  });
});

describe("map model — entities and statuses", () => {
  it("devices: only discovered ones, with build status", () => {
    const s = initialState();
    const m = buildMapModel(s);
    const all = m.order.flatMap((f) => m.floors[f].entities.filter((e) => e.category === "device"));
    expect(all.every((e) => s.discovered[e.id])).toBe(true);
    expect(m.entities.get("device:UEC-001")!.status).toBe("blueprint");
    s.built["UEC-001"] = 1;
    expect(buildMapModel(s).entities.get("device:UEC-001")!.status).toBe("building");
    build(s, "UEC-001", false);
    expect(buildMapModel(s).entities.get("device:UEC-001")!.status).toBe("off");
    s.switchedOn["UEC-001"] = true;
    const on = buildMapModel(s).entities.get("device:UEC-001")!;
    expect(on.status).toBe("online");
    expect(on.found).toBe(true);
  });

  it("pickups appear once their room was visited and turn 'taken' when collected", () => {
    const s = initialState();
    const pk = PICKUPS.find((p) => p.id === "p_kontroll_kiste")!;
    expect(buildMapModel(s).entities.has(`item:${pk.id}`)).toBe(false);
    visit(s, "kontroll");
    const e = buildMapModel(s).entities.get(`item:${pk.id}`)!;
    expect(e.status).toBe("available");
    expect(e.found).toBe(false);
    s.taken[pk.id] = 0;
    const t = buildMapModel(s).entities.get(`item:${pk.id}`)!;
    expect(t.status).toBe("taken");
    expect(t.done).toBe(true);
    expect(t.found).toBe(true);
  });

  it("located slices show even in unvisited rooms", () => {
    const s = initialState();
    const slice = PICKUPS.find((p) => isSlicePickup(p.id))!;
    s.flags[`peil_${slice.id}`] = true;
    const e = buildMapModel(s).entities.get(`slice:${slice.id}`)!;
    expect(e.category).toBe("slice");
    expect(["located", "available", "locked", "partial"]).toContain(e.status);
  });

  it("side caches are their own category and start locked", () => {
    const s = initialState();
    const cache = PICKUPS.find((p) => isCachePickup(p.id) && p.floor === 0)!;
    const room = roomAt(0, cache.x, cache.z)!;
    visit(s, room.id);
    s.flags[`revealed_${cache.id}`] = true;
    // Visible through its gate device (Nexus) or the revealed flag.
    build(s, "NXS-01");
    const e = buildMapModel(s).entities.get(`cache:${cache.id}`);
    expect(e?.category).toBe("cache");
    expect(e?.status).toBe("locked");
  });

  it("notes: unread in visited rooms, read ones always, with found flag", () => {
    const s = initialState();
    const n = NOTES.find((x) => x.floor === 0 && !x.hidden && roomAt(0, x.x, x.z))!;
    const room = roomAt(0, n.x, n.z)!;
    visit(s, room.id);
    expect(buildMapModel(s).entities.get(`note:${n.id}`)!.status).toBe("unread");
    s.read[n.id] = true;
    delete s.flags[`visited_${room.id}`];
    const e = buildMapModel(s).entities.get(`note:${n.id}`)!;
    expect(e.status).toBe("read");
    expect(e.found).toBe(true);
  });

  it("bots: dormant until reactivated, 'found' once met", () => {
    const s = initialState();
    visit(s, "westflur");
    const e = buildMapModel(s).entities.get("npc:f1ndr")!;
    expect(e.status).toBe("dormant");
    expect(e.found).toBe(false);
    s.flags.bot_f1ndr_awake = true;
    const a = buildMapModel(s).entities.get("npc:f1ndr")!;
    expect(a.status).toBe("awake");
    expect(a.found).toBe(true);
    expect(a.codexId).toBe("p_f1ndr");
  });

  it("props: puzzles blocked/usable/solved, elevator and terminal categories", () => {
    const s = initialState();
    visit(s, "geo", "aufzug0", "kontroll");
    const m = buildMapModel(s);
    expect(m.entities.get("puzzle:geo_ventil")!.status).toBe("usable");
    expect(m.entities.get("elevator:aufzug_e0")!.category).toBe("elevator");
    expect(m.entities.get("terminal:hauptkonsole")!.category).toBe("terminal");
    s.puzzles.pz_geo_valve = true;
    expect(buildMapModel(s).entities.get("puzzle:geo_ventil")!.status).toBe("solved");
  });

  it("links an entity to the objective at its place (trackable)", () => {
    const s = initialState();
    visit(s, "geo");
    const e = buildMapModel(s).entities.get("puzzle:geo_ventil")!;
    expect(e.objectiveId).toBe("strom_ventil");
  });

  it("every entity key is unique and its category is filterable", () => {
    const s = initialState();
    for (const r of ROOMS) visit(s, r.id);
    const m = buildMapModel(s);
    const keys = m.order.flatMap((f) => m.floors[f].entities.map((e) => e.key));
    expect(new Set(keys).size).toBe(keys.length);
    const fl = m.floors[0];
    const onlyDevices = filterEntities(fl.entities, new Set(["device"]));
    expect(onlyDevices.every((e) => e.category === "device")).toBe(true);
    const def = filterEntities(fl.entities, DEFAULT_MAP_FILTER);
    expect(def.some((e) => e.category === "decor")).toBe(false);
    expect(fl.entities.some((e) => e.category === "decor")).toBe(true);
  });
});

describe("map model — progress, found list, search, cache, pin", () => {
  it("floor progress counts found vs total", () => {
    const s = initialState();
    const p0 = floorProgress(s, 0);
    expect(p0.rooms.found).toBe(0);
    expect(p0.devices.found).toBe(p0.devices.total > 0 ? p0.devices.found : 0);
    visit(s, "kontroll");
    s.taken.p_kontroll_kiste = 0;
    const p1 = floorProgress(s, 0);
    expect(p1.rooms.found).toBe(1);
    expect(p1.items.found).toBe(p0.items.found + 1);
    const total = totalProgress(buildMapModel(s));
    expect(total.slices.total).toBe(PICKUPS.filter((p) => isSlicePickup(p.id)).length);
  });

  it("found list groups by category", () => {
    const s = initialState();
    visit(s, "kontroll");
    s.taken.p_kontroll_kiste = 0;
    const groups = foundByCategory(buildMapModel(s).floors[0]);
    expect(groups.find((g) => g.category === "item")!.entities[0]!.id).toBe("p_kontroll_kiste");
    expect(groups.some((g) => g.category === "device")).toBe(true);
  });

  it("search finds rooms and entities on all floors, current floor first", () => {
    const s = initialState();
    visit(s, "kontroll", "geo");
    const m = buildMapModel(s);
    const room = searchMap(m, "control room");
    expect(room[0]!.key).toBe("room:kontroll");
    const valve = searchMap(m, "seep valve");
    expect(valve.some((h) => h.key === "puzzle:geo_ventil" && h.floor === 1)).toBe(true);
    expect(searchMap(m, "   ")).toEqual([]);
    expect(searchMap(m, "zzzz-nothing")).toEqual([]);
    // Unknown rooms are only found by their code, not by name.
    expect(searchMap(m, "archive").some((h) => h.key === "room:archiv")).toBe(false);
  });

  it("mapModelCached reuses the model per version", () => {
    const s = initialState();
    const a = mapModelCached(s, 1);
    expect(mapModelCached(s, 1)).toBe(a);
    visit(s, "kontroll");
    const b = mapModelCached(s, 2);
    expect(b).not.toBe(a);
    expect(b.floors[0].rooms.find((r) => r.id === "kontroll")!.fog).toBe("visited");
  });

  it("map pin round-trips through the counters", () => {
    const s = initialState();
    expect(mapPin(s)).toBeNull();
    setMapPin(s, { floor: 2, x: 30, z: 40 });
    expect(mapPin(s)).toEqual({ floor: 2, x: 30, z: 40 });
    expect(buildMapModel(s).pin).toEqual({ floor: 2, x: 30, z: 40 });
    setMapPin(s, null);
    expect(mapPin(s)).toBeNull();
  });
});

describe("map dossier", () => {
  it("device dossier: stage, next-stage blockers, connections", () => {
    const s = initialState();
    const m = buildMapModel(s);
    const d = entityDossier(s, m, m.entities.get("device:UEC-001")!);
    expect(d.lead).toBe(DEVICE_BY_ID.get("UEC-001")!.summary);
    expect(
      d.sections[0]!.rows!.some(
        (r) => r.value === `0/${DEVICE_BY_ID.get("UEC-001")!.stages.length}`,
      ),
    ).toBe(true);
    expect(d.sections.some((sec) => sec.title.startsWith("Next stage"))).toBe(true);
  });

  it("pickup dossier lists contents; read note offers its id", () => {
    const s = initialState();
    visit(s, "kontroll");
    let m = buildMapModel(s);
    const pd = entityDossier(s, m, m.entities.get("item:p_kontroll_kiste")!);
    expect(pd.sections.some((sec) => sec.items?.some((i) => i.startsWith("2×")))).toBe(true);
    const n = NOTES.find((x) => x.floor === 0 && !x.hidden)!;
    s.read[n.id] = true;
    m = buildMapModel(s);
    const nd = entityDossier(s, m, m.entities.get(`note:${n.id}`)!);
    expect(nd.noteId).toBe(n.id);
  });

  it("every entity of a fully explored lab has a dossier", () => {
    const s = initialState();
    for (const r of ROOMS) visit(s, r.id);
    const m = buildMapModel(s);
    for (const e of m.entities.values()) {
      const d = entityDossier(s, m, e);
      expect(d.title, e.key).toBeTruthy();
      expect(d.sections.length, e.key).toBeGreaterThan(0);
    }
    for (const r of m.rooms.values()) expect(roomDossier(m, r).title).toBeTruthy();
    // Props with a puzzle name the puzzle.
    const pz = PROPS.find((p) => p.kind === "puzzle" && p.puzzle)!;
    const d = entityDossier(s, m, m.entities.get(`puzzle:${pz.id}`)!);
    expect(d.sections[0]!.rows!.length).toBeGreaterThan(1);
  });
});

describe("map view math", () => {
  it("zooms around a point, clamps and pans", () => {
    expect(clampView({ k: 0.2, cx: 0, cz: 0 })).toEqual(HOME_VIEW);
    const z = zoomAt(HOME_VIEW, 2);
    expect(z.k).toBe(2);
    const p = panBy(z, 10, 0);
    expect(p.cx).toBeLessThan(z.cx);
    expect(zoomAt(HOME_VIEW, 100).k).toBe(6);
    const f = focusOn(HOME_VIEW, 20, 20);
    expect(f.k).toBe(2);
    expect(scaleBar(1).units).toBeLessThanOrEqual(36);
    expect(scaleBar(4).metres).toBeLessThanOrEqual(scaleBar(1).metres);
  });
});
