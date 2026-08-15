-- Clean baseline migration
-- Generated 2026-07-17 from live database introspection.
-- This represents the complete final schema state.

-- ============================================================
-- 1. Extensions
-- ============================================================
-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions" VERSION "1.6.4";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions" VERSION "0.19.5";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions" VERSION "1.11";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public" VERSION "1.6";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions" VERSION "1.3";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault" VERSION "0.3.1";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions" VERSION "1.1";

-- ============================================================
-- 2. Tables
-- ============================================================
-- PostgreSQL/Supabase Database Schema
-- Complete table definitions for laboratory inventory management system
-- 28 tables in dependency order

CREATE TABLE workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  live_sync_enabled boolean NOT NULL DEFAULT true,
  auto_open_first_folder boolean NOT NULL DEFAULT false,
  auto_open_first_item_folder boolean NOT NULL DEFAULT true,
  colorful_icons_enabled boolean NOT NULL DEFAULT true,
  auto_expand_all_locations boolean NOT NULL DEFAULT true,
  hierarchical_navigation boolean NOT NULL DEFAULT true,
  rotate_wide_grid_mobile boolean NOT NULL DEFAULT false,
  CONSTRAINT workspaces_pkey PRIMARY KEY (id)
);

CREATE TABLE team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text,
  auth_user_id uuid,
  invited_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  workspace_id uuid,
  display_name text,
  CONSTRAINT team_members_pkey PRIMARY KEY (id),
  CONSTRAINT team_members_auth_user_id_unique UNIQUE (auth_user_id),
  CONSTRAINT team_members_email_key UNIQUE (email),
  CONSTRAINT team_members_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT team_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES team_members(id) ON DELETE SET NULL,
  CONSTRAINT team_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT team_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'member'::text])))
);

CREATE TABLE fridges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  accent_color text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  workspace_id uuid,
  show_storage_boxes boolean NOT NULL DEFAULT true,
  show_inventory_items boolean NOT NULL DEFAULT true,
  location_type text NOT NULL DEFAULT 'fridge'::text,
  icon_id text,
  CONSTRAINT fridges_pkey PRIMARY KEY (id),
  CONSTRAINT fridges_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fridges_at_least_one_section CHECK ((show_storage_boxes OR show_inventory_items))
);

CREATE TABLE projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  icon_id text,
  accent_color text DEFAULT '#3b82f6'::text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE fridge_sublocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fridge_id uuid NOT NULL,
  name text NOT NULL,
  accent_color text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  location_type text NOT NULL DEFAULT 'general'::text,
  icon_id text,
  CONSTRAINT fridge_sublocations_pkey PRIMARY KEY (id),
  CONSTRAINT fridge_sublocations_fridge_id_fkey FOREIGN KEY (fridge_id) REFERENCES fridges(id) ON DELETE CASCADE
);

CREATE TABLE sublocation_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sublocation_id uuid NOT NULL,
  name text NOT NULL,
  accent_color text,
  display_order integer DEFAULT 0,
  location_type text NOT NULL DEFAULT 'general'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  icon_id text,
  CONSTRAINT sublocation_positions_pkey PRIMARY KEY (id),
  CONSTRAINT sublocation_positions_sublocation_id_fkey FOREIGN KEY (sublocation_id) REFERENCES fridge_sublocations(id) ON DELETE CASCADE
);

CREATE TABLE fridge_boxes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT ''::text,
  accent_color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  rows integer NOT NULL DEFAULT 8,
  columns integer NOT NULL DEFAULT 12,
  fridge_id uuid,
  name_font_divisor integer DEFAULT 8,
  info_font_divisor integer DEFAULT 10,
  sublocation_id uuid,
  constrain_grid_height boolean NOT NULL DEFAULT true,
  box_type text NOT NULL DEFAULT 'freezer'::text,
  position_id uuid,
  slide_font_divisor integer DEFAULT 10,
  display_order integer DEFAULT 0,
  icon_id text,
  CONSTRAINT fridge_boxes_pkey PRIMARY KEY (id),
  CONSTRAINT fridge_boxes_fridge_id_fkey FOREIGN KEY (fridge_id) REFERENCES fridges(id) ON DELETE CASCADE,
  CONSTRAINT fridge_boxes_position_id_fkey FOREIGN KEY (position_id) REFERENCES sublocation_positions(id) ON DELETE CASCADE,
  CONSTRAINT fridge_boxes_sublocation_id_fkey FOREIGN KEY (sublocation_id) REFERENCES fridge_sublocations(id) ON DELETE CASCADE,
  CONSTRAINT fridge_boxes_box_type_check CHECK ((box_type = ANY (ARRAY['freezer'::text, 'slide'::text, 'structured_freezer'::text]))),
  CONSTRAINT fridge_boxes_columns_check CHECK (((columns >= 1) AND (columns <= 20))),
  CONSTRAINT fridge_boxes_info_font_divisor_check CHECK (((info_font_divisor >= 3) AND (info_font_divisor <= 20))),
  CONSTRAINT fridge_boxes_name_font_divisor_check CHECK (((name_font_divisor >= 3) AND (name_font_divisor <= 20))),
  CONSTRAINT fridge_boxes_rows_check CHECK (((rows >= 1) AND (((box_type = 'slide'::text) AND (rows <= 80)) OR ((box_type <> 'slide'::text) AND (rows <= 20))))),
  CONSTRAINT fridge_boxes_slide_font_divisor_check CHECK (((slide_font_divisor >= 3) AND (slide_font_divisor <= 20)))
);

CREATE TABLE item_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fridge_id uuid NOT NULL,
  sublocation_id uuid,
  position_id uuid,
  name text NOT NULL,
  description text DEFAULT ''::text,
  accent_color text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  icon_id text,
  CONSTRAINT item_folders_pkey PRIMARY KEY (id),
  CONSTRAINT item_folders_fridge_id_fkey FOREIGN KEY (fridge_id) REFERENCES fridges(id) ON DELETE CASCADE,
  CONSTRAINT item_folders_position_id_fkey FOREIGN KEY (position_id) REFERENCES sublocation_positions(id) ON DELETE SET NULL,
  CONSTRAINT item_folders_sublocation_id_fkey FOREIGN KEY (sublocation_id) REFERENCES fridge_sublocations(id) ON DELETE SET NULL
);

CREATE TABLE item_folder_headers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL,
  header_text text NOT NULL DEFAULT ''::text,
  header_type text NOT NULL DEFAULT 'text'::text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT item_folder_headers_pkey PRIMARY KEY (id),
  CONSTRAINT item_folder_headers_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES item_folders(id) ON DELETE CASCADE,
  CONSTRAINT item_folder_headers_header_type_check CHECK ((header_type = ANY (ARRAY['text'::text, 'date'::text, 'expiration'::text])))
);

CREATE TABLE inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT ''::text,
  stock_number integer DEFAULT 0,
  item_type text NOT NULL,
  accent_color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  fridge_id uuid,
  sublocation_id uuid,
  non_counted boolean NOT NULL DEFAULT false,
  unit text NOT NULL DEFAULT ''::text,
  position_id uuid,
  display_order integer DEFAULT 0,
  folder_id uuid NOT NULL,
  icon_id text,
  stock_threshold integer,
  freeze_thaw_cycles integer NOT NULL DEFAULT 0,
  display_mode text NOT NULL DEFAULT 'stock'::text,
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_items_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES item_folders(id) ON DELETE CASCADE,
  CONSTRAINT inventory_items_fridge_id_fkey FOREIGN KEY (fridge_id) REFERENCES fridges(id) ON DELETE CASCADE,
  CONSTRAINT inventory_items_position_id_fkey FOREIGN KEY (position_id) REFERENCES sublocation_positions(id) ON DELETE CASCADE,
  CONSTRAINT inventory_items_sublocation_id_fkey FOREIGN KEY (sublocation_id) REFERENCES fridge_sublocations(id) ON DELETE CASCADE,
  CONSTRAINT inventory_items_display_mode_check CHECK ((display_mode = ANY (ARRAY['stock'::text, 'freeze_thaw'::text]))),
  CONSTRAINT inventory_items_freeze_thaw_cycles_check CHECK ((freeze_thaw_cycles >= 0)),
  CONSTRAINT inventory_items_item_type_check CHECK ((item_type = ANY (ARRAY['Antibody'::text, 'Cell'::text, 'Medium'::text, 'Kits'::text, 'Chemicals'::text]))),
  CONSTRAINT inventory_items_stock_number_check CHECK ((stock_number >= 0)),
  CONSTRAINT inventory_items_stock_threshold_check CHECK (((stock_threshold IS NULL) OR (stock_threshold >= 0)))
);

CREATE TABLE fridge_cells (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cell_id text NOT NULL,
  name text NOT NULL,
  information text DEFAULT ''::text,
  date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  color text,
  box_id uuid,
  is_crossed boolean NOT NULL DEFAULT false,
  date_type text NOT NULL DEFAULT 'date'::text,
  slide_image_url text,
  CONSTRAINT fridge_cells_pkey PRIMARY KEY (id),
  CONSTRAINT fridge_cells_box_id_cell_id_key UNIQUE (box_id, cell_id),
  CONSTRAINT fridge_cells_box_id_fkey FOREIGN KEY (box_id) REFERENCES fridge_boxes(id) ON DELETE CASCADE,
  CONSTRAINT fridge_cells_date_type_check CHECK ((date_type = ANY (ARRAY['date'::text, 'expiration'::text, 'none'::text])))
);

CREATE TABLE box_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL,
  team_member_id uuid,
  action_type text NOT NULL,
  affected_cells text[] NOT NULL,
  cell_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  source_cells text[],
  target_cells text[],
  related_box_id uuid,
  related_box_name text,
  CONSTRAINT box_history_pkey PRIMARY KEY (id),
  CONSTRAINT box_history_box_id_fkey FOREIGN KEY (box_id) REFERENCES fridge_boxes(id) ON DELETE CASCADE,
  CONSTRAINT box_history_related_box_id_fkey FOREIGN KEY (related_box_id) REFERENCES fridge_boxes(id) ON DELETE SET NULL,
  CONSTRAINT box_history_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL,
  CONSTRAINT box_history_action_type_check CHECK ((action_type = ANY (ARRAY['edit'::text, 'cross'::text, 'clear'::text, 'cut'::text, 'copy'::text, 'move'::text, 'swap'::text])))
);

CREATE TABLE slide_box_headers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL,
  header_text text NOT NULL DEFAULT ''::text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  header_type text NOT NULL DEFAULT 'text'::text,
  CONSTRAINT slide_box_headers_pkey PRIMARY KEY (id),
  CONSTRAINT slide_box_headers_box_id_fkey FOREIGN KEY (box_id) REFERENCES fridge_boxes(id) ON DELETE CASCADE,
  CONSTRAINT slide_box_headers_header_type_check CHECK ((header_type = ANY (ARRAY['text'::text, 'date'::text, 'expiration'::text])))
);

CREATE TABLE slide_cell_values (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cell_id uuid NOT NULL,
  header_id uuid NOT NULL,
  value text NOT NULL DEFAULT ''::text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT slide_cell_values_pkey PRIMARY KEY (id),
  CONSTRAINT slide_cell_values_cell_id_header_id_key UNIQUE (cell_id, header_id),
  CONSTRAINT slide_cell_values_cell_id_fkey FOREIGN KEY (cell_id) REFERENCES fridge_cells(id) ON DELETE CASCADE,
  CONSTRAINT slide_cell_values_header_id_fkey FOREIGN KEY (header_id) REFERENCES slide_box_headers(id) ON DELETE CASCADE
);

CREATE TABLE saved_search_filters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  team_member_id uuid NOT NULL,
  filter_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT saved_search_filters_pkey PRIMARY KEY (id),
  CONSTRAINT unique_workspace_member_filter UNIQUE (workspace_id, team_member_id, filter_text),
  CONSTRAINT saved_search_filters_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
  CONSTRAINT saved_search_filters_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT saved_search_filters_filter_text_check CHECK ((filter_text <> ''::text))
);

CREATE TABLE ai_tool_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  team_member_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  tool_name text NOT NULL,
  arguments jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL,
  result_count integer DEFAULT 0,
  truncated boolean NOT NULL DEFAULT false,
  duration_ms integer DEFAULT 0,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_tool_audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT ai_tool_audit_log_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
  CONSTRAINT ai_tool_audit_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT ai_tool_audit_log_status_check CHECK ((status = ANY (ARRAY['success'::text, 'error'::text])))
);

CREATE TABLE box_access_list (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL,
  team_member_id uuid NOT NULL,
  access_level text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT box_access_list_pkey PRIMARY KEY (id),
  CONSTRAINT box_access_list_box_id_team_member_id_key UNIQUE (box_id, team_member_id),
  CONSTRAINT box_access_list_box_id_fkey FOREIGN KEY (box_id) REFERENCES fridge_boxes(id) ON DELETE CASCADE,
  CONSTRAINT box_access_list_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
  CONSTRAINT box_access_list_access_level_check CHECK ((access_level = ANY (ARRAY['edit'::text, 'view'::text])))
);

CREATE TABLE box_grid_item_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL,
  item_id uuid NOT NULL,
  link_type text NOT NULL,
  linked_name text NOT NULL,
  linked_info text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT box_grid_item_links_pkey PRIMARY KEY (id),
  CONSTRAINT uq_box_item UNIQUE (box_id, item_id),
  CONSTRAINT uq_box_reagent UNIQUE (box_id, linked_name, linked_info),
  CONSTRAINT box_grid_item_links_box_id_fkey FOREIGN KEY (box_id) REFERENCES fridge_boxes(id) ON DELETE CASCADE,
  CONSTRAINT box_grid_item_links_item_id_fkey FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT box_grid_item_links_link_type_check CHECK ((link_type = ANY (ARRAY['name'::text, 'name_info'::text, 'info'::text])))
);

CREATE TABLE box_privacy_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL,
  privacy_mode text NOT NULL DEFAULT 'open'::text,
  owner_id uuid NOT NULL,
  owner_only_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT box_privacy_settings_pkey PRIMARY KEY (id),
  CONSTRAINT box_privacy_settings_box_id_key UNIQUE (box_id),
  CONSTRAINT box_privacy_settings_box_id_fkey FOREIGN KEY (box_id) REFERENCES fridge_boxes(id) ON DELETE CASCADE,
  CONSTRAINT box_privacy_settings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES team_members(id),
  CONSTRAINT box_privacy_settings_privacy_mode_check CHECK ((privacy_mode = ANY (ARRAY['open'::text, 'restricted'::text])))
);

CREATE TABLE box_qr_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  token text NOT NULL,
  label text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT box_qr_codes_pkey PRIMARY KEY (id),
  CONSTRAINT box_qr_codes_box_id_key UNIQUE (box_id),
  CONSTRAINT box_qr_codes_token_key UNIQUE (token),
  CONSTRAINT box_qr_codes_box_id_fkey FOREIGN KEY (box_id) REFERENCES fridge_boxes(id) ON DELETE CASCADE,
  CONSTRAINT box_qr_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES team_members(id),
  CONSTRAINT box_qr_codes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE item_custom_values (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  header_id uuid NOT NULL,
  value text NOT NULL DEFAULT ''::text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT item_custom_values_pkey PRIMARY KEY (id),
  CONSTRAINT item_custom_values_item_id_header_id_key UNIQUE (item_id, header_id),
  CONSTRAINT item_custom_values_header_id_fkey FOREIGN KEY (header_id) REFERENCES item_folder_headers(id) ON DELETE CASCADE,
  CONSTRAINT item_custom_values_item_id_fkey FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

CREATE TABLE experiments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  icon_id text,
  accent_color text DEFAULT '#3b82f6'::text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT experiments_pkey PRIMARY KEY (id),
  CONSTRAINT experiments_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE project_access_list (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  team_member_id uuid NOT NULL,
  access_level text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT project_access_list_pkey PRIMARY KEY (id),
  CONSTRAINT project_access_list_project_id_team_member_id_key UNIQUE (project_id, team_member_id),
  CONSTRAINT project_access_list_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT project_access_list_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
  CONSTRAINT project_access_list_access_level_check CHECK ((access_level = ANY (ARRAY['edit'::text, 'view'::text])))
);

CREATE TABLE project_box_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  experiment_id uuid,
  box_id uuid NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT project_box_links_pkey PRIMARY KEY (id),
  CONSTRAINT project_box_links_box_id_fkey FOREIGN KEY (box_id) REFERENCES fridge_boxes(id) ON DELETE CASCADE,
  CONSTRAINT project_box_links_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
  CONSTRAINT project_box_links_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE project_item_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  experiment_id uuid,
  item_id uuid NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT project_item_links_pkey PRIMARY KEY (id),
  CONSTRAINT project_item_links_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
  CONSTRAINT project_item_links_item_id_fkey FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT project_item_links_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE project_privacy_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  privacy_mode text NOT NULL DEFAULT 'open'::text,
  owner_id uuid NOT NULL,
  owner_only_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT project_privacy_settings_pkey PRIMARY KEY (id),
  CONSTRAINT project_privacy_settings_project_id_key UNIQUE (project_id),
  CONSTRAINT project_privacy_settings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES team_members(id),
  CONSTRAINT project_privacy_settings_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT project_privacy_settings_privacy_mode_check CHECK ((privacy_mode = ANY (ARRAY['open'::text, 'restricted'::text])))
);

CREATE TABLE workspace_backups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  created_by uuid NOT NULL,
  backup_data jsonb NOT NULL,
  backup_date date NOT NULL DEFAULT CURRENT_DATE,
  file_size_bytes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  backup_type text NOT NULL DEFAULT 'auto'::text,
  label text,
  CONSTRAINT workspace_backups_pkey PRIMARY KEY (id),
  CONSTRAINT workspace_backups_created_by_fkey FOREIGN KEY (created_by) REFERENCES team_members(id),
  CONSTRAINT workspace_backups_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  CONSTRAINT workspace_backups_type_check CHECK ((backup_type = ANY (ARRAY['auto'::text, 'manual'::text])))
);

CREATE TABLE _icon_reorder_applied (
  marker text NOT NULL,
  applied_at timestamptz DEFAULT now(),
  CONSTRAINT _icon_reorder_applied_pkey PRIMARY KEY (marker)
);

-- ============================================================
-- 3. Indexes
-- ============================================================
-- Indexes (non-primary key, non-unique constraint indexes)
CREATE INDEX idx_ai_tool_audit_log_member_created ON ai_tool_audit_log USING btree (team_member_id, created_at DESC);
CREATE INDEX idx_ai_tool_audit_log_workspace_created ON ai_tool_audit_log USING btree (workspace_id, created_at DESC);

CREATE INDEX idx_box_grid_item_links_box_id ON box_grid_item_links USING btree (box_id);
CREATE INDEX idx_box_grid_item_links_item_id ON box_grid_item_links USING btree (item_id);

CREATE INDEX idx_box_history_box_created ON box_history USING btree (box_id, created_at DESC);
CREATE INDEX idx_box_history_created_at ON box_history USING btree (created_at);
CREATE INDEX idx_box_history_related_box ON box_history USING btree (related_box_id) WHERE (related_box_id IS NOT NULL);

CREATE INDEX idx_box_qr_codes_token ON box_qr_codes USING btree (token);

CREATE INDEX idx_fridge_boxes_created_at ON fridge_boxes USING btree (created_at);
CREATE INDEX idx_fridge_boxes_display_order ON fridge_boxes USING btree (fridge_id, display_order);
CREATE INDEX idx_fridge_boxes_fridge_id ON fridge_boxes USING btree (fridge_id);
CREATE INDEX idx_fridge_boxes_name_trgm ON fridge_boxes USING gin (name gin_trgm_ops);
CREATE INDEX idx_fridge_boxes_sublocation_id ON fridge_boxes USING btree (sublocation_id);

CREATE INDEX idx_fridge_cells_box_id ON fridge_cells USING btree (box_id);
CREATE INDEX idx_fridge_cells_cell_id ON fridge_cells USING btree (cell_id);
CREATE INDEX idx_fridge_cells_created_at ON fridge_cells USING btree (created_at);
CREATE INDEX idx_fridge_cells_information_trgm ON fridge_cells USING gin (information gin_trgm_ops);
CREATE INDEX idx_fridge_cells_is_crossed ON fridge_cells USING btree (is_crossed);
CREATE INDEX idx_fridge_cells_name_trgm ON fridge_cells USING gin (name gin_trgm_ops);

CREATE INDEX idx_fridge_sublocations_display_order ON fridge_sublocations USING btree (fridge_id, display_order);
CREATE INDEX idx_fridge_sublocations_fridge_id ON fridge_sublocations USING btree (fridge_id);

CREATE INDEX idx_fridges_created_at ON fridges USING btree (created_at);
CREATE INDEX idx_fridges_display_order ON fridges USING btree (display_order);
CREATE INDEX idx_fridges_workspace_id ON fridges USING btree (workspace_id);

CREATE INDEX idx_inventory_items_display_order ON inventory_items USING btree (fridge_id, display_order);
CREATE INDEX idx_inventory_items_fridge_id ON inventory_items USING btree (fridge_id);
CREATE INDEX idx_inventory_items_name_trgm ON inventory_items USING gin (name gin_trgm_ops);
CREATE INDEX idx_inventory_items_sublocation_id ON inventory_items USING btree (sublocation_id);

CREATE INDEX idx_saved_search_filters_workspace_member ON saved_search_filters USING btree (workspace_id, team_member_id);

CREATE INDEX idx_slide_box_headers_header_text_trgm ON slide_box_headers USING gin (header_text gin_trgm_ops);

CREATE INDEX idx_slide_cell_values_cell_id ON slide_cell_values USING btree (cell_id);
CREATE INDEX idx_slide_cell_values_header_id ON slide_cell_values USING btree (header_id);
CREATE INDEX idx_slide_cell_values_value_trgm ON slide_cell_values USING gin (value gin_trgm_ops);

CREATE INDEX idx_team_members_auth_user_id ON team_members USING btree (auth_user_id);
CREATE INDEX idx_team_members_email ON team_members USING btree (email);
CREATE INDEX idx_team_members_role ON team_members USING btree (role);
CREATE INDEX idx_team_members_workspace_id ON team_members USING btree (workspace_id);

CREATE UNIQUE INDEX workspace_backups_auto_unique_date ON workspace_backups USING btree (workspace_id, backup_date) WHERE (backup_type = 'auto'::text);

CREATE INDEX idx_workspaces_owner_id ON workspaces USING btree (owner_id);

-- ============================================================
-- 4. Functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.adjust_freeze_thaw_cycles(p_item_id uuid, p_delta integer)
 RETURNS inventory_items
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
result inventory_items;
BEGIN
UPDATE inventory_items
SET freeze_thaw_cycles = GREATEST(0, freeze_thaw_cycles + p_delta),
updated_at = now()
WHERE id = p_item_id
RETURNING * INTO result;
RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_stock(p_item_id uuid, p_delta integer)
 RETURNS inventory_items
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
result inventory_items;
BEGIN
UPDATE inventory_items
SET stock_number = GREATEST(0, stock_number + p_delta),
updated_at = now()
WHERE id = p_item_id
RETURNING * INTO result;

IF NOT FOUND THEN
RAISE EXCEPTION 'Item not found: %', p_item_id;
END IF;

RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_get_inventory_activity(p_team_member_id uuid, p_date_from timestamp with time zone DEFAULT (now() - '7 days'::interval), p_date_to timestamp with time zone DEFAULT now(), p_location_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_groups jsonb;
v_recent jsonb;
v_total integer;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member');
END IF;

-- Group by action type
SELECT COALESCE(jsonb_agg(jsonb_build_object('action_type', action_type, 'count', cnt)), '[]'::jsonb)
INTO v_groups
FROM (
SELECT bh.action_type, COUNT(*)::integer AS cnt
FROM box_history bh
JOIN fridge_boxes fb ON fb.id = bh.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id
AND bh.created_at >= p_date_from AND bh.created_at <= p_date_to
AND (p_location_id IS NULL OR f.id = p_location_id)
GROUP BY bh.action_type
ORDER BY cnt DESC
) sub;

-- Total event count
SELECT COUNT(*)::integer INTO v_total
FROM box_history bh
JOIN fridge_boxes fb ON fb.id = bh.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id
AND bh.created_at >= p_date_from AND bh.created_at <= p_date_to
AND (p_location_id IS NULL OR f.id = p_location_id);

-- Recent events
SELECT COALESCE(jsonb_agg(evt ORDER BY evt->>'occurred_at' DESC), '[]'::jsonb)
INTO v_recent
FROM (
SELECT jsonb_build_object(
'id', bh.id,
'action_type', bh.action_type,
'occurred_at', bh.created_at,
'box_name', fb.name,
'affected_cells_count', COALESCE(array_length(bh.affected_cells, 1), 0),
'team_member_name', tm.display_name,
'location_breadcrumb', (ai_get_location_breadcrumb(fb.fridge_id, fb.sublocation_id, fb.position_id))->>'breadcrumb'
) AS evt
FROM box_history bh
JOIN fridge_boxes fb ON fb.id = bh.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN team_members tm ON tm.id = bh.team_member_id
WHERE f.workspace_id = v_ws_id
AND bh.created_at >= p_date_from AND bh.created_at <= p_date_to
AND (p_location_id IS NULL OR f.id = p_location_id)
ORDER BY bh.created_at DESC
LIMIT p_limit
) sub;

RETURN jsonb_build_object(
'ok', true,
'date_from', p_date_from,
'date_to', p_date_to,
'total_events', v_total,
'groups', v_groups,
'recent_events', v_recent,
'truncated', v_total > p_limit
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_get_inventory_risk_summary(p_team_member_id uuid, p_expiration_window_days integer DEFAULT 30, p_activity_window_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_expired integer;
v_expiring_soon integer;
v_low_stock integer;
v_out_of_stock integer;
v_missing_exp integer;
v_active_members integer;
v_pending integer;
v_activity_count integer;
v_cutoff date;
v_nearest jsonb;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member');
END IF;

v_cutoff := CURRENT_DATE + (p_expiration_window_days || ' days')::interval;

SELECT COUNT(*)::integer INTO v_expired
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id
AND fc.date_type = 'expiration' AND fc.date IS NOT NULL
AND fc.is_crossed = false AND fc.date < CURRENT_DATE;

SELECT COUNT(*)::integer INTO v_expiring_soon
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id
AND fc.date_type = 'expiration' AND fc.date IS NOT NULL
AND fc.is_crossed = false AND fc.date >= CURRENT_DATE AND fc.date <= v_cutoff;

SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
INTO v_nearest
FROM (
SELECT jsonb_build_object(
'id', fc.id,
'name', fc.name,
'expiration_date', fc.date::text,
'days_until', fc.date - CURRENT_DATE,
'box_name', fb.name,
'location_breadcrumb', (ai_get_location_breadcrumb(fb.fridge_id, fb.sublocation_id, fb.position_id))->>'breadcrumb'
) AS item
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id
AND fc.date_type = 'expiration' AND fc.date IS NOT NULL
AND fc.is_crossed = false AND fc.date >= CURRENT_DATE AND fc.date <= v_cutoff
ORDER BY fc.date ASC
LIMIT 5
) sub;

SELECT COUNT(*)::integer INTO v_low_stock
FROM inventory_items ii JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = v_ws_id AND ii.non_counted = false
AND ii.stock_threshold IS NOT NULL AND ii.stock_number <= ii.stock_threshold AND ii.stock_number > 0;

SELECT COUNT(*)::integer INTO v_out_of_stock
FROM inventory_items ii JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = v_ws_id AND ii.non_counted = false
AND ii.stock_threshold IS NOT NULL AND ii.stock_number <= 0;

SELECT COUNT(*)::integer INTO v_missing_exp
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id AND fc.is_crossed = false
AND fc.name != ''
AND (fc.date_type = 'none' OR fc.date IS NULL);

SELECT COUNT(*)::integer INTO v_active_members
FROM team_members WHERE workspace_id = v_ws_id AND role IS NOT NULL;

SELECT COUNT(*)::integer INTO v_pending
FROM team_members WHERE workspace_id IS NULL
AND invited_by IN (SELECT id FROM team_members WHERE workspace_id = v_ws_id);

SELECT COUNT(*)::integer INTO v_activity_count
FROM box_history bh
JOIN fridge_boxes fb ON fb.id = bh.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id
AND bh.created_at >= now() - (p_activity_window_days || ' days')::interval;

RETURN jsonb_build_object(
'ok', true,
'generated_at', now(),
'expiration', jsonb_build_object(
'expired_count', v_expired,
'expiring_soon_count', v_expiring_soon,
'nearest_expirations', v_nearest
),
'stock', jsonb_build_object(
'low_stock_count', v_low_stock,
'out_of_stock_count', v_out_of_stock
),
'data_quality', jsonb_build_object(
'cells_missing_expiration', v_missing_exp
),
'activity', jsonb_build_object(
'event_count_in_window', v_activity_count,
'window_days', p_activity_window_days
),
'members', jsonb_build_object(
'active', v_active_members,
'pending', v_pending
)
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_get_item_details(p_team_member_id uuid, p_entity_type text, p_entity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_is_owner boolean;
v_result jsonb;
rec record;
v_custom_values jsonb := '[]'::jsonb;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member');
END IF;

SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;

IF p_entity_type = 'cell' THEN
SELECT
fc.id, fc.name, fc.information, fc.date, fc.date_type, fc.cell_id, fc.color, fc.is_crossed,
fb.id AS box_id, fb.name AS box_name, fb.box_type,
fb.fridge_id, fb.sublocation_id, fb.position_id
INTO rec
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE fc.id = p_entity_id AND f.workspace_id = v_ws_id;

IF rec IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Not found');
END IF;

IF NOT v_is_owner THEN
IF EXISTS (
SELECT 1 FROM box_privacy_settings bps
WHERE bps.box_id = rec.box_id
AND bps.privacy_mode = 'restricted'
AND bps.owner_id != p_team_member_id
AND NOT EXISTS (
SELECT 1 FROM box_access_list bal
WHERE bal.box_id = rec.box_id AND bal.team_member_id = p_team_member_id
)
) THEN
RETURN jsonb_build_object('ok', false, 'error', 'Access denied');
END IF;
END IF;

IF rec.box_type IN ('slide', 'structured_freezer') THEN
SELECT COALESCE(jsonb_agg(jsonb_build_object(
'header', sbh.header_text,
'header_type', sbh.header_type,
'value', scv.value
) ORDER BY sbh.display_order), '[]'::jsonb)
INTO v_custom_values
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
WHERE scv.cell_id = rec.id;
END IF;

v_result := jsonb_build_object(
'ok', true,
'entity_type', 'cell',
'id', rec.id,
'name', rec.name,
'information', rec.information,
'cell_id', rec.cell_id,
'date', rec.date,
'date_type', rec.date_type,
'color', rec.color,
'is_crossed', rec.is_crossed,
'box_id', rec.box_id,
'box_name', rec.box_name,
'box_type', rec.box_type,
'expiration_date', CASE WHEN rec.date_type = 'expiration' AND rec.date IS NOT NULL THEN rec.date::text ELSE NULL END,
'expiration_status', CASE
WHEN rec.date_type != 'expiration' OR rec.date IS NULL THEN 'unknown'
WHEN rec.date < CURRENT_DATE THEN 'expired'
WHEN rec.date <= CURRENT_DATE + 30 THEN 'expiring_soon'
ELSE 'valid'
END,
'custom_values', v_custom_values,
'location', ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id)
);

ELSIF p_entity_type = 'item' THEN
SELECT
ii.id, ii.name, ii.description, ii.stock_number, ii.stock_threshold,
ii.unit, ii.item_type, ii.non_counted, ii.display_mode,
ii.freeze_thaw_cycles, ii.fridge_id, ii.sublocation_id, ii.position_id,
ii.folder_id,
ifo.name AS folder_name
INTO rec
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id
WHERE ii.id = p_entity_id AND f.workspace_id = v_ws_id;

IF rec IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Not found');
END IF;

SELECT COALESCE(jsonb_agg(jsonb_build_object(
'header', ifh.header_text,
'header_type', ifh.header_type,
'value', icv.value
) ORDER BY ifh.display_order), '[]'::jsonb)
INTO v_custom_values
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
WHERE icv.item_id = rec.id;

v_result := jsonb_build_object(
'ok', true,
'entity_type', 'item',
'id', rec.id,
'name', rec.name,
'description', rec.description,
'item_type', rec.item_type,
'stock_number', rec.stock_number,
'stock_threshold', rec.stock_threshold,
'unit', rec.unit,
'non_counted', rec.non_counted,
'display_mode', rec.display_mode,
'freeze_thaw_cycles', rec.freeze_thaw_cycles,
'folder_name', rec.folder_name,
'low_stock', CASE
WHEN rec.non_counted THEN false
WHEN rec.stock_threshold IS NULL THEN false
ELSE rec.stock_number <= rec.stock_threshold
END,
'custom_values', v_custom_values,
'location', ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id)
);
ELSE
RETURN jsonb_build_object('ok', false, 'error', 'Invalid entity type');
END IF;

RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_get_item_locations(p_team_member_id uuid, p_entity_ids uuid[], p_entity_type text DEFAULT 'item'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_results jsonb := '[]'::jsonb;
rec record;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member');
END IF;

IF p_entity_type = 'item' THEN
FOR rec IN
SELECT ii.id, ii.name, ii.stock_number, ii.unit, ii.fridge_id, ii.sublocation_id, ii.position_id
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
WHERE ii.id = ANY(p_entity_ids) AND f.workspace_id = v_ws_id
LOOP
v_results := v_results || jsonb_build_object(
'entity_id', rec.id,
'display_name', rec.name,
'quantity', rec.stock_number,
'unit', rec.unit,
'location', ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id)
);
END LOOP;
ELSIF p_entity_type = 'cell' THEN
FOR rec IN
SELECT fc.id, fc.name, fc.cell_id, fb.name AS box_name, fb.fridge_id, fb.sublocation_id, fb.position_id
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE fc.id = ANY(p_entity_ids) AND f.workspace_id = v_ws_id
LOOP
v_results := v_results || jsonb_build_object(
'entity_id', rec.id,
'display_name', rec.name,
'cell_id', rec.cell_id,
'box_name', rec.box_name,
'location', ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id)
);
END LOOP;
END IF;

RETURN jsonb_build_object('ok', true, 'items', v_results, 'count', jsonb_array_length(v_results));
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_get_location_breadcrumb(p_fridge_id uuid, p_sublocation_id uuid DEFAULT NULL::uuid, p_position_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_path jsonb := '[]'::jsonb;
v_breadcrumb text := '';
v_fridge_name text;
v_fridge_type text;
v_sub_name text;
v_sub_type text;
v_pos_name text;
v_pos_type text;
BEGIN
IF p_fridge_id IS NULL THEN
RETURN jsonb_build_object('path', '[]'::jsonb, 'breadcrumb', '');
END IF;

SELECT name, location_type INTO v_fridge_name, v_fridge_type
FROM fridges WHERE id = p_fridge_id;

IF v_fridge_name IS NOT NULL THEN
v_path := v_path || jsonb_build_object('id', p_fridge_id, 'name', v_fridge_name, 'type', COALESCE(v_fridge_type, 'location'));
v_breadcrumb := v_fridge_name;
END IF;

IF p_sublocation_id IS NOT NULL THEN
SELECT name, location_type INTO v_sub_name, v_sub_type
FROM fridge_sublocations WHERE id = p_sublocation_id;

IF v_sub_name IS NOT NULL THEN
v_path := v_path || jsonb_build_object('id', p_sublocation_id, 'name', v_sub_name, 'type', COALESCE(v_sub_type, 'sublocation'));
v_breadcrumb := v_breadcrumb || ' > ' || v_sub_name;
END IF;
END IF;

IF p_position_id IS NOT NULL THEN
SELECT name, location_type INTO v_pos_name, v_pos_type
FROM sublocation_positions WHERE id = p_position_id;

IF v_pos_name IS NOT NULL THEN
v_path := v_path || jsonb_build_object('id', p_position_id, 'name', v_pos_name, 'type', COALESCE(v_pos_type, 'position'));
v_breadcrumb := v_breadcrumb || ' > ' || v_pos_name;
END IF;
END IF;

RETURN jsonb_build_object('path', v_path, 'breadcrumb', v_breadcrumb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_get_project_contents(p_team_member_id uuid, p_project_id uuid, p_experiment_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_is_owner boolean;
v_access text;
v_project_name text;
v_items jsonb := '[]'::jsonb;
v_boxes jsonb := '[]'::jsonb;
v_cells jsonb := '[]'::jsonb;
v_experiments jsonb := '[]'::jsonb;
rec record;
cell_rec record;
v_custom_values jsonb;
v_box_accessible boolean;
v_current_box_id uuid;
v_current_box_name text;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member');
END IF;

SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;

-- Verify project exists in this workspace
SELECT p.name INTO v_project_name
FROM projects p
WHERE p.id = p_project_id AND p.workspace_id = v_ws_id;

IF v_project_name IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Project not found');
END IF;

-- Check project access
v_access := resolve_project_access(p_project_id, p_team_member_id);
IF v_access = 'none' THEN
RETURN jsonb_build_object('ok', false, 'error', 'Access denied');
END IF;

-- Get experiments list
SELECT COALESCE(jsonb_agg(jsonb_build_object(
'id', e.id,
'name', e.name
) ORDER BY e.display_order, e.name), '[]'::jsonb)
INTO v_experiments
FROM experiments e
WHERE e.project_id = p_project_id;

-- Get linked items with full details
FOR rec IN
SELECT
pil.experiment_id,
e.name AS experiment_name,
ii.id AS item_id,
ii.name AS item_name,
ii.description,
ii.stock_number,
ii.unit,
ii.item_type,
ii.stock_threshold,
ii.non_counted,
ii.freeze_thaw_cycles,
ii.fridge_id,
ii.sublocation_id,
ii.position_id,
ifo.name AS folder_name
FROM project_item_links pil
JOIN inventory_items ii ON ii.id = pil.item_id
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN experiments e ON e.id = pil.experiment_id
LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id
WHERE pil.project_id = p_project_id
AND f.workspace_id = v_ws_id
AND (p_experiment_id IS NULL OR pil.experiment_id IS NOT DISTINCT FROM p_experiment_id)
ORDER BY pil.display_order
LOOP
-- Get custom values for item
SELECT COALESCE(jsonb_agg(jsonb_build_object(
'header', ifh.header_text,
'header_type', ifh.header_type,
'value', icv.value
) ORDER BY ifh.display_order), '[]'::jsonb)
INTO v_custom_values
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
WHERE icv.item_id = rec.item_id AND icv.value != '';

v_items := v_items || jsonb_build_object(
'item_id', rec.item_id,
'name', rec.item_name,
'description', rec.description,
'item_type', rec.item_type,
'stock_number', rec.stock_number,
'unit', rec.unit,
'stock_threshold', rec.stock_threshold,
'non_counted', rec.non_counted,
'freeze_thaw_cycles', rec.freeze_thaw_cycles,
'folder_name', rec.folder_name,
'custom_values', v_custom_values,
'experiment_id', rec.experiment_id,
'experiment_name', rec.experiment_name,
'location_breadcrumb', (ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id))->>'breadcrumb'
);
END LOOP;

-- Get linked boxes with details and cells inside them
FOR rec IN
SELECT
pbl.experiment_id,
e.name AS experiment_name,
fb.id AS box_id,
fb.name AS box_name,
fb.box_type,
fb.rows AS box_rows,
fb.columns AS box_cols,
fb.fridge_id,
fb.sublocation_id,
fb.position_id
FROM project_box_links pbl
JOIN fridge_boxes fb ON fb.id = pbl.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN experiments e ON e.id = pbl.experiment_id
WHERE pbl.project_id = p_project_id
AND f.workspace_id = v_ws_id
AND (p_experiment_id IS NULL OR pbl.experiment_id IS NOT DISTINCT FROM p_experiment_id)
ORDER BY pbl.display_order
LOOP
-- Check box privacy
v_box_accessible := true;
IF NOT v_is_owner THEN
IF EXISTS (
SELECT 1 FROM box_privacy_settings bps
WHERE bps.box_id = rec.box_id
AND bps.privacy_mode = 'restricted'
AND bps.owner_id != p_team_member_id
AND NOT EXISTS (
SELECT 1 FROM box_access_list bal
WHERE bal.box_id = rec.box_id AND bal.team_member_id = p_team_member_id
)
) THEN
v_box_accessible := false;
END IF;
END IF;

-- Capture box context before entering cells sub-loop
v_current_box_id := rec.box_id;
v_current_box_name := rec.box_name;

v_boxes := v_boxes || jsonb_build_object(
'box_id', rec.box_id,
'name', rec.box_name,
'box_type', rec.box_type,
'dimensions', rec.box_rows || 'x' || rec.box_cols,
'accessible', v_box_accessible,
'experiment_id', rec.experiment_id,
'experiment_name', rec.experiment_name,
'location_breadcrumb', (ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id))->>'breadcrumb'
);

-- Get cells inside this box (only if accessible)
IF v_box_accessible THEN
FOR cell_rec IN
SELECT
fc.id AS cell_id_pk,
fc.name AS cell_name,
fc.information,
fc.date,
fc.date_type,
fc.cell_id
FROM fridge_cells fc
WHERE fc.box_id = v_current_box_id
AND fc.name != ''
AND fc.is_crossed = false
ORDER BY fc.cell_id
LOOP
-- Get slide/structured values if applicable
v_custom_values := '[]'::jsonb;
SELECT COALESCE(jsonb_agg(jsonb_build_object(
'header', sbh.header_text,
'header_type', sbh.header_type,
'value', scv.value
) ORDER BY sbh.display_order), '[]'::jsonb)
INTO v_custom_values
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
WHERE scv.cell_id = cell_rec.cell_id_pk AND scv.value != '';

v_cells := v_cells || jsonb_build_object(
'cell_name', cell_rec.cell_name,
'information', cell_rec.information,
'cell_coordinate', cell_rec.cell_id,
'date', cell_rec.date,
'date_type', cell_rec.date_type,
'box_id', v_current_box_id,
'box_name', v_current_box_name,
'custom_values', v_custom_values
);
END LOOP;
END IF;
END LOOP;

RETURN jsonb_build_object(
'ok', true,
'project_name', v_project_name,
'project_id', p_project_id,
'access_level', v_access,
'experiments', v_experiments,
'items', v_items,
'item_count', jsonb_array_length(v_items),
'boxes', v_boxes,
'box_count', jsonb_array_length(v_boxes),
'cells', v_cells,
'cell_count', jsonb_array_length(v_cells)
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_get_workspace_inventory_stats(p_team_member_id uuid, p_location_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_location_count integer;
v_sublocation_count integer;
v_position_count integer;
v_box_count integer;
v_item_count integer;
v_folder_count integer;
v_expired_count integer;
v_expiring_soon_count integer;
v_low_stock_count integer;
v_out_of_stock_count integer;
v_cutoff date;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member');
END IF;

v_cutoff := CURRENT_DATE + 30;

SELECT COUNT(*)::integer INTO v_location_count
FROM fridges WHERE workspace_id = v_ws_id
AND (p_location_id IS NULL OR id = p_location_id);

SELECT COUNT(*)::integer INTO v_sublocation_count
FROM fridge_sublocations fs JOIN fridges f ON f.id = fs.fridge_id
WHERE f.workspace_id = v_ws_id AND (p_location_id IS NULL OR f.id = p_location_id);

SELECT COUNT(*)::integer INTO v_position_count
FROM sublocation_positions sp
JOIN fridge_sublocations fs ON fs.id = sp.sublocation_id
JOIN fridges f ON f.id = fs.fridge_id
WHERE f.workspace_id = v_ws_id AND (p_location_id IS NULL OR f.id = p_location_id);

SELECT COUNT(*)::integer INTO v_box_count
FROM fridge_boxes fb JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id AND (p_location_id IS NULL OR f.id = p_location_id);

SELECT COUNT(*)::integer INTO v_item_count
FROM inventory_items ii JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = v_ws_id AND (p_location_id IS NULL OR f.id = p_location_id);

SELECT COUNT(*)::integer INTO v_folder_count
FROM item_folders ifo JOIN fridges f ON f.id = ifo.fridge_id
WHERE f.workspace_id = v_ws_id AND (p_location_id IS NULL OR f.id = p_location_id);

SELECT COUNT(*)::integer INTO v_expired_count
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id
AND fc.date_type = 'expiration' AND fc.date IS NOT NULL
AND fc.is_crossed = false AND fc.date < CURRENT_DATE
AND (p_location_id IS NULL OR f.id = p_location_id);

SELECT COUNT(*)::integer INTO v_expiring_soon_count
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id
AND fc.date_type = 'expiration' AND fc.date IS NOT NULL
AND fc.is_crossed = false AND fc.date >= CURRENT_DATE AND fc.date <= v_cutoff
AND (p_location_id IS NULL OR f.id = p_location_id);

SELECT COUNT(*)::integer INTO v_low_stock_count
FROM inventory_items ii JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = v_ws_id AND ii.non_counted = false
AND ii.stock_threshold IS NOT NULL AND ii.stock_number <= ii.stock_threshold AND ii.stock_number > 0
AND (p_location_id IS NULL OR f.id = p_location_id);

SELECT COUNT(*)::integer INTO v_out_of_stock_count
FROM inventory_items ii JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = v_ws_id AND ii.non_counted = false
AND ii.stock_threshold IS NOT NULL AND ii.stock_number <= 0
AND (p_location_id IS NULL OR f.id = p_location_id);

RETURN jsonb_build_object(
'ok', true,
'location_count', v_location_count,
'sublocation_count', v_sublocation_count,
'position_count', v_position_count,
'box_count', v_box_count,
'item_count', v_item_count,
'folder_count', v_folder_count,
'expired_count', v_expired_count,
'expiring_soon_count', v_expiring_soon_count,
'low_stock_count', v_low_stock_count,
'out_of_stock_count', v_out_of_stock_count
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_get_workspace_member_stats(p_team_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_active integer;
v_pending integer;
v_roles jsonb;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member');
END IF;

SELECT COUNT(*)::integer INTO v_active
FROM team_members WHERE workspace_id = v_ws_id AND role IS NOT NULL;

SELECT COUNT(*)::integer INTO v_pending
FROM team_members WHERE workspace_id IS NULL AND invited_by IS NOT NULL
AND id IN (SELECT id FROM team_members WHERE email IN (
SELECT email FROM team_members WHERE workspace_id = v_ws_id
));

-- Actually count pending as members without workspace but who were invited
SELECT COUNT(*)::integer INTO v_pending
FROM team_members
WHERE workspace_id IS NULL
AND invited_by IN (SELECT id FROM team_members WHERE workspace_id = v_ws_id);

SELECT COALESCE(jsonb_agg(jsonb_build_object('role', role, 'count', cnt)), '[]'::jsonb)
INTO v_roles
FROM (
SELECT role, COUNT(*)::integer AS cnt
FROM team_members
WHERE workspace_id = v_ws_id AND role IS NOT NULL
GROUP BY role
ORDER BY role
) sub;

RETURN jsonb_build_object(
'ok', true,
'active_members', v_active,
'pending_invitations', v_pending,
'total', v_active + v_pending,
'role_breakdown', v_roles
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_list_expiring_inventory(p_team_member_id uuid, p_within_days integer DEFAULT 30, p_include_expired boolean DEFAULT true, p_location_id uuid DEFAULT NULL::uuid, p_only_available boolean DEFAULT false, p_sort text DEFAULT 'expiration_ascending'::text, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_is_owner boolean;
v_cutoff_date date;
v_results jsonb := '[]'::jsonb;
v_expired_count integer := 0;
v_expiring_count integer := 0;
rec record;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member');
END IF;

SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;
v_cutoff_date := CURRENT_DATE + (p_within_days || ' days')::interval;

FOR rec IN
SELECT
fc.id,
'cell' AS entity_type,
fc.name AS display_name,
fc.date::text AS expiration_date,
fc.is_crossed,
fb.name AS box_name,
fb.fridge_id, fb.sublocation_id, fb.position_id,
fc.date AS exp_date
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id
AND fc.date_type = 'expiration'
AND fc.date IS NOT NULL
AND fc.is_crossed = false
AND fc.date <= v_cutoff_date
AND (NOT p_only_available OR fc.is_crossed = false)
AND (p_location_id IS NULL OR fb.fridge_id = p_location_id)
AND (p_include_expired OR fc.date >= CURRENT_DATE)
AND (
v_is_owner
OR NOT EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.privacy_mode = 'restricted')
OR EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.owner_id = p_team_member_id)
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
ORDER BY
CASE WHEN p_sort = 'expiration_ascending' THEN fc.date END ASC,
CASE WHEN p_sort = 'expiration_descending' THEN fc.date END DESC,
CASE WHEN p_sort = 'name' THEN fc.name END ASC
LIMIT p_limit
LOOP
IF rec.exp_date < CURRENT_DATE THEN
v_expired_count := v_expired_count + 1;
ELSE
v_expiring_count := v_expiring_count + 1;
END IF;

v_results := v_results || jsonb_build_object(
'id', rec.id,
'entity_type', rec.entity_type,
'display_name', rec.display_name,
'expiration_date', rec.expiration_date,
'days_until_expiration', rec.exp_date - CURRENT_DATE,
'status', CASE WHEN rec.exp_date < CURRENT_DATE THEN 'expired' ELSE 'expiring_soon' END,
'box_name', rec.box_name,
'location_breadcrumb', (ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id))->>'breadcrumb'
);
END LOOP;

FOR rec IN
SELECT
ii.id,
'item' AS entity_type,
ii.name AS display_name,
icv.value AS expiration_date,
ii.fridge_id, ii.sublocation_id, ii.position_id,
icv.value::date AS exp_date
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
JOIN item_custom_values icv ON icv.item_id = ii.id
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
WHERE f.workspace_id = v_ws_id
AND ifh.header_type = 'expiration'
AND icv.value IS NOT NULL AND icv.value != ''
AND icv.value ~ '^\d{4}-\d{2}-\d{2}$'
AND icv.value::date <= v_cutoff_date
AND (p_location_id IS NULL OR ii.fridge_id = p_location_id)
AND (p_include_expired OR icv.value::date >= CURRENT_DATE)
AND (NOT p_only_available OR ii.non_counted = true OR ii.stock_number > 0)
ORDER BY
CASE WHEN p_sort = 'expiration_ascending' THEN icv.value::date END ASC,
CASE WHEN p_sort = 'expiration_descending' THEN icv.value::date END DESC,
CASE WHEN p_sort = 'name' THEN ii.name END ASC
LIMIT p_limit
LOOP
IF rec.exp_date < CURRENT_DATE THEN
v_expired_count := v_expired_count + 1;
ELSE
v_expiring_count := v_expiring_count + 1;
END IF;

v_results := v_results || jsonb_build_object(
'id', rec.id,
'entity_type', rec.entity_type,
'display_name', rec.display_name,
'expiration_date', rec.expiration_date,
'days_until_expiration', rec.exp_date - CURRENT_DATE,
'status', CASE WHEN rec.exp_date < CURRENT_DATE THEN 'expired' ELSE 'expiring_soon' END,
'box_name', NULL,
'location_breadcrumb', (ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id))->>'breadcrumb'
);
END LOOP;

RETURN jsonb_build_object(
'ok', true,
'window_start', CURRENT_DATE::text,
'window_end', v_cutoff_date::text,
'counts', jsonb_build_object('expired', v_expired_count, 'expiring_soon', v_expiring_count),
'items', v_results,
'total_count', jsonb_array_length(v_results),
'truncated', jsonb_array_length(v_results) >= p_limit
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_list_low_stock_items(p_team_member_id uuid, p_location_id uuid DEFAULT NULL::uuid, p_include_out_of_stock boolean DEFAULT true, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_results jsonb := '[]'::jsonb;
v_low_count integer := 0;
v_out_count integer := 0;
rec record;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member');
END IF;

FOR rec IN
SELECT
ii.id, ii.name, ii.stock_number, ii.stock_threshold, ii.unit, ii.item_type,
ii.fridge_id, ii.sublocation_id, ii.position_id,
ifo.name AS folder_name
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id
WHERE f.workspace_id = v_ws_id
AND ii.non_counted = false
AND ii.stock_threshold IS NOT NULL
AND ii.stock_number <= ii.stock_threshold
AND (p_location_id IS NULL OR ii.fridge_id = p_location_id)
AND (p_include_out_of_stock OR ii.stock_number > 0)
ORDER BY
CASE WHEN ii.stock_number <= 0 THEN 0 ELSE 1 END,
(ii.stock_number::float / GREATEST(ii.stock_threshold, 1)),
ii.name
LIMIT p_limit
LOOP
IF rec.stock_number <= 0 THEN
v_out_count := v_out_count + 1;
ELSE
v_low_count := v_low_count + 1;
END IF;

v_results := v_results || jsonb_build_object(
'id', rec.id,
'display_name', rec.name,
'item_type', rec.item_type,
'stock_number', rec.stock_number,
'stock_threshold', rec.stock_threshold,
'unit', rec.unit,
'deficit', rec.stock_threshold - rec.stock_number,
'severity', CASE
WHEN rec.stock_number <= 0 THEN 'out_of_stock'
WHEN rec.stock_number <= (rec.stock_threshold * 0.5) THEN 'critical'
ELSE 'low'
END,
'folder_name', rec.folder_name,
'location_breadcrumb', (ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id))->>'breadcrumb'
);
END LOOP;

RETURN jsonb_build_object(
'ok', true,
'counts', jsonb_build_object('low_stock', v_low_count, 'out_of_stock', v_out_count),
'items', v_results,
'total_count', jsonb_array_length(v_results),
'truncated', jsonb_array_length(v_results) >= p_limit
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_list_projects(p_team_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_is_owner boolean;
v_results jsonb := '[]'::jsonb;
rec record;
v_experiments jsonb;
v_box_count integer;
v_item_count integer;
v_access text;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN
RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member');
END IF;

SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;

FOR rec IN
SELECT p.id, p.name, p.accent_color, p.created_at
FROM projects p
WHERE p.workspace_id = v_ws_id
ORDER BY p.display_order, p.name
LOOP
-- Check project access
v_access := resolve_project_access(rec.id, p_team_member_id);
IF v_access = 'none' THEN
CONTINUE;
END IF;

-- Get experiments for this project
SELECT COALESCE(jsonb_agg(jsonb_build_object(
'id', e.id,
'name', e.name
) ORDER BY e.display_order, e.name), '[]'::jsonb)
INTO v_experiments
FROM experiments e
WHERE e.project_id = rec.id;

-- Count linked boxes
SELECT COUNT(*)::integer INTO v_box_count
FROM project_box_links pbl
WHERE pbl.project_id = rec.id;

-- Count linked items
SELECT COUNT(*)::integer INTO v_item_count
FROM project_item_links pil
WHERE pil.project_id = rec.id;

v_results := v_results || jsonb_build_object(
'id', rec.id,
'name', rec.name,
'access_level', v_access,
'experiments', v_experiments,
'linked_box_count', v_box_count,
'linked_item_count', v_item_count
);
END LOOP;

RETURN jsonb_build_object(
'ok', true,
'projects', v_results,
'total_count', jsonb_array_length(v_results)
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_search_inventory(p_team_member_id uuid, p_query text, p_entity_types text[] DEFAULT ARRAY['cell'::text, 'item'::text, 'box'::text], p_location_id uuid DEFAULT NULL::uuid, p_include_crossed boolean DEFAULT false, p_only_available boolean DEFAULT false, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_is_owner boolean;
v_results jsonb := '[]'::jsonb;
v_query_lower text;
v_total integer := 0;
rec record;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN
RETURN jsonb_build_object('status', 'error', 'message', 'Invalid team member');
END IF;

SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;
v_query_lower := lower(trim(p_query));

IF v_query_lower = '' OR length(v_query_lower) < 1 THEN
RETURN jsonb_build_object('status', 'not_found', 'matches', '[]'::jsonb, 'total_count', 0);
END IF;

-- Search cells
IF 'cell' = ANY(p_entity_types) THEN
FOR rec IN
SELECT
fc.id,
fc.name,
fc.information,
fc.date,
fc.date_type,
fc.cell_id,
fc.is_crossed,
fb.id AS box_id,
fb.name AS box_name,
fb.fridge_id,
fb.sublocation_id,
fb.position_id,
CASE
WHEN lower(fc.name) = v_query_lower THEN 100
WHEN lower(fc.name) LIKE v_query_lower || '%' THEN 80
WHEN lower(fc.information) = v_query_lower THEN 70
WHEN lower(fc.name) LIKE '%' || v_query_lower || '%' THEN 60
WHEN lower(fc.information) LIKE '%' || v_query_lower || '%' THEN 50
ELSE 30
END AS score
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id
AND (p_include_crossed OR fc.is_crossed = false)
AND (fc.name ILIKE '%' || p_query || '%' OR fc.information ILIKE '%' || p_query || '%')
AND (p_location_id IS NULL OR fb.fridge_id = p_location_id)
AND (
v_is_owner
OR NOT EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id)
OR EXISTS (
SELECT 1 FROM box_privacy_settings bps
WHERE bps.box_id = fb.id AND bps.privacy_mode = 'open'
)
OR EXISTS (
SELECT 1 FROM box_privacy_settings bps
WHERE bps.box_id = fb.id AND bps.owner_id = p_team_member_id
)
OR EXISTS (
SELECT 1 FROM box_access_list bal
WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id
)
)
ORDER BY score DESC, fc.name
LIMIT p_limit
LOOP
v_results := v_results || jsonb_build_object(
'entity_type', 'cell',
'id', rec.id,
'display_name', rec.name,
'information', rec.information,
'cell_id', rec.cell_id,
'box_name', rec.box_name,
'box_id', rec.box_id,
'expiration_date', CASE WHEN rec.date_type = 'expiration' AND rec.date IS NOT NULL THEN rec.date::text ELSE NULL END,
'expiration_status', CASE
WHEN rec.date_type != 'expiration' OR rec.date IS NULL THEN 'unknown'
WHEN rec.date < CURRENT_DATE THEN 'expired'
WHEN rec.date <= CURRENT_DATE + 30 THEN 'expiring_soon'
ELSE 'valid'
END,
'is_crossed', rec.is_crossed,
'location_breadcrumb', (ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id))->>'breadcrumb',
'score', rec.score,
'match_reason', CASE
WHEN lower(rec.name) = v_query_lower THEN 'exact_name_match'
WHEN lower(rec.name) LIKE v_query_lower || '%' THEN 'name_prefix'
WHEN lower(rec.information) = v_query_lower THEN 'exact_info_match'
ELSE 'partial_match'
END
);
v_total := v_total + 1;
END LOOP;
END IF;

-- Search inventory items
IF 'item' = ANY(p_entity_types) THEN
FOR rec IN
SELECT
ii.id,
ii.name,
ii.description,
ii.stock_number,
ii.stock_threshold,
ii.unit,
ii.item_type,
ii.non_counted,
ii.fridge_id,
ii.sublocation_id,
ii.position_id,
ii.freeze_thaw_cycles,
CASE
WHEN lower(ii.name) = v_query_lower THEN 100
WHEN lower(ii.name) LIKE v_query_lower || '%' THEN 80
WHEN lower(ii.description) = v_query_lower THEN 70
WHEN lower(ii.name) LIKE '%' || v_query_lower || '%' THEN 60
WHEN lower(ii.description) LIKE '%' || v_query_lower || '%' THEN 50
ELSE 30
END AS score
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = v_ws_id
AND (ii.name ILIKE '%' || p_query || '%' OR ii.description ILIKE '%' || p_query || '%')
AND (p_location_id IS NULL OR ii.fridge_id = p_location_id)
AND (NOT p_only_available OR (ii.non_counted = true OR ii.stock_number > 0))
ORDER BY score DESC, ii.name
LIMIT p_limit
LOOP
v_results := v_results || jsonb_build_object(
'entity_type', 'item',
'id', rec.id,
'display_name', rec.name,
'description', rec.description,
'item_type', rec.item_type,
'stock_number', rec.stock_number,
'stock_threshold', rec.stock_threshold,
'unit', rec.unit,
'non_counted', rec.non_counted,
'freeze_thaw_cycles', rec.freeze_thaw_cycles,
'location_breadcrumb', (ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id))->>'breadcrumb',
'score', rec.score,
'match_reason', CASE
WHEN lower(rec.name) = v_query_lower THEN 'exact_name_match'
WHEN lower(rec.name) LIKE v_query_lower || '%' THEN 'name_prefix'
ELSE 'partial_match'
END
);
v_total := v_total + 1;
END LOOP;
END IF;

-- Search boxes
IF 'box' = ANY(p_entity_types) THEN
FOR rec IN
SELECT
fb.id,
fb.name,
fb.box_type,
fb.rows AS box_rows,
fb.columns AS box_cols,
fb.fridge_id,
fb.sublocation_id,
fb.position_id,
CASE
WHEN lower(fb.name) = v_query_lower THEN 100
WHEN lower(fb.name) LIKE v_query_lower || '%' THEN 80
WHEN lower(fb.name) LIKE '%' || v_query_lower || '%' THEN 60
ELSE 30
END AS score
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = v_ws_id
AND fb.name ILIKE '%' || p_query || '%'
AND (p_location_id IS NULL OR fb.fridge_id = p_location_id)
AND (
v_is_owner
OR NOT EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id)
OR EXISTS (
SELECT 1 FROM box_privacy_settings bps
WHERE bps.box_id = fb.id AND bps.privacy_mode = 'open'
)
OR EXISTS (
SELECT 1 FROM box_privacy_settings bps
WHERE bps.box_id = fb.id AND bps.owner_id = p_team_member_id
)
OR EXISTS (
SELECT 1 FROM box_access_list bal
WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id
)
)
ORDER BY score DESC, fb.name
LIMIT p_limit
LOOP
v_results := v_results || jsonb_build_object(
'entity_type', 'box',
'id', rec.id,
'display_name', rec.name,
'box_type', rec.box_type,
'dimensions', rec.box_rows || 'x' || rec.box_cols,
'location_breadcrumb', (ai_get_location_breadcrumb(rec.fridge_id, rec.sublocation_id, rec.position_id))->>'breadcrumb',
'score', rec.score,
'match_reason', CASE
WHEN lower(rec.name) = v_query_lower THEN 'exact_name_match'
WHEN lower(rec.name) LIKE v_query_lower || '%' THEN 'name_prefix'
ELSE 'partial_match'
END
);
v_total := v_total + 1;
END LOOP;
END IF;

RETURN jsonb_build_object(
'status', CASE WHEN v_total = 0 THEN 'not_found' WHEN v_total = 1 THEN 'unique' ELSE 'multiple' END,
'matches', v_results,
'total_count', v_total,
'query', p_query
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.batch_resolve_box_access(p_box_ids uuid[], p_team_member_id uuid)
 RETURNS TABLE(box_id uuid, access_level text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_bid uuid;
BEGIN
FOREACH v_bid IN ARRAY p_box_ids LOOP
box_id := v_bid;
access_level := resolve_box_access(v_bid, p_team_member_id);
RETURN NEXT;
END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.batch_resolve_project_access(p_project_ids uuid[], p_team_member_id uuid)
 RETURNS TABLE(project_id uuid, access_level text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_pid uuid;
BEGIN
FOREACH v_pid IN ARRAY p_project_ids LOOP
project_id := v_pid;
access_level := resolve_project_access(v_pid, p_team_member_id);
RETURN NEXT;
END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_box_history()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
DELETE FROM box_history
WHERE created_at < now() - interval '1 year';
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_workspace_backup(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_team_member_id uuid;
v_role text;
v_snapshot jsonb;
v_ws record;
v_size integer;
v_result jsonb;
v_backup_id uuid;
v_excess_ids uuid[];
BEGIN
-- Auth check
SELECT id, role INTO v_team_member_id, v_role
FROM team_members
WHERE auth_user_id = auth.uid() AND workspace_id = p_workspace_id;

IF v_team_member_id IS NULL THEN
RAISE EXCEPTION 'Not a member of this workspace';
END IF;
IF v_role NOT IN ('owner', 'manager') THEN
RAISE EXCEPTION 'Only owners and managers can create backups';
END IF;

-- Get workspace settings
SELECT row_to_json(w.*) INTO v_snapshot
FROM (
SELECT name, live_sync_enabled, auto_open_first_folder,
auto_open_first_item_folder, colorful_icons_enabled,
auto_expand_all_locations, hierarchical_navigation
FROM workspaces WHERE id = p_workspace_id
) w;

-- Build full snapshot
v_snapshot := jsonb_build_object(
'version', 1,
'workspace_id', p_workspace_id,
'created_at', now(),
'workspace_settings', v_snapshot,
'fridges', COALESCE((
SELECT jsonb_agg(row_to_json(f.*)::jsonb - 'workspace_id')
FROM fridges f WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'fridge_sublocations', COALESCE((
SELECT jsonb_agg(row_to_json(fs.*))
FROM fridge_sublocations fs
JOIN fridges f ON f.id = fs.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'sublocation_positions', COALESCE((
SELECT jsonb_agg(row_to_json(sp.*))
FROM sublocation_positions sp
JOIN fridge_sublocations fs ON fs.id = sp.sublocation_id
JOIN fridges f ON f.id = fs.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'fridge_boxes', COALESCE((
SELECT jsonb_agg(row_to_json(fb.*))
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'fridge_cells', COALESCE((
SELECT jsonb_agg(row_to_json(fc.*))
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'item_folders', COALESCE((
SELECT jsonb_agg(row_to_json(ifo.*))
FROM item_folders ifo
JOIN fridges f ON f.id = ifo.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'item_folder_headers', COALESCE((
SELECT jsonb_agg(row_to_json(ifh.*))
FROM item_folder_headers ifh
JOIN item_folders ifo ON ifo.id = ifh.folder_id
JOIN fridges f ON f.id = ifo.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'inventory_items', COALESCE((
SELECT jsonb_agg(row_to_json(ii.*))
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'item_custom_values', COALESCE((
SELECT jsonb_agg(row_to_json(icv.*))
FROM item_custom_values icv
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'slide_box_headers', COALESCE((
SELECT jsonb_agg(row_to_json(sbh.*))
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'slide_cell_values', COALESCE((
SELECT jsonb_agg(row_to_json(scv.*))
FROM slide_cell_values scv
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'box_grid_item_links', COALESCE((
SELECT jsonb_agg(row_to_json(bgl.*))
FROM box_grid_item_links bgl
JOIN fridge_boxes fb ON fb.id = bgl.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'box_history', COALESCE((
SELECT jsonb_agg(row_to_json(bh.*))
FROM box_history bh
JOIN fridge_boxes fb ON fb.id = bh.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = p_workspace_id
), '[]'::jsonb),
'saved_search_filters', COALESCE((
SELECT jsonb_agg(row_to_json(ssf.*))
FROM saved_search_filters ssf
WHERE ssf.workspace_id = p_workspace_id
), '[]'::jsonb)
);

v_size := octet_length(v_snapshot::text);

-- Upsert (one backup per day)
INSERT INTO workspace_backups (workspace_id, created_by, backup_data, backup_date, file_size_bytes)
VALUES (p_workspace_id, v_team_member_id, v_snapshot, CURRENT_DATE, v_size)
ON CONFLICT (workspace_id, backup_date) DO UPDATE
SET backup_data = EXCLUDED.backup_data,
file_size_bytes = EXCLUDED.file_size_bytes,
created_by = EXCLUDED.created_by,
created_at = now()
RETURNING id INTO v_backup_id;

-- Enforce 7-backup rolling window
SELECT array_agg(id) INTO v_excess_ids
FROM (
SELECT id FROM workspace_backups
WHERE workspace_id = p_workspace_id
ORDER BY backup_date DESC
OFFSET 7
) excess;

IF v_excess_ids IS NOT NULL THEN
DELETE FROM workspace_backups WHERE id = ANY(v_excess_ids);
END IF;

v_result := jsonb_build_object(
'backup_id', v_backup_id,
'backup_date', CURRENT_DATE,
'file_size_bytes', v_size
);

RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_workspace_backup(p_workspace_id uuid, p_backup_type text DEFAULT 'auto'::text, p_label text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_team_member_id uuid;
v_role text;
v_snapshot jsonb;
v_size integer;
v_backup_id uuid;
v_excess_ids uuid[];
v_manual_count integer;
BEGIN
SELECT id, role INTO v_team_member_id, v_role
FROM team_members
WHERE auth_user_id = auth.uid() AND workspace_id = p_workspace_id;

IF v_team_member_id IS NULL THEN
RAISE EXCEPTION 'Not a member of this workspace';
END IF;
IF v_role NOT IN ('owner', 'manager') THEN
RAISE EXCEPTION 'Only owners and managers can create backups';
END IF;

IF p_backup_type NOT IN ('auto', 'manual') THEN
RAISE EXCEPTION 'Invalid backup type: %', p_backup_type;
END IF;

IF p_backup_type = 'manual' THEN
SELECT count(*) INTO v_manual_count
FROM workspace_backups
WHERE workspace_id = p_workspace_id AND backup_type = 'manual';
IF v_manual_count >= 3 THEN
RAISE EXCEPTION 'Maximum 3 manual backups allowed. Delete one to create a new one.';
END IF;
END IF;

SELECT row_to_json(w.*) INTO v_snapshot
FROM (
SELECT name, live_sync_enabled, auto_open_first_folder,
auto_open_first_item_folder, colorful_icons_enabled,
auto_expand_all_locations, hierarchical_navigation,
rotate_wide_grid_mobile
FROM workspaces WHERE id = p_workspace_id
) w;

v_snapshot := jsonb_build_object(
'version', 1,
'workspace_id', p_workspace_id,
'created_at', now(),
'workspace_settings', v_snapshot,
'fridges', COALESCE((SELECT jsonb_agg(row_to_json(f.*)::jsonb - 'workspace_id') FROM fridges f WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'fridge_sublocations', COALESCE((SELECT jsonb_agg(row_to_json(fs.*)) FROM fridge_sublocations fs JOIN fridges f ON f.id = fs.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'sublocation_positions', COALESCE((SELECT jsonb_agg(row_to_json(sp.*)) FROM sublocation_positions sp JOIN fridge_sublocations fs ON fs.id = sp.sublocation_id JOIN fridges f ON f.id = fs.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'fridge_boxes', COALESCE((SELECT jsonb_agg(row_to_json(fb.*)) FROM fridge_boxes fb JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'fridge_cells', COALESCE((SELECT jsonb_agg(row_to_json(fc.*)) FROM fridge_cells fc JOIN fridge_boxes fb ON fb.id = fc.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'item_folders', COALESCE((SELECT jsonb_agg(row_to_json(ifo.*)) FROM item_folders ifo JOIN fridges f ON f.id = ifo.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'item_folder_headers', COALESCE((SELECT jsonb_agg(row_to_json(ifh.*)) FROM item_folder_headers ifh JOIN item_folders ifo ON ifo.id = ifh.folder_id JOIN fridges f ON f.id = ifo.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'inventory_items', COALESCE((SELECT jsonb_agg(row_to_json(ii.*)) FROM inventory_items ii JOIN fridges f ON f.id = ii.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'item_custom_values', COALESCE((SELECT jsonb_agg(row_to_json(icv.*)) FROM item_custom_values icv JOIN inventory_items ii ON ii.id = icv.item_id JOIN fridges f ON f.id = ii.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'slide_box_headers', COALESCE((SELECT jsonb_agg(row_to_json(sbh.*)) FROM slide_box_headers sbh JOIN fridge_boxes fb ON fb.id = sbh.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'slide_cell_values', COALESCE((SELECT jsonb_agg(row_to_json(scv.*)) FROM slide_cell_values scv JOIN fridge_cells fc ON fc.id = scv.cell_id JOIN fridge_boxes fb ON fb.id = fc.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'box_grid_item_links', COALESCE((SELECT jsonb_agg(row_to_json(bgl.*)) FROM box_grid_item_links bgl JOIN fridge_boxes fb ON fb.id = bgl.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'saved_search_filters', COALESCE((SELECT jsonb_agg(row_to_json(ssf.*)) FROM saved_search_filters ssf WHERE ssf.workspace_id = p_workspace_id), '[]'::jsonb),
'box_privacy_settings', COALESCE((SELECT jsonb_agg(row_to_json(bps.*)) FROM box_privacy_settings bps JOIN fridge_boxes fb ON fb.id = bps.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'box_access_list', COALESCE((SELECT jsonb_agg(row_to_json(bal.*)) FROM box_access_list bal JOIN fridge_boxes fb ON fb.id = bal.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'box_qr_codes', COALESCE((SELECT jsonb_agg(row_to_json(bqr.*)) FROM box_qr_codes bqr WHERE bqr.workspace_id = p_workspace_id), '[]'::jsonb),
'projects', COALESCE((SELECT jsonb_agg(row_to_json(pr.*)) FROM projects pr WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb),
'experiments', COALESCE((SELECT jsonb_agg(row_to_json(ex.*)) FROM experiments ex JOIN projects pr ON pr.id = ex.project_id WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb),
'project_box_links', COALESCE((SELECT jsonb_agg(row_to_json(pbl.*)) FROM project_box_links pbl JOIN projects pr ON pr.id = pbl.project_id WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb),
'project_item_links', COALESCE((SELECT jsonb_agg(row_to_json(pil.*)) FROM project_item_links pil JOIN projects pr ON pr.id = pil.project_id WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb),
'project_privacy_settings', COALESCE((SELECT jsonb_agg(row_to_json(pps.*)) FROM project_privacy_settings pps JOIN projects pr ON pr.id = pps.project_id WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb),
'project_access_list', COALESCE((SELECT jsonb_agg(row_to_json(pal.*)) FROM project_access_list pal JOIN projects pr ON pr.id = pal.project_id WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb)
);

v_size := octet_length(v_snapshot::text);

IF p_backup_type = 'auto' THEN
INSERT INTO workspace_backups (workspace_id, created_by, backup_data, backup_date, file_size_bytes, backup_type, label)
VALUES (p_workspace_id, v_team_member_id, v_snapshot, CURRENT_DATE, v_size, 'auto', NULL)
ON CONFLICT (workspace_id, backup_date) WHERE backup_type = 'auto'
DO UPDATE SET backup_data = EXCLUDED.backup_data, file_size_bytes = EXCLUDED.file_size_bytes, created_by = EXCLUDED.created_by, created_at = now()
RETURNING id INTO v_backup_id;

DELETE FROM workspace_backups
WHERE workspace_id = p_workspace_id AND backup_type = 'auto' AND backup_date < CURRENT_DATE - INTERVAL '7 days';

SELECT array_agg(id) INTO v_excess_ids FROM (
SELECT id FROM workspace_backups WHERE workspace_id = p_workspace_id AND backup_type = 'auto' ORDER BY backup_date DESC OFFSET 7
) excess;
IF v_excess_ids IS NOT NULL THEN
DELETE FROM workspace_backups WHERE id = ANY(v_excess_ids);
END IF;
ELSE
INSERT INTO workspace_backups (workspace_id, created_by, backup_data, backup_date, file_size_bytes, backup_type, label)
VALUES (p_workspace_id, v_team_member_id, v_snapshot, CURRENT_DATE, v_size, 'manual', p_label)
RETURNING id INTO v_backup_id;
END IF;

RETURN jsonb_build_object('backup_id', v_backup_id, 'backup_date', CURRENT_DATE, 'file_size_bytes', v_size);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cron_auto_backup_workspaces()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws record;
v_snapshot jsonb;
v_size integer;
v_owner_tm_id uuid;
v_last_auto date;
v_has_activity boolean;
BEGIN
FOR v_ws IN SELECT id FROM workspaces LOOP
SELECT backup_date INTO v_last_auto
FROM workspace_backups
WHERE workspace_id = v_ws.id AND backup_type = 'auto'
ORDER BY backup_date DESC LIMIT 1;

IF v_last_auto = CURRENT_DATE THEN CONTINUE; END IF;

v_has_activity := false;
IF v_last_auto IS NULL THEN
SELECT EXISTS(SELECT 1 FROM fridges WHERE workspace_id = v_ws.id) INTO v_has_activity;
ELSE
IF EXISTS(SELECT 1 FROM fridges WHERE workspace_id = v_ws.id AND updated_at > v_last_auto) THEN
v_has_activity := true;
ELSIF EXISTS(SELECT 1 FROM fridge_boxes fb JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws.id AND fb.updated_at > v_last_auto) THEN
v_has_activity := true;
ELSIF EXISTS(SELECT 1 FROM fridge_cells fc JOIN fridge_boxes fb ON fb.id = fc.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws.id AND fc.updated_at > v_last_auto) THEN
v_has_activity := true;
ELSIF EXISTS(SELECT 1 FROM inventory_items ii JOIN fridges f ON f.id = ii.fridge_id WHERE f.workspace_id = v_ws.id AND ii.updated_at > v_last_auto) THEN
v_has_activity := true;
ELSIF EXISTS(SELECT 1 FROM item_folders ifo JOIN fridges f ON f.id = ifo.fridge_id WHERE f.workspace_id = v_ws.id AND ifo.updated_at > v_last_auto) THEN
v_has_activity := true;
ELSIF EXISTS(SELECT 1 FROM projects pr WHERE pr.workspace_id = v_ws.id AND pr.updated_at > v_last_auto) THEN
v_has_activity := true;
END IF;
END IF;

IF NOT v_has_activity THEN CONTINUE; END IF;

SELECT id INTO v_owner_tm_id FROM team_members WHERE workspace_id = v_ws.id AND role = 'owner' LIMIT 1;
IF v_owner_tm_id IS NULL THEN CONTINUE; END IF;

SELECT row_to_json(w.*) INTO v_snapshot
FROM (SELECT name, live_sync_enabled, auto_open_first_folder, auto_open_first_item_folder, colorful_icons_enabled, auto_expand_all_locations, hierarchical_navigation, rotate_wide_grid_mobile FROM workspaces WHERE id = v_ws.id) w;

v_snapshot := jsonb_build_object(
'version', 1, 'workspace_id', v_ws.id, 'created_at', now(), 'workspace_settings', v_snapshot,
'fridges', COALESCE((SELECT jsonb_agg(row_to_json(f.*)::jsonb - 'workspace_id') FROM fridges f WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'fridge_sublocations', COALESCE((SELECT jsonb_agg(row_to_json(fs.*)) FROM fridge_sublocations fs JOIN fridges f ON f.id = fs.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'sublocation_positions', COALESCE((SELECT jsonb_agg(row_to_json(sp.*)) FROM sublocation_positions sp JOIN fridge_sublocations fs ON fs.id = sp.sublocation_id JOIN fridges f ON f.id = fs.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'fridge_boxes', COALESCE((SELECT jsonb_agg(row_to_json(fb.*)) FROM fridge_boxes fb JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'fridge_cells', COALESCE((SELECT jsonb_agg(row_to_json(fc.*)) FROM fridge_cells fc JOIN fridge_boxes fb ON fb.id = fc.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'item_folders', COALESCE((SELECT jsonb_agg(row_to_json(ifo.*)) FROM item_folders ifo JOIN fridges f ON f.id = ifo.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'item_folder_headers', COALESCE((SELECT jsonb_agg(row_to_json(ifh.*)) FROM item_folder_headers ifh JOIN item_folders ifo ON ifo.id = ifh.folder_id JOIN fridges f ON f.id = ifo.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'inventory_items', COALESCE((SELECT jsonb_agg(row_to_json(ii.*)) FROM inventory_items ii JOIN fridges f ON f.id = ii.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'item_custom_values', COALESCE((SELECT jsonb_agg(row_to_json(icv.*)) FROM item_custom_values icv JOIN inventory_items ii ON ii.id = icv.item_id JOIN fridges f ON f.id = ii.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'slide_box_headers', COALESCE((SELECT jsonb_agg(row_to_json(sbh.*)) FROM slide_box_headers sbh JOIN fridge_boxes fb ON fb.id = sbh.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'slide_cell_values', COALESCE((SELECT jsonb_agg(row_to_json(scv.*)) FROM slide_cell_values scv JOIN fridge_cells fc ON fc.id = scv.cell_id JOIN fridge_boxes fb ON fb.id = fc.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'box_grid_item_links', COALESCE((SELECT jsonb_agg(row_to_json(bgl.*)) FROM box_grid_item_links bgl JOIN fridge_boxes fb ON fb.id = bgl.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'saved_search_filters', COALESCE((SELECT jsonb_agg(row_to_json(ssf.*)) FROM saved_search_filters ssf WHERE ssf.workspace_id = v_ws.id), '[]'::jsonb),
'box_privacy_settings', COALESCE((SELECT jsonb_agg(row_to_json(bps.*)) FROM box_privacy_settings bps JOIN fridge_boxes fb ON fb.id = bps.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'box_access_list', COALESCE((SELECT jsonb_agg(row_to_json(bal.*)) FROM box_access_list bal JOIN fridge_boxes fb ON fb.id = bal.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'box_qr_codes', COALESCE((SELECT jsonb_agg(row_to_json(bqr.*)) FROM box_qr_codes bqr WHERE bqr.workspace_id = v_ws.id), '[]'::jsonb),
'projects', COALESCE((SELECT jsonb_agg(row_to_json(pr.*)) FROM projects pr WHERE pr.workspace_id = v_ws.id), '[]'::jsonb),
'experiments', COALESCE((SELECT jsonb_agg(row_to_json(ex.*)) FROM experiments ex JOIN projects pr ON pr.id = ex.project_id WHERE pr.workspace_id = v_ws.id), '[]'::jsonb),
'project_box_links', COALESCE((SELECT jsonb_agg(row_to_json(pbl.*)) FROM project_box_links pbl JOIN projects pr ON pr.id = pbl.project_id WHERE pr.workspace_id = v_ws.id), '[]'::jsonb),
'project_item_links', COALESCE((SELECT jsonb_agg(row_to_json(pil.*)) FROM project_item_links pil JOIN projects pr ON pr.id = pil.project_id WHERE pr.workspace_id = v_ws.id), '[]'::jsonb),
'project_privacy_settings', COALESCE((SELECT jsonb_agg(row_to_json(pps.*)) FROM project_privacy_settings pps JOIN projects pr ON pr.id = pps.project_id WHERE pr.workspace_id = v_ws.id), '[]'::jsonb),
'project_access_list', COALESCE((SELECT jsonb_agg(row_to_json(pal.*)) FROM project_access_list pal JOIN projects pr ON pr.id = pal.project_id WHERE pr.workspace_id = v_ws.id), '[]'::jsonb)
);

v_size := octet_length(v_snapshot::text);

INSERT INTO workspace_backups (workspace_id, created_by, backup_data, backup_date, file_size_bytes, backup_type, label)
VALUES (v_ws.id, v_owner_tm_id, v_snapshot, CURRENT_DATE, v_size, 'auto', NULL)
ON CONFLICT (workspace_id, backup_date) WHERE backup_type = 'auto'
DO UPDATE SET backup_data = EXCLUDED.backup_data, file_size_bytes = EXCLUDED.file_size_bytes, created_by = EXCLUDED.created_by, created_at = now();

DELETE FROM workspace_backups WHERE workspace_id = v_ws.id AND backup_type = 'auto' AND backup_date < CURRENT_DATE - INTERVAL '7 days';
END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_workspace_backup(p_backup_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_role text;
v_btype text;
BEGIN
SELECT workspace_id, backup_type INTO v_ws_id, v_btype FROM workspace_backups WHERE id = p_backup_id;
IF v_ws_id IS NULL THEN RAISE EXCEPTION 'Backup not found'; END IF;
IF v_btype = 'auto' THEN RAISE EXCEPTION 'Auto-backups rotate automatically and cannot be deleted manually.'; END IF;

SELECT role INTO v_role FROM team_members WHERE auth_user_id = auth.uid() AND workspace_id = v_ws_id;
IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
RAISE EXCEPTION 'Only owners and managers can delete backups';
END IF;

DELETE FROM workspace_backups WHERE id = p_backup_id;
RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_ai_inventory_context(p_team_member_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_workspace_id uuid;
v_is_workspace_owner boolean;
v_result json;
BEGIN
-- Get workspace_id from the team member
SELECT tm.workspace_id INTO v_workspace_id
FROM team_members tm
WHERE tm.id = p_team_member_id;

IF v_workspace_id IS NULL THEN
RETURN json_build_object('error', 'No workspace found for team member');
END IF;

-- Check if user is workspace owner
SELECT EXISTS(
SELECT 1 FROM workspaces w
WHERE w.id = v_workspace_id AND w.owner_id = p_team_member_id
) INTO v_is_workspace_owner;

SELECT json_build_object(
'locations', (
SELECT COALESCE(json_agg(json_build_object(
'id', f.id,
'name', f.name,
'location_type', f.location_type
) ORDER BY f.display_order, f.name), '[]'::json)
FROM fridges f
WHERE f.workspace_id = v_workspace_id
),
'sublocations', (
SELECT COALESCE(json_agg(json_build_object(
'id', fs.id,
'name', fs.name,
'location_type', fs.location_type,
'fridge_name', f.name
) ORDER BY f.name, fs.display_order, fs.name), '[]'::json)
FROM fridge_sublocations fs
JOIN fridges f ON f.id = fs.fridge_id
WHERE f.workspace_id = v_workspace_id
),
'positions', (
SELECT COALESCE(json_agg(json_build_object(
'id', sp.id,
'name', sp.name,
'location_type', sp.location_type,
'sublocation_name', fs.name,
'fridge_name', f.name
) ORDER BY f.name, fs.name, sp.display_order, sp.name), '[]'::json)
FROM sublocation_positions sp
JOIN fridge_sublocations fs ON fs.id = sp.sublocation_id
JOIN fridges f ON f.id = fs.fridge_id
WHERE f.workspace_id = v_workspace_id
),
'boxes', (
SELECT COALESCE(json_agg(json_build_object(
'id', fb.id,
'name', fb.name,
'box_type', fb.box_type,
'rows', fb.rows,
'columns', fb.columns,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name
) ORDER BY f.name, fb.name), '[]'::json)
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND (
v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
),
'cells', (
SELECT COALESCE(json_agg(json_build_object(
'name', fc.name,
'information', fc.information,
'date', fc.date,
'date_type', fc.date_type,
'cell_id', fc.cell_id,
'box_name', fb.name,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name
)), '[]'::json)
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND fc.name != ''
AND fc.is_crossed = false
AND (
v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
),
'slide_data', (
SELECT COALESCE(json_agg(json_build_object(
'cell_name', fc.name,
'header_text', sbh.header_text,
'header_type', sbh.header_type,
'value', scv.value,
'box_name', fb.name,
'box_type', fb.box_type,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name
)), '[]'::json)
FROM slide_cell_values scv
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND scv.value != ''
AND fc.is_crossed = false
AND (
v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
),
'items', (
SELECT COALESCE(json_agg(json_build_object(
'name', ii.name,
'description', ii.description,
'stock_number', ii.stock_number,
'unit', ii.unit,
'item_type', ii.item_type,
'stock_threshold', ii.stock_threshold,
'freeze_thaw_cycles', ii.freeze_thaw_cycles,
'display_mode', ii.display_mode,
'non_counted', ii.non_counted,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name,
'folder_name', ifld.name
) ORDER BY ii.name), '[]'::json)
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
LEFT JOIN item_folders ifld ON ifld.id = ii.folder_id
WHERE f.workspace_id = v_workspace_id
),
'item_custom_values', (
SELECT COALESCE(json_agg(json_build_object(
'item_name', ii.name,
'header_text', ifh.header_text,
'header_type', ifh.header_type,
'value', icv.value
)), '[]'::json)
FROM item_custom_values icv
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = v_workspace_id
AND icv.value != ''
),
'expirations', (
SELECT COALESCE(json_agg(json_build_object(
'source', sub.source,
'name', sub.name,
'expiration_date', sub.expiration_date,
'location_path', sub.location_path
) ORDER BY sub.expiration_date), '[]'::json)
FROM (
-- Cell expirations
SELECT 'cell' AS source,
fc.name AS name,
fc.date AS expiration_date,
f.name || COALESCE(' > ' || fs.name, '') || COALESCE(' > ' || sp.name, '') || ' > ' || fb.name AS location_path
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND fc.date_type = 'expiration'
AND fc.date IS NOT NULL
AND fc.is_crossed = false
AND (
v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
UNION ALL
-- Item expiration custom values
SELECT 'item' AS source,
ii.name AS name,
icv.value::date AS expiration_date,
f.name || COALESCE(' > ' || fs.name, '') || COALESCE(' > ' || sp.name, '') AS location_path
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE f.workspace_id = v_workspace_id
AND ifh.header_type = 'expiration'
AND icv.value != ''
AND icv.value ~ '^\d{4}-\d{2}-\d{2}$'
) sub
),
'low_stock_items', (
SELECT COALESCE(json_agg(json_build_object(
'name', ii.name,
'stock_number', ii.stock_number,
'stock_threshold', ii.stock_threshold,
'unit', ii.unit,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name
) ORDER BY ii.stock_number), '[]'::json)
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE f.workspace_id = v_workspace_id
AND ii.non_counted = false
AND ii.stock_threshold IS NOT NULL
AND ii.stock_number <= ii.stock_threshold
),
'team_info', (
SELECT json_build_object(
'total_members', COUNT(*),
'owners', COUNT(*) FILTER (WHERE tm.role = 'owner'),
'managers', COUNT(*) FILTER (WHERE tm.role = 'manager'),
'members', COUNT(*) FILTER (WHERE tm.role = 'member'),
'member_names', COALESCE(json_agg(json_build_object(
'display_name', COALESCE(tm.display_name, split_part(tm.email, '@', 1)),
'role', tm.role
) ORDER BY tm.role, tm.display_name), '[]'::json)
)
FROM team_members tm
WHERE tm.workspace_id = v_workspace_id
AND tm.role IS NOT NULL
),
'overview_stats', (
SELECT json_build_object(
'location_count', (SELECT COUNT(*) FROM fridges WHERE workspace_id = v_workspace_id),
'sublocation_count', (SELECT COUNT(*) FROM fridge_sublocations fs2 JOIN fridges f2 ON f2.id = fs2.fridge_id WHERE f2.workspace_id = v_workspace_id),
'position_count', (SELECT COUNT(*) FROM sublocation_positions sp2 JOIN fridge_sublocations fs2 ON fs2.id = sp2.sublocation_id JOIN fridges f2 ON f2.id = fs2.fridge_id WHERE f2.workspace_id = v_workspace_id),
'box_count', (SELECT COUNT(*) FROM fridge_boxes fb2 JOIN fridges f2 ON f2.id = fb2.fridge_id WHERE f2.workspace_id = v_workspace_id),
'item_count', (SELECT COUNT(*) FROM inventory_items ii2 JOIN fridges f2 ON f2.id = ii2.fridge_id WHERE f2.workspace_id = v_workspace_id),
'folder_count', (SELECT COUNT(*) FROM item_folders ifl2 JOIN fridges f2 ON f2.id = ifl2.fridge_id WHERE f2.workspace_id = v_workspace_id)
)
),
'blocked_box_count', (
SELECT COUNT(*)
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND NOT v_is_workspace_owner
AND bps.privacy_mode = 'restricted'
AND bps.owner_id != p_team_member_id
AND NOT EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
) INTO v_result;

RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_ai_inventory_context_v2(p_team_member_id uuid, p_sections text[], p_search_terms text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_workspace_id uuid;
v_is_workspace_owner boolean;
v_result json;
v_locations json := NULL;
v_sublocations json := NULL;
v_positions json := NULL;
v_boxes json := NULL;
v_cells json := NULL;
v_slide_data json := NULL;
v_items json := NULL;
v_item_custom_values json := NULL;
v_expirations json := NULL;
v_low_stock_items json := NULL;
v_team_info json := NULL;
v_overview_stats json := NULL;
v_blocked_box_count bigint := 0;
BEGIN
-- Get workspace_id from the team member
SELECT tm.workspace_id INTO v_workspace_id
FROM team_members tm
WHERE tm.id = p_team_member_id;

IF v_workspace_id IS NULL THEN
RETURN json_build_object('error', 'No workspace found for team member');
END IF;

-- Check if user is workspace owner
SELECT EXISTS(
SELECT 1 FROM workspaces w
WHERE w.id = v_workspace_id AND w.owner_id = p_team_member_id
) INTO v_is_workspace_owner;

-- LOCATIONS
IF 'locations' = ANY(p_sections) THEN
SELECT COALESCE(json_agg(json_build_object(
'name', f.name,
'location_type', f.location_type
) ORDER BY f.display_order, f.name), '[]'::json)
INTO v_locations
FROM fridges f
WHERE f.workspace_id = v_workspace_id;
END IF;

-- SUBLOCATIONS
IF 'sublocations' = ANY(p_sections) THEN
SELECT COALESCE(json_agg(json_build_object(
'name', fs.name,
'location_type', fs.location_type,
'fridge_name', f.name
) ORDER BY f.name, fs.display_order, fs.name), '[]'::json)
INTO v_sublocations
FROM fridge_sublocations fs
JOIN fridges f ON f.id = fs.fridge_id
WHERE f.workspace_id = v_workspace_id;
END IF;

-- POSITIONS
IF 'positions' = ANY(p_sections) THEN
SELECT COALESCE(json_agg(json_build_object(
'name', sp.name,
'location_type', sp.location_type,
'sublocation_name', fs.name,
'fridge_name', f.name
) ORDER BY f.name, fs.name, sp.display_order, sp.name), '[]'::json)
INTO v_positions
FROM sublocation_positions sp
JOIN fridge_sublocations fs ON fs.id = sp.sublocation_id
JOIN fridges f ON f.id = fs.fridge_id
WHERE f.workspace_id = v_workspace_id;
END IF;

-- BOXES
IF 'boxes' = ANY(p_sections) THEN
SELECT COALESCE(json_agg(json_build_object(
'name', fb.name,
'box_type', fb.box_type,
'rows', fb.rows,
'columns', fb.columns,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name
) ORDER BY f.name, fb.name), '[]'::json)
INTO v_boxes
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND (
v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
);
END IF;

-- CELLS (with optional search term filtering)
IF 'cells' = ANY(p_sections) THEN
IF p_search_terms IS NOT NULL AND p_search_terms != '' THEN
SELECT COALESCE(json_agg(json_build_object(
'name', fc.name,
'information', fc.information,
'date', fc.date,
'date_type', fc.date_type,
'cell_id', fc.cell_id,
'box_name', fb.name,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name
)), '[]'::json)
INTO v_cells
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND fc.name != ''
AND fc.is_crossed = false
AND fc.name ILIKE '%' || p_search_terms || '%'
AND (
v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
);
ELSE
SELECT COALESCE(json_agg(json_build_object(
'name', fc.name,
'information', fc.information,
'date', fc.date,
'date_type', fc.date_type,
'cell_id', fc.cell_id,
'box_name', fb.name,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name
)), '[]'::json)
INTO v_cells
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND fc.name != ''
AND fc.is_crossed = false
AND (
v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
);
END IF;
END IF;

-- SLIDE DATA
IF 'slide_data' = ANY(p_sections) THEN
IF p_search_terms IS NOT NULL AND p_search_terms != '' THEN
SELECT COALESCE(json_agg(json_build_object(
'cell_name', fc.name,
'header_text', sbh.header_text,
'header_type', sbh.header_type,
'value', scv.value,
'box_name', fb.name,
'box_type', fb.box_type,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name
)), '[]'::json)
INTO v_slide_data
FROM slide_cell_values scv
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND scv.value != ''
AND fc.is_crossed = false
AND fc.name ILIKE '%' || p_search_terms || '%'
AND (
v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
);
ELSE
SELECT COALESCE(json_agg(json_build_object(
'cell_name', fc.name,
'header_text', sbh.header_text,
'header_type', sbh.header_type,
'value', scv.value,
'box_name', fb.name,
'box_type', fb.box_type,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name
)), '[]'::json)
INTO v_slide_data
FROM slide_cell_values scv
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND scv.value != ''
AND fc.is_crossed = false
AND (
v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
);
END IF;
END IF;

-- ITEMS (with optional search term filtering)
IF 'items' = ANY(p_sections) THEN
IF p_search_terms IS NOT NULL AND p_search_terms != '' THEN
SELECT COALESCE(json_agg(json_build_object(
'name', ii.name,
'description', ii.description,
'stock_number', ii.stock_number,
'unit', ii.unit,
'item_type', ii.item_type,
'stock_threshold', ii.stock_threshold,
'freeze_thaw_cycles', ii.freeze_thaw_cycles,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name,
'folder_name', ifld.name
) ORDER BY ii.name), '[]'::json)
INTO v_items
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
LEFT JOIN item_folders ifld ON ifld.id = ii.folder_id
WHERE f.workspace_id = v_workspace_id
AND ii.name ILIKE '%' || p_search_terms || '%';
ELSE
SELECT COALESCE(json_agg(json_build_object(
'name', ii.name,
'description', ii.description,
'stock_number', ii.stock_number,
'unit', ii.unit,
'item_type', ii.item_type,
'stock_threshold', ii.stock_threshold,
'freeze_thaw_cycles', ii.freeze_thaw_cycles,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name,
'folder_name', ifld.name
) ORDER BY ii.name), '[]'::json)
INTO v_items
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
LEFT JOIN item_folders ifld ON ifld.id = ii.folder_id
WHERE f.workspace_id = v_workspace_id;
END IF;
END IF;

-- ITEM CUSTOM VALUES
IF 'item_custom_values' = ANY(p_sections) THEN
SELECT COALESCE(json_agg(json_build_object(
'item_name', ii.name,
'header_text', ifh.header_text,
'header_type', ifh.header_type,
'value', icv.value
)), '[]'::json)
INTO v_item_custom_values
FROM item_custom_values icv
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = v_workspace_id
AND icv.value != '';
END IF;

-- EXPIRATIONS
IF 'expirations' = ANY(p_sections) THEN
SELECT COALESCE(json_agg(json_build_object(
'source', sub.source,
'name', sub.name,
'expiration_date', sub.expiration_date,
'location_path', sub.location_path
) ORDER BY sub.expiration_date), '[]'::json)
INTO v_expirations
FROM (
SELECT 'cell' AS source,
fc.name AS name,
fc.date AS expiration_date,
f.name || COALESCE(' > ' || fs.name, '') || COALESCE(' > ' || sp.name, '') || ' > ' || fb.name AS location_path
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND fc.date_type = 'expiration'
AND fc.date IS NOT NULL
AND fc.is_crossed = false
AND (
v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
UNION ALL
SELECT 'item' AS source,
ii.name AS name,
icv.value::date AS expiration_date,
f.name || COALESCE(' > ' || fs.name, '') || COALESCE(' > ' || sp.name, '') AS location_path
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE f.workspace_id = v_workspace_id
AND ifh.header_type = 'expiration'
AND icv.value != ''
AND icv.value ~ '^\d{4}-\d{2}-\d{2}$'
) sub;
END IF;

-- LOW STOCK ITEMS
IF 'low_stock_items' = ANY(p_sections) THEN
SELECT COALESCE(json_agg(json_build_object(
'name', ii.name,
'stock_number', ii.stock_number,
'stock_threshold', ii.stock_threshold,
'unit', ii.unit,
'fridge_name', f.name,
'sublocation_name', fs.name,
'position_name', sp.name
) ORDER BY ii.stock_number), '[]'::json)
INTO v_low_stock_items
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE f.workspace_id = v_workspace_id
AND ii.non_counted = false
AND ii.stock_threshold IS NOT NULL
AND ii.stock_number <= ii.stock_threshold;
END IF;

-- TEAM INFO
IF 'team_info' = ANY(p_sections) THEN
SELECT json_build_object(
'total_members', COUNT(*),
'owners', COUNT(*) FILTER (WHERE tm.role = 'owner'),
'managers', COUNT(*) FILTER (WHERE tm.role = 'manager'),
'members', COUNT(*) FILTER (WHERE tm.role = 'member'),
'member_names', COALESCE(json_agg(json_build_object(
'display_name', COALESCE(tm.display_name, split_part(tm.email, '@', 1)),
'role', tm.role
) ORDER BY tm.role, tm.display_name), '[]'::json)
)
INTO v_team_info
FROM team_members tm
WHERE tm.workspace_id = v_workspace_id
AND tm.role IS NOT NULL;
END IF;

-- OVERVIEW STATS
IF 'overview_stats' = ANY(p_sections) THEN
SELECT json_build_object(
'location_count', (SELECT COUNT(*) FROM fridges WHERE workspace_id = v_workspace_id),
'sublocation_count', (SELECT COUNT(*) FROM fridge_sublocations fs2 JOIN fridges f2 ON f2.id = fs2.fridge_id WHERE f2.workspace_id = v_workspace_id),
'position_count', (SELECT COUNT(*) FROM sublocation_positions sp2 JOIN fridge_sublocations fs2 ON fs2.id = sp2.sublocation_id JOIN fridges f2 ON f2.id = fs2.fridge_id WHERE f2.workspace_id = v_workspace_id),
'box_count', (SELECT COUNT(*) FROM fridge_boxes fb2 JOIN fridges f2 ON f2.id = fb2.fridge_id WHERE f2.workspace_id = v_workspace_id),
'item_count', (SELECT COUNT(*) FROM inventory_items ii2 JOIN fridges f2 ON f2.id = ii2.fridge_id WHERE f2.workspace_id = v_workspace_id),
'folder_count', (SELECT COUNT(*) FROM item_folders ifl2 JOIN fridges f2 ON f2.id = ifl2.fridge_id WHERE f2.workspace_id = v_workspace_id)
)
INTO v_overview_stats;
END IF;

-- BLOCKED BOX COUNT (always included)
SELECT COUNT(*)
INTO v_blocked_box_count
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE f.workspace_id = v_workspace_id
AND NOT v_is_workspace_owner
AND bps.privacy_mode = 'restricted'
AND bps.owner_id != p_team_member_id
AND NOT EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id);

-- Build result
v_result := json_build_object(
'locations', v_locations,
'sublocations', v_sublocations,
'positions', v_positions,
'boxes', v_boxes,
'cells', v_cells,
'slide_data', v_slide_data,
'items', v_items,
'item_custom_values', v_item_custom_values,
'expirations', v_expirations,
'low_stock_items', v_low_stock_items,
'team_info', v_team_info,
'overview_stats', v_overview_stats,
'blocked_box_count', v_blocked_box_count
);

RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_backup_stats(p_backup_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_data jsonb;
v_team_member_id uuid;
BEGIN
SELECT workspace_id, backup_data INTO v_ws_id, v_data
FROM workspace_backups WHERE id = p_backup_id;

IF v_ws_id IS NULL THEN
RAISE EXCEPTION 'Backup not found';
END IF;

SELECT id INTO v_team_member_id
FROM team_members
WHERE auth_user_id = auth.uid() AND workspace_id = v_ws_id;

IF v_team_member_id IS NULL THEN
RAISE EXCEPTION 'Not a member of this workspace';
END IF;

RETURN jsonb_build_object(
'fridges', COALESCE(jsonb_array_length(v_data->'fridges'), 0),
'boxes', COALESCE(jsonb_array_length(v_data->'fridge_boxes'), 0),
'cells', COALESCE(jsonb_array_length(v_data->'fridge_cells'), 0),
'items', COALESCE(jsonb_array_length(v_data->'inventory_items'), 0),
'folders', COALESCE(jsonb_array_length(v_data->'item_folders'), 0),
'projects', COALESCE(jsonb_array_length(v_data->'projects'), 0)
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_team_member_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT id FROM team_members WHERE auth_user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT workspace_id FROM team_members WHERE auth_user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_workspace_freezer_box_headers()
 RETURNS TABLE(header_text text, header_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT DISTINCT sbh.header_text, sbh.header_type
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = get_user_workspace_id()
AND fb.box_type = 'structured_freezer'
ORDER BY sbh.header_text;
$function$;

CREATE OR REPLACE FUNCTION public.get_workspace_item_folder_headers()
 RETURNS TABLE(header_text text, header_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT DISTINCT ifh.header_text, ifh.header_type
FROM item_folder_headers ifh
JOIN item_folders ifo ON ifo.id = ifh.folder_id
JOIN fridges f ON f.id = ifo.fridge_id
WHERE f.workspace_id = get_user_workspace_id()
ORDER BY ifh.header_text;
$function$;

CREATE OR REPLACE FUNCTION public.get_workspace_item_folder_names()
 RETURNS TABLE(folder_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT DISTINCT ifo.name AS folder_name
FROM item_folders ifo
JOIN fridges f ON f.id = ifo.fridge_id
WHERE f.workspace_id = get_user_workspace_id()
ORDER BY folder_name;
$function$;

CREATE OR REPLACE FUNCTION public.get_workspace_overview_stats()
 RETURNS TABLE(location_count integer, sublocation_count integer, position_count integer, box_count integer, folder_count integer, item_count integer, expiring_soon_count integer, low_stock_count integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
ws_id uuid;
v_location_count integer;
v_sublocation_count integer;
v_position_count integer;
v_box_count integer;
v_folder_count integer;
v_item_count integer;
v_expiring_soon_count integer;
v_low_stock_count integer;
v_cutoff_date date;
BEGIN
ws_id := get_user_workspace_id();
IF ws_id IS NULL THEN
RETURN QUERY SELECT 0,0,0,0,0,0,0,0;
RETURN;
END IF;

v_cutoff_date := CURRENT_DATE + INTERVAL '30 days';

SELECT COUNT(*)::integer INTO v_location_count
FROM fridges WHERE workspace_id = ws_id;

SELECT COUNT(*)::integer INTO v_sublocation_count
FROM fridge_sublocations fs
JOIN fridges f ON f.id = fs.fridge_id
WHERE f.workspace_id = ws_id;

SELECT COUNT(*)::integer INTO v_position_count
FROM sublocation_positions sp
JOIN fridge_sublocations fs ON fs.id = sp.sublocation_id
JOIN fridges f ON f.id = fs.fridge_id
WHERE f.workspace_id = ws_id;

SELECT COUNT(*)::integer INTO v_box_count
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = ws_id;

SELECT COUNT(*)::integer INTO v_folder_count
FROM item_folders ifo
JOIN fridges f ON f.id = ifo.fridge_id
WHERE f.workspace_id = ws_id;

SELECT COUNT(*)::integer INTO v_item_count
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = ws_id;

-- Expiring soon: cells with date_type='expiration' expiring within 30 days
-- Plus item_custom_values with expiration-type folder headers within 30 days
SELECT COUNT(*)::integer INTO v_expiring_soon_count
FROM (
SELECT fc.id
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = ws_id
AND fc.date_type = 'expiration'
AND fc.date IS NOT NULL
AND fc.date != ''
AND fc.is_crossed = false
AND (fc.date::date) <= v_cutoff_date

UNION ALL

SELECT icv.id
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = ws_id
AND ifh.header_type = 'expiration'
AND icv.value IS NOT NULL
AND icv.value != ''
AND (icv.value::date) <= v_cutoff_date
) AS expiring;

-- Low stock
SELECT COUNT(*)::integer INTO v_low_stock_count
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
WHERE f.workspace_id = ws_id
AND ii.non_counted = false
AND ii.stock_threshold IS NOT NULL
AND ii.stock_number <= ii.stock_threshold;

RETURN QUERY SELECT
v_location_count,
v_sublocation_count,
v_position_count,
v_box_count,
v_folder_count,
v_item_count,
v_expiring_soon_count,
v_low_stock_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_workspace_slide_headers()
 RETURNS TABLE(header_text text, header_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT DISTINCT sbh.header_text, sbh.header_type
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
WHERE f.workspace_id = get_user_workspace_id()
AND fb.box_type = 'slide'
ORDER BY sbh.header_text;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
INSERT INTO public.team_members (email, auth_user_id, role, workspace_id, invited_by)
VALUES (
NEW.email,
NEW.id,
NULL,
NULL,
NULL
)
ON CONFLICT (email) DO UPDATE
SET auth_user_id = NEW.id
WHERE team_members.auth_user_id IS NULL;

RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_valid_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT EXISTS(
SELECT 1 FROM team_members 
WHERE auth_user_id = auth.uid() 
AND role IS NOT NULL 
AND workspace_id IS NOT NULL
);
$function$;

CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT EXISTS(
SELECT 1 FROM team_members 
WHERE auth_user_id = auth.uid() 
AND role = 'owner'
AND workspace_id IS NOT NULL
);
$function$;

CREATE OR REPLACE FUNCTION public.is_owner_or_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT EXISTS(
SELECT 1 FROM team_members 
WHERE auth_user_id = auth.uid() 
AND role IN ('owner', 'manager')
AND workspace_id IS NOT NULL
);
$function$;

CREATE OR REPLACE FUNCTION public.is_team_member()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT has_valid_access();
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner_without_workspace()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT EXISTS(
SELECT 1 FROM team_members 
WHERE auth_user_id = auth.uid() 
AND role = 'owner'
AND workspace_id IS NULL
);
$function$;

CREATE OR REPLACE FUNCTION public.reassign_box_ownership_on_member_removal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_workspace_owner_id uuid;
BEGIN
IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS NULL THEN
SELECT w.owner_id INTO v_workspace_owner_id
FROM workspaces w
WHERE w.id = OLD.workspace_id;

IF v_workspace_owner_id IS NOT NULL THEN
UPDATE box_privacy_settings
SET owner_id = v_workspace_owner_id, updated_at = now()
WHERE owner_id = OLD.id;
END IF;
END IF;
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reassign_project_ownership_on_member_removal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_workspace_owner_id uuid;
BEGIN
IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS NULL THEN
SELECT w.owner_id INTO v_workspace_owner_id
FROM workspaces w
WHERE w.id = OLD.workspace_id;

IF v_workspace_owner_id IS NOT NULL THEN
UPDATE project_privacy_settings
SET owner_id = v_workspace_owner_id, updated_at = now()
WHERE owner_id = OLD.id;
END IF;
END IF;
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_box_access(p_box_id uuid, p_team_member_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_workspace_owner_id uuid;
v_privacy box_privacy_settings;
v_access_level text;
BEGIN
SELECT w.owner_id INTO v_workspace_owner_id
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
JOIN workspaces w ON w.id = f.workspace_id
WHERE fb.id = p_box_id;

IF v_workspace_owner_id IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM team_members
WHERE id = p_team_member_id AND auth_user_id = (
SELECT auth_user_id FROM team_members tm2
JOIN workspaces w2 ON w2.owner_id = tm2.id
JOIN fridges f2 ON f2.workspace_id = w2.id
JOIN fridge_boxes fb2 ON fb2.fridge_id = f2.id
WHERE fb2.id = p_box_id AND tm2.id = v_workspace_owner_id
LIMIT 1
)
) THEN
RETURN 'owner';
END IF;
IF p_team_member_id = v_workspace_owner_id THEN
RETURN 'owner';
END IF;
END IF;

SELECT * INTO v_privacy FROM box_privacy_settings WHERE box_id = p_box_id;

IF NOT FOUND OR v_privacy.privacy_mode = 'open' THEN
RETURN 'open';
END IF;

IF v_privacy.owner_id = p_team_member_id THEN
RETURN 'owner';
END IF;

SELECT bal.access_level INTO v_access_level
FROM box_access_list bal
WHERE bal.box_id = p_box_id AND bal.team_member_id = p_team_member_id;

IF FOUND THEN
RETURN v_access_level;
END IF;

RETURN 'none';
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_project_access(p_project_id uuid, p_team_member_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_workspace_owner_id uuid;
v_privacy project_privacy_settings;
v_access_level text;
BEGIN
SELECT w.owner_id INTO v_workspace_owner_id
FROM projects pr
JOIN workspaces w ON w.id = pr.workspace_id
WHERE pr.id = p_project_id;

IF v_workspace_owner_id IS NOT NULL THEN
IF p_team_member_id = v_workspace_owner_id THEN
RETURN 'owner';
END IF;
END IF;

SELECT * INTO v_privacy FROM project_privacy_settings WHERE project_id = p_project_id;

IF NOT FOUND OR v_privacy.privacy_mode = 'open' THEN
RETURN 'open';
END IF;

IF v_privacy.owner_id = p_team_member_id THEN
RETURN 'owner';
END IF;

SELECT pal.access_level INTO v_access_level
FROM project_access_list pal
WHERE pal.project_id = p_project_id AND pal.team_member_id = p_team_member_id;

IF FOUND THEN
RETURN v_access_level;
END IF;

RETURN 'none';
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_qr_token(p_token text)
 RETURNS TABLE(box_id uuid, workspace_id uuid, fridge_id uuid, sublocation_id uuid, position_id uuid, box_type text, box_name text, accent_color text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
RETURN QUERY
SELECT
qr.box_id,
qr.workspace_id,
fb.fridge_id,
fb.sublocation_id,
fb.position_id,
fb.box_type,
fb.name AS box_name,
fb.accent_color
FROM box_qr_codes qr
JOIN fridge_boxes fb ON fb.id = qr.box_id
WHERE qr.token = p_token
AND qr.revoked_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_workspace_backup(p_backup_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_team_member_id uuid;
v_role text;
v_backup record;
v_data jsonb;
v_ws_id uuid;
v_elem jsonb;
BEGIN
SELECT * INTO v_backup FROM workspace_backups WHERE id = p_backup_id;
IF v_backup IS NULL THEN RAISE EXCEPTION 'Backup not found'; END IF;
v_ws_id := v_backup.workspace_id;
v_data := v_backup.backup_data;

SELECT id, role INTO v_team_member_id, v_role FROM team_members WHERE auth_user_id = auth.uid() AND workspace_id = v_ws_id;
IF v_team_member_id IS NULL THEN RAISE EXCEPTION 'Not a member of this workspace'; END IF;
IF v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'Only owners and managers can restore backups'; END IF;

-- Delete all existing data in reverse dependency order
-- Project-related tables
DELETE FROM project_access_list WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = v_ws_id);
DELETE FROM project_privacy_settings WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = v_ws_id);
DELETE FROM project_item_links WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = v_ws_id);
DELETE FROM project_box_links WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = v_ws_id);
DELETE FROM experiments WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = v_ws_id);
DELETE FROM projects WHERE workspace_id = v_ws_id;

-- Box QR codes
DELETE FROM box_qr_codes WHERE workspace_id = v_ws_id;

-- Box privacy
DELETE FROM box_access_list WHERE box_id IN (SELECT fb.id FROM fridge_boxes fb JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws_id);
DELETE FROM box_privacy_settings WHERE box_id IN (SELECT fb.id FROM fridge_boxes fb JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws_id);

-- Core data tables
DELETE FROM slide_cell_values WHERE cell_id IN (SELECT fc.id FROM fridge_cells fc JOIN fridge_boxes fb ON fb.id = fc.box_id JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws_id);
DELETE FROM slide_box_headers WHERE box_id IN (SELECT fb.id FROM fridge_boxes fb JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws_id);
DELETE FROM item_custom_values WHERE item_id IN (SELECT ii.id FROM inventory_items ii JOIN fridges f ON f.id = ii.fridge_id WHERE f.workspace_id = v_ws_id);
DELETE FROM item_folder_headers WHERE folder_id IN (SELECT ifo.id FROM item_folders ifo JOIN fridges f ON f.id = ifo.fridge_id WHERE f.workspace_id = v_ws_id);
DELETE FROM box_grid_item_links WHERE box_id IN (SELECT fb.id FROM fridge_boxes fb JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws_id);
DELETE FROM box_history WHERE box_id IN (SELECT fb.id FROM fridge_boxes fb JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws_id);
DELETE FROM saved_search_filters WHERE workspace_id = v_ws_id;
DELETE FROM fridge_cells WHERE box_id IN (SELECT fb.id FROM fridge_boxes fb JOIN fridges f ON f.id = fb.fridge_id WHERE f.workspace_id = v_ws_id);
DELETE FROM inventory_items WHERE fridge_id IN (SELECT id FROM fridges WHERE workspace_id = v_ws_id);
DELETE FROM item_folders WHERE fridge_id IN (SELECT id FROM fridges WHERE workspace_id = v_ws_id);
DELETE FROM fridge_boxes WHERE fridge_id IN (SELECT id FROM fridges WHERE workspace_id = v_ws_id);
DELETE FROM sublocation_positions WHERE sublocation_id IN (SELECT fs.id FROM fridge_sublocations fs JOIN fridges f ON f.id = fs.fridge_id WHERE f.workspace_id = v_ws_id);
DELETE FROM fridge_sublocations WHERE fridge_id IN (SELECT id FROM fridges WHERE workspace_id = v_ws_id);
DELETE FROM fridges WHERE workspace_id = v_ws_id;

-- Restore workspace settings
UPDATE workspaces SET
name = COALESCE(v_data->'workspace_settings'->>'name', name),
live_sync_enabled = COALESCE((v_data->'workspace_settings'->>'live_sync_enabled')::boolean, live_sync_enabled),
auto_open_first_folder = COALESCE((v_data->'workspace_settings'->>'auto_open_first_folder')::boolean, auto_open_first_folder),
auto_open_first_item_folder = COALESCE((v_data->'workspace_settings'->>'auto_open_first_item_folder')::boolean, auto_open_first_item_folder),
colorful_icons_enabled = COALESCE((v_data->'workspace_settings'->>'colorful_icons_enabled')::boolean, colorful_icons_enabled),
auto_expand_all_locations = COALESCE((v_data->'workspace_settings'->>'auto_expand_all_locations')::boolean, auto_expand_all_locations),
hierarchical_navigation = COALESCE((v_data->'workspace_settings'->>'hierarchical_navigation')::boolean, hierarchical_navigation),
rotate_wide_grid_mobile = COALESCE((v_data->'workspace_settings'->>'rotate_wide_grid_mobile')::boolean, rotate_wide_grid_mobile),
updated_at = now()
WHERE id = v_ws_id;

-- Restore fridges
FOR v_elem IN SELECT jsonb_array_elements(v_data->'fridges') LOOP
INSERT INTO fridges (id, name, accent_color, display_order, workspace_id, show_storage_boxes, show_inventory_items, location_type, icon_id, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, v_elem->>'name', v_elem->>'accent_color', (v_elem->>'display_order')::integer, v_ws_id, COALESCE((v_elem->>'show_storage_boxes')::boolean, true), COALESCE((v_elem->>'show_inventory_items')::boolean, true), COALESCE(v_elem->>'location_type', 'fridge'), v_elem->>'icon_id', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore sublocations
FOR v_elem IN SELECT jsonb_array_elements(v_data->'fridge_sublocations') LOOP
INSERT INTO fridge_sublocations (id, fridge_id, name, accent_color, display_order, location_type, icon_id, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'fridge_id')::uuid, v_elem->>'name', v_elem->>'accent_color', (v_elem->>'display_order')::integer, COALESCE(v_elem->>'location_type', 'general'), v_elem->>'icon_id', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore positions
FOR v_elem IN SELECT jsonb_array_elements(v_data->'sublocation_positions') LOOP
INSERT INTO sublocation_positions (id, sublocation_id, name, accent_color, display_order, location_type, icon_id, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'sublocation_id')::uuid, v_elem->>'name', v_elem->>'accent_color', (v_elem->>'display_order')::integer, COALESCE(v_elem->>'location_type', 'general'), v_elem->>'icon_id', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore boxes
FOR v_elem IN SELECT jsonb_array_elements(v_data->'fridge_boxes') LOOP
INSERT INTO fridge_boxes (id, fridge_id, sublocation_id, position_id, name, description, accent_color, rows, columns, box_type, name_font_divisor, info_font_divisor, slide_font_divisor, constrain_grid_height, icon_id, display_order, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'fridge_id')::uuid, (v_elem->>'sublocation_id')::uuid, (v_elem->>'position_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'description', ''), v_elem->>'accent_color', COALESCE((v_elem->>'rows')::integer, 8), COALESCE((v_elem->>'columns')::integer, 12), COALESCE(v_elem->>'box_type', 'freezer'), COALESCE((v_elem->>'name_font_divisor')::integer, 8), COALESCE((v_elem->>'info_font_divisor')::integer, 10), COALESCE((v_elem->>'slide_font_divisor')::integer, 10), COALESCE((v_elem->>'constrain_grid_height')::boolean, true), v_elem->>'icon_id', COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore cells
FOR v_elem IN SELECT jsonb_array_elements(v_data->'fridge_cells') LOOP
INSERT INTO fridge_cells (id, cell_id, box_id, name, information, date, color, is_crossed, date_type, slide_image_url, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, v_elem->>'cell_id', (v_elem->>'box_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'information', ''), (v_elem->>'date')::date, v_elem->>'color', COALESCE((v_elem->>'is_crossed')::boolean, false), COALESCE(v_elem->>'date_type', 'date'), v_elem->>'slide_image_url', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore item folders
FOR v_elem IN SELECT jsonb_array_elements(v_data->'item_folders') LOOP
INSERT INTO item_folders (id, fridge_id, sublocation_id, position_id, name, description, accent_color, icon_id, display_order, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'fridge_id')::uuid, (v_elem->>'sublocation_id')::uuid, (v_elem->>'position_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'description', ''), v_elem->>'accent_color', v_elem->>'icon_id', COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore item folder headers
FOR v_elem IN SELECT jsonb_array_elements(v_data->'item_folder_headers') LOOP
INSERT INTO item_folder_headers (id, folder_id, header_text, header_type, display_order, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'folder_id')::uuid, COALESCE(v_elem->>'header_text', ''), COALESCE(v_elem->>'header_type', 'text'), COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()));
END LOOP;

-- Restore inventory items
FOR v_elem IN SELECT jsonb_array_elements(v_data->'inventory_items') LOOP
INSERT INTO inventory_items (id, fridge_id, sublocation_id, position_id, folder_id, name, description, stock_number, stock_threshold, unit, non_counted, item_type, accent_color, icon_id, display_order, freeze_thaw_cycles, display_mode, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'fridge_id')::uuid, (v_elem->>'sublocation_id')::uuid, (v_elem->>'position_id')::uuid, (v_elem->>'folder_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'description', ''), COALESCE((v_elem->>'stock_number')::integer, 0), (v_elem->>'stock_threshold')::integer, COALESCE(v_elem->>'unit', ''), COALESCE((v_elem->>'non_counted')::boolean, false), v_elem->>'item_type', v_elem->>'accent_color', v_elem->>'icon_id', COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'freeze_thaw_cycles')::integer, 0), COALESCE(v_elem->>'display_mode', 'stock'), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore item custom values
FOR v_elem IN SELECT jsonb_array_elements(v_data->'item_custom_values') LOOP
INSERT INTO item_custom_values (id, item_id, header_id, value, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'item_id')::uuid, (v_elem->>'header_id')::uuid, COALESCE(v_elem->>'value', ''), COALESCE((v_elem->>'created_at')::timestamptz, now()));
END LOOP;

-- Restore slide box headers
FOR v_elem IN SELECT jsonb_array_elements(v_data->'slide_box_headers') LOOP
INSERT INTO slide_box_headers (id, box_id, header_text, header_type, display_order, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid, COALESCE(v_elem->>'header_text', ''), COALESCE(v_elem->>'header_type', 'text'), COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()));
END LOOP;

-- Restore slide cell values
FOR v_elem IN SELECT jsonb_array_elements(v_data->'slide_cell_values') LOOP
INSERT INTO slide_cell_values (id, cell_id, header_id, value, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'cell_id')::uuid, (v_elem->>'header_id')::uuid, COALESCE(v_elem->>'value', ''), COALESCE((v_elem->>'created_at')::timestamptz, now()));
END LOOP;

-- Restore box grid item links
FOR v_elem IN SELECT jsonb_array_elements(v_data->'box_grid_item_links') LOOP
INSERT INTO box_grid_item_links (id, box_id, item_id, link_type, linked_name, linked_info, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid, (v_elem->>'item_id')::uuid, v_elem->>'link_type', v_elem->>'linked_name', v_elem->>'linked_info', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore saved search filters (skip orphaned team_member_id)
FOR v_elem IN SELECT jsonb_array_elements(v_data->'saved_search_filters') LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'team_member_id')::uuid) THEN
INSERT INTO saved_search_filters (id, workspace_id, team_member_id, filter_text, created_at)
VALUES ((v_elem->>'id')::uuid, v_ws_id, (v_elem->>'team_member_id')::uuid, v_elem->>'filter_text', COALESCE((v_elem->>'created_at')::timestamptz, now()));
END IF;
END LOOP;

-- Restore box privacy settings (skip orphaned owner_id)
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'box_privacy_settings', '[]'::jsonb)) LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'owner_id')::uuid) THEN
INSERT INTO box_privacy_settings (id, box_id, privacy_mode, owner_id, owner_only_delete, created_at, updated_at)
VALUES (
(v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid,
COALESCE(v_elem->>'privacy_mode', 'open'),
(v_elem->>'owner_id')::uuid,
COALESCE((v_elem->>'owner_only_delete')::boolean, false),
COALESCE((v_elem->>'created_at')::timestamptz, now()), now()
);
END IF;
END LOOP;

-- Restore box access list (skip orphaned team_member_id)
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'box_access_list', '[]'::jsonb)) LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'team_member_id')::uuid)
AND EXISTS (SELECT 1 FROM box_privacy_settings WHERE box_id = (v_elem->>'box_id')::uuid) THEN
INSERT INTO box_access_list (id, box_id, team_member_id, access_level, created_at)
VALUES (
(v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid,
(v_elem->>'team_member_id')::uuid,
v_elem->>'access_level',
COALESCE((v_elem->>'created_at')::timestamptz, now())
);
END IF;
END LOOP;

-- Restore box QR codes (skip orphaned created_by)
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'box_qr_codes', '[]'::jsonb)) LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'created_by')::uuid) THEN
INSERT INTO box_qr_codes (id, box_id, workspace_id, token, label, created_by, created_at, revoked_at)
VALUES (
(v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid, v_ws_id,
v_elem->>'token', v_elem->>'label',
(v_elem->>'created_by')::uuid,
COALESCE((v_elem->>'created_at')::timestamptz, now()),
(v_elem->>'revoked_at')::timestamptz
);
END IF;
END LOOP;

-- Restore projects
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'projects', '[]'::jsonb)) LOOP
INSERT INTO projects (id, workspace_id, name, icon_id, accent_color, display_order, created_at, updated_at)
VALUES (
(v_elem->>'id')::uuid, v_ws_id,
v_elem->>'name', v_elem->>'icon_id',
COALESCE(v_elem->>'accent_color', '#3b82f6'),
COALESCE((v_elem->>'display_order')::integer, 0),
COALESCE((v_elem->>'created_at')::timestamptz, now()), now()
);
END LOOP;

-- Restore experiments
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'experiments', '[]'::jsonb)) LOOP
INSERT INTO experiments (id, project_id, name, icon_id, accent_color, display_order, created_at, updated_at)
VALUES (
(v_elem->>'id')::uuid, (v_elem->>'project_id')::uuid,
v_elem->>'name', v_elem->>'icon_id',
COALESCE(v_elem->>'accent_color', '#3b82f6'),
COALESCE((v_elem->>'display_order')::integer, 0),
COALESCE((v_elem->>'created_at')::timestamptz, now()), now()
);
END LOOP;

-- Restore project box links
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'project_box_links', '[]'::jsonb)) LOOP
INSERT INTO project_box_links (id, project_id, experiment_id, box_id, display_order, created_at)
VALUES (
(v_elem->>'id')::uuid, (v_elem->>'project_id')::uuid,
(v_elem->>'experiment_id')::uuid, (v_elem->>'box_id')::uuid,
COALESCE((v_elem->>'display_order')::integer, 0),
COALESCE((v_elem->>'created_at')::timestamptz, now())
);
END LOOP;

-- Restore project item links
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'project_item_links', '[]'::jsonb)) LOOP
INSERT INTO project_item_links (id, project_id, experiment_id, item_id, display_order, created_at)
VALUES (
(v_elem->>'id')::uuid, (v_elem->>'project_id')::uuid,
(v_elem->>'experiment_id')::uuid, (v_elem->>'item_id')::uuid,
COALESCE((v_elem->>'display_order')::integer, 0),
COALESCE((v_elem->>'created_at')::timestamptz, now())
);
END LOOP;

-- Restore project privacy settings (skip orphaned owner_id)
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'project_privacy_settings', '[]'::jsonb)) LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'owner_id')::uuid) THEN
INSERT INTO project_privacy_settings (id, project_id, privacy_mode, owner_id, owner_only_delete, created_at, updated_at)
VALUES (
(v_elem->>'id')::uuid, (v_elem->>'project_id')::uuid,
COALESCE(v_elem->>'privacy_mode', 'open'),
(v_elem->>'owner_id')::uuid,
COALESCE((v_elem->>'owner_only_delete')::boolean, false),
COALESCE((v_elem->>'created_at')::timestamptz, now()), now()
);
END IF;
END LOOP;

-- Restore project access list (skip orphaned team_member_id)
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'project_access_list', '[]'::jsonb)) LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'team_member_id')::uuid)
AND EXISTS (SELECT 1 FROM project_privacy_settings WHERE project_id = (v_elem->>'project_id')::uuid) THEN
INSERT INTO project_access_list (id, project_id, team_member_id, access_level, created_at)
VALUES (
(v_elem->>'id')::uuid, (v_elem->>'project_id')::uuid,
(v_elem->>'team_member_id')::uuid,
v_elem->>'access_level',
COALESCE((v_elem->>'created_at')::timestamptz, now())
);
END IF;
END LOOP;

RETURN jsonb_build_object('success', true, 'restored_from', v_backup.backup_date);
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_workspace(search_query text, date_mode text DEFAULT NULL::text, date_start text DEFAULT NULL::text, date_end text DEFAULT NULL::text, filter_scopes text[] DEFAULT NULL::text[], filter_texts text[] DEFAULT NULL::text[], freezer_sub_filters text[] DEFAULT NULL::text[], slide_header_filters text[] DEFAULT NULL::text[], slide_date_mode text DEFAULT NULL::text, slide_date_start text DEFAULT NULL::text, slide_date_end text DEFAULT NULL::text, item_sub_filters text[] DEFAULT NULL::text[], item_header_filters text[] DEFAULT NULL::text[], item_folder_name_filter text DEFAULT NULL::text, item_date_mode text DEFAULT NULL::text, item_date_start text DEFAULT NULL::text, item_date_end text DEFAULT NULL::text, freezer_header_filters text[] DEFAULT NULL::text[], freezer_date_mode text DEFAULT NULL::text, freezer_date_start text DEFAULT NULL::text, freezer_date_end text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
result json;
pattern text;
skip_freezer boolean;
skip_slide boolean;
skip_item boolean;
skip_boxes boolean;
has_text_query boolean;
has_date_filter boolean;
has_slide_date boolean;
has_item_date boolean;
has_freezer_date boolean;
has_filters_only boolean;
freezer_combined_mode boolean;
slide_combined_mode boolean;
BEGIN
pattern := '%' || search_query || '%';
has_text_query := (search_query IS NOT NULL AND trim(search_query) <> '');
has_date_filter := (date_mode IS NOT NULL);
has_slide_date := (slide_date_mode IS NOT NULL AND slide_header_filters IS NOT NULL AND array_length(slide_header_filters, 1) > 0);
has_item_date := (item_date_mode IS NOT NULL AND item_header_filters IS NOT NULL AND array_length(item_header_filters, 1) > 0);
has_freezer_date := (freezer_date_mode IS NOT NULL AND freezer_header_filters IS NOT NULL AND array_length(freezer_header_filters, 1) > 0);

skip_freezer := (filter_scopes IS NOT NULL AND NOT ('freezer_box' = ANY(filter_scopes)));
skip_slide := (filter_scopes IS NOT NULL AND NOT ('slide_box' = ANY(filter_scopes)));
skip_item := (filter_scopes IS NOT NULL AND NOT ('item' = ANY(filter_scopes)));
skip_boxes := (filter_scopes IS NOT NULL AND NOT ('freezer_box' = ANY(filter_scopes)) AND NOT ('slide_box' = ANY(filter_scopes)));

has_filters_only := (
NOT has_text_query
AND NOT has_date_filter
AND NOT has_slide_date
AND NOT has_item_date
AND NOT has_freezer_date
AND (
filter_scopes IS NOT NULL
OR filter_texts IS NOT NULL
OR freezer_sub_filters IS NOT NULL
OR slide_header_filters IS NOT NULL
OR item_sub_filters IS NOT NULL
OR item_header_filters IS NOT NULL
OR item_folder_name_filter IS NOT NULL
OR freezer_header_filters IS NOT NULL
)
);

freezer_combined_mode := (
freezer_sub_filters IS NULL
OR (
'name' = ANY(freezer_sub_filters)
AND 'info' = ANY(freezer_sub_filters)
)
);
slide_combined_mode := (slide_header_filters IS NULL);

SELECT json_build_object(
'cell_matches', CASE
WHEN skip_freezer OR NOT freezer_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_freezer_date OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fc.name AS name,
fc.information AS information,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND (COALESCE(fc.name, '') <> '' OR COALESCE(fc.information, '') <> '')
AND (NOT has_text_query OR (COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '')) ILIKE pattern)
AND (filter_texts IS NULL OR (
SELECT bool_and((COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '')) ILIKE '%' || ft || '%')
FROM unnest(filter_texts) AS ft
))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 100
) t
), '[]'::json)
ELSE '[]'::json
END,

'structured_freezer_matches', CASE
WHEN skip_freezer OR NOT freezer_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_freezer_date OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
WITH sf_cell_agg AS (
SELECT
scv.cell_id AS cell_uuid,
string_agg(COALESCE(scv.value, ''), ' ' ORDER BY sbh.display_order) AS all_col_values,
json_agg(
json_build_object(
'header_text', sbh.header_text,
'value', scv.value,
'display_order', sbh.display_order
)
ORDER BY sbh.display_order
) AS values_array
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc2 ON fc2.id = scv.cell_id
JOIN fridge_boxes fb2 ON fb2.id = fc2.box_id
WHERE fb2.box_type = 'structured_freezer'
AND COALESCE(scv.value, '') <> ''
GROUP BY scv.cell_id
)
SELECT
fc.name AS name,
fc.information AS information,
sca.all_col_values AS aggregated_text,
sca.values_array AS values_array,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN sf_cell_agg sca ON sca.cell_uuid = fc.id
WHERE fb.box_type = 'structured_freezer'
AND (
COALESCE(fc.name, '') <> ''
OR COALESCE(fc.information, '') <> ''
OR sca.all_col_values IS NOT NULL
)
AND (NOT has_text_query OR (
COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '') || ' ' || COALESCE(sca.all_col_values, '')
) ILIKE pattern)
AND (filter_texts IS NULL OR (
SELECT bool_and(
(COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '') || ' ' || COALESCE(sca.all_col_values, ''))
ILIKE '%' || ft || '%'
)
FROM unnest(filter_texts) AS ft
))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 100
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_titles', CASE
WHEN skip_freezer OR freezer_combined_mode OR NOT ('name' = ANY(COALESCE(freezer_sub_filters, ARRAY[]::text[]))) THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.name)
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.name ILIKE pattern
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 50
) t
), '[]'::json)
WHEN has_date_filter AND NOT has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.name)
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.name <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_info', CASE
WHEN skip_freezer OR freezer_combined_mode THEN '[]'::json
WHEN NOT ('info' = ANY(COALESCE(freezer_sub_filters, ARRAY[]::text[]))) THEN '[]'::json
WHEN (freezer_header_filters IS NOT NULL AND array_length(freezer_header_filters, 1) > 0) THEN
COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
(
SELECT DISTINCT ON (fb.id, fc.information)
fc.information AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'freezer'
AND fc.information <> ''
AND (NOT has_text_query OR fc.information ILIKE pattern)
AND (filter_texts IS NULL OR (SELECT bool_and(fc.information ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 50
)
UNION ALL
(
SELECT
scv.value AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'structured_freezer'
AND scv.value <> ''
AND sbh.header_text = ANY(freezer_header_filters)
AND (NOT has_text_query OR scv.value ILIKE pattern)
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (NOT has_freezer_date OR (
sbh.header_type IN ('date', 'expiration')
AND scv.value <> ''
AND (
(freezer_date_mode = 'exact' AND scv.value::date = freezer_date_start::date)
OR (freezer_date_mode = 'range' AND scv.value::date >= freezer_date_start::date AND scv.value::date <= freezer_date_end::date)
OR (freezer_date_mode = 'before' AND scv.value::date <= freezer_date_start::date)
OR (freezer_date_mode = 'after' AND scv.value::date >= freezer_date_start::date)
OR (freezer_date_mode = 'expiring_within' AND sbh.header_type = 'expiration' AND scv.value::date >= CURRENT_DATE AND scv.value::date <= (CURRENT_DATE + freezer_date_end::int))
)
))
LIMIT 50
)
) t
), '[]'::json)
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.information)
fc.information AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.information ILIKE pattern AND fc.information <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.information ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 50
) t
), '[]'::json)
WHEN has_freezer_date THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
scv.value AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'structured_freezer'
AND scv.value <> ''
AND (freezer_header_filters IS NULL OR sbh.header_text = ANY(freezer_header_filters))
AND sbh.header_type IN ('date', 'expiration')
AND (
(freezer_date_mode = 'exact' AND scv.value::date = freezer_date_start::date)
OR (freezer_date_mode = 'range' AND scv.value::date >= freezer_date_start::date AND scv.value::date <= freezer_date_end::date)
OR (freezer_date_mode = 'before' AND scv.value::date <= freezer_date_start::date)
OR (freezer_date_mode = 'after' AND scv.value::date >= freezer_date_start::date)
OR (freezer_date_mode = 'expiring_within' AND sbh.header_type = 'expiration' AND scv.value::date >= CURRENT_DATE AND scv.value::date <= (CURRENT_DATE + freezer_date_end::int))
)
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
(
SELECT DISTINCT ON (fb.id, fc.information)
fc.information AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.information <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.information ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
)
UNION ALL
(
SELECT
scv.value AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'structured_freezer'
AND scv.value <> ''
AND (freezer_header_filters IS NULL OR sbh.header_text = ANY(freezer_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
)
) t
), '[]'::json)
ELSE '[]'::json
END,

'boxes', CASE
WHEN skip_boxes THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.name ILIKE pattern
AND (filter_scopes IS NULL OR
('freezer_box' = ANY(filter_scopes) AND fb.box_type IN ('freezer', 'structured_freezer')) OR
('slide_box' = ANY(filter_scopes) AND fb.box_type = 'slide'))
AND (filter_texts IS NULL OR (SELECT bool_and(fb.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR EXISTS (
SELECT 1 FROM fridge_cells fc2
WHERE fc2.box_id = fb.id AND fc2.date IS NOT NULL AND (
(date_mode = 'exact' AND fc2.date = date_start::date)
OR (date_mode = 'range' AND fc2.date >= date_start::date AND fc2.date <= date_end::date)
OR (date_mode = 'before' AND fc2.date <= date_start::date)
OR (date_mode = 'after' AND fc2.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc2.date_type = 'expiration' AND fc2.date >= CURRENT_DATE AND fc2.date <= (CURRENT_DATE + date_end::int))
)
))
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE (filter_scopes IS NULL OR
('freezer_box' = ANY(filter_scopes) AND fb.box_type IN ('freezer', 'structured_freezer')) OR
('slide_box' = ANY(filter_scopes) AND fb.box_type = 'slide'))
AND (filter_texts IS NULL OR (SELECT bool_and(fb.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'items', CASE
WHEN skip_item THEN '[]'::json
WHEN has_text_query OR has_item_date THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (NOT has_text_query OR ii.name ILIKE pattern)
AND (item_sub_filters IS NULL OR 'name' = ANY(item_sub_filters) OR 'column_header' = ANY(item_sub_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(ii.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_item_date OR EXISTS (
SELECT 1 FROM item_custom_values icv2
JOIN item_folder_headers ifh2 ON ifh2.id = icv2.header_id
WHERE icv2.item_id = ii.id
AND (item_header_filters IS NULL OR ifh2.header_text = ANY(item_header_filters))
AND ifh2.header_type IN ('date', 'expiration')
AND icv2.value <> ''
AND (
(item_date_mode = 'exact' AND icv2.value::date = item_date_start::date)
OR (item_date_mode = 'range' AND icv2.value::date >= item_date_start::date AND icv2.value::date <= item_date_end::date)
OR (item_date_mode = 'before' AND icv2.value::date <= item_date_start::date)
OR (item_date_mode = 'after' AND icv2.value::date >= item_date_start::date)
OR (item_date_mode = 'expiring_within' AND ifh2.header_type = 'expiration' AND icv2.value::date >= CURRENT_DATE AND icv2.value::date <= (CURRENT_DATE + item_date_end::int))
)
))
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (item_sub_filters IS NULL OR 'name' = ANY(item_sub_filters) OR 'column_header' = ANY(item_sub_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(ii.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'item_custom_values', CASE
WHEN skip_item THEN '[]'::json
WHEN (has_text_query OR has_item_date) AND (item_sub_filters IS NULL OR 'column_header' = ANY(item_sub_filters)) THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
icv.value AS matched_value, ifh.header_text AS header_text, ifh.display_order AS display_order,
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (NOT has_text_query OR (icv.value ILIKE pattern AND icv.value <> ''))
AND (item_header_filters IS NULL OR ifh.header_text = ANY(item_header_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(icv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_item_date OR (
ifh.header_type IN ('date', 'expiration')
AND (item_header_filters IS NULL OR ifh.header_text = ANY(item_header_filters))
AND icv.value <> ''
AND (
(item_date_mode = 'exact' AND icv.value::date = item_date_start::date)
OR (item_date_mode = 'range' AND icv.value::date >= item_date_start::date AND icv.value::date <= item_date_end::date)
OR (item_date_mode = 'before' AND icv.value::date <= item_date_start::date)
OR (item_date_mode = 'after' AND icv.value::date >= item_date_start::date)
OR (item_date_mode = 'expiring_within' AND ifh.header_type = 'expiration' AND icv.value::date >= CURRENT_DATE AND icv.value::date <= (CURRENT_DATE + item_date_end::int))
)
))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only AND (item_sub_filters IS NULL OR 'column_header' = ANY(item_sub_filters)) THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
icv.value AS matched_value, ifh.header_text AS header_text, ifh.display_order AS display_order,
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE icv.value <> ''
AND (item_header_filters IS NULL OR ifh.header_text = ANY(item_header_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(icv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_matches', CASE
WHEN skip_slide OR NOT slide_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
WITH cell_agg AS (
SELECT
scv.cell_id AS cell_uuid,
string_agg(COALESCE(scv.value, ''), ' ') AS all_values,
json_agg(
json_build_object(
'header_text', sbh.header_text,
'value', scv.value,
'display_order', sbh.display_order
)
ORDER BY sbh.display_order
) AS values_array
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
WHERE COALESCE(scv.value, '') <> ''
GROUP BY scv.cell_id
)
SELECT
ca.all_values AS aggregated_text,
ca.values_array AS values_array,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM cell_agg ca
JOIN fridge_cells fc ON fc.id = ca.cell_uuid
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'slide'
AND (NOT has_text_query OR ca.all_values ILIKE pattern)
AND (filter_texts IS NULL OR (
SELECT bool_and(ca.all_values ILIKE '%' || ft || '%')
FROM unnest(filter_texts) AS ft
))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 100
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_values', CASE
WHEN skip_slide OR slide_combined_mode THEN '[]'::json
WHEN has_text_query OR has_slide_date THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
scv.value AS matched_value, sbh.header_text AS header_text, sbh.display_order AS display_order,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'slide'
AND (NOT has_text_query OR (scv.value ILIKE pattern AND scv.value <> ''))
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (NOT has_slide_date OR EXISTS (
SELECT 1 FROM slide_cell_values scv2
JOIN slide_box_headers sbh2 ON sbh2.id = scv2.header_id
WHERE scv2.cell_id = scv.cell_id
AND (slide_header_filters IS NULL OR sbh2.header_text = ANY(slide_header_filters))
AND sbh2.header_type IN ('date', 'expiration')
AND scv2.value <> ''
AND (
(slide_date_mode = 'exact' AND scv2.value::date = slide_date_start::date)
OR (slide_date_mode = 'range' AND scv2.value::date >= slide_date_start::date AND scv2.value::date <= slide_date_end::date)
OR (slide_date_mode = 'before' AND scv2.value::date <= slide_date_start::date)
OR (slide_date_mode = 'after' AND scv2.value::date >= slide_date_start::date)
OR (slide_date_mode = 'expiring_within' AND sbh2.header_type = 'expiration' AND scv2.value::date >= CURRENT_DATE AND scv2.value::date <= (CURRENT_DATE + slide_date_end::int))
)
))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
scv.value AS matched_value, sbh.header_text AS header_text, sbh.display_order AS display_order,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'slide'
AND scv.value <> ''
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_headers', CASE
WHEN skip_slide THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
sbh.header_text AS header_text, sbh.display_order AS display_order,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'slide'
AND sbh.header_text ILIKE pattern
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(sbh.header_text ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR EXISTS (
SELECT 1 FROM fridge_cells fc2
WHERE fc2.box_id = fb.id AND fc2.date IS NOT NULL AND (
(date_mode = 'exact' AND fc2.date = date_start::date)
OR (date_mode = 'range' AND fc2.date >= date_start::date AND fc2.date <= date_end::date)
OR (date_mode = 'before' AND fc2.date <= date_start::date)
OR (date_mode = 'after' AND fc2.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc2.date_type = 'expiration' AND fc2.date >= CURRENT_DATE AND fc2.date <= (CURRENT_DATE + date_end::int))
)
))
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
sbh.header_text AS header_text, sbh.display_order AS display_order,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'slide'
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(sbh.header_text ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_dates', '[]'::json
) INTO result;

RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_workspace(search_query text, date_mode text DEFAULT NULL::text, date_start text DEFAULT NULL::text, date_end text DEFAULT NULL::text, date_type_target text DEFAULT NULL::text, filter_scopes text[] DEFAULT NULL::text[], filter_texts text[] DEFAULT NULL::text[], freezer_sub_filters text[] DEFAULT NULL::text[], slide_header_filters text[] DEFAULT NULL::text[], slide_date_filters text DEFAULT NULL::text, item_sub_filters text[] DEFAULT NULL::text[], item_header_filters text[] DEFAULT NULL::text[], item_folder_name_filter text DEFAULT NULL::text, item_date_filters text DEFAULT NULL::text, freezer_header_filters text[] DEFAULT NULL::text[], freezer_date_filters text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
result json;
pattern text;
skip_freezer boolean;
skip_slide boolean;
skip_item boolean;
skip_boxes boolean;
has_text_query boolean;
has_date_filter boolean;
has_slide_date boolean;
has_item_date boolean;
has_freezer_date boolean;
has_filters_only boolean;
freezer_combined_mode boolean;
slide_combined_mode boolean;
slide_date_json jsonb;
item_date_json jsonb;
freezer_date_json jsonb;
BEGIN
pattern := '%' || search_query || '%';
has_text_query := (search_query IS NOT NULL AND trim(search_query) <> '');
has_date_filter := (date_mode IS NOT NULL);

slide_date_json := CASE WHEN slide_date_filters IS NOT NULL THEN slide_date_filters::jsonb ELSE NULL END;
item_date_json := CASE WHEN item_date_filters IS NOT NULL THEN item_date_filters::jsonb ELSE NULL END;
freezer_date_json := CASE WHEN freezer_date_filters IS NOT NULL THEN freezer_date_filters::jsonb ELSE NULL END;

has_slide_date := (slide_date_json IS NOT NULL AND jsonb_array_length(slide_date_json) > 0);
has_item_date := (item_date_json IS NOT NULL AND jsonb_array_length(item_date_json) > 0);
has_freezer_date := (freezer_date_json IS NOT NULL AND jsonb_array_length(freezer_date_json) > 0);

skip_freezer := (filter_scopes IS NOT NULL AND NOT ('freezer_box' = ANY(filter_scopes)));
skip_slide := (filter_scopes IS NOT NULL AND NOT ('slide_box' = ANY(filter_scopes)));
skip_item := (filter_scopes IS NOT NULL AND NOT ('item' = ANY(filter_scopes)));
skip_boxes := (filter_scopes IS NOT NULL AND NOT ('freezer_box' = ANY(filter_scopes)) AND NOT ('slide_box' = ANY(filter_scopes)));

has_filters_only := (
NOT has_text_query
AND NOT has_date_filter
AND NOT has_slide_date
AND NOT has_item_date
AND NOT has_freezer_date
AND (
filter_scopes IS NOT NULL
OR filter_texts IS NOT NULL
OR freezer_sub_filters IS NOT NULL
OR slide_header_filters IS NOT NULL
OR item_sub_filters IS NOT NULL
OR item_header_filters IS NOT NULL
OR item_folder_name_filter IS NOT NULL
OR freezer_header_filters IS NOT NULL
)
);

freezer_combined_mode := (
freezer_sub_filters IS NULL
OR (
'name' = ANY(freezer_sub_filters)
AND 'info' = ANY(freezer_sub_filters)
)
);
slide_combined_mode := (slide_header_filters IS NULL);

SELECT json_build_object(
'cell_matches', CASE
WHEN skip_freezer OR NOT freezer_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_freezer_date OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fc.name AS name,
fc.information AS information,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND (COALESCE(fc.name, '') <> '' OR COALESCE(fc.information, '') <> '')
AND (NOT has_text_query OR (COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '')) ILIKE pattern)
AND (filter_texts IS NULL OR (
SELECT bool_and((COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '')) ILIKE '%' || ft || '%')
FROM unnest(filter_texts) AS ft
))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 100
) t
), '[]'::json)
ELSE '[]'::json
END,

'structured_freezer_matches', CASE
WHEN skip_freezer OR NOT freezer_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_freezer_date OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
WITH sf_cell_agg AS (
SELECT
scv.cell_id AS cell_uuid,
string_agg(COALESCE(scv.value, ''), ' ' ORDER BY sbh.display_order) AS all_col_values,
json_agg(
json_build_object(
'header_text', sbh.header_text,
'value', scv.value,
'display_order', sbh.display_order
)
ORDER BY sbh.display_order
) AS values_array
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc2 ON fc2.id = scv.cell_id
JOIN fridge_boxes fb2 ON fb2.id = fc2.box_id
WHERE fb2.box_type = 'structured_freezer'
AND COALESCE(scv.value, '') <> ''
GROUP BY scv.cell_id
)
SELECT
fc.name AS name,
fc.information AS information,
sca.all_col_values AS aggregated_text,
sca.values_array AS values_array,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN sf_cell_agg sca ON sca.cell_uuid = fc.id
WHERE fb.box_type = 'structured_freezer'
AND (
COALESCE(fc.name, '') <> ''
OR COALESCE(fc.information, '') <> ''
OR sca.all_col_values IS NOT NULL
)
AND (NOT has_text_query OR (
COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '') || ' ' || COALESCE(sca.all_col_values, '')
) ILIKE pattern)
AND (filter_texts IS NULL OR (
SELECT bool_and(
(COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '') || ' ' || COALESCE(sca.all_col_values, ''))
ILIKE '%' || ft || '%'
)
FROM unnest(filter_texts) AS ft
))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (NOT has_freezer_date OR NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(freezer_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM slide_cell_values scv3
JOIN slide_box_headers sbh3 ON sbh3.id = scv3.header_id
WHERE scv3.cell_id = fc.id
AND sbh3.header_text = (cdf->>'column_name')
AND sbh3.header_type IN ('date', 'expiration')
AND scv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND scv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND scv3.value::date >= (cdf->>'date_start')::date AND scv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND scv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND scv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND sbh3.header_type = 'expiration' AND scv3.value::date >= CURRENT_DATE AND scv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
))
LIMIT 100
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_titles', CASE
WHEN skip_freezer OR freezer_combined_mode OR NOT ('name' = ANY(COALESCE(freezer_sub_filters, ARRAY[]::text[]))) THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.name)
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.name ILIKE pattern
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 50
) t
), '[]'::json)
WHEN has_date_filter AND NOT has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.date IS NOT NULL
AND (CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END)
AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.name)
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.name <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_info', CASE
WHEN skip_freezer OR freezer_combined_mode THEN '[]'::json
WHEN NOT ('info' = ANY(COALESCE(freezer_sub_filters, ARRAY[]::text[]))) THEN '[]'::json
WHEN (freezer_header_filters IS NOT NULL AND array_length(freezer_header_filters, 1) > 0) THEN
COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
(
SELECT DISTINCT ON (fb.id, fc.information)
fc.information AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'freezer'
AND fc.information <> ''
AND (NOT has_text_query OR fc.information ILIKE pattern)
AND (filter_texts IS NULL OR (SELECT bool_and(fc.information ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 50
)
UNION ALL
(
SELECT
scv.value AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'structured_freezer'
AND scv.value <> ''
AND sbh.header_text = ANY(freezer_header_filters)
AND (NOT has_text_query OR scv.value ILIKE pattern)
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (NOT has_freezer_date OR NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(freezer_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM slide_cell_values scv3
JOIN slide_box_headers sbh3 ON sbh3.id = scv3.header_id
WHERE scv3.cell_id = fc.id
AND sbh3.header_text = (cdf->>'column_name')
AND sbh3.header_type IN ('date', 'expiration')
AND scv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND scv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND scv3.value::date >= (cdf->>'date_start')::date AND scv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND scv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND scv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND sbh3.header_type = 'expiration' AND scv3.value::date >= CURRENT_DATE AND scv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
))
LIMIT 50
)
) t
), '[]'::json)
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.information)
fc.information AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.information ILIKE pattern AND fc.information <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.information ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 50
) t
), '[]'::json)
WHEN has_freezer_date THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
scv.value AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'structured_freezer'
AND scv.value <> ''
AND (freezer_header_filters IS NULL OR sbh.header_text = ANY(freezer_header_filters))
AND NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(freezer_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM slide_cell_values scv3
JOIN slide_box_headers sbh3 ON sbh3.id = scv3.header_id
WHERE scv3.cell_id = fc.id
AND sbh3.header_text = (cdf->>'column_name')
AND sbh3.header_type IN ('date', 'expiration')
AND scv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND scv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND scv3.value::date >= (cdf->>'date_start')::date AND scv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND scv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND scv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND sbh3.header_type = 'expiration' AND scv3.value::date >= CURRENT_DATE AND scv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
)
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
(
SELECT DISTINCT ON (fb.id, fc.information)
fc.information AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.information <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.information ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
)
UNION ALL
(
SELECT
scv.value AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'structured_freezer'
AND scv.value <> ''
AND (freezer_header_filters IS NULL OR sbh.header_text = ANY(freezer_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
)
) t
), '[]'::json)
ELSE '[]'::json
END,

'boxes', CASE
WHEN skip_boxes THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.name ILIKE pattern
AND (filter_scopes IS NULL OR
('freezer_box' = ANY(filter_scopes) AND fb.box_type IN ('freezer', 'structured_freezer')) OR
('slide_box' = ANY(filter_scopes) AND fb.box_type = 'slide'))
AND (filter_texts IS NULL OR (SELECT bool_and(fb.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR EXISTS (
SELECT 1 FROM fridge_cells fc2
WHERE fc2.box_id = fb.id AND fc2.date IS NOT NULL
AND (CASE WHEN date_type_target = 'date' THEN fc2.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc2.date_type = 'expiration'
ELSE TRUE END)
AND (
(date_mode = 'exact' AND fc2.date = date_start::date)
OR (date_mode = 'range' AND fc2.date >= date_start::date AND fc2.date <= date_end::date)
OR (date_mode = 'before' AND fc2.date <= date_start::date)
OR (date_mode = 'after' AND fc2.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc2.date_type = 'expiration' AND fc2.date >= CURRENT_DATE AND fc2.date <= (CURRENT_DATE + date_end::int))
)
))
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE (filter_scopes IS NULL OR
('freezer_box' = ANY(filter_scopes) AND fb.box_type IN ('freezer', 'structured_freezer')) OR
('slide_box' = ANY(filter_scopes) AND fb.box_type = 'slide'))
AND (filter_texts IS NULL OR (SELECT bool_and(fb.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'items', CASE
WHEN skip_item THEN '[]'::json
WHEN has_text_query OR has_item_date THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (NOT has_text_query OR ii.name ILIKE pattern)
AND (item_sub_filters IS NULL OR 'name' = ANY(item_sub_filters) OR 'column_header' = ANY(item_sub_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(ii.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_item_date OR NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(item_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM item_custom_values icv3
JOIN item_folder_headers ifh3 ON ifh3.id = icv3.header_id
WHERE icv3.item_id = ii.id
AND ifh3.header_text = (cdf->>'column_name')
AND ifh3.header_type IN ('date', 'expiration')
AND icv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND icv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND icv3.value::date >= (cdf->>'date_start')::date AND icv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND icv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND icv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND ifh3.header_type = 'expiration' AND icv3.value::date >= CURRENT_DATE AND icv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
))
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (item_sub_filters IS NULL OR 'name' = ANY(item_sub_filters) OR 'column_header' = ANY(item_sub_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(ii.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'item_custom_values', CASE
WHEN skip_item THEN '[]'::json
WHEN (has_text_query OR has_item_date) AND (item_sub_filters IS NULL OR 'column_header' = ANY(item_sub_filters)) THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
icv.value AS matched_value, ifh.header_text AS header_text, ifh.display_order AS display_order,
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (NOT has_text_query OR (icv.value ILIKE pattern AND icv.value <> ''))
AND (item_header_filters IS NULL OR ifh.header_text = ANY(item_header_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(icv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_item_date OR NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(item_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM item_custom_values icv3
JOIN item_folder_headers ifh3 ON ifh3.id = icv3.header_id
WHERE icv3.item_id = ii.id
AND ifh3.header_text = (cdf->>'column_name')
AND ifh3.header_type IN ('date', 'expiration')
AND icv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND icv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND icv3.value::date >= (cdf->>'date_start')::date AND icv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND icv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND icv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND ifh3.header_type = 'expiration' AND icv3.value::date >= CURRENT_DATE AND icv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only AND (item_sub_filters IS NULL OR 'column_header' = ANY(item_sub_filters)) THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
icv.value AS matched_value, ifh.header_text AS header_text, ifh.display_order AS display_order,
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE icv.value <> ''
AND (item_header_filters IS NULL OR ifh.header_text = ANY(item_header_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(icv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_matches', CASE
WHEN skip_slide OR NOT slide_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
WITH cell_agg AS (
SELECT
scv.cell_id AS cell_uuid,
string_agg(COALESCE(scv.value, ''), ' ') AS all_values,
json_agg(
json_build_object(
'header_text', sbh.header_text,
'value', scv.value,
'display_order', sbh.display_order
)
ORDER BY sbh.display_order
) AS values_array
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
WHERE COALESCE(scv.value, '') <> ''
GROUP BY scv.cell_id
)
SELECT
ca.all_values AS aggregated_text,
ca.values_array AS values_array,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM cell_agg ca
JOIN fridge_cells fc ON fc.id = ca.cell_uuid
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'slide'
AND (NOT has_text_query OR ca.all_values ILIKE pattern)
AND (filter_texts IS NULL OR (
SELECT bool_and(ca.all_values ILIKE '%' || ft || '%')
FROM unnest(filter_texts) AS ft
))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 100
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_values', CASE
WHEN skip_slide OR slide_combined_mode THEN '[]'::json
WHEN has_text_query OR has_slide_date THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
scv.value AS matched_value, sbh.header_text AS header_text, sbh.display_order AS display_order,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'slide'
AND (NOT has_text_query OR (scv.value ILIKE pattern AND scv.value <> ''))
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (NOT has_slide_date OR NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(slide_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM slide_cell_values scv3
JOIN slide_box_headers sbh3 ON sbh3.id = scv3.header_id
WHERE scv3.cell_id = scv.cell_id
AND sbh3.header_text = (cdf->>'column_name')
AND sbh3.header_type IN ('date', 'expiration')
AND scv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND scv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND scv3.value::date >= (cdf->>'date_start')::date AND scv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND scv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND scv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND sbh3.header_type = 'expiration' AND scv3.value::date >= CURRENT_DATE AND scv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
scv.value AS matched_value, sbh.header_text AS header_text, sbh.display_order AS display_order,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'slide'
AND scv.value <> ''
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_headers', CASE
WHEN skip_slide THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
sbh.header_text AS header_text, sbh.display_order AS display_order,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'slide'
AND sbh.header_text ILIKE pattern
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(sbh.header_text ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR EXISTS (
SELECT 1 FROM fridge_cells fc2
WHERE fc2.box_id = fb.id AND fc2.date IS NOT NULL
AND (CASE WHEN date_type_target = 'date' THEN fc2.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc2.date_type = 'expiration'
ELSE TRUE END)
AND (
(date_mode = 'exact' AND fc2.date = date_start::date)
OR (date_mode = 'range' AND fc2.date >= date_start::date AND fc2.date <= date_end::date)
OR (date_mode = 'before' AND fc2.date <= date_start::date)
OR (date_mode = 'after' AND fc2.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc2.date_type = 'expiration' AND fc2.date >= CURRENT_DATE AND fc2.date <= (CURRENT_DATE + date_end::int))
)
))
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
sbh.header_text AS header_text, sbh.display_order AS display_order,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'slide'
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(sbh.header_text ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_dates', '[]'::json
) INTO result;

RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_workspace(search_query text, date_mode text DEFAULT NULL::text, date_start text DEFAULT NULL::text, date_end text DEFAULT NULL::text, filter_scopes text[] DEFAULT NULL::text[], filter_texts text[] DEFAULT NULL::text[], freezer_sub_filters text[] DEFAULT NULL::text[], slide_header_filters text[] DEFAULT NULL::text[], slide_date_mode text DEFAULT NULL::text, slide_date_start text DEFAULT NULL::text, slide_date_end text DEFAULT NULL::text, item_sub_filters text[] DEFAULT NULL::text[], item_header_filters text[] DEFAULT NULL::text[], item_folder_name_filter text DEFAULT NULL::text, item_date_mode text DEFAULT NULL::text, item_date_start text DEFAULT NULL::text, item_date_end text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
result json;
pattern text;
skip_freezer boolean;
skip_slide boolean;
skip_item boolean;
skip_boxes boolean;
has_text_query boolean;
has_date_filter boolean;
has_slide_date boolean;
has_item_date boolean;
has_filters_only boolean;
freezer_combined_mode boolean;
slide_combined_mode boolean;
BEGIN
pattern := '%' || search_query || '%';
has_text_query := (search_query IS NOT NULL AND trim(search_query) <> '');
has_date_filter := (date_mode IS NOT NULL);
has_slide_date := (slide_date_mode IS NOT NULL AND slide_header_filters IS NOT NULL AND array_length(slide_header_filters, 1) > 0);
has_item_date := (item_date_mode IS NOT NULL AND item_header_filters IS NOT NULL AND array_length(item_header_filters, 1) > 0);

skip_freezer := (filter_scopes IS NOT NULL AND NOT ('freezer_box' = ANY(filter_scopes)));
skip_slide := (filter_scopes IS NOT NULL AND NOT ('slide_box' = ANY(filter_scopes)));
skip_item := (filter_scopes IS NOT NULL AND NOT ('item' = ANY(filter_scopes)));
skip_boxes := (filter_scopes IS NOT NULL AND NOT ('freezer_box' = ANY(filter_scopes)) AND NOT ('slide_box' = ANY(filter_scopes)));

has_filters_only := (
NOT has_text_query
AND NOT has_date_filter
AND NOT has_slide_date
AND NOT has_item_date
AND (
filter_scopes IS NOT NULL
OR filter_texts IS NOT NULL
OR freezer_sub_filters IS NOT NULL
OR slide_header_filters IS NOT NULL
OR item_sub_filters IS NOT NULL
OR item_header_filters IS NOT NULL
OR item_folder_name_filter IS NOT NULL
)
);

-- Combined mode: no sub-filter narrowing selected, so filters/search match across all relevant fields
freezer_combined_mode := (
freezer_sub_filters IS NULL
OR (
'name' = ANY(freezer_sub_filters)
AND 'info' = ANY(freezer_sub_filters)
)
);
slide_combined_mode := (slide_header_filters IS NULL);

SELECT json_build_object(
'cell_matches', CASE
WHEN skip_freezer OR NOT freezer_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fc.name AS name,
fc.information AS information,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'freezer'
AND (COALESCE(fc.name, '') <> '' OR COALESCE(fc.information, '') <> '')
AND (NOT has_text_query OR (COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '')) ILIKE pattern)
AND (filter_texts IS NULL OR (
SELECT bool_and((COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '')) ILIKE '%' || ft || '%')
FROM unnest(filter_texts) AS ft
))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 100
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_titles', CASE
WHEN skip_freezer OR freezer_combined_mode OR NOT ('name' = ANY(COALESCE(freezer_sub_filters, ARRAY[]::text[]))) THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.name)
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fc.name ILIKE pattern
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 50
) t
), '[]'::json)
WHEN has_date_filter AND NOT has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.name)
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fc.name <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_info', CASE
WHEN skip_freezer OR freezer_combined_mode OR NOT ('info' = ANY(COALESCE(freezer_sub_filters, ARRAY[]::text[]))) THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.information)
fc.information AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fc.information ILIKE pattern AND fc.information <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.information ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.information)
fc.information AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fc.information <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.information ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'boxes', CASE
WHEN skip_boxes THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.name ILIKE pattern
AND (filter_scopes IS NULL OR
('freezer_box' = ANY(filter_scopes) AND fb.box_type = 'freezer') OR
('slide_box' = ANY(filter_scopes) AND fb.box_type = 'slide'))
AND (filter_texts IS NULL OR (SELECT bool_and(fb.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR EXISTS (
SELECT 1 FROM fridge_cells fc2
WHERE fc2.box_id = fb.id AND fc2.date IS NOT NULL AND (
(date_mode = 'exact' AND fc2.date = date_start::date)
OR (date_mode = 'range' AND fc2.date >= date_start::date AND fc2.date <= date_end::date)
OR (date_mode = 'before' AND fc2.date <= date_start::date)
OR (date_mode = 'after' AND fc2.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc2.date_type = 'expiration' AND fc2.date >= CURRENT_DATE AND fc2.date <= (CURRENT_DATE + date_end::int))
)
))
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE (filter_scopes IS NULL OR
('freezer_box' = ANY(filter_scopes) AND fb.box_type = 'freezer') OR
('slide_box' = ANY(filter_scopes) AND fb.box_type = 'slide'))
AND (filter_texts IS NULL OR (SELECT bool_and(fb.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'items', CASE
WHEN skip_item THEN '[]'::json
WHEN has_text_query OR has_item_date THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (NOT has_text_query OR ii.name ILIKE pattern)
AND (item_sub_filters IS NULL OR 'name' = ANY(item_sub_filters) OR 'column_header' = ANY(item_sub_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(ii.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_item_date OR EXISTS (
SELECT 1 FROM item_custom_values icv2
JOIN item_folder_headers ifh2 ON ifh2.id = icv2.header_id
WHERE icv2.item_id = ii.id
AND (item_header_filters IS NULL OR ifh2.header_text = ANY(item_header_filters))
AND ifh2.header_type IN ('date', 'expiration')
AND icv2.value <> ''
AND (
(item_date_mode = 'exact' AND icv2.value::date = item_date_start::date)
OR (item_date_mode = 'range' AND icv2.value::date >= item_date_start::date AND icv2.value::date <= item_date_end::date)
OR (item_date_mode = 'before' AND icv2.value::date <= item_date_start::date)
OR (item_date_mode = 'after' AND icv2.value::date >= item_date_start::date)
OR (item_date_mode = 'expiring_within' AND ifh2.header_type = 'expiration' AND icv2.value::date >= CURRENT_DATE AND icv2.value::date <= (CURRENT_DATE + item_date_end::int))
)
))
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (item_sub_filters IS NULL OR 'name' = ANY(item_sub_filters) OR 'column_header' = ANY(item_sub_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(ii.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'item_custom_values', CASE
WHEN skip_item THEN '[]'::json
WHEN (has_text_query OR has_item_date) AND (item_sub_filters IS NULL OR 'column_header' = ANY(item_sub_filters)) THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
icv.value AS matched_value, ifh.header_text AS header_text, ifh.display_order AS display_order,
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (NOT has_text_query OR (icv.value ILIKE pattern AND icv.value <> ''))
AND (item_header_filters IS NULL OR ifh.header_text = ANY(item_header_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(icv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_item_date OR (
ifh.header_type IN ('date', 'expiration')
AND (item_header_filters IS NULL OR ifh.header_text = ANY(item_header_filters))
AND icv.value <> ''
AND (
(item_date_mode = 'exact' AND icv.value::date = item_date_start::date)
OR (item_date_mode = 'range' AND icv.value::date >= item_date_start::date AND icv.value::date <= item_date_end::date)
OR (item_date_mode = 'before' AND icv.value::date <= item_date_start::date)
OR (item_date_mode = 'after' AND icv.value::date >= item_date_start::date)
OR (item_date_mode = 'expiring_within' AND ifh.header_type = 'expiration' AND icv.value::date >= CURRENT_DATE AND icv.value::date <= (CURRENT_DATE + item_date_end::int))
)
))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only AND (item_sub_filters IS NULL OR 'column_header' = ANY(item_sub_filters)) THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
icv.value AS matched_value, ifh.header_text AS header_text, ifh.display_order AS display_order,
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE icv.value <> ''
AND (item_header_filters IS NULL OR ifh.header_text = ANY(item_header_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(icv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_matches', CASE
WHEN skip_slide OR NOT slide_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
WITH cell_agg AS (
SELECT
scv.cell_id AS cell_uuid,
string_agg(COALESCE(scv.value, ''), ' ') AS all_values,
json_agg(
json_build_object(
'header_text', sbh.header_text,
'value', scv.value,
'display_order', sbh.display_order
)
ORDER BY sbh.display_order
) AS values_array
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
WHERE COALESCE(scv.value, '') <> ''
GROUP BY scv.cell_id
)
SELECT
ca.all_values AS aggregated_text,
ca.values_array AS values_array,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM cell_agg ca
JOIN fridge_cells fc ON fc.id = ca.cell_uuid
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.box_type = 'slide'
AND (NOT has_text_query OR ca.all_values ILIKE pattern)
AND (filter_texts IS NULL OR (
SELECT bool_and(ca.all_values ILIKE '%' || ft || '%')
FROM unnest(filter_texts) AS ft
))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
LIMIT 100
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_values', CASE
WHEN skip_slide OR slide_combined_mode THEN '[]'::json
WHEN has_text_query OR has_slide_date THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
scv.value AS matched_value, sbh.header_text AS header_text, sbh.display_order AS display_order,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE (NOT has_text_query OR (scv.value ILIKE pattern AND scv.value <> ''))
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (NOT has_slide_date OR EXISTS (
SELECT 1 FROM slide_cell_values scv2
JOIN slide_box_headers sbh2 ON sbh2.id = scv2.header_id
WHERE scv2.cell_id = scv.cell_id
AND (slide_header_filters IS NULL OR sbh2.header_text = ANY(slide_header_filters))
AND sbh2.header_type IN ('date', 'expiration')
AND scv2.value <> ''
AND (
(slide_date_mode = 'exact' AND scv2.value::date = slide_date_start::date)
OR (slide_date_mode = 'range' AND scv2.value::date >= slide_date_start::date AND scv2.value::date <= slide_date_end::date)
OR (slide_date_mode = 'before' AND scv2.value::date <= slide_date_start::date)
OR (slide_date_mode = 'after' AND scv2.value::date >= slide_date_start::date)
OR (slide_date_mode = 'expiring_within' AND sbh2.header_type = 'expiration' AND scv2.value::date >= CURRENT_DATE AND scv2.value::date <= (CURRENT_DATE + slide_date_end::int))
)
))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
scv.value AS matched_value, sbh.header_text AS header_text, sbh.display_order AS display_order,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE scv.value <> ''
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_headers', CASE
WHEN skip_slide THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
sbh.header_text AS header_text, sbh.display_order AS display_order,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE sbh.header_text ILIKE pattern
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(sbh.header_text ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR EXISTS (
SELECT 1 FROM fridge_cells fc2
WHERE fc2.box_id = fb.id AND fc2.date IS NOT NULL AND (
(date_mode = 'exact' AND fc2.date = date_start::date)
OR (date_mode = 'range' AND fc2.date >= date_start::date AND fc2.date <= date_end::date)
OR (date_mode = 'before' AND fc2.date <= date_start::date)
OR (date_mode = 'after' AND fc2.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc2.date_type = 'expiration' AND fc2.date >= CURRENT_DATE AND fc2.date <= (CURRENT_DATE + date_end::int))
)
))
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
sbh.header_text AS header_text, sbh.display_order AS display_order,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(sbh.header_text ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_dates', '[]'::json
) INTO result;

RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_workspace(search_query text, date_mode text DEFAULT NULL::text, date_start text DEFAULT NULL::text, date_end text DEFAULT NULL::text, date_type_target text DEFAULT NULL::text, filter_scopes text[] DEFAULT NULL::text[], filter_texts text[] DEFAULT NULL::text[], freezer_sub_filters text[] DEFAULT NULL::text[], slide_header_filters text[] DEFAULT NULL::text[], slide_date_filters text DEFAULT NULL::text, item_sub_filters text[] DEFAULT NULL::text[], item_header_filters text[] DEFAULT NULL::text[], item_folder_name_filter text DEFAULT NULL::text, item_date_filters text DEFAULT NULL::text, freezer_header_filters text[] DEFAULT NULL::text[], freezer_date_filters text DEFAULT NULL::text, p_team_member_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
result json;
pattern text;
skip_freezer boolean;
skip_slide boolean;
skip_item boolean;
skip_boxes boolean;
has_text_query boolean;
has_date_filter boolean;
has_slide_date boolean;
has_item_date boolean;
has_freezer_date boolean;
has_filters_only boolean;
freezer_combined_mode boolean;
slide_combined_mode boolean;
slide_date_json jsonb;
item_date_json jsonb;
freezer_date_json jsonb;
v_is_workspace_owner boolean;
v_blocked_count integer := 0;
v_tmp_count integer;
BEGIN
pattern := '%' || search_query || '%';
has_text_query := (search_query IS NOT NULL AND trim(search_query) <> '');
has_date_filter := (date_mode IS NOT NULL);

slide_date_json := CASE WHEN slide_date_filters IS NOT NULL THEN slide_date_filters::jsonb ELSE NULL END;
item_date_json := CASE WHEN item_date_filters IS NOT NULL THEN item_date_filters::jsonb ELSE NULL END;
freezer_date_json := CASE WHEN freezer_date_filters IS NOT NULL THEN freezer_date_filters::jsonb ELSE NULL END;

has_slide_date := (slide_date_json IS NOT NULL AND jsonb_array_length(slide_date_json) > 0);
has_item_date := (item_date_json IS NOT NULL AND jsonb_array_length(item_date_json) > 0);
has_freezer_date := (freezer_date_json IS NOT NULL AND jsonb_array_length(freezer_date_json) > 0);

skip_freezer := (filter_scopes IS NOT NULL AND NOT ('freezer_box' = ANY(filter_scopes)));
skip_slide := (filter_scopes IS NOT NULL AND NOT ('slide_box' = ANY(filter_scopes)));
skip_item := (filter_scopes IS NOT NULL AND NOT ('item' = ANY(filter_scopes)));
skip_boxes := (filter_scopes IS NOT NULL AND NOT ('freezer_box' = ANY(filter_scopes)) AND NOT ('slide_box' = ANY(filter_scopes)));

has_filters_only := (
NOT has_text_query
AND NOT has_date_filter
AND NOT has_slide_date
AND NOT has_item_date
AND NOT has_freezer_date
AND (
filter_scopes IS NOT NULL
OR filter_texts IS NOT NULL
OR freezer_sub_filters IS NOT NULL
OR slide_header_filters IS NOT NULL
OR item_sub_filters IS NOT NULL
OR item_header_filters IS NOT NULL
OR item_folder_name_filter IS NOT NULL
OR freezer_header_filters IS NOT NULL
)
);

freezer_combined_mode := (
freezer_sub_filters IS NULL
OR (
'name' = ANY(freezer_sub_filters)
AND 'info' = ANY(freezer_sub_filters)
)
);
slide_combined_mode := (slide_header_filters IS NULL);

-- Determine if user is workspace owner (bypasses all privacy checks)
v_is_workspace_owner := false;
IF p_team_member_id IS NOT NULL THEN
SELECT EXISTS (
SELECT 1 FROM workspaces w
WHERE w.owner_id = p_team_member_id
) INTO v_is_workspace_owner;
END IF;

SELECT json_build_object(
'cell_matches', CASE
WHEN skip_freezer OR NOT freezer_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_freezer_date OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fc.name AS name,
fc.information AS information,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND (COALESCE(fc.name, '') <> '' OR COALESCE(fc.information, '') <> '')
AND (NOT has_text_query OR (COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '')) ILIKE pattern)
AND (filter_texts IS NULL OR (
SELECT bool_and((COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '')) ILIKE '%' || ft || '%')
FROM unnest(filter_texts) AS ft
))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 100
) t
), '[]'::json)
ELSE '[]'::json
END,

'structured_freezer_matches', CASE
WHEN skip_freezer OR NOT freezer_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_freezer_date OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
WITH sf_cell_agg AS (
SELECT
scv.cell_id AS cell_uuid,
string_agg(COALESCE(scv.value, ''), ' ' ORDER BY sbh.display_order) AS all_col_values,
json_agg(
json_build_object(
'header_text', sbh.header_text,
'value', scv.value,
'display_order', sbh.display_order
)
ORDER BY sbh.display_order
) AS values_array
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc2 ON fc2.id = scv.cell_id
JOIN fridge_boxes fb2 ON fb2.id = fc2.box_id
WHERE fb2.box_type = 'structured_freezer'
AND COALESCE(scv.value, '') <> ''
GROUP BY scv.cell_id
)
SELECT
fc.name AS name,
fc.information AS information,
sca.all_col_values AS aggregated_text,
sca.values_array AS values_array,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN sf_cell_agg sca ON sca.cell_uuid = fc.id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type = 'structured_freezer'
AND (
COALESCE(fc.name, '') <> ''
OR COALESCE(fc.information, '') <> ''
OR sca.all_col_values IS NOT NULL
)
AND (NOT has_text_query OR (
COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '') || ' ' || COALESCE(sca.all_col_values, '')
) ILIKE pattern)
AND (filter_texts IS NULL OR (
SELECT bool_and(
(COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '') || ' ' || COALESCE(sca.all_col_values, ''))
ILIKE '%' || ft || '%'
)
FROM unnest(filter_texts) AS ft
))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (NOT has_freezer_date OR NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(freezer_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM slide_cell_values scv3
JOIN slide_box_headers sbh3 ON sbh3.id = scv3.header_id
WHERE scv3.cell_id = fc.id
AND sbh3.header_text = (cdf->>'column_name')
AND sbh3.header_type IN ('date', 'expiration')
AND scv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND scv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND scv3.value::date >= (cdf->>'date_start')::date AND scv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND scv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND scv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND sbh3.header_type = 'expiration' AND scv3.value::date >= CURRENT_DATE AND scv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 100
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_titles', CASE
WHEN skip_freezer OR freezer_combined_mode OR NOT ('name' = ANY(COALESCE(freezer_sub_filters, ARRAY[]::text[]))) THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.name)
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.name ILIKE pattern
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 50
) t
), '[]'::json)
WHEN has_date_filter AND NOT has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.date IS NOT NULL
AND (CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END)
AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.name)
fc.name AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.name <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_info', CASE
WHEN skip_freezer OR freezer_combined_mode THEN '[]'::json
WHEN NOT ('info' = ANY(COALESCE(freezer_sub_filters, ARRAY[]::text[]))) THEN '[]'::json
WHEN (freezer_header_filters IS NOT NULL AND array_length(freezer_header_filters, 1) > 0) THEN
COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
(
SELECT DISTINCT ON (fb.id, fc.information)
fc.information AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type = 'freezer'
AND fc.information <> ''
AND (NOT has_text_query OR fc.information ILIKE pattern)
AND (filter_texts IS NULL OR (SELECT bool_and(fc.information ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 50
)
UNION ALL
(
SELECT
scv.value AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type = 'structured_freezer'
AND scv.value <> ''
AND sbh.header_text = ANY(freezer_header_filters)
AND (NOT has_text_query OR scv.value ILIKE pattern)
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (NOT has_freezer_date OR NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(freezer_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM slide_cell_values scv3
JOIN slide_box_headers sbh3 ON sbh3.id = scv3.header_id
WHERE scv3.cell_id = fc.id
AND sbh3.header_text = (cdf->>'column_name')
AND sbh3.header_type IN ('date', 'expiration')
AND scv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND scv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND scv3.value::date >= (cdf->>'date_start')::date AND scv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND scv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND scv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND sbh3.header_type = 'expiration' AND scv3.value::date >= CURRENT_DATE AND scv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 50
)
) t
), '[]'::json)
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT DISTINCT ON (fb.id, fc.information)
fc.information AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.information ILIKE pattern AND fc.information <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.information ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 50
) t
), '[]'::json)
WHEN has_freezer_date THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
scv.value AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type = 'structured_freezer'
AND scv.value <> ''
AND (freezer_header_filters IS NULL OR sbh.header_text = ANY(freezer_header_filters))
AND NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(freezer_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM slide_cell_values scv3
JOIN slide_box_headers sbh3 ON sbh3.id = scv3.header_id
WHERE scv3.cell_id = fc.id
AND sbh3.header_text = (cdf->>'column_name')
AND sbh3.header_type IN ('date', 'expiration')
AND scv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND scv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND scv3.value::date >= (cdf->>'date_start')::date AND scv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND scv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND scv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND sbh3.header_type = 'expiration' AND scv3.value::date >= CURRENT_DATE AND scv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
)
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
(
SELECT DISTINCT ON (fb.id, fc.information)
fc.information AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type IN ('freezer', 'structured_freezer')
AND fc.information <> ''
AND (filter_texts IS NULL OR (SELECT bool_and(fc.information ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 50
)
UNION ALL
(
SELECT
scv.value AS cell_content, fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type = 'structured_freezer'
AND scv.value <> ''
AND (freezer_header_filters IS NULL OR sbh.header_text = ANY(freezer_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 50
)
) t
), '[]'::json)
ELSE '[]'::json
END,

'boxes', CASE
WHEN skip_boxes THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE fb.name ILIKE pattern
AND (filter_scopes IS NULL OR
('freezer_box' = ANY(filter_scopes) AND fb.box_type IN ('freezer', 'structured_freezer')) OR
('slide_box' = ANY(filter_scopes) AND fb.box_type = 'slide'))
AND (filter_texts IS NULL OR (SELECT bool_and(fb.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR EXISTS (
SELECT 1 FROM fridge_cells fc2
WHERE fc2.box_id = fb.id AND fc2.date IS NOT NULL
AND (CASE WHEN date_type_target = 'date' THEN fc2.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc2.date_type = 'expiration'
ELSE TRUE END)
AND (
(date_mode = 'exact' AND fc2.date = date_start::date)
OR (date_mode = 'range' AND fc2.date >= date_start::date AND fc2.date <= date_end::date)
OR (date_mode = 'before' AND fc2.date <= date_start::date)
OR (date_mode = 'after' AND fc2.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc2.date_type = 'expiration' AND fc2.date >= CURRENT_DATE AND fc2.date <= (CURRENT_DATE + date_end::int))
)
))
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM fridge_boxes fb
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
WHERE (filter_scopes IS NULL OR
('freezer_box' = ANY(filter_scopes) AND fb.box_type IN ('freezer', 'structured_freezer')) OR
('slide_box' = ANY(filter_scopes) AND fb.box_type = 'slide'))
AND (filter_texts IS NULL OR (SELECT bool_and(fb.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'items', CASE
WHEN skip_item THEN '[]'::json
WHEN has_text_query OR has_item_date THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (NOT has_text_query OR ii.name ILIKE pattern)
AND (item_sub_filters IS NULL OR 'name' = ANY(item_sub_filters) OR 'column_header' = ANY(item_sub_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(ii.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_item_date OR NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(item_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM item_custom_values icv3
JOIN item_folder_headers ifh3 ON ifh3.id = icv3.header_id
WHERE icv3.item_id = ii.id
AND ifh3.header_text = (cdf->>'column_name')
AND ifh3.header_type IN ('date', 'expiration')
AND icv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND icv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND icv3.value::date >= (cdf->>'date_start')::date AND icv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND icv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND icv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND ifh3.header_type = 'expiration' AND icv3.value::date >= CURRENT_DATE AND icv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
))
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM inventory_items ii
JOIN fridges f ON f.id = ii.fridge_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (item_sub_filters IS NULL OR 'name' = ANY(item_sub_filters) OR 'column_header' = ANY(item_sub_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(ii.name ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'item_custom_values', CASE
WHEN skip_item THEN '[]'::json
WHEN (has_text_query OR has_item_date) AND (item_sub_filters IS NULL OR 'column_header' = ANY(item_sub_filters)) THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
icv.value AS matched_value, ifh.header_text AS header_text, ifh.display_order AS display_order,
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE (NOT has_text_query OR (icv.value ILIKE pattern AND icv.value <> ''))
AND (item_header_filters IS NULL OR ifh.header_text = ANY(item_header_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(icv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_item_date OR NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(item_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM item_custom_values icv3
JOIN item_folder_headers ifh3 ON ifh3.id = icv3.header_id
WHERE icv3.item_id = ii.id
AND ifh3.header_text = (cdf->>'column_name')
AND ifh3.header_type IN ('date', 'expiration')
AND icv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND icv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND icv3.value::date >= (cdf->>'date_start')::date AND icv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND icv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND icv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND ifh3.header_type = 'expiration' AND icv3.value::date >= CURRENT_DATE AND icv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
))
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only AND (item_sub_filters IS NULL OR 'column_header' = ANY(item_sub_filters)) THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
icv.value AS matched_value, ifh.header_text AS header_text, ifh.display_order AS display_order,
ii.id AS item_id, ii.name AS item_name, ii.item_type,
ii.folder_id AS folder_id, ifo.name AS folder_name,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN item_folders ifo ON ifo.id = ii.folder_id
JOIN fridges f ON f.id = ii.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = ii.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = ii.position_id
WHERE icv.value <> ''
AND (item_header_filters IS NULL OR ifh.header_text = ANY(item_header_filters))
AND (item_folder_name_filter IS NULL OR ifo.name = item_folder_name_filter)
AND (filter_texts IS NULL OR (SELECT bool_and(icv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_matches', CASE
WHEN skip_slide OR NOT slide_combined_mode THEN '[]'::json
WHEN has_text_query OR has_date_filter OR has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
WITH cell_agg AS (
SELECT
scv.cell_id AS cell_uuid,
string_agg(COALESCE(scv.value, ''), ' ') AS all_values,
json_agg(
json_build_object(
'header_text', sbh.header_text,
'value', scv.value,
'display_order', sbh.display_order
)
ORDER BY sbh.display_order
) AS values_array
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
WHERE COALESCE(scv.value, '') <> ''
GROUP BY scv.cell_id
)
SELECT
ca.all_values AS aggregated_text,
ca.values_array AS values_array,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM cell_agg ca
JOIN fridge_cells fc ON fc.id = ca.cell_uuid
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type = 'slide'
AND (NOT has_text_query OR ca.all_values ILIKE pattern)
AND (filter_texts IS NULL OR (
SELECT bool_and(ca.all_values ILIKE '%' || ft || '%')
FROM unnest(filter_texts) AS ft
))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 100
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_values', CASE
WHEN skip_slide OR slide_combined_mode THEN '[]'::json
WHEN has_text_query OR has_slide_date THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
scv.value AS matched_value, sbh.header_text AS header_text, sbh.display_order AS display_order,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type = 'slide'
AND (NOT has_text_query OR (scv.value ILIKE pattern AND scv.value <> ''))
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR (fc.date IS NOT NULL AND (
CASE WHEN date_type_target = 'date' THEN fc.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc.date_type = 'expiration'
ELSE TRUE END
) AND (
(date_mode = 'exact' AND fc.date = date_start::date)
OR (date_mode = 'range' AND fc.date >= date_start::date AND fc.date <= date_end::date)
OR (date_mode = 'before' AND fc.date <= date_start::date)
OR (date_mode = 'after' AND fc.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc.date_type = 'expiration' AND fc.date >= CURRENT_DATE AND fc.date <= (CURRENT_DATE + date_end::int))
)))
AND (NOT has_slide_date OR NOT EXISTS (
SELECT 1 FROM jsonb_array_elements(slide_date_json) AS cdf
WHERE NOT EXISTS (
SELECT 1 FROM slide_cell_values scv3
JOIN slide_box_headers sbh3 ON sbh3.id = scv3.header_id
WHERE scv3.cell_id = scv.cell_id
AND sbh3.header_text = (cdf->>'column_name')
AND sbh3.header_type IN ('date', 'expiration')
AND scv3.value <> ''
AND (
((cdf->>'mode') = 'exact' AND scv3.value::date = (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'range' AND scv3.value::date >= (cdf->>'date_start')::date AND scv3.value::date <= (cdf->>'date_end')::date)
OR ((cdf->>'mode') = 'before' AND scv3.value::date <= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'after' AND scv3.value::date >= (cdf->>'date_start')::date)
OR ((cdf->>'mode') = 'expiring_within' AND sbh3.header_type = 'expiration' AND scv3.value::date >= CURRENT_DATE AND scv3.value::date <= (CURRENT_DATE + (cdf->>'date_end')::int))
)
)
))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 50
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
scv.value AS matched_value, sbh.header_text AS header_text, sbh.display_order AS display_order,
fc.cell_id AS cell_id,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name,
fc.date::text AS date_value, fc.date_type AS date_type
FROM slide_cell_values scv
JOIN slide_box_headers sbh ON sbh.id = scv.header_id
JOIN fridge_cells fc ON fc.id = scv.cell_id
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type = 'slide'
AND scv.value <> ''
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(scv.value ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 50
) t
), '[]'::json)
ELSE '[]'::json
END,

'slide_headers', CASE
WHEN skip_slide THEN '[]'::json
WHEN has_text_query THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
sbh.header_text AS header_text, sbh.display_order AS display_order,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type = 'slide'
AND sbh.header_text ILIKE pattern
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(sbh.header_text ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (NOT has_date_filter OR EXISTS (
SELECT 1 FROM fridge_cells fc2
WHERE fc2.box_id = fb.id AND fc2.date IS NOT NULL
AND (CASE WHEN date_type_target = 'date' THEN fc2.date_type = 'date'
WHEN date_type_target = 'expiration' THEN fc2.date_type = 'expiration'
ELSE TRUE END)
AND (
(date_mode = 'exact' AND fc2.date = date_start::date)
OR (date_mode = 'range' AND fc2.date >= date_start::date AND fc2.date <= date_end::date)
OR (date_mode = 'before' AND fc2.date <= date_start::date)
OR (date_mode = 'after' AND fc2.date >= date_start::date)
OR (date_mode = 'expiring_within' AND fc2.date_type = 'expiration' AND fc2.date >= CURRENT_DATE AND fc2.date <= (CURRENT_DATE + date_end::int))
)
))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 20
) t
), '[]'::json)
WHEN has_filters_only THEN COALESCE((
SELECT json_agg(row_to_json(t))
FROM (
SELECT
sbh.header_text AS header_text, sbh.display_order AS display_order,
fb.id AS box_id, fb.name AS box_name, fb.accent_color AS box_accent_color, fb.box_type AS box_type,
f.id AS fridge_id, f.name AS fridge_name,
fs.name AS sublocation_name, sp.name AS position_name
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
LEFT JOIN fridge_sublocations fs ON fs.id = fb.sublocation_id
LEFT JOIN sublocation_positions sp ON sp.id = fb.position_id
LEFT JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE fb.box_type = 'slide'
AND (slide_header_filters IS NULL OR sbh.header_text = ANY(slide_header_filters))
AND (filter_texts IS NULL OR (SELECT bool_and(sbh.header_text ILIKE '%' || ft || '%') FROM unnest(filter_texts) AS ft))
AND (
p_team_member_id IS NULL
OR v_is_workspace_owner
OR bps.box_id IS NULL
OR bps.privacy_mode = 'open'
OR bps.owner_id = p_team_member_id
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
)
LIMIT 20
) t
), '[]'::json)
ELSE '[]'::json
END,

'cell_dates', '[]'::json
) INTO result;

-- Compute blocked_count: count matching results in restricted boxes user cannot access
IF p_team_member_id IS NOT NULL AND NOT v_is_workspace_owner THEN
-- Count blocked freezer cell results (covers cell_matches, cell_titles, cell_info)
SELECT COUNT(*) INTO v_tmp_count
FROM fridge_cells fc
JOIN fridge_boxes fb ON fb.id = fc.box_id
JOIN fridges f ON f.id = fb.fridge_id
JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE bps.privacy_mode = 'restricted'
AND bps.owner_id <> p_team_member_id
AND NOT EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
AND fb.box_type IN ('freezer', 'structured_freezer', 'slide')
AND (COALESCE(fc.name, '') <> '' OR COALESCE(fc.information, '') <> '' OR EXISTS (
SELECT 1 FROM slide_cell_values scv2 WHERE scv2.cell_id = fc.id AND scv2.value <> ''
))
AND (NOT has_text_query OR (
COALESCE(fc.name, '') || ' ' || COALESCE(fc.information, '')
) ILIKE pattern OR EXISTS (
SELECT 1 FROM slide_cell_values scv2
JOIN slide_box_headers sbh2 ON sbh2.id = scv2.header_id
WHERE scv2.cell_id = fc.id AND scv2.value ILIKE pattern
))
AND (NOT skip_freezer OR NOT skip_slide);

v_blocked_count := v_blocked_count + v_tmp_count;

-- Count blocked slide header results
IF has_text_query AND NOT skip_slide THEN
SELECT COUNT(*) INTO v_tmp_count
FROM slide_box_headers sbh
JOIN fridge_boxes fb ON fb.id = sbh.box_id
JOIN fridges f ON f.id = fb.fridge_id
JOIN box_privacy_settings bps ON bps.box_id = fb.id
WHERE bps.privacy_mode = 'restricted'
AND bps.owner_id <> p_team_member_id
AND NOT EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id)
AND fb.box_type = 'slide'
AND sbh.header_text ILIKE pattern;

v_blocked_count := v_blocked_count + v_tmp_count;
END IF;
END IF;

-- Inject blocked_count into the result JSON
result := (result::jsonb || jsonb_build_object('blocked_count', v_blocked_count))::json;

RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_all_links_for_box(p_box_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_link_id uuid;
BEGIN
FOR v_link_id IN
SELECT id FROM box_grid_item_links WHERE box_id = p_box_id
LOOP
PERFORM sync_linked_item_stock(v_link_id);
END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_linked_item_stock(p_link_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_link box_grid_item_links%ROWTYPE;
v_count integer;
BEGIN
SELECT * INTO v_link FROM box_grid_item_links WHERE id = p_link_id;
IF NOT FOUND THEN
RETURN;
END IF;

IF v_link.link_type = 'name' THEN
SELECT COUNT(*) INTO v_count
FROM fridge_cells
WHERE box_id = v_link.box_id
AND TRIM(name) = TRIM(v_link.linked_name)
AND (is_crossed IS NULL OR is_crossed = false);
ELSIF v_link.link_type = 'info' THEN
SELECT COUNT(*) INTO v_count
FROM fridge_cells
WHERE box_id = v_link.box_id
AND TRIM(COALESCE(information, '')) = TRIM(COALESCE(v_link.linked_info, ''))
AND (is_crossed IS NULL OR is_crossed = false);
ELSE
SELECT COUNT(*) INTO v_count
FROM fridge_cells
WHERE box_id = v_link.box_id
AND TRIM(name) = TRIM(v_link.linked_name)
AND TRIM(COALESCE(information, '')) = TRIM(COALESCE(v_link.linked_info, ''))
AND (is_crossed IS NULL OR is_crossed = false);
END IF;

UPDATE inventory_items
SET stock_number = v_count,
updated_at = now()
WHERE id = v_link.item_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_location_to_location(p_source_fridge_id uuid, p_target_fridge_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_new_sub_id uuid;
v_src record;
v_old_sub record;
v_new_pos_id uuid;
v_count integer := 0;
v_rows integer;
BEGIN
IF p_source_fridge_id = p_target_fridge_id THEN
RAISE EXCEPTION 'Cannot transfer a location into itself';
END IF;

-- Validate no positions exist under source (depth would exceed 3)
IF EXISTS (
SELECT 1 FROM sublocation_positions sp
JOIN fridge_sublocations fs ON fs.id = sp.sublocation_id
WHERE fs.fridge_id = p_source_fridge_id
) THEN
RAISE EXCEPTION 'Cannot transfer: source location contains positions (would exceed depth 3)';
END IF;

-- Get source fridge metadata
SELECT name, accent_color, location_type, icon_id
INTO v_src FROM fridges WHERE id = p_source_fridge_id;
IF v_src IS NULL THEN
RAISE EXCEPTION 'Source location not found';
END IF;

-- Create new sublocation under target fridge
INSERT INTO fridge_sublocations (fridge_id, name, accent_color, location_type, icon_id, display_order)
VALUES (
p_target_fridge_id,
v_src.name,
v_src.accent_color,
v_src.location_type,
v_src.icon_id,
COALESCE((SELECT MAX(display_order) + 1 FROM fridge_sublocations WHERE fridge_id = p_target_fridge_id), 0)
)
RETURNING id INTO v_new_sub_id;
v_count := v_count + 1;

-- Convert each source sublocation into a position under the new sublocation
FOR v_old_sub IN
SELECT id, name, accent_color, location_type, icon_id
FROM fridge_sublocations
WHERE fridge_id = p_source_fridge_id
ORDER BY display_order
LOOP
INSERT INTO sublocation_positions (sublocation_id, name, accent_color, location_type, icon_id, display_order)
VALUES (
v_new_sub_id,
v_old_sub.name,
v_old_sub.accent_color,
v_old_sub.location_type,
v_old_sub.icon_id,
COALESCE((SELECT MAX(display_order) + 1 FROM sublocation_positions WHERE sublocation_id = v_new_sub_id), 0)
)
RETURNING id INTO v_new_pos_id;
v_count := v_count + 1;

-- Re-parent boxes from old sublocation to new position
UPDATE fridge_boxes
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, position_id = v_new_pos_id, updated_at = now()
WHERE sublocation_id = v_old_sub.id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent item_folders from old sublocation to new position
UPDATE item_folders
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, position_id = v_new_pos_id, updated_at = now()
WHERE sublocation_id = v_old_sub.id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent inventory_items from old sublocation to new position
UPDATE inventory_items
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, position_id = v_new_pos_id, updated_at = now()
WHERE sublocation_id = v_old_sub.id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;
END LOOP;

-- Re-parent direct fridge-level boxes (no sublocation) to new sublocation
UPDATE fridge_boxes
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now()
WHERE fridge_id = p_source_fridge_id AND sublocation_id IS NULL;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent direct fridge-level item_folders
UPDATE item_folders
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now()
WHERE fridge_id = p_source_fridge_id AND sublocation_id IS NULL;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent direct fridge-level inventory_items
UPDATE inventory_items
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now()
WHERE fridge_id = p_source_fridge_id AND sublocation_id IS NULL;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Delete old sublocations (children already moved)
DELETE FROM fridge_sublocations WHERE fridge_id = p_source_fridge_id;

-- Delete source fridge
DELETE FROM fridges WHERE id = p_source_fridge_id;

RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_location_to_sublocation(p_source_fridge_id uuid, p_target_sublocation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_target_fridge_id uuid;
v_new_pos_id uuid;
v_src record;
v_count integer := 0;
v_rows integer;
BEGIN
-- Validate no sublocations exist under source
IF EXISTS (SELECT 1 FROM fridge_sublocations WHERE fridge_id = p_source_fridge_id) THEN
RAISE EXCEPTION 'Cannot transfer: source location contains sub-locations (would exceed depth 3)';
END IF;

-- Get target fridge_id
SELECT fridge_id INTO v_target_fridge_id
FROM fridge_sublocations WHERE id = p_target_sublocation_id;
IF v_target_fridge_id IS NULL THEN
RAISE EXCEPTION 'Target sub-location not found';
END IF;

-- Get source metadata
SELECT name, accent_color, location_type, icon_id
INTO v_src FROM fridges WHERE id = p_source_fridge_id;
IF v_src IS NULL THEN
RAISE EXCEPTION 'Source location not found';
END IF;

-- Create new position under target sublocation
INSERT INTO sublocation_positions (sublocation_id, name, accent_color, location_type, icon_id, display_order)
VALUES (
p_target_sublocation_id,
v_src.name,
v_src.accent_color,
v_src.location_type,
v_src.icon_id,
COALESCE((SELECT MAX(display_order) + 1 FROM sublocation_positions WHERE sublocation_id = p_target_sublocation_id), 0)
)
RETURNING id INTO v_new_pos_id;
v_count := v_count + 1;

-- Re-parent boxes
UPDATE fridge_boxes
SET fridge_id = v_target_fridge_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now()
WHERE fridge_id = p_source_fridge_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent item_folders
UPDATE item_folders
SET fridge_id = v_target_fridge_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now()
WHERE fridge_id = p_source_fridge_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent inventory_items
UPDATE inventory_items
SET fridge_id = v_target_fridge_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now()
WHERE fridge_id = p_source_fridge_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Delete source fridge
DELETE FROM fridges WHERE id = p_source_fridge_id;

RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_position_to_location(p_source_position_id uuid, p_target_fridge_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_new_sub_id uuid;
v_src record;
v_count integer := 0;
v_rows integer;
BEGIN
-- Get source metadata
SELECT name, accent_color, location_type, icon_id
INTO v_src FROM sublocation_positions WHERE id = p_source_position_id;
IF v_src IS NULL THEN
RAISE EXCEPTION 'Source position not found';
END IF;

-- Create new sublocation under target fridge
INSERT INTO fridge_sublocations (fridge_id, name, accent_color, location_type, icon_id, display_order)
VALUES (
p_target_fridge_id,
v_src.name,
v_src.accent_color,
v_src.location_type,
v_src.icon_id,
COALESCE((SELECT MAX(display_order) + 1 FROM fridge_sublocations WHERE fridge_id = p_target_fridge_id), 0)
)
RETURNING id INTO v_new_sub_id;
v_count := v_count + 1;

-- Re-parent boxes: move from position to new sublocation (clear position_id)
UPDATE fridge_boxes
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now()
WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent item_folders
UPDATE item_folders
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now()
WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent inventory_items
UPDATE inventory_items
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, position_id = NULL, updated_at = now()
WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Delete source position
DELETE FROM sublocation_positions WHERE id = p_source_position_id;

RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_position_to_sublocation(p_source_position_id uuid, p_target_sublocation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_target_fridge_id uuid;
v_new_pos_id uuid;
v_src record;
v_source_sublocation_id uuid;
v_count integer := 0;
v_rows integer;
BEGIN
-- Get source metadata
SELECT name, accent_color, location_type, icon_id, sublocation_id
INTO v_src FROM sublocation_positions WHERE id = p_source_position_id;
IF v_src IS NULL THEN
RAISE EXCEPTION 'Source position not found';
END IF;
v_source_sublocation_id := v_src.sublocation_id;

-- Get target fridge_id
SELECT fridge_id INTO v_target_fridge_id
FROM fridge_sublocations WHERE id = p_target_sublocation_id;
IF v_target_fridge_id IS NULL THEN
RAISE EXCEPTION 'Target sub-location not found';
END IF;

-- Create new position under target sublocation
INSERT INTO sublocation_positions (sublocation_id, name, accent_color, location_type, icon_id, display_order)
VALUES (
p_target_sublocation_id,
v_src.name,
v_src.accent_color,
v_src.location_type,
v_src.icon_id,
COALESCE((SELECT MAX(display_order) + 1 FROM sublocation_positions WHERE sublocation_id = p_target_sublocation_id), 0)
)
RETURNING id INTO v_new_pos_id;
v_count := v_count + 1;

-- Re-parent boxes
UPDATE fridge_boxes
SET fridge_id = v_target_fridge_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now()
WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent item_folders
UPDATE item_folders
SET fridge_id = v_target_fridge_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now()
WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent inventory_items
UPDATE inventory_items
SET fridge_id = v_target_fridge_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now()
WHERE position_id = p_source_position_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Delete source position
DELETE FROM sublocation_positions WHERE id = p_source_position_id;

RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_sublocation_to_location(p_source_sublocation_id uuid, p_target_fridge_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_new_sub_id uuid;
v_src record;
v_source_fridge_id uuid;
v_count integer := 0;
v_rows integer;
BEGIN
-- Get source metadata
SELECT name, accent_color, location_type, icon_id, fridge_id
INTO v_src FROM fridge_sublocations WHERE id = p_source_sublocation_id;
IF v_src IS NULL THEN
RAISE EXCEPTION 'Source sub-location not found';
END IF;
v_source_fridge_id := v_src.fridge_id;

-- Create new sublocation under target fridge
INSERT INTO fridge_sublocations (fridge_id, name, accent_color, location_type, icon_id, display_order)
VALUES (
p_target_fridge_id,
v_src.name,
v_src.accent_color,
v_src.location_type,
v_src.icon_id,
COALESCE((SELECT MAX(display_order) + 1 FROM fridge_sublocations WHERE fridge_id = p_target_fridge_id), 0)
)
RETURNING id INTO v_new_sub_id;
v_count := v_count + 1;

-- Move positions to new sublocation
UPDATE sublocation_positions
SET sublocation_id = v_new_sub_id, updated_at = now()
WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent boxes (both direct and position-level)
UPDATE fridge_boxes
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, updated_at = now()
WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent item_folders
UPDATE item_folders
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, updated_at = now()
WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent inventory_items
UPDATE inventory_items
SET fridge_id = p_target_fridge_id, sublocation_id = v_new_sub_id, updated_at = now()
WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Delete source sublocation
DELETE FROM fridge_sublocations WHERE id = p_source_sublocation_id;

RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_sublocation_to_sublocation(p_source_sublocation_id uuid, p_target_sublocation_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_target_fridge_id uuid;
v_new_pos_id uuid;
v_src record;
v_count integer := 0;
v_rows integer;
BEGIN
IF p_source_sublocation_id = p_target_sublocation_id THEN
RAISE EXCEPTION 'Cannot transfer a sub-location into itself';
END IF;

-- Validate no positions under source
IF EXISTS (SELECT 1 FROM sublocation_positions WHERE sublocation_id = p_source_sublocation_id) THEN
RAISE EXCEPTION 'Cannot transfer: source sub-location contains positions (would exceed depth 3)';
END IF;

-- Get target fridge_id
SELECT fridge_id INTO v_target_fridge_id
FROM fridge_sublocations WHERE id = p_target_sublocation_id;
IF v_target_fridge_id IS NULL THEN
RAISE EXCEPTION 'Target sub-location not found';
END IF;

-- Get source metadata
SELECT name, accent_color, location_type, icon_id
INTO v_src FROM fridge_sublocations WHERE id = p_source_sublocation_id;
IF v_src IS NULL THEN
RAISE EXCEPTION 'Source sub-location not found';
END IF;

-- Create new position under target sublocation
INSERT INTO sublocation_positions (sublocation_id, name, accent_color, location_type, icon_id, display_order)
VALUES (
p_target_sublocation_id,
v_src.name,
v_src.accent_color,
v_src.location_type,
v_src.icon_id,
COALESCE((SELECT MAX(display_order) + 1 FROM sublocation_positions WHERE sublocation_id = p_target_sublocation_id), 0)
)
RETURNING id INTO v_new_pos_id;
v_count := v_count + 1;

-- Re-parent boxes
UPDATE fridge_boxes
SET fridge_id = v_target_fridge_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now()
WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent item_folders
UPDATE item_folders
SET fridge_id = v_target_fridge_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now()
WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Re-parent inventory_items
UPDATE inventory_items
SET fridge_id = v_target_fridge_id, sublocation_id = p_target_sublocation_id, position_id = v_new_pos_id, updated_at = now()
WHERE sublocation_id = p_source_sublocation_id;
GET DIAGNOSTICS v_rows = ROW_COUNT;
v_count := v_count + v_rows;

-- Delete source sublocation
DELETE FROM fridge_sublocations WHERE id = p_source_sublocation_id;

RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_box_privacy(p_box_id uuid, p_owner_id uuid, p_privacy_mode text, p_owner_only_delete boolean, p_access_entries jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
INSERT INTO box_privacy_settings (box_id, owner_id, privacy_mode, owner_only_delete)
VALUES (p_box_id, p_owner_id, p_privacy_mode, p_owner_only_delete)
ON CONFLICT (box_id) DO UPDATE SET
owner_id = EXCLUDED.owner_id,
privacy_mode = EXCLUDED.privacy_mode,
owner_only_delete = EXCLUDED.owner_only_delete,
updated_at = now();

DELETE FROM box_access_list WHERE box_id = p_box_id;

INSERT INTO box_access_list (box_id, team_member_id, access_level)
SELECT
p_box_id,
(entry->>'team_member_id')::uuid,
entry->>'access_level'
FROM jsonb_array_elements(p_access_entries) AS entry
WHERE entry->>'team_member_id' IS NOT NULL
AND entry->>'access_level' IN ('edit', 'view')
ON CONFLICT (box_id, team_member_id) DO UPDATE
SET access_level = EXCLUDED.access_level;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_project_privacy(p_project_id uuid, p_owner_id uuid, p_privacy_mode text, p_owner_only_delete boolean, p_access_entries jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
INSERT INTO project_privacy_settings (project_id, owner_id, privacy_mode, owner_only_delete)
VALUES (p_project_id, p_owner_id, p_privacy_mode, p_owner_only_delete)
ON CONFLICT (project_id) DO UPDATE SET
owner_id = EXCLUDED.owner_id,
privacy_mode = EXCLUDED.privacy_mode,
owner_only_delete = EXCLUDED.owner_only_delete,
updated_at = now();

DELETE FROM project_access_list WHERE project_id = p_project_id;

INSERT INTO project_access_list (project_id, team_member_id, access_level)
SELECT
p_project_id,
(entry->>'team_member_id')::uuid,
entry->>'access_level'
FROM jsonb_array_elements(p_access_entries) AS entry
WHERE entry->>'team_member_id' IS NOT NULL
AND entry->>'access_level' IN ('edit', 'view')
ON CONFLICT (project_id, team_member_id) DO UPDATE
SET access_level = EXCLUDED.access_level;
END;
$function$;

-- ============================================================
-- 5. Views
-- ============================================================
-- Views
CREATE OR REPLACE VIEW boxes_with_stats WITH (security_invoker = true) AS
 SELECT b.id,
    b.fridge_id,
    b.sublocation_id,
    b.position_id,
    b.name,
    b.description,
    b.accent_color,
    b.rows,
    b.columns,
    b.name_font_divisor,
    b.info_font_divisor,
    b.slide_font_divisor,
    b.constrain_grid_height,
    b.box_type,
    b.display_order,
    b.icon_id,
    b.created_at,
    b.updated_at,
    COALESCE(c.cell_count, (0)::bigint) AS occupied_cells,
    (b.rows * b.columns) AS total_cells,
        CASE
            WHEN ((b.rows * b.columns) > 0) THEN (round((((COALESCE(c.cell_count, (0)::bigint))::numeric / ((b.rows * b.columns))::numeric) * (100)::numeric)))::integer
            ELSE 0
        END AS utilization_percent
   FROM (fridge_boxes b
     LEFT JOIN ( SELECT fridge_cells.box_id,
            count(*) AS cell_count
           FROM fridge_cells
          WHERE (fridge_cells.is_crossed = false)
          GROUP BY fridge_cells.box_id) c ON ((b.id = c.box_id)));

CREATE OR REPLACE VIEW fridges_with_stats WITH (security_invoker = true) AS
 SELECT f.id,
    f.name,
    f.accent_color,
    f.display_order,
    f.workspace_id,
    f.show_storage_boxes,
    f.show_inventory_items,
    f.location_type,
    f.icon_id,
    f.created_at,
    f.updated_at,
    COALESCE(b.box_count, (0)::bigint) AS box_count,
    COALESCE(i.item_count, (0)::bigint) AS item_count
   FROM ((fridges f
     LEFT JOIN ( SELECT fridge_boxes.fridge_id,
            count(*) AS box_count
           FROM fridge_boxes
          GROUP BY fridge_boxes.fridge_id) b ON ((f.id = b.fridge_id)))
     LEFT JOIN ( SELECT inventory_items.fridge_id,
            count(*) AS item_count
           FROM inventory_items
          GROUP BY inventory_items.fridge_id) i ON ((f.id = i.fridge_id)));

CREATE OR REPLACE VIEW positions_with_stats WITH (security_invoker = true) AS
 SELECT p.id,
    p.sublocation_id,
    p.name,
    p.accent_color,
    p.display_order,
    p.location_type,
    p.icon_id,
    p.created_at,
    p.updated_at,
    COALESCE(box_stats.box_count, (0)::bigint) AS box_count,
    COALESCE(item_stats.item_count, (0)::bigint) AS item_count
   FROM ((sublocation_positions p
     LEFT JOIN ( SELECT fridge_boxes.position_id,
            count(*) AS box_count
           FROM fridge_boxes
          WHERE (fridge_boxes.position_id IS NOT NULL)
          GROUP BY fridge_boxes.position_id) box_stats ON ((p.id = box_stats.position_id)))
     LEFT JOIN ( SELECT inventory_items.position_id,
            count(*) AS item_count
           FROM inventory_items
          WHERE (inventory_items.position_id IS NOT NULL)
          GROUP BY inventory_items.position_id) item_stats ON ((p.id = item_stats.position_id)));

CREATE OR REPLACE VIEW sublocations_with_stats WITH (security_invoker = true) AS
 SELECT s.id,
    s.fridge_id,
    s.name,
    s.accent_color,
    s.display_order,
    s.location_type,
    s.icon_id,
    s.created_at,
    s.updated_at,
    COALESCE(box_stats.box_count, (0)::bigint) AS box_count,
    COALESCE(item_stats.item_count, (0)::bigint) AS item_count
   FROM ((fridge_sublocations s
     LEFT JOIN ( SELECT fridge_boxes.sublocation_id,
            count(*) AS box_count
           FROM fridge_boxes
          WHERE (fridge_boxes.sublocation_id IS NOT NULL)
          GROUP BY fridge_boxes.sublocation_id) box_stats ON ((s.id = box_stats.sublocation_id)))
     LEFT JOIN ( SELECT inventory_items.sublocation_id,
            count(*) AS item_count
           FROM inventory_items
          WHERE (inventory_items.sublocation_id IS NOT NULL)
          GROUP BY inventory_items.sublocation_id) item_stats ON ((s.id = item_stats.sublocation_id)));

-- ============================================================
-- 6. Triggers
-- ============================================================
-- Triggers
CREATE TRIGGER update_box_privacy_settings_updated_at BEFORE UPDATE ON public.box_privacy_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experiments_updated_at BEFORE UPDATE ON public.experiments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fridge_boxes_updated_at BEFORE UPDATE ON public.fridge_boxes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fridge_cells_updated_at BEFORE UPDATE ON public.fridge_cells FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fridge_sublocations_updated_at BEFORE UPDATE ON public.fridge_sublocations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fridges_updated_at BEFORE UPDATE ON public.fridges FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_privacy_settings_updated_at BEFORE UPDATE ON public.project_privacy_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reassign_box_ownership BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION reassign_box_ownership_on_member_removal();

CREATE TRIGGER trg_reassign_project_ownership BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION reassign_project_ownership_on_member_removal();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. Row Level Security
-- ============================================================
-- RLS Policies

-- ai_tool_audit_log
ALTER TABLE ai_tool_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert_audit_service_role" ON ai_tool_audit_log FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "select_own_workspace_audit" ON ai_tool_audit_log FOR SELECT TO authenticated USING ((workspace_id = ( SELECT team_members.workspace_id FROM team_members WHERE (team_members.auth_user_id = auth.uid()) LIMIT 1)));

-- box_access_list
ALTER TABLE box_access_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delete_box_access_list" ON box_access_list FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_access_list.box_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "insert_box_access_list" ON box_access_list FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_access_list.box_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "select_box_access_list" ON box_access_list FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_access_list.box_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "update_box_access_list" ON box_access_list FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_access_list.box_id) AND (f.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_access_list.box_id) AND (f.workspace_id = get_user_workspace_id())))));

-- box_grid_item_links
ALTER TABLE box_grid_item_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can create box item links" ON box_grid_item_links FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM ((fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) JOIN team_members tm ON ((tm.workspace_id = f.workspace_id))) WHERE ((fb.id = box_grid_item_links.box_id) AND (tm.auth_user_id = auth.uid()) AND (tm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'member'::text]))))));
CREATE POLICY "Workspace members can delete box item links" ON box_grid_item_links FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM ((fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) JOIN team_members tm ON ((tm.workspace_id = f.workspace_id))) WHERE ((fb.id = box_grid_item_links.box_id) AND (tm.auth_user_id = auth.uid()) AND (tm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'member'::text]))))));
CREATE POLICY "Workspace members can update box item links" ON box_grid_item_links FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM ((fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) JOIN team_members tm ON ((tm.workspace_id = f.workspace_id))) WHERE ((fb.id = box_grid_item_links.box_id) AND (tm.auth_user_id = auth.uid()) AND (tm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'member'::text])))))) WITH CHECK ((EXISTS ( SELECT 1 FROM ((fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) JOIN team_members tm ON ((tm.workspace_id = f.workspace_id))) WHERE ((fb.id = box_grid_item_links.box_id) AND (tm.auth_user_id = auth.uid()) AND (tm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'member'::text]))))));
CREATE POLICY "Workspace members can view box item links" ON box_grid_item_links FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM ((fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) JOIN team_members tm ON ((tm.workspace_id = f.workspace_id))) WHERE ((fb.id = box_grid_item_links.box_id) AND (tm.auth_user_id = auth.uid()) AND (tm.role = ANY (ARRAY['owner'::text, 'manager'::text, 'member'::text]))))));

-- box_history
ALTER TABLE box_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can insert box_history" ON box_history FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_history.box_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can read box_history" ON box_history FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_history.box_id) AND (f.workspace_id = get_user_workspace_id())))));

-- box_privacy_settings
ALTER TABLE box_privacy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delete_box_privacy_settings" ON box_privacy_settings FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_privacy_settings.box_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "insert_box_privacy_settings" ON box_privacy_settings FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_privacy_settings.box_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "select_box_privacy_settings" ON box_privacy_settings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_privacy_settings.box_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "update_box_privacy_settings" ON box_privacy_settings FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_privacy_settings.box_id) AND (f.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = box_privacy_settings.box_id) AND (f.workspace_id = get_user_workspace_id())))));

-- box_qr_codes
ALTER TABLE box_qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delete_box_qr_codes" ON box_qr_codes FOR DELETE TO authenticated USING ((workspace_id = get_user_workspace_id()));
CREATE POLICY "insert_box_qr_codes" ON box_qr_codes FOR INSERT TO authenticated WITH CHECK ((workspace_id = get_user_workspace_id()));
CREATE POLICY "select_box_qr_codes" ON box_qr_codes FOR SELECT TO authenticated USING ((workspace_id = get_user_workspace_id()));
CREATE POLICY "update_box_qr_codes" ON box_qr_codes FOR UPDATE TO authenticated USING ((workspace_id = get_user_workspace_id())) WITH CHECK ((workspace_id = get_user_workspace_id()));

-- experiments
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delete_experiments" ON experiments FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = experiments.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "insert_experiments" ON experiments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = experiments.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "select_experiments" ON experiments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = experiments.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "update_experiments" ON experiments FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = experiments.project_id) AND (p.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = experiments.project_id) AND (p.workspace_id = get_user_workspace_id())))));

-- fridge_boxes
ALTER TABLE fridge_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can delete fridge_boxes" ON fridge_boxes FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = fridge_boxes.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can insert fridge_boxes" ON fridge_boxes FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = fridge_boxes.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can read fridge_boxes" ON fridge_boxes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = fridge_boxes.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can update fridge_boxes" ON fridge_boxes FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = fridge_boxes.fridge_id) AND (fridges.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = fridge_boxes.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));

-- fridge_cells
ALTER TABLE fridge_cells ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can delete fridge_cells" ON fridge_cells FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes JOIN fridges ON ((fridges.id = fridge_boxes.fridge_id))) WHERE ((fridge_boxes.id = fridge_cells.box_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can insert fridge_cells" ON fridge_cells FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM (fridge_boxes JOIN fridges ON ((fridges.id = fridge_boxes.fridge_id))) WHERE ((fridge_boxes.id = fridge_cells.box_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can read fridge_cells" ON fridge_cells FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes JOIN fridges ON ((fridges.id = fridge_boxes.fridge_id))) WHERE ((fridge_boxes.id = fridge_cells.box_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can update fridge_cells" ON fridge_cells FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes JOIN fridges ON ((fridges.id = fridge_boxes.fridge_id))) WHERE ((fridge_boxes.id = fridge_cells.box_id) AND (fridges.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM (fridge_boxes JOIN fridges ON ((fridges.id = fridge_boxes.fridge_id))) WHERE ((fridge_boxes.id = fridge_cells.box_id) AND (fridges.workspace_id = get_user_workspace_id())))));

-- fridge_sublocations
ALTER TABLE fridge_sublocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can delete fridge_sublocations" ON fridge_sublocations FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = fridge_sublocations.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can insert fridge_sublocations" ON fridge_sublocations FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = fridge_sublocations.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can read fridge_sublocations" ON fridge_sublocations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = fridge_sublocations.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can update fridge_sublocations" ON fridge_sublocations FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = fridge_sublocations.fridge_id) AND (fridges.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = fridge_sublocations.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));

-- fridges
ALTER TABLE fridges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can delete fridges" ON fridges FOR DELETE TO authenticated USING ((workspace_id = get_user_workspace_id()));
CREATE POLICY "Workspace members can insert fridges" ON fridges FOR INSERT TO authenticated WITH CHECK ((is_team_member() AND (workspace_id = get_user_workspace_id())));
CREATE POLICY "Workspace members can read fridges" ON fridges FOR SELECT TO authenticated USING ((workspace_id = get_user_workspace_id()));
CREATE POLICY "Workspace members can update fridges" ON fridges FOR UPDATE TO authenticated USING ((workspace_id = get_user_workspace_id())) WITH CHECK ((workspace_id = get_user_workspace_id()));

-- inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can delete inventory_items" ON inventory_items FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = inventory_items.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can insert inventory_items" ON inventory_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = inventory_items.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can read inventory_items" ON inventory_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = inventory_items.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can update inventory_items" ON inventory_items FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = inventory_items.fridge_id) AND (fridges.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = inventory_items.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));

-- item_custom_values
ALTER TABLE item_custom_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can delete item_custom_values" ON item_custom_values FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM (inventory_items ii JOIN fridges f ON ((f.id = ii.fridge_id))) WHERE ((ii.id = item_custom_values.item_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can insert item_custom_values" ON item_custom_values FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM (inventory_items ii JOIN fridges f ON ((f.id = ii.fridge_id))) WHERE ((ii.id = item_custom_values.item_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can read item_custom_values" ON item_custom_values FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (inventory_items ii JOIN fridges f ON ((f.id = ii.fridge_id))) WHERE ((ii.id = item_custom_values.item_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can update item_custom_values" ON item_custom_values FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM (inventory_items ii JOIN fridges f ON ((f.id = ii.fridge_id))) WHERE ((ii.id = item_custom_values.item_id) AND (f.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM (inventory_items ii JOIN fridges f ON ((f.id = ii.fridge_id))) WHERE ((ii.id = item_custom_values.item_id) AND (f.workspace_id = get_user_workspace_id())))));

-- item_folder_headers
ALTER TABLE item_folder_headers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can delete item_folder_headers" ON item_folder_headers FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM (item_folders ifo JOIN fridges f ON ((f.id = ifo.fridge_id))) WHERE ((ifo.id = item_folder_headers.folder_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can insert item_folder_headers" ON item_folder_headers FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM (item_folders ifo JOIN fridges f ON ((f.id = ifo.fridge_id))) WHERE ((ifo.id = item_folder_headers.folder_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can read item_folder_headers" ON item_folder_headers FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (item_folders ifo JOIN fridges f ON ((f.id = ifo.fridge_id))) WHERE ((ifo.id = item_folder_headers.folder_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can update item_folder_headers" ON item_folder_headers FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM (item_folders ifo JOIN fridges f ON ((f.id = ifo.fridge_id))) WHERE ((ifo.id = item_folder_headers.folder_id) AND (f.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM (item_folders ifo JOIN fridges f ON ((f.id = ifo.fridge_id))) WHERE ((ifo.id = item_folder_headers.folder_id) AND (f.workspace_id = get_user_workspace_id())))));

-- item_folders
ALTER TABLE item_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can delete item_folders" ON item_folders FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = item_folders.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can insert item_folders" ON item_folders FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = item_folders.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can read item_folders" ON item_folders FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = item_folders.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can update item_folders" ON item_folders FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = item_folders.fridge_id) AND (fridges.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM fridges WHERE ((fridges.id = item_folders.fridge_id) AND (fridges.workspace_id = get_user_workspace_id())))));

-- project_access_list
ALTER TABLE project_access_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delete_project_access_list" ON project_access_list FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_access_list.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "insert_project_access_list" ON project_access_list FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_access_list.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "select_project_access_list" ON project_access_list FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_access_list.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "update_project_access_list" ON project_access_list FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_access_list.project_id) AND (p.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_access_list.project_id) AND (p.workspace_id = get_user_workspace_id())))));

-- project_box_links
ALTER TABLE project_box_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delete_project_box_links" ON project_box_links FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_box_links.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "insert_project_box_links" ON project_box_links FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_box_links.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "select_project_box_links" ON project_box_links FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_box_links.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "update_project_box_links" ON project_box_links FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_box_links.project_id) AND (p.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_box_links.project_id) AND (p.workspace_id = get_user_workspace_id())))));

-- project_item_links
ALTER TABLE project_item_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delete_project_item_links" ON project_item_links FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_item_links.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "insert_project_item_links" ON project_item_links FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_item_links.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "select_project_item_links" ON project_item_links FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_item_links.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "update_project_item_links" ON project_item_links FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_item_links.project_id) AND (p.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_item_links.project_id) AND (p.workspace_id = get_user_workspace_id())))));

-- project_privacy_settings
ALTER TABLE project_privacy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delete_project_privacy_settings" ON project_privacy_settings FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_privacy_settings.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "insert_project_privacy_settings" ON project_privacy_settings FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_privacy_settings.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "select_project_privacy_settings" ON project_privacy_settings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_privacy_settings.project_id) AND (p.workspace_id = get_user_workspace_id())))));
CREATE POLICY "update_project_privacy_settings" ON project_privacy_settings FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_privacy_settings.project_id) AND (p.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM projects p WHERE ((p.id = project_privacy_settings.project_id) AND (p.workspace_id = get_user_workspace_id())))));

-- projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delete_projects" ON projects FOR DELETE TO authenticated USING ((workspace_id = get_user_workspace_id()));
CREATE POLICY "insert_projects" ON projects FOR INSERT TO authenticated WITH CHECK ((workspace_id = get_user_workspace_id()));
CREATE POLICY "select_projects" ON projects FOR SELECT TO authenticated USING ((workspace_id = get_user_workspace_id()));
CREATE POLICY "update_projects" ON projects FOR UPDATE TO authenticated USING ((workspace_id = get_user_workspace_id())) WITH CHECK ((workspace_id = get_user_workspace_id()));

-- saved_search_filters
ALTER TABLE saved_search_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can delete own saved filters" ON saved_search_filters FOR DELETE TO authenticated USING (((workspace_id = get_user_workspace_id()) AND (team_member_id = get_user_team_member_id())));
CREATE POLICY "Members can insert own saved filters" ON saved_search_filters FOR INSERT TO authenticated WITH CHECK (((workspace_id = get_user_workspace_id()) AND (team_member_id = get_user_team_member_id())));
CREATE POLICY "Members can view own saved filters" ON saved_search_filters FOR SELECT TO authenticated USING (((workspace_id = get_user_workspace_id()) AND (team_member_id = get_user_team_member_id())));

-- slide_box_headers
ALTER TABLE slide_box_headers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can delete slide_box_headers" ON slide_box_headers FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = slide_box_headers.box_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can insert slide_box_headers" ON slide_box_headers FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = slide_box_headers.box_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can read slide_box_headers" ON slide_box_headers FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = slide_box_headers.box_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can update slide_box_headers" ON slide_box_headers FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = slide_box_headers.box_id) AND (f.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM (fridge_boxes fb JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fb.id = slide_box_headers.box_id) AND (f.workspace_id = get_user_workspace_id())))));

-- slide_cell_values
ALTER TABLE slide_cell_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can delete slide_cell_values" ON slide_cell_values FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM ((fridge_cells fc JOIN fridge_boxes fb ON ((fb.id = fc.box_id))) JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fc.id = slide_cell_values.cell_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can insert slide_cell_values" ON slide_cell_values FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM ((fridge_cells fc JOIN fridge_boxes fb ON ((fb.id = fc.box_id))) JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fc.id = slide_cell_values.cell_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can read slide_cell_values" ON slide_cell_values FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM ((fridge_cells fc JOIN fridge_boxes fb ON ((fb.id = fc.box_id))) JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fc.id = slide_cell_values.cell_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Team members can update slide_cell_values" ON slide_cell_values FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM ((fridge_cells fc JOIN fridge_boxes fb ON ((fb.id = fc.box_id))) JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fc.id = slide_cell_values.cell_id) AND (f.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM ((fridge_cells fc JOIN fridge_boxes fb ON ((fb.id = fc.box_id))) JOIN fridges f ON ((f.id = fb.fridge_id))) WHERE ((fc.id = slide_cell_values.cell_id) AND (f.workspace_id = get_user_workspace_id())))));

-- sublocation_positions
ALTER TABLE sublocation_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can delete sublocation_positions" ON sublocation_positions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_sublocations fs JOIN fridges f ON ((f.id = fs.fridge_id))) WHERE ((fs.id = sublocation_positions.sublocation_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can insert sublocation_positions" ON sublocation_positions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM (fridge_sublocations fs JOIN fridges f ON ((f.id = fs.fridge_id))) WHERE ((fs.id = sublocation_positions.sublocation_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can read sublocation_positions" ON sublocation_positions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_sublocations fs JOIN fridges f ON ((f.id = fs.fridge_id))) WHERE ((fs.id = sublocation_positions.sublocation_id) AND (f.workspace_id = get_user_workspace_id())))));
CREATE POLICY "Workspace members can update sublocation_positions" ON sublocation_positions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM (fridge_sublocations fs JOIN fridges f ON ((f.id = fs.fridge_id))) WHERE ((fs.id = sublocation_positions.sublocation_id) AND (f.workspace_id = get_user_workspace_id()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM (fridge_sublocations fs JOIN fridges f ON ((f.id = fs.fridge_id))) WHERE ((fs.id = sublocation_positions.sublocation_id) AND (f.workspace_id = get_user_workspace_id())))));

-- team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can add members to workspace" ON team_members FOR INSERT TO authenticated WITH CHECK ((is_owner_or_manager() AND (NOT is_owner()) AND (role = 'member'::text) AND (workspace_id = get_user_workspace_id())));
CREATE POLICY "Managers can restore removed members as members" ON team_members FOR UPDATE TO authenticated USING ((is_owner_or_manager() AND (NOT is_owner()) AND (workspace_id IS NULL) AND (role IS NULL))) WITH CHECK ((is_owner_or_manager() AND (NOT is_owner()) AND (workspace_id = get_user_workspace_id()) AND (role = 'member'::text)));
CREATE POLICY "Managers can soft delete members from workspace" ON team_members FOR UPDATE TO authenticated USING ((is_owner_or_manager() AND (NOT is_owner()) AND (role = 'member'::text) AND (workspace_id = get_user_workspace_id()))) WITH CHECK (((workspace_id IS NULL) AND (role IS NULL) AND (invited_by IS NULL)));
CREATE POLICY "Owner can add team members to workspace" ON team_members FOR INSERT TO authenticated WITH CHECK ((is_owner() AND (workspace_id = get_user_workspace_id())));
CREATE POLICY "Owner can restore removed members to workspace" ON team_members FOR UPDATE TO authenticated USING ((is_owner() AND (workspace_id IS NULL) AND (role IS NULL))) WITH CHECK ((is_owner() AND (workspace_id = get_user_workspace_id()) AND (role = ANY (ARRAY['manager'::text, 'member'::text]))));
CREATE POLICY "Owner can update or soft delete workspace members" ON team_members FOR UPDATE TO authenticated USING ((is_owner() AND (workspace_id = get_user_workspace_id()) AND (auth_user_id IS DISTINCT FROM auth.uid()))) WITH CHECK ((is_owner() AND ((workspace_id = get_user_workspace_id()) OR ((workspace_id IS NULL) AND (role IS NULL) AND (invited_by IS NULL)))));
CREATE POLICY "Owners and managers can view removed members" ON team_members FOR SELECT TO authenticated USING ((is_owner_or_manager() AND (workspace_id IS NULL) AND (role IS NULL)));
CREATE POLICY "Owners can update their own workspace_id" ON team_members FOR UPDATE TO authenticated USING (((auth_user_id = auth.uid()) AND (role = 'owner'::text))) WITH CHECK (((auth_user_id = auth.uid()) AND (role = 'owner'::text)));
CREATE POLICY "Owners without workspace can view self" ON team_members FOR SELECT TO authenticated USING (((auth_user_id = auth.uid()) AND (role = 'owner'::text) AND (workspace_id IS NULL)));
CREATE POLICY "Team members can view workspace members" ON team_members FOR SELECT TO authenticated USING (((workspace_id IS NOT NULL) AND (workspace_id = get_user_workspace_id())));
CREATE POLICY "Users can view own record" ON team_members FOR SELECT TO authenticated USING ((auth_user_id = auth.uid()));

-- workspace_backups
ALTER TABLE workspace_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delete_own_backups" ON workspace_backups FOR DELETE TO authenticated USING ((workspace_id IN ( SELECT team_members.workspace_id FROM team_members WHERE ((team_members.auth_user_id = auth.uid()) AND (team_members.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));
CREATE POLICY "insert_own_backups" ON workspace_backups FOR INSERT TO authenticated WITH CHECK ((workspace_id IN ( SELECT team_members.workspace_id FROM team_members WHERE ((team_members.auth_user_id = auth.uid()) AND (team_members.role = ANY (ARRAY['owner'::text, 'manager'::text]))))));
CREATE POLICY "select_own_backups" ON workspace_backups FOR SELECT TO authenticated USING ((workspace_id IN ( SELECT team_members.workspace_id FROM team_members WHERE (team_members.auth_user_id = auth.uid()))));

-- workspaces
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can create workspace" ON workspaces FOR INSERT TO authenticated WITH CHECK (is_workspace_owner_without_workspace());
CREATE POLICY "Owners can update their workspace" ON workspaces FOR UPDATE TO authenticated USING ((owner_id = get_user_team_member_id())) WITH CHECK ((owner_id = get_user_team_member_id()));
CREATE POLICY "Owners can view their workspace" ON workspaces FOR SELECT TO authenticated USING ((owner_id = get_user_team_member_id()));
CREATE POLICY "Team members can update workspace settings" ON workspaces FOR UPDATE TO authenticated USING ((id = get_user_workspace_id())) WITH CHECK ((id = get_user_workspace_id()));
CREATE POLICY "Team members can view their workspace" ON workspaces FOR SELECT TO authenticated USING ((id = get_user_workspace_id()));

-- ============================================================
-- 8. Realtime & Storage
-- ============================================================
-- Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE box_access_list;
ALTER TABLE box_access_list REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE box_grid_item_links;
ALTER TABLE box_grid_item_links REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE box_history;
ALTER TABLE box_history REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE box_privacy_settings;
ALTER TABLE box_privacy_settings REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE experiments;

ALTER PUBLICATION supabase_realtime ADD TABLE fridge_boxes;
ALTER TABLE fridge_boxes REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE fridge_cells;
ALTER TABLE fridge_cells REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE fridge_sublocations;

ALTER PUBLICATION supabase_realtime ADD TABLE fridges;

ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
ALTER TABLE inventory_items REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE item_custom_values;
ALTER TABLE item_custom_values REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE item_folder_headers;
ALTER TABLE item_folder_headers REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE item_folders;

ALTER PUBLICATION supabase_realtime ADD TABLE project_access_list;

ALTER PUBLICATION supabase_realtime ADD TABLE project_box_links;

ALTER PUBLICATION supabase_realtime ADD TABLE project_item_links;

ALTER PUBLICATION supabase_realtime ADD TABLE project_privacy_settings;

ALTER PUBLICATION supabase_realtime ADD TABLE projects;

ALTER PUBLICATION supabase_realtime ADD TABLE slide_box_headers;
ALTER TABLE slide_box_headers REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE slide_cell_values;
ALTER TABLE slide_cell_values REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE sublocation_positions;
ALTER TABLE sublocation_positions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
ALTER TABLE team_members REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE workspace_backups;
ALTER TABLE workspace_backups REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;

-- Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, owner, created_at, updated_at, version) VALUES ('icons', 'icons', true, NULL, NULL, NULL, now(), now(), 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, owner, created_at, updated_at, version) VALUES ('slide-images', 'slide-images', true, NULL, NULL, NULL, now(), now(), 0) ON CONFLICT (id) DO NOTHING;
