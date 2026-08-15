import { createContext, useContext, ReactNode } from 'react';
import {
  useWorkspaceSettings,
  useUpdateWorkspaceSettings,
  useRealtimeWorkspaceSettings,
} from '../hooks/useWorkspaceSettings';

interface WorkspaceSettingsContextValue {
  syncEnabled: boolean;
  autoOpenFirstFolder: boolean;
  autoOpenFirstItemFolder: boolean;
  colorfulIconsEnabled: boolean;
  autoExpandAllLocations: boolean;
  hierarchicalNavigation: boolean;
  rotateWideGridMobile: boolean;
  isLoading: boolean;
  toggleSync: (enabled: boolean) => void;
  toggleAutoOpenFirstFolder: (enabled: boolean) => void;
  toggleAutoOpenFirstItemFolder: (enabled: boolean) => void;
  toggleColorfulIcons: (enabled: boolean) => void;
  toggleAutoExpandAllLocations: (enabled: boolean) => void;
  toggleHierarchicalNavigation: (enabled: boolean) => void;
  toggleRotateWideGridMobile: (enabled: boolean) => void;
}

export const WorkspaceSettingsContext = createContext<WorkspaceSettingsContextValue | null>(null);

export function WorkspaceSettingsProvider({ children }: { children: ReactNode }) {
  const { data: settings, isLoading } = useWorkspaceSettings();
  const updateSettings = useUpdateWorkspaceSettings();

  useRealtimeWorkspaceSettings();

  const syncEnabled = settings?.live_sync_enabled ?? true;
  const autoOpenFirstFolder = settings?.auto_open_first_folder ?? false;
  const autoOpenFirstItemFolder = settings?.auto_open_first_item_folder ?? true;
  const colorfulIconsEnabled = settings?.colorful_icons_enabled ?? true;
  const autoExpandAllLocations = settings?.auto_expand_all_locations ?? true;
  const hierarchicalNavigation = settings?.hierarchical_navigation ?? true;
  const rotateWideGridMobile = settings?.rotate_wide_grid_mobile ?? false;

  const toggleSync = (enabled: boolean) => {
    updateSettings.mutate({ live_sync_enabled: enabled });
  };

  const toggleAutoOpenFirstFolder = (enabled: boolean) => {
    updateSettings.mutate({ auto_open_first_folder: enabled });
  };

  const toggleAutoOpenFirstItemFolder = (enabled: boolean) => {
    updateSettings.mutate({ auto_open_first_item_folder: enabled });
  };

  const toggleColorfulIcons = (enabled: boolean) => {
    updateSettings.mutate({ colorful_icons_enabled: enabled });
  };

  const toggleAutoExpandAllLocations = (enabled: boolean) => {
    updateSettings.mutate({ auto_expand_all_locations: enabled });
  };

  const toggleHierarchicalNavigation = (enabled: boolean) => {
    updateSettings.mutate({ hierarchical_navigation: enabled });
  };

  const toggleRotateWideGridMobile = (enabled: boolean) => {
    updateSettings.mutate({ rotate_wide_grid_mobile: enabled });
  };

  return (
    <WorkspaceSettingsContext.Provider
      value={{
        syncEnabled,
        autoOpenFirstFolder,
        autoOpenFirstItemFolder,
        colorfulIconsEnabled,
        autoExpandAllLocations,
        hierarchicalNavigation,
        rotateWideGridMobile,
        isLoading,
        toggleSync,
        toggleAutoOpenFirstFolder,
        toggleAutoOpenFirstItemFolder,
        toggleColorfulIcons,
        toggleAutoExpandAllLocations,
        toggleHierarchicalNavigation,
        toggleRotateWideGridMobile,
      }}
    >
      {children}
    </WorkspaceSettingsContext.Provider>
  );
}

export function useWorkspaceSettingsContext(): WorkspaceSettingsContextValue {
  const ctx = useContext(WorkspaceSettingsContext);
  if (!ctx) throw new Error('useWorkspaceSettingsContext must be used within WorkspaceSettingsProvider');
  return ctx;
}
