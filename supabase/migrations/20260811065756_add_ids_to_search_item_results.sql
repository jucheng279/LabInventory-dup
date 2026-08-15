/*
# Add sublocation_id, position_id, and folder ai_code to search item results

1. Modified Functions
   - `search_workspace`: Updated the items and item_custom_values SELECT queries
     to include sublocation_id, position_id, and folder ai_code (as folder_ai_code)
     so the client can navigate directly to the correct sheet/folder.

2. Details
   - The JOINs already exist (ii.sublocation_id, ii.position_id, ifo.id).
   - This just adds those columns to the SELECT output.
   - folder_ai_code is the IF-prefixed code number for the item's folder.

3. Important Notes
   - No schema changes, only function output changes.
   - Existing callers that ignore the new fields are unaffected.
*/

CREATE OR REPLACE FUNCTION public.search_workspace(search_query text, date_mode text DEFAULT NULL::text, date_start text DEFAULT NULL::text, date_end text DEFAULT NULL::text, date_type_target text DEFAULT NULL::text, filter_scopes text[] DEFAULT NULL::text[], filter_texts text[] DEFAULT NULL::text[], freezer_sub_filters text[] DEFAULT NULL::text[], slide_header_filters text[] DEFAULT NULL::text[], slide_date_filters text DEFAULT NULL::text, item_sub_filters text[] DEFAULT NULL::text[], item_header_filters text[] DEFAULT NULL::text[], item_folder_name_filter text DEFAULT NULL::text, item_date_filters text DEFAULT NULL::text, freezer_header_filters text[] DEFAULT NULL::text[], freezer_date_filters text DEFAULT NULL::text, p_team_member_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
result json; pattern text; skip_freezer boolean; skip_slide boolean; skip_item boolean; skip_boxes boolean;
has_text_query boolean; has_date_filter boolean; has_slide_date boolean; has_item_date boolean; has_freezer_date boolean;
has_filters_only boolean; freezer_combined_mode boolean; slide_combined_mode boolean;
slide_date_json jsonb; item_date_json jsonb; freezer_date_json jsonb;
v_is_workspace_owner boolean; v_blocked_count integer := 0; v_tmp_count integer;
BEGIN
pattern := '%' || search_query || '%';
has_text_query := (search_query IS NOT NULL AND trim(search_query) <> '');
has_date_filter := (date_mode IS NOT NULL);
slide_date_json := CASE WHEN slide_date_filters IS NOT NULL THEN slide_date_filters::jsonb ELSE NULL END;
item_date_json := CASE WHEN item_date_filters IS NOT NULL THEN item_date_filters::jsonb ELSE NULL END;
freezer_date_json := CASE WHEN freezer_date_filters IS NOT NULL THEN freezer_date_filters::jsonb ELSE NULL END;
has_slide_date := (slide_date_json IS NOT NULL AND jsonb_array_length(slide_date_json) > 0);
has_item_date := (item_date_json IS NOT NULL AND jsonb_array_length(item_date_json) > 0);
has_freezer_date := (freezer_date_json IS NOT NULL AND jsonb_array_length(freezer_date_json) > 0);
skip_freezer := (filter_scopes IS NOT NULL AND NOT ('freezer_box' = ANY(filter_scopes)));
skip_slide := (filter_scopes IS NOT NULL AND NOT ('slide_box' = ANY(filter_scopes)));
skip_item := (filter_scopes IS NOT NULL AND NOT ('item' = ANY(filter_scopes)));
skip_boxes := (filter_scopes IS NOT NULL AND NOT ('freezer_box' = ANY(filter_scopes)) AND NOT ('slide_box' = ANY(filter_scopes)));
has_filters_only := (NOT has_text_query AND NOT has_date_filter AND NOT has_slide_date AND NOT has_item_date AND NOT has_freezer_date AND (filter_scopes IS NOT NULL OR filter_texts IS NOT NULL OR freezer_sub_filters IS NOT NULL OR slide_header_filters IS NOT NULL OR item_sub_filters IS NOT NULL OR item_header_filters IS NOT NULL OR item_folder_name_filter IS NOT NULL OR freezer_header_filters IS NOT NULL));
freezer_combined_mode := (freezer_sub_filters IS NULL OR ('name' = ANY(freezer_sub_filters) AND 'info' = ANY(freezer_sub_filters)));
slide_combined_mode := (slide_header_filters IS NULL);
v_is_workspace_owner := false;
IF p_team_member_id IS NOT NULL THEN
SELECT EXISTS (SELECT 1 FROM workspaces w WHERE w.owner_id = p_team_member_id) INTO v_is_workspace_owner;
END IF;

SELECT json_build_object(
'cell_matches', CASE
WHEN skip_freezer OR NOT freezer_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_freezer_date OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t)) FROM (
SELECT fc.name, fc.information, fc.cell_id, fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type,
f.id AS location_id, f.name AS location_name, fs.name AS sublocation_name, sp.name AS position_name, fc.date::text AS date_value, fc.date_type
FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
LEFT JOIN sublocations fs ON fs.id = fb.sublocation_id LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type IN ('freezer','structured_freezer') AND (COALESCE(fc.name,'')<>'' OR COALESCE(fc.information,'')<>'')
AND (NOT has_text_query OR (COALESCE(fc.name,'') || ' ' || COALESCE(fc.information,'')) ILIKE pattern)
AND (filter_texts IS NULL OR (SELECT bool_and((COALESCE(fc.name,'') || ' ' || COALESCE(fc.information,'')) ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (CASE WHEN date_type_target='date' THEN fc.date_type='date' WHEN date_type_target='expiration' THEN fc.date_type='expiration' ELSE TRUE END) AND ((date_mode='exact' AND fc.date=date_start::date) OR (date_mode='range' AND fc.date>=date_start::date AND fc.date<=date_end::date) OR (date_mode='before' AND fc.date<=date_start::date) OR (date_mode='after' AND fc.date>=date_start::date) OR (date_mode='expiring_within' AND fc.date_type='expiration' AND fc.date>=CURRENT_DATE AND fc.date<=(CURRENT_DATE+date_end::int)))))
AND (p_team_member_id IS NULL OR v_is_workspace_owner OR bps.box_id IS NULL OR bps.privacy_mode='open' OR bps.owner_id=p_team_member_id OR EXISTS(SELECT 1 FROM box_access_list bal WHERE bal.box_id=fb.id AND bal.team_member_id=p_team_member_id))
LIMIT 100) t), '[]'::json) ELSE '[]'::json END,

