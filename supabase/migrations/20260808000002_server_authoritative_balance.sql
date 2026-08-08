-- ============================================================
-- Server-authoritative balance mutations
-- ============================================================
-- The UPDATE policy from 20260521000001 made burnUnsc()/earnUnsc()
-- work under the caller's JWT — but it also let any client set its
-- own `balances` row to an arbitrary value with the anon key. The
-- economy was server-authoritative by convention only.
--
-- This migration moves both mutations into SECURITY DEFINER RPCs
-- whose identity comes exclusively from auth.uid() (no p_user_id to
-- spoof), then drops the broad UPDATE policy. After this:
--
--   - burns:  unsc_burn()  — self-service (spending down is not an
--             attack vector), typed against the transaction_type enum
--   - earns:  unsc_earn()  — dev-gated (profiles.is_dev), mirroring
--             the TS-side gate in grantDevUnsc; every player-facing
--             earn goes through reserve_burn_and_award instead
--   - direct UPDATE on balances: denied for clients
--
-- Ledger sign convention follows invest_in_research: spends are
-- logged with negative amounts, credits positive. (Rows written by
-- the old TS burn path were positive; new burn rows are negative.)

create or replace function public.unsc_burn(
  p_amount      numeric,
  p_type        text,
  p_description text default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns table (
  success       boolean,
  new_available numeric,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_available   numeric;
  v_total_spent numeric;
begin
  if v_uid is null then
    return query select false, 0::numeric, 'unauthorized'::text;
    return;
  end if;
  if p_amount is null or p_amount <= 0 then
    return query select false, 0::numeric, 'invalid_amount'::text;
    return;
  end if;
  if p_type is null or p_type not in ('burn', 'research', 'fee', 'stake', 'trade') then
    return query select false, 0::numeric, 'invalid_type'::text;
    return;
  end if;

  select available, total_spent
    into v_available, v_total_spent
    from balances
   where user_id = v_uid
     for update;

  if not found then
    return query select false, 0::numeric, 'not_found'::text;
    return;
  end if;
  if v_available < p_amount then
    return query select false, v_available, 'insufficient_funds'::text;
    return;
  end if;

  update balances
     set available   = v_available - p_amount,
         total_spent = v_total_spent + p_amount,
         updated_at  = now()
   where user_id = v_uid;

  insert into transactions (user_id, type, amount, description, metadata)
  values (v_uid, p_type::transaction_type, -p_amount, p_description, coalesce(p_metadata, '{}'::jsonb));

  return query select true, v_available - p_amount, null::text;
end;
$$;

create or replace function public.unsc_earn(
  p_amount      numeric,
  p_type        text,
  p_description text default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns table (
  success       boolean,
  new_available numeric,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_is_dev       boolean;
  v_available    numeric;
  v_total_earned numeric;
begin
  if v_uid is null then
    return query select false, 0::numeric, 'unauthorized'::text;
    return;
  end if;

  select is_dev into v_is_dev from profiles where id = v_uid;
  if coalesce(v_is_dev, false) is not true then
    return query select false, 0::numeric, 'forbidden'::text;
    return;
  end if;

  if p_amount is null or p_amount <= 0 then
    return query select false, 0::numeric, 'invalid_amount'::text;
    return;
  end if;
  if p_type is null or p_type not in ('mint', 'reward') then
    return query select false, 0::numeric, 'invalid_type'::text;
    return;
  end if;

  select available, total_earned
    into v_available, v_total_earned
    from balances
   where user_id = v_uid
     for update;

  if not found then
    insert into balances (user_id, available, total_earned)
    values (v_uid, p_amount, p_amount)
    returning available into v_available;
  else
    v_available := v_available + p_amount;
    update balances
       set available    = v_available,
           total_earned = v_total_earned + p_amount,
           updated_at   = now()
     where user_id = v_uid;
  end if;

  insert into transactions (user_id, type, amount, description, metadata)
  values (v_uid, p_type::transaction_type, p_amount, p_description, coalesce(p_metadata, '{}'::jsonb));

  return query select true, v_available, null::text;
end;
$$;

grant execute on function public.unsc_burn(numeric, text, text, jsonb) to authenticated;
grant execute on function public.unsc_earn(numeric, text, text, jsonb) to authenticated;

-- With both mutations behind RPCs, clients no longer need (and must
-- no longer have) direct UPDATE on balances.
drop policy if exists "Users can update own balance" on public.balances;
