CREATE OR REPLACE FUNCTION public.swap_coins(p_from text, p_to text, p_amount numeric, p_min_out numeric DEFAULT 0)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_from text := lower(trim(coalesce(p_from, '')));
  v_to text := lower(trim(coalesce(p_to, '')));
  v_allowed text[] := ARRAY['boa','btc','eth','usdt','bnb','sol','xrp','usdc','doge','ada','trx','ltc'];
  v_rate_from numeric; v_rate_to numeric; v_out numeric; v_have numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT public.has_investment_access() THEN RAISE EXCEPTION 'Investment access is required'; END IF;
  IF v_from <> ALL (v_allowed) OR v_to <> ALL (v_allowed) THEN RAISE EXCEPTION 'Unknown coin'; END IF;
  IF v_from = v_to THEN RAISE EXCEPTION 'Choose two different coins'; END IF;
  IF p_amount IS NULL OR p_amount < 0.00000001 THEN RAISE EXCEPTION 'Enter an amount of at least 0.00000001'; END IF;
  IF p_amount <> round(p_amount, 8) THEN RAISE EXCEPTION 'Amounts take at most 8 decimals'; END IF;

  IF v_from = 'boa' THEN v_rate_from := 1; ELSE
    SELECT usd INTO v_rate_from FROM public.coin_rates WHERE symbol = upper(v_from) AND updated_at > now() - interval '10 minutes'; END IF;
  IF v_to = 'boa' THEN v_rate_to := 1; ELSE
    SELECT usd INTO v_rate_to FROM public.coin_rates WHERE symbol = upper(v_to) AND updated_at > now() - interval '10 minutes'; END IF;
  IF v_rate_from IS NULL OR v_rate_to IS NULL THEN RAISE EXCEPTION 'Prices are out of date. Refresh and try again.'; END IF;

  v_out := trunc(p_amount * v_rate_from / v_rate_to, 8);
  IF v_out <= 0 THEN RAISE EXCEPTION 'That amount is too small to swap'; END IF;
  IF v_out < coalesce(p_min_out, 0) THEN RAISE EXCEPTION 'The price moved. Please review the quote again.'; END IF;

  IF v_from = 'boa' THEN
    SELECT units INTO v_have FROM public.coin_balances WHERE user_id = v_user FOR UPDATE;
    IF coalesce(v_have, 0) < p_amount THEN RAISE EXCEPTION 'Not enough BoA Coin'; END IF;
    UPDATE public.coin_balances SET units = units - p_amount, balance = round(units - p_amount, 2), updated_at = now() WHERE user_id = v_user;
  ELSE
    SELECT units INTO v_have FROM public.token_balances WHERE user_id = v_user AND symbol = upper(v_from) FOR UPDATE;
    IF coalesce(v_have, 0) < p_amount THEN RAISE EXCEPTION 'Not enough %', upper(v_from); END IF;
    UPDATE public.token_balances SET units = units - p_amount, updated_at = now() WHERE user_id = v_user AND symbol = upper(v_from);
  END IF;

  IF v_to = 'boa' THEN
    INSERT INTO public.coin_balances (user_id, balance, units) VALUES (v_user, round(v_out, 2), v_out)
      ON CONFLICT (user_id) DO UPDATE SET units = coin_balances.units + v_out, balance = round(coin_balances.units + v_out, 2), updated_at = now();
  ELSE
    INSERT INTO public.token_balances (user_id, symbol, units) VALUES (v_user, upper(v_to), v_out)
      ON CONFLICT (user_id, symbol) DO UPDATE SET units = token_balances.units + v_out, updated_at = now();
  END IF;

  INSERT INTO public.coin_swaps (user_id, from_symbol, to_symbol, from_units, to_units, rate)
    VALUES (v_user, upper(v_from), upper(v_to), p_amount, v_out, v_rate_from / v_rate_to);
  RETURN v_out;
END
$function$;
REVOKE ALL ON FUNCTION public.swap_coins(text, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_coins(text, text, numeric, numeric) TO authenticated;