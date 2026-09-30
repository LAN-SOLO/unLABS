/**
 * Device interfaces — tier-2 devices (see ../types.ts). German in
 * lib/i18n/de/device-ui-tier2.ts.
 *
 * Every readout comes from the game state (power, UEC volatility, counters,
 * inventory, insights, puzzles, links, firmware, pickups on the floor);
 * `wobble` only adds sensor jitter. Controls change what the device shows.
 */
import { tr } from "@/lib/i18n";
import { DEVICE_BY_ID, DEVICES } from "@/lib/world/content/devices";
import { PICKUPS, SLICE_PICKUPS } from "@/lib/world/content/map";
import {
  DRONE_COOLDOWN,
  RESEARCH_COOLDOWN,
  RESEARCH_TOPICS,
  UEC_NOMINAL,
  checkStage,
  droneReady,
  fabricable,
  hint,
  isBuilt,
  itemDef,
  openBlueprints,
  pickupAvailable,
  progress,
  researchFlag,
  researchReady,
  todayKey,
  uecOutput,
} from "@/lib/world/game";
import { features, installedVersion } from "@/lib/world/firmware";
import { isLinked, linksOf } from "@/lib/world/links";
import {
  builtCount,
  counter,
  gridLoad,
  items,
  minutes,
  onlineCount,
  spareW,
  uecRatio,
  unit,
  wobble,
} from "@/lib/world/device-ui/metrics";
import type { DeviceUiSpec, Tone, UiCtx } from "@/lib/world/device-ui/types";
import { SPECTRUM, type PickupDef, type SpectrumColor } from "@/lib/world/types";

// ── Shared helpers (pure, cheap) ─────────────────────────────────

const TAU = Math.PI * 2;

const on = (c: UiCtx, id: string): boolean => c.power.online.has(id);
const knows = (c: UiCtx, insight: string): boolean => !!c.s.insights[insight];
const solved = (c: UiCtx, puzzle: string): boolean => !!c.s.puzzles[puzzle];
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const name = (id: string): string => DEVICE_BY_ID.get(id)?.name ?? id;

/** Live watts the UEC feeds into the grid. */
function uecW(c: UiCtx): number {
  if (!c.online) return 0;
  const n = name("UEC-001");
  return c.power.sources.find((x) => x.label === n)?.watts ?? uecOutput();
}

/** UEC output of the last 14 days (oldest first), cached per calendar day. */
let uecHist: { day: string; vals: number[] } | null = null;
function uecHistory(): number[] {
  const day = todayKey();
  if (uecHist?.day === day) return uecHist.vals;
  const base = Date.parse(`${day}T00:00:00Z`);
  const vals: number[] = [];
  for (let i = 13; i >= 0; i--)
    vals.push(uecOutput(new Date(base - i * 86_400_000).toISOString().slice(0, 10)));
  uecHist = { day, vals };
  return vals;
}

/** A pickup relative to the player on the current floor (radar coordinates). */
function bearing(c: UiCtx, p: PickupDef): { a: number; d: number } {
  const dx = p.x - c.s.pos[0];
  const dz = p.z - c.s.pos[2];
  return { a: Math.atan2(dx, -dz), d: Math.hypot(dx, dz) };
}

const SLICES: readonly PickupDef[] = PICKUPS.filter((p) => SLICE_PICKUPS.includes(p.id));
const ANOMALY_ITEMS = ["halo_staub", "halo_kristall", "exotische_materie", "abstractum"] as const;
const ANOMALIES: readonly PickupDef[] = PICKUPS.filter((p) =>
  p.items.some((i) => (ANOMALY_ITEMS as readonly string[]).includes(i.item)),
);

