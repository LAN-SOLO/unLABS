/**
 * Root lab shell (docs/ROOT-LAB.md § Commands): the system commands every
 * terminal shares — the room terminals (`terminal-lite`), the Main Console
 * (`root …` / `labor root …` via bridge.ts) and cron.
 *
 * `runRoot(state, line, ctx)` never mutates the state: it validates the
 * command against the access ring and returns output lines plus the
 * `RootOp`s to apply (`applyRootOp`, model.ts). That keeps one code path
 * for every caller and lets the bridge replay ops idempotently.
 *
 *   su [ring]                     climb (or drop) an access ring
 *   sysctl [-a | key | key=value | reset key|all]
 *   fw [list | <ID> | <ID> <clock> [volt] [--dry] | <ID> profile <name>
 *      | <ID> autotune [perf|eco] | <ID> reset]
 *   sensors                       heat, limits, kernel load
 *   cron [list | add <s> [when <metric><op><n>] <cmd>[; <cmd>] | rm <id>]
 *   profile [list | save|load|rm|show|export <name> | import <name> <code>]
 *   audit [n]                     who changed what, when
 *   rescue --yes                  factory reset of sysctl + firmware
 */
import { tr } from "@/lib/i18n";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { isBuilt, power, tunedDraw } from "@/lib/world/game";
import { RING_NEEDS, ringMissing } from "@/lib/world/root/access";
import {
  FEATURE_CLOCK,
  FW_PROFILES,
  GOVERNOR_W,
  RING_NAMES,
  UNTUNABLE,
  applyRootOp,
  fwOf,
  fwRange,
  heatOf,
  isStable,
  isTuned,
  kernelLoad,
  stableClock,
  thermalLimit,
  tun,
  type RootOp,
} from "@/lib/world/root/model";
import {
  MAX_CMD,
  MAX_CRON,
  MAX_PROFILES,
  MIN_CRON_EVERY,
  sanitizeRoot,
  type FwTune,
  type RootProfile,
  type Ring,
} from "@/lib/world/root/state";
import { TUNABLES, TUNABLE_BY_KEY, rangeFor, snap, type Tunable } from "@/lib/world/root/tunables";
import type { WorldState } from "@/lib/world/types";

export interface RootResult {
  lines: string[];
  ops: RootOp[];
}

export interface RootCtx {
  /** Ring to run with (cron jobs run with the ring they were created at). */
  ring?: Ring;
  /** Running inside cron (no `su`, no `cron`, no `rescue`). */
  cron?: boolean;
}

/** Commands the root shell answers (terminal-lite registers these names). */
export const ROOT_COMMANDS = [
  "su",
  "sysctl",
  "fw",
  "sensors",
  "cron",
  "profile",
  "audit",
  "rescue",
] as const;
export type RootCommand = (typeof ROOT_COMMANDS)[number];

/** Command heads a cron job may run. */
export const CRON_HEADS: readonly string[] = ["sysctl", "fw", "profile", "switch"];

const HR = "────────────────────────────────────────";

const say = (...lines: string[]): RootResult => ({ lines, ops: [] });

function pad(v: string, n: number): string {
  return v.length >= n ? v : v + " ".repeat(n - v.length);
}

