-- UnstableLabs Database Schema v1.0
-- =================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- =================================
-- ENUMS
-- =================================

create type crystal_color as enum (
  'infrared', 'red', 'orange', 'yellow', 'green',
  'blue', 'indigo', 'violet', 'gamma'
);

create type volatility_tier as enum ('1', '2', '3', '4', '5');

create type rotation_direction as enum ('CW', 'CCW');

create type crystal_state as enum ('stable', 'volatile', 'hybrid');

create type crystal_era as enum ('8-bit', '16-bit', '32-bit', '64-bit');

create type transaction_type as enum (
  'mint', 'burn', 'transfer', 'research', 'reward',
  'fee', 'stake', 'unstake', 'trade'
);

-- =================================
-- PROFILES (extends auth.users)
-- =================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  display_name text,
  avatar_url text,
  total_unsc numeric(20, 8) default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- =================================
-- CRYSTALS (_unITM)
-- =================================

create table public.crystals (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete set null,

  -- NFT metadata
  mint_address text unique, -- Solana mint address when minted
  name text not null,

  -- Crystal traits
  color crystal_color not null default 'green',
  volatility volatility_tier not null default '1',
  rotation rotation_direction not null default 'CW',
  state crystal_state not null default 'stable',
  era crystal_era not null default '8-bit',
  is_genesis boolean not null default false,

  -- Computed values (updated by triggers/functions)
  total_power numeric(10, 2) default 0 not null,
  slice_count int default 0 not null,

  -- Timestamps
  minted_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- =================================
-- SLICES (_unSLC)
-- =================================

create table public.slices (
  id uuid default uuid_generate_v4() primary key,
  crystal_id uuid references public.crystals(id) on delete cascade not null,

  -- Position (1-30 for each crystal)
  position int not null check (position >= 1 and position <= 30),

  -- Slice properties
  power numeric(10, 2) default 1 not null,
  is_active boolean default true not null,

  -- Visual properties
  hue int check (hue >= 0 and hue <= 360),
  saturation int check (saturation >= 0 and saturation <= 100),
  brightness int check (brightness >= 0 and brightness <= 100),

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  -- Each crystal can only have one slice per position
  unique(crystal_id, position)
);

-- =================================
-- TECH TREES
-- =================================

create table public.tech_trees (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  description text,
  category text not null, -- 'devices', 'optics', 'adapters', 'synthesizers', etc.
  max_tier int default 5 not null,
  created_at timestamptz default now() not null
);

-- Seed the 12 tech trees
insert into public.tech_trees (name, category, description) values
  ('Oscilloscope', 'devices', 'Core display and signal processing'),
  ('Spectrometer', 'devices', 'Color analysis and wavelength detection'),
  ('Synthesizer', 'devices', 'Sound and frequency generation'),
  ('Optics Array', 'optics', 'Light manipulation and focusing'),
  ('Prism Matrix', 'optics', 'Color separation and recombination'),
  ('Lens Chamber', 'optics', 'Magnification and clarity'),
  ('Signal Adapter', 'adapters', 'Input/output signal processing'),
  ('Frequency Modulator', 'adapters', 'Wave manipulation'),
  ('Phase Shifter', 'adapters', 'Timing and synchronization'),
  ('Wave Synthesizer', 'synthesizers', 'Waveform generation'),
  ('Harmonic Generator', 'synthesizers', 'Overtone production'),
  ('Resonance Chamber', 'synthesizers', 'Amplification and feedback');

-- =================================
-- RESEARCH PROGRESS
-- =================================

create table public.research_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  tech_tree_id uuid references public.tech_trees(id) on delete cascade not null,

  current_tier int default 1 not null check (current_tier >= 1 and current_tier <= 5),
  experience numeric(20, 8) default 0 not null,
  experience_to_next numeric(20, 8) default 100 not null,

  unlocked_at timestamptz default now() not null,
  last_researched_at timestamptz,

  unique(user_id, tech_tree_id)
);

-- =================================
-- TOKEN BALANCES (_unSC)
-- =================================

create table public.balances (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,

  -- Available balance
  available numeric(20, 8) default 0 not null check (available >= 0),

  -- Staked/locked balances
  staked numeric(20, 8) default 0 not null check (staked >= 0),
  locked numeric(20, 8) default 0 not null check (locked >= 0),

  -- Lifetime stats
  total_earned numeric(20, 8) default 0 not null,
  total_spent numeric(20, 8) default 0 not null,

  updated_at timestamptz default now() not null
);

-- =================================
-- TRANSACTIONS
-- =================================