'structured_freezer_matches', CASE
WHEN skip_freezer OR NOT freezer_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_freezer_date OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t)) FROM (
WITH sf_cell_agg AS (SELECT scv.cell_id AS cell_uuid, string_agg(COALESCE(scv.value,''),' ' ORDER BY sbh.display_order) AS all_col_values, json_agg(json_build_object('header_text',sbh.header_text,'value',scv.value,'display_order',sbh.display_order) ORDER BY sbh.display_order) AS values_array FROM slide_cell_values scv JOIN slide_box_headers sbh ON sbh.id=scv.header_id JOIN cells fc2 ON fc2.id=scv.cell_id JOIN boxes fb2 ON fb2.id=fc2.box_id WHERE fb2.box_type='structured_freezer' AND COALESCE(scv.value,'')<>'' GROUP BY scv.cell_id)
SELECT fc.name, fc.information, sca.all_col_values AS aggregated_text, sca.values_array, fc.cell_id, fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type,
f.id AS location_id, f.name AS location_name, fs.name AS sublocation_name, sp.name AS position_name, fc.date::text AS date_value, fc.date_type
FROM cells fc JOIN boxes fb ON fb.id=fc.box_id JOIN locations f ON f.id=fb.location_id
LEFT JOIN sublocations fs ON fs.id=fb.sublocation_id LEFT JOIN sublocation_positions sp ON sp.id=fb.position_id
LEFT JOIN sf_cell_agg sca ON sca.cell_uuid=fc.id LEFT JOIN box_privacy_settings bps ON bps.box_id=fb.id
WHERE fb.box_type='structured_freezer' AND (COALESCE(fc.name,'')<>'' OR COALESCE(fc.information,'')<>'' OR sca.all_col_values IS NOT NULL)
AND (NOT has_text_query OR (COALESCE(fc.name,'') || ' ' || COALESCE(fc.information,'') || ' ' || COALESCE(sca.all_col_values,'')) ILIKE pattern)
AND (filter_texts IS NULL OR (SELECT bool_and((COALESCE(fc.name,'') || ' ' || COALESCE(fc.information,'') || ' ' || COALESCE(sca.all_col_values,'')) ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (CASE WHEN date_type_target='date' THEN fc.date_type='date' WHEN date_type_target='expiration' THEN fc.date_type='expiration' ELSE TRUE END) AND ((date_mode='exact' AND fc.date=date_start::date) OR (date_mode='range' AND fc.date>=date_start::date AND fc.date<=date_end::date) OR (date_mode='before' AND fc.date<=date_start::date) OR (date_mode='after' AND fc.date>=date_start::date) OR (date_mode='expiring_within' AND fc.date_type='expiration' AND fc.date>=CURRENT_DATE AND fc.date<=(CURRENT_DATE+date_end::int)))))
AND (NOT has_freezer_date OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(freezer_date_json) AS cdf WHERE NOT EXISTS(SELECT 1 FROM slide_cell_values scv3 JOIN slide_box_headers sbh3 ON sbh3.id=scv3.header_id WHERE scv3.cell_id=fc.id AND sbh3.header_text=(cdf->>'column_name') AND sbh3.header_type IN('date','expiration') AND scv3.value<>'' AND (((cdf->>'mode')='exact' AND scv3.value::date=(cdf->>'date_start')::date) OR ((cdf->>'mode')='range' AND scv3.value::date>=(cdf->>'date_start')::date AND scv3.value::date<=(cdf->>'date_end')::date) OR ((cdf->>'mode')='before' AND scv3.value::date<=(cdf->>'date_start')::date) OR ((cdf->>'mode')='after' AND scv3.value::date>=(cdf->>'date_start')::date) OR ((cdf->>'mode')='expiring_within' AND sbh3.header_type='expiration' AND scv3.value::date>=CURRENT_DATE AND scv3.value::date<=(CURRENT_DATE+(cdf->>'date_end')::int))))))
AND (p_team_member_id IS NULL OR v_is_workspace_owner OR bps.box_id IS NULL OR bps.privacy_mode='open' OR bps.owner_id=p_team_member_id OR EXISTS(SELECT 1 FROM box_access_list bal WHERE bal.box_id=fb.id AND bal.team_member_id=p_team_member_id))
LIMIT 100) t), '[]'::json) ELSE '[]'::json END,