function padL(v: string, n: number): string {
  return v.length >= n ? v : " ".repeat(n - v.length) + v;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

function ringOf(s: WorldState, ctx: RootCtx): Ring {
  return ctx.ring ?? s.root.ring;
}

function needRing(s: WorldState, ctx: RootCtx, ring: Ring, what: string): RootResult | null {
  if (ringOf(s, ctx) >= ring) return null;
  return say(
    tr("{what}: permission denied (needs ring {n} · {name}).", {
      what,
      n: ring,
      name: RING_NAMES[ring],
    }),
    tr("“su” shows what the MCP wants before it hands over the next ring."),
  );
}

// ── su ───────────────────────────────────────────────────────────

function ringArg(a: string | undefined): Ring | null {
  if (a === undefined) return null;
  const n = Number(a);
  if (Number.isInteger(n) && n >= 0 && n <= 3) return n as Ring;
  const hit = (Object.entries(RING_NAMES) as [string, string][]).find(([, v]) => v === a);
  return hit ? (Number(hit[0]) as Ring) : null;
}

function cmdSu(s: WorldState, args: string[]): RootResult {
  const cur = s.root.ring;
  const want = args[0] === undefined ? (Math.min(3, cur + 1) as Ring) : ringArg(args[0]);
  if (want === null)
    return say(tr("su: unknown ring. Rings: operator, wheel, root, kernel (0–3)."));
  if (want === cur) {
    if (cur === 3) return say(tr("su: already kernel. There is nothing above ring 0."));
    if (args[0] !== undefined) return say(tr("su: already {name}.", { name: RING_NAMES[cur] }));
  }
  if (want < cur)
    return {
      lines: [
        tr("Dropped to {name}. Credentials kept — “su” climbs back.", { name: RING_NAMES[want] }),
      ],
      ops: [{ op: "ring", ring: want }],
    };
  if (want > cur + 1)
    return say(
      tr("su: one ring at a time. Next: {name}.", { name: RING_NAMES[(cur + 1) as Ring] }),
    );
  const missing = ringMissing(s, want as 1 | 2 | 3);
  if (missing.length)
    return say(
      tr("MCP> Ring {n} ({name}) denied. What I still need to see:", {
        n: want,
        name: RING_NAMES[want],
      }),
      ...missing.map((m) => `  ○ ${m}`),
    );
  return {
    lines: [
      RING_NEEDS[want as 1 | 2 | 3].granted(),
      tr("Ring {n} · {name}. “help” lists what is new.", { n: want, name: RING_NAMES[want] }),
    ],
    ops: [{ op: "ring", ring: want }],
  };
}

// ── sysctl ───────────────────────────────────────────────────────

function sysctlLine(s: WorldState, t: Tunable, ring: Ring): string {
  const v = tun(s, t.key);
  const [lo, hi] = rangeFor(t, ring);
  const mark = s.root.sysctl[t.key] !== undefined ? "*" : " ";
  const load = t.cost(v);
  return `${mark} ${pad(t.key, 22)} = ${padL(fmt(v), 6)} ${pad(t.unit, 2)}  [${fmt(lo)}…${fmt(hi)}]  r${t.ring}${load ? `  +${fmt(Math.round(load * 10) / 10)} W` : ""}`;
}

function cmdSysctl(s: WorldState, args: string[], ctx: RootCtx): RootResult {
  const ring = ringOf(s, ctx);
  const a0 = args[0];
  if (a0 === undefined || a0 === "-a" || a0 === "--all") {
    return say(
      tr("sysctl · {n} tunables · * = changed · load = kernel watts on the MCP-000", {
        n: TUNABLES.length,
      }),
      HR,
      ...TUNABLES.map((t) => sysctlLine(s, t, ring)),
      HR,
      tr("Kernel load: {w} W · “sysctl <key>” explains one · “sysctl <key>=<value>” sets it", {
        w: fmt(kernelLoad(s)),
      }),
    );
  }
  if (a0 === "reset") {
    const key = args[1];
    if (!key) return say(tr("Syntax: sysctl reset <key|all>"));
    if (key === "all") {
      const keys = Object.keys(s.root.sysctl).filter((k) => {
        const t = TUNABLE_BY_KEY.get(k);
        return t && ring >= t.ring;
      });
      if (!keys.length) return say(tr("sysctl: nothing to reset."));
      return {
        lines: [tr("{n} tunable(s) back to their rating.", { n: keys.length })],
        ops: keys.map((k) => ({ op: "sysctl-reset", key: k })),
      };
    }
    const t = TUNABLE_BY_KEY.get(key);
    if (!t) return say(tr("sysctl: unknown key “{key}”. “sysctl -a” lists them.", { key }));
    const deny = needRing(s, ctx, t.ring, `sysctl ${key}`);
    if (deny) return deny;
    return {
      lines: [`${key} = ${fmt(t.def)} ${t.unit}`],
      ops: [{ op: "sysctl-reset", key }],
    };
  }
  const joined = args.join("");
  const eq = joined.indexOf("=");
  const key = eq < 0 ? joined : joined.slice(0, eq);
  const t = TUNABLE_BY_KEY.get(key);
  if (!t) {
    const near = TUNABLES.filter((x) => x.key.startsWith(key.split(".")[0] ?? "")).map(
      (x) => x.key,
    );
    return say(
      tr("sysctl: unknown key “{key}”. “sysctl -a” lists them.", { key }),
      ...(near.length ? [tr("Did you mean: {keys}", { keys: near.join(", ") })] : []),
    );
  }
  if (eq < 0) {
    const [lo, hi] = rangeFor(t, ring);
    return say(
      sysctlLine(s, t, ring).slice(2),
      `  ${t.help()}`,
      tr("  default {def} · ring {r}+ may set {lo}…{hi} · ring 3 (kernel) {klo}…{khi}", {
        def: fmt(t.def),
        r: t.ring,
        lo: fmt(lo),
        hi: fmt(hi),
        klo: fmt(t.kmin),
        khi: fmt(t.kmax),
      }),
    );
  }
  const deny = needRing(s, ctx, t.ring, `sysctl ${key}`);
  if (deny) return deny;
  const raw = Number(joined.slice(eq + 1));
  if (!Number.isFinite(raw))
    return say(tr("sysctl: “{v}” is not a number.", { v: joined.slice(eq + 1) }));
  const [lo, hi] = rangeFor(t, ring);
  const v = snap(t, raw);
  if (v < lo - 1e-9 || v > hi + 1e-9)
    return say(
      tr("sysctl: {key} must stay within {lo}…{hi} {unit} at ring {n}.", {
        key,
        lo: fmt(lo),
        hi: fmt(hi),
        unit: t.unit,
        n: ring,
      }),
      ...(ring < 3
        ? [tr("Ring 3 (kernel) widens it to {lo}…{hi}.", { lo: fmt(t.kmin), hi: fmt(t.kmax) })]
        : []),
    );
  const load = t.cost(v);
  return {
    lines: [
      `${key} = ${fmt(v)} ${t.unit}`,
      ...(load
        ? [tr("  kernel load +{w} W on the MCP-000", { w: fmt(Math.round(load * 10) / 10) })]
        : []),
    ],
    ops: [{ op: "sysctl", key, value: v }],
  };
}

// ── fw ───────────────────────────────────────────────────────────

/** Devices `fw` may touch: built, consuming or generating, not the MCP. */
function tunable(s: WorldState, id: string): boolean {
  return isBuilt(s, id) && !UNTUNABLE.includes(id);
}

function idArg(a: string | undefined): string | undefined {
  if (!a) return undefined;
  const up = a.toUpperCase();
  return DEVICE_BY_ID.has(up) ? up : DEVICES.find((d) => d.id.startsWith(`${up}-`))?.id;
}

interface Readout {
  draw: number;
  heat: number;
  limit: number;
  stable: boolean;
  online: boolean;
  status: string;
}

function readout(s: WorldState, id: string): Readout {
  const f = fwOf(s, id);
  const p = power(s);
  const cooled = (s.links["THM-001"] ?? []).includes(id) && p.online.has("THM-001");
  const heat = heatOf(f);
  const limit = thermalLimit(s, cooled);
  const st = p.starved.find((x) => x.id === id);
  const status = p.online.has(id)
    ? tr("online")
    : st
      ? st.reason === "hitze"
        ? tr("TRIPPED (heat)")
        : isStable(f)
          ? tr("no power")
          : tr("BROWNOUT (undervolted)")
      : tr("off");
  return {
    draw: tunedDraw(s, id),
    heat,
    limit,
    stable: isStable(f),
    online: p.online.has(id),
    status,
  };
}

function fwRow(s: WorldState, id: string): string {
  const f = fwOf(s, id);
  const r = readout(s, id);
  const d = DEVICE_BY_ID.get(id)!;
  const watts = d.power < 0 ? `+${fmt(-d.power)}` : fmt(r.draw);
  return `${isTuned(s, id) ? "*" : " "} ${pad(id, 8)} ${padL(String(f.clock), 4)} % ${padL(String(f.volt), 4)} %  ${padL(heat100(r.heat), 4)}/${pad(heat100(r.limit), 4)} ${padL(watts, 7)} W  ${r.status}`;
}

function heat100(h: number): string {
  return String(Math.round(h * 100));
}

function predict(s: WorldState, id: string, f: FwTune): string[] {
  const sim = structuredClone(s);
  applyRootOp(sim, { op: "fw", id, clock: f.clock, volt: f.volt }, "dry");
  const before = power(s);
  const after = power(sim);
  const r = readout(sim, id);
  const lines = [
    tr("  heat {h} / limit {l} · stable up to {c} % clock at {v} % volt", {
      h: heat100(r.heat),
      l: heat100(r.limit),
      c: Math.floor(stableClock(f)),
      v: f.volt,
    }),
    tr("  grid {g0} → {g1} W generated · {d0} → {d1} W demand · {status}", {
      g0: fmt(Math.round(before.generation)),
      g1: fmt(Math.round(after.generation)),
      d0: fmt(Math.round(before.demand)),
      d1: fmt(Math.round(after.demand)),
      status: r.status,
    }),
  ];
  if (f.clock < FEATURE_CLOCK)
    lines.push(tr("  ! below {c} % the firmware update features switch off", { c: FEATURE_CLOCK }));
  if (!r.stable) lines.push(tr("  ! unstable: raise the voltage or lower the clock"));
  else if (r.heat > r.limit + 1e-9)
    lines.push(tr("  ! too hot: link it to a running THM-001 or lower clock/voltage"));
  return lines;
}

/** Best stable, cool-enough setting within the ring's range. */
export function autotune(
  s: WorldState,
  id: string,
  mode: "perf" | "eco",
  ring: Ring,
): FwTune | null {
  const rg = fwRange(ring);
  const p = power(s);
  const cooled = (s.links["THM-001"] ?? []).includes(id) && p.online.has("THM-001");
  const limit = thermalLimit(s, cooled);
  let best: FwTune | null = null;
  let score = -Infinity;
  for (let volt = rg.volt[0]; volt <= rg.volt[1]; volt++)
    for (let clock = rg.clock[0]; clock <= rg.clock[1]; clock++) {
      const f = { clock, volt };
      if (!isStable(f) || heatOf(f) > limit + 1e-9) continue;
      if (mode === "eco" && clock < FEATURE_CLOCK) continue;
      // perf: highest clock, then lowest voltage; eco: lowest draw keeping the features.
      const sc =
        mode === "perf" ? clock * 1000 - volt : -(clock / 100) * (volt / 100) ** 2 * 1e6 + clock;
      if (sc > score) {
        score = sc;
        best = f;
      }
    }
  return best;
}

function cmdFw(s: WorldState, args: string[], ctx: RootCtx): RootResult {
  const ring = ringOf(s, ctx);
  const a0 = args[0];
  if (a0 === undefined || a0 === "list" || a0 === "ls") {
    const ids = DEVICES.filter((d) => tunable(s, d.id)).map((d) => d.id);
    if (!ids.length) return say(tr("fw: no built device to tune yet."));
    return say(
      tr("fw · firmware tuning · clock / voltage in % of rating · heat / limit · * = tuned"),
      HR,
      `  ${pad("ID", 8)} ${padL("clk", 6)} ${padL("volt", 6)}  ${pad("heat/lim", 9)} ${padL("W", 9)}  ${tr("state")}`,
      ...ids.map((id) => fwRow(s, id)),
      HR,
      tr("“fw <ID>” details · “fw <ID> <clock> [volt] --dry” previews · profiles: {p}", {
        p: Object.keys(FW_PROFILES).join(", "),
      }),
    );
  }
  const id = idArg(a0);
  if (!id) return say(tr("fw: unknown device “{id}”.", { id: a0 }));
  if (UNTUNABLE.includes(id))
    return say(tr("MCP> Hands off my core. Tune the kernel instead: sysctl."));
  if (!isBuilt(s, id)) return say(tr("fw: {id} is not built.", { id }));
  const d = DEVICE_BY_ID.get(id)!;
  const f = fwOf(s, id);
  const rest = args.slice(1);
  if (!rest.length) {
    const r = readout(s, id);
    return say(
      `${id} · ${d.name}`,
      HR,
      tr("clock {c} % · voltage {v} % · {state}", { c: f.clock, v: f.volt, state: r.status }),
      d.power < 0
        ? tr("output rated {w} W · scales with the clock", { w: fmt(-d.power) })
        : tr("draw {w} W (rated {r} W) · scales with clock × voltage²", {
            w: fmt(r.draw),
            r: fmt(d.power),
          }),
      tr("heat {h} / limit {l} · stable up to {c} % clock at this voltage", {
        h: heat100(r.heat),
        l: heat100(r.limit),
        c: Math.floor(stableClock(f)),
      }),
      ...(f.clock < FEATURE_CLOCK
        ? [tr("! below {c} % — firmware update features are off", { c: FEATURE_CLOCK })]
        : []),
      HR,
      ring >= 2
        ? tr("Range at ring {n}: clock {c0}…{c1} % · voltage {v0}…{v1} %", {
            n: ring,
            c0: fwRange(ring).clock[0],
            c1: fwRange(ring).clock[1],
            v0: fwRange(ring).volt[0],
            v1: fwRange(ring).volt[1],
          })
        : tr("Tuning needs ring 2 (root)."),
    );
  }
  const deny = needRing(s, ctx, 2, `fw ${id}`);
  if (deny) return deny;
  const dry = rest.includes("--dry") || rest.includes("-n");
  const words = rest.filter((w) => w !== "--dry" && w !== "-n");
  let want: FwTune | null = null;
  let label = "";
  const w0 = words[0]?.toLowerCase();
  if (w0 === "reset") {
    if (!isTuned(s, id)) return say(tr("fw: {id} already runs at its rating.", { id }));
    return { lines: [tr("{id} back to 100 % / 100 %.", { id })], ops: [{ op: "fw-reset", id }] };
  }
  if (w0 === "profile") {
    const name = words[1]?.toLowerCase() ?? "";
    const pr = FW_PROFILES[name];
    if (!pr) return say(tr("fw: profiles are {p}.", { p: Object.keys(FW_PROFILES).join(", ") }));
    const denyP = needRing(s, ctx, pr.ring, `fw profile ${name}`);
    if (denyP) return denyP;
    want = { clock: pr.clock, volt: pr.volt };
    label = name;
  } else if (w0 === "autotune" || w0 === "auto") {
    const mode = words[1]?.toLowerCase() === "eco" ? "eco" : "perf";
    want = autotune(s, id, mode, ring);
    if (!want) return say(tr("fw: no stable setting fits under the thermal limit."));
    label = `autotune ${mode}`;
  } else {
    const kv = Object.fromEntries(
      words
        .filter((x) => x.includes("="))
        .map((x) => x.toLowerCase().split("=") as [string, string]),
    );
    const nums = words.filter((x) => !x.includes("="));
    const clock = Number(kv.clock ?? kv.clk ?? nums[0]);
    const volt = Number(kv.volt ?? kv.v ?? nums[1] ?? f.volt);
    if (!Number.isFinite(clock) || !Number.isFinite(volt))
      return say(tr("Syntax: fw <ID> <clock %> [volt %] [--dry]  ·  fw <ID> clock=120 volt=110"));
    want = { clock: Math.round(clock), volt: Math.round(volt) };
  }
  const rg = fwRange(ring);
  if (
    want.clock < rg.clock[0] ||
    want.clock > rg.clock[1] ||
    want.volt < rg.volt[0] ||
    want.volt > rg.volt[1]
  )
    return say(
      tr("fw: ring {n} allows clock {c0}…{c1} % and voltage {v0}…{v1} %.", {
        n: ring,
        c0: rg.clock[0],
        c1: rg.clock[1],
        v0: rg.volt[0],
        v1: rg.volt[1],
      }),
    );
  const head = `${id} → ${want.clock} % / ${want.volt} %${label ? ` (${label})` : ""}`;
  if (dry) return say(tr("{head} · dry run, nothing flashed", { head }), ...predict(s, id, want));
  return {
    lines: [tr("{head} · flashed", { head }), ...predict(s, id, want)],
    ops: [{ op: "fw", id, clock: want.clock, volt: want.volt }],
  };
}

// ── sensors ──────────────────────────────────────────────────────

function cmdSensors(s: WorldState): RootResult {
  const p = power(s);
  const running = DEVICES.filter(
    (d) =>
      isBuilt(s, d.id) && (p.online.has(d.id) || isTuned(s, d.id)) && !UNTUNABLE.includes(d.id),
  ).map((d) => d.id);
  // Tuned devices get a bar each; everything at its rating is one summary line.
  const ids = running.filter((id) => isTuned(s, id));
  const lines = [tr("sensors · heat as clock × voltage, limit 120 alone · 150 on THM-001"), HR];
  for (const id of ids) {
    const r = readout(s, id);
    const frac = Math.min(1, r.heat / r.limit);
    const n = Math.round(frac * 16);
    lines.push(
      `${pad(id, 8)} ${"█".repeat(n)}${"░".repeat(16 - n)} ${padL(heat100(r.heat), 3)}/${heat100(r.limit)}${frac >= 0.95 ? " !" : ""}`,
    );
  }
  if (running.length > ids.length)
    lines.push(
      tr("{n} more device(s) at their rating · heat 100", { n: running.length - ids.length }),
    );
  const tuned = Object.keys(s.root.fw).filter((id) => isTuned(s, id)).length;
  const sysLoad = Math.round((kernelLoad(s) - tuned * GOVERNOR_W) * 10) / 10;
  lines.push(
    HR,
    tr("Kernel load {w} W = sysctl {a} W + {n} governor(s) × {g} W", {
      w: fmt(kernelLoad(s)),
      a: fmt(sysLoad),
      n: tuned,
      g: fmt(GOVERNOR_W),
    }),
    tr("Grid {gen} W / {load} W · {n} without supply", {
      gen: fmt(Math.round(p.generation)),
      load: fmt(Math.round(p.demand)),
      n: p.starved.length,
    }),
  );
  return say(...lines);
}

// ── cron ─────────────────────────────────────────────────────────

export type CronMetric = "gen" | "load" | "balance" | "starved" | "kload";
export const CRON_METRICS: readonly CronMetric[] = ["gen", "load", "balance", "starved", "kload"];

export interface CronGuard {
  metric: CronMetric;
  cmp: "<" | ">" | "<=" | ">=" | "=";
  value: number;
}

/** Split a job line into its guard (`when balance<0`) and its commands (`;`). */
export function parseCronLine(
  line: string,
): { guard: CronGuard | null; cmds: string[] } | { error: string } {
  let rest = line.trim();
  let guard: CronGuard | null = null;
  const m = /^when\s+([a-z]+)\s*(<=|>=|<|>|=)\s*(-?\d+(?:\.\d+)?)\s+(.+)$/i.exec(rest);
  if (/^when\b/i.test(rest)) {
    if (!m) return { error: tr("cron: guard syntax is “when <metric><op><number> <command>”.") };
    const metric = m[1]!.toLowerCase() as CronMetric;
    if (!CRON_METRICS.includes(metric))
      return { error: tr("cron: metrics are {m}.", { m: CRON_METRICS.join(", ") }) };
    guard = { metric, cmp: m[2] as CronGuard["cmp"], value: Number(m[3]) };
    rest = m[4]!;
  }
  const cmds = rest
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);
  if (!cmds.length) return { error: tr("cron: no command.") };
  for (const c of cmds) {
    const head = c.split(/\s+/)[0]!.toLowerCase();
    if (!CRON_HEADS.includes(head))
      return {
        error: tr("cron: “{head}” cannot run unattended. Allowed: {h}.", {
          head,
          h: CRON_HEADS.join(", "),
        }),
      };
  }
  return { guard, cmds };
}

