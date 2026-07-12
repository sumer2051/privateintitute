
-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'support', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_support_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','support'));
$$;
REVOKE EXECUTE ON FUNCTION public.is_support_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_support_staff(uuid) TO authenticated, service_role;

-- Ticket number sequence
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'TKT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.support_ticket_seq')::text, 6, '0');
END; $$;

-- Support tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE DEFAULT public.generate_ticket_number(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  category text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','in_progress','resolved','closed')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_summary text,
  source text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_select_own_or_staff" ON public.support_tickets;
CREATE POLICY "tickets_select_own_or_staff" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_support_staff(auth.uid()));

DROP POLICY IF EXISTS "tickets_insert_own" ON public.support_tickets;
CREATE POLICY "tickets_insert_own" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tickets_update_staff_or_owner_close" ON public.support_tickets;
CREATE POLICY "tickets_update_staff_or_owner_close" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_support_staff(auth.uid()) OR auth.uid() = user_id)
  WITH CHECK (public.is_support_staff(auth.uid()) OR auth.uid() = user_id);

CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ticket messages
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('customer','agent','ai','system')),
  sender_id uuid,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgs_select" ON public.ticket_messages;
CREATE POLICY "msgs_select" ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_messages.ticket_id
      AND (t.user_id = auth.uid() OR public.is_support_staff(auth.uid()))
  ));

DROP POLICY IF EXISTS "msgs_insert" ON public.ticket_messages;
CREATE POLICY "msgs_insert" ON public.ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_messages.ticket_id
      AND (t.user_id = auth.uid() OR public.is_support_staff(auth.uid()))
  ));

-- Scheduled calls
CREATE TABLE IF NOT EXISTS public.scheduled_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  reason text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','missed','rescheduled','cancelled')),
  agent_notes text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.scheduled_calls TO authenticated;
GRANT ALL ON public.scheduled_calls TO service_role;
ALTER TABLE public.scheduled_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calls_select" ON public.scheduled_calls;
CREATE POLICY "calls_select" ON public.scheduled_calls
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_support_staff(auth.uid()));

DROP POLICY IF EXISTS "calls_insert" ON public.scheduled_calls;
CREATE POLICY "calls_insert" ON public.scheduled_calls
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "calls_update" ON public.scheduled_calls;
CREATE POLICY "calls_update" ON public.scheduled_calls
  FOR UPDATE TO authenticated
  USING (public.is_support_staff(auth.uid()) OR auth.uid() = user_id)
  WITH CHECK (public.is_support_staff(auth.uid()) OR auth.uid() = user_id);

CREATE TRIGGER scheduled_calls_updated_at BEFORE UPDATE ON public.scheduled_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_messages REPLICA IDENTITY FULL;
ALTER TABLE public.scheduled_calls REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_calls;