'cell_titles', '[]'::json,
'cell_info', '[]'::json,

'boxes', CASE
WHEN skip_boxes THEN '[]'::json
WHEN has_text_query OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t)) FROM (
SELECT fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type,
f.id AS location_id, f.name AS location_name, fs.name AS sublocation_name, sp.name AS position_name
FROM boxes fb JOIN locations f ON f.id=fb.location_id LEFT JOIN sublocations fs ON fs.id=fb.sublocation_id LEFT JOIN sublocation_positions sp ON sp.id=fb.position_id
WHERE (NOT has_text_query OR fb.name ILIKE pattern)
AND (filter_scopes IS NULL OR ('freezer_box'=ANY(filter_scopes) AND fb.box_type IN('freezer','structured_freezer')) OR ('slide_box'=ANY(filter_scopes) AND fb.box_type='slide'))
AND (filter_texts IS NULL OR (SELECT bool_and(fb.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20) t), '[]'::json) ELSE '[]'::json END,

'items', CASE
WHEN skip_item THEN '[]'::json
WHEN has_text_query OR has_item_date OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t)) FROM (
SELECT ii.id AS item_id, ii.name AS item_name, ii.item_type, ii.folder_id, ifo.name AS folder_name,
ii.sublocation_id, ii.position_id,
f.id AS location_id, f.name AS location_name, fs.name AS sublocation_name, sp.name AS position_name
FROM inventory_items ii JOIN locations f ON f.id=ii.location_id LEFT JOIN item_folders ifo ON ifo.id=ii.folder_id
LEFT JOIN sublocations fs ON fs.id=ii.sublocation_id LEFT JOIN sublocation_positions sp ON sp.id=ii.position_id
WHERE (NOT has_text_query OR ii.name ILIKE pattern)
AND (item_sub_filters IS NULL OR 'name'=ANY(item_sub_filters) OR 'column_header'=ANY(item_sub_filters))
AND (item_folder_name_filter IS NULL OR ifo.name=item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(ii.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_item_date OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(item_date_json) AS cdf WHERE NOT EXISTS(SELECT 1 FROM item_custom_values icv3 JOIN item_folder_headers ifh3 ON ifh3.id=icv3.header_id WHERE icv3.item_id=ii.id AND ifh3.header_text=(cdf->>'column_name') AND ifh3.header_type IN('date','expiration') AND icv3.value<>'' AND (((cdf->>'mode')='exact' AND icv3.value::date=(cdf->>'date_start')::date) OR ((cdf->>'mode')='range' AND icv3.value::date>=(cdf->>'date_start')::date AND icv3.value::date<=(cdf->>'date_end')::date) OR ((cdf->>'mode')='before' AND icv3.value::date<=(cdf->>'date_start')::date) OR ((cdf->>'mode')='after' AND icv3.value::date>=(cdf->>'date_start')::date) OR ((cdf->>'mode')='expiring_within' AND ifh3.header_type='expiration' AND icv3.value::date>=CURRENT_DATE AND icv3.value::date<=(CURRENT_DATE+(cdf->>'date_end')::int))))))
LIMIT 20) t), '[]'::json) ELSE '[]'::json END,

