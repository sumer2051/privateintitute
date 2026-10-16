CREATE OR REPLACE FUNCTION public.coin_activity_all()
 RETURNS TABLE(id uuid, amount numeric, symbol text, note text, kind text, created_at timestamp with time zone, direction text, counterparty text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT t.id, coalesce(t.units, t.amount), t.symbol, t.note, t.kind, t.created_at,
    CASE WHEN t.sender_id = auth.uid() THEN 'out' ELSE 'in' END,
    CASE WHEN t.kind = 'issue' THEN 'Issued by BoA'
         WHEN t.kind = 'buy' THEN 'Bought ' || t.symbol
         ELSE coalesce((SELECT coalesce(p.full_name, p.email) FROM public.profiles p WHERE p.id = CASE WHEN t.sender_id = auth.uid() THEN t.recipient_id ELSE t.sender_id END), 'Member') END
  FROM public.coin_transfers t
  WHERE t.sender_id = auth.uid() OR t.recipient_id = auth.uid()
  ORDER BY t.created_at DESC LIMIT 50;
$function$;