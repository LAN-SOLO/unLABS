-- ============================================================
-- Security Fix: Database-Level Input Validation
-- Date: February 3, 2026
-- Severity: MEDIUM - Enforces validation at DB level
-- ============================================================

-- ============================================================
-- 1. CRYSTAL NAME CONSTRAINTS
-- Enforces name format even if client-side validation is bypassed
-- ============================================================

-- Add constraint for name format (alphanumeric, hyphens, underscores only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crystals_name_format'
  ) THEN
    ALTER TABLE crystals ADD CONSTRAINT crystals_name_format
      CHECK (name ~ '^[a-zA-Z0-9_-]+$');
  END IF;
END $$;

-- Add constraint for name length (max 24 characters)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crystals_name_length'
  ) THEN
    ALTER TABLE crystals ADD CONSTRAINT crystals_name_length
      CHECK (length(name) <= 24);
  END IF;
END $$;

-- Add constraint for name minimum length (at least 1 character)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crystals_name_not_empty'
  ) THEN
    ALTER TABLE crystals ADD CONSTRAINT crystals_name_not_empty
      CHECK (length(trim(name)) > 0);
  END IF;
END $$;

-- ============================================================
-- 2. PROFILE USERNAME CONSTRAINTS
-- Prevent malicious usernames
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_format
      CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_-]+$');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_length'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_length
      CHECK (username IS NULL OR length(username) <= 32);
  END IF;
END $$;

-- ============================================================
-- 3. TRANSACTION DESCRIPTION SANITIZATION
-- Limit description length to prevent abuse
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_desc_length'
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_desc_length
      CHECK (description IS NULL OR length(description) <= 255);
  END IF;
END $$;

-- ============================================================
-- 4. COMMAND HISTORY LIMITS
-- Prevent extremely long command injection
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'command_history_cmd_length'
  ) THEN
    ALTER TABLE command_history ADD CONSTRAINT command_history_cmd_length
      CHECK (length(command) <= 1000);
  END IF;
END $$;

-- ============================================================
-- 5. APP CONFIG VALUE SIZE LIMIT
-- Prevent JSON bomb attacks
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'player_app_config_value_size'
  ) THEN
    ALTER TABLE player_app_config ADD CONSTRAINT player_app_config_value_size
      CHECK (length(config_value::text) <= 65535);
  END IF;
END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT conname, conrelid::regclass, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname LIKE '%_format' OR conname LIKE '%_length' OR conname LIKE '%_size';
