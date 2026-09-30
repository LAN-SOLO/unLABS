/**
 * Device operations that need the power grid: firmware updates and hub links
 * (pure; mutate the passed state). Queries without the grid: firmware.ts,
 * links.ts. Content: content/firmware.ts, content/links.ts.
 */
import { tr } from "@/lib/i18n";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ROOM_BY_ID } from "@/lib/world/content/map";
import {
  FW_TUNING,
  compareVersion,
  hasFeature,
  installedVersion,
  isUpdated,
  manifestOf,
} from "@/lib/world/firmware";
import {
  describeCond,
  evalCond,
  isBuilt,
  isOnline,
  log,
  toggleDevice,
  bump,
} from "@/lib/world/game";
import { HUBS, HUB_BY_ID, isLinked, linksOf } from "@/lib/world/links";
import type { WorldState } from "@/lib/world/types";

export type OpResult = { ok: true; message: string } | { ok: false; message: string };

const fail = (message: string): OpResult => ({ ok: false, message });

function nameOf(id: string): string {
  return DEVICE_BY_ID.get(id)?.name ?? id;
}

function floorOf(id: string): number | undefined {
  const d = DEVICE_BY_ID.get(id);
  return d ? ROOM_BY_ID.get(d.room)?.floor : undefined;
}

// ── Firmware ─────────────────────────────────────────────────────

/** NET-001 can serve a device its image (mirror feature + link). */
export function netMirrorFor(s: WorldState, id: string): boolean {
  return (
    isOnline(s, "NET-001") && hasFeature(s, "NET-001", "fw-mirror") && isLinked(s, "NET-001", id)
  );
}

/** MCP-000 can push a device its image (admin link). */
export function mcpPushFor(s: WorldState, id: string): boolean {
  return isOnline(s, "MCP-000") && isLinked(s, "MCP-000", id);
}

/**
 * Can the lab update `id` now? (FIRMWARE-SPEC §7 preconditions + the world
 * source.) For `manual` images the checksum is checked in `flashFirmware`.
 */
export function updateCheck(s: WorldState, id: string): OpResult {
  const m = manifestOf(id);
  if (!m?.update || !m.world) return fail(tr("No update known for this device."));
  if (isUpdated(s, id)) return fail(tr("Already up to date."));
  if (id !== "MCP-000" && !isBuilt(s, id)) return fail(tr("The device is not complete."));
  if (!isOnline(s, id)) return fail(tr("The device must be online to be flashed."));
  if (compareVersion(installedVersion(s, id), m.update.minVersion) < 0)
    return fail(
      tr("Needs at least version {version} installed.", { version: m.update.minVersion }),
    );
  if (m.world.requires && !evalCond(s, m.world.requires))
    return fail(m.world.requiresHint ?? describeCond(m.world.requires));
  if (m.world.source === "net" && !netMirrorFor(s, id))
    return fail(tr("No image source: link the device to a network mirror."));
  if (m.world.source === "mcp" && !mcpPushFor(s, id))
    return fail(tr("No image source: the MCP must administer this device."));
  return { ok: true, message: tr("Update {version} ready.", { version: m.update.version }) };
}

/** Flash the lab update. `checksum` is required for `manual` images. */
export function flashFirmware(s: WorldState, id: string, checksum?: string): OpResult {
  const check = updateCheck(s, id);
  if (!check.ok) return check;
  const m = manifestOf(id)!;
  const u = m.update!;
  if (m.world!.source === "manual") {
    const typed = (checksum ?? "").trim().toUpperCase();
    if (typed !== u.checksum.toUpperCase()) {
      bump(s, "fw_bad_checksum");
      return fail(tr("Checksum mismatch — image rejected, nothing was written."));
    }
  }
  s.firmware[id] = u.version;
  bump(s, "fw_flashed");
  log(s, tr("{device}: firmware {version} flashed.", { device: nameOf(id), version: u.version }));
  return {
    ok: true,
    message: tr("{device} runs {version} — new: {feature}.", {
      device: nameOf(id),
      version: u.version,
      feature: m.world!.unlock.label,
    }),
  };
}

