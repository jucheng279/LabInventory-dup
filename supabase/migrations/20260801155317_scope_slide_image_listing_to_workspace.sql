-- F10: any authenticated user could list every workspace's slide images.
-- Public URL downloads are unaffected (the bucket stays public); only listing
-- through the API is now scoped to the caller's own workspace.
DROP POLICY IF EXISTS "Anyone can view slide images" ON storage.objects;

CREATE POLICY "Workspace members can view slide images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'slide-images' AND public.slide_image_in_my_workspace(name));
