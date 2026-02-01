-- ============================================================================
-- _unOS System Preferences - Database Schema
-- Migration: 00003_sysprefs
-- Adapted from DB_SCHEMA_sysprefs_v1_0.sql
-- Changes: players(id) -> profiles(id)
-- ============================================================================

-- ============================================================================
-- 1. PLAYER DISPLAY PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_display_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Theme Settings
  theme VARCHAR(20) NOT NULL DEFAULT 'green' CHECK (
    theme IN ('green', 'amber', 'cyan', 'white', 'red', 'purple', 'custom')
  ),
  primary_color VARCHAR(7) NOT NULL DEFAULT '#00FF41',
  secondary_color VARCHAR(7) NOT NULL DEFAULT '#33FF33',
  background_color VARCHAR(7) NOT NULL DEFAULT '#0A0A0A',

  -- CRT Effects
  effect_scanlines BOOLEAN NOT NULL DEFAULT TRUE,
  effect_curvature BOOLEAN NOT NULL DEFAULT TRUE,
  effect_flicker BOOLEAN NOT NULL DEFAULT FALSE,
  effect_glow_intensity INTEGER NOT NULL DEFAULT 80 CHECK (
    effect_glow_intensity >= 0 AND effect_glow_intensity <= 100
  ),
  effect_glitch BOOLEAN NOT NULL DEFAULT TRUE,
  effect_matrix_rain BOOLEAN NOT NULL DEFAULT TRUE,

  -- Typography
  font_family VARCHAR(50) NOT NULL DEFAULT 'Amiga Forever Pro2',
  font_size INTEGER NOT NULL DEFAULT 14 CHECK (
    font_size >= 8 AND font_size <= 32
  ),
  line_spacing DECIMAL(3, 2) NOT NULL DEFAULT 1.4 CHECK (
    line_spacing >= 1.0 AND line_spacing <= 2.5
  ),
  letter_spacing DECIMAL(4, 3) NOT NULL DEFAULT 0.02 CHECK (
    letter_spacing >= 0 AND letter_spacing <= 0.2
  ),

  -- Terminal Dimensions
  terminal_columns INTEGER NOT NULL DEFAULT 80 CHECK (
    terminal_columns >= 40 AND terminal_columns <= 200
  ),
  terminal_rows INTEGER NOT NULL DEFAULT 25 CHECK (
    terminal_rows >= 15 AND terminal_rows <= 60
  ),
  prompt_style VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (
    prompt_style IN ('standard', 'minimal', 'full', 'custom')
  ),
  cursor_style VARCHAR(20) NOT NULL DEFAULT 'block' CHECK (
    cursor_style IN ('block', 'underline', 'bar')
  ),
  cursor_blink BOOLEAN NOT NULL DEFAULT TRUE,

  -- Accessibility
  plain_mode BOOLEAN NOT NULL DEFAULT FALSE,
  high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
  large_text BOOLEAN NOT NULL DEFAULT FALSE,
  reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_display_prefs_player ON player_display_prefs(player_id);

-- Shared timestamp trigger
CREATE OR REPLACE FUNCTION update_syspref_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER display_prefs_updated
  BEFORE UPDATE ON player_display_prefs
  FOR EACH ROW
  EXECUTE FUNCTION update_syspref_timestamp();

