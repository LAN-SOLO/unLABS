/**
 * The lab's sysctl registry (docs/ROOT-LAB.md § Tunables): every gameplay
 * constant a root player may change, with its default (the value the game
 * always had), the range per access ring and its cost. Optimising is never
 * free: pushing a tunable past its default adds kernel load — watts the
 * MCP-000 draws on top of its rating (`kernelLoad`), so every tweak is
 * paid for out of the same power budget the lab runs on.
 *
 * Pure (no game imports).
 */
import { tr } from "@/lib/i18n";
import type { Ring } from "@/lib/world/root/state";

export type TunableDomain = "power" | "research" | "drone" | "aging";

export interface Tunable {
  key: string;
  domain: TunableDomain;
  /** The value the game uses when nothing is set. */
  def: number;
  /** Lowest ring that may change it. */
  ring: Ring;
  /** Range for `ring`… */
  min: number;
  max: number;
  /** …and the wider range from ring 3 (kernel). */
  kmin: number;
  kmax: number;
  step: number;
  unit: string;
  /** Kernel load (W) at value `v` (0 at the default). */
  cost: (v: number) => number;
  /** What it does (English source string). */
  help: () => string;
}

const above = (def: number, perUnit: number) => (v: number) => Math.max(0, v - def) * perUnit;
const below = (def: number, perUnit: number) => (v: number) => Math.max(0, def - v) * perUnit;

export const TUNABLES: readonly Tunable[] = [
  {
    key: "power.uec.nominal",
    domain: "power",
    def: 150,
    ring: 2,
    min: 130,
    max: 175,
    kmin: 110,
    kmax: 200,
    step: 1,
    unit: "W",
    // No kernel load: the core itself runs hotter (it trips past its heat limit).
    cost: () => 0,
    help: () => tr("Nominal output of the Unstable Energy Core. Higher runs the core hotter."),
  },
  {
    key: "power.pwd.bonus",
    domain: "power",
    def: 20,
    ring: 2,
    min: 0,
    max: 32,
    kmin: 0,
    kmax: 45,
    step: 1,
    unit: "W",
    cost: above(20, 0.6),
    help: () => tr("Reactive-power compensation of PWD-001 fed back into the bus."),
  },
  {
    key: "power.battery.buffer",
    domain: "power",
    def: 40,
    ring: 2,
    min: 20,
    max: 60,
    kmin: 10,
    kmax: 80,
    step: 1,
    unit: "W",
    cost: above(40, 0.5),
    help: () => tr("Watts BAT-001 lends the grid. More buffer, more charge-controller load."),
  },
  {
    key: "research.cooldown",
    domain: "research",
    def: 90,
    ring: 1,
    min: 60,
    max: 180,
    kmin: 30,
    kmax: 240,
    step: 5,
    unit: "s",
    cost: below(90, 0.15),
    help: () => tr("Seconds per research cycle. Shorter cycles keep the scheduler busy."),
  },
  {
    key: "research.yield",
    domain: "research",
    def: 0,
    ring: 2,
    min: 0,
    max: 3,
    kmin: 0,
    kmax: 5,
    step: 1,
    unit: "pt",
    cost: above(0, 6),
    help: () => tr("Extra research points per cycle from deeper analysis passes."),
  },
  {
    key: "drone.cooldown",
    domain: "drone",
    def: 150,
    ring: 1,
    min: 90,
    max: 300,
    kmin: 45,
    kmax: 400,
    step: 5,
    unit: "s",
    cost: below(150, 0.08),
    help: () => tr("Seconds between drone flights. Shorter turnarounds need route planning."),
  },
  {
    key: "aging.grow.rate",
    domain: "aging",
    def: 1,
    ring: 1,
    min: 0.25,
    max: 3,
    kmin: 0,
    kmax: 6,
    step: 0.05,
    unit: "×",
    cost: above(1, 4),
    help: () => tr("Plant growth speed in lit, watered rooms (grow lights, nutrient pumps)."),
  },
  {
    key: "aging.dust.rate",
    domain: "aging",
    def: 1,
    ring: 1,
    min: 0,
    max: 2,
    kmin: 0,
    kmax: 4,
    step: 0.05,
    unit: "×",
    cost: below(1, 3),
    help: () => tr("How fast dust settles in dry rooms. Cleaner air means running the filters."),
  },
];

export const TUNABLE_BY_KEY: ReadonlyMap<string, Tunable> = new Map(
  TUNABLES.map((t) => [t.key, t]),
);

/** The range a ring may set (ring 3 gets the kernel range). */
export function rangeFor(t: Tunable, ring: Ring): [number, number] {
  return ring >= 3 ? [t.kmin, t.kmax] : [t.min, t.max];
}

/** Snap to the tunable's step (avoids float noise in saves). */
export function snap(t: Tunable, v: number): number {
  const s = Math.round(v / t.step) * t.step;
  return Math.round(s * 1000) / 1000;
}
