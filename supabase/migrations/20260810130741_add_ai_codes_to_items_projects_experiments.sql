/*
# Add AI short codes to inventory_items, projects, and experiments

1. New Columns
   - `inventory_items.ai_code` (integer) - auto-assigned per workspace, prefix "I"
   - `projects.ai_code` (integer) - auto-assigned per workspace, prefix "PR"
   - `experiments.ai_code` (integer) - auto-assigned per project, prefix "EX"

2. Triggers
   - Auto-assign lowest unused integer on INSERT for each table
   - Scoped per workspace (items, projects) or per project (experiments)

3. Backfill
   - Sequential codes assigned to all existing rows

4. Purpose
   - Removes the need to expose UUIDs to the AI assistant
   - All AI tool results use short codes instead of UUIDs
*/

-- inventory_items: ai_code scoped per workspace (via location)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='ai_code') THEN
    ALTER TABLE inventory_items ADD COLUMN ai_code integer;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_ai_code_workspace
  ON inventory_items (ai_code, location_id);

CREATE OR REPLACE FUNCTION assign_inventory_item_ai_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE v_ws_id uuid;
BEGIN
  SELECT workspace_id INTO v_ws_id FROM locations WHERE id = NEW.location_id;
  SELECT COALESCE(
    (SELECT s.n FROM generate_series(1, COALESCE(max(ii.ai_code),0)+1) s(n)
     LEFT JOIN inventory_items ii ON ii.ai_code = s.n
       AND ii.location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id)
     WHERE ii.ai_code IS NULL ORDER BY s.n LIMIT 1),
    1
  ) INTO NEW.ai_code
  FROM inventory_items ii
  WHERE ii.location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id);
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_assign_inventory_item_ai_code ON inventory_items;
CREATE TRIGGER trg_assign_inventory_item_ai_code
  BEFORE INSERT ON inventory_items
  FOR EACH ROW WHEN (NEW.ai_code IS NULL)
  EXECUTE FUNCTION assign_inventory_item_ai_code();

-- projects: ai_code scoped per workspace
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='ai_code') THEN
    ALTER TABLE projects ADD COLUMN ai_code integer;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_ai_code_workspace
  ON projects (ai_code, workspace_id);

CREATE OR REPLACE FUNCTION assign_project_ai_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  SELECT COALESCE(
    (SELECT s.n FROM generate_series(1, COALESCE(max(p.ai_code),0)+1) s(n)
     LEFT JOIN projects p ON p.ai_code = s.n AND p.workspace_id = NEW.workspace_id
     WHERE p.ai_code IS NULL ORDER BY s.n LIMIT 1),
    1
  ) INTO NEW.ai_code
  FROM projects p WHERE p.workspace_id = NEW.workspace_id;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_assign_project_ai_code ON projects;
CREATE TRIGGER trg_assign_project_ai_code
  BEFORE INSERT ON projects
  FOR EACH ROW WHEN (NEW.ai_code IS NULL)
  EXECUTE FUNCTION assign_project_ai_code();

-- experiments: ai_code scoped per project
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='experiments' AND column_name='ai_code') THEN
    ALTER TABLE experiments ADD COLUMN ai_code integer;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_experiments_ai_code_project
  ON experiments (ai_code, project_id);

CREATE OR REPLACE FUNCTION assign_experiment_ai_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  SELECT COALESCE(
    (SELECT s.n FROM generate_series(1, COALESCE(max(e.ai_code),0)+1) s(n)
     LEFT JOIN experiments e ON e.ai_code = s.n AND e.project_id = NEW.project_id
     WHERE e.ai_code IS NULL ORDER BY s.n LIMIT 1),
    1
  ) INTO NEW.ai_code
  FROM experiments e WHERE e.project_id = NEW.project_id;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_assign_experiment_ai_code ON experiments;
CREATE TRIGGER trg_assign_experiment_ai_code
  BEFORE INSERT ON experiments
  FOR EACH ROW WHEN (NEW.ai_code IS NULL)
  EXECUTE FUNCTION assign_experiment_ai_code();

-- Backfill inventory_items
WITH ws_items AS (
  SELECT ii.id, l.workspace_id,
    ROW_NUMBER() OVER (PARTITION BY l.workspace_id ORDER BY ii.created_at, ii.id) AS rn
  FROM inventory_items ii JOIN locations l ON l.id = ii.location_id
  WHERE ii.ai_code IS NULL
)
UPDATE inventory_items SET ai_code = ws_items.rn FROM ws_items WHERE inventory_items.id = ws_items.id;

-- Backfill projects
WITH ws_projects AS (
  SELECT p.id, p.workspace_id,
    ROW_NUMBER() OVER (PARTITION BY p.workspace_id ORDER BY p.created_at, p.id) AS rn
  FROM projects p WHERE p.ai_code IS NULL
)
UPDATE projects SET ai_code = ws_projects.rn FROM ws_projects WHERE projects.id = ws_projects.id;

-- Backfill experiments
WITH proj_exps AS (
  SELECT e.id, e.project_id,
    ROW_NUMBER() OVER (PARTITION BY e.project_id ORDER BY e.display_order, e.created_at, e.id) AS rn
  FROM experiments e WHERE e.ai_code IS NULL
)
UPDATE experiments SET ai_code = proj_exps.rn FROM proj_exps WHERE experiments.id = proj_exps.id;
