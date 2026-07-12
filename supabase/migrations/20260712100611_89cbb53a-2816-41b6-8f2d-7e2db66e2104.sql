CREATE OR REPLACE FUNCTION public.enforce_invite_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv RECORD;
  jwt_role TEXT;
BEGIN
  jwt_role := COALESCE(current_setting('request.jwt.claim.role', true), '');

  -- Allow trusted backend/admin-created users:
  -- 1) service-role requests,
  -- 2) auth invite emails, and
  -- 3) backend-created users that are already confirmed.
  -- Public browser signup with a password is still blocked unless a matching
  -- invitation row exists below.
  IF jwt_role = 'service_role'
     OR NEW.invited_at IS NOT NULL
     OR NEW.email_confirmed_at IS NOT NULL
     OR NEW.confirmed_at IS NOT NULL
     OR (
       NEW.confirmation_sent_at IS NOT NULL
       AND NEW.encrypted_password IS NULL
       AND COALESCE(NEW.raw_app_meta_data->>'provider', '') = 'email'
     )
  THEN
    RETURN NEW;
  END IF;

  SELECT * INTO inv
  FROM public.invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
    AND used_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Signup restricted: a valid invitation is required for %', NEW.email
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.invitations
  SET status = 'used', used_at = now(), used_by = NEW.id, updated_at = now()
  WHERE id = inv.id;

  IF inv.role <> 'user' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, inv.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_invite_only() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_invite_only() TO service_role;