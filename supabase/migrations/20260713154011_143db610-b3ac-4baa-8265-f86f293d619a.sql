CREATE OR REPLACE FUNCTION public.set_transfer_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 6 digits';
  END IF;
  UPDATE public.profiles
     SET transfer_pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf'::text, 10)),
         updated_at = now()
   WHERE id = auth.uid();
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_transfer_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE h TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT transfer_pin_hash INTO h FROM public.profiles WHERE id = auth.uid();
  IF h IS NULL THEN RETURN FALSE; END IF;
  RETURN h = extensions.crypt(_pin, h);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_transfer_pin(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_transfer_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_transfer_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_transfer_pin(text) TO authenticated;