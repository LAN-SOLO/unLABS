-- ============================================================================
-- Phase 5: Missions & Discoveries
-- ============================================================================
--
-- Adds the mission system (parallel to the quest/episode system) and a
-- server-authoritative discovery log for resonance protocols.
--
-- New columns:
--   profiles.mission_state — JSONB blob matching MissionPlayerState
--
-- New tables:
--   player_discoveries — one row per player per discovered resonance protocol
--

-- ── Extend profiles with mission state ────────────────────────────────

alter table public.profiles
  add column if not exists mission_state jsonb not null default '{}'::jsonb;

comment on column public.profiles.mission_state is
  'MissionPlayerState JSONB blob: activeMissionIds, completedMissionIds, objectiveProgress, discoveryLog, hintLevel, lastActivityAt';

-- ── Player discoveries ────────────────────────────────────────────────

create table if not exists public.player_discoveries (
  id         uuid        default uuid_generate_v4() primary key,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  discovery_id text      not null,
  discovered_at timestamptz not null default now(),
  metadata   jsonb       not null default '{}'::jsonb,

  constraint uq_player_discovery unique (user_id, discovery_id)
);

comment on table public.player_discoveries is
  'Server-authoritative log of resonance protocol discoveries. Enables leaderboards and first-discoverer tracking.';

-- Indexes for common queries
create index if not exists idx_player_discoveries_user
  on public.player_discoveries (user_id);

create index if not exists idx_player_discoveries_global
  on public.player_discoveries (discovery_id, discovered_at asc);

-- ── Row Level Security ────────────────────────────────────────────────

alter table public.player_discoveries enable row level security;

-- Players can read their own discoveries
create policy "Users can read own discoveries"
  on public.player_discoveries
  for select
  using (auth.uid() = user_id);

-- Players can insert their own discoveries
create policy "Users can insert own discoveries"
  on public.player_discoveries
  for insert
  with check (auth.uid() = user_id);

-- Public read access for leaderboard (first discoverers)
create policy "Public read for leaderboard"
  on public.player_discoveries
  for select
  using (true);
