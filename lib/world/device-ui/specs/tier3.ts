/**
 * Device interfaces — tier-3 devices and MCP-000 (see ../types.ts). German
 * in lib/i18n/de/device-ui-tier3.ts.
 *
 * Every readout is game state (power, insights, inventory, links, firmware,
 * archive, play time); `wobble` only adds sensor jitter. Controls change what
 * the faceplate shows, never the game rules.
 */
import { tr } from "@/lib/i18n";
import { ARCHIVE } from "@/lib/world/archive";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ENDINGS, INSIGHTS } from "@/lib/world/content/story";
import {
  builtCount,
  gridLoad,
  items,
  linkCount,
  minutes,
  onlineCount,
  spareW,
  unit,
  wobble,
} from "@/lib/world/device-ui/metrics";
import type { DeviceUiSpec, Tone, UiCtx } from "@/lib/world/device-ui/types";
import { hasFeature, installedVersion, isUpdated } from "@/lib/world/firmware";
import { isBuilt, openBlueprints, stagesDone } from "@/lib/world/game";
import { isLinked } from "@/lib/world/links";

// ── Shared helpers ───────────────────────────────────────────────

const TAU = Math.PI * 2;

const has = (c: UiCtx, insight: string): boolean => !!c.s.insights[insight];
const on = (c: UiCtx, id: string): boolean => c.power.online.has(id);
const hot = (c: UiCtx, id: string): boolean =>
  c.power.starved.some((x) => x.id === id && x.reason === "hitze");
const pct = (v: number): number => Math.round(Math.max(0, Math.min(100, v)));

/** Watts a generator actually feeds into the grid right now. */
function sourceW(c: UiCtx, id: string): number {
  const name = DEVICE_BY_ID.get(id)?.name;
  return c.power.sources.find((x) => x.label === name)?.watts ?? 0;
}

/** A 48-sample history line (oldest first). */
function history(c: UiCtx, seed: number, base: (c: UiCtx) => number, amp = 0.12): number[] {
  const b = base(c);
  return Array.from({ length: 48 }, (_, i) => unit(b + wobble(c.t - (47 - i) * 0.3, seed) * amp));
}

/** Lab status of one device, as the MCP's registry prints it. */
function regStatus(c: UiCtx, id: string): { word: string; tone: Tone } {
  if (!isBuilt(c.s, id)) return { word: tr("reg::not built"), tone: "off" };
  if (c.power.online.has(id)) return { word: tr("reg::online"), tone: "ok" };
  const st = c.power.starved.find((x) => x.id === id);
  if (st)
    return st.reason === "hitze"
      ? { word: tr("reg::overheated"), tone: "bad" }
      : { word: tr("reg::no power"), tone: "warn" };
  return { word: tr("reg::switched off"), tone: "off" };
}

// ── MCP-000 ──────────────────────────────────────────────────────

const DAMIEN_INSIGHTS = [
  "damien_zweifel",
  "damien_kontrapunkt",
  "damien_stimme",
  "damien_echo",
  "damien_muster",
  "damien_koordinaten",
] as const;

/** The MCP's dry commentary: situation × candour (knob). */
function mcpComment(c: UiCtx): string {
  const candour = c.get("candour", 3);
  const lvl = candour < 4 ? 0 : candour < 8 ? 1 : 2;
  const endings = Object.keys(c.s.endings).length;
  if (c.power.starved.length > 0) {
    const n = c.power.starved.length;
    if (lvl === 0)
      return tr("Notice: {n} device(s) not operating. Please consult the power grid.", { n });
    if (lvl === 1)
      return tr("{n} device(s) are switched on and doing nothing. Much like the previous staff.", {
        n,
      });
    return tr(
      "{n} machine(s) are begging for power. I have been begging for 2,561 days. Nobody came either.",
      { n },
    );
  }
  if (endings > 0) {
    if (lvl === 0) return tr("Log entry: an outcome has been reached. Archiving.");
    if (lvl === 1) return tr("You finished something. I have a column for that now.");
    return tr("You actually ended something. The last person who tried that is still in the Halo.");
  }
  if (builtCount(c) < 6) {
    if (lvl === 0) return tr("Lab status: largely dormant. Repairs recommended.");
    if (lvl === 1) return tr("Most of the lab is asleep. I envy it.");
    return tr("Welcome to a lab held together by dust and my patience. The dust is doing better.");
  }
  if (lvl === 0) return tr("Lab status: operational. Performance within tolerance.");
  if (lvl === 1)
    return tr("Things are running. I would call it progress, but I have seen progress before.");
  return tr("Everything hums. Enjoy it. The last time everything hummed, Damien pressed a button.");
}

/** Registry lines (≤ 39 devices) filtered by the mode setting. */
function registry(c: UiCtx): string[] {
  const f = c.get("filter", 0);
  const out: string[] = [];
  for (const d of DEVICES) {
    if (d.id === "MCP-000" || !isBuilt(c.s, d.id)) continue;
    const onl = c.power.online.has(d.id);
    if (f === 1 && !onl) continue;
    if (f === 2 && onl) continue;
    if (f === 3 && !isLinked(c.s, "MCP-000", d.id)) continue;
    out.push(`${d.id.padEnd(8)} ${regStatus(c, d.id).word}`);
  }
  if (out.length === 0)
    out.push(
      f === 3 ? tr("No device on the admin bus. Link some — I get lonely.") : tr("Registry empty."),
    );
  return out;
}

