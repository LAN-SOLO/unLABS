-- ============================================================
-- Security hardening (2026-10-02 review)
-- ============================================================
-- C2  credit_balance / deduct_balance accepted any p_amount: a player
--     could mint _unSC with credit_balance (any positive amount) or with
--     a NEGATIVE amount to deduct_balance. Both now reject non-positive
--     amounts, and credit_balance is narrowed to its only legitimate use
--     (rolling back a failed crystal mint): it can only refund a real,
--     recent, not-yet-refunded deduct_balance debit of the same amount,
--     tracked in a server-only ledger (balance_debits). EXECUTE stays
--     granted to `authenticated` because the server actions call these
--     RPCs with the user-session client.
-- C3  reserve_burn_and_award accepted caller-chosen amount + source,
--     including 'test' and 'staking'. 'test' is removed from the
--     allow-list (no production code path uses it), each call is capped
--     at 500 _unSC (largest legitimate payout is the 250 _unSC 30-day
--     streak milestone; mirrored in lib/game/economy.ts
--     RESERVE_AWARD_MAX_PER_CALL), and 'staking' is only reachable via
--     stake_claim_rewards() through a new internal function that clients
--     cannot execute (staking payouts scale with the staked amount, so a
--     flat cap would break them).
-- C4  The profiles UPDATE policy let a user set is_dev = true on their
--     own row. A BEFORE INSERT/UPDATE trigger now rejects is_dev changes
--     made by API users (anon / authenticated); service_role and direct
--     postgres sessions (scripts/make-dev.sh) are unaffected. The same
--     trigger clamps last_tick_at to now() so offline catch-up can't be
--     inflated by a future timestamp written straight through PostgREST.
-- Low handle_new_user() (SECURITY DEFINER) had no pinned search_path;
--     the cleanup_* retention functions were executable by anon /
--     authenticated.
-- ============================================================

-- ── C2. Server-only debit ledger ───────────────────────────────────────
create table if not exists public.balance_debits (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      numeric(20, 8) not null check (amount > 0),
  reason      text,
  created_at  timestamptz not null default now(),
  refunded_at timestamptz
);

comment on table public.balance_debits is
  'Debits made by deduct_balance(); credit_balance() may only refund an unrefunded row from the last 15 minutes. No client policies.';

create index if not exists idx_balance_debits_refundable
  on public.balance_debits (user_id, created_at desc)
  where refunded_at is null;

alter table public.balance_debits enable row level security;
revoke all on table public.balance_debits from anon, authenticated;
revoke all on sequence public.balance_debits_id_seq from anon, authenticated;

