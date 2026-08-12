-- ============================================================
-- Staking (on-chain layer, step 2 — roadmap phase 6)
-- ============================================================
-- Single-pot staking on the long-reserved balances.staked column.
-- Mechanics: stake moves available→staked and (re)starts a 7-day
-- lock; unstake moves staked→available after the lock expires;
-- rewards accrue at 0.5% of the staked amount per full day and are
-- paid from the deflationary reserve (new source 'staking') on claim.
-- All mutations are SECURITY DEFINER RPCs keyed on auth.uid() —
-- staking_state has no client write policies, so lock timestamps and
-- claim anchors cannot be forged.

create table if not exists public.staking_state (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  lock_until    timestamptz,
  last_claim_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.staking_state enable row level security;

drop policy if exists "Users can view own staking state" on public.staking_state;
create policy "Users can view own staking state"
  on public.staking_state
  for select
  using (auth.uid() = user_id);

-- Allow 'staking' as a reserve source (mirrored in lib/game/economy.ts).
create or replace function public.is_allowed_reserve_source(p_source text)
returns boolean
language sql
immutable
as $$
  select p_source in (
    'achievement',
    'starter_pack',
    'quest_reward',
    'tutorial_skip',
    'event',
    'test',
    'daily',
    'staking'
  );
$$;

create or replace function public.unsc_stake(p_amount numeric)
returns table (
  success       boolean,
  new_available numeric,
  new_staked    numeric,
  lock_until    timestamptz,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_available numeric;
  v_staked    numeric;
  v_lock      timestamptz;
begin
  if v_uid is null then
    return query select false, 0::numeric, 0::numeric, null::timestamptz, 'unauthorized'::text;
    return;
  end if;
  if p_amount is null or p_amount <= 0 then
    return query select false, 0::numeric, 0::numeric, null::timestamptz, 'invalid_amount'::text;
    return;
  end if;

  select available, staked into v_available, v_staked
    from balances where user_id = v_uid for update;
  if not found then
    return query select false, 0::numeric, 0::numeric, null::timestamptz, 'not_found'::text;
    return;
  end if;
  if v_available < p_amount then
    return query select false, v_available, v_staked, null::timestamptz, 'insufficient_funds'::text;
    return;
  end if;

  -- Settle the claim anchor BEFORE the stake grows: rewards accrued on
  -- the old amount are not retroactively boosted by the new deposit.
  -- (Any unclaimed full-day rewards should be claimed first; the TS
  -- action surfaces that.)
  insert into staking_state (user_id, lock_until, last_claim_at)
  values (v_uid, now() + interval '7 days', now())
  on conflict (user_id) do update
    set lock_until = now() + interval '7 days',
        last_claim_at = case
          when (select b.staked from balances b where b.user_id = v_uid) = 0 then now()
          else staking_state.last_claim_at
        end,
        updated_at = now();

  update balances
     set available = v_available - p_amount,
         staked    = v_staked + p_amount,
         updated_at = now()
   where user_id = v_uid;

  insert into transactions (user_id, type, amount, description)
  values (v_uid, 'stake', -p_amount, 'stake:' || p_amount);

  select s.lock_until into v_lock from staking_state s where s.user_id = v_uid;
  return query select true, v_available - p_amount, v_staked + p_amount, v_lock, null::text;
end;
$$;

create or replace function public.unsc_unstake(p_amount numeric)
returns table (
  success       boolean,
  new_available numeric,
  new_staked    numeric,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_available numeric;
  v_staked    numeric;
  v_lock      timestamptz;
begin
  if v_uid is null then
    return query select false, 0::numeric, 0::numeric, 'unauthorized'::text;
    return;
  end if;
  if p_amount is null or p_amount <= 0 then
    return query select false, 0::numeric, 0::numeric, 'invalid_amount'::text;
    return;
  end if;

  select s.lock_until into v_lock from staking_state s where s.user_id = v_uid for update;
  if v_lock is not null and v_lock > now() then
    return query select false, 0::numeric, 0::numeric, 'locked'::text;
    return;
  end if;

  select available, staked into v_available, v_staked
    from balances where user_id = v_uid for update;
  if not found then
    return query select false, 0::numeric, 0::numeric, 'not_found'::text;
    return;
  end if;
  if v_staked < p_amount then
    return query select false, v_available, v_staked, 'insufficient_staked'::text;
    return;
  end if;

  update balances
     set available = v_available + p_amount,
         staked    = v_staked - p_amount,
         updated_at = now()
   where user_id = v_uid;

  insert into transactions (user_id, type, amount, description)
  values (v_uid, 'unstake', p_amount, 'unstake:' || p_amount);

  return query select true, v_available + p_amount, v_staked - p_amount, null::text;
end;
$$;

-- Claim staking rewards: 0.5% of the staked amount per FULL elapsed
-- day since last_claim_at, reserve-funded (strictly deflationary).
create or replace function public.stake_claim_rewards()
returns table (
  success       boolean,
  reward        numeric,
  days_settled  integer,
  new_available numeric,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_staked numeric;
  v_anchor timestamptz;
  v_days   integer;
  v_reward numeric;
  v_award  record;
begin
  if v_uid is null then
    return query select false, 0::numeric, 0, 0::numeric, 'unauthorized'::text;
    return;
  end if;

  select last_claim_at into v_anchor
    from staking_state where user_id = v_uid for update;
  if not found then
    return query select false, 0::numeric, 0, 0::numeric, 'nothing_staked'::text;
    return;
  end if;

  select staked into v_staked from balances where user_id = v_uid;
  if coalesce(v_staked, 0) <= 0 then
    return query select false, 0::numeric, 0, 0::numeric, 'nothing_staked'::text;
    return;
  end if;

  v_days := floor(extract(epoch from (now() - v_anchor)) / 86400)::integer;
  if v_days < 1 then
    return query select false, 0::numeric, 0, 0::numeric, 'nothing_accrued'::text;
    return;
  end if;

  v_reward := floor(v_staked * 0.005 * v_days);
  if v_reward < 1 then
    return query select false, 0::numeric, v_days, 0::numeric, 'nothing_accrued'::text;
    return;
  end if;

  select * into v_award
    from public.reserve_burn_and_award(
      v_uid, v_reward, 'staking',
      'stake:' || to_char(now(), 'YYYY-MM-DD') || ':' || v_days
    );
  if v_award.success is not true then
    return query select false, 0::numeric, v_days, 0::numeric,
      coalesce(v_award.error_message, 'award_failed');
    return;
  end if;

  -- Advance the anchor by exactly the settled days, keeping the
  -- fractional remainder accruing.
  update staking_state
     set last_claim_at = last_claim_at + make_interval(days => v_days),
         updated_at = now()
   where user_id = v_uid;

  return query select true, v_reward, v_days, v_award.new_user_balance, null::text;
end;
$$;

grant execute on function public.unsc_stake(numeric) to authenticated;
grant execute on function public.unsc_unstake(numeric) to authenticated;
grant execute on function public.stake_claim_rewards() to authenticated;
