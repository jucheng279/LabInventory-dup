/*
# Fix search_path on SECURITY DEFINER functions

1. Problem
   - Four SECURITY DEFINER functions in the public schema are missing an explicit
     `search_path` setting. This triggers the "Function Search Path Mutable" security
     warning because an attacker could theoretically manipulate the search_path to
     hijack unqualified table/function references inside these privileged functions.

2. Affected Functions
   - `ai_get_entity_details(uuid, text, uuid)`
   - `ai_search_workspace(uuid, text, text[], uuid, boolean, boolean, integer)`
   - `ai_get_project_contents(uuid, uuid, uuid)`
   - `restore_workspace_backup(uuid, jsonb)`

3. Fix
   - Set `search_path = 'public'` on each function using ALTER FUNCTION, which pins
     the lookup path and prevents search_path manipulation attacks.

4. Important Notes
   - This does NOT change any function logic or behavior.
   - All other SECURITY DEFINER functions in this project already have search_path set.
   - These four were missed when they were last recreated in a prior migration.
*/

ALTER FUNCTION public.ai_get_entity_details(uuid, text, uuid)
  SET search_path = 'public';

ALTER FUNCTION public.ai_search_workspace(uuid, text, text[], uuid, boolean, boolean, integer)
  SET search_path = 'public';

ALTER FUNCTION public.ai_get_project_contents(uuid, uuid, uuid)
  SET search_path = 'public';

ALTER FUNCTION public.restore_workspace_backup(uuid, jsonb)
  SET search_path = 'public';