-- ============================================================================
-- 2. PLAYER SOUND PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_sound_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Master Audio
  master_volume INTEGER NOT NULL DEFAULT 80 CHECK (
    master_volume >= 0 AND master_volume <= 100
  ),
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  sound_profile VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (
    sound_profile IN ('standard', 'retro', 'minimal', 'scifi', 'silent')
  ),

  -- Terminal Sounds
  terminal_clicks BOOLEAN NOT NULL DEFAULT TRUE,
  terminal_clicks_volume INTEGER NOT NULL DEFAULT 80 CHECK (
    terminal_clicks_volume >= 0 AND terminal_clicks_volume <= 100
  ),
  command_beeps BOOLEAN NOT NULL DEFAULT TRUE,
  command_beeps_volume INTEGER NOT NULL DEFAULT 80 CHECK (
    command_beeps_volume >= 0 AND command_beeps_volume <= 100
  ),
  error_buzzer BOOLEAN NOT NULL DEFAULT TRUE,
  error_buzzer_volume INTEGER NOT NULL DEFAULT 100 CHECK (
    error_buzzer_volume >= 0 AND error_buzzer_volume <= 100
  ),
  success_chime BOOLEAN NOT NULL DEFAULT TRUE,
  success_chime_volume INTEGER NOT NULL DEFAULT 80 CHECK (
    success_chime_volume >= 0 AND success_chime_volume <= 100
  ),
  tab_complete_sound BOOLEAN NOT NULL DEFAULT TRUE,
  tab_complete_volume INTEGER NOT NULL DEFAULT 60 CHECK (
    tab_complete_volume >= 0 AND tab_complete_volume <= 100
  ),

  -- Ambient Sounds
  background_hum BOOLEAN NOT NULL DEFAULT TRUE,
  background_hum_volume INTEGER NOT NULL DEFAULT 40 CHECK (
    background_hum_volume >= 0 AND background_hum_volume <= 100
  ),
  idle_static BOOLEAN NOT NULL DEFAULT TRUE,
  idle_static_volume INTEGER NOT NULL DEFAULT 60 CHECK (
    idle_static_volume >= 0 AND idle_static_volume <= 100
  ),
  device_whir BOOLEAN NOT NULL DEFAULT TRUE,
  device_whir_volume INTEGER NOT NULL DEFAULT 80 CHECK (
    device_whir_volume >= 0 AND device_whir_volume <= 100
  ),
  quantum_whisper BOOLEAN NOT NULL DEFAULT TRUE,
  quantum_whisper_volume INTEGER NOT NULL DEFAULT 20 CHECK (
    quantum_whisper_volume >= 0 AND quantum_whisper_volume <= 100
  ),

  -- Notification Sounds
  notification_research_complete BOOLEAN NOT NULL DEFAULT TRUE,
  notification_trade_accepted BOOLEAN NOT NULL DEFAULT TRUE,
  notification_volatility_alert BOOLEAN NOT NULL DEFAULT TRUE,
  notification_quest_complete BOOLEAN NOT NULL DEFAULT TRUE,
  notification_volume INTEGER NOT NULL DEFAULT 100 CHECK (
    notification_volume >= 0 AND notification_volume <= 100
  ),
  voice_alerts BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sound_prefs_player ON player_sound_prefs(player_id);

CREATE TRIGGER sound_prefs_updated
  BEFORE UPDATE ON player_sound_prefs
  FOR EACH ROW
  EXECUTE FUNCTION update_syspref_timestamp();

