-- ============================================================================
-- _unOS Application Manager (unapp) - Database Schema
-- Version: 1.0
-- Patched: players(id) → profiles(id), device_state → player_device_state
-- ============================================================================

-- Cleanup from any prior partial run (tables first, CASCADE handles triggers)
DROP TABLE IF EXISTS unapp_usage_log CASCADE;
DROP TABLE IF EXISTS player_app_config CASCADE;
DROP TABLE IF EXISTS player_apps CASCADE;
DROP TABLE IF EXISTS player_firmware_state CASCADE;
DROP TABLE IF EXISTS device_firmware CASCADE;
DROP TABLE IF EXISTS unapp_registry CASCADE;
DROP FUNCTION IF EXISTS update_unapp_registry_timestamp();
DROP FUNCTION IF EXISTS update_player_apps_timestamp();
DROP FUNCTION IF EXISTS auto_install_device_app();
DROP FUNCTION IF EXISTS get_player_apps(UUID);

-- ============================================================================
-- 1. APPLICATION REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS unapp_registry (
  app_id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description TEXT,
  version VARCHAR(15) NOT NULL DEFAULT '1.0.0',
  category VARCHAR(10) NOT NULL CHECK (
    category IN ('dev', 'sys', 'util')
  ),
  device_id VARCHAR(10) ,  -- device_id is a soft reference (devices table may not exist yet)
  tech_tree VARCHAR(30),
  tier_required INTEGER DEFAULT 0,
  min_unos_version VARCHAR(15) DEFAULT '2.0.0',
  dependencies TEXT[] DEFAULT '{}',
  modules TEXT[] NOT NULL DEFAULT '{}',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  auto_install BOOLEAN NOT NULL DEFAULT TRUE,
  size_kb INTEGER DEFAULT 0,
  author VARCHAR(50) DEFAULT 'UnstableLabs',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unapp_registry_category ON unapp_registry(category);
CREATE INDEX IF NOT EXISTS idx_unapp_registry_device ON unapp_registry(device_id);

CREATE OR REPLACE FUNCTION update_unapp_registry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER unapp_registry_updated
  BEFORE UPDATE ON unapp_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_unapp_registry_timestamp();

-- ============================================================================
-- 2. PLAYER INSTALLED APPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  app_id VARCHAR(10) NOT NULL REFERENCES unapp_registry(app_id),
  state VARCHAR(15) NOT NULL DEFAULT 'installed' CHECK (
    state IN ('installing', 'installed', 'running', 'updating', 'disabled', 'error')
  ),
  installed_version VARCHAR(15) NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_launched_at TIMESTAMPTZ,
  total_launches INTEGER NOT NULL DEFAULT 0,
  total_runtime_seconds INTEGER NOT NULL DEFAULT 0,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_player_apps_player ON player_apps(player_id);
CREATE INDEX IF NOT EXISTS idx_player_apps_state ON player_apps(state);
CREATE INDEX IF NOT EXISTS idx_player_apps_favorite ON player_apps(player_id, is_favorite) WHERE is_favorite = TRUE;

CREATE OR REPLACE FUNCTION update_player_apps_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_apps_updated
  BEFORE UPDATE ON player_apps
  FOR EACH ROW
  EXECUTE FUNCTION update_player_apps_timestamp();

-- ============================================================================
-- 3. APP CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  app_id VARCHAR(10) NOT NULL REFERENCES unapp_registry(app_id),
  config_key VARCHAR(100) NOT NULL,
  config_value JSONB NOT NULL DEFAULT '{}',
  preset_name VARCHAR(50),
  is_active_preset BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, app_id, config_key)
);

CREATE INDEX IF NOT EXISTS idx_app_config_player_app ON player_app_config(player_id, app_id);
CREATE INDEX IF NOT EXISTS idx_app_config_preset ON player_app_config(player_id, app_id, is_active_preset)
  WHERE is_active_preset = TRUE;

