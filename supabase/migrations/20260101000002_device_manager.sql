-- Device Manager Schema v1.0
-- =================================

-- =================================
-- ENUMS
-- =================================

create type device_category as enum ('generator', 'heavy', 'medium', 'light', 'storage');
create type device_status as enum ('online', 'standby', 'offline', 'error', 'upgrading');
create type tweak_type as enum ('radio', 'toggle', 'slider', 'priority_list');

-- =================================
-- DEVICES (master definitions, 36 rows)
-- =================================

create table public.devices (
  device_id varchar(10) primary key,
  name varchar(50) not null,
  version varchar(15) not null,
  category device_category not null,
  tech_tree varchar(30) not null,
  tier integer not null check (tier >= 1 and tier <= 5),
  power_full decimal(8,2) not null,
  power_idle decimal(8,2) not null,
  power_standby decimal(8,2) not null,
  description text,
  capabilities jsonb default '[]'::jsonb
);

-- =================================
-- DEVICE STATE (real-time, 1 row per device)
-- =================================

create table public.device_state (
  device_id varchar(10) references public.devices(device_id) on delete cascade primary key,
  state device_status not null default 'offline',
  health decimal(5,2) not null default 100,
  load decimal(5,2) not null default 0,
  uptime_seconds bigint not null default 0,
  power_current decimal(8,2) not null default 0,
  temperature decimal(5,2) not null default 25,
  last_updated timestamptz not null default now()
);

-- =================================
-- DEVICE DEPENDENCIES (tech tree prerequisites)
-- =================================

create table public.device_dependencies (
  id serial primary key,
  device_id varchar(10) references public.devices(device_id) on delete cascade not null,
  tech_tree varchar(30) not null,
  tier integer not null,
  item_name varchar(50) not null,
  is_cross_tree boolean not null default false
);

-- =================================
-- DEVICE COMBINATIONS (synergy configs)
-- =================================

create table public.device_combinations (
  combo_id serial primary key,
  primary_device varchar(10) references public.devices(device_id) on delete cascade not null,
  secondary_device varchar(10) references public.devices(device_id) on delete cascade not null,
  combo_name varchar(50) not null,
  effect_description text,
  combined_power decimal(8,2),
  requirement_tree varchar(30),
  requirement_item varchar(50)
);

-- =================================
-- DEVICE TWEAKS (available settings per device)
-- =================================

create table public.device_tweaks (
  tweak_id serial primary key,
  device_id varchar(10) references public.devices(device_id) on delete cascade not null,
  setting_id varchar(30) not null,
  setting_name varchar(50) not null,
  setting_type tweak_type not null,
  default_value text,
  power_impact decimal(8,2),
  description text,
  options jsonb
);

-- =================================
-- PLAYER DEVICE STATE (per-player config)
-- =================================

create table public.player_device_state (
  player_id uuid references public.profiles(id) on delete cascade not null,
  device_id varchar(10) references public.devices(device_id) on delete cascade not null,
  unlocked boolean not null default false,
  unlock_date timestamptz,
  current_state device_status not null default 'offline',
  tweak_settings jsonb not null default '{}'::jsonb,
  active_links text[],
  primary key (player_id, device_id)
);

-- =================================
-- SEED: devices
-- =================================

