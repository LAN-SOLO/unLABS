/**
 * Daily contract engine — pure functions only.
 * ============================================
 *
 * No IO, no React, no `Date.now()` in core logic: time is always passed in
 * as a parameter so client and server derive identical results and every
 * branch is deterministically testable.
 *
 * Selection model
 * ---------------
 * Each user gets 3 contracts per UTC day. Selection is deterministic via an
 * FNV-1a hash over `${userId}:${dayKey}:${slot}` and weighted by template
 * `weight`, drawing without replacement (no duplicates). Any party that
 * knows userId + dayKey — client or server — derives the same set, so the
 * server can independently verify what the client displays.
 *
 * Streak model
 * ------------
 * `streakCount` is incremented at CLAIM time (when the player completes and
 * claims a daily contract), not by `rollStreak`. `rollStreak` only evaluates
 * DECAY: it is called when the player shows up (login / panel load) and
 * decides whether the streak carried over from `dailyResetAt` (the last day
 * the player claimed) survives until `now`:
 *
 *   gap = whole UTC days between dailyResetAt and now
 *   gap <= 0  → same day: unchanged
 *   gap == 1  → consecutive day: streak continues (claim will do the +1)
 *   gap == 2  → one missed day: single grace day, streak survives
 *   gap  > 2  → streak lapsed:
 *                 - if streakInsuredUntil covers today → survives,
 *                   usedInsurance = true
 *                 - otherwise streakCount is halved (floor), broken = true
 *
 * A `dailyResetAt` of null means no streak history — nothing to decay.
 */

import type { TaskObjective } from "@/lib/game/missions/types";

import { DAILY_CONTRACT_TEMPLATES, type DailyContractTemplate } from "@/lib/game/daily/templates";

// ── Constants ─────────────────────────────────────────────────────────

/** Number of contracts offered per user per UTC day. */
export const CONTRACTS_PER_DAY = 3;

/** _unSC cost to reroll a rerollable contract. */
export const REROLL_COST = 5;

/** _unSC cost to buy streak insurance. */
export const STREAK_INSURANCE_COST = 15;

/** How many days a streak insurance purchase covers. */
export const STREAK_INSURANCE_DAYS = 7;

/** Bonus _unSC paid out when the streak reaches these counts. */
export const STREAK_MILESTONES: Record<number, number> = {
  3: 25,
  7: 75,
  30: 250,
};

// ── Day key ───────────────────────────────────────────────────────────

/**
 * Format a Date as a "YYYY-MM-DD" day key in UTC.
 */
