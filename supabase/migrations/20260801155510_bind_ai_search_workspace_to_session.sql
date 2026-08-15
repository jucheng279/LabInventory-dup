-- F14: ai_search_workspace derived the workspace from a caller-supplied member id.
-- Inject a guard binding that id to the current session, and drop anon EXECUTE.
DO $$
DECLARE
  d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'ai_search_workspace';

  d := regexp_replace(
    d,
    E'\nBEGIN\n',
    E'\nBEGIN\nIF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM team_members tm_auth WHERE tm_auth.id = p_team_member_id AND tm_auth.auth_user_id = auth.uid()) THEN RETURN jsonb_build_object(''ok'', false, ''error'', ''Access denied''); END IF;\n'
  );

  EXECUTE d;
END $$;

REVOKE EXECUTE ON FUNCTION public.ai_search_workspace(uuid, text, text[], uuid, boolean, boolean, integer) FROM anon;
