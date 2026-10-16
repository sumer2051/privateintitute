-- Regenerate per-coin addresses in real-world formats:
-- BTC/LTC/ADA -> bech32 style, ETH/USDT/USDC/BNB -> 0x hex, SOL/XRP/DOGE/TRX -> base58 style
CREATE OR REPLACE FUNCTION public.coin_address_for(p_user uuid, p_symbol text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $f$
DECLARE
  v_sym text := upper(p_symbol);
  v_addr text;
  v_charset text;
  v_prefix text;
  v_len int;
  v_hex text;
  i int := 0;
  j int;
  c int;
BEGIN
  IF v_sym = 'BOA' THEN
    SELECT address INTO v_addr FROM public.coin_balances WHERE user_id = p_user;
    RETURN coalesce(v_addr, 'boa1' || substr(encode(extensions.digest(p_user::text || 'boa-coin', 'sha256'), 'hex'), 1, 38));
  END IF;
  SELECT address INTO v_addr FROM public.coin_addresses WHERE user_id = p_user AND symbol = v_sym;
  IF v_addr IS NOT NULL THEN RETURN v_addr; END IF;

  CASE v_sym
    WHEN 'BTC' THEN v_prefix := 'bc1q';   v_charset := 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'; v_len := 38;
    WHEN 'LTC' THEN v_prefix := 'ltc1q';  v_charset := 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'; v_len := 38;
    WHEN 'ADA' THEN v_prefix := 'addr1q'; v_charset := 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'; v_len := 48;
    WHEN 'ETH' THEN v_prefix := '0x';     v_charset := '0123456789abcdef'; v_len := 40;
    WHEN 'USDT' THEN v_prefix := '0x';    v_charset := '0123456789abcdef'; v_len := 40;
    WHEN 'USDC' THEN v_prefix := '0x';    v_charset := '0123456789abcdef'; v_len := 40;
    WHEN 'BNB' THEN v_prefix := '0x';     v_charset := '0123456789abcdef'; v_len := 40;
    WHEN 'SOL' THEN v_prefix := '';       v_charset := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; v_len := 44;
    WHEN 'XRP' THEN v_prefix := 'r';      v_charset := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; v_len := 33;
    WHEN 'DOGE' THEN v_prefix := 'D';     v_charset := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; v_len := 34;
    WHEN 'TRX' THEN v_prefix := 'T';      v_charset := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; v_len := 34;
    ELSE v_prefix := 'boa' || lower(v_sym) || '1'; v_charset := '0123456789abcdef'; v_len := 38;
  END CASE;

  v_hex := encode(extensions.digest(p_user::text || 'boa-' || v_sym, 'sha256'), 'hex');
  v_addr := v_prefix;
  WHILE char_length(v_addr) < char_length(v_prefix) + v_len LOOP
    v_hex := encode(extensions.digest(v_hex || ':' || i::text, 'sha256'), 'hex');
    i := i + 1;
    FOR j IN 1..32 LOOP
      EXIT WHEN char_length(v_addr) >= char_length(v_prefix) + v_len;
      c := ('x' || substr(v_hex, j * 2 - 1, 2))::bit(32)::int % char_length(v_charset);
      v_addr := v_addr || substr(v_charset, c + 1, 1);
    END LOOP;
  END LOOP;

  INSERT INTO public.coin_addresses(user_id, symbol, address) VALUES (p_user, v_sym, v_addr) ON CONFLICT (user_id, symbol) DO NOTHING;
  SELECT address INTO v_addr FROM public.coin_addresses WHERE user_id = p_user AND symbol = v_sym;
  RETURN v_addr;
END $f$;
REVOKE ALL ON FUNCTION public.coin_address_for(uuid, text) FROM PUBLIC, anon, authenticated;

-- Send matching: exact address lookup (case preserved for base58), BOA only for boa1
CREATE OR REPLACE FUNCTION public.send_tokens(p_symbol text, p_recipient text, p_amount numeric, p_note text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
DECLARE v_me uuid := auth.uid(); v_to uuid; v_bal numeric; v_sym text := upper(trim(coalesce(p_symbol,''))); v_key text := trim(coalesce(p_recipient,'')); v_lkey text := lower(trim(coalesce(p_recipient,''))); v_amt numeric := trunc(p_amount, 8); v_addr_sym text;
BEGIN
  IF position('@' in v_key) = 0 AND v_key <> '' THEN
    IF v_key LIKE 'boa1%' THEN
      IF v_sym <> 'BOA' THEN RAISE EXCEPTION 'That is a BOA address. Use the recipient''s % address or email.', v_sym; END IF;
    ELSE
      SELECT user_id, symbol INTO v_to, v_addr_sym FROM public.coin_addresses WHERE address = v_key;
      IF v_to IS NULL THEN RAISE EXCEPTION 'No BoA wallet uses that address'; END IF;
      IF v_addr_sym <> v_sym THEN RAISE EXCEPTION 'That is a % address. Choose % to send there.', v_addr_sym, v_addr_sym; END IF;
      v_lkey := (SELECT lower(email) FROM public.profiles WHERE id = v_to);
      IF v_lkey IS NULL THEN RAISE EXCEPTION 'No BoA member uses that address'; END IF;
      v_key := v_lkey;
    END IF;
  END IF;
  IF v_sym = 'BOA' THEN RETURN public.send_coins(v_key, p_amount, p_note); END IF;
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF v_sym <> ALL (ARRAY['BTC','ETH','USDT','BNB','SOL','XRP','USDC','DOGE','ADA','TRX','LTC']) THEN RAISE EXCEPTION 'Unknown coin'; END IF;
  IF v_amt IS NULL OR v_amt < 0.00000001 OR v_amt > 1000000000 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  IF v_to IS NULL THEN
    SELECT id INTO v_to FROM public.profiles WHERE lower(email) = v_lkey LIMIT 1;
    IF v_to IS NULL THEN RAISE EXCEPTION 'No BoA member uses that email'; END IF;
  END IF;
  IF v_to = v_me THEN RAISE EXCEPTION 'You cannot send coins to yourself'; END IF;
  SELECT units INTO v_bal FROM public.token_balances WHERE user_id = v_me AND symbol = v_sym FOR UPDATE;
  IF coalesce(v_bal,0) < v_amt THEN RAISE EXCEPTION 'Not enough %', v_sym; END IF;
  UPDATE public.token_balances SET units = units - v_amt, updated_at = now() WHERE user_id = v_me AND symbol = v_sym RETURNING units INTO v_bal;
  INSERT INTO public.token_balances(user_id, symbol, units) VALUES (v_to, v_sym, v_amt)
    ON CONFLICT (user_id, symbol) DO UPDATE SET units = token_balances.units + v_amt, updated_at = now();
  PERFORM public.coin_address_for(v_me, v_sym);
  PERFORM public.coin_address_for(v_to, v_sym);
  INSERT INTO public.coin_transfers(sender_id, recipient_id, amount, units, note, symbol) VALUES (v_me, v_to, greatest(round(v_amt,2), 0.01), v_amt, left(p_note, 140), v_sym);
  RETURN v_bal;
END $function$;
REVOKE ALL ON FUNCTION public.send_tokens(text, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_tokens(text, text, numeric, text) TO authenticated;
