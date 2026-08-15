-- Re-revoke EXECUTE from anon on all SECURITY DEFINER privacy helper functions.
-- The previous recursion-fix migration re-created these functions with CREATE OR REPLACE,
-- which reset their grants back to the default (public EXECUTE). This restores the lockdown.

REVOKE EXECUTE ON FUNCTION public.can_access_box(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_box(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_delete_box(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_delete_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_box_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_project_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.batch_resolve_box_access(uuid[], uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.batch_resolve_project_access(uuid[], uuid) FROM anon;

-- Also re-revoke on original helper functions that are SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_team_member_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner_or_manager() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_valid_access() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner_without_workspace() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_freezer_box_headers() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_slide_headers() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_item_folder_headers() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_item_folder_names() FROM anon;
