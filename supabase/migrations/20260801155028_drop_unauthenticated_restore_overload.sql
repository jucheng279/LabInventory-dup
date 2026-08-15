-- F1: remove the SECURITY DEFINER restore overload that trusted a caller-supplied
-- team member id and could wipe an entire workspace. The application uses the
-- single-argument restore_workspace_backup(p_backup_id) overload, which binds to auth.uid().
DROP FUNCTION IF EXISTS public.restore_workspace_backup(uuid, jsonb);
