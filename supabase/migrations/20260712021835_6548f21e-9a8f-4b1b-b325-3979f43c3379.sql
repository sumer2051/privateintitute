
-- Prevent client-side tampering of financial columns via triggers.
-- SECURITY DEFINER RPCs (owned by postgres) bypass the check via current_user.

CREATE OR REPLACE FUNCTION public.prevent_financial_column_tampering_accounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF NEW.balance IS DISTINCT FROM OLD.balance
       OR NEW.available_balance IS DISTINCT FROM OLD.available_balance
       OR NEW.credit_limit IS DISTINCT FROM OLD.credit_limit
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.account_number IS DISTINCT FROM OLD.account_number
       OR NEW.account_type IS DISTINCT FROM OLD.account_type THEN
      RAISE EXCEPTION 'Modification of financial fields is not permitted from the client';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_accounts_financial_tampering ON public.accounts;
CREATE TRIGGER trg_prevent_accounts_financial_tampering
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_column_tampering_accounts();

CREATE OR REPLACE FUNCTION public.prevent_financial_column_tampering_transactions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.balance_after IS DISTINCT FROM OLD.balance_after
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.account_id IS DISTINCT FROM OLD.account_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.transaction_type IS DISTINCT FROM OLD.transaction_type THEN
      RAISE EXCEPTION 'Modification of financial transaction fields is not permitted from the client';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_transactions_financial_tampering ON public.transactions;
CREATE TRIGGER trg_prevent_transactions_financial_tampering
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_column_tampering_transactions();

-- Server-side helper: adjust caller's own account balance safely.
CREATE OR REPLACE FUNCTION public.adjust_account_balance(p_account uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_bal numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = p_account AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Account not owned by caller';
  END IF;
  UPDATE public.accounts
     SET balance = balance + p_delta,
         available_balance = available_balance + p_delta,
         updated_at = now()
   WHERE id = p_account
  RETURNING balance INTO new_bal;
  RETURN new_bal;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_account_balance(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_account_balance(uuid, numeric) TO authenticated;

-- Realtime: lock down broadcast/presence channels. App only uses postgres_changes,
-- so deny all direct writes/subscribes on realtime.messages.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all realtime broadcast" ON realtime.messages;
CREATE POLICY "Deny all realtime broadcast"
  ON realtime.messages
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
