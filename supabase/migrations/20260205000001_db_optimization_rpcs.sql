-- ============================================================
-- Database Optimization RPCs
-- Date: February 5, 2026
-- Purpose: Atomic RPC functions to replace multi-query
--          client-side patterns with single server-side calls
-- ============================================================

-- ============================================================
-- 1. INVEST_IN_RESEARCH
-- Replaces 6-7 sequential queries in equipment.ts with a
-- single atomic operation using FOR UPDATE row lock.
-- ============================================================

CREATE OR REPLACE FUNCTION invest_in_research(
  p_user_id UUID,
  p_category TEXT,
  p_amount NUMERIC(20,8)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_available NUMERIC(20,8);
  v_balance_spent NUMERIC(20,8);
  v_tree_id UUID;
  v_tree_max_tier INT;
  v_progress_id UUID;
  v_current_tier INT;
  v_experience NUMERIC(20,8);
  v_exp_to_next NUMERIC(20,8);
  v_new_experience NUMERIC(20,8);
  v_new_tier INT;
  v_remaining_exp NUMERIC(20,8);
  v_next_exp_to_next NUMERIC(20,8);
  v_new_balance NUMERIC(20,8);
  -- Tier costs by category (index 0 = tier 0->1, etc.)
  v_costs NUMERIC[] := CASE lower(p_category)
    WHEN 'devices'       THEN ARRAY[100, 300, 1000, 2500, 5000]
    WHEN 'optics'        THEN ARRAY[50, 200, 800, 2000, 5000]
    WHEN 'adapters'      THEN ARRAY[100, 300, 1000, 2500, 5000]
    WHEN 'synthesizers'  THEN ARRAY[150, 500, 1200, 3000, 8000]
    ELSE                      ARRAY[100, 200, 400, 800, 1600]
  END;
BEGIN
  -- Verify caller is the user
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Amount must be positive');
  END IF;

  -- Lock balance row and check funds
  SELECT available, total_spent
  INTO v_balance_available, v_balance_spent
  FROM balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Balance record not found');
  END IF;

  IF v_balance_available < p_amount THEN
    RETURN jsonb_build_object('success', false, 'message',
      format('Insufficient balance. Need %s _unSC', p_amount));
  END IF;

  -- Look up tech tree
  SELECT id, max_tier
  INTO v_tree_id, v_tree_max_tier
  FROM tech_trees
  WHERE lower(category) = lower(p_category)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message',
      format('Tech tree ''%s'' not found', p_category));
  END IF;

  -- Get or create research progress
  SELECT id, current_tier, experience, experience_to_next
  INTO v_progress_id, v_current_tier, v_experience, v_exp_to_next
  FROM research_progress
  WHERE user_id = p_user_id AND tech_tree_id = v_tree_id;

  IF NOT FOUND THEN
    -- Create new progress (tier 1, 0 experience)
    v_current_tier := 1;
    v_experience := 0;
    v_exp_to_next := v_costs[1];  -- cost for first tier

    INSERT INTO research_progress (user_id, tech_tree_id, current_tier, experience, experience_to_next)
    VALUES (p_user_id, v_tree_id, v_current_tier, v_experience, v_exp_to_next)
    RETURNING id INTO v_progress_id;
  END IF;

  -- Check max tier
  IF v_current_tier >= v_tree_max_tier THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already at max tier');
  END IF;

  -- Calculate new experience and potential tier-up
  v_new_experience := v_experience + p_amount;
  v_new_tier := v_current_tier;
  v_remaining_exp := v_new_experience;

  -- Cost index for next tier (1-based array, tier 1->2 = index 2, etc.)
  IF v_current_tier < array_length(v_costs, 1) THEN
    v_exp_to_next := v_costs[v_current_tier];
  ELSE
    v_exp_to_next := v_costs[array_length(v_costs, 1)];
  END IF;

  IF v_new_experience >= v_exp_to_next THEN
    v_new_tier := v_current_tier + 1;
    v_remaining_exp := 0;  -- Reset on tier up
  END IF;

  -- Next tier's cost
  IF v_new_tier < array_length(v_costs, 1) THEN
    v_next_exp_to_next := v_costs[v_new_tier];
  ELSE
    v_next_exp_to_next := v_costs[array_length(v_costs, 1)];
  END IF;

  -- Deduct balance
  v_new_balance := v_balance_available - p_amount;
  UPDATE balances
  SET available = v_new_balance,
      total_spent = v_balance_spent + p_amount
  WHERE user_id = p_user_id;

  -- Update research progress
  UPDATE research_progress
  SET current_tier = v_new_tier,
      experience = v_remaining_exp,
      experience_to_next = v_next_exp_to_next,
      last_researched_at = NOW()
  WHERE id = v_progress_id;

  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, tech_tree_id, description)
  VALUES (p_user_id, 'research', -p_amount, v_tree_id,
          format('Research investment in %s', p_category));

  -- Return result
  IF v_new_tier > v_current_tier THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', format('Tier up! Now at tier %s', v_new_tier),
      'new_tier', v_new_tier,
      'new_balance', v_new_balance,
      'tier_up', true,
      'experience', v_remaining_exp,
      'experience_to_next', v_next_exp_to_next
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'message', format('Invested %s _unSC in %s. Progress: %s/%s',
                        p_amount, p_category, v_remaining_exp, v_next_exp_to_next),
      'new_tier', v_new_tier,
      'new_balance', v_new_balance,
      'tier_up', false,
      'experience', v_remaining_exp,
      'experience_to_next', v_next_exp_to_next
    );
  END IF;
