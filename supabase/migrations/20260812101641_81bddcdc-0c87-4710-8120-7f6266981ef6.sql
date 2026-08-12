-- 1. Repair existing negative balances
UPDATE public.accounts SET balance = 0, available_balance = 0, updated_at = now()
WHERE balance < 0 OR available_balance < 0;

-- 2. Credit repayment columns
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS payment_due_date date,
  ADD COLUMN IF NOT EXISTS minimum_payment numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS autopay_enabled boolean NOT NULL DEFAULT false;

-- 3. Hard guard: no negative balances anywhere
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_balance_non_negative CHECK (balance >= 0 AND available_balance >= 0);

-- 4. Central balance mutation helper used by all RPCs
CREATE OR REPLACE FUNCTION public.apply_balance_delta(p_account uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE a RECORD; new_bal numeric;
BEGIN
  SELECT * INTO a FROM public.accounts WHERE id = p_account FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;

  IF a.account_type = 'credit' THEN
    -- balance = amount owed. Positive delta = new charge, negative = repayment.
    IF a.balance + p_delta < 0 THEN
      RAISE EXCEPTION 'Payment exceeds the amount owed on this card';
    END IF;
    IF a.credit_limit IS NOT NULL AND a.balance + p_delta > a.credit_limit THEN
      RAISE EXCEPTION 'This charge would exceed the card credit limit';
    END IF;
    UPDATE public.accounts
       SET balance = balance + p_delta,
           available_balance = GREATEST(COALESCE(credit_limit, 0) - (balance + p_delta), 0),
           updated_at = now()
     WHERE id = p_account
    RETURNING balance INTO new_bal;
  ELSE
    IF a.balance + p_delta < 0 OR a.available_balance + p_delta < 0 THEN
      RAISE EXCEPTION 'Insufficient funds in this account';
    END IF;
    UPDATE public.accounts
       SET balance = balance + p_delta,
           available_balance = available_balance + p_delta,
           updated_at = now()
     WHERE id = p_account
    RETURNING balance INTO new_bal;
  END IF;

  RETURN new_bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_account_balance(p_account uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE frozen boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT is_frozen INTO frozen FROM public.accounts WHERE id = p_account AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not owned by caller'; END IF;
  IF frozen THEN RAISE EXCEPTION 'Account is frozen. Please contact support.'; END IF;
  RETURN public.apply_balance_delta(p_account, p_delta);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_account_balance(p_account uuid, p_delta numeric, p_note text DEFAULT NULL::text)
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
  new_bal := public.apply_balance_delta(p_account, p_delta);
  INSERT INTO public.transactions (user_id, account_id, transaction_type, amount, description, status, balance_after, category)
  VALUES (acct_user, p_account, CASE WHEN p_delta >= 0 THEN 'credit' ELSE 'debit' END,
          p_delta, COALESCE(p_note, 'Admin adjustment'), 'completed', new_bal, 'Admin');
  PERFORM public.log_staff_action('account.balance_adjust','account', p_account,
    jsonb_build_object('user_id', acct_user, 'delta', p_delta, 'note', p_note));
  RETURN new_bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_complete_pending_deposit(p_tx uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE tx RECORD; new_bal numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT * INTO tx FROM public.transactions WHERE id = p_tx;
  IF tx.id IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF tx.category <> 'Pending Deposit' OR tx.transaction_type <> 'credit' THEN
    RAISE EXCEPTION 'Not a pending deposit';
  END IF;
  IF tx.status = 'completed' THEN RAISE EXCEPTION 'Deposit already completed'; END IF;

  new_bal := public.apply_balance_delta(tx.account_id, tx.amount);

  UPDATE public.transactions
     SET status = 'completed', balance_after = new_bal, category = 'Deposit'
   WHERE id = p_tx;

  PERFORM public.log_staff_action('deposit.complete','transaction', p_tx,
    jsonb_build_object('user_id', tx.user_id, 'account_id', tx.account_id, 'amount', tx.amount));
  RETURN new_bal;
END;
$$;

-- 5. Credit card repayment schedule maintenance
CREATE OR REPLACE FUNCTION public.maintain_credit_schedule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.account_type <> 'credit' THEN RETURN NEW; END IF;

  IF NEW.balance <= 0 THEN
    NEW.payment_due_date := NULL;
    NEW.minimum_payment := 0;
  ELSE
    IF NEW.payment_due_date IS NULL THEN
      NEW.payment_due_date := (now() + interval '21 days')::date;
    END IF;
    NEW.minimum_payment := LEAST(NEW.balance, GREATEST(25, ROUND(NEW.balance * 0.02, 2)));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_maintain_credit_schedule ON public.accounts;
CREATE TRIGGER accounts_maintain_credit_schedule
BEFORE INSERT OR UPDATE OF balance ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.maintain_credit_schedule();

-- 6. Pay a credit card from a deposit account
CREATE OR REPLACE FUNCTION public.pay_credit_card(p_credit uuid, p_from uuid, p_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE credit RECORD; src RECORD; owed_after numeric; src_bal numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;

  SELECT * INTO credit FROM public.accounts WHERE id = p_credit AND user_id = auth.uid() AND account_type = 'credit';
  IF credit.id IS NULL THEN RAISE EXCEPTION 'Credit card not found'; END IF;
  SELECT * INTO src FROM public.accounts WHERE id = p_from AND user_id = auth.uid() AND account_type <> 'credit';
  IF src.id IS NULL THEN RAISE EXCEPTION 'Funding account not found'; END IF;
  IF src.is_frozen THEN RAISE EXCEPTION 'Funding account is frozen. Please contact support.'; END IF;
  IF credit.balance <= 0 THEN RAISE EXCEPTION 'This card has no balance due'; END IF;

  p_amount := LEAST(p_amount, credit.balance);

  src_bal := public.apply_balance_delta(p_from, -p_amount);
  owed_after := public.apply_balance_delta(p_credit, -p_amount);

  UPDATE public.accounts
     SET last_payment_at = now(),
         payment_due_date = CASE WHEN owed_after > 0 THEN payment_due_date ELSE NULL END
   WHERE id = p_credit;

  INSERT INTO public.transactions (user_id, account_id, transaction_type, amount, description, status, balance_after, category)
  VALUES (auth.uid(), p_from, 'debit', -p_amount, 'Credit card payment', 'completed', src_bal, 'Payment'),
         (auth.uid(), p_credit, 'credit', -p_amount, 'Payment received - thank you', 'completed', owed_after, 'Payment');

  RETURN owed_after;
END;
$$;

-- 7. Automatic overdue collection for the calling user
CREATE OR REPLACE FUNCTION public.process_my_overdue_credit_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE c RECORD; funding RECORD; due numeric; late_fee numeric; owed_after numeric; src_bal numeric; n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;

  FOR c IN
    SELECT * FROM public.accounts
     WHERE user_id = auth.uid() AND account_type = 'credit'
       AND balance > 0 AND payment_due_date IS NOT NULL AND payment_due_date < CURRENT_DATE
  LOOP
    SELECT * INTO funding FROM public.accounts
     WHERE user_id = auth.uid() AND account_type = 'checking' AND is_frozen = false
     ORDER BY available_balance DESC LIMIT 1;

    late_fee := 0;
    due := LEAST(c.balance, GREATEST(c.minimum_payment, 25));

    IF funding.id IS NULL OR funding.available_balance <= 0 THEN
      -- cannot collect: add late fee to the card and roll the due date
      late_fee := LEAST(35, GREATEST(0, COALESCE(c.credit_limit, 0) - c.balance));
      IF late_fee > 0 THEN
        owed_after := public.apply_balance_delta(c.id, late_fee);
        INSERT INTO public.transactions (user_id, account_id, transaction_type, amount, description, status, balance_after, category)
        VALUES (auth.uid(), c.id, 'debit', late_fee, 'Late payment fee', 'completed', owed_after, 'Fee');
      END IF;
      UPDATE public.accounts SET payment_due_date = (CURRENT_DATE + 30) WHERE id = c.id;
    ELSE
      due := LEAST(due, funding.available_balance);
      src_bal := public.apply_balance_delta(funding.id, -due);
      owed_after := public.apply_balance_delta(c.id, -due);

      INSERT INTO public.transactions (user_id, account_id, transaction_type, amount, description, status, balance_after, category)
      VALUES (auth.uid(), funding.id, 'debit', -due, 'Credit card autopay - past due', 'completed', src_bal, 'Payment'),
             (auth.uid(), c.id, 'credit', -due, 'Autopay received - past due', 'completed', owed_after, 'Payment');

      UPDATE public.accounts
         SET last_payment_at = now(),
             payment_due_date = CASE WHEN owed_after > 0 THEN (CURRENT_DATE + 30) ELSE NULL END
       WHERE id = c.id;
    END IF;

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_balance_delta(uuid, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_credit_card(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_my_overdue_credit_payments() TO authenticated;