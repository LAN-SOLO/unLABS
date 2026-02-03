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

CREATE POLICY "No player inserts to registry"
  ON unapp_registry FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No player updates to registry"
  ON unapp_registry FOR UPDATE
  USING (false);

CREATE POLICY "No player deletes from registry"
  ON unapp_registry FOR DELETE
  USING (false);

-- ============================================================
-- 2. PLAYER APPS - Add missing policies
-- ============================================================

-- Already has RLS enabled, add explicit policies if missing
DO $$
BEGIN
  -- Check if SELECT policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'player_apps' AND policyname LIKE '%select%'
  ) THEN
    EXECUTE 'CREATE POLICY "Players view own apps" ON player_apps FOR SELECT USING (auth.uid() = player_id)';
  END IF;
END $$;

CREATE POLICY "Players insert own apps"
  ON player_apps FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players update own apps"
  ON player_apps FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY "Players delete own apps"
  ON player_apps FOR DELETE
  USING (auth.uid() = player_id);

-- ============================================================
-- 3. PLAYER APP CONFIG - Player can only manage own config
-- ============================================================

ALTER TABLE player_app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own app config"
  ON player_app_config FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players insert own app config"
  ON player_app_config FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players update own app config"
  ON player_app_config FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY "Players delete own app config"
  ON player_app_config FOR DELETE
  USING (auth.uid() = player_id);

-- ============================================================
-- 4. UNAPP USAGE LOG - Player can only access own logs
-- ============================================================

ALTER TABLE unapp_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own usage logs"
  ON unapp_usage_log FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players insert own usage logs"
  ON unapp_usage_log FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- No UPDATE/DELETE - usage logs are append-only

-- ============================================================
-- 5. DEVICE FIRMWARE - Public read-only (game data)
-- ============================================================

ALTER TABLE device_firmware ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Device firmware is public"
  ON device_firmware FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE for players - admin only

-- ============================================================
-- 6. PLAYER FIRMWARE STATE - Player can only access own state
-- ============================================================

ALTER TABLE player_firmware_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own firmware state"
  ON player_firmware_state FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players insert own firmware state"
  ON player_firmware_state FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players update own firmware state"
  ON player_firmware_state FOR UPDATE
  USING (auth.uid() = player_id);

-- No DELETE - firmware state tracks history

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN (
--   'unapp_registry', 'player_apps', 'player_app_config',
--   'unapp_usage_log', 'device_firmware', 'player_firmware_state'
-- ) ORDER BY tablename, cmd;
