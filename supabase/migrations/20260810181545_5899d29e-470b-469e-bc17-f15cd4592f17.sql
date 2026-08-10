ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS announcements_target_user_idx ON public.announcements(target_user_id);
DROP POLICY IF EXISTS "authenticated read active announcements" ON public.announcements;
CREATE POLICY "authenticated read active announcements"
ON public.announcements FOR SELECT TO authenticated
USING (active = true AND (target_user_id IS NULL OR target_user_id = auth.uid()));