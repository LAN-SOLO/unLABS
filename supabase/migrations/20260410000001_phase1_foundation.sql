-- Phase 1 Foundation: idle-loop save, quest state, dev flag, corrected starter bonus
-- ==================================================================================
-- Adds the persistence surfaces required for:
--   1. Whole-blob player saves (PanelSaveData) synced from the client tick engine
--   2. Episode/quest state machine (EP0..EP6)
--   3. Offline progress calculation via last_tick_at
--   4. Developer area gated by profiles.is_dev
--   5. Corrected 120 _unSC starter bonus (docs: ECO/cold start) — trigger was 100

-- ---------- profiles: dev flag, episode, quest state, last tick ----------

alter table public.profiles
  add column if not exists is_dev boolean not null default false,
  add column if not exists current_episode text not null default 'EP0',
  add column if not exists quest_state jsonb not null default '{}'::jsonb,
  add column if not exists last_tick_at timestamptz;

-- ---------- player_saves: one blob per user (PanelSaveData shape) ----------

create table if not exists public.player_saves (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

create policy "Users can view own save"
  on public.player_saves for select
  using (auth.uid() = user_id);

create policy "Users can insert own save"
  on public.player_saves for insert
  with check (auth.uid() = user_id);

create policy "Users can update own save"
  on public.player_saves for update
  using (auth.uid() = user_id);

create trigger set_updated_at before update on public.player_saves
  for each row execute procedure public.handle_updated_at();

-- ---------- handle_new_user: corrected starter + username/display_name hydration ----------

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_username text := nullif(new.raw_user_meta_data->>'username', '');
  v_display_name text := coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), v_username);
begin
  -- Create profile with username/display_name pulled from signUp metadata
  insert into public.profiles (id, username, display_name, last_tick_at)
  values (new.id, v_username, v_display_name, now())
  on conflict (id) do nothing;

  -- Create balance record with the documented 120 _unSC cold-start bonus
  insert into public.balances (user_id, available, total_earned)
  values (new.id, 120, 120)
  on conflict (user_id) do nothing;

  -- Initialize research progress for all tech trees (idempotent)
  insert into public.research_progress (user_id, tech_tree_id)
  select new.id, id from public.tech_trees
  on conflict (user_id, tech_tree_id) do nothing;

  -- Bootstrap empty save blob so the client has something to read on first load
  insert into public.player_saves (user_id, data)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;
