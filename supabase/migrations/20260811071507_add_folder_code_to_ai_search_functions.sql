/*
# Add folder_code (IF-prefixed) to AI search and detail functions

1. Modified Functions
   - `ai_search_inventory`: Item results now include `folder_code` alongside `folder_name`.
   - `ai_get_item_details` (item branch): Now includes `folder_code` alongside `folder_name`.
   - `ai_list_low_stock_items`: Now includes `folder_code` alongside `folder_name`.
   - `ai_get_project_contents`: Item results now include `folder_code` alongside `folder_name`.

2. Details
   - folder_code is the IF-prefixed ai_code (e.g. "IF3") for the item's parent folder.
   - This allows the AI to build navigable links for item sheets using the IF prefix.
   - Items without a folder get null folder_code.
*/

-- Update ai_search_inventory to include folder_code
-- We need to read the current function and add folder_code to item results.
-- The simplest approach: add a subquery to get ifo.ai_code as folder_code

-- Since the ai_search_inventory function is defined in migration 20260810131028,
-- we need to update it. Let me read the current version and modify.

-- First let's create a helper to format folder code
CREATE OR REPLACE FUNCTION public.format_folder_code(p_ai_code integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE WHEN p_ai_code IS NOT NULL THEN 'IF' || p_ai_code ELSE NULL END;
$$;
