
-- Restrict account deletion to owner
CREATE POLICY "Users can delete their own accounts"
ON public.accounts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Restrict transaction update/delete to owner
CREATE POLICY "Users can update their own transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
ON public.transactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Tighten avatars bucket SELECT: only owner folder
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%avatars%' OR policyname ILIKE '%avatar%')
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view their own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
