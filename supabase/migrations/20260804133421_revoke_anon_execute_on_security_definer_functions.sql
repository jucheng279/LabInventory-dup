/*
# Revoke EXECUTE on SECURITY DEFINER functions from anon role

1. Security Changes
   - Revokes EXECUTE from `anon` on all SECURITY DEFINER functions in the public
     schema that are only used by authenticated users.
   - These functions return NULL/false without a session anyway, but revoking
     prevents anonymous clients from calling them via the REST API at all.
   - The functions are still executable by `authenticated` (and `service_role`).

2. Important Notes
   - None of these functions are needed by anonymous users.
   - The `get_user_workspace_id`, `get_user_team_member_id`, `is_owner`,
     `is_owner_or_manager`, `is_team_member`, `has_valid_access` are all RLS
     helpers that only make sense with an authenticated session.
   - `get_workspace_*` header functions are used by the authenticated app.
   - `is_workspace_owner_without_workspace` is used during auth setup flow.
*/

REVOKE EXECUTE ON FUNCTION public.get_user_team_member_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_freezer_box_headers() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_item_folder_headers() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_item_folder_names() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_slide_headers() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_valid_access() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner_or_manager() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner_without_workspace() FROM anon;
