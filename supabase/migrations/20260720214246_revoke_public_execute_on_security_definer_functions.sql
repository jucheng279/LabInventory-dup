/*
# Revoke default PUBLIC execute privilege on sensitive SECURITY DEFINER functions

1. Security Changes
   - PostgreSQL grants EXECUTE to PUBLIC by default on all functions. Since anon
     and authenticated inherit from PUBLIC, revoking from those roles alone is
     insufficient. This migration revokes from PUBLIC on functions that should
     not be callable by arbitrary/anonymous roles, then explicitly re-grants to
     authenticated where needed.

2. Functions locked down completely (no direct client calls):
   - handle_new_user (trigger only)
   - reassign_box_ownership_on_member_removal (trigger only)
   - reassign_project_ownership_on_member_removal (trigger only)
   - cron_auto_backup_workspaces (pg_cron only)
   - cleanup_old_box_history (internal only)

3. Functions restricted to authenticated only:
   - get_ai_inventory_context(uuid)
   - get_ai_inventory_context_v2(uuid, text[], text)
   - get_backup_stats(uuid)
   - sync_linked_item_stock(uuid)
   - sync_all_links_for_box(uuid)
   - create_workspace_backup(uuid)
   - create_workspace_backup(uuid, text, text)
   - delete_workspace_backup(uuid)
   - restore_workspace_backup(uuid)

4. Important Notes
   - RLS helper functions (is_team_member, is_owner, has_valid_access,
     get_user_workspace_id, etc.) remain callable by all roles because RLS
     evaluation needs them.
*/

-- ============================================================
-- Trigger/cron functions: revoke from PUBLIC entirely
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reassign_box_ownership_on_member_removal() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reassign_project_ownership_on_member_removal() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cron_auto_backup_workspaces() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_box_history() FROM PUBLIC;

-- ============================================================
-- Data functions: revoke from PUBLIC, re-grant to authenticated only
-- ============================================================

-- AI context functions
REVOKE EXECUTE ON FUNCTION public.get_ai_inventory_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_inventory_context(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_ai_inventory_context_v2(uuid, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_inventory_context_v2(uuid, text[], text) TO authenticated;

-- Backup functions
REVOKE EXECUTE ON FUNCTION public.get_backup_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_backup_stats(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_workspace_backup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workspace_backup(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_workspace_backup(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workspace_backup(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_workspace_backup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_workspace_backup(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.restore_workspace_backup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_workspace_backup(uuid) TO authenticated;

-- Sync functions
REVOKE EXECUTE ON FUNCTION public.sync_linked_item_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_linked_item_stock(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_all_links_for_box(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_all_links_for_box(uuid) TO authenticated;
