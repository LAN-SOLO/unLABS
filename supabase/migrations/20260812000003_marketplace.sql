-- ============================================================
-- Crystal marketplace (on-chain layer, step 3 — roadmap phase 5)
-- ============================================================
-- Player-to-player crystal trading: the game's first cross-user
-- economy path. Listings are public reads; every mutation is a
-- SECURITY DEFINER RPC keyed on auth.uid(). market_buy is atomic:
-- buyer pays, seller receives price minus the 5% market fee, the fee
-- amount simply leaves circulation (deflationary — mirrored nowhere),
-- crystal ownership transfers, and both sides get 'trade' ledger rows
-- with counterparty attribution.

create table if not exists public.marketplace_listings (
  id         uuid primary key default uuid_generate_v4(),
  crystal_id uuid not null references public.crystals(id) on delete cascade,
  seller_id  uuid not null references auth.users(id) on delete cascade,
  buyer_id   uuid references auth.users(id),
  price      numeric(20, 8) not null check (price >= 1),
  status     text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);

-- One active listing per crystal.
create unique index if not exists idx_listings_active_crystal
  on public.marketplace_listings(crystal_id)
  where status = 'active';
create index if not exists idx_listings_status_created
  on public.marketplace_listings(status, created_at desc);

alter table public.marketplace_listings enable row level security;

drop policy if exists "Authenticated users can browse listings" on public.marketplace_listings;
create policy "Authenticated users can browse listings"
  on public.marketplace_listings
  for select
  using (auth.role() = 'authenticated');
-- No client write policies: RPCs only.

create or replace function public.market_list(p_crystal_id uuid, p_price numeric)
returns table (success boolean, listing_id uuid, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_id    uuid;
begin
  if v_uid is null then
    return query select false, null::uuid, 'unauthorized'::text; return;
  end if;
  if p_price is null or p_price < 1 or p_price > 1000000 then
    return query select false, null::uuid, 'invalid_price'::text; return;
  end if;

  select owner_id into v_owner from crystals where id = p_crystal_id for update;
  if not found then
    return query select false, null::uuid, 'crystal_not_found'::text; return;
  end if;
  if v_owner is distinct from v_uid then
    return query select false, null::uuid, 'not_owner'::text; return;
  end if;
  if exists (
    select 1 from marketplace_listings
     where crystal_id = p_crystal_id and status = 'active'
  ) then
    return query select false, null::uuid, 'already_listed'::text; return;
  end if;

  insert into marketplace_listings (crystal_id, seller_id, price)
  values (p_crystal_id, v_uid, p_price)
  returning id into v_id;

  return query select true, v_id, null::text;
end;
$$;

create or replace function public.market_unlist(p_listing_id uuid)
returns table (success boolean, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row marketplace_listings%rowtype;
begin
  if v_uid is null then
    return query select false, 'unauthorized'::text; return;
  end if;

  select * into v_row from marketplace_listings where id = p_listing_id for update;
  if not found then
    return query select false, 'not_found'::text; return;
  end if;
  if v_row.seller_id <> v_uid then
    return query select false, 'not_seller'::text; return;
  end if;
  if v_row.status <> 'active' then
    return query select false, 'not_active'::text; return;
  end if;

  update marketplace_listings
     set status = 'cancelled', closed_at = now()
   where id = p_listing_id;

  return query select true, null::text;
end;
$$;

create or replace function public.market_buy(p_listing_id uuid)
returns table (
  success       boolean,
  crystal_id    uuid,
  price         numeric,
  fee           numeric,
  new_available numeric,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_row            marketplace_listings%rowtype;
  v_fee            numeric;
  v_seller_credit  numeric;
  v_buyer_avail    numeric;
  v_buyer_spent    numeric;
  v_seller_avail   numeric;
  v_seller_earned  numeric;
begin
  if v_uid is null then
    return query select false, null::uuid, 0::numeric, 0::numeric, 0::numeric, 'unauthorized'::text;
    return;
  end if;

  select * into v_row from marketplace_listings where id = p_listing_id for update;
  if not found then
    return query select false, null::uuid, 0::numeric, 0::numeric, 0::numeric, 'not_found'::text;
    return;
  end if;
  if v_row.status <> 'active' then
    return query select false, null::uuid, 0::numeric, 0::numeric, 0::numeric, 'not_active'::text;
    return;
  end if;
  if v_row.seller_id = v_uid then
    return query select false, null::uuid, 0::numeric, 0::numeric, 0::numeric, 'own_listing'::text;
    return;
  end if;

  v_fee := floor(v_row.price * 0.05 * 100) / 100;
  v_seller_credit := v_row.price - v_fee;

  -- Lock both balance rows in a stable order (buyer first) to avoid
  -- deadlocks between concurrent purchases.
  select available, total_spent into v_buyer_avail, v_buyer_spent
    from balances where user_id = v_uid for update;
  if not found then
    return query select false, null::uuid, 0::numeric, 0::numeric, 0::numeric, 'not_found'::text;
    return;
  end if;
  if v_buyer_avail < v_row.price then
    return query select false, null::uuid, v_row.price, v_fee, v_buyer_avail, 'insufficient_funds'::text;
    return;
  end if;

  select available, total_earned into v_seller_avail, v_seller_earned
    from balances where user_id = v_row.seller_id for update;
  if not found then
    return query select false, null::uuid, 0::numeric, 0::numeric, 0::numeric, 'seller_missing'::text;
    return;
  end if;

  -- Verify the crystal still belongs to the seller (defensive: mint
  -- burns or admin moves could have raced the listing).
  if not exists (
    select 1 from crystals where id = v_row.crystal_id and owner_id = v_row.seller_id
  ) then
    update marketplace_listings set status = 'cancelled', closed_at = now()
     where id = p_listing_id;
    return query select false, null::uuid, 0::numeric, 0::numeric, 0::numeric, 'seller_no_longer_owner'::text;
    return;
  end if;

  update balances
     set available = v_buyer_avail - v_row.price,
         total_spent = v_buyer_spent + v_row.price,
         updated_at = now()
   where user_id = v_uid;

  update balances
     set available = v_seller_avail + v_seller_credit,
         total_earned = v_seller_earned + v_seller_credit,
         updated_at = now()
   where user_id = v_row.seller_id;

  update crystals set owner_id = v_uid, updated_at = now()
   where id = v_row.crystal_id;

  update marketplace_listings
     set status = 'sold', buyer_id = v_uid, closed_at = now()
   where id = p_listing_id;

  insert into transactions (user_id, type, amount, description, counterparty_id, crystal_id, metadata)
  values
    (v_uid, 'trade', -v_row.price, 'market:buy', v_row.seller_id, v_row.crystal_id,
     jsonb_build_object('listing_id', p_listing_id, 'fee', v_fee)),
    (v_row.seller_id, 'trade', v_seller_credit, 'market:sell', v_uid, v_row.crystal_id,
     jsonb_build_object('listing_id', p_listing_id, 'fee', v_fee));

  return query select true, v_row.crystal_id, v_row.price, v_fee, v_buyer_avail - v_row.price, null::text;
end;
$$;

grant execute on function public.market_list(uuid, numeric) to authenticated;
grant execute on function public.market_unlist(uuid) to authenticated;
grant execute on function public.market_buy(uuid) to authenticated;