insert into public.devices (device_id, name, version, category, tech_tree, tier, power_full, power_idle, power_standby, description, capabilities) values
  -- Power Generators
  ('UEC-001', 'Unstable Energy Core',       'v2.0.1', 'generator', 'Tech Tier 1',           1,   50.00,   35.00,   5.00,  'Primary power generation via unstable energy tapping',                '["base_generation","volatility_boost"]'),
  ('MFR-001', 'Microfusion Reactor',        'v2.3.0', 'generator', 'Tech Tier 2',           2,  250.00,  150.00,  25.00,  'Stable high-output fusion power generation',                          '["fusion_power","thermal_link"]'),
  ('BAT-001', 'Battery Pack',               'v1.8.0', 'storage',   'Gadgets Tier 1',        1,    0.00,   -0.50,  -0.10,  'Portable energy storage and discharge',                                '["energy_storage","burst_discharge","field_extension"]'),

  -- Heavy Consumers
  ('SCA-001', 'Supercomputer Array',        'v5.2.0', 'heavy',     'Tech Tier 3',           3, -150.00,  -45.00,  -8.00,  'Massive parallel computation for research acceleration',               '["research_boost","crypto_decode","simulation"]'),
  ('AIC-001', 'AI Assistant Core',          'v2.4.0', 'heavy',     'Tech Tier 2',           2,  -35.00,  -12.00,  -3.00,  'Semi-sentient lab management and task automation',                     '["automation","anomaly_response","resource_optimization"]'),
  ('QAN-001', 'Quantum Analyzer',           'v3.7.2', 'heavy',     'Science Tier 3',        3,  -80.00,  -20.00,  -5.00,  'Quantum state analysis and trait measurement',                        '["trait_identification","volatility_prediction","state_mapping"]'),
  ('P3D-001', '3D Fabricator',              'v3.2.1', 'heavy',     'Tools Tier 2',          2,  -60.00,   -8.00,  -2.00,  'Rapid prototyping and component fabrication',                          '["fabrication","prototyping","material_cost_reduction"]'),
  ('TLP-001', 'Teleport Pad',              'v2.2.0', 'heavy',     'Gadgets Tier 2',        2, -100.00,  -15.00,  -3.00,  'Short-range matter teleportation',                                    '["teleportation","spatial_lock"]'),
  ('EXD-001', 'Explorer Drone',             'v3.1.2', 'heavy',     'Tools Tier 2',          2,  -40.00,  -15.00,  -1.00,  'Autonomous field exploration and resource collection',                 '["exploration","resource_collection","aerial_survey"]'),
  ('LCT-001', 'Precision Laser',            'v2.1.0', 'heavy',     'Tools Tier 2',          2,  -55.00,  -10.00,  -2.00,  'High-precision cutting and material shaping',                          '["cutting","material_shaping","nanomaterial_processing"]'),
  ('EMC-001', 'Exotic Matter Containment',  'v4.0.1', 'heavy',     'Refine Tier 4',         4,  -75.00,  -40.00,   0.00,  'Safe storage of exotic matter and anomaly samples',                   '["exotic_storage","containment_field","breach_alert"]'),

  -- Medium Consumers
  ('CDC-001', 'Crystal Data Cache',         'v1.4.2', 'medium',    'Tech Tier 1',           1,  -15.00,   -5.00,  -1.00,  'Crystalline data storage for research archives',                      '["data_storage","fast_read","fast_write"]'),
  ('HMS-001', 'Handmade Synthesizer',       'v3.2.1', 'medium',    'Music Tier 1',          1,   -8.00,   -3.00,  -0.50,  'DIY electronic sound synthesis',                                      '["sound_synthesis","multi_oscillator","modulation"]'),
  ('ECR-001', 'Echo Recorder',              'v1.1.0', 'medium',    'Music Tier 1',          1,   -6.00,   -2.00,  -0.30,  'Environmental sound capture and looping',                              '["recording","loop_playback","multi_track"]'),
  ('INT-001', 'Interpolator',               'v2.5.3', 'medium',    'Adapters Tier 2',       2,  -20.00,   -6.00,  -1.00,  'Data stream smoothing and prediction algorithms',                     '["data_smoothing","prediction","multi_stream"]'),
  ('OSC-001', 'Oscilloscope Array',         'v4.6.0', 'medium',    'Science Tier 2',        2,  -18.00,   -5.00,  -1.00,  'Multi-channel waveform visualization and analysis',                   '["waveform_display","multi_channel","high_bandwidth"]'),
  ('QSM-001', 'Quantum State Monitor',      'v1.2.0', 'medium',    'Science Tier 2',        2,  -22.00,   -7.00,  -1.50,  'Real-time quantum coherence tracking',                                '["coherence_tracking","decoherence_alert","state_history"]'),
  ('AND-001', 'Anomaly Detector',           'v2.3.0', 'medium',    'Gadgets Tier 2',        2,  -15.00,   -4.00,  -0.80,  'Advanced anomaly property analysis',                                  '["anomaly_scanning","deep_scan","classification"]'),
  ('RMG-001', 'Resource Magnet',            'v1.2.0', 'medium',    'Gadgets Tier 1',        1,  -10.00,   -3.00,  -0.50,  'Passive Abstractum fragment attraction',                               '["resource_attraction","idle_gain_boost","material_collection"]'),

  -- Light Consumers
  ('VNT-001', 'Ventilation System',         'v1.0.0', 'light',     'Base Infrastructure',   1,   -4.00,   -2.00,  -0.50,  'Laboratory atmosphere management',                                    '["air_exchange","filtration","humidity_control"]'),
  ('SPK-001', 'Narrow Speaker',             'v1.0.0', 'light',     'Music Tier 1',          1,   -3.00,   -0.50,  -0.10,  'Focused audio output for resonance experiments',                      '["audio_output","directional_beam"]'),
  ('NET-001', 'Network Monitor',            'v2.1.0', 'light',     'Tech Tier 2',           2,   -3.50,   -1.50,  -0.30,  'Lab network traffic and connectivity monitoring',                     '["packet_analysis","connectivity_check","multiplayer_health"]'),
  ('TMP-001', 'Temperature Monitor',        'v1.0.0', 'light',     'Base Infrastructure',   1,   -1.50,   -0.80,  -0.20,  'Multi-zone thermal monitoring',                                       '["multi_zone","wide_range","high_accuracy"]'),
  ('DIM-001', 'Dimension Monitor',          'v1.0.0', 'light',     'Science Tier 3',        3,   -4.00,   -1.50,  -0.40,  'Dimensional stability and portal activity tracking',                  '["dimensional_scan","stability_index","portal_detection"]'),
  ('CPU-001', 'CPU Monitor',                'v3.2.1', 'light',     'Tech Tier 1',           1,   -2.00,   -0.80,  -0.20,  'System processor utilization display',                                '["per_core_breakdown","load_history","temperature_overlay"]'),
  ('CLK-001', 'Lab Clock',                  'v2.4.0', 'light',     'Base Infrastructure',   1,   -1.00,   -0.50,  -0.10,  'Precision timekeeping and research scheduling',                       '["timekeeping","timers","alarm_events"]'),
  ('MEM-001', 'Memory Monitor',             'v3.1.0', 'light',     'Tech Tier 1',           1,   -1.80,   -0.60,  -0.15,  'System memory utilization tracking',                                  '["allocation_view","leak_detection","pool_tracking"]'),
  ('QCP-001', 'Quantum Compass',            'v1.5.0', 'light',     'Gadgets Tier 1',        1,   -2.50,   -0.80,  -0.20,  'Anomaly signal and resource hotspot direction',                       '["triangulation","bearing","signal_detection"]'),
  ('DGN-001', 'Diagnostics Console',        'v2.0.4', 'light',     'Tech Tier 2',           2,   -3.00,   -1.00,  -0.25,  'System-wide health and error diagnostics',                            '["deep_scan","error_monitoring","self_repair"]'),
  ('THM-001', 'Thermal Manager',            'v1.0.0', 'light',     'Refine Tier 1',         1,   -4.00,   -1.50,  -0.30,  'Active thermal regulation and heat dissipation',                      '["cooling","reactor_efficiency_boost","emergency_cool"]'),
  ('BTK-001', 'Basic Toolkit',              'v1.2.0', 'light',     'Tools Tier 1',          1,   -2.00,   -0.30,  -0.05,  'Standard digital hand tools for construction',                        '["multitool","construction","interface_adapters"]'),
  ('MSC-001', 'Material Scanner',           'v1.3.0', 'light',     'Tools Tier 1',          1,   -3.50,   -1.00,  -0.20,  'Resource node identification and composition analysis',                '["material_scan","purity_assessment","deep_analysis"]'),
  ('PWR-001', 'Power Management System',    'v1.0.0', 'light',     'Tech Tier 1',           1,   -2.50,   -1.00,  -0.20,  'Lab-wide power distribution and load balancing',                      '["load_balancing","circuit_management","shutdown_priority"]'),
  ('VLT-001', 'Volt Meter Display',         'v1.0.0', 'light',     'Base Infrastructure',   1,   -0.80,   -0.30,  -0.10,  'Voltage level visualization',                                         '["voltage_display","dual_display","logging"]'),
  ('PWD-001', 'Power Display Panel',        'v1.0.0', 'light',     'Base Infrastructure',   1,   -1.00,   -0.40,  -0.10,  'Power flow visualization and consumption overview',                   '["power_graph","per_device_breakdown","usage_history"]'),

  -- Storage
  ('ATK-001', 'Abstractum Tank',            'v2.1.0', 'storage',   'Refine Tier 1',         1,   -1.50,   -0.30,  -0.05,  'Bulk Abstractum storage',                                             '["bulk_storage","transfer","purity_preservation"]');