-- ── C2. deduct_balance: positive amounts only, record the debit ───────
CREATE OR REPLACE FUNCTION public.deduct_balance(
  p_user_id UUID,
  p_amount DECIMAL(18,6),
  p_reason TEXT DEFAULT 'deduction'
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance DECIMAL(18,6),
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance DECIMAL(18,6);
  v_new_balance DECIMAL(18,6);
  v_total_spent DECIMAL(18,6);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN QUERY SELECT false, 0::DECIMAL(18,6), 'Unauthorized'::TEXT;
    RETURN;
  END IF;

  SELECT available, total_spent INTO v_current_balance, v_total_spent
  FROM balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::DECIMAL(18,6), 'Balance record not found'::TEXT;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, 'Insufficient balance'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE balances
  SET
    available = v_new_balance,
    total_spent = v_total_spent + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'burn', -p_amount, p_reason);

  INSERT INTO balance_debits (user_id, amount, reason)
  VALUES (p_user_id, p_amount, p_reason);

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- ── C2. credit_balance: refund of a recent real debit only ────────────
CREATE OR REPLACE FUNCTION public.credit_balance(
  p_user_id UUID,
  p_amount DECIMAL(18,6),
  p_reason TEXT DEFAULT 'credit'
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance DECIMAL(18,6),
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debit_id BIGINT;
  v_current_balance DECIMAL(18,6);
  v_new_balance DECIMAL(18,6);
  v_total_spent DECIMAL(18,6);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN QUERY SELECT false, 0::DECIMAL(18,6), 'Unauthorized'::TEXT;
    RETURN;
  END IF;

  -- Only a real deduct_balance() debit of exactly this amount, made in
  -- the last 15 minutes and not yet refunded, can be credited back.
  SELECT id INTO v_debit_id
  FROM balance_debits
  WHERE user_id = p_user_id
    AND amount = p_amount
    AND refunded_at IS NULL
    AND created_at > NOW() - INTERVAL '15 minutes'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_debit_id IS NULL THEN
    RETURN QUERY SELECT false, 0::DECIMAL(18,6), 'No refundable debit'::TEXT;
    RETURN;
  END IF;

  SELECT available, total_spent INTO v_current_balance, v_total_spent
  FROM balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::DECIMAL(18,6), 'Balance record not found'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance + p_amount;

  UPDATE balances
  SET
    available = v_new_balance,
    total_spent = GREATEST(0, v_total_spent - p_amount),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE balance_debits SET refunded_at = NOW() WHERE id = v_debit_id;

  INSERT INTO transactions (user_id, type, amount, description, metadata)
  VALUES (
    p_user_id, 'reward', p_amount, p_reason,
    jsonb_build_object('source', 'refund', 'debit_id', v_debit_id)
  );

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- ── C3. Reserve source allow-list without 'test' ──────────────────────
create or replace function public.is_allowed_reserve_source(p_source text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_source in (
    'achievement',
    'starter_pack',
    'quest_reward',
    'tutorial_skip',
    'event',
    'daily',
    'staking'
  );
$$;

-- ── C3. Internal award (no client EXECUTE) ────────────────────────────
-- Same body as the 20260424000002 reserve_burn_and_award. Only other
-- SECURITY DEFINER functions (stake_claim_rewards) and the public
-- wrapper below call it.
create or replace function public.reserve_burn_and_award_internal(
  p_user_id  uuid,
  p_amount   numeric,
  p_source   text,
  p_ref      text default null
)
returns table (
  success           boolean,
  reserve_available numeric,
  new_user_balance  numeric,
  error_message     text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserve_after numeric;
  v_user_after    numeric;
  v_user_total_earned numeric;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return query select false, 0::numeric, 0::numeric, 'unauthorized'::text;
    return;
  end if;

  if p_amount is null or p_amount <= 0 then
    return query select false, 0::numeric, 0::numeric, 'invalid_amount'::text;
    return;
  end if;

  if not public.is_allowed_reserve_source(p_source) then
    return query select false, 0::numeric, 0::numeric, 'source_not_allowed'::text;
    return;
  end if;

  update public.unsc_reserve
    set available    = available - p_amount,
        total_burned = total_burned + p_amount,
        updated_at   = now()
    where id = 1 and available >= p_amount
    returning available into v_reserve_after;

  if v_reserve_after is null then
    return query select false, 0::numeric, 0::numeric, 'reserve_insufficient'::text;
    return;
  end if;

  select available, total_earned into v_user_after, v_user_total_earned
    from public.balances
    where user_id = p_user_id
    for update;

  if not found then
    insert into public.balances (user_id, available, total_earned)
      values (p_user_id, p_amount, p_amount)
      returning available into v_user_after;
  else
    v_user_after := v_user_after + p_amount;
    update public.balances
      set available    = v_user_after,
          total_earned = v_user_total_earned + p_amount,
          updated_at   = now()
      where user_id = p_user_id;
  end if;

  insert into public.reserve_transactions (type, amount, user_id, source, source_ref)
    values ('burn', p_amount, p_user_id, p_source, p_ref);
  insert into public.transactions (user_id, amount, type, description, metadata)
    values (
      p_user_id,
      p_amount,
      'reward'::transaction_type,
      'Reserve burn: ' || p_source,
      jsonb_build_object('source', 'reserve_burn', 'ref', coalesce(p_ref, ''), 'tag', p_source)
    );

  return query select true, v_reserve_after, v_user_after, null::text;
end;
$$;

revoke execute on function public.reserve_burn_and_award_internal(uuid, numeric, text, text)
  from public, anon, authenticated;

-- ── C3. Public award RPC: capped, no 'staking' ────────────────────────
create or replace function public.reserve_burn_and_award(
  p_user_id  uuid,
  p_amount   numeric,
  p_source   text,
  p_ref      text default null
)
returns table (
  success           boolean,
  reserve_available numeric,
  new_user_balance  numeric,
  error_message     text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return query select false, 0::numeric, 0::numeric, 'unauthorized'::text;
    return;
  end if;

  if p_amount is null or p_amount <= 0 then
    return query select false, 0::numeric, 0::numeric, 'invalid_amount'::text;
    return;
  end if;

  -- Mirrors RESERVE_AWARD_MAX_PER_CALL in lib/game/economy.ts.
  if p_amount > 500 then
    return query select false, 0::numeric, 0::numeric, 'amount_exceeds_cap'::text;
    return;
  end if;

  -- Staking payouts are computed server-side by stake_claim_rewards().
  if p_source = 'staking' or not public.is_allowed_reserve_source(p_source) then
    return query select false, 0::numeric, 0::numeric, 'source_not_allowed'::text;
    return;
  end if;

  return query
    select * from public.reserve_burn_and_award_internal(p_user_id, p_amount, p_source, p_ref);
end;
$$;

grant execute on function public.reserve_burn_and_award(uuid, numeric, text, text) to authenticated;

-- ── C3. stake_claim_rewards → internal award ──────────────────────────
-- Body identical to 20260812000002 except the award call.
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
    from public.reserve_burn_and_award_internal(
      v_uid, v_reward, 'staking',
      'stake:' || to_char(now(), 'YYYY-MM-DD') || ':' || v_days
    );
  if v_award.success is not true then
    return query select false, 0::numeric, v_days, 0::numeric,
      coalesce(v_award.error_message, 'award_failed');
    return;
  end if;

  update staking_state
     set last_claim_at = last_claim_at + make_interval(days => v_days),
         updated_at = now()
   where user_id = v_uid;

  return query select true, v_reward, v_days, v_award.new_user_balance, null::text;
end;
$$;

grant execute on function public.stake_claim_rewards() to authenticated;

-- ── C4. Guard privileged profile columns ──────────────────────────────
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_api_user boolean :=
    current_user in ('anon', 'authenticated')
    or coalesce(auth.role(), '') in ('anon', 'authenticated');
begin
  if v_api_user then
    if tg_op = 'INSERT' then
      if coalesce(new.is_dev, false) then
        raise exception 'is_dev can only be changed by an administrator'
          using errcode = '42501';
      end if;
    elsif new.is_dev is distinct from old.is_dev then
      raise exception 'is_dev can only be changed by an administrator'
        using errcode = '42501';
    end if;
  end if;

  -- Offline catch-up must never start from the future.
  if new.last_tick_at is not null and new.last_tick_at > now() then
    new.last_tick_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_privileged_columns();

-- ── Low. search_path + retention-function grants ──────────────────────
alter function public.handle_new_user() set search_path = public;

revoke execute on function public.cleanup_old_audit_logs(integer) from public, anon, authenticated;
revoke execute on function public.cleanup_command_history(integer) from public, anon, authenticated;
revoke execute on function public.cleanup_usage_logs(integer) from public, anon, authenticated;
revoke execute on function public.cleanup_volatility_snapshots(integer) from public, anon, authenticated;
revoke execute on function public.cleanup_syspref_audit(integer) from public, anon, authenticated;
revoke execute on function public.cleanup_all_retention() from public, anon, authenticated;
