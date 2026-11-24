CREATE TABLE public.admin_reserve (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_allocation numeric(20,2) NOT NULL DEFAULT 10000000000 CHECK (total_allocation >= 0),
  available_balance numeric(20,2) NOT NULL DEFAULT 10000000000 CHECK (available_balance >= 0 AND available_balance <= total_allocation),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_reserve TO authenticated;
GRANT ALL ON public.admin_reserve TO service_role;
ALTER TABLE public.admin_reserve ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read internal reserve" ON public.admin_reserve FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
COMMENT ON TABLE public.admin_reserve IS 'Internal USD allocation only; not proof of externally held cash or customer deposit backing.';

CREATE TABLE public.admin_reserve_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  transaction_id uuid,
  actor_id uuid NOT NULL,
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  reserve_after numeric(20,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_reserve_movements TO authenticated;
GRANT ALL ON public.admin_reserve_movements TO service_role;
ALTER TABLE public.admin_reserve_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read reserve funding history" ON public.admin_reserve_movements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.fund_admin_credit_from_reserve(p_account uuid, p_amount numeric, p_tx uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text; v_remaining numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  IF p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount <> round(p_amount, 2) THEN RAISE EXCEPTION 'Enter a valid USD amount with at most two decimals'; END IF;
  SELECT account_type INTO v_type FROM public.accounts WHERE id = p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF v_type = 'credit' THEN RETURN; END IF;
  UPDATE public.admin_reserve SET available_balance = available_balance - p_amount, updated_at = now()
    WHERE id = 1 AND available_balance >= p_amount RETURNING available_balance INTO v_remaining;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient internal reserve funds'; END IF;
  INSERT INTO public.admin_reserve_movements(account_id, transaction_id, actor_id, amount, reserve_after)
  VALUES (p_account, p_tx, auth.uid(), p_amount, v_remaining);
END;
$$;
REVOKE ALL ON FUNCTION public.fund_admin_credit_from_reserve(uuid,numeric,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_account_balance(p_account uuid, p_delta numeric, p_note text DEFAULT NULL::text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE new_bal numeric; acct_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT user_id INTO acct_user FROM public.accounts WHERE id = p_account;
  IF acct_user IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
  PERFORM public.fund_admin_credit_from_reserve(p_account, p_delta);
  new_bal := public.apply_balance_delta(p_account, p_delta);
  INSERT INTO public.transactions (user_id, account_id, transaction_type, amount, description, status, balance_after, category)
  VALUES (acct_user, p_account, CASE WHEN p_delta >= 0 THEN 'credit' ELSE 'debit' END,
          p_delta, COALESCE(p_note, 'Admin adjustment'), 'completed', new_bal, 'Admin');
  PERFORM public.log_staff_action('account.balance_adjust','account', p_account,
    jsonb_build_object('user_id', acct_user, 'delta', p_delta, 'note', p_note));
  RETURN new_bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_complete_pending_deposit(p_tx uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE tx RECORD; new_bal numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO tx FROM public.transactions WHERE id = p_tx FOR UPDATE;
  IF tx.id IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF tx.status = 'completed' THEN RAISE EXCEPTION 'Deposit already completed'; END IF;
  IF tx.category <> 'Pending Deposit' OR tx.transaction_type <> 'credit' THEN RAISE EXCEPTION 'Not a pending deposit'; END IF;
  PERFORM public.fund_admin_credit_from_reserve(tx.account_id, tx.amount, p_tx);
  new_bal := public.apply_balance_delta(tx.account_id, tx.amount);
  UPDATE public.transactions SET status = 'completed', balance_after = new_bal, category = 'Deposit' WHERE id = p_tx;
  PERFORM public.log_staff_action('deposit.complete','transaction', p_tx,
    jsonb_build_object('user_id', tx.user_id, 'account_id', tx.account_id, 'amount', tx.amount));
  RETURN new_bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_transaction_amount(p_tx uuid, p_amount numeric, p_reason text DEFAULT NULL::text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE tx RECORD; acct RECORD; v_new numeric; v_old_eff numeric; v_new_eff numeric; v_delta numeric; v_bal numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000000 OR p_amount <> round(p_amount, 2) THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  SELECT * INTO tx FROM public.transactions WHERE id = p_tx FOR UPDATE;
  IF tx.id IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  SELECT * INTO acct FROM public.accounts WHERE id = tx.account_id;
  v_new := CASE WHEN tx.amount < 0 THEN -p_amount ELSE p_amount END;
  IF v_new = tx.amount THEN RETURN tx.amount; END IF;
  v_bal := tx.balance_after;
  IF NOT (tx.category = 'Pending Deposit' AND tx.status <> 'completed') THEN
    v_old_eff := CASE WHEN tx.transaction_type = 'debit' THEN -abs(tx.amount) ELSE abs(tx.amount) END;
    v_new_eff := CASE WHEN tx.transaction_type = 'debit' THEN -p_amount ELSE p_amount END;
    v_delta := v_new_eff - v_old_eff;
    IF acct.account_type = 'credit' THEN v_delta := -v_delta; END IF;
    IF tx.transaction_type = 'credit' AND acct.account_type <> 'credit' THEN
      PERFORM public.fund_admin_credit_from_reserve(tx.account_id, v_delta, p_tx);
    END IF;
    v_bal := public.apply_balance_delta(tx.account_id, v_delta);
  END IF;
  UPDATE public.transactions SET amount = v_new, balance_after = v_bal WHERE id = p_tx;
  PERFORM public.log_staff_action('transaction.amount_change','transaction', p_tx,
    jsonb_build_object('from', tx.amount, 'to', v_new, 'reason', left(coalesce(p_reason,''),240)));
  RETURN v_new;
END;
$$;