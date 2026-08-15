/*
# Fix rec IS NOT NULL PostgreSQL trap in ai_resolve_codes

1. Modified Functions
   - `ai_resolve_codes`: Replaced every `IF rec IS NOT NULL` check with `IF FOUND`

2. Details
   - PostgreSQL's `rec IS NOT NULL` on a record type returns TRUE only when ALL
     fields in the record are non-null. If even one field (e.g. sublocation_id,
     position_id, folder_id) is NULL, the entire check returns FALSE and the
     entity is silently dropped from the result.
   - `FOUND` is set to TRUE whenever `SELECT INTO` returns at least one row,
     regardless of whether individual columns are NULL.
   - This was causing items and item folders (which frequently have NULL
     sublocation_id, position_id, or folder_id) to be missing from the code map,
     making their AI chat navigation links non-functional.
   - Boxes were less affected because they more often have all hierarchy fields
     populated.

3. Affected Entity Types
   - All types resolved by this function: locations (L), sublocations (S),
     positions (P), boxes (B), cells (B:coord), items (I), item folders (IF),
     projects (PR), experiments (EX).

4. Security
   - Function remains SECURITY DEFINER with search_path = public.
   - REVOKE/GRANT unchanged.
*/

CREATE OR REPLACE FUNCTION ai_resolve_codes(p_workspace_id uuid, p_codes text[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_code text;
  v_prefix text;
  v_num integer;
  v_colon_pos integer;
  rec record;
BEGIN
  FOREACH v_code IN ARRAY p_codes LOOP
    -- Cell ref: B7:A1
    v_colon_pos := position(':' in v_code);
    IF v_colon_pos > 1 THEN
      DECLARE v_box_code integer; v_cell_coord text;
      BEGIN
        v_box_code := substring(v_code from 2 for v_colon_pos - 2)::integer;
        v_cell_coord := substring(v_code from v_colon_pos + 1);
        SELECT c.id, c.cell_id, b.id AS box_id, b.name AS box_name, b.box_type,
               b.location_id, b.sublocation_id, b.position_id
        INTO rec
        FROM cells c JOIN boxes b ON b.id = c.box_id JOIN locations l ON l.id = b.location_id
        WHERE l.workspace_id = p_workspace_id AND b.ai_code = v_box_code AND c.cell_id = v_cell_coord;
        IF FOUND THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', v_cell_coord, 'type', 'cell',
            'box_id', rec.box_id, 'location_id', rec.location_id,
            'sublocation_id', rec.sublocation_id, 'position_id', rec.position_id));
        END IF;
      END;
      CONTINUE;
    END IF;

    v_prefix := upper(regexp_replace(v_code, '\d+$', ''));
    BEGIN
      v_num := regexp_replace(v_code, '^\D+', '')::integer;
    EXCEPTION WHEN OTHERS THEN CONTINUE;
    END;

    CASE v_prefix
      WHEN 'L' THEN
        SELECT l.id, l.name, l.accent_color, l.location_type, l.icon_id INTO rec
        FROM locations l WHERE l.workspace_id = p_workspace_id AND l.ai_code = v_num;
        IF FOUND THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'location',
            'accent_color', rec.accent_color, 'location_type', rec.location_type, 'icon_id', rec.icon_id));
        END IF;
      WHEN 'S' THEN
        SELECT s.id, s.name, s.accent_color, s.location_type, s.icon_id, s.location_id INTO rec
        FROM sublocations s JOIN locations l ON l.id = s.location_id
        WHERE l.workspace_id = p_workspace_id AND s.ai_code = v_num;
        IF FOUND THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'sublocation',
            'accent_color', rec.accent_color, 'location_type', rec.location_type, 'icon_id', rec.icon_id,
            'location_id', rec.location_id));
        END IF;
      WHEN 'P' THEN
        SELECT sp.id, sp.name, sp.accent_color, sp.location_type, sp.icon_id,
               s.location_id, sp.sublocation_id INTO rec
        FROM sublocation_positions sp JOIN sublocations s ON s.id = sp.sublocation_id
        JOIN locations l ON l.id = s.location_id
        WHERE l.workspace_id = p_workspace_id AND sp.ai_code = v_num;
        IF FOUND THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'position',
            'accent_color', rec.accent_color, 'location_type', rec.location_type, 'icon_id', rec.icon_id,
            'location_id', rec.location_id, 'sublocation_id', rec.sublocation_id));
        END IF;
      WHEN 'B' THEN
        SELECT b.id, b.name, b.box_type, b.location_id, b.sublocation_id, b.position_id INTO rec
        FROM boxes b JOIN locations l ON l.id = b.location_id
        WHERE l.workspace_id = p_workspace_id AND b.ai_code = v_num;
        IF FOUND THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'box', 'box_type', rec.box_type,
            'location_id', rec.location_id, 'sublocation_id', rec.sublocation_id, 'position_id', rec.position_id));
        END IF;
      WHEN 'I' THEN
        SELECT ii.id, ii.name, ii.location_id, ii.sublocation_id, ii.position_id, ii.folder_id INTO rec
        FROM inventory_items ii JOIN locations l ON l.id = ii.location_id
        WHERE l.workspace_id = p_workspace_id AND ii.ai_code = v_num;
        IF FOUND THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'item',
            'location_id', rec.location_id, 'sublocation_id', rec.sublocation_id,
            'position_id', rec.position_id, 'folder_id', rec.folder_id));
        END IF;
      WHEN 'IF' THEN
        SELECT ifo.id, ifo.name, ifo.location_id, ifo.sublocation_id, ifo.position_id INTO rec
        FROM item_folders ifo JOIN locations l ON l.id = ifo.location_id
        WHERE l.workspace_id = p_workspace_id AND ifo.ai_code = v_num;
        IF FOUND THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'item_folder',
            'location_id', rec.location_id, 'sublocation_id', rec.sublocation_id,
            'position_id', rec.position_id));
        END IF;
      WHEN 'PR' THEN
        SELECT p.id, p.name INTO rec FROM projects p
        WHERE p.workspace_id = p_workspace_id AND p.ai_code = v_num;
        IF FOUND THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'project'));
        END IF;
      WHEN 'EX' THEN
        SELECT e.id, e.name, e.project_id INTO rec FROM experiments e
        JOIN projects p ON p.id = e.project_id
        WHERE p.workspace_id = p_workspace_id AND e.ai_code = v_num;
        IF FOUND THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'experiment',
            'project_id', rec.project_id));
        END IF;
      ELSE NULL;
    END CASE;
  END LOOP;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION ai_resolve_codes FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_resolve_codes TO authenticated;
