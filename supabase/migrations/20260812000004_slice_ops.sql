-- ============================================================
-- Slice manipulation (on-chain layer, roadmap phase 7)
-- ============================================================
-- MERGE / SPLIT / SWAP as SECURITY DEFINER RPCs, plus the RLS fix
-- that makes them meaningful: the old "manage slices of own
-- crystals" FOR ALL policy let a client UPDATE slice power directly
-- — harmless while crystals were cosmetic, value forgery now that
-- the marketplace prices them by total_power. Clients keep INSERT
-- (the mint flow writes slices under the user JWT, bounded by the
-- new power/position constraints); UPDATE/DELETE go through RPCs
-- only. update_crystal_stats() keeps total_power/slice_count fresh.
--
-- Economics: every operation burns _unSC via unsc_burn (fee sink),
-- merging retains 90% of the absorbed slice, splitting retains 95%
-- across both halves — manipulation always costs, so power is
-- shuffled and slowly ground down, never created.

-- ── Constraints (bound the remaining INSERT path) ──────────────────────
-- Mint writes ≤ 2.4 power per slice (era 64-bit × 1.2 variance); merges
-- can legitimately stack toward the whole-crystal sum (≤ ~72), so cap
-- at 100. One slice per position per crystal.
alter table public.slices
  add constraint slices_power_bounds check (power > 0 and power <= 100);
create unique index if not exists idx_slices_crystal_position
  on public.slices(crystal_id, position);

-- ── RLS: writes via RPC only (INSERT stays for the mint flow) ─────────
drop policy if exists "Users can manage slices of own crystals" on public.slices;
drop policy if exists "Users can insert slices of own crystals" on public.slices;
create policy "Users can insert slices of own crystals"
  on public.slices
  for insert
  with check (
    exists (
      select 1 from public.crystals c
       where c.id = crystal_id and c.owner_id = auth.uid()
    )
  );

-- ── Shared guard: caller owns the crystal and it is not listed ────────
create or replace function public.assert_slice_op_allowed(p_crystal_id uuid, p_uid uuid)
returns text
language plpgsql
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from crystals where id = p_crystal_id for update;
  if not found then return 'crystal_not_found'; end if;
  if v_owner is distinct from p_uid then return 'not_owner'; end if;
  if exists (
    select 1 from marketplace_listings
     where crystal_id = p_crystal_id and status = 'active'
  ) then
    return 'listed';
  end if;
  return null;
end;
$$;

