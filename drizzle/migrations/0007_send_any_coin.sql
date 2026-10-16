ALTER TABLE public.coin_transfers ADD COLUMN IF NOT EXISTS symbol text NOT NULL DEFAULT 'BOA';

CREATE OR REPLACE FUNCTION public.send_tokens(p_symbol text, p_recipient text, p_amount numeric, p_note text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
DECLARE v_me uuid := auth.uid(); v_to uuid; v_bal numeric; v_sym text := upper(trim(coalesce(p_symbol,''))); v_key text := lower(trim(coalesce(p_recipient,''))); v_amt numeric := trunc(p_amount, 8);
BEGIN
  IF v_sym = 'BOA' THEN RETURN public.send_coins(p_recipient, p_amount, p_note); END IF;
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF v_sym <> ALL (ARRAY['BTC','ETH','USDT','BNB','SOL','XRP','USDC','DOGE','ADA','TRX','LTC']) THEN RAISE EXCEPTION 'Unknown coin'; END IF;
  IF v_amt IS NULL OR v_amt < 0.00000001 OR v_amt > 1000000000 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  IF v_key LIKE 'boa1%' THEN
    SELECT user_id INTO v_to FROM public.coin_balances WHERE address = v_key;
    IF v_to IS NULL THEN RAISE EXCEPTION 'No BoA wallet uses that address'; END IF;
  ELSE
    SELECT id INTO v_to FROM public.profiles WHERE lower(email) = v_key LIMIT 1;
    IF v_to IS NULL THEN RAISE EXCEPTION 'No BoA member uses that email'; END IF;
  END IF;
  IF v_to = v_me THEN RAISE EXCEPTION 'You cannot send coins to yourself'; END IF;
  SELECT units INTO v_bal FROM public.token_balances WHERE user_id = v_me AND symbol = v_sym FOR UPDATE;
  IF coalesce(v_bal,0) < v_amt THEN RAISE EXCEPTION 'Not enough %', v_sym; END IF;
  UPDATE public.token_balances SET units = units - v_amt, updated_at = now() WHERE user_id = v_me AND symbol = v_sym RETURNING units INTO v_bal;
  INSERT INTO public.token_balances(user_id, symbol, units) VALUES (v_to, v_sym, v_amt)
    ON CONFLICT (user_id, symbol) DO UPDATE SET units = token_balances.units + v_amt, updated_at = now();
  INSERT INTO public.coin_balances(user_id, balance, units, address) VALUES (v_to, 0, 0, 'boa1' || substr(encode(extensions.digest(v_to::text || 'boa-coin', 'sha256'), 'hex'), 1, 38))
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.coin_transfers(sender_id, recipient_id, amount, units, note, symbol) VALUES (v_me, v_to, greatest(round(v_amt,2), 0.01), v_amt, left(p_note, 140), v_sym);
  RETURN v_bal;
END $function$;
REVOKE ALL ON FUNCTION public.send_tokens(text, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_tokens(text, text, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.coin_activity_all()
RETURNS TABLE(id uuid, amount numeric, symbol text, note text, kind text, created_at timestamptz, direction text, counterparty text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT t.id, coalesce(t.units, t.amount), t.symbol, t.note, t.kind, t.created_at,
    CASE WHEN t.sender_id = auth.uid() THEN 'out' ELSE 'in' END,
    CASE WHEN t.kind = 'issue' THEN 'Issued by BoA'
         ELSE coalesce((SELECT coalesce(p.full_name, p.email) FROM public.profiles p WHERE p.id = CASE WHEN t.sender_id = auth.uid() THEN t.recipient_id ELSE t.sender_id END), 'Member') END
  FROM public.coin_transfers t
  WHERE t.sender_id = auth.uid() OR t.recipient_id = auth.uid()
  ORDER BY t.created_at DESC LIMIT 50;
$function$;
REVOKE ALL ON FUNCTION public.coin_activity_all() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coin_activity_all() TO authenticated;