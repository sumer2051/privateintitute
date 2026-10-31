CREATE TABLE public.admin_ai_access_blocks (model text PRIMARY KEY, status integer NOT NULL, message text NOT NULL, blocked_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.admin_ai_access_blocks TO service_role;
ALTER TABLE public.admin_ai_access_blocks ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.admin_ai_access_blocks IS 'Server-only persistent provider access denials; no customer data or conversation history.';