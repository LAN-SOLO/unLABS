/**
 * Device firmware in the Lab World (pure, no three, no game.ts import).
 * =====================================================================
 *
 * Every device runs a firmware image: the factory manifest comes from the
 * device docs (`devices/tier-*\/<ID>/firmware.json`, via lib/firmware/registry)
 * — version, build, checksum, feature tags — and the Lab World adds what an
 * update means in play (`content/firmware.ts`: new feature, changelog, where
 * the image comes from). MCP-000 has no firmware.json; its manifest lives in
 * the world content.
 *
 * Update protocol (devices/FIRMWARE-SPEC.md §7): check → download → verify →
 * flash → reboot. Preconditions: installed ≥ min_version, checksum match, the
 * device online and not in a critical operation. A rollback restores the
 * factory image. The phases are timed by the device interface; the state
 * change itself (`flash` / `rollback` in device-ops.ts) is atomic.
 *
 * State: `WorldState.firmware[id]` holds the installed version only when it
 * differs from the factory image.
 */
import { FIRMWARE_REGISTRY } from "@/lib/firmware/registry";
import type { DeviceFirmwareEntry } from "@/lib/firmware/types";
// The terminal registry predates the Nexus manifest; the Lab World needs it too.
import NXS_FW from "@/devices/tier-2/NXS-01_Nexus/firmware.json";
import { WORLD_FIRMWARE, MCP_MANIFEST, type WorldFirmwareDef } from "@/lib/world/content/firmware";
import { isLinked } from "@/lib/world/links";
import type { WorldState } from "@/lib/world/types";

export interface FirmwareImage {
  version: string;
  build: string;
  /** 8-character image checksum (verified before flashing). */
  checksum: string;
}

export interface FirmwareManifest {
  id: string;
  factory: FirmwareImage & { features: readonly string[]; securityPatch: string };
  /** The one update the lab has for this device (if any). */
  update?: FirmwareImage & {
    minVersion: string;
    reboot: boolean;
  };
  /** World meaning of the update (feature, changelog, source) — see content/firmware.ts. */
  world?: WorldFirmwareDef;
}

/** Update phases as the device interface shows them (FIRMWARE-SPEC §7). */
export const FLASH_PHASES = [
  "checking",
  "downloading",
  "verifying",
  "flashing",
  "rebooting",
] as const;
export type FlashPhase = (typeof FLASH_PHASES)[number];
/** Phase durations (ms) in the device interface. */
export const FLASH_PHASE_MS: Readonly<Record<FlashPhase, number>> = {
  checking: 700,
  downloading: 1800,
  verifying: 1100,
  flashing: 2200,
  rebooting: 1600,
};

