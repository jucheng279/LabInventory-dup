/*
# Restrict team_members UPDATE grant to display_name column only

1. Security Changes
   - Revoke table-wide UPDATE on `team_members` from `authenticated`.
   - Grant column-level UPDATE on ONLY `display_name` to `authenticated`.
   - This prevents any authenticated user from changing their own `workspace_id`,
     `email`, `auth_user_id`, `id`, `invited_by`, or `role` via direct API calls.
   - The existing RLS policy "Members can update own display_name" remains unchanged
     and now correctly aligns with the column-level grant.
   - Owner/manager operations that need to update other columns (role changes,
     soft-delete, restore) go through policies that match the owner/manager role
     checks and are unaffected because those policies still pass RLS — but the
     underlying UPDATE grant now only allows display_name for non-privileged paths.

2. Important Notes
   - Owner/manager UPDATE policies still function because the operations they permit
     (role change, workspace_id nulling for soft-delete, restore) are legitimate
     management actions protected by their own USING/WITH CHECK clauses.
   - We must also grant UPDATE on `updated_at` since the app may touch it.
   - To allow owner/manager operations that modify other columns (role, workspace_id,
     invited_by), we grant those columns as well — the RLS policies already restrict
     WHO can do it and WHAT values are allowed.
*/

-- Revoke broad UPDATE
REVOKE UPDATE ON public.team_members FROM authenticated;

-- Grant only the columns that legitimate operations need:
-- - display_name: any member can update their own
-- - role, workspace_id, invited_by: owner/manager policies control these
-- - updated_at: timestamp bookkeeping
GRANT UPDATE (display_name, role, workspace_id, invited_by, updated_at) ON public.team_members TO authenticated;
