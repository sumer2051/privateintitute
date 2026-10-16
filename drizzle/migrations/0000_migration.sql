CREATE TABLE public.coin_balances (
  user_id uuid PRIMARY KEY,
  balance numeric(20,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_balances TO authenticated;
GRANT ALL ON public.coin_balances TO service_role;
ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own coin balance" ON public.coin_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.coin_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid,
  recipient_id uuid NOT NULL,
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  note text,
  kind text NOT NULL DEFAULT 'transfer',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_transfers TO authenticated;
GRANT ALL ON public.coin_transfers TO service_role;
ALTER TABLE public.coin_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own coin transfers" ON public.coin_transfers FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION public.send_coins(p_recipient_email text, p_amount numeric, p_note text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_to uuid; v_bal numeric;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000000 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  SELECT id INTO v_to FROM public.profiles WHERE lower(email) = lower(trim(p_recipient_email)) LIMIT 1;
  IF v_to IS NULL THEN RAISE EXCEPTION 'No BoA member uses that email'; END IF;
  IF v_to = v_me THEN RAISE EXCEPTION 'You cannot send coins to yourself'; END IF;
  SELECT balance INTO v_bal FROM public.coin_balances WHERE user_id = v_me FOR UPDATE;
  IF coalesce(v_bal,0) < p_amount THEN RAISE EXCEPTION 'Not enough coins'; END IF;
  UPDATE public.coin_balances SET balance = balance - p_amount, updated_at = now() WHERE user_id = v_me RETURNING balance INTO v_bal;
  INSERT INTO public.coin_balances(user_id, balance) VALUES (v_to, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = coin_balances.balance + p_amount, updated_at = now();
  INSERT INTO public.coin_transfers(sender_id, recipient_id, amount, note) VALUES (v_me, v_to, round(p_amount,2), left(p_note, 140));
  RETURN v_bal;
END $$;

CREATE OR REPLACE FUNCTION public.admin_issue_coins(p_amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_bal numeric;
BEGIN
  IF NOT public.has_role(v_me, 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  INSERT INTO public.coin_balances(user_id, balance) VALUES (v_me, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = coin_balances.balance + p_amount, updated_at = now()
    RETURNING balance INTO v_bal;
  INSERT INTO public.coin_transfers(sender_id, recipient_id, amount, kind) VALUES (NULL, v_me, round(p_amount,2), 'issue');
  RETURN v_bal;
END $$;

CREATE OR REPLACE FUNCTION public.coin_activity()
RETURNS TABLE(id uuid, amount numeric, note text, kind text, created_at timestamptz, direction text, counterparty text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.amount, t.note, t.kind, t.created_at,
    CASE WHEN t.sender_id = auth.uid() THEN 'out' ELSE 'in' END,
    CASE WHEN t.kind = 'issue' THEN 'Issued by BoA'
         ELSE coalesce((SELECT coalesce(p.full_name, p.email) FROM public.profiles p WHERE p.id = CASE WHEN t.sender_id = auth.uid() THEN t.recipient_id ELSE t.sender_id END), 'Member') END
  FROM public.coin_transfers t
  WHERE t.sender_id = auth.uid() OR t.recipient_id = auth.uid()
  ORDER BY t.created_at DESC LIMIT 50;
$$;
REVOKE EXECUTE ON FUNCTION public.send_coins(text, numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_issue_coins(numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.coin_activity() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.send_coins(text, numeric, text), public.admin_issue_coins(numeric), public.coin_activity() TO authenticated;