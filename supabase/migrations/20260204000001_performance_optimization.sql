-- ============================================================
-- Performance Optimization Migration
-- Date: February 4, 2026
-- Purpose: Indexes, trigger consolidation, delta-only audit,
--          incremental crystal stats, RLS dedup, view fix,
--          retention cleanup functions
-- Backwards-compatible: no schema changes, no data loss
-- ============================================================

-- ============================================================
-- 1. ADD MISSING INDEXES
-- Foreign keys and hot-path queries without index coverage
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_transactions_counterparty
  ON public.transactions(counterparty_id);

CREATE INDEX IF NOT EXISTS idx_transactions_crystal
  ON public.transactions(crystal_id);

CREATE INDEX IF NOT EXISTS idx_transactions_tech_tree
  ON public.transactions(tech_tree_id);

CREATE INDEX IF NOT EXISTS idx_container_upgrades_player
  ON public.container_upgrades(player_id);

CREATE INDEX IF NOT EXISTS idx_container_upgrades_container
  ON public.container_upgrades(container_id);

CREATE INDEX IF NOT EXISTS idx_production_recipe
  ON public.production_queue(recipe_id);

-- Covers auto_install_device_app() trigger query
CREATE INDEX IF NOT EXISTS idx_unapp_registry_auto_install
  ON public.unapp_registry(device_id, auto_install)
  WHERE auto_install = TRUE;

-- Covers v_active_production view filter
CREATE INDEX IF NOT EXISTS idx_production_status_completes
  ON public.production_queue(status, completes_at)
  WHERE status IN ('active', 'pending');

-- ============================================================
-- 2. CONSOLIDATE TIMESTAMP FUNCTIONS
-- 3 redundant copies of handle_updated_at() -> reuse the original
-- ============================================================

-- Reassign syspref triggers (6 triggers using update_syspref_timestamp)
DROP TRIGGER IF EXISTS display_prefs_updated ON public.player_display_prefs;
CREATE TRIGGER display_prefs_updated
  BEFORE UPDATE ON public.player_display_prefs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS sound_prefs_updated ON public.player_sound_prefs;
CREATE TRIGGER sound_prefs_updated
  BEFORE UPDATE ON public.player_sound_prefs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS datetime_prefs_updated ON public.player_datetime_prefs;
CREATE TRIGGER datetime_prefs_updated
  BEFORE UPDATE ON public.player_datetime_prefs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS network_prefs_updated ON public.player_network_prefs;
CREATE TRIGGER network_prefs_updated
  BEFORE UPDATE ON public.player_network_prefs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS system_config_updated ON public.system_config_cache;
CREATE TRIGGER system_config_updated
  BEFORE UPDATE ON public.system_config_cache
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS security_policies_updated ON public.user_security_policies;
CREATE TRIGGER security_policies_updated
  BEFORE UPDATE ON public.user_security_policies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Reassign unapp triggers (2 triggers using their own timestamp functions)
DROP TRIGGER IF EXISTS unapp_registry_updated ON public.unapp_registry;
CREATE TRIGGER unapp_registry_updated
  BEFORE UPDATE ON public.unapp_registry
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS player_apps_updated ON public.player_apps;
CREATE TRIGGER player_apps_updated
  BEFORE UPDATE ON public.player_apps
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Drop the 3 redundant functions
DROP FUNCTION IF EXISTS public.update_syspref_timestamp();
DROP FUNCTION IF EXISTS public.update_unapp_registry_timestamp();
DROP FUNCTION IF EXISTS public.update_player_apps_timestamp();

