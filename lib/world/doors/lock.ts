/**
 * The lock system — every door's interface: mode, status, access log
 * (pure). docs/DOORS.md.
 * ==================================================================
 *
 * Each door has a lock interface on its right jamb (both faces) and is listed
 * in the surveillance station's door tab. Modes:
 *  - auto   — opens for Jade when its lock condition holds (default)
 *  - hold   — stays open (only a door whose lock is satisfied; not airlocks)
 *  - sealed — stays shut and blocks paths; the interface opens it again
 * State lives in counters (`door_mode:<id>` 0/1/2, `door_opens:<id>`,
 * `door_last:<id>`) — no save version bump; absent = auto.
 */
import { tr } from "@/lib/i18n";
import { DOORS, ROOMS, doorSides } from "@/lib/world/content/map";
import { doorIsOpen } from "@/lib/world/game";
import { airlockOf } from "@/lib/world/doors/airlock";
import { MECH_LABEL, MECH_TEXT, MOTION_LABEL, doorStyle } from "@/lib/world/doors/style";
import { IFACE_AT, type PanelState } from "@/lib/world/models/door-styles";
import type { DoorDef, WorldState } from "@/lib/world/types";

export type DoorMode = "auto" | "hold" | "sealed";
const MODES: readonly DoorMode[] = ["auto", "hold", "sealed"];

const modeKey = (id: string) => `door_mode:${id}`;

export function doorMode(s: WorldState, id: string): DoorMode {
  return MODES[s.counters[modeKey(id)] ?? 0] ?? "auto";
}

/** A door the player can see as a door (secret doors only once revealed). */
export function doorKnown(s: WorldState, d: DoorDef): boolean {
  return !d.secret || doorIsOpen(s, d);
}

export interface ModeResult {
  ok: boolean;
  text: string;
}

export function setDoorMode(s: WorldState, d: DoorDef, mode: DoorMode): ModeResult {
  if (!doorKnown(s, d)) return { ok: false, text: tr("There is no door here.") };
  if (mode === "hold") {
    if (!doorIsOpen(s, d)) return { ok: false, text: d.lockHint ?? tr("Locked.") };
    if (d.airlock)
      return { ok: false, text: tr("Airlock doors cannot be held open — the interlock refuses.") };
  }
  if (mode === "auto") delete s.counters[modeKey(d.id)];
  else s.counters[modeKey(d.id)] = MODES.indexOf(mode);
  return {
    ok: true,
    text:
      mode === "sealed"
        ? tr("Sealed. The mechanism locks and stays locked.")
        : mode === "hold"
          ? tr("Held open.")
          : tr("Back to automatic."),
  };
}

/** The door just opened for Jade (access log). */
export function noteDoorOpened(s: WorldState, id: string): void {
  s.counters[`door_opens:${id}`] = (s.counters[`door_opens:${id}`] ?? 0) + 1;
  s.counters[`door_last:${id}`] = s.playTime;
  s.counters.doors_opened = (s.counters.doors_opened ?? 0) + 1;
}

/** What the interface screen shows. */
export function doorPanelState(s: WorldState, d: DoorDef, cycling = false): PanelState {
  if (cycling) return "cycle";
  const mode = doorMode(s, d.id);
  if (mode === "sealed") return "sealed";
  if (!doorIsOpen(s, d)) return d.keypad ? "keypad" : "locked";
  return mode === "hold" ? "hold" : "auto";
}

export interface DoorInfo {
  id: string;
  name: string;
  /** Rooms on both sides. */
  rooms: [string, string];
  open: boolean;
  mode: DoorMode;
  shape: string;
  mech: string;
  mechText: string;
  hint: string | null;
  opens: number;
  last: number | null;
  airlock: boolean;
  keypad: string | null;
}

function roomName(id: string): string {
  return ROOMS.find((r) => r.id === id)?.name ?? id;
}

export function doorInfo(s: WorldState, d: DoorDef): DoorInfo {
  const st = doorStyle(d.id);
  const sides = doorSides(d);
  const a = sides[0] ?? "";
  const b = sides[1] ?? a;
  const al = airlockOf(d);
  const rooms: [string, string] = [roomName(a), roomName(b)];
  const name = al
    ? d.id === al.outer
      ? tr("Airlock — outer door")
      : tr("Airlock — inner door")
    : rooms[0] === rooms[1]
      ? rooms[0]
      : `${rooms[0]} ↔ ${rooms[1]}`;
  const open = doorIsOpen(s, d);
  return {
    id: d.id,
    name,
    rooms,
    open,
    mode: doorMode(s, d.id),
    shape: MOTION_LABEL[st.motion](),
    mech: MECH_LABEL[st.mech](),
    mechText: MECH_TEXT[st.mech](),
    hint: open ? null : (d.lockHint ?? (d.keypad ? tr("Keypad: enter the code.") : tr("Locked."))),
    opens: s.counters[`door_opens:${d.id}`] ?? 0,
    last: s.counters[`door_last:${d.id}`] ?? null,
    airlock: !!al,
    keypad: d.keypad && !open ? d.keypad : null,
  };
}

/** Doors of a floor the player knows about (for the station's door tab). */
export function knownDoors(s: WorldState, floor?: number): DoorDef[] {
  return DOORS.filter((d) => (floor === undefined || d.floor === floor) && doorKnown(s, d));
}

/** World position (x, z, centre of the panel) of a door's lock interface — on its right jamb. */
export function doorPanelPoint(d: Pick<DoorDef, "x" | "z" | "axis">): { x: number; z: number } {
  const along = IFACE_AT[0];
  return d.axis === "x"
    ? { x: d.x + 0.5 + along, z: d.z + 0.5 }
    : { x: d.x + 0.5, z: d.z + 0.5 + along };
}
