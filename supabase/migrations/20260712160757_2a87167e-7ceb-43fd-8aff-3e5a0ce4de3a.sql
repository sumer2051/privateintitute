
-- Drop the invite-only enforcement trigger (was blocking/crashing signups)
DROP TRIGGER IF EXISTS enforce_invite_only_before_insert ON auth.users;

-- Make handle_new_user resilient: never let it crash signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      INSERT INTO public.accounts (user_id, account_type, account_name, account_number, balance, available_balance)
      VALUES
        (NEW.id, 'checking', 'Checking Account', LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 4582.75, 4582.75),
        (NEW.id, 'savings',  'Savings Account',  LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 12350.20, 12350.20),
        (NEW.id, 'credit',   'Credit Card',      LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 1245.50, 8754.50);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user accounts insert failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