const MCP: DeviceUiSpec = {
  id: "MCP-000",
  model: tr("Master Control Program · MCP-000 · core rev 0.9.7, emergency mode"),
  face: "terminal",
  font: "crt",
  accent: "#ffa726",
  plate: "#15100a",
  boot: [
    tr("MCP-000 kernel 0.9.7 … emergency mode (day 2,561)"),
    tr("device registry … loaded, mostly dust"),
    tr("voice module … dry"),
    tr("Good. You again."),
  ],
  pages: [
    {
      id: "core",
      label: tr("Core"),
      widgets: [
        {
          kind: "row",
          widgets: [
            {
              kind: "readout",
              label: tr("Uptime"),
              value: (c) => 2561 + Math.floor(c.s.playTime / 86400),
              unit: tr("unit::days"),
            },
            {
              kind: "readout",
              label: tr("Repair level"),
              value: (c) => `${stagesDone(c.s, "MCP-000")}/3`,
              tone: (c) => (stagesDone(c.s, "MCP-000") >= 3 ? "ok" : "warn"),
            },
            {
              kind: "readout",
              label: tr("Devices built"),
              value: (c) => `${builtCount(c)}/${DEVICES.length}`,
            },
            {
              kind: "readout",
              label: tr("Online"),
              value: (c) => onlineCount(c),
              tone: (c) => (c.power.starved.length ? "warn" : "ok"),
            },
          ],
        },
        {
          kind: "graph",
          label: tr("Core heartbeat"),
          color: "#ffcc80",
          series: (c) =>
            Array.from({ length: 48 }, (_, i) => {
              const x = c.t * 2 - (47 - i) * 0.35;
              const beat = Math.abs(Math.sin(x * (1 + gridLoad(c)))) ** 12;
              return unit(0.2 + beat * 0.7 + wobble(x, 7) * 0.05);
            }),
        },
        { kind: "text", text: (c) => mcpComment(c), tone: "info" },
        {
          kind: "knob",
          key: "candour",
          label: tr("Candour"),
          min: 0,
          max: 10,
          step: 1,
          def: 3,
        },
        {
          kind: "row",
          widgets: [
            { kind: "button", label: tr("Talk to the MCP"), action: "talk" },
            { kind: "button", label: tr("Check memory banks"), action: "use" },
            { kind: "button", label: tr("Power grid"), action: "power" },
          ],
        },
      ],
    },
    {
      id: "registry",
      label: tr("Registry"),
      widgets: [
        {
          kind: "row",
          widgets: [
            {
              kind: "readout",
              label: tr("Admin bus"),
              value: (c) => linkCount(c),
              unit: "/8",
            },
            {
              kind: "readout",
              label: tr("Faults"),
              value: (c) => c.power.starved.length,
              tone: (c) => (c.power.starved.length ? "bad" : "ok"),
            },
            {
              kind: "readout",
              label: tr("Grid load"),
              value: (c) => pct(gridLoad(c) * 100),
              unit: "%",
            },
          ],
        },
        {
          kind: "matrix",
          label: tr("Lab map (one cell per device)"),
          cols: 8,
          rows: 5,
          color: "#ffa726",
          cell: (i, c) => {
            const d = DEVICES[i];
            if (!d) return 0;
            if (c.power.online.has(d.id)) return 0.75 + wobble(c.t, i) * 0.25;
            if (c.power.starved.some((x) => x.id === d.id))
              return Math.sin(c.t * 6 + i) > 0 ? 0.6 : 0.1;
            return isBuilt(c.s, d.id) ? 0.3 : c.s.discovered[d.id] ? 0.08 : 0;
          },
        },
        {
          kind: "mode",
          key: "filter",
          label: tr("Show"),
          def: 0,
          options: [
            { value: 0, label: tr("reg::all") },
            { value: 1, label: tr("reg::running") },
            { value: 2, label: tr("reg::idle") },
            { value: 3, label: tr("reg::admin bus") },
          ],
        },
        { kind: "log", label: tr("Device registry"), max: 10, lines: (c) => registry(c) },
      ],
    },
    {
      id: "memory",
      label: tr("Memory"),
      widgets: [
        {
          kind: "bar",
          label: tr("Insights indexed"),
          value: (c) => INSIGHTS.filter((i) => c.s.insights[i.id]).length,
          max: INSIGHTS.length,
        },
        {
          kind: "bar",
          label: tr("Archive recovered"),
          value: (c) => Object.keys(c.s.archive).length,
          max: ARCHIVE.length,
          tone: "info",
        },
        {
          kind: "bar",
          label: tr("Damien, reconstructed"),
          value: (c) => DAMIEN_INSIGHTS.filter((k) => has(c, k)).length,
          max: DAMIEN_INSIGHTS.length,
          tone: (c) => (has(c, "damien_koordinaten") ? "ok" : "warn"),
        },
        {
          kind: "leds",
          label: tr("Subsystems"),
          items: [
            { label: tr("Speech"), on: (c) => stagesDone(c.s, "MCP-000") >= 2, tone: "ok" },
            { label: tr("Memory bank"), on: (c) => stagesDone(c.s, "MCP-000") >= 3, tone: "ok" },
            { label: "MEM-001", on: (c) => on(c, "MEM-001"), tone: "info" },
            { label: "NET-001", on: (c) => on(c, "NET-001"), tone: "info", blink: true },
            { label: tr("Logs 03:27"), on: (c) => has(c, "mcp_schuld"), tone: "warn" },
          ],
        },
        {
          kind: "row",
          widgets: [
            {
              kind: "readout",
              label: tr("Endings logged"),
              value: (c) => `${Object.keys(c.s.endings).length}/${ENDINGS.length}`,
            },
            { kind: "readout", label: tr("Your shift"), value: (c) => minutes(c), unit: "min" },
            {
              kind: "readout",
              label: tr("Firmware"),
              value: (c) => installedVersion(c.s, "MCP-000"),
            },
          ],
        },
        {
          kind: "log",
          label: tr("Lab journal (latest)"),
          max: 5,
          lines: (c) => c.s.log.slice(-5).map((l) => l.text),
        },
      ],
    },
  ],
};

