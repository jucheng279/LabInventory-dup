/*
# Drop old ai_list_expiring_inventory overload

1. Problem
   - The previous migration created a new version of `ai_list_expiring_inventory`
     with `p_location_id` as the LAST parameter (matching the convention of
     other AI functions). But the original version had `p_location_id` in a
     different position (4th param), creating two overloads.
   - A call with just one uuid arg is now ambiguous.

2. Fix
   - Drop the old overload (the one with p_location_id as 4th parameter).
   - The new version has p_location_id as the last parameter with DEFAULT NULL,
     so all callers continue to work.

3. Security
   - No security changes.
*/

DROP FUNCTION IF EXISTS public.ai_list_expiring_inventory(uuid, integer, boolean, uuid, boolean, text, integer);
