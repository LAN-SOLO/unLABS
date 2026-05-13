"use server";

/**
 * Tutorial server actions
 * =======================
 *
 * Reads and mutates `profiles.tutorial_state` + the quest spine used by the
 * onboarding flow. All mutations re-verify auth server-side; the client can
 * call these freely without leaking mutability for other players.
 *
 * Keeping tutorial logic separate from quest.ts lets the onboarding UX evolve
 * (hard-skip, resume, status surface) without churn on the episode engine.
 */

import { createClient } from "@/lib/supabase/server";
import {
  createInitialTutorialState,
  hydrateTutorialState,
  SKIP_FLAGS,
  SKIP_REWARDS,
  SKIPPED_EPISODE_ID,
  type TutorialState,
} from "@/lib/game/tutorial/types";
import type { QuestState, StepReward } from "@/lib/game/quests/types";

export interface TutorialStatusResult {
  ok: boolean;
  state: TutorialState | null;
  /** Current episode id; useful for `tutorial status` output. */
  episodeId: string | null;
  /** Step index within the active episode. */
  stepIndex: number | null;
  error?: string;
}

export async function getTutorialStatus(): Promise<TutorialStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      state: null,
      episodeId: null,
      stepIndex: null,
      error: "not_authenticated",
    };
  }

  const result = await supabase
    .from("profiles")
    .select("tutorial_state, current_episode, quest_state")
    .eq("id", user.id)
    .maybeSingle();

  let row = result.data as {
    tutorial_state: unknown;
    current_episode: string;
    quest_state: Record<string, unknown>;
  } | null;

  // Self-heal: if the auth user has no matching profile row (orphaned auth
  // user — happens with the desktop app's local Supabase when pgdata
  // persists across resets, or when the handle_new_user trigger didn't run
  // in this environment), insert a default profile here so the rest of the
  // app sees a consistent state without forcing the player back through a
  // re-signup. The default tutorial_state is the column DEFAULT, which our
  // migration already keeps in sync with `createInitialTutorialState()`.
  if (!row) {
    const defaultTutorial = createInitialTutorialState();
    const insertResult = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        tutorial_state: defaultTutorial as unknown as Record<string, unknown>,
      } as never)
      .select("tutorial_state, current_episode, quest_state")
      .maybeSingle();

    if (insertResult.error || !insertResult.data) {
      return {
        ok: false,
        state: null,
        episodeId: null,
        stepIndex: null,
        error: insertResult.error?.message ?? "profile_missing",
      };
    }
    row = insertResult.data as {
      tutorial_state: unknown;
      current_episode: string;
      quest_state: Record<string, unknown>;
    };
  }

  const state = hydrateTutorialState(row.tutorial_state);
  const quest = (row.quest_state ?? {}) as Partial<QuestState>;

  return {
    ok: true,
    state,
    episodeId: row.current_episode ?? null,
    stepIndex: typeof quest.currentStepIndex === "number" ? quest.currentStepIndex : null,
  };
}

export interface TutorialSkipResult {
  ok: boolean;
  state: TutorialState | null;
  /** Rewards the client should apply to GameTickProvider. */
  rewards: StepReward[];
  error?: string;
}

/**
 * Hard-skip the tutorial. Sets the skipped flag, fast-forwards the quest
 * spine to a sentinel episode id (which causes QuestOverlay to hide), and
 * returns the cumulative rewards EP0+EP1 would have granted so the client
 * can apply them to the tick engine in one shot.
 *
 * Idempotent: calling `skip` twice produces the same result without
 * double-granting resources — the caller is expected to only apply rewards
 * when `alreadySkipped=false`, which is surfaced via state.skipped being
 * already true before the call.
 */
export async function skipTutorial(): Promise<TutorialSkipResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, state: null, rewards: [], error: "not_authenticated" };
  }

  const existing = await getTutorialStatus();
  if (!existing.ok || !existing.state) {
    return { ok: false, state: null, rewards: [], error: existing.error ?? "load_failed" };
  }

  // Already skipped — no-op, no re-grants.
  if (existing.state.skipped) {
    return { ok: true, state: existing.state, rewards: [] };
  }

  const nextTutorial: TutorialState = {
    ...existing.state,
    skipped: true,
    completed: true,
    currentPhase: 5,
  };

  // Preserve any existing flags; overlay with skip flags so downstream
  // systems see EP0+EP1 as done.
  const currentFlags =
    existing.episodeId && existing.episodeId !== SKIPPED_EPISODE_ID
      ? await readQuestFlags(supabase, user.id)
      : {};

  const nextQuestState: QuestState = {
    episodeId: SKIPPED_EPISODE_ID,
    currentStepIndex: 0,
    completedStepIds: [],
    flags: { ...currentFlags, ...SKIP_FLAGS },
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      tutorial_state: nextTutorial as unknown as Record<string, unknown>,
      current_episode: SKIPPED_EPISODE_ID,
      quest_state: nextQuestState as unknown as Record<string, unknown>,
    } as never)
    .eq("id", user.id);

  if (error) {
    return { ok: false, state: null, rewards: [], error: error.message };
  }

  return { ok: true, state: nextTutorial, rewards: SKIP_REWARDS };
}

