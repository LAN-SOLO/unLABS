-- ============================================================
-- Security Fix: Complete RLS Policies for unapp System
-- Date: February 3, 2026
-- Severity: HIGH - Prevents unauthorized app manipulation
-- ============================================================

-- ============================================================
-- 1. UNAPP REGISTRY - Already has SELECT, add explicit denies
-- ============================================================

-- Registry should be read-only for authenticated users
-- INSERT/UPDATE/DELETE should be blocked (admin-only via service role)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unapp_registry' AND policyname = 'No player inserts to registry') THEN
    CREATE POLICY "No player inserts to registry" ON unapp_registry FOR INSERT WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unapp_registry' AND policyname = 'No player updates to registry') THEN
    CREATE POLICY "No player updates to registry" ON unapp_registry FOR UPDATE USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unapp_registry' AND policyname = 'No player deletes from registry') THEN
    CREATE POLICY "No player deletes from registry" ON unapp_registry FOR DELETE USING (false);
  END IF;
END $$;

-- ============================================================
-- 2. PLAYER APPS - Add missing policies
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_apps' AND policyname = 'Players view own apps') THEN
    CREATE POLICY "Players view own apps" ON player_apps FOR SELECT USING (auth.uid() = player_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_apps' AND policyname = 'Players insert own apps') THEN
    CREATE POLICY "Players insert own apps" ON player_apps FOR INSERT WITH CHECK (auth.uid() = player_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_apps' AND policyname = 'Players update own apps') THEN
    CREATE POLICY "Players update own apps" ON player_apps FOR UPDATE USING (auth.uid() = player_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_apps' AND policyname = 'Players delete own apps') THEN
    CREATE POLICY "Players delete own apps" ON player_apps FOR DELETE USING (auth.uid() = player_id);
  END IF;
END $$;

-- ============================================================
-- 3. PLAYER APP CONFIG - Player can only manage own config
-- ============================================================

ALTER TABLE IF EXISTS player_app_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_app_config' AND policyname = 'Players view own app config') THEN
    CREATE POLICY "Players view own app config" ON player_app_config FOR SELECT USING (auth.uid() = player_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_app_config' AND policyname = 'Players insert own app config') THEN
    CREATE POLICY "Players insert own app config" ON player_app_config FOR INSERT WITH CHECK (auth.uid() = player_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_app_config' AND policyname = 'Players update own app config') THEN
    CREATE POLICY "Players update own app config" ON player_app_config FOR UPDATE USING (auth.uid() = player_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_app_config' AND policyname = 'Players delete own app config') THEN
    CREATE POLICY "Players delete own app config" ON player_app_config FOR DELETE USING (auth.uid() = player_id);
  END IF;
END $$;

-- ============================================================
-- 4. UNAPP USAGE LOG - Player can only access own logs
-- ============================================================

ALTER TABLE IF EXISTS unapp_usage_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unapp_usage_log' AND policyname = 'Players view own usage logs') THEN
    CREATE POLICY "Players view own usage logs" ON unapp_usage_log FOR SELECT USING (auth.uid() = player_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unapp_usage_log' AND policyname = 'Players insert own usage logs') THEN
    CREATE POLICY "Players insert own usage logs" ON unapp_usage_log FOR INSERT WITH CHECK (auth.uid() = player_id);
  END IF;
END $$;

-- No UPDATE/DELETE - usage logs are append-only

-- ============================================================
-- 5. DEVICE FIRMWARE - Public read-only (game data)
-- ============================================================

ALTER TABLE IF EXISTS device_firmware ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'device_firmware' AND policyname = 'Device firmware is public') THEN
    CREATE POLICY "Device firmware is public" ON device_firmware FOR SELECT USING (true);
  END IF;
END $$;

-- No INSERT/UPDATE/DELETE for players - admin only

-- ============================================================
-- 6. PLAYER FIRMWARE STATE - Player can only access own state
-- ============================================================

ALTER TABLE IF EXISTS player_firmware_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_firmware_state' AND policyname = 'Players view own firmware state') THEN
    CREATE POLICY "Players view own firmware state" ON player_firmware_state FOR SELECT USING (auth.uid() = player_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_firmware_state' AND policyname = 'Players insert own firmware state') THEN
    CREATE POLICY "Players insert own firmware state" ON player_firmware_state FOR INSERT WITH CHECK (auth.uid() = player_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_firmware_state' AND policyname = 'Players update own firmware state') THEN
    CREATE POLICY "Players update own firmware state" ON player_firmware_state FOR UPDATE USING (auth.uid() = player_id);
  END IF;
END $$;

-- No DELETE - firmware state tracks history

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN (
--   'unapp_registry', 'player_apps', 'player_app_config',
--   'unapp_usage_log', 'device_firmware', 'player_firmware_state'
-- ) ORDER BY tablename, cmd;
