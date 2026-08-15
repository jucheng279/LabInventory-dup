/*
# Add RAISE LOG debug tracing to ai_resolve_codes

1. Modified Functions
   - `ai_resolve_codes`: Added RAISE LOG statements at every decision point
     to trace why box codes (B2, B3, etc.) are not being resolved while
     location codes (L1) work correctly.

2. Security
   - No changes to security posture. Function remains SECURITY DEFINER
     with search_path = public, EXECUTE granted only to authenticated.

3. Important Notes
   - This is a diagnostic migration. The RAISE LOG output will appear in
     Supabase Postgres logs (Dashboard > Logs > Postgres).
   - The function logic is unchanged; only logging is added.
   - Remove the RAISE LOG lines once the bug is found.
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
  RAISE LOG '[ai_resolve_codes] called with workspace=%, codes=%', p_workspace_id, p_codes;

  FOREACH v_code IN ARRAY p_codes LOOP
    RAISE LOG '[ai_resolve_codes] processing code: %', v_code;

    v_colon_pos := position(':' in v_code);
    IF v_colon_pos > 1 THEN
      DECLARE v_box_code integer; v_cell_coord text;
      BEGIN
        v_box_code := substring(v_code from 2 for v_colon_pos - 2)::integer;
        v_cell_coord := substring(v_code from v_colon_pos + 1);
        RAISE LOG '[ai_resolve_codes] cell ref: box_code=%, cell_coord=%', v_box_code, v_cell_coord;
        SELECT c.id, c.cell_id, b.id AS box_id, b.name AS box_name, b.box_type,
               b.location_id, b.sublocation_id, b.position_id
        INTO rec
        FROM cells c JOIN boxes b ON b.id = c.box_id JOIN locations l ON l.id = b.location_id
        WHERE l.workspace_id = p_workspace_id AND b.ai_code = v_box_code AND c.cell_id = v_cell_coord;
        IF rec IS NOT NULL THEN
          RAISE LOG '[ai_resolve_codes] cell found: id=%', rec.id;
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', v_cell_coord, 'type', 'cell',
            'box_id', rec.box_id, 'location_id', rec.location_id,
            'sublocation_id', rec.sublocation_id, 'position_id', rec.position_id));
        ELSE
          RAISE LOG '[ai_resolve_codes] cell NOT found for %', v_code;
        END IF;
      END;
      CONTINUE;
    END IF;

    v_prefix := upper(regexp_replace(v_code, '\d+$', ''));
    RAISE LOG '[ai_resolve_codes] entity: prefix=%, raw_code=%', v_prefix, v_code;
    BEGIN
      v_num := regexp_replace(v_code, '^\D+', '')::integer;
      RAISE LOG '[ai_resolve_codes] parsed v_num=%', v_num;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[ai_resolve_codes] v_num parse failed for %, skipping', v_code;
      CONTINUE;
    END;

    RAISE LOG '[ai_resolve_codes] entering CASE for prefix=%', v_prefix;

    CASE v_prefix
      WHEN 'L' THEN
        SELECT l.id, l.name, l.accent_color, l.location_type, l.icon_id INTO rec
        FROM locations l WHERE l.workspace_id = p_workspace_id AND l.ai_code = v_num;
        RAISE LOG '[ai_resolve_codes] L query done, found=%', (rec IS NOT NULL);
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'location',
            'accent_color', rec.accent_color, 'location_type', rec.location_type, 'icon_id', rec.icon_id));
        END IF;
      WHEN 'S' THEN
        SELECT s.id, s.name, s.accent_color, s.location_type, s.icon_id, s.location_id INTO rec
        FROM sublocations s JOIN locations l ON l.id = s.location_id
        WHERE l.workspace_id = p_workspace_id AND s.ai_code = v_num;
        RAISE LOG '[ai_resolve_codes] S query done, found=%', (rec IS NOT NULL);
        IF rec IS NOT NULL THEN
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
        RAISE LOG '[ai_resolve_codes] P query done, found=%', (rec IS NOT NULL);
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'position',
            'accent_color', rec.accent_color, 'location_type', rec.location_type, 'icon_id', rec.icon_id,
            'location_id', rec.location_id, 'sublocation_id', rec.sublocation_id));
        END IF;
      WHEN 'B' THEN
        RAISE LOG '[ai_resolve_codes] B branch: querying boxes with workspace=% ai_code=%', p_workspace_id, v_num;
        SELECT b.id, b.name, b.box_type, b.location_id, b.sublocation_id, b.position_id INTO rec
        FROM boxes b JOIN locations l ON l.id = b.location_id
        WHERE l.workspace_id = p_workspace_id AND b.ai_code = v_num;
        RAISE LOG '[ai_resolve_codes] B query done, found=%, rec_id=%', (rec IS NOT NULL), rec.id;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'box', 'box_type', rec.box_type,
            'location_id', rec.location_id, 'sublocation_id', rec.sublocation_id, 'position_id', rec.position_id));
          RAISE LOG '[ai_resolve_codes] B added to result: %', v_code;
        END IF;
      WHEN 'I' THEN
        SELECT ii.id, ii.name, ii.location_id, ii.sublocation_id, ii.position_id INTO rec
        FROM inventory_items ii JOIN locations l ON l.id = ii.location_id
        WHERE l.workspace_id = p_workspace_id AND ii.ai_code = v_num;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'item',
            'location_id', rec.location_id, 'sublocation_id', rec.sublocation_id, 'position_id', rec.position_id));
        END IF;
      WHEN 'PR' THEN
        SELECT p.id, p.name INTO rec FROM projects p
        WHERE p.workspace_id = p_workspace_id AND p.ai_code = v_num;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'project'));
        END IF;
      WHEN 'EX' THEN
        SELECT e.id, e.name, e.project_id INTO rec FROM experiments e
        JOIN projects p ON p.id = e.project_id
        WHERE p.workspace_id = p_workspace_id AND e.ai_code = v_num;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'experiment',
            'project_id', rec.project_id));
        END IF;
      ELSE
        RAISE LOG '[ai_resolve_codes] unknown prefix: %', v_prefix;
    END CASE;
  END LOOP;

  RAISE LOG '[ai_resolve_codes] final result keys: %', (SELECT array_agg(k) FROM jsonb_object_keys(v_result) AS k);
  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION ai_resolve_codes FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_resolve_codes TO authenticated;
