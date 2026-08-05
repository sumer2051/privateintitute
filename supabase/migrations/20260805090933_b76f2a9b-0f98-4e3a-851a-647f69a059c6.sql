-- 1) Per-device capabilities + admin notes
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS can_transfer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_deposit boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS view_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- 2) Per-customer device limit
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS device_limit integer NOT NULL DEFAULT 5;

-- 3) Device login / action history (past devices, even ones later removed)
CREATE TABLE IF NOT EXISTS public.device_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_row uuid,
  device_id text NOT NULL,
  event_type text NOT NULL DEFAULT 'sign_in',
  label text,
  user_agent text,
  platform text,
  ip text,
  lat double precision,
  lng double precision,
  location_label text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.device_login_events TO authenticated;
GRANT ALL ON public.device_login_events TO service_role;

ALTER TABLE public.device_login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own device events"
  ON public.device_login_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own device events"
  ON public.device_login_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS device_login_events_user_created_idx
  ON public.device_login_events (user_id, created_at DESC);

-- 4) Protect new capability columns from client tampering
CREATE OR REPLACE FUNCTION public.prevent_user_device_flag_tampering()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
       OR NEW.is_revoked IS DISTINCT FROM OLD.is_revoked
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.device_id IS DISTINCT FROM OLD.device_id
       OR NEW.can_transfer IS DISTINCT FROM OLD.can_transfer
       OR NEW.can_deposit IS DISTINCT FROM OLD.can_deposit
       OR NEW.view_only IS DISTINCT FROM OLD.view_only
       OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
      RAISE EXCEPTION 'Not allowed to modify device security flags';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

-- 5) Admin: set device capabilities
CREATE OR REPLACE FUNCTION public.admin_set_device_permissions(
  p_device uuid,
  p_can_transfer boolean,
  p_can_deposit boolean,
  p_view_only boolean,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE d RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT * INTO d FROM public.user_devices WHERE id = p_device;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Device not found'; END IF;

  UPDATE public.user_devices
     SET can_transfer = COALESCE(p_can_transfer, can_transfer),
         can_deposit  = COALESCE(p_can_deposit, can_deposit),
         view_only    = COALESCE(p_view_only, view_only),
         admin_notes  = p_notes,
         updated_at   = now()
   WHERE id = p_device;

  INSERT INTO public.device_login_events (user_id, device_row, device_id, event_type, meta)
  VALUES (d.user_id, d.id, d.device_id, 'permissions_changed',
    jsonb_build_object('can_transfer', p_can_transfer, 'can_deposit', p_can_deposit, 'view_only', p_view_only, 'notes', p_notes));

  PERFORM public.log_staff_action('device.permissions', 'user_device', p_device,
    jsonb_build_object('user_id', d.user_id, 'can_transfer', p_can_transfer, 'can_deposit', p_can_deposit, 'view_only', p_view_only));
  RETURN true;
END; $function$;

REVOKE ALL ON FUNCTION public.admin_set_device_permissions(uuid, boolean, boolean, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_device_permissions(uuid, boolean, boolean, boolean, text) TO authenticated;

-- 6) Admin: set per-customer device limit
CREATE OR REPLACE FUNCTION public.admin_set_device_limit(p_user uuid, p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'Device limit must be between 1 and 50';
  END IF;
  UPDATE public.profiles SET device_limit = p_limit, updated_at = now() WHERE id = p_user;
  PERFORM public.log_staff_action('device.limit_set', 'user', p_user, jsonb_build_object('limit', p_limit));
  RETURN p_limit;
END; $function$;

REVOKE ALL ON FUNCTION public.admin_set_device_limit(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_device_limit(uuid, integer) TO authenticated;

-- 7) Backfill history from existing known devices so past devices are visible
INSERT INTO public.device_login_events (user_id, device_row, device_id, event_type, label, user_agent, platform, lat, lng, location_label, created_at)
SELECT d.user_id, d.id, d.device_id, 'first_seen', d.label, d.user_agent, d.platform, d.lat, d.lng, d.location_label, d.first_seen
FROM public.user_devices d
WHERE NOT EXISTS (
  SELECT 1 FROM public.device_login_events e WHERE e.device_row = d.id AND e.event_type = 'first_seen'
);