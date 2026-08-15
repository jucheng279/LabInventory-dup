/*
# Update transfer functions and sync_linked_item_stock to use new naming

Functions updated:
- sync_linked_item_stock (body only: fridge_cells -> cells)
- transfer_location_to_location (DROP+CREATE: params and body)
- transfer_location_to_sublocation (DROP+CREATE: params and body)
- transfer_position_to_location (DROP+CREATE: params and body)
- transfer_position_to_sublocation (body only)
- transfer_sublocation_to_location (DROP+CREATE: params and body)
- transfer_sublocation_to_sublocation (body only)
*/

-- sync_linked_item_stock
CREATE OR REPLACE FUNCTION public.sync_linked_item_stock(p_link_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_link box_grid_item_links%ROWTYPE;
v_count integer;
BEGIN
SELECT * INTO v_link FROM box_grid_item_links WHERE id = p_link_id;
IF NOT FOUND THEN RETURN; END IF;

IF v_link.link_type = 'name' THEN
SELECT COUNT(*) INTO v_count FROM cells WHERE box_id = v_link.box_id AND TRIM(name) = TRIM(v_link.linked_name) AND (is_crossed IS NULL OR is_crossed = false);
ELSIF v_link.link_type = 'info' THEN
SELECT COUNT(*) INTO v_count FROM cells WHERE box_id = v_link.box_id AND TRIM(COALESCE(information, '')) = TRIM(COALESCE(v_link.linked_info, '')) AND (is_crossed IS NULL OR is_crossed = false);
ELSE
SELECT COUNT(*) INTO v_count FROM cells WHERE box_id = v_link.box_id AND TRIM(name) = TRIM(v_link.linked_name) AND TRIM(COALESCE(information, '')) = TRIM(COALESCE(v_link.linked_info, '')) AND (is_crossed IS NULL OR is_crossed = false);
END IF;

UPDATE inventory_items SET stock_number = v_count, updated_at = now() WHERE id = v_link.item_id;
END;
$function$;

-- DROP transfer functions with old parameter names
DROP FUNCTION IF EXISTS public.transfer_location_to_location(uuid, uuid);
DROP FUNCTION IF EXISTS public.transfer_location_to_sublocation(uuid, uuid);
DROP FUNCTION IF EXISTS public.transfer_position_to_location(uuid, uuid);
DROP FUNCTION IF EXISTS public.transfer_sublocation_to_location(uuid, uuid);

-- transfer_location_to_location
CREATE OR REPLACE FUNCTION public.transfer_location_to_location(p_source_location_id uuid, p_target_location_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_new_sub_id uuid; v_src record; v_old_sub record; v_new_pos_id uuid; v_count integer := 0; v_rows integer;
BEGIN
IF p_source_location_id = p_target_location_id THEN RAISE EXCEPTION 'Cannot transfer a location into itself'; END IF;
IF EXISTS (SELECT 1 FROM sublocation_positions sp JOIN sublocations fs ON fs.id = sp.sublocation_id WHERE fs.location_id = p_source_location_id) THEN
RAISE EXCEPTION 'Cannot transfer: source location contains positions (would exceed depth 3)';
END IF;

SELECT name, accent_color, location_type, icon_id INTO v_src FROM locations WHERE id = p_source_location_id;
IF v_src IS NULL THEN RAISE EXCEPTION 'Source location not found'; END IF;

INSERT INTO sublocations (location_id, name, accent_color, location_type, icon_id, display_order)
VALUES (p_target_location_id, v_src.name, v_src.accent_color, v_src.location_type, v_src.icon_id, COALESCE((SELECT MAX(display_order) + 1 FROM sublocations WHERE location_id = p_target_location_id), 0))
RETURNING id INTO v_new_sub_id;
v_count := v_count + 1;

FOR v_old_sub IN SELECT id, name, accent_color, location_type, icon_id FROM sublocations WHERE location_id = p_source_location_id ORDER BY display_order
LOOP
INSERT INTO sublocation_positions (sublocation_id, name, accent_color, location_type, icon_id, display_order)
VALUES (v_new_sub_id, v_old_sub.name, v_old_sub.accent_color, v_old_sub.location_type, v_old_sub.icon_id, COALESCE((SELECT MAX(display_order) + 1 FROM sublocation_positions WHERE sublocation_id = v_new_sub_id), 0))
RETURNING id INTO v_new_pos_id;
v_count := v_count + 1;

UPDATE boxes SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, position_id = v_new_pos_id, updated_at = now() WHERE sublocation_id = v_old_sub.id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE item_folders SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, position_id = v_new_pos_id, updated_at = now() WHERE sublocation_id = v_old_sub.id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE inventory_items SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, position_id = v_new_pos_id, updated_at = now() WHERE sublocation_id = v_old_sub.id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
END LOOP;

UPDATE boxes SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now() WHERE location_id = p_source_location_id AND sublocation_id IS NULL;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE item_folders SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now() WHERE location_id = p_source_location_id AND sublocation_id IS NULL;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE inventory_items SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now() WHERE location_id = p_source_location_id AND sublocation_id IS NULL;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

DELETE FROM sublocations WHERE location_id = p_source_location_id;
DELETE FROM locations WHERE id = p_source_location_id;
RETURN v_count;
END;
$function$;

-- transfer_location_to_sublocation
CREATE OR REPLACE FUNCTION public.transfer_location_to_sublocation(p_source_location_id uuid, p_target_sublocation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_target_location_id uuid; v_new_pos_id uuid; v_src record; v_count integer := 0; v_rows integer;
BEGIN
IF EXISTS (SELECT 1 FROM sublocations WHERE location_id = p_source_location_id) THEN
RAISE EXCEPTION 'Cannot transfer: source location contains sub-locations (would exceed depth 3)';
END IF;

SELECT location_id INTO v_target_location_id FROM sublocations WHERE id = p_target_sublocation_id;
IF v_target_location_id IS NULL THEN RAISE EXCEPTION 'Target sub-location not found'; END IF;

SELECT name, accent_color, location_type, icon_id INTO v_src FROM locations WHERE id = p_source_location_id;
IF v_src IS NULL THEN RAISE EXCEPTION 'Source location not found'; END IF;

INSERT INTO sublocation_positions (sublocation_id, name, accent_color, location_type, icon_id, display_order)
VALUES (p_target_sublocation_id, v_src.name, v_src.accent_color, v_src.location_type, v_src.icon_id, COALESCE((SELECT MAX(display_order) + 1 FROM sublocation_positions WHERE sublocation_id = p_target_sublocation_id), 0))
RETURNING id INTO v_new_pos_id;
v_count := v_count + 1;

UPDATE boxes SET location_id = v_target_location_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now() WHERE location_id = p_source_location_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE item_folders SET location_id = v_target_location_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now() WHERE location_id = p_source_location_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE inventory_items SET location_id = v_target_location_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now() WHERE location_id = p_source_location_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

DELETE FROM locations WHERE id = p_source_location_id;
RETURN v_count;
END;
$function$;

-- transfer_position_to_location
CREATE OR REPLACE FUNCTION public.transfer_position_to_location(p_source_position_id uuid, p_target_location_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_new_sub_id uuid; v_src record; v_count integer := 0; v_rows integer;
BEGIN
SELECT name, accent_color, location_type, icon_id INTO v_src FROM sublocation_positions WHERE id = p_source_position_id;
IF v_src IS NULL THEN RAISE EXCEPTION 'Source position not found'; END IF;

INSERT INTO sublocations (location_id, name, accent_color, location_type, icon_id, display_order)
VALUES (p_target_location_id, v_src.name, v_src.accent_color, v_src.location_type, v_src.icon_id, COALESCE((SELECT MAX(display_order) + 1 FROM sublocations WHERE location_id = p_target_location_id), 0))
RETURNING id INTO v_new_sub_id;
v_count := v_count + 1;

UPDATE boxes SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now() WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE item_folders SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now() WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE inventory_items SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now() WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

DELETE FROM sublocation_positions WHERE id = p_source_position_id;
RETURN v_count;
END;
$function$;

-- transfer_position_to_sublocation (no param rename needed)
CREATE OR REPLACE FUNCTION public.transfer_position_to_sublocation(p_source_position_id uuid, p_target_sublocation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_target_location_id uuid; v_new_pos_id uuid; v_src record; v_source_sublocation_id uuid; v_count integer := 0; v_rows integer;
BEGIN
SELECT name, accent_color, location_type, icon_id, sublocation_id INTO v_src FROM sublocation_positions WHERE id = p_source_position_id;
IF v_src IS NULL THEN RAISE EXCEPTION 'Source position not found'; END IF;
v_source_sublocation_id := v_src.sublocation_id;

SELECT location_id INTO v_target_location_id FROM sublocations WHERE id = p_target_sublocation_id;
IF v_target_location_id IS NULL THEN RAISE EXCEPTION 'Target sub-location not found'; END IF;

INSERT INTO sublocation_positions (sublocation_id, name, accent_color, location_type, icon_id, display_order)
VALUES (p_target_sublocation_id, v_src.name, v_src.accent_color, v_src.location_type, v_src.icon_id, COALESCE((SELECT MAX(display_order) + 1 FROM sublocation_positions WHERE sublocation_id = p_target_sublocation_id), 0))
RETURNING id INTO v_new_pos_id;
v_count := v_count + 1;

UPDATE boxes SET location_id = v_target_location_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now() WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE item_folders SET location_id = v_target_location_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now() WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE inventory_items SET location_id = v_target_location_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now() WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

DELETE FROM sublocation_positions WHERE id = p_source_position_id;
RETURN v_count;
END;
$function$;

-- transfer_sublocation_to_location
CREATE OR REPLACE FUNCTION public.transfer_sublocation_to_location(p_source_sublocation_id uuid, p_target_location_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_new_sub_id uuid; v_src record; v_source_location_id uuid; v_count integer := 0; v_rows integer;
BEGIN
SELECT name, accent_color, location_type, icon_id, location_id INTO v_src FROM sublocations WHERE id = p_source_sublocation_id;
IF v_src IS NULL THEN RAISE EXCEPTION 'Source sub-location not found'; END IF;
v_source_location_id := v_src.location_id;

INSERT INTO sublocations (location_id, name, accent_color, location_type, icon_id, display_order)
VALUES (p_target_location_id, v_src.name, v_src.accent_color, v_src.location_type, v_src.icon_id, COALESCE((SELECT MAX(display_order) + 1 FROM sublocations WHERE location_id = p_target_location_id), 0))
RETURNING id INTO v_new_sub_id;
v_count := v_count + 1;

UPDATE sublocation_positions SET sublocation_id = v_new_sub_id, updated_at = now() WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE boxes SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, updated_at = now() WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE item_folders SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, updated_at = now() WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE inventory_items SET location_id = p_target_location_id, sublocation_id = v_new_sub_id, updated_at = now() WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

DELETE FROM sublocations WHERE id = p_source_sublocation_id;
RETURN v_count;
END;
$function$;

-- transfer_sublocation_to_sublocation (no param rename needed)
CREATE OR REPLACE FUNCTION public.transfer_sublocation_to_sublocation(p_source_sublocation_id uuid, p_target_sublocation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_target_location_id uuid; v_new_pos_id uuid; v_src record; v_count integer := 0; v_rows integer;
BEGIN
IF p_source_sublocation_id = p_target_sublocation_id THEN RAISE EXCEPTION 'Cannot transfer a sub-location into itself'; END IF;
IF EXISTS (SELECT 1 FROM sublocation_positions WHERE sublocation_id = p_source_sublocation_id) THEN
RAISE EXCEPTION 'Cannot transfer: source sub-location contains positions (would exceed depth 3)';
END IF;

SELECT location_id INTO v_target_location_id FROM sublocations WHERE id = p_target_sublocation_id;
IF v_target_location_id IS NULL THEN RAISE EXCEPTION 'Target sub-location not found'; END IF;

SELECT name, accent_color, location_type, icon_id INTO v_src FROM sublocations WHERE id = p_source_sublocation_id;
IF v_src IS NULL THEN RAISE EXCEPTION 'Source sub-location not found'; END IF;

INSERT INTO sublocation_positions (sublocation_id, name, accent_color, location_type, icon_id, display_order)
VALUES (p_target_sublocation_id, v_src.name, v_src.accent_color, v_src.location_type, v_src.icon_id, COALESCE((SELECT MAX(display_order) + 1 FROM sublocation_positions WHERE sublocation_id = p_target_sublocation_id), 0))
RETURNING id INTO v_new_pos_id;
v_count := v_count + 1;

UPDATE boxes SET location_id = v_target_location_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now() WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE item_folders SET location_id = v_target_location_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now() WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;
UPDATE inventory_items SET location_id = v_target_location_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now() WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

DELETE FROM sublocations WHERE id = p_source_sublocation_id;
RETURN v_count;
END;
$function$;
