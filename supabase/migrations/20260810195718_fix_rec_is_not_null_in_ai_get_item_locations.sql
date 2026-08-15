/*
# Fix rec IS NOT NULL bug in ai_get_item_locations — use FOUND instead

1. Bug Description
   - Same PostgreSQL trap as ai_resolve_codes: `record IS NOT NULL` returns
     FALSE when ANY field (like sublocation_id, position_id) is NULL,
     even though the query found a valid row.

2. Fix
   - Replace both `IF rec IS NOT NULL THEN` with `IF FOUND THEN`.

3. Security
   - No changes. Function remains SECURITY DEFINER with search_path=public.
*/

CREATE OR REPLACE FUNCTION ai_get_item_locations(p_team_member_id uuid, p_ref_codes text[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ws_id uuid; v_results jsonb := '[]'::jsonb; v_code text; v_entity_id uuid; rec record;
BEGIN
  SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
  IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Invalid team member'); END IF;

  FOREACH v_code IN ARRAY p_ref_codes LOOP
    v_entity_id := ai_resolve_ref_to_uuid(v_ws_id, v_code);
    IF v_entity_id IS NULL THEN CONTINUE; END IF;

    IF upper(left(v_code,1)) = 'I' THEN
      SELECT ii.name, ii.stock_number, ii.unit, ii.ai_code, ii.location_id, ii.sublocation_id, ii.position_id
      INTO rec FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
      WHERE ii.id = v_entity_id AND f.workspace_id = v_ws_id;
      IF FOUND THEN
        v_results := v_results || jsonb_build_object('code','I'||rec.ai_code,'display_name',rec.name,
          'quantity',rec.stock_number,'unit',rec.unit,
          'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
      END IF;
    ELSIF position(':' in v_code) > 1 THEN
      SELECT fc.name, fc.cell_id, fb.name AS box_name, fb.ai_code AS box_code,
        fb.location_id, fb.sublocation_id, fb.position_id, fb.id AS box_id
      INTO rec FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
      WHERE fc.id = v_entity_id AND f.workspace_id = v_ws_id;
      IF FOUND THEN
        v_results := v_results || jsonb_build_object('ref','B'||rec.box_code||':'||rec.cell_id,
          'display_name',rec.name,'box_name',rec.box_name,
          'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id));
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'items',v_results,'count',jsonb_array_length(v_results));
END;
$fn$;
