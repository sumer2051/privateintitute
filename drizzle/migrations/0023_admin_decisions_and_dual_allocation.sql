CREATE TABLE public.admin_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  user_id uuid NOT NULL,
  decision text NOT NULL,
  note text,
  status_before text,
  status_after text,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_review_decisions TO authenticated;
GRANT ALL ON public.admin_review_decisions TO service_role;
ALTER TABLE public.admin_review_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read review decisions" ON public.admin_review_decisions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_decide_transaction(p_tx uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE tx RECORD; v_status text; v_after text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_decision NOT IN ('flag','approve','deny') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT * INTO tx FROM public.transactions WHERE id = p_tx FOR UPDATE;
  IF tx.id IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  v_status := COALESCE(tx.status, 'pending');
  IF v_status IN ('completed','failed','cancelled') THEN RAISE EXCEPTION 'Transaction is already %', v_status; END IF;
  v_after := CASE p_decision WHEN 'approve' THEN 'completed' WHEN 'deny' THEN 'failed' ELSE 'under_review' END;
  PERFORM public.admin_update_transaction_status(p_tx, v_after);
  INSERT INTO public.admin_review_decisions (transaction_id, user_id, decision, note, status_before, status_after, actor_id)
  VALUES (p_tx, tx.user_id, p_decision, NULLIF(trim(p_note), ''), v_status, v_after, auth.uid());
  PERFORM public.log_staff_action('transaction.' || p_decision, 'transaction', p_tx, jsonb_build_object('from', v_status, 'to', v_after, 'note', p_note));
  RETURN v_after;
END; $$;
REVOKE ALL ON FUNCTION public.admin_decide_transaction(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_transaction(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_allocation(p_request uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE r RECORD; new_bal numeric; v_tx uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO r FROM public.allocation_requests WHERE id = p_request FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request already reviewed'; END IF;
  IF p_approve AND r.requested_by = auth.uid() THEN RAISE EXCEPTION 'A second admin must approve this request'; END IF;
  IF p_approve THEN
    PERFORM public.fund_admin_credit_from_reserve(r.account_id, r.amount);
    new_bal := public.apply_balance_delta(r.account_id, r.amount);
    INSERT INTO public.transactions (user_id, account_id, transaction_type, amount, description, status, balance_after, category)
    VALUES (r.user_id, r.account_id, 'credit', r.amount, COALESCE(r.note, 'Internal allocation'), 'completed', new_bal, 'Admin')
    RETURNING id INTO v_tx;
    UPDATE public.allocation_requests SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = NULLIF(trim(p_note), ''), transaction_id = v_tx WHERE id = p_request;
  ELSE
    UPDATE public.allocation_requests SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = NULLIF(trim(p_note), '') WHERE id = p_request;
  END IF;
  PERFORM public.log_staff_action(CASE WHEN p_approve THEN 'allocation.approve' ELSE 'allocation.reject' END, 'allocation', p_request, jsonb_build_object('amount', r.amount, 'account_id', r.account_id));
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
END; $$;