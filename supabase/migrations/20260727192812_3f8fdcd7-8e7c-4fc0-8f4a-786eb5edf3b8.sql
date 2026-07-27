CREATE OR REPLACE FUNCTION public.set_transaction_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admins may post transactions on behalf of other users (e.g. pending deposits).
  -- Skip forcing user_id to auth.uid() when the caller is an admin.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.user_id := auth.uid();
  END IF;

  -- Ensure the account belongs to the transaction's user_id
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = NEW.account_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Account does not belong to current user';
  END IF;
  RETURN NEW;
END;
$function$;