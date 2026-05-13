-- ============================================================================
-- Tutorial difficulty + overlay step
-- ============================================================================
--
-- Extends the tutorial_state JSONB shape with two new fields:
--   - difficulty:        "easy" | "hard" | null  (null = not yet chosen)
--   - overlayStepIndex:  number                  (easy-mode step pointer)
--
-- Easy mode shows an interactive overlay walking the player through commands.
-- Hard mode surfaces hints immediately + exposes a `guide` terminal command.
-- The picker modal prompts at first launch when difficulty is null.
--
-- This migration updates the column DEFAULT for new profiles. Existing rows
-- remain untouched; `hydrateTutorialState()` fills in the missing fields on
-- read, so old saves keep working without a backfill.
--
-- It also defensively re-creates the `tutorial_state` column itself with
-- ADD COLUMN IF NOT EXISTS, so any installs that somehow missed the original
-- 20260424000001_tutorial_state.sql (e.g. desktop builds that skipped app
-- migrations on subsequent launches before the migrator was upgraded) get
-- unstuck automatically.

alter table public.profiles
  add column if not exists tutorial_state jsonb not null default
    '{"completed": false, "skipped": false, "currentPhase": 0, "welcomeBackAckAt": null, "difficulty": null, "overlayStepIndex": 0}'::jsonb;

alter table public.profiles
  alter column tutorial_state set default
    '{"completed": false, "skipped": false, "currentPhase": 0, "welcomeBackAckAt": null, "difficulty": null, "overlayStepIndex": 0}'::jsonb;

comment on column public.profiles.tutorial_state is
  'Hard-skippable tutorial progression state. Shape: {completed,skipped,currentPhase,welcomeBackAckAt,difficulty,overlayStepIndex}.';
