/**
 * Resonance protocol types
 * ========================
 *
 * Resonance protocols are hidden device-action sequences that produce
 * rare rewards when triggered in real-time within a time window.
 * Discoverable through experimentation or lore clues in the virtual
 * filesystem.
 *
 * Framework-agnostic — safe to import from both client and server.
 */

import type { StepReward } from "@/lib/game/quests/types";

// ── Rarity ────────────────────────────────────────────────────────────

export type ResonanceRarity = "uncommon" | "rare" | "legendary";

export const RARITY_LABELS: Record<ResonanceRarity, string> = {
  uncommon: "UNCOMMON",
  rare: "RARE",
  legendary: "LEGENDARY",
};

export const RARITY_COLORS: Record<ResonanceRarity, string> = {
  uncommon: "text-green-400",
  rare: "text-purple-400",
  legendary: "text-yellow-400",
};

// ── Protocol step conditions ──────────────────────────────────────────

export type ResonanceStepKind =
  | "device_state" // device must be in a specific state (powered, mode, etc.)
  | "device_param" // device parameter must match a value
  | "command" // terminal command must be executed
  | "resource_level" // resource must be at a threshold
  | "thermal_zone"; // thermal system must be in a zone

export interface ResonanceStep {
  /** What kind of condition this step checks. */
  kind: ResonanceStepKind;
  /** Device ID (e.g. "HMS-001") for device_state and device_param kinds. */
  deviceId?: string;
  /** Parameter name for device_param kind (e.g. "frequency", "pulseValue"). */
  param?: string;
  /** Command string for command kind (e.g. "qbridge sync"). */
  command?: string;
  /** Condition expression (e.g. "== 37", ">= 80", "== sine", "active"). */
  condition: string;
  /** Human-readable description of what this step requires. */
  description: string;
}

// ── Protocol definition ───────────────────────────────────────────────

export interface ResonanceProtocol {
  /** Stable id for persistence (e.g. "HARMONIC-7"). */
  id: string;
  /** Display codename (e.g. "Harmonic Convergence"). */
  codename: string;
  /** Full description, revealed only after discovery. */
  description: string;
  /** Cryptic clue placed in filesystem or voice lines. */
  loreClue: string;
  /** Where the lore clue can be found (filesystem path or voice). */
  loreLocation: string;
  /** Ordered list of conditions that must all be true within the window. */
  sequence: ResonanceStep[];
  /** Time window in seconds within which all steps must be satisfied. */
  windowSec: number;
  /** Rewards applied on first discovery. */
  rewards: StepReward[];
  /** Quest flag set on discovery (also used as the discovery id). */
  discoveryFlag: string;
  /** If true, rewards are only granted on first discovery. */
  repeatable: boolean;
  /** Rarity tier for display purposes. */
  rarity: ResonanceRarity;
}

// ── State event buffer ────────────────────────────────────────────────

export interface StateEvent {
  /** Timestamp (epoch ms) when the event occurred. */
  timestamp: number;
  /** What kind of state change this represents. */
  kind: ResonanceStepKind;
  /** Device ID if applicable. */
  deviceId?: string;
  /** Parameter name if applicable. */
  param?: string;
  /** Command string if applicable. */
  command?: string;
  /** Current value (string-coerced for uniform comparison). */
  value: string;
}

// ── Evaluation result ─────────────────────────────────────────────────

export interface ResonanceMatch {
  /** Protocol that was matched. */
  protocolId: string;
  /** Whether this is the first time the player matched it. */
  isFirstDiscovery: boolean;
  /** Rewards to apply. */
  rewards: StepReward[];
}
