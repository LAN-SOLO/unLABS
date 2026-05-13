-- ============================================================================
-- Workstream 4: Achievements
-- ============================================================================
--
-- Server-authoritative achievement progress + unlock log. The client
-- optimistically renders unlock state (via AchievementProvider watching the
-- tick engine), but claiming a reward — which calls reserve_burn_and_award —
-- goes through a server action that re-verifies progress against DB state.
--
-- Tables:
--   achievement_progress  — current progress value per (user, achievement, tier)
--   achievement_unlocks   — one row per unlocked tier, claimed bit on each
--
-- Claim flow:
--   1. Client detects progress >= target in-memory, pushes a "pending claim"
--      toast with an action.
--   2. Server action validates progress, inserts achievement_unlocks row
--      (or flips reward_claimed), calls reserve_burn_and_award.
--   3. Client receives new balance, clears the toast.
--

create table if not exists public.achievement_progress (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null,
  tier           smallint not null check (tier between 1 and 3),
  progress       numeric(20, 8) not null default 0 check (progress >= 0),
  target         numeric(20, 8) not null check (target > 0),
  updated_at     timestamptz not null default now(),
  primary key (user_id, achievement_id, tier)
);

comment on table public.achievement_progress is
  'Per-(user, achievement, tier) progress snapshot. Updated optimistically from the client and re-verified on claim.';

create index if not exists idx_achievement_progress_user
  on public.achievement_progress (user_id);

create table if not exists public.achievement_unlocks (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  achievement_id  text not null,
  tier            smallint not null check (tier between 1 and 3),
  unlocked_at     timestamptz not null default now(),
  reward_claimed  boolean not null default false,
  claimed_at      timestamptz,
  primary key (user_id, achievement_id, tier)
);

comment on table public.achievement_unlocks is
  'One row per unlocked (user, achievement, tier). reward_claimed flips true after reserve_burn_and_award succeeds.';

create index if not exists idx_achievement_unlocks_user_unclaimed
  on public.achievement_unlocks (user_id) where reward_claimed = false;

-- ── RLS ────────────────────────────────────────────────────────────────
alter table public.achievement_progress enable row level security;
alter table public.achievement_unlocks  enable row level security;

create policy "Users can read own achievement progress"
  on public.achievement_progress for select using (auth.uid() = user_id);
create policy "Users can upsert own achievement progress"
  on public.achievement_progress for insert with check (auth.uid() = user_id);
create policy "Users can update own achievement progress"
  on public.achievement_progress for update using (auth.uid() = user_id);

create policy "Users can read own achievement unlocks"
  on public.achievement_unlocks for select using (auth.uid() = user_id);
-- Writes to achievement_unlocks go exclusively through the server-side
-- claim action (SECURITY DEFINER on the RPC). No public insert/update.
