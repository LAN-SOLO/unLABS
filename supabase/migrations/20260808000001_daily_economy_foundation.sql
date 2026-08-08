-- ============================================================
-- Daily economy foundation
-- ============================================================
-- Three fixes the daily-contract loop (and the existing economy)
-- needs before any new faucet/sink ships:
--
-- 1. transactions INSERT policy — burnUnsc()/earnUnsc() write their
--    audit rows under the caller's JWT; without an INSERT policy those
--    writes were silently denied by RLS (the insert result was never
--    checked), so the ledger only ever saw SECURITY DEFINER traffic.
-- 2. deduct_balance()/credit_balance() (20260203000003) log into a
--    nonexistent `transaction_type` column with values ('debit'/'credit')
--    that are not in the transaction_type enum — every call raises,
--    which breaks the 50 _unSC crystal-mint burn. Recreate both with a
--    correct `type` insert. credit_balance additionally gains the
--    auth.uid() guard deduct_balance already had: it was callable by any
--    authenticated user for any target user.
-- 3. is_allowed_reserve_source(): allow 'daily' so daily-contract and
--    streak payouts can draw from the deflationary reserve (allow-list
--    mirrored in lib/game/economy.ts RESERVE_SOURCES).

-- ── 1. transactions INSERT policy ──────────────────────────────────────
drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions
  for insert
  with check (auth.uid() = user_id);

-- ── 2. repair the atomic balance RPCs' ledger inserts ──────────────────
-- Sign convention follows invest_in_research (20260205000001): spends
-- are logged with a negative amount, credits with a positive amount.

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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance DECIMAL(18,6);
  v_new_balance DECIMAL(18,6);
  v_total_spent DECIMAL(18,6);
BEGIN
  IF auth.uid() != p_user_id THEN
    RETURN QUERY SELECT false, 0::DECIMAL(18,6), 'Unauthorized'::TEXT;
    RETURN;
  END IF;

  SELECT available, total_spent INTO v_current_balance, v_total_spent
  FROM balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::DECIMAL(18,6), 'Balance record not found'::TEXT;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, 'Insufficient balance'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE balances
  SET
    available = v_new_balance,
    total_spent = v_total_spent + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'burn', -p_amount, p_reason);

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

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
  IF auth.uid() != p_user_id THEN
    RETURN QUERY SELECT false, 0::DECIMAL(18,6), 'Unauthorized'::TEXT;
    RETURN;
  END IF;

  SELECT available, total_earned INTO v_current_balance, v_total_earned
  FROM balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
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

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'reward', p_amount, p_reason);

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- ── 3. allow 'daily' as a reserve source ───────────────────────────────
create or replace function public.is_allowed_reserve_source(p_source text)
returns boolean
language sql
immutable
as $$
  select p_source in (
    'achievement',
    'starter_pack',
    'quest_reward',
    'tutorial_skip',
    'event',
    'test',
    'daily'
  );
$$;