-- ============================================================================
-- 4. APP USAGE ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS unapp_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  app_id VARCHAR(10) NOT NULL REFERENCES unapp_registry(app_id),
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  duration_seconds INTEGER,
  modules_accessed TEXT[] DEFAULT '{}',
  actions_performed JSONB DEFAULT '[]',
  launch_source VARCHAR(20) CHECK (
    launch_source IN ('unapp', 'undev', 'alias', 'shortcut', 'auto')
  )
);

CREATE INDEX IF NOT EXISTS idx_usage_player ON unapp_usage_log(player_id);
CREATE INDEX IF NOT EXISTS idx_usage_app ON unapp_usage_log(app_id);
CREATE INDEX IF NOT EXISTS idx_usage_time ON unapp_usage_log(session_start DESC);

-- ============================================================================
-- 5. FIRMWARE REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_firmware (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(10) NOT NULL ,  -- device_id is a soft reference (devices table may not exist yet)
  version VARCHAR(15) NOT NULL,
  build_tag VARCHAR(50),
  release_date TIMESTAMPTZ NOT NULL,
  changelog TEXT,
  size_kb INTEGER DEFAULT 0,
  checksum VARCHAR(128),
  min_tier INTEGER DEFAULT 1,
  requires_reboot BOOLEAN DEFAULT TRUE,
  is_latest BOOLEAN NOT NULL DEFAULT FALSE,
  is_stable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, version)
);

CREATE INDEX IF NOT EXISTS idx_firmware_device ON device_firmware(device_id);
CREATE INDEX IF NOT EXISTS idx_firmware_latest ON device_firmware(device_id, is_latest) WHERE is_latest = TRUE;

-- ============================================================================
-- 6. PLAYER FIRMWARE STATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_firmware_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id VARCHAR(10) NOT NULL ,  -- device_id is a soft reference (devices table may not exist yet)
  current_version VARCHAR(15) NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  update_available BOOLEAN NOT NULL DEFAULT FALSE,
  available_version VARCHAR(15),
  previous_version VARCHAR(15),
  rollback_available BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_firmware_state_player ON player_firmware_state(player_id);
CREATE INDEX IF NOT EXISTS idx_firmware_state_updates ON player_firmware_state(update_available) WHERE update_available = TRUE;

-- ============================================================================
-- 7. SEED DATA
-- ============================================================================

-- Power Generator Apps (3)
INSERT INTO unapp_registry (app_id, name, description, category, device_id, tech_tree, tier_required, modules, permissions, size_kb) VALUES
  ('UEC-001', 'Energy Core Controller', 'Monitor, configure, and manage the Unstable Energy Core', 'dev', 'UEC-001', 'Tech', 1, ARRAY['status','config','diagnostics','firmware','output-control','cascade-monitor','efficiency-analyzer'], ARRAY['device-read','device-write','power-control'], 24),
  ('MFR-001', 'Fusion Reactor Console', 'Complete control interface for the Microfusion Reactor', 'dev', 'MFR-001', 'Tech', 2, ARRAY['status','config','diagnostics','firmware','plasma-containment','ignition-control','fusion-metrics','thermal-link'], ARRAY['device-read','device-write','power-control'], 32),
  ('BAT-001', 'Battery Management System', 'Monitor and manage battery charge cycles and health', 'dev', 'BAT-001', 'Gadgets', 1, ARRAY['status','config','diagnostics','firmware','charge-manager','cell-health','field-mode'], ARRAY['device-read','device-write'], 20);

