DROP POLICY IF EXISTS "Members can read coin prices" ON public.coin_rates;
CREATE POLICY "Investment members can read coin prices" ON public.coin_rates
FOR SELECT TO authenticated
USING (public.has_investment_access());