create or replace function public.slice_merge(
  p_crystal_id uuid,
  p_pos_keep   int,
  p_pos_absorb int
)
returns table (success boolean, new_power numeric, fee numeric, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_guard  text;
  v_keep   slices%rowtype;
  v_absorb slices%rowtype;
  v_power  numeric;
  v_burn   record;
begin
  if v_uid is null then
    return query select false, 0::numeric, 0::numeric, 'unauthorized'::text; return;
  end if;
  if p_pos_keep = p_pos_absorb then
    return query select false, 0::numeric, 0::numeric, 'same_slice'::text; return;
  end if;

  v_guard := assert_slice_op_allowed(p_crystal_id, v_uid);
  if v_guard is not null then
    return query select false, 0::numeric, 0::numeric, v_guard; return;
  end if;

  select * into v_keep from slices
   where crystal_id = p_crystal_id and position = p_pos_keep for update;
  if not found or not v_keep.is_active then
    return query select false, 0::numeric, 0::numeric, 'slice_not_active'::text; return;
  end if;
  select * into v_absorb from slices
   where crystal_id = p_crystal_id and position = p_pos_absorb for update;
  if not found or not v_absorb.is_active then
    return query select false, 0::numeric, 0::numeric, 'slice_not_active'::text; return;
  end if;

  v_power := round((v_keep.power + v_absorb.power * 0.9)::numeric, 2);
  if v_power > 100 then
    return query select false, 0::numeric, 0::numeric, 'merge_overflow'::text; return;
  end if;

  select * into v_burn from public.unsc_burn(
    10, 'fee', 'slice:merge:' || p_crystal_id,
    jsonb_build_object('source', 'slice_merge', 'crystal_id', p_crystal_id)
  );
  if v_burn.success is not true then
    return query select false, 0::numeric, 10::numeric,
      coalesce(v_burn.error_message, 'burn_failed');
    return;
  end if;

  update slices set power = v_power, updated_at = now()
   where crystal_id = p_crystal_id and position = p_pos_keep;
  update slices set is_active = false, updated_at = now()
   where crystal_id = p_crystal_id and position = p_pos_absorb;

  return query select true, v_power, 10::numeric, null::text;
end;
$$;

create or replace function public.slice_split(
  p_crystal_id uuid,
  p_pos_source int,
  p_pos_target int
)
returns table (success boolean, half_power numeric, fee numeric, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_guard  text;
  v_source slices%rowtype;
  v_target slices%rowtype;
  v_half   numeric;
  v_burn   record;
begin
  if v_uid is null then
    return query select false, 0::numeric, 0::numeric, 'unauthorized'::text; return;
  end if;
  if p_pos_source = p_pos_target then
    return query select false, 0::numeric, 0::numeric, 'same_slice'::text; return;
  end if;

  v_guard := assert_slice_op_allowed(p_crystal_id, v_uid);
  if v_guard is not null then
    return query select false, 0::numeric, 0::numeric, v_guard; return;
  end if;

  select * into v_source from slices
   where crystal_id = p_crystal_id and position = p_pos_source for update;
  if not found or not v_source.is_active then
    return query select false, 0::numeric, 0::numeric, 'slice_not_active'::text; return;
  end if;
  -- The target slot must be an INACTIVE slice (left behind by a merge).
  select * into v_target from slices
   where crystal_id = p_crystal_id and position = p_pos_target for update;
  if not found or v_target.is_active then
    return query select false, 0::numeric, 0::numeric, 'no_inactive_target'::text; return;
  end if;

  -- 95% retained across both halves.
  v_half := round((v_source.power * 0.475)::numeric, 2);
  if v_half <= 0 then
    return query select false, 0::numeric, 0::numeric, 'too_small_to_split'::text; return;
  end if;

  select * into v_burn from public.unsc_burn(
    10, 'fee', 'slice:split:' || p_crystal_id,
    jsonb_build_object('source', 'slice_split', 'crystal_id', p_crystal_id)
  );
  if v_burn.success is not true then
    return query select false, 0::numeric, 10::numeric,
      coalesce(v_burn.error_message, 'burn_failed');
    return;
  end if;

  update slices set power = v_half, updated_at = now()
   where crystal_id = p_crystal_id and position = p_pos_source;
  update slices
     set power = v_half,
         is_active = true,
         hue = v_source.hue,
         saturation = v_source.saturation,
         brightness = v_source.brightness,
         updated_at = now()
   where crystal_id = p_crystal_id and position = p_pos_target;

  return query select true, v_half, 10::numeric, null::text;
end;
$$;

create or replace function public.slice_swap(
  p_crystal_a uuid,
  p_pos_a     int,
  p_crystal_b uuid,
  p_pos_b     int
)
returns table (success boolean, fee numeric, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_guard text;
  v_a     slices%rowtype;
  v_b     slices%rowtype;
  v_burn  record;
begin
  if v_uid is null then
    return query select false, 0::numeric, 'unauthorized'::text; return;
  end if;
  if p_crystal_a = p_crystal_b and p_pos_a = p_pos_b then
    return query select false, 0::numeric, 'same_slice'::text; return;
  end if;

  -- Lock crystals in stable order to avoid deadlocks between swaps.
  if p_crystal_a <= p_crystal_b then
    v_guard := assert_slice_op_allowed(p_crystal_a, v_uid);
    if v_guard is null and p_crystal_a <> p_crystal_b then
      v_guard := assert_slice_op_allowed(p_crystal_b, v_uid);
    end if;
  else
    v_guard := assert_slice_op_allowed(p_crystal_b, v_uid);
    if v_guard is null then
      v_guard := assert_slice_op_allowed(p_crystal_a, v_uid);
    end if;
  end if;
  if v_guard is not null then
    return query select false, 0::numeric, v_guard; return;
  end if;

  select * into v_a from slices
   where crystal_id = p_crystal_a and position = p_pos_a for update;
  if not found or not v_a.is_active then
    return query select false, 0::numeric, 'slice_not_active'::text; return;
  end if;
  select * into v_b from slices
   where crystal_id = p_crystal_b and position = p_pos_b for update;
  if not found or not v_b.is_active then
    return query select false, 0::numeric, 'slice_not_active'::text; return;
  end if;

  select * into v_burn from public.unsc_burn(
    15, 'fee', 'slice:swap:' || p_crystal_a || ':' || p_crystal_b,
    jsonb_build_object('source', 'slice_swap')
  );
  if v_burn.success is not true then
    return query select false, 15::numeric, coalesce(v_burn.error_message, 'burn_failed');
    return;
  end if;

  update slices
     set power = v_b.power, hue = v_b.hue, saturation = v_b.saturation,
         brightness = v_b.brightness, updated_at = now()
   where crystal_id = p_crystal_a and position = p_pos_a;
  update slices
     set power = v_a.power, hue = v_a.hue, saturation = v_a.saturation,
         brightness = v_a.brightness, updated_at = now()
   where crystal_id = p_crystal_b and position = p_pos_b;

  return query select true, 15::numeric, null::text;
end;
$$;

grant execute on function public.slice_merge(uuid, int, int) to authenticated;
grant execute on function public.slice_split(uuid, int, int) to authenticated;
grant execute on function public.slice_swap(uuid, int, uuid, int) to authenticated;