-- Heavy Consumer Apps (8)
INSERT INTO unapp_registry (app_id, name, description, category, device_id, tech_tree, tier_required, modules, permissions, size_kb) VALUES
  ('SCA-001', 'Supercomputer Dashboard', 'Job management and performance monitoring for the Supercomputer Array', 'dev', 'SCA-001', 'Tech', 3, ARRAY['status','config','diagnostics','firmware','job-manager','core-allocator','benchmark-suite','cluster-monitor'], ARRAY['device-read','device-write'], 48),
  ('AIC-001', 'AI Core Interface', 'AI model management and inference monitoring', 'dev', 'AIC-001', 'Tech', 2, ARRAY['status','config','diagnostics','firmware','model-manager','inference-monitor','learning-analytics','persona-config'], ARRAY['device-read','device-write'], 36),
  ('EXD-001', 'Drone Control Center', 'Mission planning, cargo management, and exploration mapping', 'dev', 'EXD-001', 'Gadgets', 2, ARRAY['status','config','diagnostics','firmware','flight-planner','cargo-manager','mission-log','exploration-map','high-speed-mode'], ARRAY['device-read','device-write'], 52),
  ('EMC-001', 'Containment Field Manager', 'Exotic matter containment monitoring and safety management', 'dev', 'EMC-001', 'Refine', 4, ARRAY['status','config','diagnostics','firmware','field-integrity','breach-protocol','sample-manager','safety-interlock'], ARRAY['device-read','device-write','power-control'], 40),
  ('TLP-001', 'Teleport Pad Controller', 'Coordinate management and teleportation control', 'dev', 'TLP-001', 'Gadgets', 2, ARRAY['status','config','diagnostics','firmware','coordinate-manager','teleport-history','energy-calculator','safety-interlock'], ARRAY['device-read','device-write'], 36),
  ('LCT-001', 'Precision Laser Console', 'Laser calibration, cutting profiles, and material processing', 'dev', 'LCT-001', 'Tools', 2, ARRAY['status','config','diagnostics','firmware','beam-calibration','cutting-profiles','material-database','burst-controller'], ARRAY['device-read','device-write'], 32),
  ('P3D-001', '3D Fabricator Studio', 'Print queue, material library, and quality management', 'dev', 'P3D-001', 'Tools', 2, ARRAY['status','config','diagnostics','firmware','print-queue','material-library','quality-presets','model-viewer','job-history'], ARRAY['device-read','device-write'], 48),
  ('QAN-001', 'Quantum Analyzer Lab', 'Quantum measurement, analysis, and entanglement tracking', 'dev', 'QAN-001', 'Science', 3, ARRAY['status','config','diagnostics','firmware','analysis-queue','state-viewer','measurement-history','entanglement-map'], ARRAY['device-read','device-write'], 44);

-- Medium Consumer Apps (8)
INSERT INTO unapp_registry (app_id, name, description, category, device_id, tech_tree, tier_required, modules, permissions, size_kb) VALUES
  ('CDC-001', 'Crystal Data Manager', 'Data storage analytics and research archive management', 'dev', 'CDC-001', 'Tech', 1, ARRAY['status','config','diagnostics','firmware','storage-analytics','data-browser','archive-manager','io-monitor'], ARRAY['device-read','device-write'], 28),
  ('HMS-001', 'Synthesizer Workshop', 'Sound synthesis patch editing and waveform design', 'dev', 'HMS-001', 'Music', 1, ARRAY['status','config','diagnostics','firmware','patch-editor','oscillator-bank','waveform-designer','preset-library','resonance-mode'], ARRAY['device-read','device-write'], 40),
  ('ECR-001', 'Echo Recorder Studio', 'Sound recording, loop editing, and playback control', 'dev', 'ECR-001', 'Music', 1, ARRAY['status','config','diagnostics','firmware','session-manager','loop-editor','playback-controls','sound-library'], ARRAY['device-read','device-write'], 32),
  ('INT-001', 'Interpolation Engine', 'Data interpolation algorithms and processing pipelines', 'dev', 'INT-001', 'Tech', 1, ARRAY['status','config','diagnostics','firmware','algorithm-selector','data-pipeline','processing-queue','visualization'], ARRAY['device-read','device-write'], 24),
  ('QSM-001', 'Quantum State Console', 'Quantum coherence tracking and decoherence monitoring', 'dev', 'QSM-001', 'Science', 2, ARRAY['status','config','diagnostics','firmware','coherence-tracker','decoherence-alerts','state-history','prediction-model'], ARRAY['device-read','device-write'], 36),
  ('AND-001', 'Anomaly Detection Hub', 'Anomaly scanning, detection mapping, and classification', 'dev', 'AND-001', 'Gadgets', 2, ARRAY['status','config','diagnostics','firmware','scanner-interface','detection-map','alert-config','anomaly-database','deep-scan'], ARRAY['device-read','device-write'], 40),
  ('RMG-001', 'Resource Magnet Control', 'Resource collection field configuration and analytics', 'dev', 'RMG-001', 'Gadgets', 1, ARRAY['status','config','diagnostics','firmware','pull-radius','collection-stats','material-filter','efficiency-optimizer'], ARRAY['device-read','device-write'], 20),
  ('OSC-001', 'Oscilloscope Workstation', 'Waveform display, trigger settings, and signal analysis', 'dev', 'OSC-001', 'Science', 1, ARRAY['status','config','diagnostics','firmware','waveform-display','trigger-settings','measurement-tools','capture-export'], ARRAY['device-read','device-write'], 28);

