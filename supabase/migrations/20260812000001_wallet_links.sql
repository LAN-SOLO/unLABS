-- ============================================================
-- Wallet links (on-chain layer, step 1)
-- ============================================================
-- One verified Solana wallet per user. The link is proven by an
-- ed25519 signature over a server-derived challenge, verified in the
-- server action (tweetnacl) — NOT here. Because signature verification
-- happens in TS, the table has NO client write policies: the action
-- writes with the service-role client after verification. A client
-- with the anon key can read its own link but never forge one — this
-- matters the moment links gate NFT claims or token exports.

create table if not exists public.wallet_links (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  address     text not null unique,
  network     text not null default 'solana',
  verified_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table public.wallet_links enable row level security;

drop policy if exists "Users can view own wallet link" on public.wallet_links;
create policy "Users can view own wallet link"
  on public.wallet_links
  for select
  using (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies: service-role writes only.

create index if not exists idx_wallet_links_address on public.wallet_links(address);
