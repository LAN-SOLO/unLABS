/**
 * Device interfaces — tier-1 devices (see ../types.ts). German in
 * lib/i18n/de/device-ui-tier1.ts (shell strings and NET-001 in device-ui.ts).
 *
 * Every readout is game data (power grid, counters, inventory, insights,
 * archive, links, firmware); `wobble` only adds sensor jitter. Controls are
 * read with `c.get(key, def)` and change what the faceplate shows.
 */
import { tr } from "@/lib/i18n";
import { ARCHIVE, foundEntries } from "@/lib/world/archive";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { RECIPES, SLICE_TOTAL } from "@/lib/world/content/items";
import { HUB_BY_ID } from "@/lib/world/content/links";
import { PICKUPS } from "@/lib/world/content/map";
import { INSIGHTS } from "@/lib/world/content/story";
import {
  DRONE_COOLDOWN,
  RESEARCH_COOLDOWN,
  UEC_NOMINAL,
  deviceFloor,
  deviceReadout,
  droneReady,
  isBuilt,
  itemDef,
  maxCombineInputs,
  pickupAvailable,
  pickupRespawnLeft,
  researchReady,
  stagesDone,
  uecOutput,
} from "@/lib/world/game";
import { features, installedVersion, isUpdated } from "@/lib/world/firmware";
import { linksOf } from "@/lib/world/links";
import {
  counter,
  gridLoad,
  items,
  linkCount,
  minutes,
  onlineCount,
  spareW,
  uecRatio,
  unit,
  wobble,
} from "@/lib/world/device-ui/metrics";
import type { DeviceUiSpec, Tone, UiCtx } from "@/lib/world/device-ui/types";
import { TRAIT_AXES, type PickupDef } from "@/lib/world/types";

// ── Helpers (pure, cheap) ───────────────────────────────────────────

const pad2 = (n: number): string => String(n).padStart(2, "0");

function mmss(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
}

function hhmmss(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  return `${pad2(Math.floor(t / 3600) % 24)}:${pad2(Math.floor(t / 60) % 60)}:${pad2(t % 60)}`;
}

/** `n` samples (oldest first) of `f` over the last `n × step` seconds, clamped to 0…1. */
function history(c: UiCtx, n: number, step: number, f: (t: number) => number): number[] {
  return Array.from({ length: n }, (_, i) => unit(f(c.t - (n - 1 - i) * step)));
}

function isOn(c: UiCtx, id: string): boolean {
  return c.power.online.has(id);
}

function nameOf(id: string): string {
  return DEVICE_BY_ID.get(id)?.name ?? id;
}

/** "done/total" build stages. */
function stageFrac(c: UiCtx, id: string): number {
  const total = DEVICE_BY_ID.get(id)?.stages.length ?? 1;
  return stagesDone(c.s, id) / Math.max(1, total);
}

const hubCap = (id: string): number => HUB_BY_ID.get(id)?.capacity ?? 0;

/** Pickups whose `hidden` condition mentions device `dev` (cached per device). */
const hiddenCache = new Map<string, readonly PickupDef[]>();
function hiddenBy(dev: string): readonly PickupDef[] {
  let list = hiddenCache.get(dev);
  if (!list) {
    const needle = `"device":"${dev}"`;
    list = PICKUPS.filter((p) => !!p.hidden && JSON.stringify(p.hidden).includes(needle));
    hiddenCache.set(dev, list);
  }
  return list;
}

/** Pickups that need tool `dev` for a full salvage (cached). */
const toolCache = new Map<string, readonly PickupDef[]>();
function toolPiles(dev: string): readonly PickupDef[] {
  let list = toolCache.get(dev);
  if (!list) {
    list = PICKUPS.filter((p) => p.tool === dev);
    toolCache.set(dev, list);
  }
  return list;
}

function takenOf(c: UiCtx, list: readonly PickupDef[]): number {
  return list.filter((p) => c.s.taken[p.id] !== undefined).length;
}

/** Pickups on the floor of device `dev` (cached). */
const floorCache = new Map<string, readonly PickupDef[]>();
function floorPickups(dev: string): readonly PickupDef[] {
  let list = floorCache.get(dev);
  if (!list) {
    const f = deviceFloor(dev);
    list = f === undefined ? [] : PICKUPS.filter((p) => p.floor === f);
    floorCache.set(dev, list);
  }
  return list;
}

const tone3 = (ok: boolean, warn: boolean): Tone => (ok ? "ok" : warn ? "warn" : "bad");

function insightCount(c: UiCtx): number {
  return INSIGHTS.filter((i) => c.s.insights[i.id]).length;
}

function archiveCount(c: UiCtx): number {
  return Object.keys(c.s.archive).length;
}

function inventoryOfKind(c: UiCtx, kind: string): number {
  let n = 0;
  for (const [id, k] of Object.entries(c.s.inventory))
    if (k > 0 && itemDef(c.s, id)?.kind === kind) n++;
  return n;
}

// ── Device-specific values ──────────────────────────────────────────

/** CLK-001 display according to its mode. */
function clockValue(c: UiCtx): string {
  const mode = c.get("display", 0);
  if (mode === 1) return `${mmss(c.t)}.${Math.floor((c.t * 10) % 10)}`;
  if (mode === 2) {
    if (isBuilt(c.s, "EXD-001") && !droneReady(c.s))
      return mmss(DRONE_COOLDOWN - (c.s.playTime - counter(c, "drone_last")));
    if (isBuilt(c.s, "NXS-01") && !researchReady(c.s))
      return mmss(RESEARCH_COOLDOWN - (c.s.playTime - counter(c, "research_last")));
    return "--:--";
  }
  return hhmmss(c.s.playTime);
}

function clockDrift(c: UiCtx): number {
  const base = isOn(c, "NET-001") ? 0.3 : 4.2;
  return Math.round((base + wobble(c.t * 0.2, 4) * 0.4 - c.get("trim", 0)) * 10) / 10;
}

function btkReading(c: UiCtx): string {
  if (!c.online) return "—";
  const set = c.get("torque", 4);
  switch (c.get("head", 0)) {
    case 1:
      return `${Math.round(set * 12)} N`;
    case 2:
      return c.get("interlock", 1) ? tr("interlocked") : `${Math.round(set * 5)} mW`;
    case 3:
      return `${(set * 0.8).toFixed(1)} Nm`;
    default:
      return `${(3.3 + wobble(c.t, 7) * 0.02).toFixed(2)} V`;
  }
}

function batCharge(c: UiCtx, t = c.t): number {
  if (!c.online) return 0;
  const shift = [-8, 0, 10][c.get("regen", 1)] ?? 0;
  return Math.max(5, Math.min(100, 55 + spareW(c) / 2 + shift + wobble(t * 0.3, 2) * 3));
}

function cpuGov(c: UiCtx): number {
  return [0.55, 0.8, 1.05][c.get("gov", 1)] ?? 0.8;
}

function coreUtil(c: UiCtx, core: number, t = c.t): number {
  if (!c.online) return 0;
  return unit(
    (gridLoad(c) * 0.6 + onlineCount(c) / 40 + wobble(t, core + 1) * 0.15) / cpuGov(c) + 0.05,
  );
}