export interface TutorialResumeResult {
  ok: boolean;
  state: TutorialState | null;
  /** Episode id the player was returned to. */
  episodeId: string | null;
  error?: string;
}

/**
 * Un-skip and return to EP0 at step 0. Destructive for progress but gated by
 * the player's own consent — only they can resume their own tutorial.
 * Rewards are NOT rolled back (keeping an idle-sim economy clean would
 * require a full prestige/reset system, out of MVP scope).
 */
export async function resumeTutorial(): Promise<TutorialResumeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, state: null, episodeId: null, error: "not_authenticated" };
  }

  const nextTutorial: TutorialState = {
    ...createInitialTutorialState(),
    currentPhase: 0,
  };

  const nextQuestState: QuestState = {
    episodeId: "EP0",
    currentStepIndex: 0,
    completedStepIds: [],
    flags: {},
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      tutorial_state: nextTutorial as unknown as Record<string, unknown>,
      current_episode: "EP0",
      quest_state: nextQuestState as unknown as Record<string, unknown>,
    } as never)
    .eq("id", user.id);

  if (error) {
    return { ok: false, state: null, episodeId: null, error: error.message };
  }

  return { ok: true, state: nextTutorial, episodeId: "EP0" };
}

export interface TutorialAckResult {
  ok: boolean;
  error?: string;
}

/**
 * Record that the player has dismissed the Welcome-Back modal. Stored in
 * tutorial_state.welcomeBackAckAt so we can tell future-you "you've seen this
 * one, don't show again this session" without an extra table.
 */
export async function ackWelcomeBack(): Promise<TutorialAckResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const existing = await getTutorialStatus();
  if (!existing.ok || !existing.state) {
    return { ok: false, error: existing.error ?? "load_failed" };
  }

  const next: TutorialState = {
    ...existing.state,
    welcomeBackAckAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("profiles")
    .update({ tutorial_state: next as unknown as Record<string, unknown> } as never)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface SetDifficultyResult {
  ok: boolean;
  state: TutorialState | null;
  error?: string;
}

/**
 * Persist the player's chosen guidance difficulty. Called once from the
 * DifficultyPicker modal at first launch; can also be re-called if the
 * player switches modes from the settings panel later.
 */
export async function setTutorialDifficulty(
  difficulty: "easy" | "hard",
): Promise<SetDifficultyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, state: null, error: "not_authenticated" };

  const existing = await getTutorialStatus();
  if (!existing.ok || !existing.state) {
    return { ok: false, state: null, error: existing.error ?? "load_failed" };
  }

  const next: TutorialState = {
    ...existing.state,
    difficulty,
    // Easy mode starts the overlay at step 1; hard mode leaves it at 0 (off).
    overlayStepIndex: difficulty === "easy" ? 1 : 0,
  };

  const { error } = await supabase
    .from("profiles")
    .update({ tutorial_state: next as unknown as Record<string, unknown> } as never)
    .eq("id", user.id);

  if (error) return { ok: false, state: null, error: error.message };
  return { ok: true, state: next };
}

/**
 * Persist the player's progress through the easy-mode overlay. Steps are
 * driven by client state (mission progress) so we only save when the player
 * advances past a milestone, keeping write traffic minimal.
 */
export async function setOverlayStepIndex(stepIndex: number): Promise<SetDifficultyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, state: null, error: "not_authenticated" };

  const existing = await getTutorialStatus();
  if (!existing.ok || !existing.state) {
    return { ok: false, state: null, error: existing.error ?? "load_failed" };
  }

  const next: TutorialState = {
    ...existing.state,
    overlayStepIndex: Math.floor(stepIndex),
  };

  const { error } = await supabase
    .from("profiles")
    .update({ tutorial_state: next as unknown as Record<string, unknown> } as never)
    .eq("id", user.id);

  if (error) return { ok: false, state: null, error: error.message };
  return { ok: true, state: next };
}

async function readQuestFlags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Record<string, boolean>> {
  const result = await supabase
    .from("profiles")
    .select("quest_state")
    .eq("id", userId)
    .maybeSingle();
  const row = result.data as { quest_state: Record<string, unknown> } | null;
  const qs = (row?.quest_state ?? {}) as Partial<QuestState>;
  if (!qs.flags || typeof qs.flags !== "object") return {};
  return Object.fromEntries(
    Object.entries(qs.flags).filter(([, v]) => typeof v === "boolean") as Array<[string, boolean]>,
  );
}
