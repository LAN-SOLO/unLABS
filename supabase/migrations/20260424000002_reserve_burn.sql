-- ============================================================================
-- Workstream 3: Reserve pool + atomic burn-and-award RPC
-- ============================================================================
--
-- The _unSC economy is deflationary. New awards to players (achievements,
-- starter packs, quest rewards that aren't pure resource grants) do NOT
-- mint fresh currency — they draw from a finite system reserve, shrinking
-- total supply permanently over time.
--
-- Shape:
--   unsc_reserve         — single row, holds the global reserve pool
--   reserve_transactions — immutable audit log of burns + emits
--   reserve_burn_and_award(...) — atomic: deduct reserve, credit user,
--                                  log both transaction tables
--
-- The function is SECURITY DEFINER so it can touch tables the caller's
-- anon/auth role cannot (e.g. unsc_reserve has no public policies). An
-- auth.uid() check enforces that callers can only credit their own
-- account, and a source allow-list prevents arbitrary JSONB abuse.
--

-- ── Reserve pool (single row, system-owned) ─────────────────────────────
create table if not exists public.unsc_reserve (
  id             smallint primary key default 1 check (id = 1),
  available      numeric(20, 8) not null default 100000000
                 check (available >= 0),
  total_burned   numeric(20, 8) not null default 0,
  total_emitted  numeric(20, 8) not null default 0,
  updated_at     timestamptz not null default now()
);

comment on table public.unsc_reserve is
  'Single-row deflationary reserve. Awards to players draw from `available`, logged in reserve_transactions.';

insert into public.unsc_reserve (id) values (1) on conflict (id) do nothing;

-- ── Reserve transaction log (immutable audit) ──────────────────────────
create table if not exists public.reserve_transactions (
  id          bigserial primary key,
  type        text not null check (type in ('burn', 'emit')),
  amount      numeric(20, 8) not null check (amount > 0),
  user_id     uuid references public.profiles(id) on delete set null,
  source      text not null,
  source_ref  text,
  created_at  timestamptz not null default now()
);

comment on table public.reserve_transactions is
  'Append-only audit log of all reserve debits (burns/awards) and credits (emits).';

create index if not exists idx_reserve_tx_user
  on public.reserve_transactions (user_id) where user_id is not null;
create index if not exists idx_reserve_tx_source
  on public.reserve_transactions (source);
create index if not exists idx_reserve_tx_created
  on public.reserve_transactions (created_at desc);

-- ── RLS ────────────────────────────────────────────────────────────────
alter table public.unsc_reserve enable row level security;
alter table public.reserve_transactions enable row level security;

-- No public read of the reserve itself; surface values only through the
-- `reserve_status()` RPC below (dev-gated).
-- Users can view their own reserve transactions (for transparency).
create policy "Users can view own reserve transactions"
  on public.reserve_transactions
  for select
  using (auth.uid() = user_id);

-- ── Allowed sources (defense in depth) ──────────────────────────────────
-- The allow-list mirrors lib/game/economy.ts so a leaked anon key can't
-- attribute a reward to an unknown source tag.
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
    'test'
  );
$$;

-- ── Atomic burn-and-award RPC ──────────────────────────────────────────
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
declare
  v_reserve_after numeric;
  v_user_after    numeric;
  v_user_total_earned numeric;
begin
  -- Auth check: callers can only credit themselves. The service-role key
  -- bypasses auth.uid() to null, so direct server calls (if we add them
  -- later) would also fail this check — that's intentional: keep this RPC
  -- to user-initiated flows, and give admins a separate DEFINER function
  -- if needed.
  if auth.uid() is null or auth.uid() <> p_user_id then
    return query select false, 0::numeric, 0::numeric,
                 'unauthorized'::text;
    return;
  end if;

  if p_amount is null or p_amount <= 0 then
    return query select false, 0::numeric, 0::numeric,
                 'invalid_amount'::text;
    return;
  end if;

  if not public.is_allowed_reserve_source(p_source) then
    return query select false, 0::numeric, 0::numeric,
                 'source_not_allowed'::text;
    return;
  end if;

  -- Lock reserve row, debit.
  update public.unsc_reserve
    set available    = available - p_amount,
        total_burned = total_burned + p_amount,
        updated_at   = now()
    where id = 1 and available >= p_amount
    returning available into v_reserve_after;

  if v_reserve_after is null then
    return query select false, 0::numeric, 0::numeric,
                 'reserve_insufficient'::text;
    return;
  end if;

  -- Credit user (upsert-style: create balance if missing).
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

  -- Dual audit log.
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

comment on function public.reserve_burn_and_award is
  'Atomic: debit unsc_reserve, credit balances, append to both audit logs. SECURITY DEFINER + auth.uid() guard + source allow-list.';

grant execute on function public.reserve_burn_and_award(uuid, numeric, text, text) to authenticated;

-- ── Dev-only status helper ──────────────────────────────────────────────
-- Returns the reserve snapshot. Gated to is_dev=true profiles so regular
-- players don't see the system-level balance.
create or replace function public.reserve_status()
returns table (
  available     numeric,
  total_burned  numeric,
  total_emitted numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
      where id = auth.uid() and coalesce(is_dev, false) = true
  ) then
    raise exception 'forbidden';
  end if;
  return query
    select r.available, r.total_burned, r.total_emitted
    from public.unsc_reserve r
    where r.id = 1;
end;
$$;

grant execute on function public.reserve_status() to authenticated;
