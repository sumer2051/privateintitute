CREATE OR REPLACE FUNCTION public.buy_coins(p_account uuid, p_symbol text, p_usd numeric, p_min_out numeric DEFAULT 0)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_sym text := lower(trim(coalesce(p_symbol, '')));
  v_allowed text[] := ARRAY['boa','btc','eth','usdt','bnb','sol','xrp','usdc','doge','ada','trx','ltc'];
  v_rate numeric; v_out numeric; a RECORD; v_bal numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT public.has_investment_access() THEN RAISE EXCEPTION 'Investment access is required'; END IF;
  IF v_sym <> ALL (v_allowed) THEN RAISE EXCEPTION 'Unknown coin'; END IF;
  IF p_usd IS NULL OR p_usd < 1 THEN RAISE EXCEPTION 'Minimum purchase is $1.00'; END IF;
  IF p_usd > 100000 THEN RAISE EXCEPTION 'Maximum purchase is $100,000'; END IF;
  IF p_usd <> round(p_usd, 2) THEN RAISE EXCEPTION 'Use dollars and cents only'; END IF;

  SELECT * INTO a FROM public.accounts WHERE id = p_account AND user_id = v_user;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF coalesce(a.is_active, true) = false OR a.is_frozen THEN RAISE EXCEPTION 'This account cannot be used right now'; END IF;

  IF v_sym = 'boa' THEN v_rate := 1; ELSE
    SELECT usd INTO v_rate FROM public.coin_rates WHERE symbol = upper(v_sym) AND updated_at > now() - interval '10 minutes'; END IF;
  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'Prices are out of date. Refresh and try again.'; END IF;

  v_out := trunc(p_usd / v_rate, 8);
  IF v_out <= 0 THEN RAISE EXCEPTION 'That amount is too small'; END IF;
  IF v_out < coalesce(p_min_out, 0) THEN RAISE EXCEPTION 'The price moved. Please review the quote again.'; END IF;

  v_bal := public.apply_balance_delta(p_account, CASE WHEN a.account_type = 'credit' THEN p_usd ELSE -p_usd END);

  INSERT INTO public.transactions (account_id, user_id, transaction_type, category, description, amount, balance_after, status, currency, reference_number)
  VALUES (p_account, v_user, 'debit', 'investment', 'Coin purchase · ' || trim(to_char(v_out, 'FM999999999990.00000000')) || ' ' || upper(v_sym), p_usd, v_bal, 'completed', 'USD', 'BUY' || upper(substr(md5(random()::text), 1, 10)));

  IF v_sym = 'boa' THEN
    INSERT INTO public.coin_balances (user_id, balance, units) VALUES (v_user, round(v_out, 2), v_out)
      ON CONFLICT (user_id) DO UPDATE SET units = coin_balances.units + v_out, balance = round(coin_balances.units + v_out, 2), updated_at = now();
  ELSE
    INSERT INTO public.token_balances (user_id, symbol, units) VALUES (v_user, upper(v_sym), v_out)
      ON CONFLICT (user_id, symbol) DO UPDATE SET units = token_balances.units + v_out, updated_at = now();
  END IF;

  INSERT INTO public.coin_transfers (sender_id, recipient_id, amount, units, symbol, note, kind)
    VALUES (NULL, v_user, round(v_out, 2), v_out, upper(v_sym), 'Bought for $' || to_char(p_usd, 'FM999999990.00') || ' from ' || a.account_name, 'buy');
  RETURN v_out;
END
$function$;
REVOKE ALL ON FUNCTION public.buy_coins(uuid, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_coins(uuid, text, numeric, numeric) TO authenticated;