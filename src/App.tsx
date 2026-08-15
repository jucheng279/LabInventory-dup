import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { SyncProvider, useSyncContext } from './contexts/SyncContext';
import { TutorialProvider } from './tutorial/TutorialContext';
import { TutorialOverlay, TutorialHubModal } from './components/tutorial';
import { useTutorialNavRef, type TutorialNavigation, type TutorialModal } from './tutorial/navigationRef';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, AccessPendingPage, WorkspaceSetupPage } from './components/auth';
import DnaLoader from './components/DnaLoader';
import Workspace from './components/Workspace';
import BoxView from './components/BoxView';
import SlideBoxView from './components/SlideBoxView';
import StructuredFreezerBoxView from './components/StructuredFreezerBoxView';
import LocationSidebar from './components/LocationSidebar';
import CreateLocationModal from './components/CreateLocationModal';
import EditLocationModal from './components/EditLocationModal';
import DeleteLocationModal from './components/DeleteLocationModal';
import CreateSublocationModal from './components/CreateSublocationModal';
import EditSublocationModal from './components/EditSublocationModal';
import DeleteSublocationModal from './components/DeleteSublocationModal';
import CreatePositionModal from './components/CreatePositionModal';
import EditPositionModal from './components/EditPositionModal';
import DeletePositionModal from './components/DeletePositionModal';
import TransferLocationModal from './components/TransferLocationModal';
import ProjectView from './components/ProjectView';
import CreateProjectModal from './components/CreateProjectModal';
import EditProjectModal from './components/EditProjectModal';
import DeleteProjectModal from './components/DeleteProjectModal';
import { useRealtimeWorkspace, useRealtimeLocation, useRealtimeBox } from './hooks/useRealtimeSync';
import SearchPage from './components/SearchPage';
import ExpirationPage from './components/ExpirationPage';
import LowStockPage from './components/LowStockPage';
import InventoryOverviewPage from './components/InventoryOverviewPage';
import AIChatPanel from './components/AIChatPanel';
import type { NavLinkData } from './components/AIChatMarkdown';
import { Refrigerator, Plus } from 'lucide-react';
import { preloadAllIcons } from './utils/preloadIcons';
import Toast from './components/Toast';


import {
  useNavigation,
  useLocationManager,
  useTransferManager,
  useProjectManager,
  useSearchState,
  useQRDeepLink,
  QR_SESSION_KEY,
  SELECTED_LOCATION_KEY,
  SELECTED_SUBLOCATION_KEY,
  SELECTED_POSITION_KEY,
} from './features';
import type { AuthPage } from './features';

