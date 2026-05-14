-- ============================================================================
-- Workstream 6: Tech tree + research jobs
-- ============================================================================
--
-- The Nexus (NXS-01) gates research. Each research "job" is a timer on a
-- tech-tree node; completion credits the node's effects (flags, resource
-- rates, capacities, new recipes via unlockRequires).
--
-- Tables:
--   research_jobs          — one row per queued/active/claimed research
--                            (only one can be active at a time in MVP)
--   profiles.tech_tree_state — JSONB: { unlocked: string[], inProgress: string? }
--

create table if not exists public.research_jobs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  node_id       text not null,
  started_at    timestamptz not null default now(),
  completes_at  timestamptz not null,
  claimed_at    timestamptz,
  cancelled_at  timestamptz,
  constraint research_job_single_resolution
    check (claimed_at is null or cancelled_at is null)
);

comment on table public.research_jobs is
  'Single pending research job per user (MVP). Claim on completion credits the node effects server-side.';

-- Hot path: the provider polls for the active (not yet resolved) job.
create index if not exists idx_research_active
  on public.research_jobs (user_id)
  where claimed_at is null and cancelled_at is null;

create index if not exists idx_research_user_recent
  on public.research_jobs (user_id, started_at desc);

alter table public.research_jobs enable row level security;

-- `drop ... if exists` wraps keep this migration idempotent so the
-- self-heal re-run can replay it without "policy already exists".
drop policy if exists "Users can read own research jobs" on public.research_jobs;
create policy "Users can read own research jobs"
  on public.research_jobs for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own research jobs" on public.research_jobs;
create policy "Users can insert own research jobs"
  on public.research_jobs for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own research jobs" on public.research_jobs;
create policy "Users can update own research jobs"
  on public.research_jobs for update using (auth.uid() = user_id);

-- Tech tree state on profiles.
alter table public.profiles
  add column if not exists tech_tree_state jsonb not null default
    '{"unlocked": [], "inProgress": null}'::jsonb;

comment on column public.profiles.tech_tree_state is
  'Tech-tree state blob: {unlocked:string[], inProgress:string|null}. Authoritative on claim; client mirrors optimistically.';
