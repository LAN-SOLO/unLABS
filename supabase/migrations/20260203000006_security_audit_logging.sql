-- ============================================================
-- Security: Audit Logging Triggers
-- Date: February 3, 2026
-- Severity: MEDIUM - Security monitoring and compliance
-- ============================================================

-- ============================================================
-- 1. AUDIT LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- What happened
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id uuid,

  -- Who did it
  user_id uuid REFERENCES auth.users(id),

  -- When
  created_at timestamptz DEFAULT now() NOT NULL,

  -- What changed (JSON for flexibility)
  old_data jsonb,
  new_data jsonb,

  -- Context
  ip_address inet,
  user_agent text
);

-- Index for querying by user and time
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_operation ON public.audit_log(table_name, operation);

-- Enable RLS - only admins can read audit logs
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- No user can read audit logs (admin uses service role)
CREATE POLICY "No user access to audit_log"
  ON public.audit_log
  FOR ALL
  TO authenticated
  USING (false);

-- ============================================================
-- 2. AUDIT TRIGGER FUNCTION
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
BEGIN
  -- Get record ID
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSE -- UPDATE
    v_record_id := NEW.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  END IF;

  -- Insert audit record
  INSERT INTO audit_log (
    table_name,
    operation,
    record_id,
    user_id,
    old_data,
    new_data
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_record_id,
    auth.uid(),
    v_old_data,
    v_new_data
  );

  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ============================================================
-- 3. ATTACH AUDIT TRIGGERS TO SENSITIVE TABLES
-- ============================================================

-- Balances - track all financial changes
DROP TRIGGER IF EXISTS audit_balances ON public.balances;
CREATE TRIGGER audit_balances
  AFTER INSERT OR UPDATE OR DELETE ON public.balances
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Crystals - track NFT ownership changes
DROP TRIGGER IF EXISTS audit_crystals ON public.crystals;
CREATE TRIGGER audit_crystals
  AFTER INSERT OR UPDATE OR DELETE ON public.crystals
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Transactions - track all financial transactions
DROP TRIGGER IF EXISTS audit_transactions ON public.transactions;
CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Player apps - track app installations
DROP TRIGGER IF EXISTS audit_player_apps ON public.player_apps;
CREATE TRIGGER audit_player_apps
  AFTER INSERT OR UPDATE OR DELETE ON public.player_apps
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================
-- 4. AUDIT LOG CLEANUP FUNCTION
-- Retain logs for 90 days by default
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM audit_log
  WHERE created_at < NOW() - (retention_days || ' days')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT tgname, tgrelid::regclass, tgenabled
-- FROM pg_trigger
-- WHERE tgfoid = 'audit_trigger_func'::regproc;
