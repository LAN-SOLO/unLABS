/**
 * Skin state: per-room settings from the surveillance station, resolving a
 * setting to render values, sanitising saves and the power model.
 * Pure — no game imports beyond content, so game.ts / save-sanitize.ts can
 * use it without an import cycle (planned: `WorldState.skins`, save v11).
 */
import { ROOMS } from "@/lib/world/content/map";
import { MODE_DUTY, SKIN_MODES } from "@/lib/world/skins/modes";
import { FORCED_PRESETS, SKIN_PRESETS, skinPreset } from "@/lib/world/skins/presets";
import { ROOM_SKINS, roomSkin } from "@/lib/world/skins/rooms";
import type {
  ResolvedSkin,
  RoomSkin,
  SkinMode,
  SkinPreset,
  SkinSetting,
} from "@/lib/world/skins/types";

export type SkinState = Record<string, SkinSetting>;

export const SPEED_RANGE = [0.25, 4] as const;
const HEX = /^#[0-9a-f]{6}$/;

/** A preset by id: the library, or a room's signature (`sig_<room>`). */
export function presetFor(id: string): SkinPreset | undefined {
  if (id.startsWith("sig_")) return roomSkin(id.slice(4))?.signature;
  return skinPreset(id);
}

/** Presets offered for a room, signature first, then its recommendations, then the rest. */
export function presetsForRoom(room: string): SkinPreset[] {
  const s = roomSkin(room);
  if (!s) return SKIN_PRESETS.filter((p) => !FORCED_PRESETS.includes(p.id));
  const first = [
    s.signature,
    ...s.alts.map((a) => skinPreset(a)).filter((p): p is SkinPreset => !!p),
  ];
  const seen = new Set(first.map((p) => p.id));
  return [
    ...first,
    ...SKIN_PRESETS.filter((p) => !seen.has(p.id) && !FORCED_PRESETS.includes(p.id)),
  ];
}

export function defaultSetting(skin: RoomSkin): SkinSetting {
  return { preset: skin.signature.id, speed: 1, intensity: 1, sync: "room" };
}

export function initialSkins(): SkinState {
  const out: SkinState = {};
  for (const s of ROOM_SKINS) out[s.room] = defaultSetting(s);
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Render values for a room. `forced` (alarm / emergency) wins over the setting. */
export function resolveSkin(
  room: string,
  setting: SkinSetting | undefined,
  forced?: string,
): ResolvedSkin {
  const skin = roomSkin(room);
  const base =
    (forced && presetFor(forced)) ||
    (setting && presetFor(setting.preset)) ||
    skin?.signature ||
    SKIN_PRESETS[0]!;
  const own = forced ? undefined : setting;
  return {
    line: own?.line ?? base.line,
    line2: base.line2 ?? own?.line ?? base.line,
    node: own?.node ?? base.node,
    field: own?.field ?? base.field,
    fieldGlow: base.fieldGlow,
    mode: own?.mode ?? base.mode,
    speed: base.speed * (own?.speed ?? 1),
    intensity: base.intensity * (own?.intensity ?? 1),
    source: base.source ?? "none",
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const hex = (v: unknown): string | undefined =>
  typeof v === "string" && HEX.test(v.toLowerCase()) ? v.toLowerCase() : undefined;

/** Save sanitising: unknown rooms / presets fall back, numbers are clamped. */
export function sanitizeSkins(raw: unknown): SkinState {
  const out = initialSkins();
  if (!isRecord(raw)) return out;
  for (const r of ROOMS) {
    const v = raw[r.id];
    if (!isRecord(v) || !out[r.id]) continue;
    const preset =
      typeof v.preset === "string" && presetFor(v.preset) && !FORCED_PRESETS.includes(v.preset)
        ? v.preset
        : out[r.id]!.preset;
    const mode = SKIN_MODES.includes(v.mode as SkinMode) ? (v.mode as SkinMode) : undefined;
    out[r.id] = {
      preset,
      line: hex(v.line),
      node: hex(v.node),
      field: hex(v.field),
      mode,
      speed: clamp(typeof v.speed === "number" && isFinite(v.speed) ? v.speed : 1, ...SPEED_RANGE),
      intensity: clamp(
        typeof v.intensity === "number" && isFinite(v.intensity) ? v.intensity : 1,
        0,
        1,
      ),
      sync: v.sync === "floor" || v.sync === "lab" ? v.sync : "room",
    };
    for (const k of ["line", "node", "field", "mode"] as const)
      if (out[r.id]![k] === undefined) delete out[r.id]![k];
  }
  return out;
}

/** Apply a setting to a room and, by its sync, to its floor or the whole lab. */
export function applySkin(state: SkinState, room: string, setting: SkinSetting): SkinState {
  const target = ROOMS.find((r) => r.id === room);
  if (!target) return state;
  const next: SkinState = { ...state };
  for (const r of ROOMS) {
    if (!roomSkin(r.id)) continue;
    const hit =
      r.id === room ||
      setting.sync === "lab" ||
      (setting.sync === "floor" && r.floor === target.floor);
    // A synced copy keeps the receiving room's own signature if the preset is a signature.
    if (hit)
      next[r.id] = {
        ...setting,
        preset: setting.preset.startsWith("sig_") && r.id !== room ? `sig_${r.id}` : setting.preset,
      };
  }
  return next;
}

/** Wall cells per room (perimeter), the size measure of the power model. */
const PERIMETER: Record<string, number> = Object.fromEntries(
  ROOMS.map((r) => [r.id, 2 * (r.w + r.d)]),
);

/** Average draw in watts: line light per wall voxel + field glow, × intensity × mode duty. */
export function skinWatts(room: string, resolved: ResolvedSkin): number {
  const per = PERIMETER[room] ?? 0;
  const w =
    per * (0.02 + 0.08 * resolved.fieldGlow) * resolved.intensity * MODE_DUTY[resolved.mode];
  return Math.round(w * 10) / 10;
}
