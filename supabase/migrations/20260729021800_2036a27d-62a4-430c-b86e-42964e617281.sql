
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS staff_reply_pin text;

CREATE OR REPLACE FUNCTION public.staff_claim_ticket(p_ticket uuid)
RETURNS TABLE(pin text, assigned_to uuid, newly_generated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing text;
  existing_assignee uuid;
  new_pin text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'support')
    OR public.has_role(auth.uid(),'tx_support')
  ) THEN
    RAISE EXCEPTION 'Support staff only';
  END IF;

  SELECT staff_reply_pin, support_tickets.assigned_to
    INTO existing, existing_assignee
  FROM public.support_tickets WHERE id = p_ticket
  FOR UPDATE;

  IF existing IS NULL OR length(existing) <> 8 THEN
    new_pin := lpad((floor(random() * 100000000))::bigint::text, 8, '0');
    UPDATE public.support_tickets
       SET staff_reply_pin = new_pin,
           assigned_to = COALESCE(existing_assignee, auth.uid()),
           updated_at = now()
     WHERE id = p_ticket;
    PERFORM public.log_staff_action('ticket.claim_pin_generated','support_ticket', p_ticket,
      jsonb_build_object('assigned_to', COALESCE(existing_assignee, auth.uid())));
    RETURN QUERY SELECT new_pin, COALESCE(existing_assignee, auth.uid()), true;
  ELSE
    IF existing_assignee IS NULL THEN
      UPDATE public.support_tickets SET assigned_to = auth.uid(), updated_at = now() WHERE id = p_ticket;
      existing_assignee := auth.uid();
    END IF;
    RETURN QUERY SELECT existing, existing_assignee, false;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.staff_claim_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_claim_ticket(uuid) TO authenticated;
