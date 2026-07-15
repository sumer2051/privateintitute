CREATE OR REPLACE FUNCTION public.admin_update_transaction_status(p_tx uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_status NOT IN ('pending','processing','under_review','completed','failed','cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.transactions SET status = p_status WHERE id = p_tx;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_transaction_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_transaction_status(uuid, text) TO authenticated;