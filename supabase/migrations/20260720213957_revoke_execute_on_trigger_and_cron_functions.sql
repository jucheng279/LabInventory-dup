/*
# Revoke EXECUTE on trigger-only and cron-only SECURITY DEFINER functions

1. Security Changes
   - Revoke EXECUTE from anon and authenticated on trigger functions that should
     never be called directly by clients:
     - handle_new_user (auth.users INSERT trigger)
     - reassign_box_ownership_on_member_removal (team_members UPDATE trigger)
     - reassign_project_ownership_on_member_removal (team_members UPDATE trigger)
   - Revoke EXECUTE from anon and authenticated on cron_auto_backup_workspaces
     (only pg_cron should invoke this).

2. Important Notes
   - Trigger functions continue to work because triggers execute with the
     privileges of the trigger owner, not the calling role.
   - pg_cron jobs run as the database owner, so revoking from anon/authenticated
     does not affect scheduled execution.
*/

-- Trigger functions: no client should call these directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reassign_box_ownership_on_member_removal() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reassign_project_ownership_on_member_removal() FROM anon, authenticated;

-- Cron function: only pg_cron should call this
REVOKE EXECUTE ON FUNCTION public.cron_auto_backup_workspaces() FROM anon, authenticated;
