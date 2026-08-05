CREATE OR REPLACE FUNCTION public.admin_restore_device(p_device uuid)
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
  IF d.is_blocked THEN RAISE EXCEPTION 'Unlock this device before restoring access'; END IF;

  UPDATE public.user_devices
     SET is_revoked = false,
         revoked_at = NULL,
         updated_at = now()
   WHERE id = p_device;

  PERFORM public.log_staff_action(
    'device.restore', 'user_device', p_device,
    jsonb_build_object('user_id', d.user_id, 'device_id', d.device_id));
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_restore_device(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_restore_device(uuid) TO authenticated;