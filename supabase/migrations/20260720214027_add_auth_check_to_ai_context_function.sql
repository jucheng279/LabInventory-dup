/*
# Add auth.uid() validation to AI inventory context functions

1. Security Changes
   - get_ai_inventory_context(p_team_member_id uuid): now verifies that the
     passed team_member_id belongs to the caller (auth.uid() = auth_user_id).
     Returns an error JSON if the caller does not own that team_member record.
   - get_ai_inventory_context_v2(p_team_member_id uuid, ...): same validation added.

2. Important Notes
   - Previously, any authenticated user who knew another team member's UUID could
     retrieve that workspace's full inventory context. Now the function rejects
     cross-user calls with an authorization error.
   - The function signature and return type remain unchanged; only the body is replaced.
*/

CREATE OR REPLACE FUNCTION public.get_ai_inventory_context(p_team_member_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace_id uuid;
  v_is_workspace_owner boolean;
  v_result json;
BEGIN
  -- Authorization: verify caller owns this team_member record
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE id = p_team_member_id AND auth_user_id = auth.uid()
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: team member does not belong to caller');
  END IF;

  -- Get workspace_id from the team member
  SELECT tm.workspace_id INTO v_workspace_id
  FROM team_members tm
  WHERE tm.id = p_team_member_id;

  IF v_workspace_id IS NULL THEN
    RETURN json_build_object('error', 'No workspace found for team member');
  END IF;

  -- Check if user is workspace owner
  SELECT EXISTS(
    SELECT 1 FROM workspaces w
    WHERE w.id = v_workspace_id AND w.owner_id = p_team_member_id
  ) INTO v_is_workspace_owner;

  SELECT json_build_object(
    'locations', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', f.id,
        'name', f.name,
        'location_type', f.location_type
      ) ORDER BY f.display_order, f.name), '[]'::json)
      FROM locations f
      WHERE f.workspace_id = v_workspace_id
    ),
    'sublocations', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', fs.id,
        'name', fs.name,
        'location_type', fs.location_type,
        'location_name', f.name
      ) ORDER BY f.name, fs.display_order, fs.name), '[]'::json)
      FROM sublocations fs
      JOIN locations f ON f.id = fs.location_id
      WHERE f.workspace_id = v_workspace_id
    ),
    'positions', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', sp.id,
        'name', sp.name,
        'location_type', sp.location_type,
        'sublocation_name', fs.name,
        'location_name', f.name
      ) ORDER BY f.name, fs.name, sp.display_order, sp.name), '[]'::json)
      FROM sublocation_positions sp
      JOIN sublocations fs ON fs.id = sp.sublocation_id
      JOIN locations f ON f.id = fs.location_id
      WHERE f.workspace_id = v_workspace_id
    ),
    'boxes', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', fb.id,
        'name', fb.name,
        'box_type', fb.box_type,
        'rows', fb.rows,
        'columns', fb.columns,
        'location_name', f.name,
        'sublocation_name', fs.name,
        'position_name', sp.name
      ) ORDER BY f.name, fs.name, fb.name), '[]'::json)
      FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      LEFT JOIN sublocations fs ON fs.id = fb.sublocation_id
      LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
      WHERE f.workspace_id = v_workspace_id
    ),
    'item_folders', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', ifo.id,
        'name', ifo.name,
        'location_name', f.name,
        'sublocation_name', fs.name,
        'position_name', sp.name
      ) ORDER BY f.name, ifo.name), '[]'::json)
      FROM item_folders ifo
      JOIN locations f ON f.id = ifo.location_id
      LEFT JOIN sublocations fs ON fs.id = ifo.sublocation_id
      LEFT JOIN sublocation_positions sp ON sp.id = ifo.position_id
      WHERE f.workspace_id = v_workspace_id
    ),
    'inventory_items', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', ii.id,
        'name', ii.name,
        'item_type', ii.item_type,
        'stock_number', ii.stock_number,
        'unit', ii.unit,
        'non_counted', ii.non_counted,
        'folder_name', ifo.name,
        'location_name', f.name
      ) ORDER BY f.name, ifo.name, ii.name), '[]'::json)
      FROM inventory_items ii
      JOIN item_folders ifo ON ifo.id = ii.folder_id
      JOIN locations f ON f.id = ii.location_id
      WHERE f.workspace_id = v_workspace_id
    ),
    'is_workspace_owner', v_is_workspace_owner
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Also revoke anon access: only authenticated users should call this
REVOKE EXECUTE ON FUNCTION public.get_ai_inventory_context(uuid) FROM anon;
