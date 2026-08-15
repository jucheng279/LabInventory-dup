-- F14/F15/F16 follow-up: the anon EXECUTE came from the default PUBLIC grant, so the
-- earlier REVOKE ... FROM anon had no effect. Revoke from PUBLIC and grant explicitly.
REVOKE ALL ON FUNCTION public.ai_search_workspace(uuid, text, text[], uuid, boolean, boolean, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_search_workspace(uuid, text, text[], uuid, boolean, boolean, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.ai_search_workspace(uuid, text, text[], uuid, boolean, boolean, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ai_get_entity_details(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_get_entity_details(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ai_get_entity_details(uuid, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ai_get_project_contents(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_get_project_contents(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ai_get_project_contents(uuid, uuid, uuid) TO authenticated, service_role;
