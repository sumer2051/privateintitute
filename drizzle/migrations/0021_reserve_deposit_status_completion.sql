CREATE OR REPLACE FUNCTION public.admin_update_transaction_status(p_tx uuid, p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE tx RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tx_support')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('pending','processing','under_review','compliance_hold','reviewed','clearing','completed','posting','failed','cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO tx FROM public.transactions WHERE id = p_tx FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF tx.category = 'Pending Deposit' AND p_status = 'completed' THEN
    PERFORM public.admin_complete_pending_deposit(p_tx);
    RETURN true;
  END IF;
  UPDATE public.transactions SET status = p_status WHERE id = p_tx;
  PERFORM public.log_staff_action('transaction.status_change','transaction', p_tx,
    jsonb_build_object('from', tx.status, 'to', p_status));
  RETURN true;
END;
$$;