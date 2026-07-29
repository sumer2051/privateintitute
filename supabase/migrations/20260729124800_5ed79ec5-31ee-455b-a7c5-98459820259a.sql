
ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size integer;

-- Storage policies on ticket-attachments bucket.
-- Files are stored under "<ticket_id>/<filename>"; first path segment = ticket id.

DROP POLICY IF EXISTS "ticket_attachments_select" ON storage.objects;
CREATE POLICY "ticket_attachments_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND (t.user_id = auth.uid() OR public.is_support_staff(auth.uid()))
  )
);

DROP POLICY IF EXISTS "ticket_attachments_insert" ON storage.objects;
CREATE POLICY "ticket_attachments_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND (t.user_id = auth.uid() OR public.is_support_staff(auth.uid()))
  )
);
