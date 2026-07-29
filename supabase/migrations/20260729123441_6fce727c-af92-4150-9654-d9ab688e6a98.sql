
CREATE OR REPLACE FUNCTION public.admin_create_ticket(
  p_user uuid,
  p_subject text,
  p_description text,
  p_priority text DEFAULT 'medium',
  p_category text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  u_name text;
  u_email text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_subject IS NULL OR length(btrim(p_subject)) = 0 THEN
    RAISE EXCEPTION 'Subject is required';
  END IF;
  IF p_description IS NULL OR length(btrim(p_description)) = 0 THEN
    RAISE EXCEPTION 'Description is required';
  END IF;
  IF p_priority NOT IN ('low','medium','high','urgent') THEN
    p_priority := 'medium';
  END IF;
  IF p_assigned_to IS NOT NULL AND NOT (
       public.has_role(p_assigned_to, 'admin')
    OR public.has_role(p_assigned_to, 'support')
    OR public.has_role(p_assigned_to, 'tx_support')
  ) THEN
    RAISE EXCEPTION 'Assigned user is not staff';
  END IF;

  SELECT COALESCE(full_name, email, 'Customer'), email
    INTO u_name, u_email
  FROM public.profiles WHERE id = p_user;
  IF u_email IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;

  INSERT INTO public.support_tickets
    (user_id, customer_name, customer_email, subject, description, category, priority, source, assigned_to, status)
  VALUES
    (p_user, u_name, u_email, p_subject, p_description, p_category, p_priority, 'admin', p_assigned_to, 'open')
  RETURNING id INTO new_id;

  INSERT INTO public.ticket_messages (ticket_id, sender_type, sender_id, message)
  VALUES (new_id, 'agent', auth.uid(), p_description);

  PERFORM public.log_staff_action('ticket.admin_create','support_ticket', new_id,
    jsonb_build_object('user_id', p_user, 'assigned_to', p_assigned_to, 'priority', p_priority));

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_ticket(uuid,text,text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_ticket(uuid,text,text,text,text,uuid) TO authenticated;