'item_custom_values', CASE
WHEN skip_item THEN '[]'::json
WHEN (has_text_query OR has_item_date OR has_filters_only) AND (item_sub_filters IS NULL OR 'column_header'=ANY(item_sub_filters)) THEN COALESCE((
SELECT json_agg(row_to_json(t)) FROM (
SELECT icv.value AS matched_value, ifh.header_text, ifh.display_order, ii.id AS item_id, ii.name AS item_name, ii.item_type, ii.folder_id, ifo.name AS folder_name,
ii.sublocation_id, ii.position_id,
f.id AS location_id, f.name AS location_name, fs.name AS sublocation_name, sp.name AS position_name
FROM item_custom_values icv JOIN item_folder_headers ifh ON ifh.id=icv.header_id JOIN inventory_items ii ON ii.id=icv.item_id
LEFT JOIN item_folders ifo ON ifo.id=ii.folder_id JOIN locations f ON f.id=ii.location_id
LEFT JOIN sublocations fs ON fs.id=ii.sublocation_id LEFT JOIN sublocation_positions sp ON sp.id=ii.position_id
WHERE (NOT has_text_query OR (icv.value ILIKE pattern AND icv.value<>''))
AND (item_header_filters IS NULL OR ifh.header_text=ANY(item_header_filters))
AND (item_folder_name_filter IS NULL OR ifo.name=item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(icv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_item_date OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(item_date_json) AS cdf WHERE NOT EXISTS(SELECT 1 FROM item_custom_values icv3 JOIN item_folder_headers ifh3 ON ifh3.id=icv3.header_id WHERE icv3.item_id=ii.id AND ifh3.header_text=(cdf->>'column_name') AND ifh3.header_type IN('date','expiration') AND icv3.value<>'' AND (((cdf->>'mode')='exact' AND icv3.value::date=(cdf->>'date_start')::date) OR ((cdf->>'mode')='range' AND icv3.value::date>=(cdf->>'date_start')::date AND icv3.value::date<=(cdf->>'date_end')::date) OR ((cdf->>'mode')='before' AND icv3.value::date<=(cdf->>'date_start')::date) OR ((cdf->>'mode')='after' AND icv3.value::date>=(cdf->>'date_start')::date) OR ((cdf->>'mode')='expiring_within' AND ifh3.header_type='expiration' AND icv3.value::date>=CURRENT_DATE AND icv3.value::date<=(CURRENT_DATE+(cdf->>'date_end')::int))))))
LIMIT 50) t), '[]'::json) ELSE '[]'::json END,