-- Light Consumer Apps (17)
INSERT INTO unapp_registry (app_id, name, description, category, device_id, tech_tree, tier_required, modules, permissions, size_kb) VALUES
  ('ATK-001', 'Abstractum Tank Monitor', 'Tank levels, transfer controls, and purity monitoring', 'dev', 'ATK-001', 'Refine', 1, ARRAY['status','config','diagnostics','firmware','tank-levels','transfer-controls','purity-monitor','flow-analytics'], ARRAY['device-read','device-write'], 16),
  ('VNT-001', 'Ventilation Controller', 'Airflow control, filter management, and zone configuration', 'dev', 'VNT-001', NULL, 0, ARRAY['status','config','diagnostics','firmware','airflow-control','filter-status','environment-readings','zone-manager'], ARRAY['device-read','device-write'], 16),
  ('SPK-001', 'Speaker Audio Manager', 'Audio channel routing, EQ, and volume management', 'dev', 'SPK-001', 'Music', 1, ARRAY['status','config','diagnostics','firmware','channel-routing','equalizer','volume-control','frequency-response'], ARRAY['device-read','device-write'], 16),
  ('NET-001', 'Network Monitor Console', 'Network traffic analysis and peer monitoring', 'dev', 'NET-001', 'Tech', 1, ARRAY['status','config','diagnostics','firmware','traffic-analytics','latency-monitor','peer-connections','bandwidth-usage'], ARRAY['device-read','device-write'], 20),
  ('TMP-001', 'Temperature Monitor App', 'Lab-wide temperature monitoring and alerts', 'dev', 'TMP-001', NULL, 0, ARRAY['status','config','diagnostics','firmware','sensor-readings','alert-thresholds','heatmap-display','history-charts'], ARRAY['device-read'], 12),
  ('DIM-001', 'Dimension Monitor Console', 'Dimensional stability and rift detection monitoring', 'dev', 'DIM-001', 'Science', 2, ARRAY['status','config','diagnostics','firmware','stability-meter','rift-detection','spatial-measurements','drift-log'], ARRAY['device-read','device-write'], 20),
  ('CPU-001', 'CPU Monitor Dashboard', 'CPU core loads, process list, and performance history', 'dev', 'CPU-001', 'Tech', 1, ARRAY['status','config','diagnostics','firmware','core-loads','process-list','thread-analyzer','performance-history'], ARRAY['device-read','system-read'], 16),
  ('CLK-001', 'Lab Clock Manager', 'Timer management, alarms, and time synchronization', 'dev', 'CLK-001', NULL, 0, ARRAY['status','config','diagnostics','firmware','timer-management','alarm-scheduler','time-sync','countdown-display'], ARRAY['device-read','device-write'], 12),
  ('MEM-001', 'Memory Monitor App', 'Memory usage analytics, allocation, and cache monitoring', 'dev', 'MEM-001', 'Tech', 1, ARRAY['status','config','diagnostics','firmware','usage-analytics','allocation-map','cache-stats','swap-monitor'], ARRAY['device-read','system-read'], 14),
  ('QCP-001', 'Quantum Compass Navigator', 'Bearing readings, anomaly proximity, and waypoint navigation', 'dev', 'QCP-001', 'Gadgets', 1, ARRAY['status','config','diagnostics','firmware','bearing-readings','anomaly-proximity','navigation-mode','waypoint-manager'], ARRAY['device-read','device-write'], 18),
  ('DGN-001', 'Diagnostics Suite', 'Lab-wide diagnostics, health reports, and repair guidance', 'dev', 'DGN-001', NULL, 0, ARRAY['status','config','diagnostics','firmware','test-profiles','health-reports','repair-wizard','component-viewer'], ARRAY['device-read','system-read'], 20),
  ('THM-001', 'Thermal Management App', 'Thermal zone management and cooling control', 'dev', 'THM-001', NULL, 0, ARRAY['status','config','diagnostics','firmware','zone-mapping','cooling-control','heat-distribution','thermal-alerts'], ARRAY['device-read','device-write'], 16),
  ('BTK-001', 'Toolkit Manager', 'Tool inventory, maintenance scheduling, and calibration tracking', 'dev', 'BTK-001', 'Tools', 1, ARRAY['status','config','diagnostics','firmware','tool-inventory','maintenance-schedule','calibration-tracker','usage-log'], ARRAY['device-read','device-write'], 14),
  ('MSC-001', 'Material Scanner App', 'Material scanning, composition analysis, and database lookup', 'dev', 'MSC-001', 'Tools', 1, ARRAY['status','config','diagnostics','firmware','scan-interface','material-database','analysis-results','composition-log'], ARRAY['device-read','device-write'], 18),
  ('PWR-001', 'Power Management Console', 'Power routing, circuit management, and load balancing', 'dev', 'PWR-001', NULL, 0, ARRAY['status','config','diagnostics','firmware','power-routing','circuit-manager','load-balancing','efficiency-optimizer'], ARRAY['device-read','device-write','power-control'], 20),
  ('VLT-001', 'Volt Meter Monitor', 'Voltage monitoring, spike detection, and calibration', 'dev', 'VLT-001', NULL, 0, ARRAY['status','config','diagnostics','firmware','voltage-readings','history-charts','alert-config','calibration-tool'], ARRAY['device-read'], 10),
  ('PWD-001', 'Power Display Controller', 'Power flow visualization and custom dashboard creation', 'dev', 'PWD-001', NULL, 0, ARRAY['status','config','diagnostics','firmware','flow-visualization','consumption-breakdown','custom-dashboards','history-viewer'], ARRAY['device-read'], 14);

