/**
 * Device interfaces — every device is used through its own faceplate.
 * ===================================================================
 *
 * A `DeviceUiSpec` describes one device's interface: its look (theme, face,
 * display font), its own pages of widgets (gauges, scopes, LED rows,
 * knobs, mode switches, action buttons …) and a boot sequence. The shell
 * (components/world/device-ui/DeviceInterface.tsx) renders the spec and
 * adds the shared pages every device has:
 *
 *   LINKS     — hubs only: connect, manage and switch other devices
 *   FIRMWARE  — installed image, features, update / rollback (FIRMWARE-SPEC)
 *   INFO      — archive entries on the device, readouts, insights ("Use")
 *   SERVICE   — build stages, tasks (puzzles), endings — the old device panel
 *
 * Values are functions of a `UiCtx` (live state, power, time, the device's
 * own settings), so readouts are real game data, not decoration. Settings
 * (knobs, switches, modes) are stored in `WorldState.tuning["<id>.<key>"]`.
 *
 * Specs are pure data + small pure functions (no React, no three) — the
 * renderer is in components/world/device-ui/.
 */
import type { PowerStatus } from "@/lib/world/game";
import type { WorldState } from "@/lib/world/types";

export interface UiCtx {
  s: WorldState;
  id: string;
  power: PowerStatus;
  online: boolean;
  /** Seconds since the interface opened (animation clock; frozen with reduced motion). */
  t: number;
  /** The device's own setting (`tuning["<id>.<key>"]`) or `fallback`. */
  get: (key: string, fallback?: number) => number;
}

/** A live value. */
export type Val<T> = T | ((c: UiCtx) => T);

export type Tone = "ok" | "warn" | "bad" | "info" | "off";

/** Built-in actions a button can trigger (handled by the shell). */
export type UiAction =
  | "use" // operateDevice: readout + insights (INFO)
  | "talk" // MCP dialogue
  | "workbench"
  | "salvage" // BTK-001
  | "drone" // EXD-001 launch
  | "fabricate" // P3D-001
  | "power" // open the power grid panel
  | "service" // jump to the SERVICE page
  | "hint"; // DGN-001 diagnosis

export type Widget =
  | {
      kind: "readout";
      label: string;
      value: Val<string | number>;
      unit?: string;
      digits?: number;
      tone?: Val<Tone>;
    }
  | {
      kind: "gauge";
      label: string;
      value: Val<number>;
      min: number;
      max: number;
      unit?: string;
      warn?: number;
      bad?: number;
    }
  | {
      kind: "bar";
      label: string;
      value: Val<number>;
      max: Val<number>;
      unit?: string;
      tone?: Val<Tone>;
    }
  | {
      kind: "leds";
      label?: string;
      items: readonly { label: string; on: Val<boolean>; tone?: Tone; blink?: boolean }[];
    }
  | {
      kind: "scope";
      label: string;
      /** Waveform y(x, t) in −1…1 for x in 0…1. */
      wave: (x: number, c: UiCtx) => number;
      color?: string;
      grid?: boolean;
    }
  | { kind: "spectrum"; label: string; bands: Val<readonly number[]>; color?: string }
  | {
      kind: "graph";
      label: string;
      /** Samples 0…1 (oldest first). */ series: Val<readonly number[]>;
      color?: string;
    }
  | {
      kind: "matrix";
      label: string;
      cols: number;
      rows: number;
      cell: (i: number, c: UiCtx) => number;
      color?: string;
    }
  | {
      kind: "radar";
      label: string;
      blips: Val<readonly { a: number; r: number; label?: string }[]>;
      sweep?: boolean;
    }
  | {
      kind: "dial";
      label: string;
      /** Needle angle in radians (0 = up). */ angle: Val<number>;
      marks?: readonly string[];
    }
  | { kind: "log"; label: string; lines: Val<readonly string[]>; max?: number }
  | { kind: "text"; text: Val<string>; tone?: Val<Tone> }
  | {
      kind: "knob";
      key: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      def: number;
      unit?: string;
    }
  | {
      kind: "slider";
      key: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      def: number;
      unit?: string;
    }
  | { kind: "switch"; key: string; label: string; def: 0 | 1 }
  | {
      kind: "mode";
      key: string;
      label: string;
      options: readonly { value: number; label: string }[];
      def: number;
    }
  | { kind: "button"; label: string; action: UiAction; hint?: string; disabled?: Val<boolean> }
  | { kind: "row"; widgets: readonly Widget[] };

export interface UiPage {
  id: string;
  label: string;
  widgets: readonly Widget[];
}

export type Face = "rack" | "console" | "handheld" | "cabinet" | "bench" | "reactor" | "terminal";
export type DisplayFont = "mono" | "lcd" | "vfd" | "nixie" | "crt";

export interface DeviceUiSpec {
  id: string;
  /** Model plate, e.g. "Crystal Data Cache · CDC-001 · rev B". */
  model: string;
  face: Face;
  font: DisplayFont;
  /** Accent (display glow) and faceplate colours. */
  accent: string;
  plate: string;
  /** Boot lines shown when the interface opens on an online device. */
  boot: readonly string[];
  /** The device's own pages (first = default). */
  pages: readonly UiPage[];
}