export function metricValue(s: WorldState, m: CronMetric): number {
  const p = power(s);
  switch (m) {
    case "gen":
      return Math.round(p.generation);
    case "load":
      return Math.round(p.demand);
    case "balance":
      return Math.round(p.generation - p.demand);
    case "starved":
      return p.starved.length;
    case "kload":
      return kernelLoad(s);
  }
}

export function guardHolds(s: WorldState, g: CronGuard | null): boolean {
  if (!g) return true;
  const v = metricValue(s, g.metric);
  switch (g.cmp) {
    case "<":
      return v < g.value;
    case ">":
      return v > g.value;
    case "<=":
      return v <= g.value;
    case ">=":
      return v >= g.value;
    case "=":
      return v === g.value;
  }
}

function cmdCron(s: WorldState, args: string[], ctx: RootCtx): RootResult {
  const sub = args[0]?.toLowerCase() ?? "list";
  if (sub === "list" || sub === "ls" || sub === "-l") {
    if (!s.root.cron.length)
      return say(
        tr("crontab is empty."),
        tr("Example: cron add 30 when balance<0 profile load eco"),
      );
    return say(
      tr("crontab · {n}/{max} jobs · runs in play time", { n: s.root.cron.length, max: MAX_CRON }),
      HR,
      ...s.root.cron.map(
        (j) =>
          `#${pad(String(j.id), 3)} ${padL(`${j.every}s`, 6)}  r${j.ring}  ${j.cmd}${j.last >= 0 ? tr("  (last {t}s ago)", { t: Math.max(0, Math.round(s.playTime - j.last)) }) : ""}`,
      ),
    );
  }
  const deny = needRing(s, ctx, 1, "cron");
  if (deny) return deny;
  if (sub === "rm" || sub === "del") {
    const id = Number(args[1]?.replace("#", ""));
    if (!s.root.cron.some((j) => j.id === id))
      return say(tr("cron: no job #{id}.", { id: args[1] ?? "?" }));
    return { lines: [tr("Job #{id} removed.", { id })], ops: [{ op: "cron-rm", id }] };
  }
  if (sub === "add") {
    const every = Number(args[1]?.replace(/s$/, ""));
    const line = args.slice(2).join(" ");
    if (!Number.isFinite(every) || !line)
      return say(tr("Syntax: cron add <seconds> [when <metric><op><n>] <command>[; <command>]"));
    if (every < MIN_CRON_EVERY)
      return say(
        tr("cron: at least every {n} s — the scheduler needs to breathe.", { n: MIN_CRON_EVERY }),
      );
    if (s.root.cron.length >= MAX_CRON)
      return say(tr("cron: crontab full ({n} jobs). “cron rm <id>” first.", { n: MAX_CRON }));
    if (line.length > MAX_CMD) return say(tr("cron: command too long."));
    const parsed = parseCronLine(line);
    if ("error" in parsed) return say(parsed.error);
    const id = s.root.nextCron;
    return {
      lines: [
        tr("Job #{id} every {s} s as {ring}: {cmd}", {
          id,
          s: Math.round(every),
          ring: RING_NAMES[ringOf(s, ctx)],
          cmd: line,
        }),
      ],
      ops: [{ op: "cron-add", id, every: Math.round(every), cmd: line, ring: ringOf(s, ctx) }],
    };
  }
  return say(tr("Syntax: cron [list | add <seconds> <command> | rm <id>]"));
}