/** TMP-001 zone temperatures in °C. */
function zoneTemp(c: UiCtx, zone: number, t = c.t): number {
  const hot = c.power.starved.some((x) => x.reason === "hitze");
  switch (zone) {
    case 0:
      return 18 + gridLoad(c) * 10 + wobble(t * 0.4, 1) * 0.8;
    case 1:
      return 22 + onlineCount(c) * 0.6 + wobble(t * 0.3, 2) * 0.6;
    case 2:
      return hot ? 92 + wobble(t, 3) * 3 : isOn(c, "THM-001") ? 38 + wobble(t * 0.2, 3) : 21;
    default:
      return -14 + wobble(t * 0.1, 4) * 0.5;
  }
}

function convertTemp(c: UiCtx, celsius: number): string {
  const u = c.get("unit", 0);
  if (u === 1) return `${Math.round(celsius * 1.8 + 32)} °F`;
  if (u === 2) return `${Math.round(celsius + 273.15)} K`;
  return `${Math.round(celsius)} °C`;
}

function tier3Cooled(c: UiCtx): string[] {
  return DEVICES.filter((d) => d.tier === 3 && d.power > 0 && isOn(c, d.id)).map((d) => d.id);
}

function thmFan(c: UiCtx): number {
  return c.get("auto", 1) ? Math.min(100, 40 + tier3Cooled(c).length * 10) : c.get("fan", 70);
}

function vltReading(c: UiCtx): string {
  const r = uecRatio();
  switch (c.get("range", 0)) {
    case 1:
      return `${(c.power.demand / 230).toFixed(2)} A`;
    case 2:
      return `${Math.round(230 * Math.max(1, r) * 1.414)} Vpk`;
    default:
      return `${Math.round(230 * r + wobble(c.t, 5) * 0.8)} V`;
  }
}

function vltStabilised(c: UiCtx): number {
  return isOn(c, "UEC-001") ? Math.max(0, UEC_NOMINAL - uecOutput()) : 0;
}

/** MSC-001 radar contacts on the scanner's floor. */
function mscBlips(c: UiCtx): { a: number; r: number; label?: string }[] {
  const d = DEVICE_BY_ID.get("MSC-001");
  if (!d || !c.online) return [];
  const range = c.get("range", 50);
  const band = c.get("band", 0);
  const hidden = new Set(hiddenBy("MSC-001").map((p) => p.id));
  const out: { a: number; r: number; label?: string }[] = [];
  for (const p of floorPickups("MSC-001")) {
    if (band === 1 && p.model !== "crystal") continue;
    if (band === 2 && p.model !== "scrap" && !p.tool) continue;
    if (!pickupAvailable(c.s, p)) continue;
    const dx = p.x - d.x;
    const dz = p.z - d.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range) continue;
    out.push({
      a: Math.atan2(dx, -dz),
      r: dist / range,
      label: hidden.has(p.id) ? "!" : undefined,
    });
    if (out.length >= 24) break;
  }
  return out;
}

/** Average trait profile of the inventory (8 bands, 0…1). */
function composition(c: UiCtx): number[] {
  const sum = TRAIT_AXES.map(() => 0);
  let n = 0;
  for (const [id, k] of Object.entries(c.s.inventory)) {
    const def = k > 0 ? itemDef(c.s, id) : undefined;
    if (!def) continue;
    TRAIT_AXES.forEach((ax, i) => (sum[i] += def.traits[ax] * k));
    n += k;
  }
  return sum.map((v, i) => unit(n ? v / n / 10 + wobble(c.t * 2, i) * 0.02 : 0));
}

function rmgField(c: UiCtx, t = c.t): number {
  if (!c.online) return 0;
  const cur = c.get("current", 12);
  const pulse = c.get("pulse", 0) ? (Math.sin(t * 3) > 0 ? 1 : 0.35) : 1;
  return Math.max(0, cur * 38 * pulse + wobble(t, 6) * 5);
}

const seep = (): PickupDef | undefined => PICKUPS.find((p) => p.id === "p_geo_seep");

/** Installed firmware of the device, e.g. "fw 1.4.2 · 4 features". */
function fwLine(c: UiCtx): string {
  return tr("fw {ver} · {n} features{upd}", {
    ver: installedVersion(c.s, c.id),
    n: features(c.s, c.id).length,
    upd: isUpdated(c.s, c.id) ? " ↑" : "",
  });
}

// ── Specs ───────────────────────────────────────────────────────────

