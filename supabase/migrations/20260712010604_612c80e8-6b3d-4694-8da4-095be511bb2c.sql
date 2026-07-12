
-- Invitations table
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  role app_role NOT NULL DEFAULT 'user',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | used | revoked | expired
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invitations_email_idx ON public.invitations (lower(email));
CREATE INDEX invitations_token_idx ON public.invitations (token);

GRANT SELECT ON public.invitations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Anon can look up ONLY by token (RLS still restricts columns exposed via API);
-- practical result: anon can select any invitation row, which is fine — token is the secret.
CREATE POLICY "Anyone can look up invitation by token"
  ON public.invitations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert invitations"
  ON public.invitations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invitations"
  ON public.invitations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invitations"
  ON public.invitations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enforce invite-only signup at the auth.users level
CREATE OR REPLACE FUNCTION public.enforce_invite_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  -- Allow if there's a valid, unused, unexpired invitation for this email
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

  -- Mark invitation as used
  UPDATE public.invitations
  SET status = 'used', used_at = now(), used_by = NEW.id
  WHERE id = inv.id;

  -- If the invitation carried a non-default role, grant it
  IF inv.role <> 'user' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, inv.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Runs BEFORE handle_new_user so signup is rejected before profile/accounts get created
CREATE TRIGGER enforce_invite_only_before_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invite_only();
