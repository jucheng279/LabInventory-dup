-- The previous REVOKE FROM anon did not work because these functions still have
-- EXECUTE granted to the PUBLIC pseudo-role (the default for new functions).
-- The anon role inherits from PUBLIC, so it retains the privilege.
-- Fix: revoke from PUBLIC, then explicitly grant to authenticated only.

-- Privacy helper functions
REVOKE EXECUTE ON FUNCTION public.can_access_box(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_edit_box(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_delete_box(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_project(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_edit_project(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_delete_project(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_box_access(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_project_access(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.batch_resolve_box_access(uuid[], uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.batch_resolve_project_access(uuid[], uuid) FROM PUBLIC;

-- Original helper functions
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_team_member_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_owner_or_manager() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_member() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_valid_access() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner_without_workspace() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_workspace_freezer_box_headers() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_workspace_slide_headers() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_workspace_item_folder_headers() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_workspace_item_folder_names() FROM PUBLIC;

-- Grant back to authenticated only (these are needed by RLS policies when called by signed-in users)
GRANT EXECUTE ON FUNCTION public.can_access_box(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_box(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_delete_box(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_delete_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_box_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_project_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_resolve_box_access(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_resolve_project_access(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_workspace_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_team_member_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_or_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner_without_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_freezer_box_headers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_slide_headers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_item_folder_headers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_item_folder_names() TO authenticated;
