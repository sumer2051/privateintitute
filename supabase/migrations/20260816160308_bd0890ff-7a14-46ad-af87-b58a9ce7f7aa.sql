ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check CHECK (status = ANY (ARRAY['pending','processing','under_review','compliance_hold','reviewed','clearing','completed','failed','cancelled']));

CREATE OR REPLACE FUNCTION public.admin_update_transaction_status(p_tx uuid, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE old_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT (
       public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'tx_support')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_status NOT IN ('pending','processing','under_review','compliance_hold','reviewed','clearing','completed','failed','cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  SELECT status INTO old_status FROM public.transactions WHERE id = p_tx;
  UPDATE public.transactions SET status = p_status WHERE id = p_tx;
  PERFORM public.log_staff_action('transaction.status_change','transaction', p_tx,
    jsonb_build_object('from', old_status, 'to', p_status));
  RETURN FOUND;
END;
$function$;