export const TIER1_UI: readonly DeviceUiSpec[] = [
  // ── CLK-001 ── nixie clock with dial, stopwatch and countdown
  {
    id: "CLK-001",
    model: tr("Lab Clock · CLK-001 · 32.768 kHz timebase"),
    face: "console",
    font: "nixie",
    accent: "#ff6a1a",
    plate: "#1c1410",
    boot: [
      tr("crystal oscillator 32.768 kHz … stable"),
      tr("NTP: looking for a server that still exists"),
      tr("day counter restored: 2,561"),
    ],
    pages: [
      {
        id: "clock",
        label: tr("Clock"),
        widgets: [
          {
            kind: "mode",
            key: "display",
            label: tr("Display"),
            def: 0,
            options: [
              { value: 0, label: tr("lab time") },
              { value: 1, label: tr("stopwatch") },
              { value: 2, label: tr("countdown") },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "dial",
                label: tr("Seconds"),
                marks: ["12", "3", "6", "9"],
                angle: (c) => {
                  const mode = c.get("display", 0);
                  const sec = mode === 1 ? c.t : c.s.playTime;
                  return ((sec % 60) / 60) * Math.PI * 2 * (mode === 2 ? -1 : 1);
                },
              },
              {
                kind: "readout",
                label: tr("Time"),
                value: (c) => clockValue(c),
              },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Lab day"),
                value: (c) => 2561 + Math.floor(c.s.playTime / 86400),
              },
              {
                kind: "readout",
                label: tr("Drift"),
                value: (c) => clockDrift(c),
                unit: "ppm",
                digits: 1,
                tone: (c) => tone3(Math.abs(clockDrift(c)) < 1, Math.abs(clockDrift(c)) < 3),
              },
              {
                kind: "knob",
                key: "trim",
                label: tr("Trim"),
                min: -5,
                max: 5,
                step: 0.1,
                def: 0,
                unit: "ppm",
              },
            ],
          },
          {
            kind: "leds",
            label: tr("Sync"),
            items: [
              { label: "OSC", on: (c) => c.online, tone: "ok" },
              { label: "NTP", on: (c) => isOn(c, "NET-001"), tone: "info", blink: true },
              {
                label: "EXD",
                on: (c) => isBuilt(c.s, "EXD-001") && droneReady(c.s),
                tone: "warn",
              },
              {
                label: "NXS",
                on: (c) => isBuilt(c.s, "NXS-01") && researchReady(c.s),
                tone: "warn",
              },
            ],
          },
        ],
      },
      {
        id: "timers",
        label: tr("Timers"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "bar",
            label: tr("Drone charge"),
            value: (c) =>
              isBuilt(c.s, "EXD-001")
                ? Math.min(DRONE_COOLDOWN, c.s.playTime - counter(c, "drone_last"))
                : 0,
            max: DRONE_COOLDOWN,
            unit: "s",
          },
          {
            kind: "bar",
            label: tr("Research cycle"),
            value: (c) =>
              isBuilt(c.s, "NXS-01")
                ? Math.min(RESEARCH_COOLDOWN, c.s.playTime - counter(c, "research_last"))
                : 0,
            max: RESEARCH_COOLDOWN,
            unit: "s",
          },
          {
            kind: "log",
            label: tr("Schedule"),
            max: 4,
            lines: (c) => deviceReadout(c.s, "CLK-001"),
          },
          { kind: "button", label: tr("Read out"), action: "use" },
        ],
      },
    ],
  },

  // ── VNT-001 ── VFD air handler with fan slider and damper control
  {
    id: "VNT-001",
    model: tr("Ventilation System · VNT-001 · dual fan, HEPA H13"),
    face: "cabinet",
    font: "vfd",
    accent: "#7af5d0",
    plate: "#18211f",
    boot: [
      tr("fan A … spin-up"),
      tr("fan B … spin-up (reluctantly)"),
      tr("HEPA filter seated, opinion unchanged"),
    ],
    pages: [
      {
        id: "airflow",
        label: tr("Airflow"),
        widgets: [
          {
            kind: "slider",
            key: "speed",
            label: tr("Fan speed"),
            min: 0,
            max: 100,
            step: 5,
            def: 60,
            unit: "%",
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "gauge",
                label: tr("Fan A"),
                min: 0,
                max: 3000,
                unit: "rpm",
                warn: 2600,
                value: (c) => (c.online ? c.get("speed", 60) * 28 + wobble(c.t, 1) * 40 : 0),
              },
              {
                kind: "gauge",
                label: tr("Fan B"),
                min: 0,
                max: 3000,
                unit: "rpm",
                warn: 2600,
                value: (c) =>
                  c.online && c.get("dual", 1) ? c.get("speed", 60) * 27 + wobble(c.t, 2) * 40 : 0,
              },
            ],
          },
          {
            kind: "scope",
            label: tr("Airflow"),
            wave: (x, c) => {
              if (!c.online) return 0;
              const sp = c.get("speed", 60) / 100;
              return (
                Math.sin(x * (6 + sp * 20) + c.t * (1 + sp * 8)) * sp * 0.8 +
                wobble(x * 20 + c.t * 3, 1) * 0.2 * (1 - sp)
              );
            },
          },
          {
            kind: "readout",
            label: tr("Air exchange"),
            value: (c) =>
              c.online
                ? Math.round(c.get("speed", 60) * 0.12 * (c.get("dual", 1) ? 2 : 1) * 10) / 10
                : 0,
            unit: "/h",
            digits: 1,
          },
        ],
      },
      {
        id: "filter",
        label: tr("Filter"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "bar",
            label: tr("HEPA life"),
            value: (c) => Math.max(8, Math.round(100 - minutes(c) / 6)),
            max: 100,
            unit: "%",
            tone: (c) => (100 - minutes(c) / 6 > 30 ? "ok" : "warn"),
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Dust finds"),
                value: (c) => `${takenOf(c, hiddenBy("VNT-001"))}/${hiddenBy("VNT-001").length}`,
              },
              {
                kind: "readout",
                label: tr("Humidity"),
                unit: "%",
                value: (c) => {
                  const d = c.get("damper", 0);
                  const base = d === 1 ? 38 : d === 2 ? 71 : 58 - c.get("speed", 60) * 0.15;
                  return Math.round(base + wobble(c.t * 0.2, 3));
                },
              },
            ],
          },
          {
            kind: "mode",
            key: "damper",
            label: tr("Dampers"),
            def: 0,
            options: [
              { value: 0, label: tr("auto") },
              { value: 1, label: tr("open") },
              { value: 2, label: tr("closed") },
            ],
          },
          { kind: "switch", key: "dual", label: tr("Dual fan"), def: 1 },
          {
            kind: "leds",
            label: tr("Zones"),
            items: [
              { label: tr("Airlock"), on: (c) => c.online, tone: "ok" },
              { label: tr("Storage"), on: (c) => c.online && c.get("damper", 0) !== 2, tone: "ok" },
              { label: tr("Shaft"), on: (c) => c.online && c.get("dual", 1) === 1, tone: "info" },
            ],
          },
        ],
      },
    ],
  },

  // ── BTK-001 ── handheld tool controller with four heads
  {
    id: "BTK-001",
    model: tr("Basic Toolkit · BTK-001 · probe, clamp, laser, drill"),
    face: "handheld",
    font: "mono",
    accent: "#ffd23f",
    plate: "#26221a",
    boot: [
      tr("tool rack: 4 heads detected"),
      tr("laser interlock engaged (thankfully)"),
      tr("drill torque table loaded"),
    ],
    pages: [
      {
        id: "tools",
        label: tr("Tools"),
        widgets: [
          {
            kind: "mode",
            key: "head",
            label: tr("Tool head"),
            def: 0,
            options: [
              { value: 0, label: "PROBE" },
              { value: 1, label: "CLAMP" },
              { value: 2, label: "LASER" },
              { value: 3, label: "DRILL" },
            ],
          },
          {
            kind: "leds",
            items: [
              { label: "PROBE", on: (c) => c.online && c.get("head", 0) === 0, tone: "ok" },
              { label: "CLAMP", on: (c) => c.online && c.get("head", 0) === 1, tone: "ok" },
              {
                label: "LASER",
                on: (c) => c.online && c.get("head", 0) === 2 && !c.get("interlock", 1),
                tone: "bad",
                blink: true,
              },
              { label: "DRILL", on: (c) => c.online && c.get("head", 0) === 3, tone: "warn" },
            ],
          },
          {
            kind: "row",
            widgets: [
              { kind: "readout", label: tr("Reading"), value: (c) => btkReading(c) },
              {
                kind: "knob",
                key: "torque",
                label: tr("Setting"),
                min: 1,
                max: 10,
                step: 1,
                def: 4,
              },
              { kind: "switch", key: "interlock", label: tr("Laser interlock"), def: 1 },
            ],
          },
        ],
      },
      {
        id: "salvage",
        label: tr("Salvage"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "row",
            widgets: [
              { kind: "readout", label: tr("Salvaged"), value: (c) => counter(c, "salvaged") },
              {
                kind: "readout",
                label: tr("Tool piles"),
                value: (c) => `${takenOf(c, toolPiles("BTK-001"))}/${toolPiles("BTK-001").length}`,
              },
            ],
          },
          {
            kind: "bar",
            label: tr("Piles fully cleared"),
            value: (c) => takenOf(c, toolPiles("BTK-001")),
            max: () => Math.max(1, toolPiles("BTK-001").length),
          },
          {
            kind: "text",
            text: tr("Scrap piles marked for tools now give everything, not just the top layer."),
          },
          { kind: "button", label: tr("Salvage"), action: "salvage" },
        ],
      },
    ],
  },

  // ── BAT-001 ── LCD cell monitor with regen modes
  {
    id: "BAT-001",
    model: tr("Battery Pack · BAT-001 · 4S buffer, 40 W"),
    face: "cabinet",
    font: "lcd",
    accent: "#9cff57",
    plate: "#1a2118",
    boot: [
      tr("cell balance check … 4/4 cells"),
      tr("thermal runaway protection armed"),
      tr("CDC handshake: waiting politely"),
    ],
    pages: [
      {
        id: "cells",
        label: tr("Cells"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "gauge",
                label: tr("Charge"),
                min: 0,
                max: 100,
                unit: "%",
                value: (c) => batCharge(c),
              },
              {
                kind: "readout",
                label: tr("Buffer"),
                value: (c) => (c.online ? 40 : 0),
                unit: "W",
              },
              { kind: "readout", label: tr("Grid reserve"), value: (c) => spareW(c), unit: "W" },
            ],
          },
          {
            kind: "row",
            widgets: [0, 1, 2, 3].map((i) => ({
              kind: "bar" as const,
              label: tr("Cell {n}", { n: i + 1 }),
              value: (c: UiCtx) =>
                c.online
                  ? Math.round((3.5 + batCharge(c) / 150 + wobble(c.t * 0.5, i) * 0.03) * 100) / 100
                  : 0,
              max: 4.2,
              unit: "V",
            })),
          },
          {
            kind: "graph",
            label: tr("Charge history"),
            series: (c) => history(c, 40, 0.5, (t) => batCharge(c, t) / 100),
          },
        ],
      },
      {
        id: "regen",
        label: tr("Regen"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "mode",
            key: "regen",
            label: tr("Regen cycle"),
            def: 1,
            options: [
              { value: 0, label: tr("eco") },
              { value: 1, label: tr("auto") },
              { value: 2, label: tr("boost") },
            ],
          },
          {
            kind: "leds",
            items: [
              { label: tr("cell monitor"), on: (c) => c.online, tone: "ok" },
              {
                label: tr("regen"),
                on: (c) => c.online && c.get("regen", 1) > 0,
                tone: "ok",
                blink: true,
              },
              { label: tr("thermal"), on: (c) => c.get("regen", 1) === 2, tone: "warn" },
              { label: "CDC", on: (c) => isOn(c, "CDC-001"), tone: "info" },
            ],
          },
          {
            kind: "row",
            widgets: [
              { kind: "button", label: tr("Read out"), action: "use" },
              { kind: "button", label: tr("Power grid"), action: "power" },
            ],
          },
        ],
      },
    ],
  },

  // ── PWB-001 ── bench controller with six slots and a recipe queue
  {
    id: "PWB-001",
    model: tr("Portable Workbench · PWB-001 · six-slot jig"),
    face: "bench",
    font: "mono",
    accent: "#e8b36a",
    plate: "#2a2119",
    boot: [
      tr("slot controller: 6 slots"),
      tr("calibration jig … level (within reason)"),
      tr("assembly queue empty. As usual."),
    ],
    pages: [
      {
        id: "bench",
        label: tr("Bench"),
        widgets: [
          {
            kind: "leds",
            label: tr("Slots"),
            items: [0, 1, 2, 3, 4, 5].map((i) => ({
              label: String(i + 1),
              on: (c: UiCtx) => c.online && i < maxCombineInputs(c.s),
              tone: "ok" as const,
            })),
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Recipes known"),
                value: (c) => Object.keys(c.s.recipesKnown).length,
                unit: `/${RECIPES.length}`,
              },
              { kind: "readout", label: tr("Combinations"), value: (c) => c.s.combos },
              {
                kind: "readout",
                label: tr("Prototypes"),
                value: (c) => Object.keys(c.s.generated).length,
              },
            ],
          },
          {
            kind: "bar",
            label: tr("Part kinds on hand"),
            value: (c) => inventoryOfKind(c, "bauteil"),
            max: 40,
          },
          { kind: "button", label: tr("Open workbench"), action: "workbench" },
        ],
      },
      {
        id: "queue",
        label: tr("Recipes"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "mode",
            key: "sort",
            label: tr("Order"),
            def: 0,
            options: [
              { value: 0, label: tr("newest") },
              { value: 1, label: tr("A–Z") },
            ],
          },
          {
            kind: "log",
            label: tr("Known recipes"),
            max: 7,
            lines: (c) => {
              const names = Object.values(c.s.recipesKnown).map(
                (out) => itemDef(c.s, out)?.name ?? out,
              );
              const list = c.get("sort", 0) === 1 ? [...names].sort() : names.reverse();
              return list.length
                ? list.slice(0, 7)
                : [tr("No recipe on file yet. Combine something.")];
            },
          },
          { kind: "readout", label: tr("Archetypes hit"), value: (c) => counter(c, "archetypes") },
        ],
      },
    ],
  },

  // ── CDC-001 ── violet VFD crystal indexer with CRC stream
  {
    id: "CDC-001",
    model: tr("Crystal Data Cache · CDC-001 · rev B"),
    face: "terminal",
    font: "vfd",
    accent: "#c77dff",
    plate: "#1c1624",
    boot: [
      tr("crystal index … rebuilding"),
      tr("slice tracker: Crystal #0089"),
      tr("CRC engine armed"),
    ],
    pages: [
      {
        id: "index",
        label: tr("Index"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Slices"),
                value: (c) => counter(c, "slices"),
                unit: `/${SLICE_TOTAL}`,
              },
              { kind: "readout", label: tr("Relics"), value: (c) => inventoryOfKind(c, "relikt") },
              {
                kind: "readout",
                label: tr("Archive"),
                value: (c) => archiveCount(c),
                unit: `/${ARCHIVE.length}`,
              },
            ],
          },
          {
            kind: "bar",
            label: tr("Crystal #0089"),
            value: (c) => counter(c, "slices"),
            max: SLICE_TOTAL,
            tone: (c) => (counter(c, "slices") >= SLICE_TOTAL ? "ok" : "info"),
          },
          {
            kind: "leds",
            items: [
              { label: tr("index"), on: (c) => c.online, tone: "ok" },
              { label: tr("slices"), on: (c) => counter(c, "slices") > 0, tone: "info" },
              { label: tr("sync"), on: (c) => isOn(c, "NET-001"), tone: "info", blink: true },
              { label: "#0089", on: (c) => !!c.s.insights.kristall_0089, tone: "warn" },
            ],
          },
        ],
      },
      {
        id: "crc",
        label: tr("CRC"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "mode",
            key: "stream",
            label: tr("Stream"),
            def: 0,
            options: [
              { value: 0, label: tr("slices") },
              { value: 1, label: tr("relics") },
              { value: 2, label: tr("archive") },
            ],
          },
          {
            kind: "scope",
            label: tr("Data stream"),
            grid: true,
            wave: (x, c) => {
              if (!c.online) return 0;
              const k = 10 + c.get("stream", 0) * 8;
              return (Math.sin(x * k + c.t * 5) > 0 ? 0.7 : -0.7) + wobble(x * 60 + c.t, 9) * 0.06;
            },
          },
          {
            kind: "log",
            label: tr("CRC check"),
            max: 5,
            lines: (c) => {
              const mode = c.get("stream", 0);
              if (mode === 1) {
                const relics = Object.entries(c.s.inventory)
                  .filter(([id, k]) => k > 0 && itemDef(c.s, id)?.kind === "relikt")
                  .map(([id]) => tr("{name} … CRC ok", { name: itemDef(c.s, id)?.name ?? id }));
                return relics.length ? relics.slice(0, 5) : [tr("no relic in reach")];
              }
              if (mode === 2) {
                const found = foundEntries(c.s)
                  .slice(0, 5)
                  .map((e) => e.title);
                return found.length ? found : [tr("archive empty — nothing found yet")];
              }
              const n = counter(c, "slices");
              return n
                ? [tr("{n} of {total} slices indexed, CRC ok", { n, total: SLICE_TOTAL })]
                : [tr("no slice indexed")];
            },
          },
          { kind: "button", label: tr("Read out"), action: "use" },
        ],
      },
    ],
  },

  // ── MEM-001 ── rack memory map with SPD timing page
  {
    id: "MEM-001",
    model: tr("Memory Monitor · MEM-001 · 4 DIMM slots"),
    face: "rack",
    font: "mono",
    accent: "#4dd0e1",
    plate: "#151d22",
    boot: [
      tr("DIMM0 … 8 GB, SPD ok"),
      tr("DIMM1 … SPD checksum wrong, using it anyway"),
      tr("memory map: 2019 onwards"),
    ],
    pages: [
      {
        id: "map",
        label: tr("Map"),
        widgets: [
          {
            kind: "mode",
            key: "view",
            label: tr("View"),
            def: 0,
            options: [
              { value: 0, label: tr("insights") },
              { value: 1, label: tr("archive") },
              { value: 2, label: tr("MCP banks") },
            ],
          },
          {
            kind: "matrix",
            label: tr("Memory map"),
            cols: 16,
            rows: 4,
            cell: (i, c) => {
              if (!c.online) return 0;
              const v = c.get("view", 0);
              const frac =
                v === 1
                  ? archiveCount(c) / Math.max(1, ARCHIVE.length)
                  : v === 2
                    ? stageFrac(c, "MCP-000")
                    : insightCount(c) / Math.max(1, INSIGHTS.length);
              const idx = v === 2 ? (i % 4) * 16 + Math.floor(i / 4) : i;
              return idx < Math.round(frac * 64) ? 0.6 + 0.4 * Math.abs(wobble(c.t + i, i)) : 0.06;
            },
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Insights"),
                value: (c) => insightCount(c),
                unit: `/${INSIGHTS.length}`,
              },
              {
                kind: "readout",
                label: tr("Bandwidth"),
                value: (c) =>
                  c.online
                    ? Math.round(
                        (25.6 / (c.get("cas", 16) / 14)) * (0.95 + wobble(c.t, 8) * 0.03) * 10,
                      ) / 10
                    : 0,
                unit: "GB/s",
                digits: 1,
              },
            ],
          },
        ],
      },
      {
        id: "spd",
        label: tr("SPD"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "slider",
            key: "cas",
            label: tr("CAS latency"),
            min: 12,
            max: 22,
            step: 1,
            def: 16,
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Access time"),
                value: (c) => Math.round((c.get("cas", 16) / 1.6) * 10) / 10,
                unit: "ns",
                digits: 1,
              },
              {
                kind: "bar",
                label: tr("Stability"),
                value: (c) => Math.round(unit(0.35 + (c.get("cas", 16) - 12) * 0.075) * 100),
                max: 100,
                unit: "%",
                tone: (c) => (c.get("cas", 16) >= 15 ? "ok" : "warn"),
              },
            ],
          },
          {
            kind: "log",
            label: tr("Modules"),
            max: 5,
            lines: (c) => [
              tr("DIMM0: 8 GB · lab logs"),
              tr("DIMM1: 8 GB · insights ({n})", { n: insightCount(c) }),
              stagesDone(c.s, "MCP-000") >= 3
                ? tr("DIMM2: MCP memory bank · restored")
                : tr("DIMM2: empty — the MCP needs 2 Memory Chips"),
              tr("Memory Chips in inventory: {n}", { n: items(c, "speicherchip") }),
            ],
          },
          { kind: "button", label: tr("Read out"), action: "use" },
        ],
      },
    ],
  },

  // ── CPU-001 ── green LCD core bars and process table
  {
    id: "CPU-001",
    model: tr("CPU Monitor · CPU-001 · quad core"),
    face: "console",
    font: "lcd",
    accent: "#39ff14",
    plate: "#121a12",
    boot: [
      tr("cores 0–3 online, core 2 sulking"),
      tr("frequency governor loaded"),
      tr("thermal link to THM-001"),
    ],
    pages: [
      {
        id: "cores",
        label: tr("Cores"),
        widgets: [
          {
            kind: "row",
            widgets: [0, 1, 2, 3].map((i) => ({
              kind: "bar" as const,
              label: tr("Core {n}", { n: i }),
              value: (c: UiCtx) => Math.round(coreUtil(c, i) * 100),
              max: 100,
              unit: "%",
              tone: (c: UiCtx): Tone => (coreUtil(c, i) > 0.9 ? "bad" : "ok"),
            })),
          },
          {
            kind: "graph",
            label: tr("Load"),
            series: (c) => history(c, 48, 0.3, (t) => coreUtil(c, 0, t)),
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Clock"),
                value: (c) =>
                  c.online
                    ? Math.round((1.2 + cpuGov(c) * 2.4 + wobble(c.t, 3) * 0.05) * 100) / 100
                    : 0,
                unit: "GHz",
                digits: 2,
              },
              { kind: "readout", label: tr("Processes"), value: (c) => onlineCount(c) },
              {
                kind: "readout",
                label: tr("Blocked"),
                value: (c) => c.power.starved.length,
                tone: (c) => (c.power.starved.length ? "bad" : "ok"),
              },
            ],
          },
          {
            kind: "mode",
            key: "gov",
            label: tr("Governor"),
            def: 1,
            options: [
              { value: 0, label: tr("powersave") },
              { value: 1, label: tr("balanced") },
              { value: 2, label: tr("performance") },
            ],
          },
        ],
      },
      {
        id: "procs",
        label: tr("Processes"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "log",
            label: tr("Process table"),
            max: 8,
            lines: (c) => {
              const lines = c.power.starved.map((x) =>
                x.reason === "hitze"
                  ? tr("{id}  blocked · heat", { id: x.id })
                  : tr("{id}  blocked · power", { id: x.id }),
              );
              for (const id of c.power.online) {
                if (lines.length >= 8) break;
                lines.push(tr("{id}  running", { id }));
              }
              return lines;
            },
          },
          { kind: "button", label: tr("Read out"), action: "use" },
        ],
      },
    ],
  },

  // ── NET-001 ── (worked example; German in lib/i18n/de/device-ui.ts)
  {
    id: "NET-001",
    model: tr("Network Monitor · NET-001 · rack unit, 4 ports"),
    face: "rack",
    font: "lcd",
    accent: "#2fd3ff",
    plate: "#1a2330",
    boot: [
      tr("NIC eth0 … link up 1000 Mb/s"),
      tr("DHCP lease 10.0.1.23 (gateway 10.0.1.1)"),
      tr("packet inspector armed"),
    ],
    pages: [
      {
        id: "traffic",
        label: tr("Traffic"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Nodes online"),
                value: (c) => onlineCount(c),
              },
              {
                kind: "readout",
                label: tr("Linked"),
                value: (c) => linkCount(c),
                unit: "/10",
              },
              {
                kind: "readout",
                label: tr("Latency"),
                value: (c) => Math.round(4 + gridLoad(c) * 18 + wobble(c.t, 3) * 2),
                unit: "ms",
              },
            ],
          },
          {
            kind: "graph",
            label: tr("Throughput"),
            series: (c) =>
              Array.from({ length: 48 }, (_, i) =>
                unit(0.25 + linkCount(c) * 0.06 + wobble(c.t - (47 - i) * 0.25, 5) * 0.2),
              ),
          },
          {
            kind: "leds",
            label: tr("Ports"),
            items: [
              { label: "eth0", on: (c) => c.online, tone: "ok" },
              { label: "eth1", on: (c) => linkCount(c) > 0, tone: "ok", blink: true },
              { label: "eth2", on: (c) => linkCount(c) > 4, tone: "ok", blink: true },
              { label: "uplink", on: false, tone: "bad" },
            ],
          },
          { kind: "button", label: tr("Read out"), action: "use" },
        ],
      },
      {
        id: "inspect",
        label: tr("Inspector"),
        widgets: [
          {
            kind: "mode",
            key: "filter",
            label: tr("Filter"),
            def: 0,
            options: [
              { value: 0, label: tr("all") },
              { value: 1, label: tr("anomalous") },
              { value: 2, label: tr("MCP") },
            ],
          },
          {
            kind: "log",
            label: tr("Packets"),
            max: 6,
            lines: (c) =>
              c.get("filter") === 2
                ? [tr("MCP-000 → *: heartbeat (reluctant)"), tr("MCP-000 → CLK-001: are you sure?")]
                : c.get("filter") === 1
                  ? counter(c, "drone_runs") > 0
                    ? [tr("EXD-001 → NET-001: telemetry burst, CRC ok")]
                    : [tr("no anomalous traffic")]
                  : [
                      tr("ARP who-has 10.0.1.1"),
                      tr("NTP sync CLK-001 ±0.3 ms"),
                      tr("MCP-000 heartbeat"),
                    ],
          },
        ],
      },
    ],
  },

  // ── TMP-001 ── nixie probe board with alarm threshold
  {
    id: "TMP-001",
    model: tr("Temperature Monitor · TMP-001 · 12 probes"),
    face: "cabinet",
    font: "nixie",
    accent: "#ff5c5c",
    plate: "#231616",
    boot: [
      tr("probes: 12 found, 11 answering"),
      tr("threshold table loaded"),
      tr("Deep Lab probe: frost on the lens"),
    ],
    pages: [
      {
        id: "zones",
        label: tr("Zones"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "gauge",
                label: tr("Cooling"),
                min: -30,
                max: 110,
                unit: "°C",
                warn: 60,
                bad: 85,
                value: (c) => zoneTemp(c, 0),
              },
              {
                kind: "gauge",
                label: tr("Computing"),
                min: -30,
                max: 110,
                unit: "°C",
                warn: 60,
                bad: 85,
                value: (c) => zoneTemp(c, 1),
              },
              {
                kind: "gauge",
                label: tr("Tier-3 bay"),
                min: -30,
                max: 110,
                unit: "°C",
                warn: 60,
                bad: 85,
                value: (c) => zoneTemp(c, 2),
              },
              {
                kind: "gauge",
                label: tr("Deep Lab"),
                min: -30,
                max: 110,
                unit: "°C",
                warn: 60,
                bad: 85,
                value: (c) => zoneTemp(c, 3),
              },
            ],
          },
          {
            kind: "leds",
            label: tr("Alarms"),
            items: [0, 1, 2, 3].map((z) => ({
              label: ["COOL", "COMP", "T3", "DEEP"][z] ?? "",
              on: (c: UiCtx) => c.online && zoneTemp(c, z) > c.get("alarm", 60),
              tone: "bad" as const,
              blink: true,
            })),
          },
          {
            kind: "slider",
            key: "alarm",
            label: tr("Alarm threshold"),
            min: 30,
            max: 90,
            step: 5,
            def: 60,
            unit: "°C",
          },
          {
            kind: "text",
            text: (c) => deviceReadout(c.s, "TMP-001")[0] ?? tr("No probe data."),
            tone: (c) => (c.power.starved.some((x) => x.reason === "hitze") ? "bad" : "ok"),
          },
        ],
      },
      {
        id: "trend",
        label: tr("Trend"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "mode",
            key: "unit",
            label: tr("Unit"),
            def: 0,
            options: [
              { value: 0, label: "°C" },
              { value: 1, label: "°F" },
              { value: 2, label: "K" },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Hottest"),
                value: (c) =>
                  convertTemp(c, Math.max(zoneTemp(c, 0), zoneTemp(c, 1), zoneTemp(c, 2))),
              },
              {
                kind: "readout",
                label: tr("Coldest"),
                value: (c) => convertTemp(c, zoneTemp(c, 3)),
              },
            ],
          },
          {
            kind: "graph",
            label: tr("Cooling zone"),
            series: (c) => history(c, 48, 0.6, (t) => (zoneTemp(c, 0, t) - 10) / 40),
          },
          { kind: "button", label: tr("Read out"), action: "use" },
        ],
      },
    ],
  },

  // ── THM-001 ── reactor-style coolant loop controller
  {
    id: "THM-001",
    model: tr("Thermal Manager · THM-001 · closed coolant loop"),
    face: "reactor",
    font: "vfd",
    accent: "#5ec8ff",
    plate: "#101c26",
    boot: [
      tr("coolant pump … primed"),
      tr("loop pressure 1.8 bar"),
      tr("auto mode on (the fans have opinions)"),
    ],
    pages: [
      {
        id: "loop",
        label: tr("Loop"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "gauge",
                label: tr("Coolant"),
                min: 0,
                max: 80,
                unit: "°C",
                warn: 45,
                bad: 65,
                value: (c) =>
                  c.online
                    ? 12 +
                      tier3Cooled(c).length * 6 +
                      (100 - thmFan(c)) * 0.25 +
                      wobble(c.t * 0.3, 1)
                    : 0,
              },
              {
                kind: "readout",
                label: tr("Cooled"),
                value: (c) => tier3Cooled(c).length,
              },
              {
                kind: "readout",
                label: tr("Loops"),
                value: (c) => linkCount(c),
                unit: `/${hubCap("THM-001")}`,
              },
            ],
          },
          {
            kind: "scope",
            label: tr("Pump flow"),
            color: "#9be3ff",
            wave: (x, c) =>
              c.online
                ? Math.sin(x * Math.PI * (2 + thmFan(c) / 12) - c.t * (thmFan(c) / 15)) * 0.7
                : 0,
          },
          {
            kind: "row",
            widgets: [
              { kind: "switch", key: "auto", label: tr("Auto"), def: 1 },
              {
                kind: "knob",
                key: "fan",
                label: tr("Fan (manual)"),
                min: 0,
                max: 100,
                step: 5,
                def: 70,
                unit: "%",
              },
              {
                kind: "readout",
                label: tr("Fan"),
                value: (c) => (c.online ? thmFan(c) : 0),
                unit: "%",
              },
            ],
          },
        ],
      },
      {
        id: "zones",
        label: tr("Cooled devices"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "log",
            label: tr("Cooling loop"),
            max: 8,
            lines: (c) => {
              const lines = tier3Cooled(c).map((id) => tr("{name}: cooled", { name: nameOf(id) }));
              for (const x of c.power.starved)
                if (x.reason === "hitze")
                  lines.push(tr("{name}: overheated", { name: nameOf(x.id) }));
              return lines.length ? lines : [tr("No tier-3 device on the loop yet.")];
            },
          },
          {
            kind: "bar",
            label: tr("Heat load"),
            value: (c) => tier3Cooled(c).length,
            max: () => Math.max(1, DEVICES.filter((d) => d.tier === 3 && d.power > 0).length),
          },
          { kind: "button", label: tr("Read out"), action: "use" },
        ],
      },
    ],
  },

  // ── PWR-001 ── CRT grid console: sources, consumers, priority circuits
  {
    id: "PWR-001",
    model: tr("Power Management System · PWR-001 · bus controller"),
    face: "console",
    font: "crt",
    accent: "#ffe066",
    plate: "#1f1c10",
    boot: [
      tr("bus controller … online"),
      tr("geothermal tap: checking valve"),
      tr("priority table loaded"),
    ],
    pages: [
      {
        id: "grid",
        label: tr("Grid"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "gauge",
                label: tr("Generation"),
                min: 0,
                max: 500,
                unit: "W",
                value: (c) => c.power.generation,
              },
              {
                kind: "gauge",
                label: tr("Demand"),
                min: 0,
                max: 500,
                unit: "W",
                warn: 350,
                value: (c) => c.power.demand,
              },
              {
                kind: "readout",
                label: tr("Geothermal"),
                value: (c) =>
                  c.s.flags.geo_routed ? (c.online ? "+150 W" : "+50 W") : tr("closed"),
                tone: (c) => (c.s.flags.geo_routed ? "ok" : "warn"),
              },
            ],
          },
          {
            kind: "mode",
            key: "list",
            label: tr("List"),
            def: 0,
            options: [
              { value: 0, label: tr("sources") },
              { value: 1, label: tr("consumers") },
              { value: 2, label: tr("starving") },
            ],
          },
          {
            kind: "log",
            label: tr("Distribution"),
            max: 7,
            lines: (c) => {
              const mode = c.get("list", 0);
              if (mode === 1) {
                const out: string[] = [];
                for (const id of c.power.online) {
                  const w = DEVICE_BY_ID.get(id)?.power ?? 0;
                  if (w > 0) out.push(`${id}  ${w} W`);
                  if (out.length >= 7) break;
                }
                return out.length ? out : [tr("no consumers")];
              }
              if (mode === 2) {
                const out = c.power.starved.map((x) =>
                  x.reason === "hitze"
                    ? tr("{name}: overheated", { name: nameOf(x.id) })
                    : tr("{name}: no power", { name: nameOf(x.id) }),
                );
                return out.length ? out : [tr("No consumer is starving.")];
              }
              return c.power.sources.length
                ? c.power.sources.map((x) => `${x.label}  +${x.watts} W`)
                : [tr("no sources")];
            },
          },
          {
            kind: "row",
            widgets: [
              { kind: "button", label: tr("Power grid"), action: "power" },
              { kind: "button", label: tr("Read out"), action: "use" },
            ],
          },
        ],
      },
      {
        id: "priority",
        label: tr("Priority"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "readout",
            label: tr("Priority circuits"),
            value: (c) => linkCount(c),
            unit: `/${hubCap("PWR-001")}`,
          },
          {
            kind: "leds",
            label: tr("Head of the grid"),
            items: ["BAT-001", "MCP-000", "PWR-001", "THM-001"].map((id) => ({
              label: id.slice(0, 3),
              on: (c: UiCtx) => isOn(c, id),
              tone: "ok" as const,
            })),
          },
          {
            kind: "log",
            label: tr("Served first"),
            max: 6,
            lines: (c) => {
              const l = linksOf(c.s, "PWR-001").map((id) => `${id} · ${nameOf(id)}`);
              return l.length ? l : [tr("No priority circuit. Link consumers on the LINKS page.")];
            },
          },
        ],
      },
    ],
  },

  // ── PWD-001 ── VFD bus display with harmonics spectrum
  {
    id: "PWD-001",
    model: tr("Power Display Panel · PWD-001 · three-phase bus"),
    face: "rack",
    font: "vfd",
    accent: "#ff9f1c",
    plate: "#221a10",
    boot: [
      tr("bus sense … 3 phases"),
      tr("reactive power compensation: +20 W"),
      tr("display burn-in: tolerable"),
    ],
    pages: [
      {
        id: "bus",
        label: tr("Bus"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "bar",
                label: tr("Generation"),
                value: (c) => c.power.generation,
                max: (c) => Math.max(1, c.power.generation),
                unit: "W",
              },
              {
                kind: "bar",
                label: tr("Load"),
                value: (c) => c.power.demand,
                max: (c) => Math.max(1, c.power.generation),
                unit: "W",
                tone: (c) => (gridLoad(c) > 0.9 ? "bad" : gridLoad(c) > 0.75 ? "warn" : "ok"),
              },
              {
                kind: "bar",
                label: tr("Reserve"),
                value: (c) => spareW(c),
                max: (c) => Math.max(1, c.power.generation),
                unit: "W",
              },
            ],
          },
          {
            kind: "graph",
            label: tr("Bus load"),
            color: "#ffc46b",
            series: (c) => history(c, 48, 0.4, (t) => gridLoad(c) + wobble(t, 4) * 0.04),
          },
          {
            kind: "leds",
            items: [
              { label: "OK", on: (c) => c.power.starved.length === 0, tone: "ok" },
              {
                label: "BROWNOUT",
                on: (c) => c.power.starved.some((x) => x.reason === "strom"),
                tone: "bad",
                blink: true,
              },
              {
                label: "HEAT",
                on: (c) => c.power.starved.some((x) => x.reason === "hitze"),
                tone: "warn",
                blink: true,
              },
              { label: "+20 W", on: (c) => c.online, tone: "info" },
            ],
          },
        ],
      },
      {
        id: "harmonics",
        label: tr("Harmonics"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "spectrum",
            label: tr("Harmonics"),
            bands: (c) =>
              Array.from({ length: 12 }, (_, k) => {
                const odd = k % 2 === 0;
                const damp = c.get("filter", 0) && k > 0 ? 0.25 : 1;
                return unit(
                  ((gridLoad(c) * (odd ? 1 : 0.4)) / (k + 1)) * damp + 0.03 + wobble(c.t, k) * 0.02,
                );
              }),
          },
          { kind: "switch", key: "filter", label: tr("Harmonic filter"), def: 0 },
          {
            kind: "log",
            label: tr("Bus report"),
            max: 4,
            lines: (c) => deviceReadout(c.s, "PWD-001"),
          },
          {
            kind: "row",
            widgets: [
              { kind: "button", label: tr("Read out"), action: "use" },
              { kind: "button", label: tr("Power grid"), action: "power" },
            ],
          },
        ],
      },
    ],
  },

  // ── VLT-001 ── handheld needle voltmeter on the UEC tap
  {
    id: "VLT-001",
    model: tr("Volt Meter Display · VLT-001 · UEC tap"),
    face: "handheld",
    font: "lcd",
    accent: "#b8ff3c",
    plate: "#1b1f14",
    boot: [
      tr("probe leads: red, black, and one of unknown colour"),
      tr("range: auto"),
      tr("UEC tap connected"),
    ],
    pages: [
      {
        id: "meter",
        label: tr("Meter"),
        widgets: [
          {
            kind: "mode",
            key: "range",
            label: tr("Range"),
            def: 0,
            options: [
              { value: 0, label: "V" },
              { value: 1, label: "A" },
              { value: 2, label: "Vpk" },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "dial",
                label: tr("Needle"),
                marks: ["NOM", "+", "", "−"],
                angle: (c) => {
                  if (!c.online) return -2.3;
                  const r = c.get("range", 0);
                  const v =
                    r === 1
                      ? (gridLoad(c) - 0.5) * 4
                      : r === 2
                        ? (Math.max(1, uecRatio()) - 1) * 8
                        : (uecRatio() - 1) * 6;
                  return Math.max(-2.3, Math.min(2.3, v + wobble(c.t * 3, 5) * 0.03));
                },
              },
              {
                kind: "readout",
                label: tr("Reading"),
                value: (c) => (c.online ? vltReading(c) : "—"),
              },
            ],
          },
          {
            kind: "scope",
            label: tr("Ripple"),
            wave: (x, c) => {
              const amp = Math.abs(1 - uecRatio()) * 2 + 0.05;
              return (
                Math.sin(x * Math.PI * 8 + c.t * 4) * Math.min(0.9, amp) +
                wobble(x * 30 + c.t, 5) * 0.05
              );
            },
          },
        ],
      },
      {
        id: "core",
        label: tr("Core"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "row",
            widgets: [
              { kind: "readout", label: tr("UEC today"), value: () => uecOutput(), unit: "W" },
              {
                kind: "readout",
                label: tr("Delta"),
                value: () => Math.round((uecRatio() - 1) * 100),
                unit: "%",
                tone: () => (uecRatio() >= 1 ? "ok" : "warn"),
              },
              {
                kind: "readout",
                label: tr("Stabilised"),
                value: (c) => vltStabilised(c),
                unit: "W",
              },
            ],
          },
          {
            kind: "log",
            label: tr("Core report"),
            max: 3,
            lines: (c) => deviceReadout(c.s, "VLT-001"),
          },
          {
            kind: "row",
            widgets: [
              { kind: "button", label: tr("Read out"), action: "use" },
              { kind: "button", label: tr("Power grid"), action: "power" },
            ],
          },
        ],
      },
    ],
  },

  // ── MSC-001 ── handheld CRT scanner with radar and composition spectrum
  {
    id: "MSC-001",
    model: tr("Material Scanner · MSC-001 · sweep head"),
    face: "handheld",
    font: "crt",
    accent: "#00ffa3",
    plate: "#0f1f19",
    boot: [
      tr("sensor head … calibrated against a coffee cup"),
      tr("material library loaded"),
      tr("anomaly flagging armed"),
    ],
    pages: [
      {
        id: "sweep",
        label: tr("Sweep"),
        widgets: [
          {
            kind: "row",
            widgets: [
              { kind: "radar", label: tr("Contacts on this level"), blips: (c) => mscBlips(c) },
              {
                kind: "readout",
                label: tr("Contacts"),
                value: (c) => mscBlips(c).length,
              },
            ],
          },
          {
            kind: "mode",
            key: "band",
            label: tr("Band"),
            def: 0,
            options: [
              { value: 0, label: tr("all") },
              { value: 1, label: tr("crystal") },
              { value: 2, label: tr("scrap") },
            ],
          },
          {
            kind: "knob",
            key: "range",
            label: tr("Range"),
            min: 20,
            max: 80,
            step: 5,
            def: 50,
            unit: "m",
          },
          {
            kind: "readout",
            label: tr("Hidden samples"),
            value: (c) => `${takenOf(c, hiddenBy("MSC-001"))}/${hiddenBy("MSC-001").length}`,
          },
        ],
      },
      {
        id: "composition",
        label: tr("Composition"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "spectrum",
            label: tr("Inventory composition"),
            color: "#5cffc4",
            bands: (c) => composition(c),
          },
          {
            kind: "text",
            text: tr("energy · signal · optics · thermal · mechanics · quantum · resonance · data"),
          },
          {
            kind: "readout",
            label: tr("Samples"),
            value: (c) => Object.values(c.s.inventory).reduce((a, b) => a + Math.max(0, b), 0),
          },
          { kind: "button", label: tr("Read out"), action: "use" },
        ],
      },
    ],
  },

  // ── RMG-001 ── reactor-style coil magnet with current slider
  {
    id: "RMG-001",
    model: tr("Resource Magnet · RMG-001 · twin coil"),
    face: "reactor",
    font: "lcd",
    accent: "#ff4fa3",
    plate: "#221420",
    boot: [
      tr("coil A/B … continuity ok"),
      tr("flux stabiliser warming up"),
      tr("please remove wristwatches"),
    ],
    pages: [
      {
        id: "field",
        label: tr("Field"),
        widgets: [
          {
            kind: "slider",
            key: "current",
            label: tr("Coil current"),
            min: 0,
            max: 20,
            step: 1,
            def: 12,
            unit: "A",
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "gauge",
                label: tr("Field"),
                min: 0,
                max: 800,
                unit: "mT",
                warn: 600,
                bad: 720,
                value: (c) => rmgField(c),
              },
              {
                kind: "readout",
                label: tr("Grille finds"),
                value: (c) => `${takenOf(c, hiddenBy("RMG-001"))}/${hiddenBy("RMG-001").length}`,
              },
            ],
          },
          {
            kind: "scope",
            label: tr("Flux"),
            color: "#ff8cc6",
            wave: (x, c) => {
              const f = rmgField(c, c.t - x) / 800;
              return Math.sin(x * Math.PI * 10 + c.t * 7) * f;
            },
          },
          { kind: "switch", key: "pulse", label: tr("Pulse attract"), def: 0 },
        ],
      },
      {
        id: "coils",
        label: tr("Coils"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "leds",
            items: [
              { label: tr("coil A"), on: (c) => c.online, tone: "ok" },
              { label: tr("coil B"), on: (c) => c.online, tone: "ok" },
              {
                label: tr("flux lock"),
                on: (c) => c.online && c.get("current", 12) >= 8,
                tone: "info",
              },
              {
                label: tr("pulse"),
                on: (c) => c.online && !!c.get("pulse", 0),
                tone: "warn",
                blink: true,
              },
            ],
          },
          {
            kind: "graph",
            label: tr("Field history"),
            series: (c) => history(c, 48, 0.2, (t) => rmgField(c, t) / 800),
          },
        ],
      },
    ],
  },

  // ── ATK-001 ── CRT tank gauge on the seep valve
  {
    id: "ATK-001",
    model: tr("Abstractum Tank · ATK-001 · 24 units"),
    face: "cabinet",
    font: "crt",
    accent: "#8f7cff",
    plate: "#17152a",
    boot: [
      tr("tank seal … holding"),
      tr("level sensor floating"),
      tr("seep valve linked (Geothermal, Level −1)"),
    ],
    pages: [
      {
        id: "tank",
        label: tr("Tank"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "bar",
                label: tr("Abstractum"),
                value: (c) => items(c, "abstractum"),
                max: 24,
                tone: (c) => (items(c, "abstractum") >= 3 ? "ok" : "warn"),
              },
              {
                kind: "gauge",
                label: tr("Pressure"),
                min: 0,
                max: 4,
                unit: "bar",
                warn: 3,
                value: (c) =>
                  c.online
                    ? 1 +
                      Math.min(24, items(c, "abstractum")) * 0.08 * (c.get("valve", 50) / 50) +
                      wobble(c.t, 2) * 0.02
                    : 0,
              },
            ],
          },
          {
            kind: "scope",
            label: tr("Level"),
            color: "#b3a6ff",
            wave: (x, c) => {
              const lvl = unit(items(c, "abstractum") / 24) * 1.6 - 0.8;
              const slosh = (c.get("valve", 50) / 100) * 0.25;
              return lvl + Math.sin(x * Math.PI * 3 + c.t * 2) * slosh;
            },
          },
          {
            kind: "knob",
            key: "valve",
            label: tr("Valve"),
            min: 0,
            max: 100,
            step: 10,
            def: 50,
            unit: "%",
          },
        ],
      },
      {
        id: "seep",
        label: tr("Seep"),
        widgets: [
          {
            kind: "text",
            text: (c) => fwLine(c),
            tone: (c) => (isUpdated(c.s, c.id) ? "ok" : "info"),
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Next charge"),
                value: (c) => {
                  const p = seep();
                  const left = p ? pickupRespawnLeft(c.s, p) : 0;
                  return left > 0 ? mmss(left) : tr("full");
                },
              },
              {
                kind: "readout",
                label: tr("Yield"),
                value: (c) => (c.online ? "×2" : "×1"),
                tone: (c) => (c.online ? "ok" : "off"),
              },
            ],
          },
          {
            kind: "graph",
            label: tr("Inflow"),
            series: (c) =>
              history(
                c,
                32,
                0.5,
                (t) =>
                  (c.online ? 0.3 + (c.get("valve", 50) / 100) * 0.5 : 0.1) + wobble(t, 3) * 0.08,
              ),
          },
          { kind: "button", label: tr("Read out"), action: "use" },
        ],
      },
    ],
  },
];
