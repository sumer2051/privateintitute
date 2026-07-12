-- Repair invite-only signup enforcement so backend/admin invites work reliably
CREATE OR REPLACE FUNCTION public.enforce_invite_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv RECORD;
BEGIN
  -- Backend/admin issued invitations can arrive without a public invitation row.
  -- Lovable Cloud/Auth admin invitations set invited_at; service-role created users
  -- may also carry an invitation/provider marker in app metadata.
  IF NEW.invited_at IS NOT NULL
     OR COALESCE(NEW.raw_app_meta_data->>'provider', '') = 'email'
        AND COALESCE(NEW.raw_app_meta_data->>'providers', '') <> ''
        AND NEW.confirmation_sent_at IS NOT NULL
        AND NEW.encrypted_password IS NULL
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

-- Ensure the functions can run as triggers but are not exposed to browser clients.
REVOKE ALL ON FUNCTION public.enforce_invite_only() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_invite_only() TO service_role;

-- Ensure Data API privileges exist for the invite management tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Add explicit service-role write policies for invitations, in addition to existing admin policies.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations' AND policyname = 'Service role can insert invitations'
  ) THEN
    CREATE POLICY "Service role can insert invitations"
    ON public.invitations
    FOR INSERT
    TO service_role
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations' AND policyname = 'Service role can update invitations'
  ) THEN
    CREATE POLICY "Service role can update invitations"
    ON public.invitations
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations' AND policyname = 'Service role can delete invitations'
  ) THEN
    CREATE POLICY "Service role can delete invitations"
    ON public.invitations
    FOR DELETE
    TO service_role
    USING (true);
  END IF;
END;
$$;

-- Make profile/account provisioning idempotent so invite retries do not fail on duplicates.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
      updated_at = now();

  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = NEW.id) THEN
    INSERT INTO public.accounts (user_id, account_type, account_name, account_number, balance, available_balance)
    VALUES 
      (NEW.id, 'checking', 'Checking Account', LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 4582.75, 4582.75),
      (NEW.id, 'savings', 'Savings Account', LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 12350.20, 12350.20),
      (NEW.id, 'credit', 'Credit Card', LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 1245.50, 8754.50);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;