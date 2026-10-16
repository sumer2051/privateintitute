ALTER TABLE public.coin_balances ADD COLUMN address text UNIQUE;
UPDATE public.coin_balances SET address = 'boa1' || substr(encode(extensions.digest(user_id::text || 'boa-coin', 'sha256'), 'hex'), 1, 38) WHERE address IS NULL;

CREATE OR REPLACE FUNCTION public.my_coin_address()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_me uuid := auth.uid(); v_addr text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  v_addr := 'boa1' || substr(encode(extensions.digest(v_me::text || 'boa-coin', 'sha256'), 'hex'), 1, 38);
  INSERT INTO public.coin_balances(user_id, balance, address) VALUES (v_me, 0, v_addr)
    ON CONFLICT (user_id) DO UPDATE SET address = coalesce(coin_balances.address, EXCLUDED.address);
  RETURN v_addr;
END $$;

CREATE OR REPLACE FUNCTION public.send_coins(p_recipient_email text, p_amount numeric, p_note text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_me uuid := auth.uid(); v_to uuid; v_bal numeric; v_key text := lower(trim(p_recipient_email));
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000000 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  IF v_key LIKE 'boa1%' THEN
    SELECT user_id INTO v_to FROM public.coin_balances WHERE address = v_key;
    IF v_to IS NULL THEN RAISE EXCEPTION 'No BoA wallet uses that address'; END IF;
  ELSE
    SELECT id INTO v_to FROM public.profiles WHERE lower(email) = v_key LIMIT 1;
    IF v_to IS NULL THEN RAISE EXCEPTION 'No BoA member uses that email'; END IF;
  END IF;
  IF v_to = v_me THEN RAISE EXCEPTION 'You cannot send coins to yourself'; END IF;
  SELECT balance INTO v_bal FROM public.coin_balances WHERE user_id = v_me FOR UPDATE;
  IF coalesce(v_bal,0) < p_amount THEN RAISE EXCEPTION 'Not enough coins'; END IF;
  UPDATE public.coin_balances SET balance = balance - p_amount, updated_at = now() WHERE user_id = v_me RETURNING balance INTO v_bal;
  INSERT INTO public.coin_balances(user_id, balance, address) VALUES (v_to, p_amount, 'boa1' || substr(encode(extensions.digest(v_to::text || 'boa-coin', 'sha256'), 'hex'), 1, 38))
    ON CONFLICT (user_id) DO UPDATE SET balance = coin_balances.balance + p_amount, updated_at = now();
  INSERT INTO public.coin_transfers(sender_id, recipient_id, amount, note) VALUES (v_me, v_to, round(p_amount,2), left(p_note, 140));
  RETURN v_bal;
END $$;
REVOKE EXECUTE ON FUNCTION public.my_coin_address() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_coin_address() TO authenticated;