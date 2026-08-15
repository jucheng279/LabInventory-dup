import { useState } from 'react';
import { X, Settings, RefreshCw, MapPin, FolderOpen, Palette, ListTree, Zap, Building2, Pencil, Check, Loader2, Network, Smartphone } from 'lucide-react';
import { useSyncContext } from '../contexts/SyncContext';
import { useAuth } from '../contexts/AuthContext';
import Portal from './Portal';

interface WorkspaceModalProps {
  onClose: () => void;
}

interface SettingRow {
  key: string;
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function ToggleRow({ icon, label, enabled, onToggle, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 flex-shrink-0">
          {icon}
        </div>
        <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
      </div>
      <button
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } ${
          enabled ? 'bg-emerald-500' : 'bg-gray-200'
        }`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

interface SettingsGroupProps {
  title: string;
  icon: React.ReactNode;
  rows: SettingRow[];
  disabled?: boolean;
}

function SettingsGroup({ title, icon, rows, disabled }: SettingsGroupProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </h3>
      </div>
      <div className="bg-gray-50 rounded-xl divide-y divide-gray-200/70 border border-gray-100">
        {rows.map((row) => (
          <ToggleRow
            key={row.key}
            icon={row.icon}
            label={row.label}
            enabled={row.enabled}
            onToggle={row.onToggle}
            disabled={disabled || row.disabled}
          />
        ))}
      </div>
    </div>
  );
}

interface WorkspaceNameRowProps {
  name: string;
  canEdit: boolean;
  onSave: (name: string) => Promise<void>;
}

function WorkspaceNameRow({ name, canEdit, onSave }: WorkspaceNameRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setValue(name);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
    setValue(name);
  };

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== name && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update workspace name');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 flex-shrink-0">
            <Building2 size={16} className="text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">Workspace Name</p>
            {!editing && (
              <p className="text-sm text-gray-500 truncate mt-0.5">{name}</p>
            )}
          </div>
        </div>
        {!editing && canEdit && (
          <button
            onClick={startEdit}
            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-colors flex-shrink-0"
            title="Edit workspace name"
          >
            <Pencil size={15} />
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') cancel();
              }}
              autoFocus
              disabled={saving}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-60"
              placeholder="Enter workspace name"
            />
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceModal({ onClose }: WorkspaceModalProps) {
  const { workspace, canManageTeam, renameWorkspace } = useAuth();
  const {
    syncEnabled,
    autoOpenFirstFolder,
    autoOpenFirstItemFolder,
    colorfulIconsEnabled,
    autoExpandAllLocations,
    hierarchicalNavigation,
    rotateWideGridMobile,
    toggleSync,
    toggleAutoOpenFirstFolder,
    toggleAutoOpenFirstItemFolder,
    toggleColorfulIcons,
    toggleAutoExpandAllLocations,
    toggleHierarchicalNavigation,
    toggleRotateWideGridMobile,
  } = useSyncContext();

  const generalRows: SettingRow[] = [
    {
      key: 'live-sync',
      icon: (
        <RefreshCw
          size={16}
          className={`transition-all duration-300 ${syncEnabled ? 'text-emerald-600 animate-spin-slow' : 'text-gray-400'}`}
        />
      ),
      label: 'Live Sync',
      enabled: syncEnabled,
      onToggle: () => toggleSync(!syncEnabled),
    },
    {
      key: 'colorful-icons',
      icon: (
        <Palette
          size={16}
          className={`transition-all duration-300 ${colorfulIconsEnabled ? 'text-emerald-600' : 'text-gray-400'}`}
        />
      ),
      label: 'Colorful Icons',
      enabled: colorfulIconsEnabled,
      onToggle: () => toggleColorfulIcons(!colorfulIconsEnabled),
    },
  ];

  const navigationRows: SettingRow[] = [
    {
      key: 'hierarchical-navigation',
      icon: (
        <Network
          size={16}
          className={`transition-all duration-300 ${hierarchicalNavigation ? 'text-emerald-600' : 'text-gray-400'}`}
        />
      ),
      label: 'Hierarchical Location View',
      enabled: hierarchicalNavigation,
      onToggle: () => toggleHierarchicalNavigation(!hierarchicalNavigation),
    },
  ];

  const automationRows: SettingRow[] = [
    {
      key: 'auto-select-first-location',
      icon: (
        <MapPin
          size={16}
          className={`transition-all duration-300 ${autoOpenFirstFolder ? 'text-emerald-600' : 'text-gray-400'}`}
        />
      ),
      label: 'Auto-Select First Location',
      enabled: autoOpenFirstFolder,
      onToggle: () => toggleAutoOpenFirstFolder(!autoOpenFirstFolder),
    },
    {
      key: 'auto-expand-locations',
      icon: (
        <ListTree
          size={16}
          className={`transition-all duration-300 ${autoExpandAllLocations ? 'text-emerald-600' : 'text-gray-400'}`}
        />
      ),
      label: 'Auto-Expand Location Hierarchy',
      enabled: autoExpandAllLocations,
      onToggle: () => toggleAutoExpandAllLocations(!autoExpandAllLocations),
    },
    {
      key: 'auto-open-first-item-folder',
      icon: (
        <FolderOpen
          size={16}
          className={`transition-all duration-300 ${autoOpenFirstItemFolder ? 'text-emerald-600' : 'text-gray-400'}`}
        />
      ),
      label: 'Auto-Open First Item Folder',
      enabled: autoOpenFirstItemFolder,
      onToggle: () => toggleAutoOpenFirstItemFolder(!autoOpenFirstItemFolder),
    },
  ];

  const mobileRows: SettingRow[] = [
    {
      key: 'rotate-wide-grid-mobile',
      icon: (
        <Smartphone
          size={16}
          className={`transition-all duration-300 ${rotateWideGridMobile ? 'text-emerald-600' : 'text-gray-400'}`}
        />
      ),
      label: 'Rotate Wide Grids on Mobile',
      enabled: rotateWideGridMobile,
      onToggle: () => toggleRotateWideGridMobile(!rotateWideGridMobile),
    },
  ];

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-gray-900/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-50 rounded-xl">
                <Settings className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Workspace Settings</h2>
                <p className="text-sm text-gray-500">Manage your workspace preferences</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {workspace && (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-gray-400">
                    <Building2 size={12} />
                  </span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Workspace
                  </h3>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-100">
                  <WorkspaceNameRow
                    name={workspace.name}
                    canEdit={canManageTeam}
                    onSave={renameWorkspace}
                  />
                </div>
              </div>
            )}
            <SettingsGroup
              title="General"
              icon={<Settings size={12} />}
              rows={generalRows}
              disabled={!canManageTeam}
            />
            <SettingsGroup
              title="Navigation"
              icon={<Network size={12} />}
              rows={navigationRows}
              disabled={!canManageTeam}
            />
            <SettingsGroup
              title="Automation"
              icon={<Zap size={12} />}
              rows={automationRows}
              disabled={!canManageTeam}
            />
            <SettingsGroup
              title="Mobile"
              icon={<Smartphone size={12} />}
              rows={mobileRows}
              disabled={!canManageTeam}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}
