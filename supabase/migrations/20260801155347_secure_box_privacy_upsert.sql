-- F11: any workspace member could call upsert_box_privacy for any box and set
-- themselves as the privacy owner, wiping the access list. Bind the caller to
-- auth.uid() and require them to be the current privacy owner, the workspace owner,
-- or to be creating the first privacy row for the box.
CREATE OR REPLACE FUNCTION public.upsert_box_privacy(
  p_box_id uuid,
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

  -- The box must belong to the caller's workspace
  IF NOT EXISTS (
    SELECT 1 FROM boxes b
    JOIN locations l ON l.id = b.location_id
    WHERE b.id = p_box_id AND l.workspace_id = v_ws
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT owner_id INTO v_current_owner FROM box_privacy_settings WHERE box_id = p_box_id;

  IF v_current_owner IS NOT NULL
     AND v_current_owner <> v_caller_id
     AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the box owner can change its privacy settings';
  END IF;

  -- The privacy owner must be a member of the caller's workspace
  IF NOT EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.id = p_owner_id AND tm.workspace_id = v_ws
  ) THEN
    RAISE EXCEPTION 'Invalid owner';
  END IF;

  INSERT INTO box_privacy_settings (box_id, owner_id, privacy_mode, owner_only_delete)
  VALUES (p_box_id, p_owner_id, p_privacy_mode, p_owner_only_delete)
  ON CONFLICT (box_id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    privacy_mode = EXCLUDED.privacy_mode,
    owner_only_delete = EXCLUDED.owner_only_delete,
    updated_at = now();

  DELETE FROM box_access_list WHERE box_id = p_box_id;

  INSERT INTO box_access_list (box_id, team_member_id, access_level)
  SELECT
    p_box_id,
    (entry->>'team_member_id')::uuid,
    entry->>'access_level'
  FROM jsonb_array_elements(p_access_entries) AS entry
  WHERE entry->>'team_member_id' IS NOT NULL
    AND entry->>'access_level' IN ('edit', 'view')
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = (entry->>'team_member_id')::uuid AND tm.workspace_id = v_ws
    )
  ON CONFLICT (box_id, team_member_id) DO UPDATE
    SET access_level = EXCLUDED.access_level;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_box_privacy(uuid, uuid, text, boolean, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_box_privacy(uuid, uuid, text, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_box_privacy(uuid, uuid, text, boolean, jsonb) TO authenticated;
