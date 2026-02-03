-- ============================================================
-- Security Fix: Volatility Snapshots Write Protection
-- Date: February 3, 2026
-- Severity: HIGH - Prevents unauthorized data manipulation
-- ============================================================

-- The volatility_snapshots table should only be writable by the system
-- (service role), not by authenticated users who could manipulate
-- blockchain TPS data to influence crystal volatility.

-- ============================================================
-- 1. ADD RESTRICTIVE WRITE POLICIES
-- Only service role can insert/update/delete
-- ============================================================

-- Drop any existing permissive write policies (if they exist)
DROP POLICY IF EXISTS "System can insert volatility snapshots" ON public.volatility_snapshots;
DROP POLICY IF EXISTS "System can update volatility snapshots" ON public.volatility_snapshots;
DROP POLICY IF EXISTS "System can delete volatility snapshots" ON public.volatility_snapshots;

-- Create restrictive policies: no authenticated user can write
-- (Service role bypasses RLS, so system processes can still write)

-- INSERT: Block all authenticated users
CREATE POLICY "No user insert on volatility_snapshots"
  ON public.volatility_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- UPDATE: Block all authenticated users
CREATE POLICY "No user update on volatility_snapshots"
  ON public.volatility_snapshots
  FOR UPDATE
  TO authenticated
  USING (false);

-- DELETE: Block all authenticated users
CREATE POLICY "No user delete on volatility_snapshots"
  ON public.volatility_snapshots
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT polname, polcmd, polroles::regrole[], polqual, polwithcheck
-- FROM pg_policy
-- WHERE polrelid = 'volatility_snapshots'::regclass;
