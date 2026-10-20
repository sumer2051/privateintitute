BEGIN;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  IF public.has_investment_access() THEN RAISE EXCEPTION 'Anonymous investment access must be denied'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
DO $$ BEGIN
  IF NOT public.has_investment_access() THEN RAISE EXCEPTION 'Signed-in users must have investment access without investor role'; END IF;
  BEGIN
    PERFORM public.sell_coins('00000000-0000-0000-0000-000000000002', 'BOA', 1, 0);
    RAISE EXCEPTION 'Sale into unowned account must fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Account not found' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