function App() {
  const { status, clearPasswordRecovery } = useAuth();
  const [authPage, setAuthPage] = useState<AuthPage>('login');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrToken = params.get('qr');
    if (qrToken) {
      sessionStorage.setItem(QR_SESSION_KEY, qrToken);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (status === 'loading') {
    return <DnaLoader message="Loading workspace..." />;
  }

  if (status === 'password_recovery') {
    return <ResetPasswordPage onComplete={clearPasswordRecovery} />;
  }

  if (status === 'unauthenticated') {
    if (authPage === 'register') {
      return <RegisterPage onSwitchToLogin={() => setAuthPage('login')} />;
    }
    if (authPage === 'forgot-password') {
      return <ForgotPasswordPage onSwitchToLogin={() => setAuthPage('login')} />;
    }
    return (
      <LoginPage
        onSwitchToRegister={() => setAuthPage('register')}
        onSwitchToForgotPassword={() => setAuthPage('forgot-password')}
      />
    );
  }

  if (status === 'pending_access') return <AccessPendingPage />;
  if (status === 'pending_workspace_setup') return <WorkspaceSetupPage />;

  return (
    <SyncProvider>
      <AppWithTutorial />
    </SyncProvider>
  );
}

function AppWithTutorial() {
  const tutorialNavRef = useRef<TutorialNavigation | null>(null);

  return (
    <TutorialProvider navigationRef={tutorialNavRef}>
      <AuthenticatedApp />
      <TutorialOverlay />
      <TutorialHubModal />
    </TutorialProvider>
  );
}

function AuthenticatedApp() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [expirationLocationFilter, setExpirationLocationFilter] = useState<string | undefined>(undefined);
  const [lowStockLocationFilter, setLowStockLocationFilter] = useState<string | undefined>(undefined);

  const workspaceModalRef = useRef<{
    showBoxTypeSelection?: () => void;
    showCreateBox?: (boxType: 'freezer' | 'slide' | 'structured_freezer') => void;
    showCreateSlideBox?: () => void;
    showCreateItemFolder?: () => void;
    showCreateItem?: (folderId: string) => void;
    setInitialFolder?: (folderId: string) => void;
    closeAll?: () => void;
  }>({});

  const tutorialNavRef = useTutorialNavRef();
  const { syncEnabled, autoOpenFirstFolder, autoOpenFirstItemFolder, isLoading: isLoadingSettings } = useSyncContext();
  const { teamMember, workspace } = useAuth();

  // Navigation hook
  const nav = useNavigation();
  const {
    viewState, setViewState,
    selectedLocationId, setSelectedLocationId,
    selectedSublocation, setSelectedSublocation,
    selectedPosition, setSelectedPosition,
    sidebarCollapsed, setSidebarCollapsed,
    mobileMenuOpen, setMobileMenuOpen,
    hasAutoCollapsedRef, returningFromSearchRef,
    allSublocations, allPositions,
    handleSelectLocation, handleSelectSublocation, handleSelectPosition,
    handleOpenBox, handleOpenSheet, handleBackToWorkspace,
    handleNavigateToItem, handleNavigateToSheet, handleNavigateToBox, handleNavigateToLocation,
  } = nav;

  // Location manager hook
  const locMgr = useLocationManager({
    selectedLocationId,
    setSelectedLocationId,
    selectedSublocation,
    setSelectedSublocation,
    selectedPosition,
    setSelectedPosition,
  });
  const {
    locations, isLoadingLocations,
    showCreateLocationModal, setShowCreateLocationModal,
    editingLocation, setEditingLocation,
    deletingLocation, setDeletingLocation,
    creatingSublocationLocationId, setCreatingSublocationLocationId,
    editingSublocation, setEditingSublocation,
    deletingSublocation, setDeletingSublocation,
    creatingPositionSublocationId, setCreatingPositionSublocationId,
    editingPosition, setEditingPosition,
    deletingPosition, setDeletingPosition,
    handleCreateLocation, handleUpdateLocation, handleDeleteLocation,
    handleReorderLocations,
    handleCreateSublocation, handleUpdateSublocation, handleDeleteSublocation,
    handleCreatePosition, handleUpdatePosition, handleDeletePosition,
  } = locMgr;

  // Transfer manager hook
  const transfer = useTransferManager({
    selectedLocationId,
    setSelectedLocationId,
    selectedSublocation,
    setSelectedSublocation,
    selectedPosition,
    setSelectedPosition,
    setViewState,
    allSublocations,
    allPositions,
  });
  const {
    transferringLocation, setTransferringLocation,
    transferringPosition, setTransferringPosition,
    transferringSublocation, setTransferringSublocation,
    transferSource, isTransferring, handleTransfer,
  } = transfer;

  // Project manager hook
  const projMgr = useProjectManager({ setViewState, setMobileMenuOpen });
  const {
    projects,
    selectedProjectId, setSelectedProjectId,
    selectedExperimentId, setSelectedExperimentId,
    selectedExperimentName, setSelectedExperimentName,
    showCreateProjectModal, setShowCreateProjectModal,
    editingProject, setEditingProject,
    deletingProject, setDeletingProject,
    selectedProject, teamMembers,
    handleSelectProject, handleSelectExperiment,
    handleCreateProject, handleUpdateProject, handleDeleteProject,
  } = projMgr;

  // Search state hook
  const search = useSearchState({
    selectedLocationId,
    setSelectedLocationId,
    setSelectedSublocation,
    setSelectedPosition,
    setViewState,
    sidebarCollapsed,
    setSidebarCollapsed,
    hasAutoCollapsedRef,
    returningFromSearchRef,
  });
  const {
    searchPageStateRef,
    handleSearchStateChange, handleSearchBoxStateChange,
    handleOpenSearchPage,
    handleSearchNavigateToBox, handleSearchNavigateToLocation,
    handleBackToWorkspaceFromSearch,
    hasPersistedSearch,
  } = search;

  // QR deep link hook
  const { qrError, setQrError } = useQRDeepLink({
    isInitialized,
    setSelectedLocationId,
    setSelectedSublocation,
    setSelectedPosition,
    setViewState,
    allSublocations,
    allPositions,
  });

  const handleAIChatNavigate = useCallback((navData: NavLinkData) => {
    const { locationId, sublocationId, positionId, boxId, boxName, boxType, cellId, folderId, folderName, itemId } = navData;

    if (itemId && folderId && locationId) {
      handleNavigateToItem(locationId, sublocationId || null, positionId || null, folderId, itemId, folderName || undefined, null);
    } else if (folderId && locationId) {
      nav.handleNavigateToSheet(locationId, sublocationId || null, positionId || null, folderId, folderName || undefined, null);
    } else if (boxId) {
      if (!locationId) return;
      const bt = (boxType === 'slide' || boxType === 'structured_freezer' || boxType === 'freezer') ? boxType : undefined;
      handleNavigateToBox(locationId, boxId, boxName || 'Box', null, bt as any, cellId || undefined, undefined, sublocationId || undefined, positionId || undefined);
    } else if (positionId && sublocationId && locationId) {
      const sub = allSublocations.find(s => s.id === sublocationId);
      const pos = allPositions.find(p => p.id === positionId);
      handleSelectPosition(
        locationId,
        sublocationId,
        sub?.name || navData.displayText || '',
        sub?.accent_color || null,
        sub?.location_type || 'general',
        sub?.icon_id || null,
        positionId,
        pos?.name || navData.displayText || '',
        pos?.accent_color || null,
        pos?.location_type || 'general',
        pos?.icon_id || null
      );
    } else if (sublocationId && locationId) {
      const sub = allSublocations.find(s => s.id === sublocationId);
      handleSelectSublocation(
        locationId,
        sublocationId,
        sub?.name || navData.displayText || '',
        sub?.accent_color || null,
        sub?.location_type || 'general',
        sub?.icon_id || null
      );
    } else if (locationId) {
      handleNavigateToLocation(locationId);
    }
  }, [handleNavigateToBox, handleNavigateToItem, nav, handleSelectPosition, handleSelectSublocation, handleNavigateToLocation, allSublocations, allPositions]);

  // Preload icons
  useEffect(() => {
    preloadAllIcons();
  }, []);

  // Tutorial navigation ref setup
  useEffect(() => {
    if (!tutorialNavRef) return;
    tutorialNavRef.current = {
      selectLocation: (locationId: string) => {
        setSelectedLocationId(locationId);
        setSelectedSublocation(null);
        setSelectedPosition(null);
        setViewState({ view: 'workspace' });
      },
      openBox: (boxId: string, name: string, color: string | null, type: string) => {
        setViewState({ view: 'box', boxId, boxName: name, boxAccentColor: color, boxType: type as any });
      },
      backToWorkspace: () => {
        setViewState({ view: 'workspace' });
        hasAutoCollapsedRef.current = false;
      },
      openSearch: (query?: string) => {
        setViewState({ view: 'search', searchQuery: query || '', searchDateFilter: null, searchFilterState: null });
      },
      setInitialFolder: (folderId: string) => {
        setViewState({ view: 'workspace', initialFolderId: folderId });
        if (workspaceModalRef.current.setInitialFolder) {
          workspaceModalRef.current.setInitialFolder(folderId);
        }
      },
      showModal: (modal: TutorialModal) => {
        if (modal === 'CreateLocation') {
          setShowCreateLocationModal(true);
        } else if (modal === 'BoxTypeSelection') {
          workspaceModalRef.current.showBoxTypeSelection?.();
        } else if (modal === 'CreateSlideBox') {
          workspaceModalRef.current.showCreateSlideBox?.();
        } else if (modal === 'CreateItemFolder') {
          workspaceModalRef.current.showCreateItemFolder?.();
        } else if (modal === 'IconHub') {
          // IconHub is managed within EditLocationModal - no-op
        } else if (typeof modal === 'object') {
          if (modal.type === 'CreateBox') {
            workspaceModalRef.current.showCreateBox?.(modal.boxType);
          } else if (modal.type === 'CreateItem') {
            workspaceModalRef.current.showCreateItem?.(modal.folderId);
          } else if (modal.type === 'EditLocation') {
            const location = locations.find(f => f.id === modal.locationId);
            if (location) setEditingLocation(location);
          } else if (modal.type === 'CreateSublocation') {
            setCreatingSublocationLocationId(modal.locationId);
          } else if (modal.type === 'CreatePosition') {
            setCreatingPositionSublocationId(modal.sublocationId);
          }
        }
      },
      closeAllModals: () => {
        setShowCreateLocationModal(false);
        setEditingLocation(null);
        setDeletingLocation(null);
        setCreatingSublocationLocationId(null);
        setEditingSublocation(null);
        setDeletingSublocation(null);
        setCreatingPositionSublocationId(null);
        setEditingPosition(null);
        setDeletingPosition(null);
        setShowCreateProjectModal(false);
        setEditingProject(null);
        setDeletingProject(null);
        workspaceModalRef.current.closeAll?.();
      },
    };
  });

  // Realtime sync
  const activeBoxId = viewState.view === 'box' ? viewState.boxId ?? null : null;
  useRealtimeWorkspace(syncEnabled);
  useRealtimeLocation(selectedLocationId, syncEnabled);
  useRealtimeBox(activeBoxId, syncEnabled);

  // Initialize from localStorage / autoOpenFirstFolder
  useEffect(() => {
    if (!isLoadingLocations && !isLoadingSettings && !isInitialized) {
      const savedLocationId = localStorage.getItem(SELECTED_LOCATION_KEY);
      if (savedLocationId && locations.some((f) => f.id === savedLocationId)) {
        setSelectedLocationId(savedLocationId);
        setViewState({ view: 'workspace' });
      } else if (autoOpenFirstFolder && locations.length > 0) {
        setSelectedLocationId(locations[0].id);
        localStorage.setItem(SELECTED_LOCATION_KEY, locations[0].id);
        setViewState({ view: 'workspace' });
      }
      setIsInitialized(true);
    }
  }, [isLoadingLocations, isLoadingSettings, locations, isInitialized, autoOpenFirstFolder]);

  // Returning from search effect
  useEffect(() => {
    if (viewState.view === 'workspace' && returningFromSearchRef.current) {
      returningFromSearchRef.current = false;
    }
  });

  const selectedLocation = locations.find((f) => f.id === selectedLocationId);

  const sidebarProps = {
    locations,
    selectedLocationId,
    selectedSublocationId: selectedSublocation?.id || null,
    selectedPositionId: selectedPosition?.id || null,
    onSelectLocation: handleSelectLocation,
    onSelectSublocation: handleSelectSublocation,
    onSelectPosition: handleSelectPosition,
    onCreateLocation: () => setShowCreateLocationModal(true),
    onEditLocation: setEditingLocation,
    onReorderLocations: handleReorderLocations,
    onCreateSublocation: setCreatingSublocationLocationId,
    onEditSublocation: setEditingSublocation,
    onCreatePosition: setCreatingPositionSublocationId,
    onEditPosition: setEditingPosition,
    onTransferLocation: setTransferringLocation,
    onTransferSublocation: setTransferringSublocation,
    onTransferPosition: setTransferringPosition,
    onOpenExpirationView: () => {
      setExpirationLocationFilter(undefined);
      setViewState({ view: 'expiration' });
    },
    onOpenInventoryView: () => {
      setViewState({ view: 'inventoryOverview' });
      setSelectedLocationId(null);
      setSelectedSublocation(null);
      setSelectedPosition(null);
      localStorage.removeItem(SELECTED_LOCATION_KEY);
      localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
    },
    onOpenLowStockView: () => {
      setLowStockLocationFilter(undefined);
      setViewState({ view: 'lowStock' });
    },
    isExpirationActive: viewState.view === 'expiration',
    isLowStockActive: viewState.view === 'lowStock',
    isInventoryOverviewActive: viewState.view === 'inventoryOverview',
    selectedProjectId,
    selectedExperimentId,
    isProjectActive: viewState.view === 'project',
    onSelectProject: handleSelectProject,
    onSelectExperiment: handleSelectExperiment,
    onCreateProject: () => setShowCreateProjectModal(true),
    onOpenAIChat: () => {
      setViewState({ view: 'aiChat' });
      setSelectedLocationId(null);
      setSelectedSublocation(null);
      setSelectedPosition(null);
      setSelectedProjectId(null);
      setSelectedExperimentId(null);
    },
    isAIChatActive: viewState.view === 'aiChat',
  };

  if (isLoadingLocations || isLoadingSettings || !isInitialized) {
    return <DnaLoader message="Loading samples..." />;
  }

  if (locations.length === 0) {
    return (
      <div className="flex h-full bg-gray-50 overflow-hidden">
        <div className="hidden md:flex">
          <LocationSidebar
            {...sidebarProps}
            selectedLocationId={null}
            selectedSublocationId={null}
            selectedPositionId={null}
            onSelectLocation={() => {}}
            onSelectSublocation={() => {}}
            onSelectPosition={() => {}}
            onEditLocation={() => {}}
            onReorderLocations={() => {}}
            onCreateSublocation={() => {}}
            onEditSublocation={() => {}}
            onCreatePosition={() => {}}
            onEditPosition={() => {}}
            onTransferLocation={() => {}}
            onTransferSublocation={() => {}}
            onTransferPosition={() => {}}
            onOpenExpirationView={() => {}}
            onOpenInventoryView={() => {}}
            onOpenLowStockView={() => {}}
            isInventoryOverviewActive={false}
            isCollapsed={false}
            onToggleCollapse={() => {}}
          />
        </div>
        <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-gray-50">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-6 shadow-lg shadow-blue-500/20">
              <Refrigerator className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Lab Manager</h1>
            <p className="text-gray-500 mb-8">
              Create your first location to start organizing your reagents, samples, and inventory.
            </p>
            <button
              onClick={() => setShowCreateLocationModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
            >
              <Plus size={20} />
              Create Your First Location
            </button>

            {showCreateLocationModal && (
              <CreateLocationModal
                onClose={() => setShowCreateLocationModal(false)}
                onCreate={handleCreateLocation}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
      <div className="hidden md:flex">
        <LocationSidebar
          {...sidebarProps}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 h-full">
            <LocationSidebar
              {...sidebarProps}
              onCreateLocation={() => {
                setShowCreateLocationModal(true);
                setMobileMenuOpen(false);
              }}
              onEditLocation={(location) => {
                setEditingLocation(location);
                setMobileMenuOpen(false);
              }}
              onCreateSublocation={(locationId) => {
                setCreatingSublocationLocationId(locationId);
                setMobileMenuOpen(false);
              }}
              onEditSublocation={(sublocation) => {
                setEditingSublocation(sublocation);
                setMobileMenuOpen(false);
              }}
              onCreatePosition={(sublocationId) => {
                setCreatingPositionSublocationId(sublocationId);
                setMobileMenuOpen(false);
              }}
              onEditPosition={(position) => {
                setEditingPosition(position);
                setMobileMenuOpen(false);
              }}
              onTransferLocation={(location) => {
                setTransferringLocation(location);
                setMobileMenuOpen(false);
              }}
              onTransferSublocation={(sublocation) => {
                setTransferringSublocation(sublocation);
                setMobileMenuOpen(false);
              }}
              onTransferPosition={(position) => {
                setTransferringPosition(position);
                setMobileMenuOpen(false);
              }}
              onOpenExpirationView={() => {
                setExpirationLocationFilter(undefined);
                setViewState({ view: 'expiration' });
                setMobileMenuOpen(false);
              }}
              onOpenInventoryView={() => {
                setViewState({ view: 'inventoryOverview' });
                setSelectedLocationId(null);
                setSelectedSublocation(null);
                setSelectedPosition(null);
                localStorage.removeItem(SELECTED_LOCATION_KEY);
                localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
              }}
              onOpenLowStockView={() => {
                setLowStockLocationFilter(undefined);
                setViewState({ view: 'lowStock' });
                setMobileMenuOpen(false);
              }}
              onOpenAIChat={() => {
                setViewState({ view: 'aiChat' });
                setSelectedLocationId(null);
                setSelectedSublocation(null);
                setSelectedPosition(null);
                setSelectedProjectId(null);
                setSelectedExperimentId(null);
                setMobileMenuOpen(false);
              }}
              isInventoryOverviewActive={viewState.view === 'inventoryOverview'}
              isCollapsed={false}
              onToggleCollapse={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {viewState.view === 'expiration' ? (
          <ExpirationPage
            onNavigateToBox={(locationId, boxId, boxName, boxAccentColor, boxType, highlightCellId) =>
              handleNavigateToBox(locationId, boxId, boxName, boxAccentColor, boxType, highlightCellId)
            }
            onNavigateToLocation={handleNavigateToLocation}
            onMobileMenuToggle={() => setMobileMenuOpen(true)}
            initialLocationFilter={expirationLocationFilter}
          />
        ) : viewState.view === 'lowStock' ? (
          <LowStockPage onNavigateToLocation={handleNavigateToLocation} onMobileMenuToggle={() => setMobileMenuOpen(true)} initialLocationFilter={lowStockLocationFilter} />
        ) : viewState.view === 'search' ? (
          <SearchPage
            initialQuery={viewState.searchQuery || searchPageStateRef.current?.query || ''}
            initialDateFilter={viewState.searchDateFilter ?? searchPageStateRef.current?.dateFilter ?? null}
            initialFilterState={viewState.searchFilterState ?? searchPageStateRef.current?.filterState ?? null}
            onBack={handleBackToWorkspaceFromSearch}
            onNavigateToBox={handleSearchNavigateToBox}
            onNavigateToLocation={handleSearchNavigateToLocation}
            onNavigateToItem={handleNavigateToItem}
            onSearchStateChange={handleSearchStateChange}
          />
        ) : viewState.view === 'box' && viewState.boxId && viewState.boxName && selectedLocationId ? (
          viewState.boxType === 'slide' ? (
            <SlideBoxView
              boxId={viewState.boxId}
              boxName={viewState.boxName}
              boxAccentColor={viewState.boxAccentColor}
              locationId={selectedLocationId}
              onBack={() => handleBackToWorkspace(selectedProjectId)}
              highlightCellId={viewState.highlightCellId}
              highlightColumn={viewState.highlightColumn}
            />
          ) : viewState.boxType === 'structured_freezer' ? (
            <StructuredFreezerBoxView
              boxId={viewState.boxId}
              boxName={viewState.boxName}
              boxAccentColor={viewState.boxAccentColor}
              locationId={selectedLocationId}
              onBack={() => handleBackToWorkspace(selectedProjectId)}
              highlightCellId={viewState.highlightCellId}
              onNavigateToItem={handleNavigateToItem}
            />
          ) : (
            <BoxView
              boxId={viewState.boxId}
              boxName={viewState.boxName}
              boxAccentColor={viewState.boxAccentColor}
              locationId={selectedLocationId}
              onBack={() => handleBackToWorkspace(selectedProjectId)}
              highlightCellId={viewState.highlightCellId}
              onNavigateToItem={handleNavigateToItem}
            />
          )
        ) : viewState.view === 'project' && selectedProject ? (
          <ProjectView
            project={selectedProject}
            experimentId={selectedExperimentId}
            experimentName={selectedExperimentName}
            onOpenBox={(boxId, boxName, boxAccentColor, boxType) => {
              setViewState({ view: 'box', boxId, boxName, boxAccentColor, boxType });
              if (window.innerWidth < 768) setSidebarCollapsed(true);
            }}
            onMobileMenuToggle={() => setMobileMenuOpen(true)}
            onSelectExperiment={(exp) => {
              setSelectedExperimentId(exp.id);
              setSelectedExperimentName(exp.name);
            }}
            onClearExperiment={() => {
              setSelectedExperimentId(null);
              setSelectedExperimentName(null);
            }}
            onEditProject={() => setEditingProject(selectedProject)}
            onDeleteProject={() => setDeletingProject(selectedProject)}
          />
        ) : viewState.view === 'aiChat' ? (
          <AIChatPanel onNavigate={handleAIChatNavigate} />
        ) : viewState.view === 'inventoryOverview' ? (
          <InventoryOverviewPage
            onSelectLocation={handleSelectLocation}
            onSelectSublocation={handleSelectSublocation}
            onSelectPosition={handleSelectPosition}
            onOpenBox={(locationId, boxId, boxName, boxAccentColor, boxType) => {
              handleNavigateToBox(locationId, boxId, boxName, boxAccentColor ?? null, boxType);
            }}
            onOpenFolder={(locationId, folderId, sublocationId, positionId, folderName) => {
              handleNavigateToSheet(locationId, sublocationId || null, positionId || null, folderId, folderName || undefined, null);
            }}
            onOpenExpirationView={(initialFilter) => {
              setExpirationLocationFilter(initialFilter);
              setViewState({ view: 'expiration' });
            }}
            onOpenLowStockView={(initialFilter) => {
              setLowStockLocationFilter(initialFilter);
              setViewState({ view: 'lowStock' });
            }}
            onMobileMenuToggle={() => setMobileMenuOpen(true)}
            onNavigateToBox={handleNavigateToBox}
            onNavigateToItem={handleNavigateToItem}
            onNavigateToLocation={handleNavigateToLocation}
            onOpenSearchPage={handleOpenSearchPage}
            onAIChatNavigate={handleAIChatNavigate}
          />
        ) : selectedLocationId && selectedLocation ? (
          <Workspace
            locationId={selectedLocationId}
            locationName={selectedLocation.name}
            locationAccentColor={selectedLocation.accent_color}
            locationLocationType={selectedLocation.location_type}
            showStorageBoxes={selectedLocation.show_storage_boxes}
            showInventoryItems={selectedLocation.show_inventory_items}
            sublocationId={selectedSublocation?.id || null}
            sublocationName={selectedSublocation?.name || null}
            sublocationAccentColor={selectedSublocation?.accentColor || null}
            sublocationLocationType={selectedSublocation?.locationType || null}
            sublocationIconId={selectedSublocation?.iconId || null}
            positionId={selectedPosition?.id || null}
            positionName={selectedPosition?.name || null}
            positionAccentColor={selectedPosition?.accentColor || null}
            positionLocationType={selectedPosition?.locationType || null}
            positionIconId={selectedPosition?.iconId || null}
            locations={locations}
            onOpenBox={handleOpenBox}
            onMobileMenuToggle={() => setMobileMenuOpen(true)}
            onNavigateToBox={handleNavigateToBox}
            onNavigateToLocation={handleNavigateToLocation}
            onClearSublocation={() => {
              setSelectedSublocation(null);
              setSelectedPosition(null);
              localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
              localStorage.removeItem(SELECTED_POSITION_KEY);
            }}
            onClearPosition={() => {
              setSelectedPosition(null);
              localStorage.removeItem(SELECTED_POSITION_KEY);
            }}
            onOpenSearchPage={handleOpenSearchPage}
            hasPersistedSearch={hasPersistedSearch}
            initialSearchQuery={searchPageStateRef.current?.query}
            initialSearchDateFilter={searchPageStateRef.current?.dateFilter}
            initialSearchFilterState={searchPageStateRef.current?.filterState}
            onSearchBoxStateChange={handleSearchBoxStateChange}
            autoOpenFirstItemFolder={autoOpenFirstItemFolder}
            initialFolderId={viewState.view === 'sheet' ? viewState.sheetId : viewState.initialFolderId}
            highlightItemId={viewState.view === 'sheet' ? viewState.highlightItemId || null : null}
            isSheetView={viewState.view === 'sheet'}
            onBackFromSheet={() => handleBackToWorkspace(selectedProjectId)}
            onOpenSheet={handleOpenSheet}
            onSelectSublocation={handleSelectSublocation}
            onSelectPosition={handleSelectPosition}
            skipEntranceAnimation={returningFromSearchRef.current || viewState.view === 'sheet'}
            tutorialModalRef={workspaceModalRef}
          />
        ) : null}
      </div>

      {showCreateLocationModal && (
        <CreateLocationModal
          onClose={() => setShowCreateLocationModal(false)}
          onCreate={handleCreateLocation}
        />
      )}

      {editingLocation && (
        <EditLocationModal
          location={editingLocation}
          onClose={() => setEditingLocation(null)}
          onUpdate={handleUpdateLocation}
          onDelete={() => {
            const location = editingLocation;
            setEditingLocation(null);
            setDeletingLocation(location);
          }}
        />
      )}

      {deletingLocation && (
        <DeleteLocationModal
          location={deletingLocation}
          onClose={() => setDeletingLocation(null)}
          onDelete={handleDeleteLocation}
        />
      )}

      {creatingSublocationLocationId && (
        <CreateSublocationModal
          locationId={creatingSublocationLocationId}
          onClose={() => setCreatingSublocationLocationId(null)}
          onCreate={handleCreateSublocation}
        />
      )}

      {editingSublocation && (
        <EditSublocationModal
          sublocation={editingSublocation}
          onClose={() => setEditingSublocation(null)}
          onUpdate={handleUpdateSublocation}
          onDelete={() => {
            const sublocation = editingSublocation;
            setEditingSublocation(null);
            setDeletingSublocation(sublocation);
          }}
        />
      )}

      {deletingSublocation && (
        <DeleteSublocationModal
          sublocation={deletingSublocation}
          onClose={() => setDeletingSublocation(null)}
          onDelete={handleDeleteSublocation}
        />
      )}

      {creatingPositionSublocationId && (
        <CreatePositionModal
          sublocationId={creatingPositionSublocationId}
          onClose={() => setCreatingPositionSublocationId(null)}
          onCreate={handleCreatePosition}
        />
      )}

      {editingPosition && (
        <EditPositionModal
          position={editingPosition}
          onClose={() => setEditingPosition(null)}
          onUpdate={handleUpdatePosition}
          onDelete={() => {
            const position = editingPosition;
            setEditingPosition(null);
            setDeletingPosition(position);
          }}
        />
      )}

      {deletingPosition && (
        <DeletePositionModal
          position={deletingPosition}
          onClose={() => setDeletingPosition(null)}
          onDelete={handleDeletePosition}
        />
      )}

      {transferSource && (
        <TransferLocationModal
          source={transferSource}
          locations={locations}
          onClose={() => {
            setTransferringLocation(null);
            setTransferringPosition(null);
            setTransferringSublocation(null);
          }}
          onTransfer={handleTransfer}
          isTransferring={isTransferring}
        />
      )}

      {showCreateProjectModal && teamMember && (
        <CreateProjectModal
          onClose={() => setShowCreateProjectModal(false)}
          onCreate={handleCreateProject}
          teamMembers={teamMembers}
          currentTeamMemberId={teamMember.id}
        />
      )}

      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleUpdateProject}
        />
      )}

      {deletingProject && (
        <DeleteProjectModal
          project={deletingProject}
          onClose={() => setDeletingProject(null)}
          onDelete={handleDeleteProject}
        />
      )}

      {qrError && (
        <Toast message={qrError} type="error" onClose={() => setQrError(null)} duration={5000} />
      )}

    </div>
  );
}

export default App;
