/*
# Add undo/redo support to box_history

1. Modified Tables
   - `box_history`
     - Added `previous_cell_data` (jsonb, nullable) — stores a map of cell_id -> full cell state BEFORE the action was performed, enabling undo/revert functionality.
     - Updated `action_type` check constraint to include 'undo' as a valid action type.

2. Important Notes
   - Existing history rows will have NULL `previous_cell_data` and will be treated as non-revertible in the UI.
   - The 'undo' action type is logged when a user reverts a previous action, maintaining audit trail integrity.
   - No data is deleted or modified — this is purely additive.
*/

-- Add the previous_cell_data column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'box_history'
      AND column_name = 'previous_cell_data'
  ) THEN
    ALTER TABLE box_history ADD COLUMN previous_cell_data jsonb;
  END IF;
END $$;

-- Update the action_type check constraint to include 'undo'
ALTER TABLE box_history DROP CONSTRAINT IF EXISTS box_history_action_type_check;
ALTER TABLE box_history ADD CONSTRAINT box_history_action_type_check
  CHECK (action_type = ANY (ARRAY['edit'::text, 'cross'::text, 'clear'::text, 'cut'::text, 'copy'::text, 'move'::text, 'swap'::text, 'undo'::text]));
