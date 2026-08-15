-- F13: table-wide UPDATE let any member rewrite workspaces.owner_id and seize the
-- owner-scoped policies. Restrict browser-side UPDATE to the name and the settings
-- columns the app actually writes. SELECT and INSERT are unchanged.
REVOKE UPDATE ON public.workspaces FROM authenticated;

GRANT UPDATE (
  name,
  updated_at,
  live_sync_enabled,
  auto_open_first_folder,
  auto_open_first_item_folder,
  colorful_icons_enabled,
  auto_expand_all_locations,
  hierarchical_navigation,
  rotate_wide_grid_mobile
) ON public.workspaces TO authenticated;
