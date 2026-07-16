
-- 1. Profiles: staff PIN
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_pin_hash text;

-- 2. Accounts: freeze flag
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;

-- Allow admins to toggle is_frozen via tampering trigger
CREATE OR REPLACE FUNCTION public.prevent_financial_column_tampering_accounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF NEW.balance IS DISTINCT FROM OLD.balance
       OR NEW.available_balance IS DISTINCT FROM OLD.available_balance
       OR NEW.credit_limit IS DISTINCT FROM OLD.credit_limit
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.account_number IS DISTINCT FROM OLD.account_number
       OR NEW.account_type IS DISTINCT FROM OLD.account_type
       OR NEW.is_frozen IS DISTINCT FROM OLD.is_frozen THEN
      RAISE EXCEPTION 'Modification of financial fields is not permitted from the client';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Transactions: recipient info + widened status
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recipient_email text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recipient_name text;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check
  CHECK (status = ANY (ARRAY['pending','processing','under_review','completed','failed','cancelled']));

-- 4. Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read active announcements" ON public.announcements;
CREATE POLICY "authenticated read active announcements" ON public.announcements
  FOR SELECT TO authenticated USING (active = true);
DROP POLICY IF EXISTS "admin manage announcements" ON public.announcements;
CREATE POLICY "admin manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Staff audit log
CREATE TABLE IF NOT EXISTS public.staff_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_audit_log TO authenticated;
GRANT ALL ON public.staff_audit_log TO service_role;
ALTER TABLE public.staff_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read audit log" ON public.staff_audit_log;
CREATE POLICY "admin read audit log" ON public.staff_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_staff_action(_action text, _target_type text, _target_id uuid, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.staff_audit_log(actor_id, action, target_type, target_id, meta)
  VALUES (auth.uid(), _action, _target_type, _target_id, COALESCE(_meta, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.log_staff_action(text,text,uuid,jsonb) FROM PUBLIC;

-- 6. Staff PIN RPCs
CREATE OR REPLACE FUNCTION public.set_staff_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support') OR public.has_role(auth.uid(),'tx_support')) THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'Staff PIN must be 4 to 8 digits';
  END IF;
  UPDATE public.profiles
     SET staff_pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf'::text, 10)),
         updated_at = now()
   WHERE id = auth.uid();
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.set_staff_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_staff_pin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_staff_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
DECLARE h text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT staff_pin_hash INTO h FROM public.profiles WHERE id = auth.uid();
  IF h IS NULL THEN RETURN FALSE; END IF;
  RETURN h = extensions.crypt(_pin, h);
END;
$$;
REVOKE ALL ON FUNCTION public.verify_staff_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_staff_pin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT staff_pin_hash IS NOT NULL FROM public.profiles WHERE id = auth.uid()), FALSE);
$$;
REVOKE ALL ON FUNCTION public.has_staff_pin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_staff_pin() TO authenticated;

-- 7. Freeze/unfreeze accounts (admin only)
CREATE OR REPLACE FUNCTION public.admin_set_account_frozen(p_account uuid, p_frozen boolean, p_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE acct_user uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT user_id INTO acct_user FROM public.accounts WHERE id = p_account;
  IF acct_user IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
  UPDATE public.accounts SET is_frozen = p_frozen, updated_at = now() WHERE id = p_account;
  PERFORM public.log_staff_action(
    CASE WHEN p_frozen THEN 'account.freeze' ELSE 'account.unfreeze' END,
    'account', p_account,
    jsonb_build_object('user_id', acct_user, 'reason', p_reason)
  );
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_account_frozen(uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_account_frozen(uuid,boolean,text) TO authenticated;

-- 8. Block adjustments on frozen accounts
CREATE OR REPLACE FUNCTION public.adjust_account_balance(p_account uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE new_bal numeric; frozen boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT is_frozen INTO frozen FROM public.accounts WHERE id = p_account AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not owned by caller'; END IF;
  IF frozen THEN RAISE EXCEPTION 'Account is frozen. Please contact support.'; END IF;
  UPDATE public.accounts
     SET balance = balance + p_delta,
         available_balance = available_balance + p_delta,
         updated_at = now()
   WHERE id = p_account
  RETURNING balance INTO new_bal;
  RETURN new_bal;
END;
$$;

-- 9. Wrap admin RPCs to also log
CREATE OR REPLACE FUNCTION public.admin_update_transaction_status(p_tx uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE old_status text;
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
  SELECT status INTO old_status FROM public.transactions WHERE id = p_tx;
  UPDATE public.transactions SET status = p_status WHERE id = p_tx;
  PERFORM public.log_staff_action('transaction.status_change','transaction', p_tx,
    jsonb_build_object('from', old_status, 'to', p_status));
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_account_balance(p_account uuid, p_delta numeric, p_note text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE new_bal numeric; acct_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT user_id INTO acct_user FROM public.accounts WHERE id = p_account;
  IF acct_user IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
  UPDATE public.accounts
     SET balance = balance + p_delta,
         available_balance = available_balance + p_delta,
         updated_at = now()
   WHERE id = p_account
  RETURNING balance INTO new_bal;
  INSERT INTO public.transactions (user_id, account_id, transaction_type, amount, description, status, balance_after, category)
  VALUES (acct_user, p_account, CASE WHEN p_delta >= 0 THEN 'credit' ELSE 'debit' END,
          p_delta, COALESCE(p_note, 'Admin adjustment'), 'completed', new_bal, 'Admin');
  PERFORM public.log_staff_action('account.balance_adjust','account', p_account,
    jsonb_build_object('user_id', acct_user, 'delta', p_delta, 'note', p_note));
  RETURN new_bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_role(p_user uuid, p_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user, p_role) ON CONFLICT (user_id, role) DO NOTHING;
  PERFORM public.log_staff_action('role.grant','user', p_user, jsonb_build_object('role', p_role));
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_role(p_user uuid, p_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  DELETE FROM public.user_roles WHERE user_id = p_user AND role = p_role;
  PERFORM public.log_staff_action('role.revoke','user', p_user, jsonb_build_object('role', p_role));
  RETURN TRUE;
END;
$$;