/** Restore the factory image (the update stays available). */
export function rollbackFirmware(s: WorldState, id: string): OpResult {
  if (!s.firmware[id]) return fail(tr("The factory image is already installed."));
  if (!isOnline(s, id)) return fail(tr("The device must be online to be flashed."));
  delete s.firmware[id];
  bump(s, "fw_rollbacks");
  const v = installedVersion(s, id);
  log(s, tr("{device}: rolled back to {version}.", { device: nameOf(id), version: v }));
  return { ok: true, message: tr("Factory image {version} restored.", { version: v }) };
}

// ── Links ────────────────────────────────────────────────────────

/** Ports of a hub right now (PWR-001 gains two with its `fusion-sequencer` update). */
export function hubCapacity(s: WorldState, hub: string): number {
  const h = HUB_BY_ID.get(hub);
  if (!h) return 0;
  const extra =
    hub === "PWR-001" && hasFeature(s, hub, "fusion-sequencer") ? FW_TUNING.extraCircuits : 0;
  return h.capacity + extra;
}

/** Devices the hub could link right now (for the hub interface). */
export function linkCandidates(s: WorldState, hub: string): string[] {
  return [...DEVICE_BY_ID.keys()].filter((id) => canLink(s, hub, id).ok);
}

export function canLink(s: WorldState, hub: string, to: string): OpResult {
  const h = HUB_BY_ID.get(hub);
  if (!h) return fail(tr("This device cannot link others."));
  if (to === hub) return fail(tr("A hub cannot link itself."));
  if (!isOnline(s, hub)) return fail(tr("The hub must be online."));
  if (h.requires && !evalCond(s, h.requires))
    return fail(h.requiresHint ?? describeCond(h.requires));
  if (!DEVICE_BY_ID.has(to) || !isBuilt(s, to))
    return fail(tr("Only complete devices can be linked."));
  if (h.accepts && !h.accepts.includes(to))
    return fail(tr("{hub} has no port for this device.", { hub: nameOf(hub) }));
  if (isLinked(s, hub, to)) return fail(tr("Already linked."));
  const cap = hubCapacity(s, hub);
  if (linksOf(s, hub).length >= cap)
    return fail(tr("All {n} ports of {hub} are in use.", { n: cap, hub: nameOf(hub) }));
  const other = HUBS.find((x) => x.bus === h.bus && x.id !== hub && isLinked(s, x.id, to));
  if (other) return fail(tr("Already on this bus via {hub}.", { hub: nameOf(other.id) }));
  if (h.range === "floor" && floorOf(hub) !== floorOf(to))
    return fail(tr("Out of range — {hub} only reaches its own level.", { hub: nameOf(hub) }));
  return { ok: true, message: "" };
}

export function linkDevice(s: WorldState, hub: string, to: string): OpResult {
  const c = canLink(s, hub, to);
  if (!c.ok) return c;
  s.links[hub] = [...linksOf(s, hub), to];
  bump(s, "links_made");
  log(s, tr("{device} linked to {hub}.", { device: nameOf(to), hub: nameOf(hub) }));
  return { ok: true, message: tr("{device} linked.", { device: nameOf(to) }) };
}

export function unlinkDevice(s: WorldState, hub: string, to: string): OpResult {
  if (!isLinked(s, hub, to)) return fail(tr("Not linked."));
  const rest = linksOf(s, hub).filter((x) => x !== to);
  if (rest.length) s.links[hub] = rest;
  else delete s.links[hub];
  log(s, tr("{device} unlinked from {hub}.", { device: nameOf(to), hub: nameOf(hub) }));
  return { ok: true, message: tr("{device} unlinked.", { device: nameOf(to) }) };
}

/** Switch a linked device from its hub (admin and power hubs). */
export function remoteToggle(s: WorldState, hub: string, to: string): OpResult {
  const h = HUB_BY_ID.get(hub);
  if (!h || (h.bus !== "admin" && h.bus !== "power"))
    return fail(tr("This hub cannot switch devices."));
  if (!isOnline(s, hub)) return fail(tr("The hub must be online."));
  if (!isLinked(s, hub, to)) return fail(tr("Not linked."));
  const on = toggleDevice(s, to);
  return {
    ok: true,
    message: on
      ? tr("{device} switched on remotely.", { device: nameOf(to) })
      : tr("{device} switched off remotely.", { device: nameOf(to) }),
  };
}

/** The device is used through its interface (built; the MCP from its first stage). */
export function usesInterface(s: WorldState, id: string): boolean {
  return isBuilt(s, id) || (id === "MCP-000" && (s.built[id] ?? 0) > 0);
}