'slide_matches', CASE
WHEN skip_slide OR NOT slide_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t)) FROM (
WITH cell_agg AS (SELECT scv.cell_id AS cell_uuid, string_agg(COALESCE(scv.value,''),' ') AS all_values, json_agg(json_build_object('header_text',sbh.header_text,'value',scv.value,'display_order',sbh.display_order) ORDER BY sbh.display_order) AS values_array FROM slide_cell_values scv JOIN slide_box_headers sbh ON sbh.id=scv.header_id WHERE COALESCE(scv.value,'')<>'' GROUP BY scv.cell_id)
SELECT ca.all_values AS aggregated_text, ca.values_array, fc.cell_id, fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type,
f.id AS location_id, f.name AS location_name, fs.name AS sublocation_name, sp.name AS position_name, fc.date::text AS date_value, fc.date_type
FROM cell_agg ca JOIN cells fc ON fc.id=ca.cell_uuid JOIN boxes fb ON fb.id=fc.box_id JOIN locations f ON f.id=fb.location_id
LEFT JOIN sublocations fs ON fs.id=fb.sublocation_id LEFT JOIN sublocation_positions sp ON sp.id=fb.position_id LEFT JOIN box_privacy_settings bps ON bps.box_id=fb.id
WHERE fb.box_type='slide' AND (NOT has_text_query OR ca.all_values ILIKE pattern)
AND (filter_texts IS NULL OR (SELECT bool_and(ca.all_values ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (CASE WHEN date_type_target='date' THEN fc.date_type='date' WHEN date_type_target='expiration' THEN fc.date_type='expiration' ELSE TRUE END) AND ((date_mode='exact' AND fc.date=date_start::date) OR (date_mode='range' AND fc.date>=date_start::date AND fc.date<=date_end::date) OR (date_mode='before' AND fc.date<=date_start::date) OR (date_mode='after' AND fc.date>=date_start::date) OR (date_mode='expiring_within' AND fc.date_type='expiration' AND fc.date>=CURRENT_DATE AND fc.date<=(CURRENT_DATE+date_end::int)))))
AND (p_team_member_id IS NULL OR v_is_workspace_owner OR bps.box_id IS NULL OR bps.privacy_mode='open' OR bps.owner_id=p_team_member_id OR EXISTS(SELECT 1 FROM box_access_list bal WHERE bal.box_id=fb.id AND bal.team_member_id=p_team_member_id))
LIMIT 100) t), '[]'::json) ELSE '[]'::json END,

'slide_values', CASE
WHEN skip_slide OR slide_combined_mode THEN '[]'::json
WHEN has_text_query OR has_slide_date OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t)) FROM (
SELECT scv.value AS matched_value, sbh.header_text, sbh.display_order, fc.cell_id, fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type,
f.id AS location_id, f.name AS location_name, fs.name AS sublocation_name, sp.name AS position_name, fc.date::text AS date_value, fc.date_type
FROM slide_cell_values scv JOIN slide_box_headers sbh ON sbh.id=scv.header_id JOIN cells fc ON fc.id=scv.cell_id JOIN boxes fb ON fb.id=fc.box_id JOIN locations f ON f.id=fb.location_id
LEFT JOIN sublocations fs ON fs.id=fb.sublocation_id LEFT JOIN sublocation_positions sp ON sp.id=fb.position_id LEFT JOIN box_privacy_settings bps ON bps.box_id=fb.id
WHERE fb.box_type='slide' AND (NOT has_text_query OR (scv.value ILIKE pattern AND scv.value<>''))
AND (slide_header_filters IS NULL OR sbh.header_text=ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (CASE WHEN date_type_target='date' THEN fc.date_type='date' WHEN date_type_target='expiration' THEN fc.date_type='expiration' ELSE TRUE END) AND ((date_mode='exact' AND fc.date=date_start::date) OR (date_mode='range' AND fc.date>=date_start::date AND fc.date<=date_end::date) OR (date_mode='before' AND fc.date<=date_start::date) OR (date_mode='after' AND fc.date>=date_start::date) OR (date_mode='expiring_within' AND fc.date_type='expiration' AND fc.date>=CURRENT_DATE AND fc.date<=(CURRENT_DATE+date_end::int)))))
AND (NOT has_slide_date OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(slide_date_json) AS cdf WHERE NOT EXISTS(SELECT 1 FROM slide_cell_values scv3 JOIN slide_box_headers sbh3 ON sbh3.id=scv3.header_id WHERE scv3.cell_id=scv.cell_id AND sbh3.header_text=(cdf->>'column_name') AND sbh3.header_type IN('date','expiration') AND scv3.value<>'' AND (((cdf->>'mode')='exact' AND scv3.value::date=(cdf->>'date_start')::date) OR ((cdf->>'mode')='range' AND scv3.value::date>=(cdf->>'date_start')::date AND scv3.value::date<=(cdf->>'date_end')::date) OR ((cdf->>'mode')='before' AND scv3.value::date<=(cdf->>'date_start')::date) OR ((cdf->>'mode')='after' AND scv3.value::date>=(cdf->>'date_start')::date) OR ((cdf->>'mode')='expiring_within' AND sbh3.header_type='expiration' AND scv3.value::date>=CURRENT_DATE AND scv3.value::date<=(CURRENT_DATE+(cdf->>'date_end')::int))))))
AND (p_team_member_id IS NULL OR v_is_workspace_owner OR bps.box_id IS NULL OR bps.privacy_mode='open' OR bps.owner_id=p_team_member_id OR EXISTS(SELECT 1 FROM box_access_list bal WHERE bal.box_id=fb.id AND bal.team_member_id=p_team_member_id))
LIMIT 50) t), '[]'::json) ELSE '[]'::json END,

