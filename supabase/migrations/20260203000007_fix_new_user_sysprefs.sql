-- Fix: handle_new_user() trigger now initializes sysprefs for new signups
-- Also backfills any existing users missing their preference rows
-- Note: inline inserts instead of PERFORM initialize_player_prefs() because
-- the auth trigger context can't resolve cross-schema function calls reliably.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id)
  VALUES (new.id);

  -- Create balance record
  INSERT INTO public.balances (user_id, available)
  VALUES (new.id, 100); -- Starting bonus

  -- Initialize research progress for all tech trees
  INSERT INTO public.research_progress (user_id, tech_tree_id)
  SELECT new.id, id FROM public.tech_trees;

  -- Initialize system preferences with defaults
  INSERT INTO public.player_display_prefs (player_id)
  VALUES (new.id) ON CONFLICT (player_id) DO NOTHING;

  INSERT INTO public.player_sound_prefs (player_id)
  VALUES (new.id) ON CONFLICT (player_id) DO NOTHING;

  INSERT INTO public.player_datetime_prefs (player_id)
  VALUES (new.id) ON CONFLICT (player_id) DO NOTHING;

  INSERT INTO public.player_network_prefs (player_id)
  VALUES (new.id) ON CONFLICT (player_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: create missing syspref rows for any existing users
INSERT INTO public.player_display_prefs (player_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT player_id FROM public.player_display_prefs)
ON CONFLICT (player_id) DO NOTHING;

INSERT INTO public.player_sound_prefs (player_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT player_id FROM public.player_sound_prefs)
ON CONFLICT (player_id) DO NOTHING;

INSERT INTO public.player_datetime_prefs (player_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT player_id FROM public.player_datetime_prefs)
ON CONFLICT (player_id) DO NOTHING;

INSERT INTO public.player_network_prefs (player_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT player_id FROM public.player_network_prefs)
ON CONFLICT (player_id) DO NOTHING;