/** Compare two semver strings (major.minor.patch; pre-release ignored). */
export function compareVersion(a: string, b: string): number {
  const pa = a
    .split(/[.-]/)
    .slice(0, 3)
    .map((n) => Number.parseInt(n, 10) || 0);
  const pb = b
    .split(/[.-]/)
    .slice(0, 3)
    .map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

function buildManifests(): Map<string, FirmwareManifest> {
  const out = new Map<string, FirmwareManifest>();
  const entries = new Map(FIRMWARE_REGISTRY);
  const nxs = NXS_FW as unknown as DeviceFirmwareEntry;
  if (!entries.has(nxs.device_id)) entries.set(nxs.device_id, nxs);
  for (const [id, e] of entries) {
    const world = WORLD_FIRMWARE[id];
    const docUpdate = e.update
      ? {
          version: e.update.version,
          build: e.update.build,
          checksum: e.update.checksum,
          minVersion: e.update.min_version,
          reboot: e.update.requires_reboot,
        }
      : undefined;
    // Devices without a documented update can get one from the world content.
    const update = docUpdate ?? world?.image;
    out.set(id, {
      id,
      factory: {
        version: e.firmware.version,
        build: e.firmware.build,
        checksum: e.firmware.checksum,
        features: e.firmware.features,
        securityPatch: e.firmware.securityPatch,
      },
      ...(update && world ? { update } : {}),
      ...(world ? { world } : {}),
    });
  }
  out.set("MCP-000", MCP_MANIFEST);
  return out;
}

export const FIRMWARE: ReadonlyMap<string, FirmwareManifest> = buildManifests();

export function manifestOf(id: string): FirmwareManifest | undefined {
  return FIRMWARE.get(id);
}

/** Installed version of a device (factory image unless flashed). */
export function installedVersion(s: WorldState, id: string): string {
  return s.firmware[id] ?? FIRMWARE.get(id)?.factory.version ?? "0.0.0";
}

/** The device runs its lab update (or newer). */
export function isUpdated(s: WorldState, id: string): boolean {
  const u = FIRMWARE.get(id)?.update;
  return !!u && compareVersion(installedVersion(s, id), u.version) >= 0;
}

/** Installed image details (factory or the update). */
export function installedImage(s: WorldState, id: string): FirmwareImage | undefined {
  const m = FIRMWARE.get(id);
  if (!m) return undefined;
  return isUpdated(s, id) && m.update ? m.update : m.factory;
}

/** Feature tags the installed firmware provides. */
export function features(s: WorldState, id: string): string[] {
  const m = FIRMWARE.get(id);
  if (!m) return [];
  const tags = [...m.factory.features];
  if (isUpdated(s, id) && m.world) tags.push(m.world.unlock.tag);
  return tags;
}

/** The installed firmware provides feature `tag`. */
export function hasFeature(s: WorldState, id: string, tag: string): boolean {
  return features(s, id).includes(tag);
}

/** Condition check: device `id` runs at least `min`. */
export function firmwareAtLeast(s: WorldState, id: string, min: string): boolean {
  return compareVersion(installedVersion(s, id), min) >= 0;
}

// ── Feature effects (numbers; applied where each rule lives) ───────

/**
 * What the lab updates change (content/firmware.ts explains them to the
 * player). Applied in game.ts (power, drone, research, salvage, printing,
 * workbench, readouts) and device-ops.ts (hub capacity).
 */
export const FW_TUNING = {
  /** EXD-001 `fast-return`: seconds between drone flights (factory 150). */
  droneCooldown: 125,
  /** NXS-01 `prereq-chain`: extra research points per cycle. */
  researchBonus: 2,
  /** AIC-001 `self-optimize` (AIC online): seconds per research cycle (factory 90). */
  researchCooldown: 60,
  /** CLK-001 `event-scheduler` (CLK online): refill time factor. */
  respawnFactor: 0.8,
  /** BAT-001 `fast-charge`: battery buffer in W (factory 40). */
  batteryBuffer: 55,
  /** MFR-001 `fuel-autotune`: reactor output in W (factory 250). */
  fusionOutput: 285,
  /** PWR-001 `fusion-sequencer`: extra priority circuits. */
  extraCircuits: 2,
  /** THM-001 cooling loop: draw factor of linked machines (factory / `loop-balancer`). */
  thermalLink: 0.9,
  thermalLinkBalanced: 0.8,
  /** P3D-001 `purge-saver`: every n-th print needs no Base Alloy. */
  freePrintEvery: 3,
  /** Compute mesh: research points per cycle for each online machine linked to SCA-001. */
  meshResearch: 1,
} as const;

/** Draw (W) of devices whose lab update lowers it. */
export const UPDATED_DRAW: Readonly<Record<string, number>> = {
  "VNT-001": 1.5,
  "RMG-001": 8,
  "LCT-001": 40,
  "TLP-001": 60,
  "QSM-001": 15,
};

/**
 * Rated draw of a consumer after firmware and the THM-001 cooling loop
 * (`thermalOn` = THM-001 already online in this power pass).
 */
export function effectiveDraw(s: WorldState, id: string, base: number, thermalOn: boolean): number {
  const lowered = UPDATED_DRAW[id];
  let w = lowered !== undefined && isUpdated(s, id) ? lowered : base;
  if (thermalOn && id !== "THM-001" && isLinked(s, "THM-001", id))
    w *= hasFeature(s, "THM-001", "loop-balancer")
      ? FW_TUNING.thermalLinkBalanced
      : FW_TUNING.thermalLink;
  return Math.round(w * 10) / 10;
}