-- ============================================================================
-- 3. PLAYER DATETIME PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_datetime_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  time_format VARCHAR(5) NOT NULL DEFAULT '24' CHECK (
    time_format IN ('12', '24')
  ),
  show_seconds BOOLEAN NOT NULL DEFAULT TRUE,
  show_milliseconds BOOLEAN NOT NULL DEFAULT FALSE,
  date_format VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD' CHECK (
    date_format IN ('YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'full')
  ),
  first_day_of_week VARCHAR(10) NOT NULL DEFAULT 'monday' CHECK (
    first_day_of_week IN ('monday', 'sunday')
  ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datetime_prefs_player ON player_datetime_prefs(player_id);

CREATE TRIGGER datetime_prefs_updated
  BEFORE UPDATE ON player_datetime_prefs
  FOR EACH ROW
  EXECUTE FUNCTION update_syspref_timestamp();

-- ============================================================================
-- 4. PLAYER NETWORK PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_network_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  auto_reconnect BOOLEAN NOT NULL DEFAULT TRUE,
  ping_interval_seconds INTEGER NOT NULL DEFAULT 30 CHECK (
    ping_interval_seconds >= 10 AND ping_interval_seconds <= 300
  ),
  preferred_region VARCHAR(20) DEFAULT NULL CHECK (
    preferred_region IN ('auto', 'us-east', 'us-west', 'eu-west', 'eu-central', 'asia-east', NULL)
  ),
  connection_quality VARCHAR(10) NOT NULL DEFAULT 'auto' CHECK (
    connection_quality IN ('auto', 'low', 'medium', 'high')
  ),
  notify_connection_lost BOOLEAN NOT NULL DEFAULT TRUE,
  notify_server_restart BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_prefs_player ON player_network_prefs(player_id);

CREATE TRIGGER network_prefs_updated
  BEFORE UPDATE ON player_network_prefs
  FOR EACH ROW
  EXECUTE FUNCTION update_syspref_timestamp();

-- ============================================================================
-- 5. SYSTEM CONFIGURATION CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_config_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  os_version VARCHAR(20) NOT NULL,
  os_codename VARCHAR(50) NOT NULL,
  os_build VARCHAR(50) NOT NULL,
  kernel_version VARCHAR(50) NOT NULL,

  cpu_model VARCHAR(100) NOT NULL,
  cpu_cores INTEGER NOT NULL,
  memory_total_gb DECIMAL(10, 2) NOT NULL,
  storage_slots_total INTEGER NOT NULL,

  hostname VARCHAR(50) NOT NULL DEFAULT '_unLAB',

  ntp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ntp_servers TEXT[] NOT NULL DEFAULT ARRAY['time.unstablelabs.io', 'pool.ntp.org'],
  ntp_interval_seconds INTEGER NOT NULL DEFAULT 3600,
  last_ntp_sync TIMESTAMPTZ,

  dns_servers TEXT[] NOT NULL DEFAULT ARRAY['8.8.8.8', '1.1.1.1'],
  dns_search_domain VARCHAR(100) DEFAULT 'unstablelabs.local',

  firewall_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  firewall_default_incoming VARCHAR(10) NOT NULL DEFAULT 'deny',
  firewall_default_outgoing VARCHAR(10) NOT NULL DEFAULT 'allow',
  firewall_allowed_ports TEXT[] NOT NULL DEFAULT ARRAY['443/tcp', '8080/tcp', '3000/tcp'],

  game_server_url VARCHAR(255) NOT NULL DEFAULT 'wss://api.unstablelabs.io/v1',
  blockchain_proxy_url VARCHAR(255) NOT NULL DEFAULT 'https://chain.unstablelabs.io',
  oracle_feed_url VARCHAR(255) NOT NULL DEFAULT 'wss://oracle.unstablelabs.io/volatility',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_system_config_singleton ON system_config_cache ((TRUE));

CREATE TRIGGER system_config_updated
  BEFORE UPDATE ON system_config_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_syspref_timestamp();

-- ============================================================================
-- 6. PREFERENCE CHANGE AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS syspref_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  area VARCHAR(20) NOT NULL CHECK (
    area IN ('display', 'sound', 'datetime', 'network', 'user', 'system')
  ),
  setting_key VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,

  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  change_reason VARCHAR(255),
  ip_address INET,

  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_syspref_audit_player ON syspref_audit_log(player_id);
CREATE INDEX IF NOT EXISTS idx_syspref_audit_area ON syspref_audit_log(area);
CREATE INDEX IF NOT EXISTS idx_syspref_audit_time ON syspref_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_syspref_audit_changed_by ON syspref_audit_log(changed_by);

-- ============================================================================
-- 7. USER SECURITY POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_security_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  min_password_length INTEGER NOT NULL DEFAULT 8 CHECK (
    min_password_length >= 4 AND min_password_length <= 128
  ),
  require_special_char BOOLEAN NOT NULL DEFAULT FALSE,
  require_uppercase BOOLEAN NOT NULL DEFAULT FALSE,
  require_number BOOLEAN NOT NULL DEFAULT FALSE,
  password_expiry_days INTEGER DEFAULT NULL,

  max_login_attempts INTEGER NOT NULL DEFAULT 5 CHECK (
    max_login_attempts >= 1 AND max_login_attempts <= 20
  ),
  lockout_duration_seconds INTEGER NOT NULL DEFAULT 300 CHECK (
    lockout_duration_seconds >= 60 AND lockout_duration_seconds <= 86400
  ),

  session_timeout_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (
    session_timeout_seconds >= 300 AND session_timeout_seconds <= 86400
  ),
  max_concurrent_sessions INTEGER NOT NULL DEFAULT 5 CHECK (
    max_concurrent_sessions >= 1 AND max_concurrent_sessions <= 20
  ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_security_policies_singleton ON user_security_policies ((TRUE));

CREATE TRIGGER security_policies_updated
  BEFORE UPDATE ON user_security_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_syspref_timestamp();

-- ============================================================================
-- 8. DISPLAY THEMES
-- ============================================================================

CREATE TABLE IF NOT EXISTS display_themes (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  primary_color VARCHAR(7) NOT NULL,
  secondary_color VARCHAR(7) NOT NULL,
  background_color VARCHAR(7) NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO display_themes (id, name, primary_color, secondary_color, background_color, description, is_default, sort_order)
VALUES
  ('green', 'Phosphor Green', '#00FF41', '#33FF33', '#0A0A0A', 'Classic CRT phosphor green', TRUE, 1),
  ('amber', 'Amber Gold', '#FFAA00', '#FFD700', '#0A0A0A', 'Warm amber terminal', FALSE, 2),
  ('cyan', 'Cool Cyan', '#00FFFF', '#66FFFF', '#0A0A0A', 'Futuristic cyan', FALSE, 3),
  ('white', 'Matrix White', '#FFFFFF', '#CCCCCC', '#000000', 'High contrast white', FALSE, 4),
  ('red', 'Warning Red', '#FF3300', '#FF6666', '#0A0A0A', 'Alert red theme', FALSE, 5),
  ('purple', 'Quantum Purple', '#9D00FF', '#CC66FF', '#0A0A0A', 'Exotic quantum purple', FALSE, 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. DISPLAY FONTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS display_fonts (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  style VARCHAR(30) NOT NULL,
  license VARCHAR(20) NOT NULL,
  css_import_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO display_fonts (id, name, style, license, is_default, sort_order)
VALUES
  ('amiga-forever', 'Amiga Forever Pro2', 'Pixel Monospace', 'Bundled', TRUE, 1),
  ('ibm-plex', 'IBM Plex Mono', 'Modern Monospace', 'OFL', FALSE, 2),
  ('jetbrains', 'JetBrains Mono', 'Developer', 'OFL', FALSE, 3),
  ('fira-code', 'Fira Code', 'Ligatures', 'OFL', FALSE, 4),
  ('vt323', 'VT323', 'Retro CRT', 'OFL', FALSE, 5),
  ('share-tech', 'Share Tech Mono', 'Tech', 'OFL', FALSE, 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. SOUND PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS sound_profiles (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  settings JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sound_profiles (id, name, description, settings, is_default, sort_order)
VALUES
  ('standard', 'Standard', 'Default balanced sound set', '{
    "terminal_clicks": true,
    "command_beeps": true,
    "error_buzzer": true,
    "background_hum": true,
    "notifications": true
  }'::jsonb, TRUE, 1),
  ('retro', 'Retro', '8-bit chiptune style', '{
    "terminal_clicks": true,
    "command_beeps": true,
    "error_buzzer": true,
    "background_hum": false,
    "notifications": true,
    "sound_pack": "8bit"
  }'::jsonb, FALSE, 2),
  ('minimal', 'Minimal', 'Subtle quiet feedback', '{
    "terminal_clicks": false,
    "command_beeps": true,
    "error_buzzer": true,
    "background_hum": false,
    "notifications": true,
    "volume_modifier": 0.5
  }'::jsonb, FALSE, 3),
  ('scifi', 'Sci-Fi', 'Futuristic effects', '{
    "terminal_clicks": true,
    "command_beeps": true,
    "error_buzzer": true,
    "background_hum": true,
    "notifications": true,
    "sound_pack": "scifi"
  }'::jsonb, FALSE, 4),
  ('silent', 'Silent', 'No audio output', '{
    "terminal_clicks": false,
    "command_beeps": false,
    "error_buzzer": false,
    "background_hum": false,
    "notifications": false,
    "muted": true
  }'::jsonb, FALSE, 5)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 11. VIEW: COMBINED PLAYER PREFERENCES
-- ============================================================================

CREATE OR REPLACE VIEW player_all_prefs AS
SELECT
  p.id AS player_id,
  p.username,
  dp.theme,
  dp.primary_color,
  dp.effect_scanlines,
  dp.effect_curvature,
  dp.font_family,
  dp.font_size,
  dp.plain_mode,
  sp.master_volume,
  sp.muted,
  sp.sound_profile,
  sp.terminal_clicks,
  sp.background_hum,
  dtp.timezone,
  dtp.time_format,
  dtp.date_format,
  np.auto_reconnect,
  np.preferred_region
FROM profiles p
LEFT JOIN player_display_prefs dp ON p.id = dp.player_id
LEFT JOIN player_sound_prefs sp ON p.id = sp.player_id
LEFT JOIN player_datetime_prefs dtp ON p.id = dtp.player_id
LEFT JOIN player_network_prefs np ON p.id = np.player_id;

-- ============================================================================
-- 12. HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_player_prefs(p_player_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO player_display_prefs (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  INSERT INTO player_sound_prefs (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  INSERT INTO player_datetime_prefs (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  INSERT INTO player_network_prefs (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_pref_change(
  p_player_id UUID,
  p_area VARCHAR(20),
  p_key VARCHAR(100),
  p_old_value TEXT,
  p_new_value TEXT,
  p_changed_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO syspref_audit_log (player_id, area, setting_key, old_value, new_value, changed_by)
  VALUES (p_player_id, p_area, p_key, p_old_value, p_new_value, p_changed_by)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reset_player_prefs(p_player_id UUID, p_area VARCHAR(20) DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  IF p_area IS NULL OR p_area = 'display' THEN
    DELETE FROM player_display_prefs WHERE player_id = p_player_id;
    INSERT INTO player_display_prefs (player_id) VALUES (p_player_id);
  END IF;

  IF p_area IS NULL OR p_area = 'sound' THEN
    DELETE FROM player_sound_prefs WHERE player_id = p_player_id;
    INSERT INTO player_sound_prefs (player_id) VALUES (p_player_id);
  END IF;

  IF p_area IS NULL OR p_area = 'datetime' THEN
    DELETE FROM player_datetime_prefs WHERE player_id = p_player_id;
    INSERT INTO player_datetime_prefs (player_id) VALUES (p_player_id);
  END IF;

  IF p_area IS NULL OR p_area = 'network' THEN
    DELETE FROM player_network_prefs WHERE player_id = p_player_id;
    INSERT INTO player_network_prefs (player_id) VALUES (p_player_id);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 13. SEED DATA
-- ============================================================================

INSERT INTO system_config_cache (
  os_version, os_codename, os_build, kernel_version,
  cpu_model, cpu_cores, memory_total_gb, storage_slots_total,
  hostname
)
VALUES (
  '2.0.0', 'Quantum', '2026.02.01-stable', '6.1.0-unOS-custom',
  'Virtual Quantum Core', 8, 4.0, 100,
  '_unLAB'
)
ON CONFLICT DO NOTHING;

INSERT INTO user_security_policies (
  min_password_length, require_special_char, max_login_attempts,
  lockout_duration_seconds, session_timeout_seconds
)
VALUES (8, FALSE, 5, 300, 3600)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 14. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE player_display_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_sound_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_datetime_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_network_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE syspref_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE display_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE display_fonts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_profiles ENABLE ROW LEVEL SECURITY;

-- Player pref tables: owner read/write
CREATE POLICY "Players can read own display prefs" ON player_display_prefs
  FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players can update own display prefs" ON player_display_prefs
  FOR UPDATE USING (auth.uid() = player_id);
CREATE POLICY "Players can insert own display prefs" ON player_display_prefs
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can read own sound prefs" ON player_sound_prefs
  FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players can update own sound prefs" ON player_sound_prefs
  FOR UPDATE USING (auth.uid() = player_id);
CREATE POLICY "Players can insert own sound prefs" ON player_sound_prefs
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can read own datetime prefs" ON player_datetime_prefs
  FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players can update own datetime prefs" ON player_datetime_prefs
  FOR UPDATE USING (auth.uid() = player_id);
CREATE POLICY "Players can insert own datetime prefs" ON player_datetime_prefs
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can read own network prefs" ON player_network_prefs
  FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players can update own network prefs" ON player_network_prefs
  FOR UPDATE USING (auth.uid() = player_id);
CREATE POLICY "Players can insert own network prefs" ON player_network_prefs
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Reference tables: public read
CREATE POLICY "Anyone can read system config" ON system_config_cache
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read security policies" ON user_security_policies
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read themes" ON display_themes
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read fonts" ON display_fonts
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read sound profiles" ON sound_profiles
  FOR SELECT USING (true);

-- Audit log: player-owned read, system insert
CREATE POLICY "Players can read own audit log" ON syspref_audit_log
  FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "System can insert audit log" ON syspref_audit_log
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 15. TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE player_display_prefs IS 'Display and visual preferences per player';
COMMENT ON TABLE player_sound_prefs IS 'Audio and sound preferences per player';
COMMENT ON TABLE player_datetime_prefs IS 'Date/time format preferences per player';
COMMENT ON TABLE player_network_prefs IS 'User-configurable network preferences per player';
COMMENT ON TABLE system_config_cache IS 'Cached system configuration (read-only for users)';
COMMENT ON TABLE syspref_audit_log IS 'Audit log of all preference changes';
COMMENT ON TABLE user_security_policies IS 'System-wide security policy settings';
COMMENT ON TABLE display_themes IS 'Available display theme options';
COMMENT ON TABLE display_fonts IS 'Available font options';
COMMENT ON TABLE sound_profiles IS 'Predefined sound profile configurations';
