/*
# Revoke anon execute on new privacy helper functions

1. Security Changes
   - Revokes EXECUTE from anon on the privacy helper functions since they are only
     used in RLS policies scoped TO authenticated.

2. Important Notes
   - These functions already return false for anonymous users (auth.uid() is null),
     but revoking is defense-in-depth.
*/

REVOKE EXECUTE ON FUNCTION public.can_access_box(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_box(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_delete_box(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_delete_project(uuid) FROM anon;
