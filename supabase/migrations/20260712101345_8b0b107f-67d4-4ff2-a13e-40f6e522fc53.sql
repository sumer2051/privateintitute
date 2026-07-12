
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS transfer_pin_hash TEXT;

CREATE OR REPLACE FUNCTION public.set_transfer_pin(_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 6 digits';
  END IF;
  UPDATE public.profiles
     SET transfer_pin_hash = crypt(_pin, gen_salt('bf', 10)),
         updated_at = now()
   WHERE id = auth.uid();
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_transfer_pin(_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE h TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT transfer_pin_hash INTO h FROM public.profiles WHERE id = auth.uid();
  IF h IS NULL THEN RETURN FALSE; END IF;
  RETURN h = crypt(_pin, h);
END;
$$;

CREATE OR REPLACE FUNCTION public.has_transfer_pin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT transfer_pin_hash IS NOT NULL FROM public.profiles WHERE id = auth.uid()), FALSE);
$$;

REVOKE ALL ON FUNCTION public.set_transfer_pin(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_transfer_pin(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_transfer_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_transfer_pin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_transfer_pin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_transfer_pin() TO authenticated;