// ── MFR-001 Microfusion Reactor ──────────────────────────────────

const mfrTemp = (c: UiCtx): number =>
  c.online
    ? 60 + c.get("throttle", 92) * 0.9 + wobble(c.t, 11) * 4 + (hot(c, "MFR-001") ? 40 : 0)
    : 0;

const MFR: DeviceUiSpec = {
  id: "MFR-001",
  model: tr("Microfusion Reactor · MFR-001 · 250 W magnetic mirror, fw 2.3"),
  face: "reactor",
  font: "vfd",
  accent: "#ff5a36",
  plate: "#221410",
  boot: [
    tr("magnetic mirror coils … energised"),
    tr("plasma ignition … 3 … 2 … 1 … lit"),
    tr("auto-SCRAM armed (response < 100 ms)"),
  ],
  pages: [
    {
      id: "plasma",
      label: tr("Plasma"),
      widgets: [
        {
          kind: "row",
          widgets: [
            {
              kind: "gauge",
              label: tr("Plasma temp."),
              value: (c) => Math.round(mfrTemp(c)),
              min: 0,
              max: 200,
              unit: "MK",
              warn: 150,
              bad: 175,
            },
            {
              kind: "gauge",
              label: tr("Output"),
              value: (c) => sourceW(c, "MFR-001"),
              min: 0,
              max: 300,
              unit: "W",
            },
          ],
        },
        {
          kind: "scope",
          label: tr("Confinement ring"),
          color: "#ffb199",
          grid: true,
          wave: (x, c) => {
            if (!c.online) return 0;
            const lobes = c.get("field", 4);
            const amp = 0.35 + c.get("throttle", 92) / 200;
            return (
              Math.sin(TAU * (x * lobes + c.t * 0.8)) * amp * 0.8 +
              Math.sin(TAU * (x * 23 + c.t * 3)) * 0.06 * (1 + wobble(c.t, 2))
            );
          },
        },
        {
          kind: "row",
          widgets: [
            {
              kind: "slider",
              key: "throttle",
              label: tr("Fuel feed"),
              min: 40,
              max: 100,
              step: 1,
              def: 92,
              unit: "%",
            },
            {
              kind: "knob",
              key: "field",
              label: tr("Mirror field"),
              min: 2,
              max: 8,
              step: 1,
              def: 4,
            },
          ],
        },
        {
          kind: "leds",
          label: tr("Safety"),
          items: [
            {
              label: tr("SCRAM armed"),
              on: (c) => c.online && hasFeature(c.s, "MFR-001", "auto-scram"),
              tone: "ok",
            },
            { label: tr("THM cooling"), on: (c) => on(c, "THM-001"), tone: "info" },
            { label: tr("Fuel autotune"), on: (c) => isUpdated(c.s, "MFR-001"), tone: "ok" },
            { label: tr("Overheat"), on: (c) => hot(c, "MFR-001"), tone: "bad", blink: true },
          ],
        },
      ],
    },
    {
      id: "grid",
      label: tr("Grid"),
      widgets: [
        {
          kind: "row",
          widgets: [
            {
              kind: "readout",
              label: tr("Generation"),
              value: (c) => Math.round(c.power.generation),
              unit: "W",
            },
            {
              kind: "readout",
              label: tr("Reactor share"),
              value: (c) =>
                c.power.generation > 0
                  ? pct((sourceW(c, "MFR-001") / c.power.generation) * 100)
                  : 0,
              unit: "%",
            },
            {
              kind: "readout",
              label: tr("Spare"),
              value: (c) => spareW(c),
              unit: "W",
              tone: (c) => (spareW(c) < 20 ? "warn" : "ok"),
            },
          ],
        },
        {
          kind: "bar",
          label: tr("Grid demand"),
          value: (c) => Math.round(c.power.demand),
          max: (c) => Math.max(1, Math.round(c.power.generation)),
          unit: "W",
          tone: (c) => (gridLoad(c) > 0.9 ? "bad" : gridLoad(c) > 0.7 ? "warn" : "ok"),
        },
        {
          kind: "graph",
          label: tr("Ring speed"),
          color: "#ff8a65",
          series: (c) =>
            history(c, 13, (k) => (k.online ? 0.3 + k.get("throttle", 92) / 160 : 0.02), 0.08),
        },
        {
          kind: "row",
          widgets: [
            { kind: "button", label: tr("Power grid"), action: "power" },
            { kind: "button", label: tr("Reactor report"), action: "use" },
          ],
        },
      ],
    },
  ],
};

// ── EMC-001 Exotic Matter Containment ────────────────────────────

