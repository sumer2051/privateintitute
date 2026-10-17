CREATE OR REPLACE FUNCTION public.confirm_my_transfer_with_note(p_tx uuid, p_note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT user_id, status INTO v_owner, v_status FROM public.transactions WHERE id = p_tx FOR UPDATE;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Only pending transfers can be confirmed'; END IF;
  UPDATE public.transactions SET status = 'processing' WHERE id = p_tx;
  PERFORM public.log_staff_action('customer_confirmed_transfer', 'transaction', p_tx,
    jsonb_build_object('customer_note', left(coalesce(trim(p_note), ''), 500)));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.confirm_my_transfer_with_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_my_transfer_with_note(uuid, text) TO authenticated;