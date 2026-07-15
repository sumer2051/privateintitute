
CREATE OR REPLACE FUNCTION public.admin_update_transaction_status(p_tx uuid, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (
       public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'tx_support')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_status NOT IN ('pending','processing','under_review','completed','failed','cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.transactions SET status = p_status WHERE id = p_tx;
  RETURN FOUND;
END;
$function$;

-- Allow tx_support to read transactions so they can list & manage statuses
DROP POLICY IF EXISTS "tx_support can view all transactions" ON public.transactions;
CREATE POLICY "tx_support can view all transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'tx_support'));