-- System Apps (4)
INSERT INTO unapp_registry (app_id, name, description, category, device_id, tech_tree, tier_required, modules, permissions, size_kb) VALUES
  ('SYS-LAB', 'Lab Dashboard', 'Central lab status overview, resources, and activity feed', 'sys', NULL, NULL, 0, ARRAY['overview','resource-summary','activity-feed','quick-actions'], ARRAY['system-read'], 24),
  ('SYS-PWR', 'Power Manager', 'System-wide power grid management and emergency controls', 'sys', NULL, NULL, 0, ARRAY['grid-overview','load-planner','emergency-controls','power-history'], ARRAY['system-read','power-control'], 28),
  ('SYS-RES', 'Research Console', 'Tech tree browser and research queue management', 'sys', NULL, NULL, 0, ARRAY['tree-browser','active-research','queue-manager','unlock-preview'], ARRAY['system-read'], 20),
  ('SYS-INV', 'Inventory Manager', 'Crystal and slice inventory management and trading helper', 'sys', NULL, NULL, 0, ARRAY['crystal-browser','slice-organizer','collection-stats','trade-helper'], ARRAY['system-read'], 22);

-- Utility Apps (3)
INSERT INTO unapp_registry (app_id, name, description, category, device_id, tech_tree, tier_required, modules, permissions, size_kb) VALUES
  ('UTL-LOG', 'Log Viewer', 'System and device log browser with search and export', 'util', NULL, NULL, 0, ARRAY['system-logs','device-logs','search-engine','export-tool'], ARRAY['system-read'], 16),
  ('UTL-CFG', 'Config Editor', 'System configuration browser and editor with validation', 'util', NULL, NULL, 0, ARRAY['config-browser','validation','backup-restore'], ARRAY['system-read','system-write'], 14),
  ('UTL-BAK', 'Backup Tool', 'Configuration and data backup with scheduled operations', 'util', NULL, NULL, 0, ARRAY['manual-backup','scheduled-backups','restore-points'], ARRAY['system-read','system-write'], 12);

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE player_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE unapp_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_firmware_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own apps"
  ON player_apps FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players manage own apps"
  ON player_apps FOR ALL USING (auth.uid() = player_id);

