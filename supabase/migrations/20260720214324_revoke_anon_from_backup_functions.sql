/*
# Revoke anon execute from backup functions (explicit grants)

1. Security Changes
   - The backup functions (create, delete, restore) had explicit GRANT to anon
     in addition to PUBLIC. This migration revokes the anon grant directly,
     leaving only authenticated access.
   - These functions already validate auth.uid() internally, so this is
     defense-in-depth.
*/

REVOKE EXECUTE ON FUNCTION public.create_workspace_backup(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_workspace_backup(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_workspace_backup(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_workspace_backup(uuid) FROM anon;
