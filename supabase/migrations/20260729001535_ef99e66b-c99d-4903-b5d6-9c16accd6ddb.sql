
CREATE TABLE public.user_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  label text,
  user_agent text,
  platform text,
  ip text,
  first_seen timestamp with time zone NOT NULL DEFAULT now(),
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  is_blocked boolean NOT NULL DEFAULT false,
  is_revoked boolean NOT NULL DEFAULT false,
  blocked_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

GRANT SELECT, INSERT, UPDATE ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own devices"
  ON public.user_devices FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users insert own devices"
  ON public.user_devices FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users may only update last_seen/label on their own row and only if not blocked/revoked
CREATE POLICY "users update own device heartbeat"
  ON public.user_devices FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins update devices"
  ON public.user_devices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_devices_updated_at
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Prevent regular users from flipping the security flags themselves
CREATE OR REPLACE FUNCTION public.prevent_user_device_flag_tampering()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
       OR NEW.is_revoked IS DISTINCT FROM OLD.is_revoked
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.device_id IS DISTINCT FROM OLD.device_id THEN
      RAISE EXCEPTION 'Not allowed to modify device security flags';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER user_devices_prevent_tamper
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_device_flag_tampering();

-- Admin actions
CREATE OR REPLACE FUNCTION public.admin_revoke_device(p_device uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT * INTO d FROM public.user_devices WHERE id = p_device;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Device not found'; END IF;
  UPDATE public.user_devices
     SET is_revoked = true, revoked_at = now(), updated_at = now()
   WHERE id = p_device;
  PERFORM public.log_staff_action('device.revoke', 'user_device', p_device,
    jsonb_build_object('user_id', d.user_id, 'device_id', d.device_id));
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_device_blocked(p_device uuid, p_blocked boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT * INTO d FROM public.user_devices WHERE id = p_device;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Device not found'; END IF;
  UPDATE public.user_devices
     SET is_blocked = p_blocked,
         blocked_at = CASE WHEN p_blocked THEN now() ELSE NULL END,
         is_revoked = CASE WHEN p_blocked THEN true ELSE is_revoked END,
         revoked_at = CASE WHEN p_blocked AND revoked_at IS NULL THEN now() ELSE revoked_at END,
         updated_at = now()
   WHERE id = p_device;
  PERFORM public.log_staff_action(
    CASE WHEN p_blocked THEN 'device.lock' ELSE 'device.unlock' END,
    'user_device', p_device,
    jsonb_build_object('user_id', d.user_id, 'device_id', d.device_id));
  RETURN true;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_revoke_device(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_device_blocked(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_device(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_device_blocked(uuid, boolean) TO authenticated;
