// Re-exports from WorkspaceSettingsContext for backwards compatibility.
// New code should import from './WorkspaceSettingsContext' directly.
export {
  WorkspaceSettingsContext as SyncContext,
  WorkspaceSettingsProvider as SyncProvider,
  useWorkspaceSettingsContext as useSyncContext,
} from './WorkspaceSettingsContext';
