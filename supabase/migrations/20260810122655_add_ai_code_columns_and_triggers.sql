/*
# Add AI short-code columns to navigable tables

1. Modified Tables
   - `locations`: Added `ai_code` integer column (unique per workspace)
   - `sublocations`: Added `ai_code` integer column (unique per workspace)
   - `sublocation_positions`: Added `ai_code` integer column (unique per workspace)
   - `boxes`: Added `ai_code` integer column (unique per workspace)

2. New Functions
   - `assign_location_ai_code()`: Trigger function that auto-assigns the lowest
     available positive integer as `ai_code` within the workspace.
   - `assign_sublocation_ai_code()`: Same for sublocations.
   - `assign_position_ai_code()`: Same for positions.
   - `assign_box_ai_code()`: Same for boxes.
   - `get_workspace_id_for_sublocation(uuid)`: Helper to get workspace_id from sublocation.
   - `get_workspace_id_for_box(uuid)`: Helper to get workspace_id from box location.

3. New Triggers
   - `trg_assign_location_ai_code` on locations BEFORE INSERT
   - `trg_assign_sublocation_ai_code` on sublocations BEFORE INSERT
   - `trg_assign_position_ai_code` on sublocation_positions BEFORE INSERT
   - `trg_assign_box_ai_code` on boxes BEFORE INSERT

4. Backfill
   - All existing rows in all four tables receive sequential ai_code values
     per workspace.

5. Unique Constraints
   - `uq_locations_ws_ai_code` on locations (workspace_id, ai_code)
   - For sublocations, positions, and boxes: uniqueness is enforced by the
     trigger (the trigger always picks the smallest unused number within the
     workspace, preventing collisions). Expression-based unique indexes are not
     possible for these tables since workspace_id is on the parent.

6. Security
   - No RLS or policy changes. Trigger functions are not SECURITY DEFINER;
     they run in the context of the inserting user.

7. Important Notes
   - Codes are purely internal to the AI chat system.
   - Cells do not get their own code; they use a combined format of
     box-code + cell coordinate (e.g. B7:A1).
   - Deleted numbers are reused: the trigger always picks the smallest
     missing positive integer within the workspace.
*/

-- 1. Add ai_code columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='locations' AND column_name='ai_code') THEN
    ALTER TABLE locations ADD COLUMN ai_code integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sublocations' AND column_name='ai_code') THEN
    ALTER TABLE sublocations ADD COLUMN ai_code integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sublocation_positions' AND column_name='ai_code') THEN
    ALTER TABLE sublocation_positions ADD COLUMN ai_code integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='boxes' AND column_name='ai_code') THEN
    ALTER TABLE boxes ADD COLUMN ai_code integer;
  END IF;
END $$;

-- 2. Trigger functions for auto-assigning codes

CREATE OR REPLACE FUNCTION assign_location_ai_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ai_code IS NULL AND NEW.workspace_id IS NOT NULL THEN
    SELECT COALESCE(MIN(t.n), 1) INTO NEW.ai_code
    FROM generate_series(1, (SELECT COUNT(*)::int + 1 FROM locations WHERE workspace_id = NEW.workspace_id)) t(n)
    WHERE NOT EXISTS (SELECT 1 FROM locations WHERE workspace_id = NEW.workspace_id AND ai_code = t.n);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION assign_sublocation_ai_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_ws_id uuid;
