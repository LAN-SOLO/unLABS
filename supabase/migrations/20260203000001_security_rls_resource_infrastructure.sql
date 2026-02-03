-- ============================================================
-- Security Fix: RLS Policies for Resource Infrastructure
-- Date: February 3, 2026
-- Severity: CRITICAL - Prevents unauthorized data access
-- ============================================================

-- ============================================================
-- 1. BOOTSTRAP STATE - Player can only access own data
-- ============================================================

ALTER TABLE bootstrap_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own bootstrap state"
  ON bootstrap_state FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players update own bootstrap state"
  ON bootstrap_state FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY "Players insert own bootstrap state"
  ON bootstrap_state FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- No DELETE policy - bootstrap state should not be deleted

-- ============================================================
-- 2. RESOURCE CONTAINERS - Player can only access own containers
-- ============================================================

ALTER TABLE resource_containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own containers"
  ON resource_containers FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players update own containers"
  ON resource_containers FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY "Players insert own containers"
  ON resource_containers FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players delete own containers"
  ON resource_containers FOR DELETE
  USING (auth.uid() = player_id);

-- ============================================================
-- 3. CONTAINER DEFINITIONS - Public read-only (game data)
-- ============================================================

ALTER TABLE container_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Container definitions are public"
  ON container_definitions FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE for players - admin only

-- ============================================================
-- 4. PRODUCTION QUEUE - Player can only access own jobs
-- ============================================================

ALTER TABLE production_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own production queue"
  ON production_queue FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players update own production queue"
  ON production_queue FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY "Players insert own production jobs"
  ON production_queue FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players delete own production jobs"
  ON production_queue FOR DELETE
  USING (auth.uid() = player_id);

-- ============================================================
-- 5. PRODUCTION RECIPES - Public read-only (game data)
-- ============================================================

ALTER TABLE production_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Production recipes are public"
  ON production_recipes FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE for players - admin only

-- ============================================================
-- 6. STARTER PACKS - Public read-only (store data)
-- ============================================================

ALTER TABLE starter_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Starter packs are public"
  ON starter_packs FOR SELECT
  USING (active = true);

-- No INSERT/UPDATE/DELETE for players - admin only

-- ============================================================
-- 7. PACK PURCHASES - Player can only access own purchases
-- ============================================================

ALTER TABLE pack_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own pack purchases"
  ON pack_purchases FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players insert own pack purchases"
  ON pack_purchases FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- No UPDATE/DELETE - purchases are immutable

-- ============================================================
-- 8. CONTAINER UPGRADES - Player can only access own upgrades
-- ============================================================

ALTER TABLE container_upgrades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own container upgrades"
  ON container_upgrades FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players insert own container upgrades"
  ON container_upgrades FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- No UPDATE/DELETE - upgrade history is immutable

-- ============================================================
-- 9. ABSTRACTUM SOURCES - Player can only access own sources
-- ============================================================

ALTER TABLE abstractum_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own abstractum sources"
  ON abstractum_sources FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Players update own abstractum sources"
  ON abstractum_sources FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY "Players insert own abstractum sources"
  ON abstractum_sources FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players delete own abstractum sources"
  ON abstractum_sources FOR DELETE
  USING (auth.uid() = player_id);

-- ============================================================
-- 10. VIEWS - Inherit RLS from underlying tables
-- ============================================================
-- Views automatically inherit RLS from the tables they query,
-- so v_player_resources and v_active_production are already secure.

-- ============================================================
-- VERIFICATION
-- Run after migration to confirm RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename IN (
--   'bootstrap_state', 'resource_containers', 'container_definitions',
--   'production_queue', 'production_recipes', 'starter_packs',
--   'pack_purchases', 'container_upgrades', 'abstractum_sources'
-- );
-- ============================================================