END;
$$;

-- ============================================================
-- 2. RECORD_APP_LAUNCH
-- Replaces 3-query read-modify-write in unapp.ts with
-- a single atomic counter increment + usage log insert.
-- ============================================================

CREATE OR REPLACE FUNCTION record_app_launch(
  p_player_id UUID,
  p_app_id VARCHAR(10),
  p_source VARCHAR(20)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is the player
  IF auth.uid() != p_player_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Atomic increment + timestamp update (no read needed)
  UPDATE player_apps
  SET total_launches = total_launches + 1,
      last_launched_at = NOW()
  WHERE player_id = p_player_id
    AND app_id = p_app_id;

  -- Insert usage log entry
  INSERT INTO unapp_usage_log (player_id, app_id, launch_source)
  VALUES (p_player_id, p_app_id, p_source);
END;
$$;

-- ============================================================
-- 3. TOGGLE_APP_FAVORITE
-- Replaces 2-query read-then-write in unapp.ts with
-- a single atomic NOT toggle.
-- ============================================================

CREATE OR REPLACE FUNCTION toggle_app_favorite(
  p_player_id UUID,
  p_app_id VARCHAR(10)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_val BOOLEAN;
BEGIN
  -- Verify caller is the player
  IF auth.uid() != p_player_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Atomic toggle and return new value
  UPDATE player_apps
  SET is_favorite = NOT is_favorite
  WHERE player_id = p_player_id
    AND app_id = p_app_id
  RETURNING is_favorite INTO v_new_val;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN v_new_val;
END;
$$;

-- ============================================================
-- 4. GET_SYSTEM_HEALTH
-- Replaces full table scan + client-side counting with
-- server-side COUNT FILTER aggregation.
-- ============================================================

CREATE OR REPLACE FUNCTION get_system_health()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'online',  COUNT(*) FILTER (WHERE state = 'online'),
    'standby', COUNT(*) FILTER (WHERE state = 'standby'),
    'offline', COUNT(*) FILTER (WHERE state = 'offline'),
    'error',   COUNT(*) FILTER (WHERE state = 'error')
  )
  FROM device_state;
$$;

-- ============================================================
-- 5. GET_DEVICE_COUNTS_BY_CATEGORY
-- Replaces full table scan + client-side counting with
-- server-side GROUP BY aggregation.
-- ============================================================

CREATE OR REPLACE FUNCTION get_device_counts_by_category()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_object_agg(category, cnt)
  FROM (
    SELECT category::TEXT, COUNT(*) AS cnt
    FROM devices
    GROUP BY category
  ) sub;
$$;

-- ============================================================
-- END OF DATABASE OPTIMIZATION RPCs
-- ============================================================
