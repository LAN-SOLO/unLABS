-- Phase 4 — Production jobs + recipe ledger
-- =========================================
-- Adds the server-authoritative production queue used by /lab.
--
-- Design notes:
--   - Jobs are "persistent timers". Started on the server with a completes_at
--     timestamp; the client polls for completion and calls claimJob once the
--     current wall clock passes completes_at.
--   - `status` is an enum-ish text ('pending' | 'claimed' | 'cancelled') so
--     we can migrate states later without altering the column.
--   - `recipe_id` is a plain text key that matches lib/game/recipes.ts. We
--     intentionally do NOT put it in a FK: recipes are code, not data.
--   - `metadata` is a JSONB blob for future extensions (quality roll,
--     crafter notes, anomaly seed). Empty by default.
--   - Cost is deducted at start time (burned to the transactions ledger),
--     output is applied on claim.
--
-- RLS: only the owning user can read/write their own jobs. No "admin view".

create table if not exists public.production_jobs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,

  recipe_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'cancelled')),

  started_at timestamptz not null default now(),
  completes_at timestamptz not null,
  claimed_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_production_jobs_user
  on public.production_jobs(user_id);

create index if not exists idx_production_jobs_user_status
  on public.production_jobs(user_id, status);

alter table public.production_jobs enable row level security;

create policy "Users can view own production jobs"
  on public.production_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own production jobs"
  on public.production_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own production jobs"
  on public.production_jobs for update
  using (auth.uid() = user_id);
