ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_theme text NOT NULL DEFAULT 'classic';

CREATE OR REPLACE FUNCTION public.admin_set_user_ui_theme(p_user uuid, p_theme text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change interface style';
  END IF;
  IF p_theme NOT IN ('classic','luxe') THEN
    RAISE EXCEPTION 'Invalid theme';
  END IF;
  UPDATE public.profiles SET ui_theme = p_theme, updated_at = now() WHERE id = p_user;
  PERFORM public.log_staff_action('set_ui_theme', 'profile', p_user, jsonb_build_object('theme', p_theme));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_all_ui_theme(p_theme text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change interface style';
  END IF;
  IF p_theme NOT IN ('classic','luxe') THEN
    RAISE EXCEPTION 'Invalid theme';
  END IF;
  UPDATE public.profiles SET ui_theme = p_theme, updated_at = now() WHERE ui_theme IS DISTINCT FROM p_theme;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.log_staff_action('set_ui_theme_all', 'profile', NULL, jsonb_build_object('theme', p_theme, 'count', v_count));
  RETURN v_count;
END;
$$;