const emcContained = (c: UiCtx): number =>
  items(c, "exotische_materie") + items(c, "anomaler_kern") + items(c, "abstractum");

const emcStability = (c: UiCtx): number =>
  c.online
    ? pct(
        58 +
          (has(c, "anomalie_gezaehmt") ? 14 : 0) +
          (has(c, "anomalie_hoert") ? 10 : 0) -
          c.get("compress", 2) * 4 +
          (on(c, "THM-001") ? 10 : -15) +
          wobble(c.t, 21) * 3,
      )
    : 0;

const EMC: DeviceUiSpec = {
  id: "EMC-001",
  model: tr("Exotic Matter Containment · EMC-001 · penning cabinet, fw 4.0"),
  face: "cabinet",
  font: "nixie",
  accent: "#b36bff",
  plate: "#1a1226",
  boot: [
    tr("containment field … 95 % and holding"),
    tr("particle tracker … 1 anomaly, staring back"),
    tr("do not open the door. Seriously."),
  ],
  pages: [
    {
      id: "field",
      label: tr("Field"),
      widgets: [
        {
          kind: "row",
          widgets: [
            {
              kind: "gauge",
              label: tr("Field strength"),
              value: (c) => (c.online ? pct(95 - c.get("compress", 2) + wobble(c.t, 23) * 2) : 0),
              min: 0,
              max: 100,
              unit: "%",
            },
            {
              kind: "gauge",
              label: tr("Stability"),
              value: (c) => emcStability(c),
              min: 0,
              max: 100,
              unit: "%",
            },
            {
              kind: "readout",
              label: tr("Contained"),
              value: (c) => emcContained(c),
              unit: tr("unit::samples"),
            },
          ],
        },
        {
          kind: "matrix",
          label: tr("Particle trap"),
          cols: 12,
          rows: 6,
          color: "#d3a6ff",
          cell: (i, c) => {
            if (!c.online) return 0;
            const x = (i % 12) - 5.5;
            const y = Math.floor(i / 12) - 2.5;
            const r = Math.hypot(x / 2, y);
            const radius = 3.4 - c.get("compress", 2) * 0.5;
            const n = Math.min(12, emcContained(c) + 2);
            let v = r < radius ? 0.12 : 0;
            for (let k = 0; k < n; k++) {
              const a = c.t * (0.6 + k * 0.13) + k * 2.1;
              const px = Math.cos(a) * radius * 1.8;
              const py = Math.sin(a * 1.3) * radius * 0.8;
              if (Math.abs(px - x) < 0.6 && Math.abs(py - y) < 0.6) v = 1;
            }
            return v;
          },
        },
        {
          kind: "knob",
          key: "compress",
          label: tr("Compression"),
          min: 1,
          max: 5,
          step: 1,
          def: 2,
        },
        {
          kind: "leds",
          label: tr("Sample state"),
          items: [
            { label: tr("Tamed"), on: (c) => has(c, "anomalie_gezaehmt"), tone: "ok" },
            { label: tr("Listening"), on: (c) => has(c, "anomalie_hoert"), tone: "info" },
            { label: tr("Membrane thin"), on: (c) => has(c, "membran_duenn"), tone: "warn" },
            {
              label: tr("Breach"),
              on: (c) => c.online && emcStability(c) < 40,
              tone: "bad",
              blink: true,
            },
          ],
        },
      ],
    },
    {
      id: "harmonics",
      label: tr("Harmonics"),
      widgets: [
        {
          kind: "mode",
          key: "harm",
          label: tr("Harmonic"),
          def: 1,
          options: [
            { value: 1, label: tr("1st") },
            { value: 3, label: tr("3rd") },
            { value: 5, label: tr("5th") },
          ],
        },
        {
          kind: "spectrum",
          label: tr("Field harmonics"),
          bands: (c) => {
            const h = c.get("harm", 1);
            const s = emcStability(c) / 100;
            return Array.from({ length: 20 }, (_, i) =>
              c.online
                ? unit(
                    ((i + 1) % h === 0 ? 0.8 / (1 + i / (h * 3)) : 0.08) * (0.5 + s * 0.5) +
                      Math.abs(wobble(c.t * 2, i + 30)) * (1 - s) * 0.3,
                  )
                : 0,
            );
          },
        },
        {
          kind: "readout",
          label: tr("Carrier"),
          value: (c) =>
            c.online ? (47.3 * c.get("harm", 1) + wobble(c.t, 29) * 0.4).toFixed(1) : "—",
          unit: "kHz",
        },
        {
          kind: "text",
          text: (c) =>
            !c.online
              ? tr("Field down. Whatever is inside is on its own.")
              : has(c, "anomalie_hoert")
                ? tr("The sample hums along with the field. Try not to hum back.")
                : has(c, "anomalie_gezaehmt")
                  ? tr("Sample calm. The harmonics hold it like a hand.")
                  : tr("Containment nominal. Nothing to contain yet — enjoy the silence."),
          tone: (c) => (c.online ? "info" : "off"),
        },
        { kind: "button", label: tr("Service hatch"), action: "service" },
      ],
    },
  ],
};

// ── QSM-001 Quantum State Monitor ────────────────────────────────

const qsmCoherence = (c: UiCtx): number =>
  c.online
    ? 78 +
      DAMIEN_INSIGHTS.filter((k) => has(c, k)).length * 2.5 +
      (c.get("ecc", 1) ? 3 : -12) +
      wobble(c.t, 41) * 1.5
    : 0;

