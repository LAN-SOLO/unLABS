-- ============================================================================
-- Workstream 1: Tutorial state
-- ============================================================================
--
-- Adds the `tutorial_state` JSONB blob to profiles. Drives the hard-skippable
-- onboarding flow and is read by the `tutorial` terminal command plus the
-- WelcomeBackModal.
--
-- Shape (see lib/game/tutorial/types.ts):
--   {
--     "completed":    boolean,   -- player finished the guided flow
--     "skipped":      boolean,   -- player chose to hard-skip
--     "currentPhase": 0|1|2|3|4|5,
--     "welcomeBackAckAt": string | null  -- ISO timestamp of last modal dismissal
--   }
--
-- Subsequent workstreams (achievements, tech-tree, packs) add their own tables
-- in separate migrations. This one intentionally stays minimal.
--

alter table public.profiles
  add column if not exists tutorial_state jsonb not null default
    '{"completed": false, "skipped": false, "currentPhase": 0, "welcomeBackAckAt": null}'::jsonb;

comment on column public.profiles.tutorial_state is
  'Hard-skippable tutorial progression state. Shape: {completed,skipped,currentPhase,welcomeBackAckAt}.';
