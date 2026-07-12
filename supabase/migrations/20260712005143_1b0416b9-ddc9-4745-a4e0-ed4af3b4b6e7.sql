
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN 'TKT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.support_ticket_seq')::text, 6, '0');
END; $$;