// ── profile ──────────────────────────────────────────────────────

const PROFILE_NAME = /^[a-z0-9_-]{1,24}$/;
const CODE_PREFIX = "UNR1-";

function checksum(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36).slice(0, 4).padStart(4, "0");
}

/** Share code of a profile (sysctl + firmware), e.g. for another save. */
export function exportProfile(p: RootProfile): string {
  const body = btoa(JSON.stringify({ s: p.sysctl, f: p.fw }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${CODE_PREFIX}${body}.${checksum(body)}`;
}

/** Parse a share code; values are clamped to what `ring` may set. */
export function importProfile(code: string, ring: Ring): RootProfile | null {
  const c = code.trim();
  if (!c.startsWith(CODE_PREFIX)) return null;
  const [body, sum] = c.slice(CODE_PREFIX.length).split(".");
  if (!body || sum !== checksum(body)) return null;
  let raw: unknown;
  try {
    const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
    raw = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const clean = sanitizeRoot({ sysctl: o.s, fw: o.f });
  const sysctl: Record<string, number> = {};
  for (const [k, v] of Object.entries(clean.sysctl)) {
    const t = TUNABLE_BY_KEY.get(k);
    if (!t || ring < t.ring) continue;
    const [lo, hi] = rangeFor(t, ring);
    sysctl[k] = Math.min(hi, Math.max(lo, snap(t, v)));
  }
  const fw: Record<string, FwTune> = {};
  if (ring >= 2) {
    const rg = fwRange(ring);
    for (const [id, f] of Object.entries(clean.fw)) {
      if (!DEVICE_BY_ID.has(id) || UNTUNABLE.includes(id)) continue;
      fw[id] = {
        clock: Math.round(Math.min(rg.clock[1], Math.max(rg.clock[0], f.clock))),
        volt: Math.round(Math.min(rg.volt[1], Math.max(rg.volt[0], f.volt))),
      };
    }
  }
  return { sysctl, fw };
}

function profileSummary(p: RootProfile): string {
  return tr("{a} sysctl · {b} fw", {
    a: Object.keys(p.sysctl).length,
    b: Object.keys(p.fw).length,
  });
}

function cmdProfile(s: WorldState, args: string[], ctx: RootCtx): RootResult {
  const sub = args[0]?.toLowerCase() ?? "list";
  const names = Object.keys(s.root.profiles);
  if (sub === "list" || sub === "ls") {
    if (!names.length)
      return say(tr("No profiles. “profile save <name>” keeps the current tuning."));
    return say(
      tr("profiles · {n}/{max}", { n: names.length, max: MAX_PROFILES }),
      ...names.map((n) => `  ${pad(n, 14)} ${profileSummary(s.root.profiles[n]!)}`),
    );
  }
  const name = args[1]?.toLowerCase() ?? "";
  if (!PROFILE_NAME.test(name)) return say(tr("profile: names are a–z, 0–9, _ and - (max. 24)."));
  const p = s.root.profiles[name];
  if (sub === "show") {
    if (!p) return say(tr("profile: no profile “{name}”.", { name }));
    return say(
      `${name} · ${profileSummary(p)}`,
      ...Object.entries(p.sysctl).map(([k, v]) => `  sysctl ${k}=${fmt(v)}`),
      ...Object.entries(p.fw).map(([id, f]) => `  fw ${id} ${f.clock} ${f.volt}`),
    );
  }
  if (sub === "export") {
    if (!p) return say(tr("profile: no profile “{name}”.", { name }));
    return say(tr("Share code of “{name}”:", { name }), exportProfile(p));
  }
  const deny = needRing(s, ctx, 2, `profile ${sub}`);
  if (deny) return deny;
  if (sub === "save") {
    if (!p && names.length >= MAX_PROFILES)
      return say(tr("profile: {n} profiles max. “profile rm <name>” first.", { n: MAX_PROFILES }));
    return {
      lines: [tr("Profile “{name}” saved.", { name })],
      ops: [{ op: "profile-save", name }],
    };
  }
  if (sub === "load") {
    if (!p) return say(tr("profile: no profile “{name}”.", { name }));
    return {
      lines: [tr("Profile “{name}” loaded · {sum}", { name, sum: profileSummary(p) })],
      ops: [{ op: "profile-load", name }],
    };
  }
  if (sub === "rm") {
    if (!p) return say(tr("profile: no profile “{name}”.", { name }));
    return {
      lines: [tr("Profile “{name}” removed.", { name })],
      ops: [{ op: "profile-rm", name }],
    };
  }
  if (sub === "import") {
    const code = args.slice(2).join("");
    const profile = importProfile(code, ringOf(s, ctx));
    if (!profile) return say(tr("profile: the share code is damaged."));
    if (!p && names.length >= MAX_PROFILES)
      return say(tr("profile: {n} profiles max. “profile rm <name>” first.", { n: MAX_PROFILES }));
    return {
      lines: [
        tr("Profile “{name}” imported · {sum} · “profile load {name}” applies it", {
          name,
          sum: profileSummary(profile),
        }),
      ],
      ops: [{ op: "profile-put", name, profile }],
    };
  }
  return say(tr("Syntax: profile [list | save|load|rm|show|export <name> | import <name> <code>]"));
}

// ── audit / rescue ───────────────────────────────────────────────

function clock(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = Math.floor(t % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function cmdAudit(s: WorldState, args: string[]): RootResult {
  const n = Math.max(1, Math.min(60, Number(args[0]) || 12));
  const rows = s.root.audit.slice(-n);
  if (!rows.length) return say(tr("Audit trail is empty. Nothing has been changed yet."));
  return say(
    tr("audit · last {n} change(s) · play time", { n: rows.length }),
    HR,
    ...rows.map((a) => `${clock(a.t)}  ${pad(a.via, 18)} ${a.what}`),
  );
}

function cmdRescue(s: WorldState, args: string[]): RootResult {
  const dirty = Object.keys(s.root.sysctl).length + Object.keys(s.root.fw).length;
  if (!args.includes("--yes"))
    return say(
      tr("rescue: resets every tunable and every firmware curve to its rating ({n} change(s)).", {
        n: dirty,
      }),
      tr("Works at any ring. Profiles, cron and rings stay. Confirm with: rescue --yes"),
    );
  if (!dirty) return say(tr("rescue: everything already runs at its rating."));
  return {
    lines: [
      tr("MCP> Factory curves restored. Whatever you were trying, the lab is breathing again."),
    ],
    ops: [{ op: "factory" }],
  };
}

// ── Entry ────────────────────────────────────────────────────────

/** Run one root command (`head` must be one of `ROOT_COMMANDS`). Pure. */
export function runRoot(
  s: WorldState,
  head: string,
  args: string[],
  ctx: RootCtx = {},
): RootResult {
  switch (head as RootCommand) {
    case "su":
      return ctx.cron ? say(tr("su: not from cron.")) : cmdSu(s, args);
    case "sysctl":
      return cmdSysctl(s, args, ctx);
    case "fw":
      return cmdFw(s, args, ctx);
    case "sensors":
      return cmdSensors(s);
    case "cron":
      return ctx.cron ? say(tr("cron: not from cron.")) : cmdCron(s, args, ctx);
    case "profile":
      return cmdProfile(s, args, ctx);
    case "audit":
      return cmdAudit(s, args);
    case "rescue":
      return ctx.cron ? say(tr("rescue: not from cron.")) : cmdRescue(s, args);
    default:
      return say(tr("{cmd}: not a root command.", { cmd: head }));
  }
}

/** Run a whole line (`head args…`); null when the head is no root command. */
export function runRootLine(s: WorldState, line: string, ctx: RootCtx = {}): RootResult | null {
  const [head, ...args] = line.trim().split(/\s+/);
  if (!head || !(ROOT_COMMANDS as readonly string[]).includes(head.toLowerCase())) return null;
  return runRoot(s, head.toLowerCase(), args, ctx);
}

/** One-line help per root command (terminal-lite `help`, Main Console `root help`). */
export function rootHelp(): { name: RootCommand; help: string; usage: string; ring: Ring }[] {
  return [
    {
      name: "su",
      help: tr("climb an access ring (operator → wheel → root → kernel)"),
      usage: tr("su [operator|wheel|root|kernel]"),
      ring: 0,
    },
    {
      name: "sysctl",
      help: tr("the lab's tunables: power, research, drones, aging"),
      usage: tr("sysctl [-a | <key> | <key>=<value> | reset <key|all>]"),
      ring: 0,
    },
    {
      name: "fw",
      help: tr("firmware tuning: clock and voltage per device"),
      usage: tr("fw [list | <ID> | <ID> <clock> [volt] [--dry] | <ID> profile|autotune|reset]"),
      ring: 0,
    },
    {
      name: "sensors",
      help: tr("heat, thermal limits and kernel load"),
      usage: "sensors",
      ring: 0,
    },
    {
      name: "cron",
      help: tr("jobs that run on their own, with guards"),
      usage: tr("cron [list | add <s> [when <metric><op><n>] <cmd> | rm <id>]"),
      ring: 0,
    },
    {
      name: "profile",
      help: tr("save, load and share whole tunings"),
      usage: tr("profile [list | save|load|rm|show|export <name> | import <name> <code>]"),
      ring: 0,
    },
    {
      name: "audit",
      help: tr("who changed what in the system, when"),
      usage: tr("audit [n]"),
      ring: 0,
    },
    {
      name: "rescue",
      help: tr("factory curves for everything (safety net)"),
      usage: "rescue --yes",
      ring: 0,
    },
  ];
}
