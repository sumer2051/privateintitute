CREATE OR REPLACE FUNCTION public.enforce_invite_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  -- Allow admin-issued invites from the backend (auth.admin.inviteUserByEmail sets invited_at)
  IF NEW.invited_at IS NOT NULL THEN
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
  SET status = 'used', used_at = now(), used_by = NEW.id
  WHERE id = inv.id;

  IF inv.role <> 'user' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, inv.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;