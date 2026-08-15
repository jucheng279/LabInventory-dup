/*
# Add auth.uid() validation to get_ai_inventory_context_v2

1. Security Changes
   - Adds authorization check at the start of get_ai_inventory_context_v2:
     verifies that p_team_member_id belongs to the caller via auth.uid().
   - Revokes EXECUTE from anon role (only authenticated users should call this).
   - Also adds search_path restriction for defense-in-depth.

2. Important Notes
   - The function body is replaced in place using the DO block pattern to inject
     the auth check without rewriting the entire complex function.
   - Returns an error JSON if the caller does not own the team_member record.
*/

-- We need to replace just the beginning of the function to add the auth check.
-- The safest approach: use a wrapper pattern that validates first.
-- Since the function is very large, we'll use a DO block to ALTER it via dynamic SQL.

DO $$
DECLARE
  v_src text;
  v_new_src text;
BEGIN
  -- Get the current function source
  SELECT prosrc INTO v_src
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'get_ai_inventory_context_v2';

  -- Inject auth check after BEGIN
  v_new_src := replace(
    v_src,
    E'BEGIN\n-- Get workspace_id from the team member',
    E'BEGIN\n-- Authorization: verify caller owns this team_member record\nIF NOT EXISTS (\n  SELECT 1 FROM team_members\n  WHERE id = p_team_member_id AND auth_user_id = auth.uid()\n) THEN\n  RETURN json_build_object(''error'', ''Unauthorized: team member does not belong to caller'');\nEND IF;\n\n-- Get workspace_id from the team member'
  );

  -- Recreate the function with the auth check
  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.get_ai_inventory_context_v2(p_team_member_id uuid, p_sections text[], p_search_terms text DEFAULT NULL::text)
     RETURNS json
     LANGUAGE plpgsql
     SECURITY DEFINER
     SET search_path TO ''public''
    AS $func$%s$func$', v_new_src
  );
END $$;

-- Revoke anon access
REVOKE EXECUTE ON FUNCTION public.get_ai_inventory_context_v2(uuid, text[], text) FROM anon;
