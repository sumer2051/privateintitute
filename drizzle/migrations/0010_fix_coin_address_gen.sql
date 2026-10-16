CREATE OR REPLACE FUNCTION public.coin_address_for(p_user uuid, p_symbol text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $f$
DECLARE
  v_sym text := upper(p_symbol);
  v_addr text;
  v_charset text;
  v_prefix text;
  v_len int;
  v_raw bytea;
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
    v_raw := extensions.digest(v_hex || ':' || i::text, 'sha256');
    v_hex := encode(v_raw, 'hex');
    i := i + 1;
    FOR j IN 1..32 LOOP
      EXIT WHEN char_length(v_addr) >= char_length(v_prefix) + v_len;
      c := get_byte(v_raw, j - 1) % char_length(v_charset);
      v_addr := v_addr || substr(v_charset, c + 1, 1);
    END LOOP;
  END LOOP;

  INSERT INTO public.coin_addresses(user_id, symbol, address) VALUES (p_user, v_sym, v_addr) ON CONFLICT (user_id, symbol) DO NOTHING;
  SELECT address INTO v_addr FROM public.coin_addresses WHERE user_id = p_user AND symbol = v_sym;
  RETURN v_addr;
END $f$;
REVOKE ALL ON FUNCTION public.coin_address_for(uuid, text) FROM PUBLIC, anon, authenticated;
