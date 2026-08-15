-- F9: slide image update/delete were open to every authenticated user in any workspace.
-- Object paths are "<box_id>/<file>", so resolve the first segment to a box and require
-- that box's location to belong to the caller's workspace.
CREATE OR REPLACE FUNCTION public.slide_image_in_my_workspace(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_box_id uuid;
  v_ws uuid;
BEGIN
  v_ws := public.get_user_workspace_id();
  IF v_ws IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    v_box_id := (split_part(p_object_name, '/', 1))::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  RETURN EXISTS (
    SELECT 1
    FROM boxes b
    JOIN locations l ON l.id = b.location_id
    WHERE b.id = v_box_id AND l.workspace_id = v_ws
  );
END;
$$;

REVOKE ALL ON FUNCTION public.slide_image_in_my_workspace(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.slide_image_in_my_workspace(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.slide_image_in_my_workspace(text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can update slide images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete slide images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload slide images" ON storage.objects;

CREATE POLICY "Workspace members can upload slide images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'slide-images' AND public.slide_image_in_my_workspace(name));

CREATE POLICY "Workspace members can update slide images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'slide-images' AND public.slide_image_in_my_workspace(name))
  WITH CHECK (bucket_id = 'slide-images' AND public.slide_image_in_my_workspace(name));

CREATE POLICY "Workspace members can delete slide images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'slide-images' AND public.slide_image_in_my_workspace(name));