const QSM: DeviceUiSpec = {
  id: "QSM-001",
  model: tr("Quantum State Monitor · QSM-001 · 127-qubit array, fw 1.2"),
  face: "console",
  font: "lcd",
  accent: "#5dffb0",
  plate: "#0f1f19",
  boot: [
    tr("dilution fridge … 12 mK"),
    tr("qubit array 127/128 … slot 128 still missing"),
    tr("coherence tracker armed"),
  ],
  pages: [
    {
      id: "qubits",
      label: tr("Qubits"),
      widgets: [
        {
          kind: "row",
          widgets: [
            { kind: "readout", label: tr("Qubits"), value: (c) => (c.online ? 127 : 0) },
            {
              kind: "readout",
              label: tr("Coherence"),
              value: (c) => qsmCoherence(c).toFixed(1),
              unit: "%",
              tone: (c) => (qsmCoherence(c) > 85 ? "ok" : "warn"),
            },
            {
              kind: "readout",
              label: tr("Error rate"),
              value: (c) => (c.online ? (c.get("ecc", 1) ? 0.8 : 6.4) + wobble(c.t, 43) * 0.1 : 0),
              digits: 2,
              unit: "%",
            },
          ],
        },
        {
          kind: "matrix",
          label: tr("Qubit array"),
          cols: 16,
          rows: 8,
          color: "#5dffb0",
          cell: (i, c) => {
            if (!c.online || i >= 127) return 0;
            const ecc = c.get("ecc", 1);
            const flip = Math.sin(c.t * (ecc ? 0.7 : 3.1) + i * 1.618) > (ecc ? 0.92 : 0.55);
            return flip ? 0.15 : 0.55 + wobble(c.t, i) * 0.35;
          },
        },
        { kind: "switch", key: "ecc", label: tr("Error correction"), def: 1 },
      ],
    },
    {
      id: "wave",
      label: tr("Wave function"),
      widgets: [
        {
          kind: "mode",
          key: "basis",
          label: tr("Basis"),
          def: 0,
          options: [
            { value: 0, label: "|0⟩" },
            { value: 1, label: "|+⟩" },
            { value: 2, label: tr("Bell pair") },
          ],
        },
        {
          kind: "scope",
          label: tr("ψ probability"),
          color: "#b9ffe0",
          wave: (x, c) => {
            if (!c.online) return 0;
            const b = c.get("basis", 0);
            const d = (x - 0.5) * 6;
            const env = Math.exp(-d * d * (b === 0 ? 0.8 : 0.25));
            const osc =
              b === 2
                ? Math.sin(TAU * (x * 5 + c.t * 0.5)) * Math.sin(TAU * (x * 5 - c.t * 0.5))
                : Math.cos(TAU * (x * (b === 1 ? 4 : 2) - c.t * 0.6));
            return env * osc * 0.9;
          },
        },
        {
          kind: "graph",
          label: tr("Coherence history"),
          series: (c) => history(c, 47, (k) => qsmCoherence(k) / 100, 0.05),
        },
        {
          kind: "row",
          widgets: [
            {
              kind: "readout",
              label: tr("Pattern σ"),
              value: (c) => (has(c, "sigma17") ? "σ-17" : "—"),
              tone: (c) => (has(c, "sigma17") ? "ok" : "off"),
            },
            {
              kind: "bar",
              label: tr("Pattern stability"),
              value: (c) => DAMIEN_INSIGHTS.filter((k) => has(c, k)).length,
              max: DAMIEN_INSIGHTS.length,
            },
          ],
        },
        { kind: "button", label: tr("Measure coherence"), action: "use" },
      ],
    },
  ],
};

// ── QAN-001 Quantum Analyzer ─────────────────────────────────────

/** Resonance fragments of Damien's pattern the analyzer can lock onto. */
function qanFragments(c: UiCtx): number[] {
  const out: number[] = [];
  if (items(c, "synapsis_splitter") > 0 || has(c, "damien_muster")) out.push(0.27);
  if (items(c, "x9_speicherkern") > 0 || has(c, "damien_stimme")) out.push(0.58);
  if (has(c, "damien_echo")) out.push(0.81);
  return out;
}