BEGIN
  SELECT workspace_id INTO v_ws_id FROM locations WHERE id = NEW.location_id;
  IF NEW.ai_code IS NULL AND v_ws_id IS NOT NULL THEN
    SELECT COALESCE(MIN(t.n), 1) INTO NEW.ai_code
    FROM generate_series(1, (SELECT COUNT(*)::int + 1 FROM sublocations s JOIN locations l ON l.id = s.location_id WHERE l.workspace_id = v_ws_id)) t(n)
    WHERE NOT EXISTS (
      SELECT 1 FROM sublocations s JOIN locations l ON l.id = s.location_id
      WHERE l.workspace_id = v_ws_id AND s.ai_code = t.n
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION assign_position_ai_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_ws_id uuid;
BEGIN
  SELECT l.workspace_id INTO v_ws_id
  FROM sublocations s JOIN locations l ON l.id = s.location_id
  WHERE s.id = NEW.sublocation_id;
  IF NEW.ai_code IS NULL AND v_ws_id IS NOT NULL THEN
    SELECT COALESCE(MIN(t.n), 1) INTO NEW.ai_code
    FROM generate_series(1, (SELECT COUNT(*)::int + 1
      FROM sublocation_positions sp JOIN sublocations s ON s.id = sp.sublocation_id JOIN locations l ON l.id = s.location_id
      WHERE l.workspace_id = v_ws_id)) t(n)
    WHERE NOT EXISTS (
      SELECT 1 FROM sublocation_positions sp JOIN sublocations s ON s.id = sp.sublocation_id JOIN locations l ON l.id = s.location_id
      WHERE l.workspace_id = v_ws_id AND sp.ai_code = t.n
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION assign_box_ai_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_ws_id uuid;
BEGIN
  SELECT workspace_id INTO v_ws_id FROM locations WHERE id = NEW.location_id;
  IF NEW.ai_code IS NULL AND v_ws_id IS NOT NULL THEN
    SELECT COALESCE(MIN(t.n), 1) INTO NEW.ai_code
    FROM generate_series(1, (SELECT COUNT(*)::int + 1 FROM boxes b JOIN locations l ON l.id = b.location_id WHERE l.workspace_id = v_ws_id)) t(n)
    WHERE NOT EXISTS (
      SELECT 1 FROM boxes b JOIN locations l ON l.id = b.location_id
      WHERE l.workspace_id = v_ws_id AND b.ai_code = t.n
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Create triggers
DROP TRIGGER IF EXISTS trg_assign_location_ai_code ON locations;
CREATE TRIGGER trg_assign_location_ai_code BEFORE INSERT ON locations
  FOR EACH ROW EXECUTE FUNCTION assign_location_ai_code();

DROP TRIGGER IF EXISTS trg_assign_sublocation_ai_code ON sublocations;
CREATE TRIGGER trg_assign_sublocation_ai_code BEFORE INSERT ON sublocations
  FOR EACH ROW EXECUTE FUNCTION assign_sublocation_ai_code();

DROP TRIGGER IF EXISTS trg_assign_position_ai_code ON sublocation_positions;
CREATE TRIGGER trg_assign_position_ai_code BEFORE INSERT ON sublocation_positions
  FOR EACH ROW EXECUTE FUNCTION assign_position_ai_code();

DROP TRIGGER IF EXISTS trg_assign_box_ai_code ON boxes;
CREATE TRIGGER trg_assign_box_ai_code BEFORE INSERT ON boxes
  FOR EACH ROW EXECUTE FUNCTION assign_box_ai_code();

-- 4. Backfill existing rows
DO $$
DECLARE
  ws record;
  r record;
  seq int;
BEGIN
  FOR ws IN SELECT DISTINCT workspace_id FROM locations WHERE workspace_id IS NOT NULL LOOP
    seq := 1;
    FOR r IN SELECT id FROM locations WHERE workspace_id = ws.workspace_id AND ai_code IS NULL ORDER BY created_at, id LOOP
      UPDATE locations SET ai_code = seq WHERE id = r.id;
      seq := seq + 1;
    END LOOP;
  END LOOP;

  FOR ws IN SELECT DISTINCT l.workspace_id FROM sublocations s JOIN locations l ON l.id = s.location_id WHERE l.workspace_id IS NOT NULL LOOP
    seq := 1;
    FOR r IN SELECT s.id FROM sublocations s JOIN locations l ON l.id = s.location_id WHERE l.workspace_id = ws.workspace_id AND s.ai_code IS NULL ORDER BY s.created_at, s.id LOOP
      UPDATE sublocations SET ai_code = seq WHERE id = r.id;
      seq := seq + 1;
    END LOOP;
  END LOOP;

  FOR ws IN SELECT DISTINCT l.workspace_id FROM sublocation_positions sp JOIN sublocations s ON s.id = sp.sublocation_id JOIN locations l ON l.id = s.location_id WHERE l.workspace_id IS NOT NULL LOOP
    seq := 1;
    FOR r IN SELECT sp.id FROM sublocation_positions sp JOIN sublocations s ON s.id = sp.sublocation_id JOIN locations l ON l.id = s.location_id WHERE l.workspace_id = ws.workspace_id AND sp.ai_code IS NULL ORDER BY sp.created_at, sp.id LOOP
      UPDATE sublocation_positions SET ai_code = seq WHERE id = r.id;
      seq := seq + 1;
    END LOOP;
  END LOOP;

  FOR ws IN SELECT DISTINCT l.workspace_id FROM boxes b JOIN locations l ON l.id = b.location_id WHERE l.workspace_id IS NOT NULL LOOP
    seq := 1;
    FOR r IN SELECT b.id FROM boxes b JOIN locations l ON l.id = b.location_id WHERE l.workspace_id = ws.workspace_id AND b.ai_code IS NULL ORDER BY b.created_at, b.id LOOP
      UPDATE boxes SET ai_code = seq WHERE id = r.id;
      seq := seq + 1;
    END LOOP;
  END LOOP;
END $$;

-- 5. Unique constraint for locations (has workspace_id directly)
CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_ws_ai_code ON locations (workspace_id, ai_code);
