/*
# Add ai_code to item_folders

1. Modified Tables
   - `item_folders`: Added `ai_code` integer column (nullable, will be backfilled)
   
2. New Objects
   - Trigger function `assign_item_folder_ai_code()`: Assigns the lowest available 
     positive integer per workspace before insert.
   - Trigger `trg_assign_item_folder_ai_code` on `item_folders` BEFORE INSERT.

3. Backfill
   - All existing item_folders receive sequential ai_codes ordered by created_at, id,
     scoped per workspace (derived through the location join).

4. Important Notes
   - The IF prefix (IF1, IF2, ...) is used by the AI chat system to reference 
     item folders/sheets in navigation links.
   - Deleted codes are reused (trigger picks smallest missing positive integer).
   - item_folders references location_id, so workspace scoping joins through locations.
*/

-- Add the column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'item_folders' AND column_name = 'ai_code'
  ) THEN
    ALTER TABLE item_folders ADD COLUMN ai_code integer;
  END IF;
END $$;

-- Trigger function: assign lowest available positive integer per workspace
CREATE OR REPLACE FUNCTION public.assign_item_folder_ai_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $func$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT l.workspace_id INTO v_workspace_id
  FROM locations l WHERE l.id = NEW.location_id;

  SELECT COALESCE(MIN(t.n), 1) INTO NEW.ai_code
  FROM generate_series(
    1,
    (SELECT COUNT(*)::int + 1
     FROM item_folders ifo
     JOIN locations l ON l.id = ifo.location_id
     WHERE l.workspace_id = v_workspace_id)
  ) t(n)
  WHERE NOT EXISTS (
    SELECT 1 FROM item_folders ifo2
    JOIN locations l2 ON l2.id = ifo2.location_id
    WHERE l2.workspace_id = v_workspace_id AND ifo2.ai_code = t.n
  );

  RETURN NEW;
END;
$func$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_assign_item_folder_ai_code ON item_folders;
CREATE TRIGGER trg_assign_item_folder_ai_code
  BEFORE INSERT ON item_folders
  FOR EACH ROW
  EXECUTE FUNCTION assign_item_folder_ai_code();

-- Backfill existing rows
DO $$
DECLARE
  r RECORD;
  v_seq integer;
  v_prev_ws uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  v_seq := 0;
  FOR r IN
    SELECT ifo.id, l.workspace_id
    FROM item_folders ifo
    JOIN locations l ON l.id = ifo.location_id
    WHERE ifo.ai_code IS NULL
    ORDER BY l.workspace_id, ifo.created_at, ifo.id
  LOOP
    IF r.workspace_id <> v_prev_ws THEN
      v_seq := 0;
      v_prev_ws := r.workspace_id;
    END IF;
    v_seq := v_seq + 1;
    UPDATE item_folders SET ai_code = v_seq WHERE id = r.id;
  END LOOP;
END $$;
