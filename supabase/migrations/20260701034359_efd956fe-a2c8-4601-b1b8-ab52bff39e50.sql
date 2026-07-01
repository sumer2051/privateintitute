
-- 1) Lock down SECURITY DEFINER helper functions: revoke from anon/authenticated (still callable by triggers/service_role)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 2) Hide all public tables from the pg_graphql schema (app uses PostgREST only)
REVOKE USAGE ON SCHEMA graphql FROM anon, authenticated, PUBLIC;
REVOKE USAGE ON SCHEMA graphql_public FROM anon, authenticated, PUBLIC;

-- 3) Harden transactions table (privilege escalation finding)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill user_id from the owning account
UPDATE public.transactions t
SET user_id = a.user_id
FROM public.accounts a
WHERE t.account_id = a.id AND t.user_id IS NULL;

ALTER TABLE public.transactions ALTER COLUMN user_id SET NOT NULL;

-- Enforce user_id server-side via trigger (client can't spoof it)
CREATE OR REPLACE FUNCTION public.set_transaction_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Always trust auth.uid() over any client-supplied value
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  -- Ensure the account belongs to this user
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = NEW.account_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Account does not belong to current user';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_transaction_user_id_trg ON public.transactions;
CREATE TRIGGER set_transaction_user_id_trg
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_transaction_user_id();

-- Replace policies to check user_id directly and block UPDATE/DELETE entirely
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.accounts
    WHERE accounts.id = transactions.account_id
      AND accounts.user_id = auth.uid()
  )
);
-- Deliberately no UPDATE or DELETE policy: authenticated users cannot modify or delete transactions.

-- Tighten grants on transactions to only what's needed
REVOKE UPDATE, DELETE ON public.transactions FROM authenticated, anon;
GRANT SELECT, INSERT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
