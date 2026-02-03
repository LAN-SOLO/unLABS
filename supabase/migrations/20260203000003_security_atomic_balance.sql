-- ============================================================
-- Security Fix: Atomic Balance Operations
-- Date: February 3, 2026
-- Severity: CRITICAL - Prevents double-spend/race conditions
-- ============================================================

-- ============================================================
-- 1. ATOMIC BALANCE DEDUCTION
-- Uses row-level locking to prevent race conditions
-- ============================================================

CREATE OR REPLACE FUNCTION deduct_balance(
  p_user_id UUID,
  p_amount DECIMAL(18,6),
  p_reason TEXT DEFAULT 'deduction'
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance DECIMAL(18,6),
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges
SET search_path = public
AS $$
DECLARE
  v_current_balance DECIMAL(18,6);
  v_new_balance DECIMAL(18,6);
  v_total_spent DECIMAL(18,6);
BEGIN
  -- Verify caller is the user (RLS bypass protection)
  IF auth.uid() != p_user_id THEN
    RETURN QUERY SELECT false, 0::DECIMAL(18,6), 'Unauthorized'::TEXT;
    RETURN;
  END IF;

  -- Lock the row and get current balance atomically
  SELECT available, total_spent INTO v_current_balance, v_total_spent
  FROM balances
  WHERE user_id = p_user_id
  FOR UPDATE;  -- Row-level lock prevents concurrent updates

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::DECIMAL(18,6), 'Balance record not found'::TEXT;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, 'Insufficient balance'::TEXT;
    RETURN;
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance - p_amount;

  -- Update balance atomically
  UPDATE balances
  SET
    available = v_new_balance,
    total_spent = v_total_spent + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the transaction
  INSERT INTO transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, -p_amount, 'debit', p_reason);

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- ============================================================
-- 2. ATOMIC BALANCE CREDIT
-- For adding funds safely
-- ============================================================

CREATE OR REPLACE FUNCTION credit_balance(
  p_user_id UUID,
  p_amount DECIMAL(18,6),
  p_reason TEXT DEFAULT 'credit'
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance DECIMAL(18,6),
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance DECIMAL(18,6);
  v_new_balance DECIMAL(18,6);
  v_total_earned DECIMAL(18,6);
BEGIN
  -- Lock and get current balance
  SELECT available, total_earned INTO v_current_balance, v_total_earned
  FROM balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Create balance record if it doesn't exist
    INSERT INTO balances (user_id, available, total_earned)
    VALUES (p_user_id, p_amount, p_amount)
    RETURNING available INTO v_new_balance;
  ELSE
    v_new_balance := v_current_balance + p_amount;

    UPDATE balances
    SET
      available = v_new_balance,
      total_earned = v_total_earned + p_amount,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Log the transaction
  INSERT INTO transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, p_amount, 'credit', p_reason);

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- ============================================================
-- 3. GRANT EXECUTE PERMISSIONS
-- Only authenticated users can call these functions
-- ============================================================

GRANT EXECUTE ON FUNCTION deduct_balance(UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION credit_balance(UUID, DECIMAL, TEXT) TO authenticated;

-- ============================================================
-- USAGE EXAMPLE (in TypeScript):
--
-- const { data, error } = await supabase.rpc('deduct_balance', {
--   p_user_id: user.id,
--   p_amount: 50.0,
--   p_reason: 'crystal_mint'
-- })
--
-- if (data?.[0]?.success) {
--   console.log('New balance:', data[0].new_balance)
-- } else {
--   console.error('Failed:', data?.[0]?.error_message)
-- }
-- ============================================================
