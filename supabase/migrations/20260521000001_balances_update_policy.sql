-- ============================================================
-- Add UPDATE policy on balances
-- ============================================================
-- The initial schema (20260101000001) only added SELECT on balances.
-- All UPDATE traffic via burnUnsc()/earnUnsc() was silently denied by
-- RLS (zero rows affected, no error returned), so _unSC burns and
-- credits were effectively no-ops outside the SECURITY DEFINER RPCs
-- in 20260203000003. Granting per-user UPDATE here keeps the existing
-- supabase-js paths working without a refactor.

CREATE POLICY "Users can update own balance"
  ON public.balances
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
