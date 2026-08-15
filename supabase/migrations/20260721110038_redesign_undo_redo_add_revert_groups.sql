/*
# Redesign undo/redo system: add is_undone, redo_cell_data, and revert_groups table

## Summary
Fundamental redesign of the undo/redo/revert system. Instead of creating new history
rows for undo/redo/revert operations, the system now marks existing rows in-place:
- Undo toggles `is_undone` on an entry (displayed as strikethrough)
- Revert groups entries under a `revert_groups` record (displayed as collapsed row)
- Redo reverses an undo by clearing `is_undone`

## 1. Modified Tables
- `box_history`
  - Added `is_undone` (boolean, DEFAULT false) - Whether this entry has been undone
  - Added `redo_cell_data` (jsonb, nullable) - Stores cell state at undo time for redo

## 2. New Tables
- `revert_groups`
  - `id` (uuid, PK) - Unique identifier for the revert group
  - `box_id` (uuid, NOT NULL, FK to boxes) - Which box this revert belongs to
  - `parent_group_id` (uuid, nullable, self-FK) - For nested reverts
  - `team_member_id` (uuid, nullable, FK to team_members) - Who performed the revert
  - `created_at` (timestamptz, DEFAULT now()) - When the revert was performed

## 3. Security
- RLS enabled on `revert_groups`
- SELECT/INSERT/UPDATE/DELETE policies scoped to workspace members

## 4. Indexes
- idx_revert_groups_box_id, idx_revert_groups_parent_group_id, idx_box_history_is_undone

## 5. Important Notes
- `batch_id` on box_history now references revert_groups.id
- 'undo'/'revert'/'redo' action_type values kept for backward compat but no longer created
- UPDATE policy added to box_history for in-place undo marking
*/

-- Add is_undone column to box_history
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'box_history' AND column_name = 'is_undone'
  ) THEN
    ALTER TABLE box_history ADD COLUMN is_undone boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add redo_cell_data column to box_history
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'box_history' AND column_name = 'redo_cell_data'
  ) THEN
    ALTER TABLE box_history ADD COLUMN redo_cell_data jsonb DEFAULT NULL;
  END IF;
END $$;

-- Create revert_groups table
CREATE TABLE IF NOT EXISTS revert_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  parent_group_id uuid REFERENCES revert_groups(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE revert_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for revert_groups
DROP POLICY IF EXISTS "Workspace members can read revert_groups" ON revert_groups;
CREATE POLICY "Workspace members can read revert_groups" ON revert_groups
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM boxes fb
    JOIN locations f ON f.id = fb.location_id
    WHERE fb.id = revert_groups.box_id
    AND f.workspace_id = get_user_workspace_id()
  ));

DROP POLICY IF EXISTS "Workspace members can insert revert_groups" ON revert_groups;
CREATE POLICY "Workspace members can insert revert_groups" ON revert_groups
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM boxes fb
    JOIN locations f ON f.id = fb.location_id
    WHERE fb.id = revert_groups.box_id
    AND f.workspace_id = get_user_workspace_id()
  ));

DROP POLICY IF EXISTS "Workspace members can update revert_groups" ON revert_groups;
CREATE POLICY "Workspace members can update revert_groups" ON revert_groups
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM boxes fb
    JOIN locations f ON f.id = fb.location_id
    WHERE fb.id = revert_groups.box_id
    AND f.workspace_id = get_user_workspace_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM boxes fb
    JOIN locations f ON f.id = fb.location_id
    WHERE fb.id = revert_groups.box_id
    AND f.workspace_id = get_user_workspace_id()
  ));

DROP POLICY IF EXISTS "Workspace members can delete revert_groups" ON revert_groups;
CREATE POLICY "Workspace members can delete revert_groups" ON revert_groups
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM boxes fb
    JOIN locations f ON f.id = fb.location_id
    WHERE fb.id = revert_groups.box_id
    AND f.workspace_id = get_user_workspace_id()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_revert_groups_box_id ON revert_groups(box_id);
CREATE INDEX IF NOT EXISTS idx_revert_groups_parent_group_id ON revert_groups(parent_group_id) WHERE parent_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_box_history_is_undone ON box_history(box_id, is_undone);

-- Add UPDATE policy for box_history (needed for in-place undo marking)
DROP POLICY IF EXISTS "Workspace members can update box_history" ON box_history;
CREATE POLICY "Workspace members can update box_history" ON box_history
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM boxes fb
    JOIN locations f ON f.id = fb.location_id
    WHERE fb.id = box_history.box_id
    AND f.workspace_id = get_user_workspace_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM boxes fb
    JOIN locations f ON f.id = fb.location_id
    WHERE fb.id = box_history.box_id
    AND f.workspace_id = get_user_workspace_id()
  ));
