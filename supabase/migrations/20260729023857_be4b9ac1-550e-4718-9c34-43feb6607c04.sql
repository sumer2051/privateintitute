
CREATE OR REPLACE FUNCTION public.assign_ticket_staff_pin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.staff_reply_pin IS NULL OR length(NEW.staff_reply_pin) <> 8 THEN
    NEW.staff_reply_pin := lpad((floor(random() * 100000000))::bigint::text, 8, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_ticket_staff_pin ON public.support_tickets;
CREATE TRIGGER trg_assign_ticket_staff_pin
BEFORE INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.assign_ticket_staff_pin();

CREATE OR REPLACE FUNCTION public.verify_ticket_pin(p_ticket uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE stored text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  IF NOT (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'support')
    OR public.has_role(auth.uid(),'tx_support')
  ) THEN
    RETURN FALSE;
  END IF;
  SELECT staff_reply_pin INTO stored FROM public.support_tickets WHERE id = p_ticket;
  IF stored IS NULL OR p_pin IS NULL THEN RETURN FALSE; END IF;
  RETURN stored = p_pin;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_ticket_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_ticket_pin(uuid, text) TO authenticated;

-- Backfill: give every existing ticket without a valid PIN one
UPDATE public.support_tickets
   SET staff_reply_pin = lpad((floor(random() * 100000000))::bigint::text, 8, '0')
 WHERE staff_reply_pin IS NULL OR length(staff_reply_pin) <> 8;
