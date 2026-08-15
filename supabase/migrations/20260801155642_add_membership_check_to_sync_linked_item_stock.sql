-- F17: sync_linked_item_stock is SECURITY DEFINER and had no authorization check, so any
-- authenticated user could force a stock recount on another workspace's inventory.
-- Mirror the check already present in sync_all_links_for_box. Trigger and cron callers
-- run without a session (auth.uid() IS NULL) and are unaffected.
DO $$
DECLARE
  d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'sync_linked_item_stock'
    AND pg_get_function_identity_arguments(p.oid) = 'p_link_id uuid';

  d := regexp_replace(
    d,
    E'\nIF NOT FOUND THEN\nRETURN;\nEND IF;\n',
    E'\nIF NOT FOUND THEN\nRETURN;\nEND IF;\n\nIF auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM boxes b JOIN locations l ON l.id = b.location_id JOIN team_members tm_auth ON tm_auth.workspace_id = l.workspace_id WHERE b.id = v_link.box_id AND tm_auth.auth_user_id = auth.uid()) THEN\nRETURN;\nEND IF;\n'
  );

  EXECUTE d;
END $$;