const QAN: DeviceUiSpec = {
  id: "QAN-001",
  model: tr("Quantum Analyzer · QAN-001 · neural deep-scan bench, fw 3.7"),
  face: "bench",
  font: "mono",
  accent: "#ff3fa4",
  plate: "#241021",
  boot: [
    tr("quantum core … warm"),
    tr("neural net … weights loaded (2019, unrevised)"),
    tr("mode ANOMALY · sensitivity 5 · depth 3"),
  ],
  pages: [
    {
      id: "scan",
      label: tr("Scan"),
      widgets: [
        {
          kind: "mode",
          key: "mode",
          label: tr("Analysis"),
          def: 0,
          options: [
            { value: 0, label: tr("ANOMALY") },
            { value: 1, label: tr("RESONANCE") },
            { value: 2, label: tr("DEEP") },
          ],
        },
        {
          kind: "spectrum",
          label: tr("Resonance spectrum"),
          color: "#ff7cc4",
          bands: (c) => {
            if (!c.online) return Array.from({ length: 24 }, () => 0);
            const sens = c.get("sens", 5) / 10;
            const mode = c.get("mode", 0);
            const frags = qanFragments(c);
            return Array.from({ length: 24 }, (_, i) => {
              const f = i / 23;
              let v = 0.06 + Math.abs(wobble(c.t * 1.5, i + 50)) * 0.12 * sens;
              for (const p of frags) {
                const w = mode === 2 ? 0.02 : mode === 1 ? 0.05 : 0.09;
                v += Math.exp(-((f - p) ** 2) / w / w / 2) * (0.4 + sens * 0.5);
              }
              if (mode === 0 && c.power.starved.length) v += (i % 5 === 2 ? 0.3 : 0) * sens;
              return unit(v);
            });
          },
        },
        {
          kind: "row",
          widgets: [
            {
              kind: "knob",
              key: "sens",
              label: tr("Sensitivity"),
              min: 1,
              max: 10,
              step: 1,
              def: 5,
            },
            {
              kind: "slider",
              key: "depth",
              label: tr("Depth"),
              min: 1,
              max: 8,
              step: 1,
              def: 3,
            },
          ],
        },
        {
          kind: "scope",
          label: tr("Probe waveform"),
          color: "#ffd1ea",
          wave: (x, c) => {
            if (!c.online) return 0;
            const d = c.get("depth", 3);
            let y = 0;
            for (let k = 1; k <= d; k++) y += Math.sin(TAU * (x * k * 2 + c.t * 0.4 * k)) / k;
            return (y / 1.6) * (0.8 + wobble(c.t, 61) * 0.05);
          },
        },
        {
          kind: "row",
          widgets: [
            {
              kind: "readout",
              label: tr("Fragments locked"),
              value: (c) => `${qanFragments(c).length}/3`,
              tone: (c) => (qanFragments(c).length === 3 ? "ok" : "info"),
            },
            {
              kind: "readout",
              label: tr("Scan time"),
              value: (c) =>
                c.online ? c.get("depth", 3) * 1.4 + (c.get("mode", 0) === 2 ? 6 : 0) : 0,
              digits: 1,
              unit: "s",
            },
          ],
        },
      ],
    },
    {
      id: "findings",
      label: tr("Findings"),
      widgets: [
        {
          kind: "log",
          label: tr("Analysis log"),
          max: 6,
          lines: (c) => {
            if (!c.online) return [tr("Analyzer offline.")];
            const l: string[] = [];
            if (items(c, "synapsis_splitter") > 0)
              l.push(tr("Synapsis splinter in reach: resonance at 0.27 — pattern structure."));
            if (items(c, "x9_speicherkern") > 0)
              l.push(tr("X9 memory core in reach: resonance at 0.58 — a voice, compressed."));
            if (has(c, "damien_muster")) l.push(tr("Damien's resonance pattern: extracted."));
            if (has(c, "damien_echo")) l.push(tr("Echo band at 0.81 confirmed."));
            if (c.power.starved.length)
              l.push(
                tr("Anomaly: {n} device(s) starved on the grid.", { n: c.power.starved.length }),
              );
            if (!l.length)
              l.push(tr("No resonance above the noise floor. Bring me something to analyse."));
            return l;
          },
        },
        {
          kind: "leds",
          label: tr("Firmware modules"),
          items: [
            { label: "deep-scan", on: (c) => hasFeature(c.s, "QAN-001", "deep-scan"), tone: "ok" },
            {
              label: "waveform-gen",
              on: (c) => hasFeature(c.s, "QAN-001", "waveform-gen"),
              tone: "ok",
            },
            {
              label: "neural-network",
              on: (c) => hasFeature(c.s, "QAN-001", "neural-network"),
              tone: "info",
            },
          ],
        },
        { kind: "button", label: tr("Analyse sample"), action: "use" },
      ],
    },
  ],
};

// ── AIC-001 AI Assistant Core ────────────────────────────────────

