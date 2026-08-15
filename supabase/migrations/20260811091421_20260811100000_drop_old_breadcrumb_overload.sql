/*
# Drop ambiguous 4-parameter ai_get_location_breadcrumb overload

1. Problem
   - The previous migration (20260811080000) added a new 5-parameter version of
     `ai_get_location_breadcrumb` with `p_folder_id uuid DEFAULT NULL`, but the
     original 4-parameter version was not removed.
   - PostgreSQL treats these as two distinct function overloads. Any call with
     4 uuid arguments is ambiguous (both signatures match) and fails with:
     "function ai_get_location_breadcrumb(uuid, uuid, uuid, uuid) is not unique".
   - This broke ALL AI inventory functions (search, details, low stock, expiring,
     activity, risk summary, project contents, item locations) because they all
     call ai_get_location_breadcrumb with 4 arguments for cells and boxes.

2. Fix
   - Drop the old 4-parameter overload.
   - The 5-parameter version already defaults `p_folder_id` to NULL, so all
     existing 4-argument call sites resolve correctly without any code changes.

3. Security
   - No security changes. The 5-parameter version retains its existing grants
     (EXECUTE for authenticated).
*/

DROP FUNCTION IF EXISTS public.ai_get_location_breadcrumb(uuid, uuid, uuid, uuid);
