CREATE OR REPLACE FUNCTION public.has_investment_access()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT auth.uid() IS NOT NULL; $$;

CREATE OR REPLACE FUNCTION public.sell_coins(p_account uuid, p_symbol text, p_units numeric, p_min_usd numeric DEFAULT 0)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_sym text := upper(trim(coalesce(p_symbol,'')));
  v_rate numeric; v_usd numeric; v_have numeric; a RECORD; v_bal numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF v_sym <> ALL (ARRAY['BOA','BTC','ETH','USDT','BNB','SOL','XRP','USDC','DOGE','ADA','TRX','LTC']) THEN RAISE EXCEPTION 'Unknown coin'; END IF;
  IF p_units IS NULL OR p_units < 0.00000001 OR p_units <> round(p_units, 8) THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  SELECT * INTO a FROM public.accounts WHERE id = p_account AND user_id = v_user AND account_type <> 'credit';
  IF a.id IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF coalesce(a.is_active,true) = false OR a.is_frozen THEN RAISE EXCEPTION 'This account cannot be used right now'; END IF;
  IF v_sym = 'BOA' THEN v_rate := 1; ELSE
    SELECT usd INTO v_rate FROM public.coin_rates WHERE symbol = v_sym AND updated_at > now() - interval '10 minutes'; END IF;
  IF v_rate IS NULL OR v_rate <= 0 THEN RAISE EXCEPTION 'Prices are out of date. Refresh and try again.'; END IF;
  v_usd := trunc(p_units * v_rate, 2);
  IF v_usd < 0.01 THEN RAISE EXCEPTION 'That amount is worth less than one cent'; END IF;
  IF v_usd < coalesce(p_min_usd,0) THEN RAISE EXCEPTION 'The price moved. Please review the quote again.'; END IF;

  IF v_sym = 'BOA' THEN
    SELECT units INTO v_have FROM public.coin_balances WHERE user_id = v_user FOR UPDATE;
    IF coalesce(v_have,0) < p_units THEN RAISE EXCEPTION 'Not enough BOA'; END IF;
    UPDATE public.coin_balances SET units = units - p_units, balance = round(units - p_units, 2), updated_at = now() WHERE user_id = v_user;
  ELSE
    SELECT units INTO v_have FROM public.token_balances WHERE user_id = v_user AND symbol = v_sym FOR UPDATE;
    IF coalesce(v_have,0) < p_units THEN RAISE EXCEPTION 'Not enough %', v_sym; END IF;
    UPDATE public.token_balances SET units = units - p_units, updated_at = now() WHERE user_id = v_user AND symbol = v_sym;
  END IF;

  v_bal := public.apply_balance_delta(p_account, v_usd);
  INSERT INTO public.transactions (account_id, user_id, transaction_type, category, description, amount, balance_after, status, currency, reference_number)
  VALUES (p_account, v_user, 'credit', 'investment', 'Coin sale · ' || trim(to_char(p_units, 'FM999999999990.00000000')) || ' ' || v_sym, v_usd, v_bal, 'completed', 'USD', 'SELL' || upper(substr(md5(random()::text),1,10)));
  INSERT INTO public.coin_transfers (sender_id, recipient_id, amount, units, symbol, note, kind)
  VALUES (v_user, v_user, greatest(round(p_units,2),0.01), p_units, v_sym, 'Sold for $' || to_char(v_usd,'FM999999990.00') || ' to ' || a.account_name, 'sell');
  RETURN v_usd;
END $$;
REVOKE ALL ON FUNCTION public.sell_coins(uuid,text,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sell_coins(uuid,text,numeric,numeric) TO authenticated;