/*
# Create Expiration Subscription and Notification Preferences Tables

1. New Tables
   - `expiration_subscriptions`
     - `id` (uuid, primary key)
     - `team_member_id` (uuid, FK to team_members.id, not null)
     - `workspace_id` (uuid, not null)
     - `item_name` (text, not null) - display name of the subscribed item
     - `source` (text, not null) - 'cell', 'slide', or 'item'
     - `source_id` (text, not null) - the unique record identifier (e.g. 'cell-<uuid>')
     - `expiration_date` (date, not null) - the item's expiration date
     - `location_name` (text) - for display in the subscriptions panel
     - `box_name` (text) - for display context
     - `last_alert_sent_at` (timestamptz) - tracks when last proximity alert was sent
     - `created_at` (timestamptz)

   - `expiration_notification_preferences`
     - `id` (uuid, primary key)
     - `team_member_id` (uuid, FK to team_members.id, unique, not null)
     - `workspace_id` (uuid, not null)
     - `digest_enabled` (boolean, default false)
     - `digest_frequency` (text, default 'weekly') - 'weekly' or 'monthly'
     - `digest_last_sent_at` (timestamptz) - when last digest was sent
     - `alert_enabled` (boolean, default false)
     - `alert_days_before` (integer, default 7) - start alerting n days before expiration
     - `alert_repeat_interval` (integer, default 1) - repeat every n units
     - `alert_repeat_unit` (text, default 'weeks') - 'days', 'weeks', or 'months'
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

2. Security
   - Enable RLS on both tables.
   - Policies scoped to authenticated users who own the row (via team_member_id matched to auth.uid() through team_members.auth_user_id).

3. Indexes
   - Unique index on (team_member_id, source_id) to prevent duplicate subscriptions.
   - Index on workspace_id for efficient querying.
*/

-- Expiration Subscriptions Table
CREATE TABLE IF NOT EXISTS expiration_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  item_name text NOT NULL,
  source text NOT NULL CHECK (source IN ('cell', 'slide', 'item')),
  source_id text NOT NULL,
  expiration_date date NOT NULL,
  location_name text,
  box_name text,
  last_alert_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expiration_subscriptions_unique
  ON expiration_subscriptions (team_member_id, source_id);

CREATE INDEX IF NOT EXISTS idx_expiration_subscriptions_workspace
  ON expiration_subscriptions (workspace_id);

ALTER TABLE expiration_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_expiration_subscriptions" ON expiration_subscriptions;
CREATE POLICY "select_own_expiration_subscriptions" ON expiration_subscriptions FOR SELECT
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_expiration_subscriptions" ON expiration_subscriptions;
CREATE POLICY "insert_own_expiration_subscriptions" ON expiration_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_expiration_subscriptions" ON expiration_subscriptions;
CREATE POLICY "update_own_expiration_subscriptions" ON expiration_subscriptions FOR UPDATE
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_expiration_subscriptions" ON expiration_subscriptions;
CREATE POLICY "delete_own_expiration_subscriptions" ON expiration_subscriptions FOR DELETE
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  );

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS expiration_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  digest_enabled boolean NOT NULL DEFAULT false,
  digest_frequency text NOT NULL DEFAULT 'weekly' CHECK (digest_frequency IN ('weekly', 'monthly')),
  digest_last_sent_at timestamptz,
  alert_enabled boolean NOT NULL DEFAULT false,
  alert_days_before integer NOT NULL DEFAULT 7,
  alert_repeat_interval integer NOT NULL DEFAULT 1,
  alert_repeat_unit text NOT NULL DEFAULT 'weeks' CHECK (alert_repeat_unit IN ('days', 'weeks', 'months')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (team_member_id)
);

ALTER TABLE expiration_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notification_prefs" ON expiration_notification_preferences;
CREATE POLICY "select_own_notification_prefs" ON expiration_notification_preferences FOR SELECT
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_notification_prefs" ON expiration_notification_preferences;
CREATE POLICY "insert_own_notification_prefs" ON expiration_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_notification_prefs" ON expiration_notification_preferences;
CREATE POLICY "update_own_notification_prefs" ON expiration_notification_preferences FOR UPDATE
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_notification_prefs" ON expiration_notification_preferences;
CREATE POLICY "delete_own_notification_prefs" ON expiration_notification_preferences FOR DELETE
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE auth_user_id = auth.uid()
    )
  );
