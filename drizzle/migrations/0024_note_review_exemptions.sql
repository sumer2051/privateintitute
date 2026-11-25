CREATE TABLE public.note_review_exemptions (
  user_id uuid PRIMARY KEY,
  set_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.note_review_exemptions TO authenticated;
GRANT ALL ON public.note_review_exemptions TO service_role;
ALTER TABLE public.note_review_exemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read exemptions" ON public.note_review_exemptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins add exemptions" ON public.note_review_exemptions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins remove exemptions" ON public.note_review_exemptions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));