-- ============================================================
-- Kernel Recompile (prestige)
-- ============================================================
-- The long-horizon _unSC sink: burn 500 * 2^level to increment a
-- permanent prestige level; the client maps the level to a production
-- multiplier. The level lives in its own table with NO client write
-- policies — the only mutation path is the SECURITY DEFINER RPC below,
-- which burns and increments atomically (same integrity posture as
-- unsc_burn / reserve_burn_and_award; profiles JSONB blobs are
-- client-writable and therefore unsuitable for a paid level).

create table if not exists public.prestige_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  level       integer not null default 0 check (level >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.prestige_state enable row level security;

drop policy if exists "Users can view own prestige" on public.prestige_state;
create policy "Users can view own prestige"
  on public.prestige_state
  for select
  using (auth.uid() = user_id);
-- No INSERT/UPDATE policies: writes only via kernel_recompile().

create or replace function public.kernel_recompile()
returns table (
  success       boolean,
  new_level     integer,
  cost          numeric,
  new_available numeric,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_endgame     boolean;
  v_level       integer;
  v_cost        numeric;
  v_available   numeric;
  v_total_spent numeric;
begin
  if v_uid is null then
    return query select false, 0, 0::numeric, 0::numeric, 'unauthorized'::text;
    return;
  end if;

  -- Gate on EP4's endgame flag, read server-side from quest_state.
  select coalesce((quest_state->'flags'->>'ENDGAME_UNLOCKED')::boolean, false)
    into v_endgame
    from profiles
   where id = v_uid;
  if v_endgame is not true then
    return query select false, 0, 0::numeric, 0::numeric, 'endgame_locked'::text;
    return;
  end if;

  -- Current level (create the row on first recompile), locked.
  insert into prestige_state (user_id, level)
  values (v_uid, 0)
  on conflict (user_id) do nothing;

  select level into v_level
    from prestige_state
   where user_id = v_uid
     for update;

  if v_level >= 20 then
    return query select false, v_level, 0::numeric, 0::numeric, 'max_level'::text;
    return;
  end if;

  v_cost := 500 * power(2, v_level)::numeric;

  select available, total_spent
    into v_available, v_total_spent
    from balances
   where user_id = v_uid
     for update;

  if not found then
    return query select false, v_level, v_cost, 0::numeric, 'not_found'::text;
    return;
  end if;
  if v_available < v_cost then
    return query select false, v_level, v_cost, v_available, 'insufficient_funds'::text;
    return;
  end if;

  update balances
     set available   = v_available - v_cost,
         total_spent = v_total_spent + v_cost,
         updated_at  = now()
   where user_id = v_uid;

  insert into transactions (user_id, type, amount, description, metadata)
  values (
    v_uid,
    'burn'::transaction_type,
    -v_cost,
    'kernel:recompile:L' || (v_level + 1),
    jsonb_build_object('source', 'prestige', 'level', v_level + 1)
  );

  update prestige_state
     set level = v_level + 1,
         updated_at = now()
   where user_id = v_uid;

  return query select true, v_level + 1, v_cost, v_available - v_cost, null::text;
end;
$$;

grant execute on function public.kernel_recompile() to authenticated;
