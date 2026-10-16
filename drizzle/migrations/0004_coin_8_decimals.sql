ALTER TABLE public.coin_balances ADD COLUMN units numeric(30,8) NOT NULL DEFAULT 0 CHECK (units >= 0);
UPDATE public.coin_balances SET units = balance;
COMMENT ON COLUMN public.coin_balances.balance IS 'DEPRECATED: replaced by units (8 decimals)';
ALTER TABLE public.coin_transfers ADD COLUMN units numeric(30,8);
UPDATE public.coin_transfers SET units = amount;
COMMENT ON COLUMN public.coin_transfers.amount IS 'DEPRECATED: replaced by units (8 decimals)';

CREATE OR REPLACE FUNCTION public.send_coins(p_recipient_email text, p_amount numeric, p_note text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_me uuid := auth.uid(); v_to uuid; v_bal numeric; v_key text := lower(trim(p_recipient_email)); v_amt numeric := trunc(p_amount, 8);
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF v_amt IS NULL OR v_amt < 0.00000001 OR v_amt > 1000000000 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  IF v_key LIKE 'boa1%' THEN
    SELECT user_id INTO v_to FROM public.coin_balances WHERE address = v_key;
    IF v_to IS NULL THEN RAISE EXCEPTION 'No BoA wallet uses that address'; END IF;
  ELSE
    SELECT id INTO v_to FROM public.profiles WHERE lower(email) = v_key LIMIT 1;
    IF v_to IS NULL THEN RAISE EXCEPTION 'No BoA member uses that email'; END IF;
  END IF;
  IF v_to = v_me THEN RAISE EXCEPTION 'You cannot send coins to yourself'; END IF;
  SELECT units INTO v_bal FROM public.coin_balances WHERE user_id = v_me FOR UPDATE;
  IF coalesce(v_bal,0) < v_amt THEN RAISE EXCEPTION 'Not enough coins'; END IF;
  UPDATE public.coin_balances SET units = units - v_amt, balance = round(units - v_amt, 2), updated_at = now() WHERE user_id = v_me RETURNING units INTO v_bal;
  INSERT INTO public.coin_balances(user_id, balance, units, address) VALUES (v_to, round(v_amt,2), v_amt, 'boa1' || substr(encode(extensions.digest(v_to::text || 'boa-coin', 'sha256'), 'hex'), 1, 38))
    ON CONFLICT (user_id) DO UPDATE SET units = coin_balances.units + v_amt, balance = round(coin_balances.units + v_amt, 2), updated_at = now();
  INSERT INTO public.coin_transfers(sender_id, recipient_id, amount, units, note) VALUES (v_me, v_to, greatest(round(v_amt,2), 0.01), v_amt, left(p_note, 140));
  RETURN v_bal;
END $$;

CREATE OR REPLACE FUNCTION public.admin_issue_coins(p_amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_bal numeric; v_amt numeric := trunc(p_amount, 8);
BEGIN
  IF NOT public.has_role(v_me, 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF v_amt IS NULL OR v_amt < 0.00000001 OR v_amt > 1000000 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  INSERT INTO public.coin_balances(user_id, balance, units) VALUES (v_me, round(v_amt,2), v_amt)
    ON CONFLICT (user_id) DO UPDATE SET units = coin_balances.units + v_amt, balance = round(coin_balances.units + v_amt, 2), updated_at = now()
    RETURNING units INTO v_bal;
  INSERT INTO public.coin_transfers(sender_id, recipient_id, amount, units, kind) VALUES (NULL, v_me, greatest(round(v_amt,2), 0.01), v_amt, 'issue');
  RETURN v_bal;
END $$;

DROP FUNCTION IF EXISTS public.coin_activity();
CREATE FUNCTION public.coin_activity()
RETURNS TABLE(id uuid, amount numeric, note text, kind text, created_at timestamptz, direction text, counterparty text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, coalesce(t.units, t.amount), t.note, t.kind, t.created_at,
    CASE WHEN t.sender_id = auth.uid() THEN 'out' ELSE 'in' END,
    CASE WHEN t.kind = 'issue' THEN 'Issued by BoA'
         ELSE coalesce((SELECT coalesce(p.full_name, p.email) FROM public.profiles p WHERE p.id = CASE WHEN t.sender_id = auth.uid() THEN t.recipient_id ELSE t.sender_id END), 'Member') END
  FROM public.coin_transfers t
  WHERE t.sender_id = auth.uid() OR t.recipient_id = auth.uid()
  ORDER BY t.created_at DESC LIMIT 50;
$$;
REVOKE EXECUTE ON FUNCTION public.coin_activity() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.coin_activity() TO authenticated;