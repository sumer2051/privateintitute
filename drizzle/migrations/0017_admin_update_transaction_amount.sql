CREATE OR REPLACE FUNCTION public.admin_update_transaction_amount(p_tx uuid, p_amount numeric, p_reason text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  -- Pending deposits have not touched the balance yet; everything else has.
  IF NOT (tx.category = 'Pending Deposit' AND tx.status <> 'completed') THEN
    v_old_eff := CASE WHEN tx.transaction_type = 'debit' THEN -abs(tx.amount) ELSE abs(tx.amount) END;
    v_new_eff := CASE WHEN tx.transaction_type = 'debit' THEN -p_amount ELSE p_amount END;
    v_delta := v_new_eff - v_old_eff;
    IF acct.account_type = 'credit' THEN v_delta := -v_delta; END IF;
    v_bal := public.apply_balance_delta(tx.account_id, v_delta);
  END IF;
  UPDATE public.transactions SET amount = v_new, balance_after = v_bal WHERE id = p_tx;
  PERFORM public.log_staff_action('transaction.amount_change','transaction', p_tx,
    jsonb_build_object('from', tx.amount, 'to', v_new, 'reason', left(coalesce(p_reason,''),240)));
  RETURN v_new;
END $$;
REVOKE ALL ON FUNCTION public.admin_update_transaction_amount(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_transaction_amount(uuid, numeric, text) TO authenticated;