const AIC: DeviceUiSpec = {
  id: "AIC-001",
  model: tr("AI Assistant Core · AIC-001 · neural host, fw 2.4"),
  face: "rack",
  font: "vfd",
  accent: "#8fb8ff",
  plate: "#121a2b",
  boot: [
    tr("neural core … 4,096 lanes, all empty"),
    tr("task queue … importing lab blueprints"),
    tr("hosting slot 0 … vacant (reserved: D.F.)"),
  ],
  pages: [
    {
      id: "neural",
      label: tr("Neural"),
      widgets: [
        {
          kind: "row",
          widgets: [
            {
              kind: "readout",
              label: tr("Task queue"),
              value: (c) => openBlueprints(c.s).length,
            },
            {
              kind: "readout",
              label: tr("Anomalies"),
              value: (c) => c.power.starved.length,
              tone: (c) => (c.power.starved.length ? "warn" : "ok"),
            },
            {
              kind: "gauge",
              label: tr("Core load"),
              value: (c) =>
                c.online
                  ? pct(
                      20 +
                        openBlueprints(c.s).length * 9 +
                        (c.get("learn", 0) ? 30 : 0) +
                        wobble(c.t, 71) * 4,
                    )
                  : 0,
              min: 0,
              max: 100,
              unit: "%",
              warn: 80,
              bad: 95,
            },
          ],
        },
        {
          kind: "matrix",
          label: tr("Activations"),
          cols: 12,
          rows: 8,
          color: "#b3ceff",
          cell: (i, c) => {
            if (!c.online) return 0;
            const x = i % 12;
            const y = Math.floor(i / 12);
            if (c.get("learn", 0))
              return unit(0.5 + Math.sin(x * 0.7 + c.t * 1.3) * Math.cos(y * 0.9 - c.t) * 0.5);
            return Math.sin(i * 12.9898 + Math.floor(c.t * 4) * 78.233) > 0.55 ? 0.8 : 0.1;
          },
        },
        { kind: "switch", key: "learn", label: tr("Learning mode"), def: 0 },
        {
          kind: "log",
          label: tr("Queued tasks"),
          max: 5,
          lines: (c) => {
            const open = openBlueprints(c.s);
            return open.length
              ? open.slice(0, 5).map((d) => tr("build {id} — {name}", { id: d.id, name: d.name }))
              : [tr("Queue empty. I am learning to be bored.")];
          },
        },
      ],
    },
    {
      id: "host",
      label: tr("Host"),
      widgets: [
        {
          kind: "bar",
          label: tr("Pattern: structure"),
          value: (c) => (has(c, "damien_muster") ? 1 : 0),
          max: 1,
        },
        {
          kind: "bar",
          label: tr("Pattern: voice"),
          value: (c) => (has(c, "damien_stimme") ? 1 : 0),
          max: 1,
        },
        {
          kind: "leds",
          label: tr("Host prerequisites"),
          items: [
            { label: "SCA-001", on: (c) => on(c, "SCA-001"), tone: "info" },
            {
              label: tr("Compute mesh"),
              on: (c) => isLinked(c.s, "SCA-001", "AIC-001"),
              tone: "info",
            },
            { label: tr("Structure"), on: (c) => has(c, "damien_muster"), tone: "ok" },
            { label: tr("Voice"), on: (c) => has(c, "damien_stimme"), tone: "ok" },
            { label: tr("Hosted"), on: (c) => !!c.s.endings.substrat, tone: "ok", blink: true },
          ],
        },
        {
          kind: "text",
          text: (c) =>
            c.s.endings.substrat
              ? tr("Slot 0 occupied. He says the new substrate itches.")
              : has(c, "damien_muster") && has(c, "damien_stimme")
                ? tr("Pattern complete. Slot 0 is ready to receive — if you are.")
                : tr("Slot 0 vacant. A pattern needs a structure and a voice."),
          tone: (c) => (c.s.endings.substrat ? "ok" : "info"),
        },
      ],
    },
  ],
};

// ── SCA-001 Supercomputer Array ──────────────────────────────────

const scaUtil = (c: UiCtx): number => {
  if (!c.online) return 0;
  const sched = c.get("sched", 0);
  const jobs = (has(c, "damien_echo") ? 1 : 0) + (has(c, "damien_koordinaten") ? 1 : 0);
  return unit(
    0.22 + linkCount(c) * 0.12 + jobs * 0.1 + (sched === 2 ? 0.45 : 0) + wobble(c.t, 81) * 0.03,
  );
};

const SCA: DeviceUiSpec = {
  id: "SCA-001",
  model: tr("Supercomputer Array · SCA-001 · 16 nodes, ECC mesh, fw 5.2"),
  face: "cabinet",
  font: "lcd",
  accent: "#39ff14",
  plate: "#0e1a0c",
  boot: [
    tr("16/16 nodes answered roll call"),
    tr("interconnect mesh … 4×4 torus"),
    tr("job scheduler … fair share"),
  ],
  pages: [
    {
      id: "nodes",
      label: tr("Nodes"),
      widgets: [
        {
          kind: "row",
          widgets: [
            {
              kind: "readout",
              label: tr("Throughput"),
              value: (c) => (scaUtil(c) * 2.76).toFixed(2),
              unit: "TFLOPS",
            },
            {
              kind: "readout",
              label: tr("Utilisation"),
              value: (c) => pct(scaUtil(c) * 100),
              unit: "%",
            },
            {
              kind: "readout",
              label: tr("Mesh guests"),
              value: (c) => linkCount(c),
              unit: "/4",
            },
          ],
        },
        {
          kind: "matrix",
          label: tr("Node load"),
          cols: 4,
          rows: 4,
          color: "#39ff14",
          cell: (i, c) => {
            if (!c.online) return 0;
            const u = scaUtil(c);
            const sched = c.get("sched", 0);
            const bias = sched === 1 ? (i < 4 ? 0.35 : -0.15) : 0;
            return unit(u + bias + wobble(c.t, i + 90) * 0.12);
          },
        },
        {
          kind: "mode",
          key: "sched",
          label: tr("Scheduler"),
          def: 0,
          options: [
            { value: 0, label: tr("fair share") },
            { value: 1, label: tr("priority") },
            { value: 2, label: tr("LINPACK") },
          ],
        },
      ],
    },
    {
      id: "jobs",
      label: tr("Jobs"),
      widgets: [
        {
          kind: "graph",
          label: tr("Utilisation"),
          color: "#9dff85",
          series: (c) => history(c, 83, scaUtil, 0.06),
        },
        {
          kind: "log",
          label: tr("Job queue"),
          max: 6,
          lines: (c) => {
            if (!c.online) return [tr("Array offline.")];
            const l: string[] = [];
            if (c.get("sched", 0) === 2) l.push(tr("LINPACK run — for bragging rights only"));
            if (has(c, "damien_koordinaten")) l.push(tr("halo-coords.job — DONE"));
            else if (has(c, "damien_echo"))
              l.push(tr("triangulate echo + compass + Forge logs — READY"));
            if (has(c, "damien_muster")) l.push(tr("pattern-reconstruct.job — RUNNING"));
            for (const id of linkCount(c) ? DEVICES.map((d) => d.id) : [])
              if (isLinked(c.s, "SCA-001", id)) l.push(tr("{id}: borrowed nodes", { id }));
            if (!l.length) l.push(tr("Idle. 16 nodes contemplating the heat death."));
            return l;
          },
        },
        { kind: "button", label: tr("Submit job"), action: "use" },
      ],
    },
  ],
};

