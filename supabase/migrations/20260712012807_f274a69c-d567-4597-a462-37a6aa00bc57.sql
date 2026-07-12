DROP POLICY IF EXISTS "Anyone can look up invitation by token" ON public.invitations;

REVOKE SELECT ON public.invitations FROM anon;

CREATE POLICY "Admins can read invitations"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can read invitations"
  ON public.invitations FOR SELECT
  TO service_role
  USING (true);