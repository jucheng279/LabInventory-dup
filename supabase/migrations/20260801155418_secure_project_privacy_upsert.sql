-- F12: any workspace member could call upsert_project_privacy for any project and
-- set themselves as the privacy owner, wiping the access list.
CREATE OR REPLACE FUNCTION public.upsert_project_privacy(
  p_project_id uuid,
  p_owner_id uuid,
  p_privacy_mode text,
  p_owner_only_delete boolean,
  p_access_entries jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_ws uuid;
  v_current_owner uuid;
BEGIN
  SELECT tm.id, tm.role, tm.workspace_id
    INTO v_caller_id, v_caller_role, v_ws
  FROM team_members tm
  WHERE tm.auth_user_id = auth.uid() AND tm.workspace_id IS NOT NULL
  LIMIT 1;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM projects p WHERE p.id = p_project_id AND p.workspace_id = v_ws
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT owner_id INTO v_current_owner FROM project_privacy_settings WHERE project_id = p_project_id;

  IF v_current_owner IS NOT NULL
     AND v_current_owner <> v_caller_id
     AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the project owner can change its privacy settings';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.id = p_owner_id AND tm.workspace_id = v_ws
  ) THEN
    RAISE EXCEPTION 'Invalid owner';
  END IF;

  INSERT INTO project_privacy_settings (project_id, owner_id, privacy_mode, owner_only_delete)
  VALUES (p_project_id, p_owner_id, p_privacy_mode, p_owner_only_delete)
  ON CONFLICT (project_id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    privacy_mode = EXCLUDED.privacy_mode,
    owner_only_delete = EXCLUDED.owner_only_delete,
    updated_at = now();

  DELETE FROM project_access_list WHERE project_id = p_project_id;

  INSERT INTO project_access_list (project_id, team_member_id, access_level)
  SELECT
    p_project_id,
    (entry->>'team_member_id')::uuid,
    entry->>'access_level'
  FROM jsonb_array_elements(p_access_entries) AS entry
  WHERE entry->>'team_member_id' IS NOT NULL
    AND entry->>'access_level' IN ('edit', 'view')
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = (entry->>'team_member_id')::uuid AND tm.workspace_id = v_ws
    )
  ON CONFLICT (project_id, team_member_id) DO UPDATE
    SET access_level = EXCLUDED.access_level;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_project_privacy(uuid, uuid, text, boolean, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_project_privacy(uuid, uuid, text, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_project_privacy(uuid, uuid, text, boolean, jsonb) TO authenticated;