CREATE POLICY "Players view own config"
  ON player_app_config FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players manage own config"
  ON player_app_config FOR ALL USING (auth.uid() = player_id);

CREATE POLICY "Players view own usage"
  ON unapp_usage_log FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players insert own usage"
  ON unapp_usage_log FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players view own firmware"
  ON player_firmware_state FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players manage own firmware"
  ON player_firmware_state FOR ALL USING (auth.uid() = player_id);

ALTER TABLE unapp_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Registry readable by all"
  ON unapp_registry FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE device_firmware ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Firmware readable by all"
  ON device_firmware FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Auto-install app when device is unlocked
CREATE OR REPLACE FUNCTION auto_install_device_app()
RETURNS TRIGGER AS $$
DECLARE
  v_app RECORD;
BEGIN
  IF NEW.unlocked = TRUE AND (OLD.unlocked IS NULL OR OLD.unlocked = FALSE) THEN
    SELECT * INTO v_app FROM unapp_registry
    WHERE device_id = NEW.device_id AND auto_install = TRUE;

    IF FOUND THEN
      INSERT INTO player_apps (player_id, app_id, installed_version, state)
      VALUES (NEW.player_id, v_app.app_id, v_app.version, 'installed')
      ON CONFLICT (player_id, app_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger created conditionally: player_device_state may not exist yet
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_device_state') THEN
    CREATE TRIGGER device_unlock_auto_install
      AFTER INSERT OR UPDATE OF unlocked ON player_device_state
      FOR EACH ROW
      EXECUTE FUNCTION auto_install_device_app();
  END IF;
END $$;

-- Get player's installed apps with device state
CREATE OR REPLACE FUNCTION get_player_apps(p_player_id UUID)
RETURNS TABLE (
  app_id VARCHAR(10),
  app_name VARCHAR(80),
  app_category VARCHAR(10),
  device_id VARCHAR(10),
  device_state VARCHAR(15),
  app_state VARCHAR(15),
  installed_version VARCHAR(15),
  is_favorite BOOLEAN,
  total_launches INTEGER,
  last_launched_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.app_id,
    ur.name,
    ur.category,
    ur.device_id,
    'n/a'::VARCHAR(15) AS device_state,
    pa.state,
    pa.installed_version,
    pa.is_favorite,
    pa.total_launches,
    pa.last_launched_at
  FROM player_apps pa
  JOIN unapp_registry ur ON pa.app_id = ur.app_id
  WHERE pa.player_id = p_player_id
  ORDER BY pa.is_favorite DESC, ur.category, ur.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