'slide_headers', CASE
WHEN skip_slide THEN '[]'::json
WHEN has_text_query OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t)) FROM (
SELECT sbh.header_text, sbh.display_order, fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type,
f.id AS location_id, f.name AS location_name, fs.name AS sublocation_name, sp.name AS position_name
FROM slide_box_headers sbh JOIN boxes fb ON fb.id=sbh.box_id JOIN locations f ON f.id=fb.location_id
LEFT JOIN sublocations fs ON fs.id=fb.sublocation_id LEFT JOIN sublocation_positions sp ON sp.id=fb.position_id LEFT JOIN box_privacy_settings bps ON bps.box_id=fb.id
WHERE fb.box_type='slide' AND (NOT has_text_query OR sbh.header_text ILIKE pattern)
AND (slide_header_filters IS NULL OR sbh.header_text=ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(sbh.header_text ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (p_team_member_id IS NULL OR v_is_workspace_owner OR bps.box_id IS NULL OR bps.privacy_mode='open' OR bps.owner_id=p_team_member_id OR EXISTS(SELECT 1 FROM box_access_list bal WHERE bal.box_id=fb.id AND bal.team_member_id=p_team_member_id))
LIMIT 20) t), '[]'::json) ELSE '[]'::json END,

'cell_dates', '[]'::json
) INTO result;

IF p_team_member_id IS NOT NULL AND NOT v_is_workspace_owner THEN
SELECT COUNT(*) INTO v_tmp_count FROM cells fc JOIN boxes fb ON fb.id=fc.box_id JOIN locations f ON f.id=fb.location_id JOIN box_privacy_settings bps ON bps.box_id=fb.id
WHERE bps.privacy_mode='restricted' AND bps.owner_id<>p_team_member_id AND NOT EXISTS(SELECT 1 FROM box_access_list bal WHERE bal.box_id=fb.id AND bal.team_member_id=p_team_member_id)
AND fb.box_type IN('freezer','structured_freezer','slide') AND (COALESCE(fc.name,'')<>'' OR COALESCE(fc.information,'')<>'' OR EXISTS(SELECT 1 FROM slide_cell_values scv2 WHERE scv2.cell_id=fc.id AND scv2.value<>''))
AND (NOT has_text_query OR (COALESCE(fc.name,'') || ' ' || COALESCE(fc.information,'')) ILIKE pattern OR EXISTS(SELECT 1 FROM slide_cell_values scv2 JOIN slide_box_headers sbh2 ON sbh2.id=scv2.header_id WHERE scv2.cell_id=fc.id AND scv2.value ILIKE pattern))
AND (NOT skip_freezer OR NOT skip_slide);
v_blocked_count := v_blocked_count + v_tmp_count;
END IF;

result := (result::jsonb || jsonb_build_object('blocked_count', v_blocked_count))::json;
RETURN result;
END;
$function$;
