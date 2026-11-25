CREATE TABLE public.allocation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.allocation_requests TO authenticated;
GRANT ALL ON public.allocation_requests TO service_role;
ALTER TABLE public.allocation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read allocation requests" ON public.allocation_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_request_allocation(p_account uuid, p_amount numeric, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE acct RECORD; v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000000 OR p_amount <> round(p_amount, 2) THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  SELECT * INTO acct FROM public.accounts WHERE id = p_account;
  IF acct.id IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF acct.account_type = 'credit' THEN RAISE EXCEPTION 'Choose a non-credit account'; END IF;
  INSERT INTO public.allocation_requests (account_id, user_id, amount, note, requested_by)
  VALUES (p_account, acct.user_id, p_amount, NULLIF(trim(p_note), ''), auth.uid()) RETURNING id INTO v_id;
  PERFORM public.log_staff_action('allocation.request', 'allocation', v_id, jsonb_build_object('account_id', p_account, 'amount', p_amount));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_allocation(p_request uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE r RECORD; new_bal numeric; v_tx uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO r FROM public.allocation_requests WHERE id = p_request FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Request already reviewed'; END IF;
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

REVOKE ALL ON FUNCTION public.admin_request_allocation(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_allocation(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_request_allocation(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_allocation(uuid, boolean, text) TO authenticated;