export function utcDayKey(now: Date): string {
  const y = now.getUTCFullYear().toString().padStart(4, "0");
  const m = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = now.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Whole UTC days between two day keys (b - a). Both must be "YYYY-MM-DD".
 */
function dayKeyDiff(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

// ── Deterministic selection ───────────────────────────────────────────

/**
 * FNV-1a 32-bit hash. Stable across JS engines (no platform-dependent
 * behavior), which is what makes client/server agreement possible.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export interface DailyContract extends DailyContractTemplate {
  /** Globally unique per user-day: `${dayKey}:${templateId}`. */
  contractId: string;
  /** The UTC day this contract belongs to. */
  dayKey: string;
  /** Slot index (0..CONTRACTS_PER_DAY-1) the contract was drawn into. */
  slot: number;
}

/**
 * Deterministically select the user's contracts for a given day.
 *
 * Weighted draw without replacement: for each slot, hash
 * `${userId}:${dayKey}:${slot}` and map it into the cumulative weight of
 * the remaining templates. Same inputs always yield the same output.
 */
export function selectDailyContracts(userId: string, dayKey: string): DailyContract[] {
  const pool: DailyContractTemplate[] = [...DAILY_CONTRACT_TEMPLATES];
  const picked: DailyContract[] = [];

  const slots = Math.min(CONTRACTS_PER_DAY, pool.length);
  for (let slot = 0; slot < slots; slot++) {
    const totalWeight = pool.reduce((sum, t) => sum + Math.max(1, t.weight), 0);
    const roll = fnv1a(`${userId}:${dayKey}:${slot}`) % totalWeight;

    let cumulative = 0;
    let index = pool.length - 1; // fallback guards float-free exhaustion
    for (let i = 0; i < pool.length; i++) {
      cumulative += Math.max(1, pool[i].weight);
      if (roll < cumulative) {
        index = i;
        break;
      }
    }

    const template = pool[index];
    pool.splice(index, 1);
    picked.push({
      ...template,
      contractId: `${dayKey}:${template.id}`,
      dayKey,
      slot,
    });
  }

  return picked;
}

/**
 * Deterministic replacement for a rerolled slot. Drawn from the templates
 * NOT selected for this day (so a reroll always changes the contract),
 * salted with `reroll:` so it differs from the original slot draw. Client
 * and server derive the same replacement, which lets `claimContract`
 * validate a rerolled slot without storing the replacement anywhere.
 */
export function selectRerollReplacement(
  userId: string,
  dayKey: string,
  slot: number,
): DailyContract {
  const originalIds = new Set(selectDailyContracts(userId, dayKey).map((c) => c.id));
  const pool = DAILY_CONTRACT_TEMPLATES.filter((t) => !originalIds.has(t.id));

  const totalWeight = pool.reduce((sum, t) => sum + Math.max(1, t.weight), 0);
  const roll = fnv1a(`${userId}:${dayKey}:reroll:${slot}`) % totalWeight;

  let cumulative = 0;
  let index = pool.length - 1;
  for (let i = 0; i < pool.length; i++) {
    cumulative += Math.max(1, pool[i].weight);
    if (roll < cumulative) {
      index = i;
      break;
    }
  }

  const template = pool[index];
  return {
    ...template,
    contractId: `${dayKey}:${template.id}`,
    dayKey,
    slot,
  };
}

// ── Streak logic ──────────────────────────────────────────────────────

export interface StreakSnapshot {
  /** Current streak count (incremented at claim time, elsewhere). */
  streakCount: number;
  /** ISO timestamp or "YYYY-MM-DD" of the last claimed daily. Null = no history. */
  dailyResetAt: string | null;
  /** ISO timestamp or "YYYY-MM-DD" until which streak insurance is active. */
  streakInsuredUntil: string | null;
}

export interface StreakRollResult {
  streakCount: number;
  usedInsurance: boolean;
  broken: boolean;
}

/**
 * Best-effort day key from a stored string (ISO timestamp or "YYYY-MM-DD").
 * Returns null for unparseable values so corrupt data degrades gracefully.
 */
function toDayKey(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return utcDayKey(parsed);
}

/**
 * Evaluate streak decay at login/roll time. See the module header for the
 * full model. Pure and deterministic: `now` is always a parameter.
 */
export function rollStreak(prev: StreakSnapshot, now: Date): StreakRollResult {
  const unchanged: StreakRollResult = {
    streakCount: prev.streakCount,
    usedInsurance: false,
    broken: false,
  };

  // No history (or unparseable history) — nothing to decay.
  if (prev.dailyResetAt === null) return unchanged;
  const lastDay = toDayKey(prev.dailyResetAt);
  if (lastDay === null) return unchanged;

  const today = utcDayKey(now);
  const gap = dayKeyDiff(lastDay, today);

  // Same day (or clock skew into the past): unchanged.
  if (gap <= 0) return unchanged;
  // Consecutive day: streak continues; the +1 happens at claim time.
  if (gap === 1) return unchanged;
  // Exactly one missed day: grace day, streak survives.
  if (gap === 2) return unchanged;

  // gap > 2 — streak lapsed. Insurance saves it if it covers today.
  if (prev.streakInsuredUntil !== null) {
    const insuredUntil = toDayKey(prev.streakInsuredUntil);
    if (insuredUntil !== null && insuredUntil >= today) {
      return { streakCount: prev.streakCount, usedInsurance: true, broken: false };
    }
  }

  return {
    streakCount: Math.floor(prev.streakCount / 2),
    usedInsurance: false,
    broken: true,
  };
}

/**
 * Milestone bonus for reaching exactly `streakCount`, or null if this
 * count is not a milestone.
 */
export function milestoneFor(streakCount: number): number | null {
  return STREAK_MILESTONES[streakCount] ?? null;
}

// ── Re-exports for consumers ──────────────────────────────────────────

export type { DailyContractTemplate, TaskObjective };