/** Untaken slices on the player's floor, nearest first (at most 12). */
function slicesHere(c: UiCtx): { p: PickupDef; a: number; d: number }[] {
  return SLICES.filter((p) => p.floor === c.s.floor && c.s.taken[p.id] === undefined)
    .map((p) => ({ p, ...bearing(c, p) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 12);
}

/** Available anomaly sources on the player's floor for detection mode `mode`. */
function anomaliesHere(c: UiCtx, mode: number): { p: PickupDef; a: number; d: number }[] {
  const want: readonly string[] =
    mode === 0
      ? ["halo_staub", "halo_kristall"]
      : mode === 1
        ? ["exotische_materie"]
        : ANOMALY_ITEMS;
  return ANOMALIES.filter(
    (p) =>
      p.floor === c.s.floor &&
      p.items.some((i) => want.includes(i.item)) &&
      pickupAvailable(c.s, p),
  )
    .map((p) => ({ p, ...bearing(c, p) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 16);
}

const COLOR_LABEL: Readonly<Record<SpectrumColor, string>> = {
  infrarot: tr("hue::Infrared"),
  rot: tr("hue::Red"),
  orange: tr("hue::Orange"),
  gelb: tr("hue::Yellow"),
  gruen: tr("hue::Green"),
  blau: tr("hue::Blue"),
  indigo: tr("hue::Indigo"),
  violett: tr("hue::Violet"),
  gamma: tr("hue::Gamma"),
};
const COLOR_NM: Readonly<Record<SpectrumColor, number>> = {
  infrarot: 850,
  rot: 680,
  orange: 610,
  gelb: 580,
  gruen: 530,
  blau: 470,
  indigo: 440,
  violett: 405,
  gamma: 0.01,
};

/** Inventory items per spectrum colour (count of pieces). */
function hueCounts(c: UiCtx): number[] {
  const out = SPECTRUM.map(() => 0);
  for (const [id, n] of Object.entries(c.s.inventory)) {
    const col = itemDef(c.s, id)?.color;
    if (!col || n <= 0) continue;
    out[SPECTRUM.indexOf(col)]! += n;
  }
  return out;
}

const WAVES = [
  (p: number) => Math.sin(p * TAU),
  (p: number) => 2 * (p - Math.floor(p + 0.5)),
  (p: number) => (p - Math.floor(p) < 0.5 ? 0.8 : -0.8),
  (p: number) => 1 - 4 * Math.abs(p - Math.floor(p + 0.5)),
] as const;

const TONE_KEYS = [3, 6, 4, 8] as const;

/** Research points and the next open Nexus topic. */
function nextTopic(c: UiCtx) {
  return RESEARCH_TOPICS.find((t) => !c.s.flags[researchFlag(t.id)]);
}

const DRONE_ITEMS = [
  "halo_staub",
  "supraleiter",
  "qubit_chip",
  "plasmaring",
  "synapsis_splitter",
  "glasfaser",
  "exotische_materie",
  "laserdiode",
] as const;

// ── Specs ────────────────────────────────────────────────────────

export const TIER2_UI: readonly DeviceUiSpec[] = [
  // ── UEC-001 Unstable Energy Core ──────────────────────────────
  {
    id: "UEC-001",
    model: tr("Unstable Energy Core · UEC-001 · containment class B"),
    face: "reactor",
    font: "nixie",
    accent: "#ff7a1a",
    plate: "#2a1a12",
    boot: [
      tr("containment field … closed"),
      tr("TPS feed: daily volatility sampled"),
      tr("core ignition — stand back, please"),
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
                kind: "gauge",
                label: tr("Output"),
                value: (c) => Math.round(uecW(c) * (1 + wobble(c.t, 1) * 0.01)),
                min: 0,
                max: 200,
                unit: "W",
              },
              {
                kind: "gauge",
                label: tr("Grid load"),
                value: (c) => Math.round(gridLoad(c) * 100),
                min: 0,
                max: 100,
                unit: "%",
                warn: 85,
                bad: 98,
              },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Volatility"),
                value: () => Math.round((uecRatio() - 1) * 100),
                unit: "%",
                tone: (): Tone => (uecRatio() < 0.9 ? "warn" : uecRatio() > 1.1 ? "info" : "ok"),
              },
              { kind: "readout", label: tr("Nominal"), value: UEC_NOMINAL, unit: "W" },
              { kind: "readout", label: tr("Spare"), value: (c) => spareW(c), unit: "W" },
            ],
          },
          {
            kind: "graph",
            label: tr("Output, last 14 days"),
            series: () => uecHistory().map((w) => unit(w / 200)),
          },
          { kind: "button", label: tr("Power grid"), action: "power" },
        ],
      },
      {
        id: "field",
        label: tr("Field"),
        widgets: [
          {
            kind: "slider",
            key: "stabilizer",
            label: tr("Field stabilizer"),
            min: 0,
            max: 100,
            step: 5,
            def: 40,
            unit: "%",
          },
          {
            kind: "scope",
            label: tr("Containment ripple"),
            wave: (x, c) => {
              if (!c.online) return 0;
              const loose =
                (1 - c.get("stabilizer", 40) / 100) * (0.2 + Math.abs(uecRatio() - 1) * 3);
              return clamp(
                Math.sin((x * 6 + c.t * 0.8) * TAU) * 0.35 + wobble(c.t * 3 + x * 20, 2) * loose,
                -1,
                1,
              );
            },
          },
          {
            kind: "readout",
            label: tr("Ripple"),
            value: (c) =>
              Math.round(
                (1 - c.get("stabilizer", 40) / 100) * (4 + Math.abs(uecRatio() - 1) * 60) * 10,
              ) / 10,
            unit: "%",
          },
          {
            kind: "leds",
            label: tr("Core status"),
            items: [
              { label: tr("Core"), on: (c) => c.online, tone: "ok" },
              {
                label: tr("Board re-soldered"),
                on: (c) => solved(c, "pz_solder_uec"),
                tone: "info",
              },
              {
                label: tr("Network sync"),
                on: (c) => on(c, "NET-001") && isLinked(c.s, "NET-001", "UEC-001"),
                tone: "ok",
                blink: true,
              },
              { label: tr("Low tide"), on: () => uecRatio() < 0.9, tone: "warn", blink: true },
            ],
          },
          { kind: "button", label: tr("Read out"), action: "use" },
        ],
      },
    ],
  },

  // ── DGN-001 Diagnostics Console ───────────────────────────────
  {
    id: "DGN-001",
    model: tr("Diagnostics Console · DGN-001 · multi-category"),
    face: "terminal",
    font: "crt",
    accent: "#7dff9b",
    plate: "#141c16",
    boot: [
      tr("POST … 38 device slots enumerated"),
      tr("loading fault tree (it is mostly branches)"),
      tr("alert system armed"),
    ],
    pages: [
      {
        id: "scan",
        label: tr("Scan"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "bar",
                label: tr("Devices built"),
                value: (c) => builtCount(c),
                max: DEVICES.length,
              },
              {
                kind: "bar",
                label: tr("Online"),
                value: (c) => onlineCount(c),
                max: (c) => Math.max(1, builtCount(c)),
                tone: (c): Tone => (c.power.starved.length ? "warn" : "ok"),
              },
            ],
          },
          {
            kind: "mode",
            key: "category",
            label: tr("Category"),
            def: 0,
            options: [
              { value: 0, label: tr("Build") },
              { value: 1, label: tr("diag::Power") },
              { value: 2, label: tr("Probes") },
            ],
          },
          {
            kind: "log",
            label: tr("Findings"),
            max: 6,
            lines: (c) => {
              const cat = c.get("category", 0);
              if (cat === 1) {
                const st = c.power.starved.slice(0, 5);
                return st.length
                  ? st.map((x) =>
                      x.reason === "hitze"
                        ? tr("{name}: overheated", { name: name(x.id) })
                        : tr("{name}: no power", { name: name(x.id) }),
                    )
                  : [tr("All consumers supplied. {w} W spare.", { w: spareW(c) })];
              }
              if (cat === 2) {
                const ls = linksOf(c.s, "DGN-001");
                return ls.length
                  ? ls.map((id) =>
                      on(c, id)
                        ? tr("{name}: healthy", { name: name(id) })
                        : tr("{name}: not responding", { name: name(id) }),
                    )
                  : [tr("No probes attached. Link devices on the LINKS page.")];
              }
              const open = openBlueprints(c.s).slice(0, 4);
              return open.length
                ? open.map((d) =>
                    tr("{name}: {state}", {
                      name: d.name,
                      state: checkStage(c.s, d.id)?.blockers[0] ?? tr("ready to build."),
                    }),
                  )
                : [tr("No open blueprints.")];
            },
          },
          {
            kind: "leds",
            label: tr("Alerts"),
            items: [
              {
                label: tr("Brownout"),
                on: (c) => c.power.starved.length > 0,
                tone: "bad",
                blink: true,
              },
              { label: tr("Grid > 90 %"), on: (c) => gridLoad(c) > 0.9, tone: "warn" },
              { label: tr("Probes"), on: (c) => linksOf(c.s, "DGN-001").length > 0, tone: "info" },
            ],
          },
        ],
      },
      {
        id: "advice",
        label: tr("Advice"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Insights"),
                value: (c) => {
                  const p = progress(c.s);
                  return `${p.insights}/${p.totalInsights}`;
                },
              },
              { kind: "readout", label: tr("Endings"), value: (c) => progress(c.s).endings },
              { kind: "readout", label: tr("Uptime"), value: (c) => minutes(c), unit: "min" },
            ],
          },
          { kind: "text", text: (c) => (c.online ? hint(c.s) : tr("Console dark.")), tone: "info" },
          {
            kind: "row",
            widgets: [
              { kind: "button", label: tr("Diagnose"), action: "hint" },
              { kind: "button", label: tr("Read out"), action: "use" },
            ],
          },
        ],
      },
    ],
  },

  // ── ECR-001 Echo Recorder ─────────────────────────────────────
  {
    id: "ECR-001",
    model: tr("Echo Recorder · ECR-001 · reel-to-reel, 2 heads"),
    face: "cabinet",
    font: "vfd",
    accent: "#ffb347",
    plate: "#2b2118",
    boot: [
      tr("capstan motor … spinning"),
      tr("record head demagnetized"),
      tr("listening to the noise floor"),
    ],
    pages: [
      {
        id: "deck",
        label: tr("Deck"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "knob",
                key: "gain",
                label: tr("Input gain"),
                min: 0,
                max: 12,
                step: 1,
                def: 6,
                unit: "dB",
              },
              {
                kind: "mode",
                key: "source",
                label: tr("Source"),
                def: 0,
                options: [
                  { value: 0, label: tr("Room") },
                  { value: 1, label: tr("Tape") },
                ],
              },
            ],
          },
          {
            kind: "graph",
            label: tr("Noise floor"),
            series: (c) => {
              const g = c.get("gain", 6) / 12;
              const tape = c.get("source", 0) === 1;
              const echo = knows(c, "damien_echo") ? 0.25 : 0;
              return Array.from({ length: 40 }, (_, i) => {
                const tt = c.t - (39 - i) * 0.2;
                const base = tape ? 0.35 + Math.sin(tt * 2.1) * 0.25 : 0.15;
                const ghost = echo * Math.max(0, Math.sin(tt * 0.7)) ** 6;
                return c.online ? unit((base + wobble(tt, 6) * 0.1 + ghost) * (0.4 + g)) : 0;
              });
            },
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Echoes"),
                value: (c) =>
                  ["damien_echo", "damien_stimme", "relais_2026"].filter((k) => knows(c, k)).length,
                unit: "/3",
              },
              {
                kind: "readout",
                label: tr("Tapes"),
                value: (c) => items(c, "damien_band") + items(c, "tonband_frequenz"),
              },
              { kind: "readout", label: tr("Reel time"), value: (c) => minutes(c), unit: "min" },
            ],
          },
          { kind: "button", label: tr("Record / play"), action: "use" },
        ],
      },
      {
        id: "tapes",
        label: tr("Tape index"),
        widgets: [
          {
            kind: "log",
            label: tr("Index"),
            lines: (c) => [
              knows(c, "damien_echo")
                ? tr("#1 secondary station — figure in the noise (D.F.)")
                : tr("#1 secondary station — blank"),
              knows(c, "damien_stimme")
                ? tr("#0512 “Four tones. Four coordinates.”")
                : items(c, "damien_band") > 0
                  ? tr("#0512 loaded — not played yet")
                  : tr("#0512 — no tape"),
              knows(c, "relais_2026")
                ? tr("“Frequency” — relay 4 Feb 2026, two voices")
                : items(c, "tonband_frequenz") > 0
                  ? tr("“Frequency” loaded — not played yet")
                  : tr("“Frequency” — no tape"),
            ],
          },
          {
            kind: "leds",
            label: tr("Whisper channel"),
            items: [
              { label: "SPK-001", on: (c) => on(c, "SPK-001"), tone: "ok" },
              {
                label: tr("Whisper decoded"),
                on: (c) => solved(c, "pz_morse_whisper"),
                tone: "info",
              },
            ],
          },
        ],
      },
    ],
  },

  // ── SPK-001 Narrow Speaker ────────────────────────────────────
  {
    id: "SPK-001",
    model: tr("Narrow Speaker · SPK-001 · beam-focus driver"),
    face: "handheld",
    font: "lcd",
    accent: "#c0ff3e",
    plate: "#1e2418",
    boot: [tr("driver impedance 8 Ω ok"), tr("beam former: 12° cone")],
    pages: [
      {
        id: "out",
        label: tr("Output"),
        widgets: [
          {
            kind: "spectrum",
            label: tr("Response 40 Hz – 18 kHz"),
            bands: (c) => {
              const mute = c.get("mute", 0) === 1 || !c.online;
              const vol = c.get("volume", 60) / 100;
              const lo = c.get("lowcut", 2);
              const hms = on(c, "HMS-001");
              return Array.from({ length: 16 }, (_, i) => {
                if (mute || i < lo) return 0;
                const tone = hms ? Math.max(0, Math.sin(c.t * 2 + i * 0.9)) * 0.4 : 0;
                return unit((0.25 + wobble(c.t + i * 0.37, i) * 0.15 + tone) * vol * (1 - i / 32));
              });
            },
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "slider",
                key: "volume",
                label: tr("Volume"),
                min: 0,
                max: 100,
                step: 5,
                def: 60,
                unit: "%",
              },
              {
                kind: "knob",
                key: "lowcut",
                label: tr("Low cut"),
                min: 0,
                max: 8,
                step: 1,
                def: 2,
              },
              {
                kind: "knob",
                key: "beam",
                label: tr("Beam"),
                min: 4,
                max: 40,
                step: 2,
                def: 12,
                unit: "°",
              },
              { kind: "switch", key: "mute", label: tr("Mute"), def: 0 },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("SPL at 1 m"),
                value: (c) =>
                  c.online && c.get("mute", 0) !== 1
                    ? Math.round(
                        89 +
                          20 * Math.log10(Math.max(0.01, c.get("volume", 60) / 100)) +
                          12 -
                          c.get("beam", 12) / 4,
                      )
                    : 0,
                unit: "dB",
              },
              {
                kind: "readout",
                label: tr("Cone"),
                value: (c) => c.get("beam", 12),
                unit: "°",
              },
            ],
          },
          {
            kind: "leds",
            items: [
              { label: tr("Synth feed"), on: (c) => on(c, "HMS-001"), tone: "ok" },
              { label: tr("Echo feed"), on: (c) => on(c, "ECR-001"), tone: "ok" },
              {
                label: tr("Answered"),
                on: (c) => knows(c, "handshake"),
                tone: "info",
                blink: true,
              },
            ],
          },
        ],
      },
    ],
  },

  // ── HMS-001 Handmade Synthesizer ──────────────────────────────
  {
    id: "HMS-001",
    model: tr("Handmade Synthesizer · HMS-001 · 4 oscillators, hand-wired"),
    face: "bench",
    font: "mono",
    accent: "#ff4fd8",
    plate: "#2a1830",
    boot: [
      tr("VCO 1–4 … warming up (tuning drifts, as intended)"),
      tr("filter bank patched"),
      tr("J.L.: “Don't touch the red cable.”"),
    ],
    pages: [
      {
        id: "osc",
        label: tr("Oscillators"),
        widgets: [
          {
            kind: "mode",
            key: "wave",
            label: tr("Waveform"),
            def: 0,
            options: [
              { value: 0, label: tr("sine") },
              { value: 1, label: tr("saw") },
              { value: 2, label: tr("square") },
              { value: 3, label: tr("triangle") },
            ],
          },
          {
            kind: "scope",
            label: tr("VCO out"),
            wave: (x, c) => {
              if (!c.online) return 0;
              const f = WAVES[clamp(Math.round(c.get("wave", 0)), 0, 3)]!;
              const det = c.get("detune", 0) / 100;
              const p = x * 3 + c.t * 0.3;
              return clamp((f(p) + f(p * (1 + det)) * 0.5) / 1.5, -1, 1);
            },
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "knob",
                key: "detune",
                label: tr("Detune"),
                min: 0,
                max: 50,
                step: 1,
                def: 7,
                unit: "¢",
              },
              {
                kind: "knob",
                key: "cutoff",
                label: tr("Cutoff"),
                min: 1,
                max: 16,
                step: 1,
                def: 10,
              },
            ],
          },
          {
            kind: "spectrum",
            label: tr("Filter bank"),
            bands: (c) => {
              const cut = c.get("cutoff", 10);
              const w = c.get("wave", 0);
              return Array.from({ length: 16 }, (_, i) => {
                if (!c.online) return 0;
                const harm = w === 0 ? (i === 1 ? 1 : 0.05) : 1 / (1 + i * (w === 3 ? 1.2 : 0.4));
                return unit(
                  harm * (i < cut ? 1 : Math.max(0, 1 - (i - cut) * 0.4)) + wobble(c.t, i) * 0.03,
                );
              });
            },
          },
        ],
      },
      {
        id: "handshake",
        label: tr("Handshake"),
        widgets: [
          {
            kind: "leds",
            label: tr("Keys"),
            items: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({
              label: String(k),
              on: (c: UiCtx) =>
                c.online &&
                knows(c, "vier_toene") &&
                TONE_KEYS[Math.floor(c.t * 1.5) % TONE_KEYS.length] === k,
              tone: "info" as const,
            })),
          },
          {
            kind: "text",
            text: (c) =>
              knows(c, "handshake")
                ? tr("Handshake played. Something answered — the Halo remembers the frequency.")
                : knows(c, "vier_toene")
                  ? tr("Sequence from Damien's log #0512 loaded: 3 — 6 — 4 — 8.")
                  : tr(
                      "No sequence loaded. Four tones are missing — someone must have written them down.",
                    ),
            tone: (c): Tone => (knows(c, "handshake") ? "ok" : "info"),
          },
          {
            kind: "leds",
            label: tr("Signal path"),
            items: [
              { label: "SPK-001", on: (c) => on(c, "SPK-001"), tone: "ok" },
              { label: tr("Handshake"), on: (c) => solved(c, "pz_tones"), tone: "ok" },
              {
                label: tr("Shard stencil"),
                on: (c) => solved(c, "pz_stencil_shard"),
                tone: "info",
              },
            ],
          },
        ],
      },
    ],
  },

  // ── OSC-001 Oscilloscope Array ────────────────────────────────
  {
    id: "OSC-001",
    model: tr("Oscilloscope Array · OSC-001 · 4 channels, 31 wave types"),
    face: "rack",
    font: "crt",
    accent: "#39ff14",
    plate: "#101a12",
    boot: [
      tr("CRT heater … phosphor glowing"),
      tr("CH1–CH4 calibrated to 1 V/div"),
      tr("trigger armed: auto"),
    ],
    pages: [
      {
        id: "scope",
        label: tr("Scope"),
        widgets: [
          {
            kind: "mode",
            key: "channel",
            label: tr("Channel"),
            def: 0,
            options: [
              { value: 0, label: tr("CH1 Halo") },
              { value: 1, label: tr("CH2 grid") },
              { value: 2, label: tr("CH3 core") },
              { value: 3, label: tr("MATH") },
            ],
          },
          {
            kind: "scope",
            label: tr("Trace"),
            grid: true,
            wave: (x, c) => {
              if (!c.online) return 0;
              const tb = c.get("timebase", 4);
              const ph = Math.asin(clamp(c.get("trigger", 0) / 10, -1, 1)) / TAU;
              const halo = knows(c, "halo_atmet")
                ? Math.sin((x * tb + ph + c.t * 0.2) * TAU) *
                  (0.35 + 0.45 * Math.abs(Math.sin(((c.s.playTime + c.t) / 847) * Math.PI)))
                : wobble(x * 40 + c.t * 3, 1) * 0.25;
              const grid = Math.sin((x * tb * 2 + ph) * TAU) * (0.2 + gridLoad(c) * 0.7);
              const core =
                Math.sin((x * tb * 5 + ph + c.t) * TAU) * (0.1 + Math.abs(uecRatio() - 1) * 3) +
                wobble(x * 25 + c.t, 4) * 0.08;
              const ch = c.get("channel", 0);
              const y = ch === 0 ? halo : ch === 1 ? grid : ch === 2 ? core : halo * grid * 2;
              return clamp(y, -1, 1);
            },
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "knob",
                key: "timebase",
                label: tr("Time/div"),
                min: 1,
                max: 10,
                step: 1,
                def: 4,
              },
              {
                kind: "knob",
                key: "trigger",
                label: tr("Trigger level"),
                min: -10,
                max: 10,
                step: 1,
                def: 0,
              },
              {
                kind: "readout",
                label: tr("Halo beat"),
                value: (c) => (knows(c, "halo_atmet") ? 847 - Math.floor(c.s.playTime % 847) : "—"),
                unit: "s",
              },
            ],
          },
          {
            kind: "leds",
            items: [
              { label: tr("Lissajous locked"), on: (c) => solved(c, "pz_lissajous"), tone: "ok" },
              {
                label: tr("Halo breathing"),
                on: (c) => knows(c, "halo_atmet"),
                tone: "info",
                blink: true,
              },
              { label: tr("Trend dial"), on: (c) => solved(c, "pz_trend_ticker"), tone: "ok" },
            ],
          },
        ],
      },
      {
        id: "fft",
        label: tr("FFT"),
        widgets: [
          {
            kind: "graph",
            label: tr("FFT magnitude"),
            series: (c) => {
              const ch = c.get("channel", 0);
              const peak = ch === 0 ? 3 : ch === 1 ? 8 : ch === 2 ? 20 : 11;
              const clean = ch === 0 && !knows(c, "halo_atmet") ? 0.3 : 1;
              return Array.from({ length: 32 }, (_, i) =>
                c.online
                  ? unit(
                      clean * Math.exp(-((i - peak) ** 2) / 4) +
                        0.06 +
                        wobble(c.t + i * 0.5, i) * 0.04,
                    )
                  : 0,
              );
            },
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Peak"),
                value: (c) => {
                  const ch = c.get("channel", 0);
                  return ch === 0 ? 1 / 847 : ch === 1 ? 50 : ch === 2 ? 125 : 50 + 1 / 847;
                },
                digits: 3,
                unit: "Hz",
              },
              {
                kind: "readout",
                label: tr("Vpp"),
                value: (c) =>
                  Math.round(
                    (c.get("channel", 0) === 1
                      ? 0.4 + gridLoad(c) * 1.4
                      : 0.8 + Math.abs(wobble(c.t, 9)) * 0.3) * 100,
                  ) / 100,
                digits: 2,
                unit: "V",
              },
            ],
          },
          { kind: "button", label: tr("Capture"), action: "use" },
        ],
      },
    ],
  },

  // ── INT-001 Interpolator ──────────────────────────────────────
  {
    id: "INT-001",
    model: tr("Interpolator · INT-001 · prism bench, 9 wavelengths"),
    face: "console",
    font: "vfd",
    accent: "#b388ff",
    plate: "#1d1828",
    boot: [
      tr("prism array aligned (±0.02°)"),
      tr("era table loaded: 1950–2080"),
      tr("spectrum lock ready"),
    ],
    pages: [
      {
        id: "prism",
        label: tr("Prism"),
        widgets: [
          {
            kind: "spectrum",
            label: tr("Inventory by wavelength"),
            bands: (c) => {
              const n = hueCounts(c);
              const max = Math.max(1, ...n);
              const rot = Math.round(c.get("prism", 0));
              return SPECTRUM.map((_, i) =>
                c.online ? unit(n[(i + rot) % n.length]! / max + wobble(c.t, i) * 0.02) : 0,
              );
            },
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "knob",
                key: "prism",
                label: tr("Prism angle"),
                min: 0,
                max: 8,
                step: 1,
                def: 0,
              },
              {
                kind: "slider",
                key: "era",
                label: tr("Era"),
                min: 1950,
                max: 2080,
                step: 5,
                def: 2026,
              },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Dominant hue"),
                value: (c) => {
                  const n = hueCounts(c);
                  const i = n.indexOf(Math.max(...n));
                  return n[i]! > 0 ? COLOR_LABEL[SPECTRUM[i]!] : "—";
                },
              },
              {
                kind: "readout",
                label: tr("Output λ"),
                value: (c) => COLOR_NM[SPECTRUM[Math.round(c.get("prism", 0)) % SPECTRUM.length]!],
                unit: "nm",
              },
              {
                kind: "readout",
                label: tr("Era shift"),
                value: (c) => Math.round(c.get("era", 2026) - 2026),
                unit: tr("yrs"),
              },
            ],
          },
        ],
      },
      {
        id: "ink",
        label: tr("Ink"),
        widgets: [
          {
            kind: "leds",
            items: [
              { label: tr("Hue matched"), on: (c) => solved(c, "pz_hue_prism"), tone: "ok" },
              { label: tr("Ink readable"), on: (c) => knows(c, "kompass_hinweis"), tone: "info" },
              { label: tr("Anomaly feed"), on: (c) => on(c, "AND-001"), tone: "ok" },
            ],
          },
          {
            kind: "text",
            text: (c) =>
              knows(c, "kompass_hinweis")
                ? tr(
                    "Prism light has made Jade's invisible ink readable: the coordinates are in the frequency.",
                  )
                : c.online
                  ? tr(
                      "Prism light is on. Somewhere on this floor, paper is waiting to be held into it.",
                    )
                  : tr("Prism dark."),
          },
          {
            kind: "graph",
            label: tr("Interpolation curve"),
            series: (c) => {
              const era = (c.get("era", 2026) - 1950) / 130;
              return Array.from({ length: 32 }, (_, i) =>
                c.online
                  ? unit(
                      0.5 +
                        Math.sin(i / 5 + era * 6) * 0.35 * (0.5 + era) +
                        wobble(c.t + i, 2) * 0.03,
                    )
                  : 0,
              );
            },
          },
        ],
      },
    ],
  },

  // ── AND-001 Anomaly Detector ──────────────────────────────────
  {
    id: "AND-001",
    model: tr("Anomaly Detector · AND-001 · multi-mode, halo-link"),
    face: "cabinet",
    font: "crt",
    accent: "#ff3860",
    plate: "#241216",
    boot: [
      tr("waveform scanner … sweeping"),
      tr("baseline: this lab (already anomalous)"),
      tr("halo-link listening"),
    ],
    pages: [
      {
        id: "scan",
        label: tr("Scan"),
        widgets: [
          {
            kind: "mode",
            key: "detect",
            label: tr("Detection"),
            def: 2,
            options: [
              { value: 0, label: tr("Halo") },
              { value: 1, label: tr("Exotic") },
              { value: 2, label: tr("all") },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "radar",
                label: tr("Floor sweep"),
                blips: (c) => {
                  if (!c.online) return [];
                  const range = c.get("range", 60);
                  return anomaliesHere(c, c.get("detect", 2))
                    .filter((b) => b.d <= range)
                    .map((b) => ({ a: b.a, r: b.d / range }));
                },
              },
              {
                kind: "knob",
                key: "range",
                label: tr("Range"),
                min: 20,
                max: 120,
                step: 10,
                def: 60,
                unit: "m",
              },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Signatures"),
                value: (c) =>
                  c.online
                    ? anomaliesHere(c, c.get("detect", 2)).filter((b) => b.d <= c.get("range", 60))
                        .length
                    : 0,
              },
              {
                kind: "readout",
                label: tr("Nearest"),
                value: (c) => {
                  const n = c.online ? anomaliesHere(c, c.get("detect", 2))[0] : undefined;
                  return n ? Math.round(n.d) : "—";
                },
                unit: "m",
              },
              {
                kind: "readout",
                label: tr("Halo dust held"),
                value: (c) => items(c, "halo_staub"),
              },
            ],
          },
        ],
      },
      {
        id: "catalog",
        label: tr("Catalog"),
        widgets: [
          {
            kind: "graph",
            label: tr("Frequency sweep"),
            series: (c) =>
              Array.from({ length: 40 }, (_, i) => {
                if (!c.online) return 0;
                const moving = knows(c, "anomalie_hoert")
                  ? Math.exp(-((i - 20 - Math.sin(c.t * 0.4) * 14) ** 2) / 6) * 0.7
                  : 0;
                return unit(0.12 + wobble(c.t * 2 + i * 0.3, 3) * 0.06 + moving);
              }),
          },
          {
            kind: "log",
            label: tr("Signature catalog"),
            lines: (c) =>
              knows(c, "anomalie_hoert")
                ? [
                    tr("SIG-1 halo dust, static"),
                    tr("SIG-2 exotic residue, static"),
                    tr("SIG-3 rift echo, periodic"),
                    tr("SIG-4 thermal ghost, drifting"),
                    tr("SIG-5 unclassified — moving. Towards you. Then away."),
                  ]
                : [tr("Catalog empty. Read out the detector to classify signatures.")],
          },
          { kind: "button", label: tr("Classify"), action: "use" },
        ],
      },
    ],
  },

  // ── QCP-001 Quantum Compass ───────────────────────────────────
  {
    id: "QCP-001",
    model: tr("Quantum Compass · QCP-001 · gyro + magnetometer + quantum link"),
    face: "handheld",
    font: "nixie",
    accent: "#00e5c0",
    plate: "#10231f",
    boot: [
      tr("gyroscope spun up"),
      tr("north ignored (by design)"),
      tr("pattern lock searching …"),
    ],
    pages: [
      {
        id: "needle",
        label: tr("Needle"),
        widgets: [
          {
            kind: "dial",
            label: tr("Bearing to the pattern"),
            marks: ["N", "E", "S", "W"],
            angle: (c) => {
              const jitter = c.get("stabilize", 1) === 1 ? 0.03 : 0.25;
              const n = c.online ? slicesHere(c)[0] : undefined;
              return n ? n.a + wobble(c.t, 7) * jitter : c.t * 0.9;
            },
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "readout",
                label: tr("Distance"),
                value: (c) => {
                  const n = c.online ? slicesHere(c)[0] : undefined;
                  return n ? Math.round(n.d) : "—";
                },
                unit: "m",
              },
              {
                kind: "readout",
                label: tr("Slices"),
                value: (c) => counter(c, "slices"),
                unit: "/30",
              },
              {
                kind: "readout",
                label: tr("On this level"),
                value: (c) => slicesHere(c).length,
              },
            ],
          },
          { kind: "switch", key: "stabilize", label: tr("Needle stabilizer"), def: 1 },
          { kind: "button", label: tr("Take bearing"), action: "use" },
        ],
      },
      {
        id: "pattern",
        label: tr("Pattern"),
        widgets: [
          {
            kind: "radar",
            label: tr("Slice field"),
            blips: (c) =>
              c.online ? slicesHere(c).map((b) => ({ a: b.a, r: Math.min(1, b.d / 90) })) : [],
          },
          {
            kind: "leds",
            items: [
              {
                label: tr("Hint from the ink"),
                on: (c) => knows(c, "kompass_hinweis"),
                tone: "info",
              },
              { label: tr("Echo reference"), on: (c) => knows(c, "damien_echo"), tone: "info" },
              {
                label: tr("Coordinates saved"),
                on: (c) => knows(c, "damien_koordinaten"),
                tone: "ok",
                blink: true,
              },
            ],
          },
        ],
      },
    ],
  },

  // ── DIM-001 Dimension Monitor ─────────────────────────────────
  {
    id: "DIM-001",
    model: tr("Dimension Monitor · DIM-001 · D-space probe"),
    face: "console",
    font: "crt",
    accent: "#7a5cff",
    plate: "#15122a",
    boot: [
      tr("D-space probe extended"),
      tr("stability lock: engaged"),
      tr("time may fold during operation"),
    ],
    pages: [
      {
        id: "rift",
        label: tr("Rift"),
        widgets: [
          {
            kind: "scope",
            label: tr("Folded time"),
            wave: (x, c) => {
              if (!c.online) return 0;
              const ap = c.get("aperture", 30) / 100;
              const lock = c.get("lock", 1) === 1 ? 0.4 : 1;
              const fold =
                Math.sin((x * 4 + c.t * 0.25) * TAU) * Math.sin((x * 1.5 - c.t * 0.1) * TAU);
              return clamp(fold * ap * 1.4 + wobble(c.t + x * 30, 8) * 0.15 * lock * ap, -1, 1);
            },
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "gauge",
                label: tr("Aperture"),
                value: (c) => (c.online ? c.get("aperture", 30) : 0),
                min: 0,
                max: 100,
                unit: "%",
                warn: 70,
                bad: 90,
              },
              {
                kind: "gauge",
                label: tr("Halo field"),
                value: (c) =>
                  c.online
                    ? Math.round(
                        (knows(c, "halo_zustand") ? 60 : 20) +
                          (c.get("aperture", 30) / 100) * 30 +
                          wobble(c.t, 5) * 4,
                      )
                    : 0,
                min: 0,
                max: 100,
                unit: "μH",
              },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "slider",
                key: "aperture",
                label: tr("Rift aperture"),
                min: 0,
                max: 100,
                step: 5,
                def: 30,
                unit: "%",
              },
              { kind: "switch", key: "lock", label: tr("Stability lock"), def: 1 },
            ],
          },
          { kind: "button", label: tr("Open the rift"), action: "use" },
        ],
      },
      {
        id: "voices",
        label: tr("Voices"),
        widgets: [
          {
            kind: "leds",
            items: [
              {
                label: tr("_unstables heard"),
                on: (c) => knows(c, "unstables"),
                tone: "info",
                blink: true,
              },
              { label: tr("Halo is a state"), on: (c) => knows(c, "halo_zustand"), tone: "info" },
              { label: tr("Palette wired"), on: (c) => solved(c, "pz_palette_int"), tone: "ok" },
            ],
          },
          {
            kind: "text",
            text: (c) =>
              knows(c, "unstables")
                ? tr("“We are what persists between your measurements.”")
                : tr("The rift is quiet. Open it and listen."),
            tone: (c): Tone => (knows(c, "unstables") ? "warn" : "off"),
          },
        ],
      },
    ],
  },

  // ── EXD-001 Explorer Drone ────────────────────────────────────
  {
    id: "EXD-001",
    model: tr("Explorer Drone · EXD-001 · heavy class, IMU-stabilized"),
    face: "console",
    font: "lcd",
    accent: "#ffd23f",
    plate: "#262210",
    boot: [
      tr("rotors 1–4 … free"),
      tr("IMU stabilized, GPS: none (we are underground)"),
      tr("cargo bay empty"),
    ],
    pages: [
      {
        id: "flight",
        label: tr("Flight"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "radar",
                label: tr("Shaft map"),
                sweep: false,
                blips: (c) =>
                  Array.from({ length: Math.min(12, counter(c, "drone_runs")) }, (_, i) => ({
                    a: i * 2.4,
                    r: 0.2 + i * 0.065,
                    label: `#${i + 1}`,
                  })),
              },
              {
                kind: "bar",
                label: tr("Battery"),
                value: (c) =>
                  droneReady(c.s)
                    ? DRONE_COOLDOWN
                    : Math.max(0, c.s.playTime - counter(c, "drone_last")),
                max: DRONE_COOLDOWN,
                unit: "s",
                tone: (c): Tone => (droneReady(c.s) ? "ok" : "warn"),
              },
            ],
          },
          {
            kind: "row",
            widgets: [
              { kind: "readout", label: tr("Flights"), value: (c) => counter(c, "drone_runs") },
              {
                kind: "readout",
                label: tr("Status"),
                value: (c) =>
                  !c.online ? tr("offline") : droneReady(c.s) ? tr("ready") : tr("charging"),
                tone: (c): Tone => (!c.online ? "off" : droneReady(c.s) ? "ok" : "warn"),
              },
              {
                kind: "readout",
                label: tr("Shaft"),
                value: (c) => (knows(c, "schacht_frei") ? tr("mapped") : tr("unknown")),
              },
            ],
          },
          {
            kind: "button",
            label: tr("Launch"),
            action: "drone",
            disabled: (c) => !droneReady(c.s),
            hint: tr("Flies into the sealed shaft and brings back salvage."),
          },
        ],
      },
      {
        id: "cargo",
        label: tr("Cargo"),
        widgets: [
          {
            kind: "mode",
            key: "scan",
            label: tr("Scanner"),
            def: 0,
            options: [
              { value: 0, label: tr("Resources") },
              { value: 1, label: tr("Telemetry") },
            ],
          },
          {
            kind: "log",
            label: tr("Readout"),
            lines: (c) =>
              c.get("scan", 0) === 0
                ? DRONE_ITEMS.map((id) => `${items(c, id)}× ${itemDef(c.s, id)?.name ?? id}`)
                : [
                    tr("Altitude {m} m", {
                      m: Math.round(droneReady(c.s) ? 0 : 45 + wobble(c.t, 2) * 5),
                    }),
                    tr("IMU drift {d}°", { d: Math.round(Math.abs(wobble(c.t, 3)) * 30) / 10 }),
                    tr("Firmware {v}", { v: installedVersion(c.s, "EXD-001") }),
                    tr("NET uplink: {state}", {
                      state: isLinked(c.s, "NET-001", "EXD-001") ? tr("linked") : tr("none"),
                    }),
                  ],
          },
          { kind: "button", label: tr("Flight log"), action: "use" },
        ],
      },
    ],
  },

  // ── NXS-01 Nexus ──────────────────────────────────────────────
  {
    id: "NXS-01",
    model: tr("Nexus · NXS-01 · research hub, holo pedestal"),
    face: "terminal",
    font: "vfd",
    accent: "#8cf2ff",
    plate: "#10202a",
    boot: [
      tr("tech graph rendered (38 nodes)"),
      tr("prerequisite resolver: consistent"),
      tr("holo projection … a diagram nobody drew"),
    ],
    pages: [
      {
        id: "research",
        label: tr("Research"),
        widgets: [
          {
            kind: "row",
            widgets: [
              { kind: "readout", label: tr("Points"), value: (c) => counter(c, "research") },
              {
                kind: "readout",
                label: tr("Next cycle"),
                value: (c) =>
                  researchReady(c.s)
                    ? tr("ready")
                    : Math.ceil(RESEARCH_COOLDOWN - (c.s.playTime - counter(c, "research_last"))),
                unit: "s",
              },
              {
                kind: "readout",
                label: tr("Topic"),
                value: (c) => nextTopic(c)?.title ?? tr("all done"),
              },
            ],
          },
          ...RESEARCH_TOPICS.map((t) => ({
            kind: "bar" as const,
            label: t.title,
            value: (c: UiCtx) =>
              c.s.flags[researchFlag(t.id)] ? t.cost : Math.min(t.cost, counter(c, "research")),
            max: t.cost,
            tone: (c: UiCtx): Tone => (c.s.flags[researchFlag(t.id)] ? "ok" : "info"),
          })),
          {
            kind: "button",
            label: tr("Run research cycle"),
            action: "use",
            disabled: (c) => !researchReady(c.s),
          },
        ],
      },
      {
        id: "graph",
        label: tr("Tech graph"),
        widgets: [
          {
            kind: "matrix",
            label: tr("Lab devices (built / online)"),
            cols: 8,
            rows: 5,
            cell: (i, c) => {
              const d = DEVICES[i];
              if (!d) return 0;
              const pulse = 0.85 + Math.sin(c.t * 2 + i) * 0.15;
              return on(c, d.id)
                ? pulse
                : isBuilt(c.s, d.id)
                  ? 0.45
                  : c.s.discovered[d.id]
                    ? 0.15
                    : 0;
            },
          },
          {
            kind: "mode",
            key: "focus",
            label: tr("Focus"),
            def: 0,
            options: [
              { value: 0, label: tr("Topics") },
              { value: 1, label: tr("Features") },
            ],
          },
          {
            kind: "log",
            label: tr("Node"),
            lines: (c) =>
              c.get("focus", 0) === 1
                ? features(c.s, "NXS-01")
                : RESEARCH_TOPICS.map((t) =>
                    c.s.flags[researchFlag(t.id)] ? `✓ ${t.text}` : `· ${t.title} (${t.cost})`,
                  ),
          },
        ],
      },
    ],
  },

  // ── LCT-001 Precision Laser ───────────────────────────────────
  {
    id: "LCT-001",
    model: tr("Precision Laser · LCT-001 · diode array, class 4"),
    face: "rack",
    font: "lcd",
    accent: "#ff2a2a",
    plate: "#241010",
    boot: [
      tr("interlock closed"),
      tr("optics check: lens clean (for once)"),
      tr("wear goggles. Yes, you."),
    ],
    pages: [
      {
        id: "cut",
        label: tr("Cutter"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "gauge",
                label: tr("Diode temperature"),
                value: (c) =>
                  c.online ? Math.round(24 + c.get("output", 60) * 0.5 + wobble(c.t, 4) * 1.5) : 21,
                min: 20,
                max: 90,
                unit: "°C",
                warn: 60,
                bad: 72,
              },
              {
                kind: "readout",
                label: tr("Beam"),
                value: (c) => (c.online ? Math.round((55 * c.get("output", 60)) / 100) : 0),
                unit: "W",
              },
              {
                kind: "readout",
                label: tr("Kerf"),
                value: (c) =>
                  Math.round((0.08 + Math.abs(c.get("focus", 50) / 10 - 4.2) * 0.05) * 100) / 100,
                digits: 2,
                unit: "mm",
              },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "slider",
                key: "output",
                label: tr("Power"),
                min: 10,
                max: 100,
                step: 5,
                def: 60,
                unit: "%",
              },
              {
                kind: "knob",
                key: "focus",
                label: tr("Focus"),
                min: 0,
                max: 100,
                step: 2,
                def: 50,
              },
            ],
          },
          {
            kind: "graph",
            label: tr("Beam stability"),
            series: (c) => {
              const off = Math.abs(c.get("focus", 50) / 10 - 4.2) / 6;
              return Array.from({ length: 32 }, (_, i) =>
                c.online
                  ? unit(0.8 - off * 0.5 + wobble(c.t - (31 - i) * 0.2, 6) * (0.03 + off * 0.3))
                  : 0,
              );
            },
          },
          {
            kind: "leds",
            items: [
              { label: tr("Interlock"), on: (c) => c.online, tone: "ok" },
              {
                label: tr("Thermal protect"),
                on: (c) => c.get("output", 60) >= 90,
                tone: "warn",
                blink: true,
              },
              { label: tr("Shaft seal cut"), on: (c) => knows(c, "schacht_frei"), tone: "info" },
              {
                label: tr("Cooling loop"),
                on: (c) => isLinked(c.s, "THM-001", "LCT-001"),
                tone: "ok",
              },
            ],
          },
          { kind: "button", label: tr("Fire"), action: "use" },
        ],
      },
    ],
  },

  // ── P3D-001 3D Fabricator ─────────────────────────────────────
  {
    id: "P3D-001",
    model: tr("3D Fabricator · P3D-001 · multi-material, heated bed"),
    face: "cabinet",
    font: "mono",
    accent: "#ffa726",
    plate: "#2a2016",
    boot: [
      tr("bed leveling … 16 probes"),
      tr("nozzle heating"),
      tr("filament: Base Alloy (hopefully)"),
    ],
    pages: [
      {
        id: "print",
        label: tr("Print"),
        widgets: [
          {
            kind: "row",
            widgets: [
              {
                kind: "gauge",
                label: tr("Nozzle"),
                value: (c) =>
                  c.online ? Math.round(c.get("nozzle", 215) + wobble(c.t, 2) * 2) : 22,
                min: 20,
                max: 280,
                unit: "°C",
                warn: 250,
                bad: 270,
              },
              {
                kind: "readout",
                label: tr("Filament"),
                value: (c) => items(c, "basislegierung"),
                unit: tr("alloy"),
                tone: (c): Tone => (items(c, "basislegierung") > 0 ? "ok" : "bad"),
              },
              {
                kind: "readout",
                label: tr("Patterns"),
                value: (c) => fabricable(c.s).length,
              },
            ],
          },
          {
            kind: "row",
            widgets: [
              {
                kind: "knob",
                key: "nozzle",
                label: tr("Nozzle target"),
                min: 180,
                max: 260,
                step: 5,
                def: 215,
                unit: "°C",
              },
              {
                kind: "slider",
                key: "layer",
                label: tr("Layer height"),
                min: 1,
                max: 4,
                step: 1,
                def: 2,
                unit: "×0.1 mm",
              },
            ],
          },
          {
            kind: "bar",
            label: tr("Layer"),
            value: (c) => {
              const layers = Math.round(120 / c.get("layer", 2));
              return c.online ? Math.floor(((c.t * 4) % layers) + 1) : 0;
            },
            max: (c) => Math.round(120 / c.get("layer", 2)),
          },
          {
            kind: "log",
            label: tr("Print patterns"),
            max: 6,
            lines: (c) => {
              const f = fabricable(c.s);
              return f.length ? f.slice(0, 6).map((d) => d.name) : [tr("No known part patterns.")];
            },
          },
          {
            kind: "button",
            label: tr("Fabricate"),
            action: "fabricate",
            disabled: (c) => items(c, "basislegierung") <= 0,
            hint: tr("Needs 1× Base Alloy as filament."),
          },
        ],
      },
      {
        id: "bed",
        label: tr("Bed"),
        widgets: [
          {
            kind: "matrix",
            label: tr("Bed mesh"),
            cols: 8,
            rows: 4,
            cell: (i, c) => {
              const lvl = c.get("autolevel", 1) === 1 ? 0.15 : 1;
              return unit(0.5 + (Math.sin(i * 1.7) * 0.3 + wobble(c.t * 0.2, i) * 0.05) * lvl);
            },
          },
          { kind: "switch", key: "autolevel", label: tr("Auto-level"), def: 1 },
          {
            kind: "readout",
            label: tr("Bed deviation"),
            value: (c) => (c.get("autolevel", 1) === 1 ? 0.02 : 0.14),
            digits: 2,
            unit: "mm",
          },
        ],
      },
    ],
  },
];
