CREATE TABLE public.coin_addresses (
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  address text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, symbol)
);
GRANT SELECT ON public.coin_addresses TO authenticated;
GRANT ALL ON public.coin_addresses TO service_role;
ALTER TABLE public.coin_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own coin addresses" ON public.coin_addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.coin_address_for(p_user uuid, p_symbol text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $f$
DECLARE v_sym text := upper(p_symbol); v_addr text;
BEGIN
  IF v_sym = 'BOA' THEN
    SELECT address INTO v_addr FROM public.coin_balances WHERE user_id = p_user;
    RETURN coalesce(v_addr, 'boa1' || substr(encode(extensions.digest(p_user::text || 'boa-coin', 'sha256'), 'hex'), 1, 38));
  END IF;
  SELECT address INTO v_addr FROM public.coin_addresses WHERE user_id = p_user AND symbol = v_sym;
  IF v_addr IS NULL THEN
    v_addr := 'boa' || lower(v_sym) || '1' || substr(encode(extensions.digest(p_user::text || 'boa-' || v_sym, 'sha256'), 'hex'), 1, 38);
    INSERT INTO public.coin_addresses(user_id, symbol, address) VALUES (p_user, v_sym, v_addr) ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_addr;
END $f$;
REVOKE ALL ON FUNCTION public.coin_address_for(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_coin_addresses()
RETURNS TABLE(symbol text, address text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
DECLARE s text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  FOREACH s IN ARRAY ARRAY['BOA','BTC','ETH','USDT','BNB','SOL','XRP','USDC','DOGE','ADA','TRX','LTC'] LOOP
    symbol := s; address := public.coin_address_for(auth.uid(), s); RETURN NEXT;
  END LOOP;
END $f$;
REVOKE ALL ON FUNCTION public.my_coin_addresses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_coin_addresses() TO authenticated;

CREATE OR REPLACE FUNCTION public.send_tokens(p_symbol text, p_recipient text, p_amount numeric, p_note text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
DECLARE v_me uuid := auth.uid(); v_to uuid; v_bal numeric; v_sym text := upper(trim(coalesce(p_symbol,''))); v_key text := lower(trim(coalesce(p_recipient,''))); v_amt numeric := trunc(p_amount, 8); v_addr_sym text;
BEGIN
  IF v_key LIKE 'boa%1%' AND v_key NOT LIKE 'boa1%' AND position('@' in v_key) = 0 THEN
    SELECT user_id, symbol INTO v_to, v_addr_sym FROM public.coin_addresses WHERE address = v_key;
    IF v_to IS NULL THEN RAISE EXCEPTION 'No BoA wallet uses that address'; END IF;
    IF v_addr_sym <> v_sym THEN RAISE EXCEPTION 'That is a % address. Choose % to send there.', v_addr_sym, v_addr_sym; END IF;
    v_key := (SELECT lower(email) FROM public.profiles WHERE id = v_to);
    IF v_key IS NULL THEN RAISE EXCEPTION 'No BoA member uses that address'; END IF;
  ELSIF v_key LIKE 'boa1%' AND v_sym <> 'BOA' THEN
    RAISE EXCEPTION 'That is a BOA address. Use the recipient''s % address or email.', v_sym;
  END IF;
  IF v_sym = 'BOA' THEN RETURN public.send_coins(v_key, p_amount, p_note); END IF;
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF v_sym <> ALL (ARRAY['BTC','ETH','USDT','BNB','SOL','XRP','USDC','DOGE','ADA','TRX','LTC']) THEN RAISE EXCEPTION 'Unknown coin'; END IF;
  IF v_amt IS NULL OR v_amt < 0.00000001 OR v_amt > 1000000000 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  IF v_to IS NULL THEN
    SELECT id INTO v_to FROM public.profiles WHERE lower(email) = v_key LIMIT 1;
    IF v_to IS NULL THEN RAISE EXCEPTION 'No BoA member uses that email'; END IF;
  END IF;
  IF v_to = v_me THEN RAISE EXCEPTION 'You cannot send coins to yourself'; END IF;
  SELECT units INTO v_bal FROM public.token_balances WHERE user_id = v_me AND symbol = v_sym FOR UPDATE;
  IF coalesce(v_bal,0) < v_amt THEN RAISE EXCEPTION 'Not enough %', v_sym; END IF;
  UPDATE public.token_balances SET units = units - v_amt, updated_at = now() WHERE user_id = v_me AND symbol = v_sym RETURNING units INTO v_bal;
  INSERT INTO public.token_balances(user_id, symbol, units) VALUES (v_to, v_sym, v_amt)
    ON CONFLICT (user_id, symbol) DO UPDATE SET units = token_balances.units + v_amt, updated_at = now();
  PERFORM public.coin_address_for(v_me, v_sym);
  PERFORM public.coin_address_for(v_to, v_sym);
  INSERT INTO public.coin_transfers(sender_id, recipient_id, amount, units, note, symbol) VALUES (v_me, v_to, greatest(round(v_amt,2), 0.01), v_amt, left(p_note, 140), v_sym);
  RETURN v_bal;
END $function$;
REVOKE ALL ON FUNCTION public.send_tokens(text, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_tokens(text, text, numeric, text) TO authenticated;