-- =================================
-- SEED: device_state (all offline, defaults)
-- =================================

insert into public.device_state (device_id)
select device_id from public.devices;

-- =================================
-- ROW LEVEL SECURITY
-- =================================

alter table public.devices enable row level security;
alter table public.device_state enable row level security;
alter table public.device_dependencies enable row level security;
alter table public.device_combinations enable row level security;
alter table public.device_tweaks enable row level security;
alter table public.player_device_state enable row level security;

-- devices: public read
create policy "Anyone can view devices"
  on public.devices for select
  using (true);

-- device_state: authenticated read
create policy "Authenticated users can view device state"
  on public.device_state for select
  using (auth.role() = 'authenticated');

-- device_dependencies: public read
create policy "Anyone can view device dependencies"
  on public.device_dependencies for select
  using (true);

-- device_combinations: public read
create policy "Anyone can view device combinations"
  on public.device_combinations for select
  using (true);

-- device_tweaks: public read
create policy "Anyone can view device tweaks"
  on public.device_tweaks for select
  using (true);

-- player_device_state: player owns their records
create policy "Players can view own device state"
  on public.player_device_state for select
  using (auth.uid() = player_id);

create policy "Players can insert own device state"
  on public.player_device_state for insert
  with check (auth.uid() = player_id);

create policy "Players can update own device state"
  on public.player_device_state for update
  using (auth.uid() = player_id);

create policy "Players can delete own device state"
  on public.player_device_state for delete
  using (auth.uid() = player_id);

-- =================================
-- TRIGGERS
-- =================================

create trigger set_updated_at before update on public.device_state
  for each row execute procedure public.handle_updated_at();

create trigger set_updated_at before update on public.player_device_state
  for each row execute procedure public.handle_updated_at();

-- =================================
-- INDEXES
-- =================================

create index idx_devices_category on public.devices(category);
create index idx_device_state_state on public.device_state(state);
create index idx_player_device_state_player on public.player_device_state(player_id);
create index idx_device_dependencies_device on public.device_dependencies(device_id);
create index idx_device_tweaks_device on public.device_tweaks(device_id);
create index idx_device_combinations_primary on public.device_combinations(primary_device);