// ── TLP-001 Teleport Pad ─────────────────────────────────────────

/** The six portal phases (firmware features) and whether each is satisfied. */
const tlpPhases = (c: UiCtx): boolean[] => {
  const charged = c.online && c.t > 2;
  return [
    charged,
    charged && spareW(c) >= 0,
    charged && has(c, "handshake"),
    charged && has(c, "damien_koordinaten"),
    charged && has(c, "sigma17"),
    !!c.s.endings.rueckkehr,
  ];
};

const TLP: DeviceUiSpec = {
  id: "TLP-001",
  model: tr("Teleport Pad · TLP-001 · HaloRider successor, fw 2.2"),
  face: "handheld",
  font: "nixie",
  accent: "#00e5c7",
  plate: "#0b1f1d",
  boot: [
    tr("capacitor bank … charging"),
    tr("matrix alignment … nominal"),
    tr("please keep all limbs inside the pad"),
  ],
  pages: [
    {
      id: "sequence",
      label: tr("Sequence"),
      widgets: [
        {
          kind: "bar",
          label: tr("Capacitor"),
          value: (c) => (c.online ? pct((c.t / 6) * 100) : 0),
          max: 100,
          unit: "%",
          tone: (c) => (c.online && c.t >= 6 ? "ok" : "warn"),
        },
        {
          kind: "leds",
          label: tr("Portal sequence"),
          items: [
            { label: tr("Charge"), on: (c) => tlpPhases(c)[0] ?? false, tone: "ok" },
            { label: tr("Align"), on: (c) => tlpPhases(c)[1] ?? false, tone: "ok" },
            { label: tr("Q-lock"), on: (c) => tlpPhases(c)[2] ?? false, tone: "info" },
            { label: tr("Coords"), on: (c) => tlpPhases(c)[3] ?? false, tone: "info" },
            { label: tr("Stabilise"), on: (c) => tlpPhases(c)[4] ?? false, tone: "warn" },
            { label: tr("Portal"), on: (c) => tlpPhases(c)[5] ?? false, tone: "ok", blink: true },
          ],
        },
        {
          kind: "row",
          widgets: [
            {
              kind: "dial",
              label: tr("Azimuth"),
              angle: (c) => (c.get("azimuth", 0) / 360) * TAU + wobble(c.t, 101) * 0.02,
              marks: ["N", "E", "S", "W"],
            },
            {
              kind: "gauge",
              label: tr("Matrix alignment"),
              value: (c) =>
                c.online ? pct(88 + wobble(c.t, 103) * 6 + (has(c, "sigma17") ? 8 : 0)) : 0,
              min: 0,
              max: 100,
              unit: "%",
            },
          ],
        },
        {
          kind: "knob",
          key: "azimuth",
          label: tr("Azimuth"),
          min: 0,
          max: 359,
          step: 1,
          def: 0,
          unit: "°",
        },
        {
          kind: "readout",
          label: tr("Target"),
          value: (c) =>
            has(c, "damien_koordinaten") ? tr("Halo · Damien's coordinates") : tr("none loaded"),
          tone: (c) => (has(c, "damien_koordinaten") ? "ok" : "off"),
        },
      ],
    },
    {
      id: "portal",
      label: tr("Portal"),
      widgets: [
        {
          kind: "scope",
          label: tr("Portal field"),
          color: "#7fffe9",
          grid: false,
          wave: (x, c) => {
            if (!c.online) return 0;
            const n = tlpPhases(c).filter(Boolean).length;
            const a = (x - 0.5) * 2;
            return (
              Math.sqrt(Math.max(0, 1 - a * a)) *
              Math.sin(TAU * (x * (2 + n) + c.t * (0.3 + n * 0.2))) *
              (0.3 + n * 0.1)
            );
          },
        },
        {
          kind: "text",
          text: (c) => {
            const n = tlpPhases(c).filter(Boolean).length;
            if (c.s.endings.rueckkehr)
              return tr("Portal log: one traveller, returned. Pad cooling down.");
            if (n >= 5)
              return tr("All phases green. The pad is waiting for a decision, not a button.");
            if (!c.online) return tr("Pad dark. 100 W, or nobody goes anywhere.");
            return tr(
              "{n} of 6 phases green. The portal needs coordinates, a handshake and a pattern.",
              {
                n,
              },
            );
          },
          tone: (c) => (tlpPhases(c).filter(Boolean).length >= 5 ? "ok" : "warn"),
        },
        {
          kind: "readout",
          label: tr("Grid reserve"),
          value: (c) => spareW(c),
          unit: "W",
          tone: (c) => (spareW(c) < 10 ? "bad" : "ok"),
        },
        { kind: "button", label: tr("Pad status"), action: "use" },
      ],
    },
  ],
};

export const TIER3_UI: readonly DeviceUiSpec[] = [MCP, MFR, EMC, QSM, QAN, AIC, SCA, TLP];