create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete set null,

  type transaction_type not null,
  amount numeric(20, 8) not null,

  -- Optional references
  crystal_id uuid references public.crystals(id) on delete set null,
  tech_tree_id uuid references public.tech_trees(id) on delete set null,
  counterparty_id uuid references public.profiles(id) on delete set null,

  -- Metadata
  description text,
  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now() not null
);

-- =================================
-- COMMAND HISTORY (Terminal)
-- =================================

create table public.command_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,

  command text not null,
  args text[],
  output text,
  success boolean default true not null,
  execution_time_ms int,

  created_at timestamptz default now() not null
);

-- =================================
-- VOLATILITY SNAPSHOTS
-- =================================

create table public.volatility_snapshots (
  id uuid default uuid_generate_v4() primary key,

  -- Blockchain metrics
  tps numeric(10, 2) not null, -- Transactions per second
  block_time_ms int not null,
  network text default 'solana' not null,

  -- Calculated tier based on TPS
  calculated_tier volatility_tier not null,

  captured_at timestamptz default now() not null
);

-- Index for time-based queries
create index idx_volatility_snapshots_captured_at
  on public.volatility_snapshots(captured_at desc);

-- =================================
-- ROW LEVEL SECURITY
-- =================================

alter table public.profiles enable row level security;
alter table public.crystals enable row level security;
alter table public.slices enable row level security;
alter table public.tech_trees enable row level security;
alter table public.research_progress enable row level security;
alter table public.balances enable row level security;
alter table public.transactions enable row level security;
alter table public.command_history enable row level security;
alter table public.volatility_snapshots enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Crystals policies
create policy "Users can view own crystals"
  on public.crystals for select
  using (auth.uid() = owner_id);

create policy "Users can insert own crystals"
  on public.crystals for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own crystals"
  on public.crystals for update
  using (auth.uid() = owner_id);

-- Slices policies (via crystal ownership)
create policy "Users can view slices of own crystals"
  on public.slices for select
  using (
    crystal_id in (
      select id from public.crystals where owner_id = auth.uid()
    )
  );

create policy "Users can manage slices of own crystals"
  on public.slices for all
  using (
    crystal_id in (
      select id from public.crystals where owner_id = auth.uid()
    )
  );

-- Tech trees policies (public read)
create policy "Anyone can view tech trees"
  on public.tech_trees for select
  using (true);

-- Research progress policies
create policy "Users can view own research"
  on public.research_progress for select
  using (auth.uid() = user_id);

create policy "Users can manage own research"
  on public.research_progress for all
  using (auth.uid() = user_id);

-- Balances policies
create policy "Users can view own balance"
  on public.balances for select
  using (auth.uid() = user_id);

-- Transactions policies
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id or auth.uid() = counterparty_id);

-- Command history policies
create policy "Users can view own command history"
  on public.command_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own commands"
  on public.command_history for insert
  with check (auth.uid() = user_id);

-- Volatility snapshots (public read)
create policy "Anyone can view volatility"
  on public.volatility_snapshots for select
  using (true);

-- =================================
-- FUNCTIONS & TRIGGERS
-- =================================

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to relevant tables
create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at before update on public.crystals
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at before update on public.slices
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at before update on public.balances
  for each row execute procedure public.handle_updated_at();

-- Auto-create profile, balance, and initial research on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Create profile
  insert into public.profiles (id)
  values (new.id);

  -- Create balance record
  insert into public.balances (user_id, available)
  values (new.id, 100); -- Starting bonus

  -- Initialize research progress for all tech trees
  insert into public.research_progress (user_id, tech_tree_id)
  select new.id, id from public.tech_trees;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update crystal slice count and power
create or replace function public.update_crystal_stats()
returns trigger as $$
begin
  update public.crystals
  set
    slice_count = (select count(*) from public.slices where crystal_id = coalesce(new.crystal_id, old.crystal_id)),
    total_power = (select coalesce(sum(power), 0) from public.slices where crystal_id = coalesce(new.crystal_id, old.crystal_id) and is_active = true)
  where id = coalesce(new.crystal_id, old.crystal_id);

  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger update_crystal_on_slice_change
  after insert or update or delete on public.slices
  for each row execute procedure public.update_crystal_stats();

-- =================================
-- INDEXES
-- =================================

create index idx_crystals_owner on public.crystals(owner_id);
create index idx_crystals_color on public.crystals(color);
create index idx_crystals_era on public.crystals(era);
create index idx_slices_crystal on public.slices(crystal_id);
create index idx_research_user on public.research_progress(user_id);
create index idx_transactions_user on public.transactions(user_id);
create index idx_transactions_created on public.transactions(created_at desc);
create index idx_command_history_user on public.command_history(user_id);
create index idx_command_history_created on public.command_history(created_at desc);
