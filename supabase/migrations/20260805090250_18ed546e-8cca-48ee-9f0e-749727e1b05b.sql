CREATE OR REPLACE FUNCTION public.admin_set_device_blocked(p_device uuid, p_blocked boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
         is_revoked = CASE WHEN p_blocked THEN true ELSE false END,
         revoked_at = CASE WHEN p_blocked THEN COALESCE(revoked_at, now()) ELSE NULL END,
         updated_at = now()
   WHERE id = p_device;

  PERFORM public.log_staff_action(
    CASE WHEN p_blocked THEN 'device.lock' ELSE 'device.unlock' END,
    'user_device', p_device,
    jsonb_build_object('user_id', d.user_id, 'device_id', d.device_id));
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_device_blocked(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_device_blocked(uuid, boolean) TO authenticated;