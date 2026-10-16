CREATE OR REPLACE FUNCTION public.has_investment_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','investor'));
$$;
REVOKE EXECUTE ON FUNCTION public.has_investment_access() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_investment_access() TO authenticated;
INSERT INTO public.user_roles(user_id, role) VALUES ('5cb43580-5967-44b8-b855-c7890dbaf02b', 'investor') ON CONFLICT DO NOTHING;