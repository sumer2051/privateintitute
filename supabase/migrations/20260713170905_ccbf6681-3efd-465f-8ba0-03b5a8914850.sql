
-- 1. Update new-user seeding to $500 checking, $0 savings, $10,000 credit
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    )
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
          updated_at = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user profiles insert failed: %', SQLERRM;
  END;

  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = NEW.id) THEN
      INSERT INTO public.accounts (user_id, account_type, account_name, account_number, balance, available_balance, credit_limit)
      VALUES
        (NEW.id, 'checking', 'Checking Account', LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 500.00, 500.00, NULL),
        (NEW.id, 'savings',  'Savings Account',  LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 0.00, 0.00, NULL),
        (NEW.id, 'credit',   'Credit Card',      LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 0.00, 10000.00, 10000.00);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user accounts insert failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 2. Admin RPC: adjust any account balance by delta
CREATE OR REPLACE FUNCTION public.admin_adjust_account_balance(p_account uuid, p_delta numeric, p_note text DEFAULT NULL)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_bal numeric;
  acct_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT user_id INTO acct_user FROM public.accounts WHERE id = p_account;
  IF acct_user IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  UPDATE public.accounts
     SET balance = balance + p_delta,
         available_balance = available_balance + p_delta,
         updated_at = now()
   WHERE id = p_account
  RETURNING balance INTO new_bal;

  INSERT INTO public.transactions (user_id, account_id, transaction_type, amount, description, status, balance_after)
  VALUES (acct_user, p_account, CASE WHEN p_delta >= 0 THEN 'deposit' ELSE 'withdrawal' END,
          p_delta, COALESCE(p_note, 'Admin adjustment'), 'completed', new_bal);

  RETURN new_bal;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_adjust_account_balance(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_account_balance(uuid, numeric, text) TO authenticated;

-- 3. Admin RPC: grant a role to a user
CREATE OR REPLACE FUNCTION public.admin_grant_role(p_user uuid, p_role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_grant_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_role(uuid, app_role) TO authenticated;

-- 4. Admin RPC: revoke a role
CREATE OR REPLACE FUNCTION public.admin_revoke_role(p_user uuid, p_role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = p_user AND role = p_role;
  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_revoke_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid, app_role) TO authenticated;

-- 5. Allow admins to read all profiles, accounts, transactions for the admin panel
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all accounts" ON public.accounts;
CREATE POLICY "Admins can view all accounts" ON public.accounts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
CREATE POLICY "Admins can view all transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
CREATE POLICY "Admins can view all user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