-- ============================================================
-- 3. OPTIMIZE AUDIT TRIGGER — DELTA-ONLY UPDATEs
-- Before: serializes entire OLD + NEW row on every UPDATE
-- After:  only stores columns that actually changed; skips
--         audit insert entirely if no columns differ
-- INSERT/DELETE behavior unchanged (full row logged)
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_data jsonb;
  v_new_data jsonb;
  v_record_id uuid;
  v_old_json jsonb;
  v_new_json jsonb;
  v_key text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;

  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);

  ELSE -- UPDATE: delta-only
    v_record_id := NEW.id;
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    v_old_data := '{}'::jsonb;
    v_new_data := '{}'::jsonb;

    FOR v_key IN SELECT key FROM jsonb_each(v_new_json)
    LOOP
      IF (v_old_json -> v_key) IS DISTINCT FROM (v_new_json -> v_key) THEN
        v_old_data := v_old_data || jsonb_build_object(v_key, v_old_json -> v_key);
        v_new_data := v_new_data || jsonb_build_object(v_key, v_new_json -> v_key);
      END IF;
    END LOOP;

    -- Skip audit entirely if nothing actually changed (idempotent SET col=col)
    IF v_old_data = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO audit_log (
    table_name, operation, record_id, user_id, old_data, new_data
  ) VALUES (
    TG_TABLE_NAME, TG_OP, v_record_id, auth.uid(), v_old_data, v_new_data
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ============================================================
-- 4. OPTIMIZE CRYSTAL STATS — INCREMENTAL DELTA
-- Before: SELECT COUNT(*), SUM(power) FROM slices (full scan)
-- After:  O(1) delta from trigger OLD/NEW records
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_crystal_stats()
RETURNS trigger AS $$
DECLARE
  v_power_delta numeric(10, 2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.crystals
    SET slice_count = slice_count + 1,
        total_power = GREATEST(
          total_power + CASE WHEN NEW.is_active THEN NEW.power ELSE 0 END, 0
        )
    WHERE id = NEW.crystal_id;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.crystals
    SET slice_count = GREATEST(slice_count - 1, 0),
        total_power = GREATEST(
          total_power - CASE WHEN OLD.is_active THEN OLD.power ELSE 0 END, 0
        )
    WHERE id = OLD.crystal_id;

    RETURN OLD;

  ELSE -- UPDATE
    IF OLD.crystal_id IS DISTINCT FROM NEW.crystal_id THEN
      -- Slice moved between crystals: decrement old, increment new
      UPDATE public.crystals
      SET slice_count = GREATEST(slice_count - 1, 0),
          total_power = GREATEST(
            total_power - CASE WHEN OLD.is_active THEN OLD.power ELSE 0 END, 0
          )
      WHERE id = OLD.crystal_id;

      UPDATE public.crystals
      SET slice_count = slice_count + 1,
          total_power = total_power + CASE WHEN NEW.is_active THEN NEW.power ELSE 0 END
      WHERE id = NEW.crystal_id;
    ELSE
      -- Same crystal: adjust power delta only
      v_power_delta := (CASE WHEN NEW.is_active THEN NEW.power ELSE 0 END)
                     - (CASE WHEN OLD.is_active THEN OLD.power ELSE 0 END);

      IF v_power_delta != 0 THEN
        UPDATE public.crystals
        SET total_power = GREATEST(total_power + v_power_delta, 0)
        WHERE id = NEW.crystal_id;
      END IF;
    END IF;

    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. REMOVE DUPLICATE RLS POLICIES
-- FOR SELECT is redundant when FOR ALL with same condition exists
-- ============================================================

DROP POLICY IF EXISTS "Players view own apps" ON public.player_apps;
DROP POLICY IF EXISTS "Players view own config" ON public.player_app_config;
DROP POLICY IF EXISTS "Players view own firmware" ON public.player_firmware_state;
DROP POLICY IF EXISTS "Users can view own research" ON public.research_progress;

-- ============================================================
-- 6. OPTIMIZE SLICES RLS — EXISTS INSTEAD OF IN
-- Before: two policies using crystal_id IN (subquery)
-- After:  single FOR ALL using EXISTS (short-circuits, uses idx_crystals_owner)
-- ============================================================

DROP POLICY IF EXISTS "Users can view slices of own crystals" ON public.slices;
DROP POLICY IF EXISTS "Users can manage slices of own crystals" ON public.slices;

CREATE POLICY "Users can manage slices of own crystals"
  ON public.slices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.crystals c
      WHERE c.id = slices.crystal_id
        AND c.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 7. FIX v_player_resources VIEW — ELIMINATE DOUBLE FUNCTION CALL
-- Before: calc_effective_capacity() called twice per row
-- After:  CROSS JOIN LATERAL computes once, reused as cap.eff
--         NULLIF prevents division-by-zero
-- ============================================================

CREATE OR REPLACE VIEW v_player_resources AS
SELECT
    rc.player_id,
    rc.container_id,
    cd.name AS container_name,
    rc.resource_type,
    rc.current_amount,
    rc.base_capacity,
    rc.upgrade_level,
    cap.eff AS effective_capacity,
    ROUND(
        rc.current_amount::NUMERIC /
        NULLIF(cap.eff, 0)::NUMERIC * 100, 1
    ) AS fill_percentage,
    cd.tier
FROM resource_containers rc
JOIN container_definitions cd ON rc.container_id = cd.container_type_id
CROSS JOIN LATERAL (
    SELECT calc_effective_capacity(rc.base_capacity, rc.upgrade_level) AS eff
) cap
ORDER BY cd.tier, rc.resource_type;

-- ============================================================
-- 8. RETENTION CLEANUP FUNCTIONS
-- Parameterized delete with default retention periods
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_command_history(retention_days int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM command_history
  WHERE created_at < NOW() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_usage_logs(retention_days int DEFAULT 60)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM unapp_usage_log
  WHERE session_start < NOW() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_volatility_snapshots(retention_days int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM volatility_snapshots
  WHERE captured_at < NOW() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_syspref_audit(retention_days int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM syspref_audit_log
  WHERE changed_at < NOW() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Master function: runs all cleanup with defaults, returns JSON summary
CREATE OR REPLACE FUNCTION cleanup_all_retention()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_command_history int;
  v_usage_logs int;
  v_volatility int;
  v_syspref int;
  v_audit int;
BEGIN
  v_command_history := cleanup_command_history();
  v_usage_logs := cleanup_usage_logs();
  v_volatility := cleanup_volatility_snapshots();
  v_syspref := cleanup_syspref_audit();
  v_audit := cleanup_old_audit_logs();

  RETURN jsonb_build_object(
    'command_history', v_command_history,
    'usage_logs', v_usage_logs,
    'volatility_snapshots', v_volatility,
    'syspref_audit', v_syspref,
    'audit_log', v_audit
  );
END;
$$;

-- ============================================================
-- END OF PERFORMANCE OPTIMIZATION MIGRATION
-- ============================================================
