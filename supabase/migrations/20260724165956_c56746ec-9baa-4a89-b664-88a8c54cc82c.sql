
CREATE OR REPLACE FUNCTION public.admin_post_pending_deposit(p_account uuid, p_amount numeric, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct_user uuid;
  cur_bal numeric;
  new_tx uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  SELECT user_id, balance INTO acct_user, cur_bal FROM public.accounts WHERE id = p_account;
  IF acct_user IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;

  INSERT INTO public.transactions
    (user_id, account_id, transaction_type, amount, description, status, balance_after, category)
  VALUES
    (acct_user, p_account, 'credit', p_amount, p_reason, 'pending', cur_bal, 'Pending Deposit')
  RETURNING id INTO new_tx;

  PERFORM public.log_staff_action('deposit.post_pending','transaction', new_tx,
    jsonb_build_object('user_id', acct_user, 'account_id', p_account, 'amount', p_amount, 'reason', p_reason));

  RETURN new_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_post_pending_deposit(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_post_pending_deposit(uuid, numeric, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_complete_pending_deposit(p_tx uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx RECORD;
  new_bal numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO tx FROM public.transactions WHERE id = p_tx;
  IF tx.id IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF tx.category <> 'Pending Deposit' OR tx.transaction_type <> 'credit' THEN
    RAISE EXCEPTION 'Not a pending deposit';
  END IF;
  IF tx.status = 'completed' THEN
    RAISE EXCEPTION 'Deposit already completed';
  END IF;

  UPDATE public.accounts
     SET balance = balance + tx.amount,
         available_balance = available_balance + tx.amount,
         updated_at = now()
   WHERE id = tx.account_id
  RETURNING balance INTO new_bal;

  UPDATE public.transactions
     SET status = 'completed',
         balance_after = new_bal,
         category = 'Deposit'
   WHERE id = p_tx;

  PERFORM public.log_staff_action('deposit.complete','transaction', p_tx,
    jsonb_build_object('user_id', tx.user_id, 'account_id', tx.account_id, 'amount', tx.amount));

  RETURN new_bal;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_complete_pending_deposit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_complete_pending_deposit(uuid) TO authenticated;
