/*
# Rename fridge references in AI inventory context functions

Updates `get_ai_inventory_context` and `get_ai_inventory_context_v2` to use new table/column names:
- `fridge_sublocations` → `sublocations`
- `fridge_boxes` → `boxes`
- `fridge_cells` → `cells`
- `fridge_name` → `location_name` (JSON output keys)
- `fridge_id` → `location_id`
- `fridges` → `locations`

These are large read-only functions used by the AI chat feature.
The approach: extract the function source, apply text replacements, and recreate.
*/

DO $$
DECLARE
  v_src text;
  v_replaced text;
BEGIN
  -- get_ai_inventory_context
  SELECT prosrc INTO v_src FROM pg_proc
  WHERE proname = 'get_ai_inventory_context'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  v_replaced := v_src;
  v_replaced := replace(v_replaced, 'fridge_sublocations', 'sublocations');
  v_replaced := replace(v_replaced, 'fridge_boxes', 'boxes');
  v_replaced := replace(v_replaced, 'fridge_cells', 'cells');
  v_replaced := replace(v_replaced, 'fridge_name', 'location_name');
  v_replaced := replace(v_replaced, 'fridge_id', 'location_id');
  v_replaced := replace(v_replaced, 'fridges', 'locations');

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.get_ai_inventory_context(p_team_member_id uuid) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $fn$%s$fn$',
    v_replaced
  );

  -- get_ai_inventory_context_v2
  SELECT prosrc INTO v_src FROM pg_proc
  WHERE proname = 'get_ai_inventory_context_v2'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  v_replaced := v_src;
  v_replaced := replace(v_replaced, 'fridge_sublocations', 'sublocations');
  v_replaced := replace(v_replaced, 'fridge_boxes', 'boxes');
  v_replaced := replace(v_replaced, 'fridge_cells', 'cells');
  v_replaced := replace(v_replaced, 'fridge_name', 'location_name');
  v_replaced := replace(v_replaced, 'fridge_id', 'location_id');
  v_replaced := replace(v_replaced, 'fridges', 'locations');

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.get_ai_inventory_context_v2(p_team_member_id uuid, p_sections text[], p_search_terms text DEFAULT NULL::text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $fn$%s$fn$',
    v_replaced
  );
END $$;
