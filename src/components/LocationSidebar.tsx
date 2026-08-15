import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Pencil,
  ChevronLeft,
  Menu,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Users,
  Crown,
  Shield,
  User,
  Settings,
  ArrowRightLeft,
  LayoutDashboard,
  CalendarClock,
  TrendingDown,
  HardDrive,
  FolderKanban,
  GraduationCap,

} from 'lucide-react';

import AiSparkleIcon from './AiSparkleIcon';
import { useExpirationStats } from '../hooks/useExpirations';
import { useLowStockStats } from '../hooks/useLowStock';
import { LocationWithStats } from '../services/locationManagerService';
import { SublocationWithStats, sublocationService } from '../services/sublocationService';
import { PositionWithStats, positionService } from '../services/positionService';
import { useAuth } from '../contexts/AuthContext';
import { useAllSublocations, ALL_SUBLOCATIONS_QUERY_KEY, getSublocationsQueryKey } from '../hooks/useSublocationData';
import { useAllPositions, ALL_POSITIONS_QUERY_KEY, getPositionsQueryKey } from '../hooks/usePositionData';
import { getLocationIconId } from '../config/locationTypes';
import SvgIcon from './SvgIcon';
import { signOut } from '../services/authService';
import { queryClient } from '../lib/queryClient';
import TeamManagementModal from './team/TeamManagementModal';
import WorkspaceModal from './WorkspaceModal';
import BackupModal from './BackupModal';
import { useSyncContext } from '../contexts/SyncContext';
import { useTutorial } from '../tutorial/TutorialContext';
import { useProjects } from '../hooks/useProjectData';
import { useExperiments } from '../hooks/useExperimentData';
import type { ProjectWithStats, ExperimentWithStats } from '../types/database';

const roleIcons = {
  owner: Crown,
  manager: Shield,
  member: User,
};

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  member: 'Member',
};

interface LocationSidebarProps {
  locations: LocationWithStats[];
  selectedLocationId: string | null;
  selectedSublocationId: string | null;
  selectedPositionId: string | null;
  onSelectLocation: (locationId: string) => void;
  onSelectSublocation: (locationId: string, sublocationId: string, sublocationName: string, accentColor: string | null, locationType: string, iconId: string | null) => void;
  onSelectPosition: (locationId: string, sublocationId: string, sublocationName: string, sublocationAccentColor: string | null, sublocationLocationType: string, sublocationIconId: string | null, positionId: string, positionName: string, accentColor: string | null, locationType: string, positionIconId: string | null) => void;
  onCreateLocation: () => void;
  onEditLocation: (location: LocationWithStats) => void;
  onReorderLocations: (locationIds: string[]) => void;
  onCreateSublocation: (locationId: string) => void;
  onEditSublocation: (sublocation: SublocationWithStats) => void;
  onCreatePosition: (sublocationId: string) => void;
  onEditPosition: (position: PositionWithStats) => void;
  onTransferLocation: (location: LocationWithStats) => void;
  onTransferSublocation: (sublocation: SublocationWithStats) => void;
  onTransferPosition: (position: PositionWithStats) => void;
  onOpenExpirationView: () => void;
  onOpenInventoryView: () => void;
  onOpenLowStockView: () => void;
  isExpirationActive?: boolean;
  isLowStockActive?: boolean;
  isInventoryOverviewActive?: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectedProjectId?: string | null;
  selectedExperimentId?: string | null;
  isProjectActive?: boolean;
  onSelectProject?: (project: ProjectWithStats) => void;
  onSelectExperiment?: (project: ProjectWithStats, experiment: ExperimentWithStats) => void;
  onCreateProject?: () => void;
  onOpenAIChat?: () => void;
  isAIChatActive?: boolean;
}

const LocationSidebar: React.FC<LocationSidebarProps> = ({
  locations,
  selectedLocationId,
  selectedSublocationId,
  selectedPositionId,
  onSelectLocation,
  onSelectSublocation,
  onSelectPosition,
  onCreateLocation,
  onEditLocation,
  onReorderLocations,
  onCreateSublocation,
  onEditSublocation,
  onCreatePosition,
  onEditPosition,
  onTransferLocation,
  onTransferSublocation,
  onTransferPosition,
  onOpenExpirationView,
  onOpenInventoryView,
  onOpenLowStockView,
  isExpirationActive = false,
  isLowStockActive = false,
  isInventoryOverviewActive = false,
  isCollapsed,
  onToggleCollapse,
  selectedProjectId = null,
  selectedExperimentId = null,
  isProjectActive = false,
  onSelectProject,
  onSelectExperiment,
  onCreateProject,
  onOpenAIChat,
  isAIChatActive = false,
}) => {
  const { workspace, user, teamMember, canManageTeam } = useAuth();
  const { openHub: openTutorialHub } = useTutorial();
  const { data: allSublocations = [] } = useAllSublocations();
  const { data: allPositions = [] } = useAllPositions();
  const { autoExpandAllLocations } = useSyncContext();
  const { counts: expirationCounts } = useExpirationStats();
  const { counts: lowStockCounts, total: lowStockTotal } = useLowStockStats();
  const lowStockUrgentCount = lowStockCounts.out + lowStockCounts.critical;
  const [inventoryExpanded, setInventoryExpanded] = useState<boolean>(true);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedSublocations, setExpandedSublocations] = useState<Set<string>>(new Set());
  const [projectsExpanded, setProjectsExpanded] = useState<boolean>(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const { data: projects = [] } = useProjects();
  const lastAutoExpandSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!autoExpandAllLocations) {
      lastAutoExpandSignatureRef.current = null;
      return;
    }

    const locationIds = locations.map((l) => l.id);
    const sublocationIds = allSublocations.map((s) => s.id);
    const signature = `${locationIds.join(',')}|${sublocationIds.join(',')}`;

    if (signature === lastAutoExpandSignatureRef.current) return;
    if (locationIds.length === 0 && sublocationIds.length === 0) return;

    lastAutoExpandSignatureRef.current = signature;

    setExpandedLocations((prev) => {
      const next = new Set(prev);
      locationIds.forEach((id) => next.add(id));
      return next;
    });
    setExpandedSublocations((prev) => {
      const next = new Set(prev);
      sublocationIds.forEach((id) => next.add(id));
      return next;
    });
  }, [autoExpandAllLocations, locations, allSublocations]);

  useEffect(() => {
    if (!autoExpandAllLocations) {
      setExpandedLocations(new Set());
      setExpandedSublocations(new Set());
      lastAutoExpandSignatureRef.current = null;
    }
  }, [autoExpandAllLocations]);

  useEffect(() => {
    for (const location of locations) {
      queryClient.prefetchQuery({
        queryKey: getSublocationsQueryKey(location.id),
        queryFn: () => sublocationService.getSublocationsForLocation(location.id),
        staleTime: 5 * 60 * 1000,
      });
    }
    for (const sub of allSublocations) {
      queryClient.prefetchQuery({
        queryKey: getPositionsQueryKey(sub.id),
        queryFn: () => positionService.getPositionsForSublocation(sub.id),
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [locations, allSublocations]);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const role = teamMember?.role || 'member';
  const RoleIcon = roleIcons[role];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      queryClient.clear();
      localStorage.removeItem('selectedLocationId');
      localStorage.removeItem('selectedSublocationId');
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const toggleLocationExpansion = (locationId: string, e: React.MouseEvent) => {
    if (e?.stopPropagation) e.stopPropagation();
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  };

  const toggleSublocationExpansion = (sublocationId: string, e: React.MouseEvent) => {
    if (e?.stopPropagation) e.stopPropagation();
    setExpandedSublocations((prev) => {
      const next = new Set(prev);
      if (next.has(sublocationId)) {
        next.delete(sublocationId);
      } else {
        next.add(sublocationId);
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, locationId: string) => {
    setDraggedId(locationId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', locationId);
    if (e.currentTarget instanceof HTMLElement) {
      dragNodeRef.current = e.currentTarget as HTMLDivElement;
      setTimeout(() => {
        if (dragNodeRef.current) {
          dragNodeRef.current.style.opacity = '0.5';
        }
      }, 0);
    }
  };

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1';
    }
    setDraggedId(null);
    setDragOverId(null);
    dragNodeRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent, locationId: string) => {
    if (!draggedId) return;
    e.preventDefault();
    if (draggedId !== locationId) {
      setDragOverId(locationId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    if (!draggedId) return;
    e.preventDefault();
    if (draggedId === targetId) {
      setDragOverId(null);
      return;
    }

    const currentOrder = locations.map((l) => l.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    onReorderLocations(newOrder);
    setDragOverId(null);
  };

  const getAccentColor = (location: LocationWithStats) => {
    return location.accent_color || '#3b82f6';
  };

  if (isCollapsed) {
    const handleExpandToInventory = () => {
      setInventoryExpanded(true);
      onOpenInventoryView();
      onToggleCollapse();
    };
    const handleOpenExpirationCollapsed = () => {
      onOpenExpirationView();
    };
    const handleOpenLowStockCollapsed = () => {
      onOpenLowStockView();
    };
    return (
      <>
      <div className="w-14 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-2 border-b border-gray-100">
          <button
            onClick={onToggleCollapse}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 flex flex-col items-center">
          <button
            onClick={handleExpandToInventory}
            className="group w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all"
            title="Inventory"
          >
            <LayoutDashboard
              size={20}
              strokeWidth={2}
              className="text-gray-500 group-hover:text-gray-700 transition-colors"
            />
          </button>
          <button
            onClick={handleOpenExpirationCollapsed}
            className={`group relative w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
              isExpirationActive ? 'bg-gray-100/80' : 'hover:bg-gray-100'
            }`}
            title="Expiration"
          >
            <CalendarClock
              size={20}
              strokeWidth={2}
              className={`transition-colors ${
                isExpirationActive
                  ? 'text-blue-600'
                  : 'text-gray-500 group-hover:text-gray-700'
              }`}
            />
            {expirationCounts.expired > 0 && (
              <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-md bg-red-50 text-red-600 text-[10px] font-semibold border border-red-100 flex items-center justify-center ring-2 ring-white">
                {expirationCounts.expired}
              </span>
            )}
          </button>
          <button
            onClick={handleOpenLowStockCollapsed}
            className={`group relative w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
              isLowStockActive ? 'bg-gray-100/80' : 'hover:bg-gray-100'
            }`}
            title="Low Stock"
          >
            <TrendingDown
              size={20}
              strokeWidth={2}
              className={`transition-colors ${
                isLowStockActive
                  ? 'text-blue-600'
                  : 'text-gray-500 group-hover:text-gray-700'
              }`}
            />
            {lowStockUrgentCount > 0 && (
              <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-md bg-rose-50 text-rose-600 text-[10px] font-semibold border border-rose-100 flex items-center justify-center ring-2 ring-white">
                {lowStockUrgentCount}
              </span>
            )}
          </button>
        </div>
        <div className="px-2 pt-2 pb-4 relative" ref={isCollapsed ? userMenuRef : undefined}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-medium hover:shadow-md transition-shadow"
            title={teamMember?.display_name || user?.email || 'Account'}
          >
            {(teamMember?.display_name || user?.email)?.charAt(0).toUpperCase() || 'U'}
          </button>
          {showUserMenu && (
            <div className="absolute left-14 bottom-0 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">{teamMember?.display_name || user?.email?.split('@')[0]}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <RoleIcon className="h-3 w-3" />
                  {roleLabels[role]}
                </p>
              </div>
              <button
                onClick={() => { setShowUserMenu(false); setShowWorkspaceModal(true); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Settings className="h-4 w-4 text-gray-400" />
                Manage Workspace
              </button>
              <button
                onClick={() => { setShowUserMenu(false); setShowTeamModal(true); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Users className="h-4 w-4 text-gray-400" />
                {canManageTeam ? 'Manage Team' : 'View Team'}
              </button>
              <button
                onClick={() => { setShowUserMenu(false); setShowBackupModal(true); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <HardDrive className="h-4 w-4 text-gray-400" />
                Manage Backup
              </button>
              <button
                onClick={() => { setShowUserMenu(false); openTutorialHub(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <GraduationCap className="h-4 w-4 text-gray-400" />
                Tutorial
              </button>
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showTeamModal && (
        <TeamManagementModal onClose={() => setShowTeamModal(false)} />
      )}
      {showWorkspaceModal && (
        <WorkspaceModal onClose={() => setShowWorkspaceModal(false)} />
      )}
      {showBackupModal && (
        <BackupModal onClose={() => setShowBackupModal(false)} />
      )}
      </>
    );
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
              <LayoutGrid className="h-7 w-7 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-lg">
              {workspace?.name || 'Workspace'}
            </span>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pt-3 pb-2">
        <div className="select-none">
          <div
            onClick={() => {
              if (!inventoryExpanded) {
                setInventoryExpanded(true);
                onOpenInventoryView();
              } else if (!isInventoryOverviewActive) {
                onOpenInventoryView();
              } else {
                setInventoryExpanded(false);
              }
            }}
            className={`
              w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-all duration-200 cursor-pointer
              ${isInventoryOverviewActive
                ? 'bg-ai-50'
                : 'hover:bg-gray-50'
              }
            `}
          >
            <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
              <LayoutDashboard
                className={`h-5 w-5 transition-colors duration-200 ${
                  isInventoryOverviewActive ? 'text-blue-600' : 'text-gray-500'
                }`}
                strokeWidth={2}
              />
            </div>
            <span
              className={`text-sm font-semibold tracking-tight ${
                isInventoryOverviewActive ? 'text-ai-800' : 'text-gray-800'
              }`}
            >
              Inventory
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setInventoryExpanded(!inventoryExpanded);
              }}
              className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200/60 transition-colors text-black"
            >
              {inventoryExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className="flex-1" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateLocation();
              }}
              className="p-1.5 hover:bg-gray-200/60 rounded-lg transition-colors"
              title="Add location"
              data-tutorial-id="sidebar-add-location-btn"
            >
              <Plus size={14} className="text-gray-400 hover:text-gray-600" />
            </button>
          </div>

          <div
            className={`
              overflow-hidden transition-all duration-300 ease-out
              ${inventoryExpanded ? 'max-h-[4000px] opacity-100 mt-0' : 'max-h-0 opacity-0 mt-0'}
            `}
          >


          {locations.length === 0 ? (
            <div className="text-center py-6 px-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-2">
                <LayoutGrid className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">No locations yet</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Create your first location to get started</p>
            </div>
          ) : (
            <div>
              {locations.map((location) => (
              <LocationItemWithSublocations
                key={location.id}
                location={location}
                sublocations={allSublocations.filter(s => s.location_id === location.id)}
                allPositions={allPositions}
                isSelected={selectedLocationId === location.id && !selectedSublocationId}
                selectedSublocationId={selectedSublocationId}
                selectedPositionId={selectedPositionId}
                isExpanded={expandedLocations.has(location.id)}
                expandedSublocations={expandedSublocations}
                isDragging={draggedId === location.id}
                isDragOver={dragOverId === location.id}
                onSelect={() => onSelectLocation(location.id)}
                onSelectSublocation={(sublocationId, sublocationName, accentColor, locationType, iconId) =>
                  onSelectSublocation(location.id, sublocationId, sublocationName, accentColor, locationType, iconId)
                }
                onSelectPosition={(sublocationId, sublocationName, sublocationAccentColor, sublocationLocationType, sublocationIconId, positionId, positionName, accentColor, locationType, positionIconId) =>
                  onSelectPosition(location.id, sublocationId, sublocationName, sublocationAccentColor, sublocationLocationType, sublocationIconId, positionId, positionName, accentColor, locationType, positionIconId)
                }
                onToggleExpand={(e) => toggleLocationExpansion(location.id, e)}
                onToggleSublocationExpand={toggleSublocationExpansion}
                onEdit={() => onEditLocation(location)}
                onCreateSublocation={() => onCreateSublocation(location.id)}
                onEditSublocation={onEditSublocation}
                onCreatePosition={onCreatePosition}
                onEditPosition={onEditPosition}
                onTransferLocation={() => onTransferLocation(location)}
                onTransferSublocation={onTransferSublocation}
                onTransferPosition={onTransferPosition}
                onDragStart={(e) => handleDragStart(e, location.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, location.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, location.id)}
                accentColor={getAccentColor(location)}
              />
              ))}
            </div>
          )}
          </div>
        </div>

        <div>
          <button
            onClick={onOpenExpirationView}
            className={`
              group w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg
              transition-all duration-200
              ${
                isExpirationActive
                  ? 'bg-ai-50'
                  : 'hover:bg-gray-50'
              }
            `}
          >
            <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
              <CalendarClock
                className={`h-5 w-5 transition-colors duration-200 ${
                  isExpirationActive
                    ? 'text-blue-600'
                    : 'text-gray-500 group-hover:text-gray-700'
                }`}
                strokeWidth={2}
              />
            </div>
            <span
              className={`flex-1 text-left text-sm font-semibold tracking-tight ${
                isExpirationActive ? 'text-ai-800' : 'text-gray-800'
              }`}
            >
              Expiration
            </span>
            {expirationCounts.expired > 0 && (
              <span className="flex-shrink-0 w-5 h-5 rounded-md bg-red-50 text-red-600 text-[11px] font-semibold border border-red-100 flex items-center justify-center">
                {expirationCounts.expired}
              </span>
            )}
          </button>
        </div>

        <div>
          <button
            onClick={onOpenLowStockView}
            className={`
              group w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg
              transition-all duration-200
              ${
                isLowStockActive
                  ? 'bg-ai-50'
                  : 'hover:bg-gray-50'
              }
            `}
          >
            <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
              <TrendingDown
                className={`h-5 w-5 transition-colors duration-200 ${
                  isLowStockActive
                    ? 'text-blue-600'
                    : 'text-gray-500 group-hover:text-gray-700'
                }`}
                strokeWidth={2}
              />
            </div>
            <span
              className={`flex-1 text-left text-sm font-semibold tracking-tight ${
                isLowStockActive ? 'text-ai-800' : 'text-gray-800'
              }`}
            >
              Low Stock
            </span>
            {lowStockUrgentCount > 0 ? (
              <span className="flex-shrink-0 min-w-[20px] h-5 px-1 rounded-md bg-rose-50 text-rose-600 text-[11px] font-semibold border border-rose-100 flex items-center justify-center">
                {lowStockUrgentCount}
              </span>
            ) : lowStockTotal > 0 ? (
              <span className="flex-shrink-0 min-w-[20px] h-5 px-1 rounded-md bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-100 flex items-center justify-center">
                {lowStockTotal}
              </span>
            ) : null}
          </button>
        </div>

        {/* AI Assistant Section */}
        <div>
          <button
            onClick={onOpenAIChat}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-all duration-200 ${
              isAIChatActive
                ? 'bg-ai-50'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
              <AiSparkleIcon className={`h-5 w-5 transition-colors duration-200 ${isAIChatActive ? 'text-ai-600' : 'text-gray-500'}`} />
            </div>
            <span className={`text-sm font-semibold tracking-tight ${isAIChatActive ? 'text-ai-800' : 'text-gray-800'}`}>Copilot</span>
          </button>
        </div>

        {/* Projects Section */}
        <div>
          <div
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
              projectsExpanded
                ? 'bg-gradient-to-r from-teal-50 to-cyan-50'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
              <FolderKanban className={`h-5 w-5 transition-colors duration-200 ${isProjectActive || projectsExpanded ? 'text-teal-600' : 'text-gray-500'}`} strokeWidth={2} />
            </div>
            <span className={`text-sm font-semibold tracking-tight ${projectsExpanded ? 'text-teal-900' : 'text-gray-800'}`}>Projects</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setProjectsExpanded(!projectsExpanded);
              }}
              className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200/60 transition-colors text-black"
            >
              {projectsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className="flex-1" />
            {onCreateProject && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateProject();
                }}
                className="p-1.5 hover:bg-gray-200/60 rounded-lg transition-colors"
                title="Create project"
              >
                <Plus size={14} className="text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          <div className={`overflow-hidden transition-all duration-300 ease-out ${projectsExpanded ? 'max-h-[2000px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
            {projects.length > 0 ? (
              <div className="space-y-0.5 pl-2">
                {projects.map(proj => (
                  <ProjectSidebarItem
                    key={proj.id}
                    project={proj}
                    isSelected={selectedProjectId === proj.id && !selectedExperimentId}
                    selectedExperimentId={selectedExperimentId}
                    isExpanded={expandedProjects.has(proj.id)}
                    onToggleExpand={() => {
                      setExpandedProjects(prev => {
                        const next = new Set(prev);
                        if (next.has(proj.id)) next.delete(proj.id); else next.add(proj.id);
                        return next;
                      });
                    }}
                    onSelect={() => onSelectProject?.(proj)}
                    onSelectExperiment={(exp) => onSelectExperiment?.(proj, exp)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 px-3 py-2">No projects yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 pb-5 relative" ref={!isCollapsed ? userMenuRef : undefined}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
            {(teamMember?.display_name || user?.email)?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-gray-900 truncate">{teamMember?.display_name || user?.email?.split('@')[0]}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <RoleIcon className="h-3 w-3" />
              {roleLabels[role]}
            </p>
          </div>
        </button>

        {showUserMenu && (
          <div className="absolute left-3 right-3 bottom-full mb-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
            <button
              onClick={() => { setShowUserMenu(false); setShowWorkspaceModal(true); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="h-4 w-4 text-gray-400" />
              Manage Workspace
            </button>
            <button
              onClick={() => { setShowUserMenu(false); setShowTeamModal(true); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Users className="h-4 w-4 text-gray-400" />
              {canManageTeam ? 'Manage Team' : 'View Team'}
            </button>
            <button
              onClick={() => { setShowUserMenu(false); setShowBackupModal(true); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <HardDrive className="h-4 w-4 text-gray-400" />
              Manage Backup
            </button>
            <button
              onClick={() => { setShowUserMenu(false); openTutorialHub(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <GraduationCap className="h-4 w-4 text-gray-400" />
              Tutorial
            </button>
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showTeamModal && (
        <TeamManagementModal onClose={() => setShowTeamModal(false)} />
      )}
      {showWorkspaceModal && (
        <WorkspaceModal onClose={() => setShowWorkspaceModal(false)} />
      )}
      {showBackupModal && (
        <BackupModal onClose={() => setShowBackupModal(false)} />
      )}
    </div>
  );
};

interface LocationItemWithSublocationsProps {
  location: LocationWithStats;
  sublocations: SublocationWithStats[];
  allPositions: PositionWithStats[];
  isSelected: boolean;
  selectedSublocationId: string | null;
  selectedPositionId: string | null;
  isExpanded: boolean;
  expandedSublocations: Set<string>;
  isDragging: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onSelectSublocation: (sublocationId: string, sublocationName: string, accentColor: string | null, locationType: string, iconId: string | null) => void;
  onSelectPosition: (sublocationId: string, sublocationName: string, sublocationAccentColor: string | null, sublocationLocationType: string, sublocationIconId: string | null, positionId: string, positionName: string, accentColor: string | null, locationType: string, positionIconId: string | null) => void;
  onToggleExpand: (e: React.MouseEvent) => void;
  onToggleSublocationExpand: (sublocationId: string, e: React.MouseEvent) => void;
  onEdit: () => void;
  onTransferLocation: () => void;
  onCreateSublocation: () => void;
  onEditSublocation: (sublocation: SublocationWithStats) => void;
  onCreatePosition: (sublocationId: string) => void;
  onEditPosition: (position: PositionWithStats) => void;
  onTransferSublocation: (sublocation: SublocationWithStats) => void;
  onTransferPosition: (position: PositionWithStats) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  accentColor: string;
}

const LocationItemWithSublocations: React.FC<LocationItemWithSublocationsProps> = ({
  location,
  sublocations,
  allPositions,
  isSelected,
  selectedSublocationId,
  selectedPositionId,
  isExpanded,
  expandedSublocations,
  isDragging,
  isDragOver,
  onSelect,
  onSelectSublocation,
  onSelectPosition,
  onToggleExpand,
  onToggleSublocationExpand,
  onEdit,
  onTransferLocation,
  onCreateSublocation,
  onEditSublocation,
  onCreatePosition,
  onEditPosition,
  onTransferSublocation,
  onTransferPosition,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  accentColor,
}) => {
  const [draggedSubId, setDraggedSubId] = useState<string | null>(null);
  const [dragOverSubId, setDragOverSubId] = useState<string | null>(null);
  const dragSubNodeRef = useRef<HTMLDivElement | null>(null);

  const handleSubDragStart = (e: React.DragEvent, subId: string) => {
    e.stopPropagation();
    setDraggedSubId(subId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/sublocation', subId);
    if (e.currentTarget instanceof HTMLElement) {
      dragSubNodeRef.current = e.currentTarget as HTMLDivElement;
      setTimeout(() => {
        if (dragSubNodeRef.current) dragSubNodeRef.current.style.opacity = '0.5';
      }, 0);
    }
  };

  const handleSubDragEnd = () => {
    if (dragSubNodeRef.current) dragSubNodeRef.current.style.opacity = '1';
    setDraggedSubId(null);
    setDragOverSubId(null);
    dragSubNodeRef.current = null;
  };

  const handleSubDragOver = (e: React.DragEvent, subId: string) => {
    if (!draggedSubId) return;
    e.preventDefault();
    e.stopPropagation();
    if (draggedSubId !== subId) setDragOverSubId(subId);
  };

  const handleSubDragLeave = () => setDragOverSubId(null);

  const handleSubDrop = (e: React.DragEvent, targetId: string) => {
    if (!draggedSubId) return;
    e.preventDefault();
    e.stopPropagation();
    if (draggedSubId === targetId) {
      setDragOverSubId(null);
      return;
    }
    const currentOrder = sublocations.map((s) => s.id);
    const draggedIndex = currentOrder.indexOf(draggedSubId);
    const targetIndex = currentOrder.indexOf(targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedSubId);

    const previousAll = queryClient.getQueryData<SublocationWithStats[]>(ALL_SUBLOCATIONS_QUERY_KEY);
    queryClient.cancelQueries({ queryKey: ALL_SUBLOCATIONS_QUERY_KEY });
    if (previousAll) {
      const updated = previousAll.map((s) => {
        const idx = newOrder.indexOf(s.id);
        return idx !== -1 ? { ...s, display_order: idx } : s;
      });
      updated.sort((a, b) => a.display_order - b.display_order);
      queryClient.setQueryData(ALL_SUBLOCATIONS_QUERY_KEY, updated);
    }

    sublocationService.reorderSublocations(location.id, newOrder).catch(() => {
      if (previousAll) queryClient.setQueryData(ALL_SUBLOCATIONS_QUERY_KEY, previousAll);
    });
    setDragOverSubId(null);
  };

  return (
    <div>
      <div className="flex items-center gap-0">
        <div
          onClick={(e) => { e.stopPropagation(); onToggleExpand(e); }}
          className="flex-shrink-0 w-5 flex items-center justify-center self-stretch rounded hover:bg-gray-100/50 transition-colors cursor-pointer"
        >
          {isExpanded ? (
            <ChevronDown size={14} strokeWidth={2.5} className="text-black" />
          ) : (
            <ChevronRight size={14} className="text-black" />
          )}
        </div>

        <div
          draggable
          data-tutorial-id={location.id.startsWith('tutorial-') ? 'sidebar-location-tutorial-item' : undefined}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => {
            if (!isExpanded) {
              onToggleExpand({} as React.MouseEvent);
              onSelect();
            } else if (!isSelected) {
              onSelect();
            } else {
              onToggleExpand({} as React.MouseEvent);
            }
          }}
          className={`
            group/row relative flex-1 flex items-center gap-1 pl-1.5 pr-0 py-1 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150 overflow-hidden
            ${isSelected ? 'bg-gray-100/80' : 'hover:bg-gray-50'}
            ${isDragging ? 'opacity-50' : ''}
            ${isDragOver ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}
          `}
        >
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover/row:scale-105"
            style={{
              backgroundColor: `${accentColor}15`,
            }}
          >
            <SvgIcon iconId={location.icon_id || getLocationIconId(location.location_type)} size={18} color={accentColor} />
          </div>

          <div className="flex-1 min-w-0 overflow-hidden sidebar-text-mask-wide">
            <h3
              className="text-sm font-medium truncate text-gray-900"
            >
              {location.name}
            </h3>
          </div>

          <div className="absolute right-0 top-0 bottom-0 flex items-center pr-1.5 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity duration-150" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onTransferLocation}
                className="p-1 rounded hover:bg-gray-200/80 transition-colors"
                title="Transfer location"
              >
                <ArrowRightLeft size={14} className="text-gray-500 hover:text-gray-700" />
              </button>
              <button
                onClick={onEdit}
                className="p-1 rounded hover:bg-gray-200/80 transition-colors"
                title="Edit location"
              >
                <Pencil size={14} className="text-gray-500 hover:text-gray-700" />
              </button>
              <button
                onClick={onCreateSublocation}
                className="p-1 rounded hover:bg-gray-200/80 transition-colors"
                title="Add sub-location"
                data-tutorial-id="sidebar-add-sublocation-btn"
              >
                <Plus size={14} className="text-gray-500 hover:text-gray-700" />
              </button>
          </div>

        </div>
      </div>

      {isExpanded && sublocations.length > 0 && (
        <div
          className="border-l-2 pl-1"
          style={{ borderColor: `${accentColor}40`, marginLeft: '9px' }}
        >
          {sublocations.map((sublocation) => (
            <SublocationItem
              key={sublocation.id}
              sublocation={sublocation}
              positions={allPositions.filter(p => p.sublocation_id === sublocation.id)}
              isSelected={selectedSublocationId === sublocation.id && !selectedPositionId}
              selectedPositionId={selectedPositionId}
              isExpanded={expandedSublocations.has(sublocation.id)}
              isDragging={draggedSubId === sublocation.id}
              isDragOver={dragOverSubId === sublocation.id}
              onSelect={() =>
                onSelectSublocation(sublocation.id, sublocation.name, sublocation.accent_color, sublocation.location_type || 'general', sublocation.icon_id || null)
              }
              onSelectPosition={(positionId, positionName, accentColor, locationType, positionIconId) =>
                onSelectPosition(sublocation.id, sublocation.name, sublocation.accent_color, sublocation.location_type || 'general', sublocation.icon_id || null, positionId, positionName, accentColor, locationType, positionIconId)
              }
              onToggleExpand={(e) => onToggleSublocationExpand(sublocation.id, e)}
              onEdit={() => onEditSublocation(sublocation)}
              onTransfer={() => onTransferSublocation(sublocation)}
              onCreatePosition={() => onCreatePosition(sublocation.id)}
              onEditPosition={onEditPosition}
              onTransferPosition={onTransferPosition}
              onDragStart={(e) => handleSubDragStart(e, sublocation.id)}
              onDragEnd={handleSubDragEnd}
              onDragOver={(e) => handleSubDragOver(e, sublocation.id)}
              onDragLeave={handleSubDragLeave}
              onDrop={(e) => handleSubDrop(e, sublocation.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface SublocationItemProps {
  sublocation: SublocationWithStats;
  positions: PositionWithStats[];
  isSelected: boolean;
  selectedPositionId: string | null;
  isExpanded: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onSelectPosition: (positionId: string, positionName: string, accentColor: string | null, locationType: string, positionIconId: string | null) => void;
  onToggleExpand: (e: React.MouseEvent) => void;
  onEdit: () => void;
  onTransfer: () => void;
  onCreatePosition: () => void;
  onEditPosition: (position: PositionWithStats) => void;
  onTransferPosition: (position: PositionWithStats) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

const SublocationItem: React.FC<SublocationItemProps> = ({
  sublocation,
  positions,
  isSelected,
  selectedPositionId,
  isExpanded,
  isDragging,
  isDragOver,
  onSelect,
  onSelectPosition,
  onToggleExpand,
  onEdit,
  onTransfer,
  onCreatePosition,
  onEditPosition,
  onTransferPosition,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const accentColor = sublocation.accent_color || '#6b7280';
  const [draggedPosId, setDraggedPosId] = useState<string | null>(null);
  const [dragOverPosId, setDragOverPosId] = useState<string | null>(null);
  const dragPosNodeRef = useRef<HTMLDivElement | null>(null);

  const handlePosDragStart = (e: React.DragEvent, posId: string) => {
    e.stopPropagation();
    setDraggedPosId(posId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/position', posId);
    if (e.currentTarget instanceof HTMLElement) {
      dragPosNodeRef.current = e.currentTarget as HTMLDivElement;
      setTimeout(() => {
        if (dragPosNodeRef.current) dragPosNodeRef.current.style.opacity = '0.5';
      }, 0);
    }
  };

  const handlePosDragEnd = () => {
    if (dragPosNodeRef.current) dragPosNodeRef.current.style.opacity = '1';
    setDraggedPosId(null);
    setDragOverPosId(null);
    dragPosNodeRef.current = null;
  };

  const handlePosDragOver = (e: React.DragEvent, posId: string) => {
    if (!draggedPosId) return;
    e.preventDefault();
    e.stopPropagation();
    if (draggedPosId !== posId) setDragOverPosId(posId);
  };

  const handlePosDragLeave = () => setDragOverPosId(null);

  const handlePosDrop = (e: React.DragEvent, targetId: string) => {
    if (!draggedPosId) return;
    e.preventDefault();
    e.stopPropagation();
    if (draggedPosId === targetId) {
      setDragOverPosId(null);
      return;
    }
    const currentOrder = positions.map((p) => p.id);
    const draggedIndex = currentOrder.indexOf(draggedPosId);
    const targetIndex = currentOrder.indexOf(targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedPosId);
    const previousAll = queryClient.getQueryData<PositionWithStats[]>(ALL_POSITIONS_QUERY_KEY);
    queryClient.cancelQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
    if (previousAll) {
      const updated = previousAll.map((p) => {
        const idx = newOrder.indexOf(p.id);
        return idx !== -1 ? { ...p, display_order: idx } : p;
      });
      updated.sort((a, b) => a.display_order - b.display_order);
      queryClient.setQueryData(ALL_POSITIONS_QUERY_KEY, updated);
    }

    positionService.reorderPositions(sublocation.id, newOrder).catch(() => {
      if (previousAll) queryClient.setQueryData(ALL_POSITIONS_QUERY_KEY, previousAll);
    });
    setDragOverPosId(null);
  };

  return (
    <div>
      <div className="flex items-center gap-0">
        <div
          onClick={(e) => { e.stopPropagation(); onToggleExpand(e); }}
          className="flex-shrink-0 w-4 flex items-center justify-center self-stretch rounded hover:bg-gray-100/50 transition-colors cursor-pointer"
        >
          {isExpanded ? (
            <ChevronDown size={12} strokeWidth={2.5} className="text-black" />
          ) : (
            <ChevronRight size={12} className="text-black" />
          )}
        </div>

        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => {
            if (!isExpanded) {
              onToggleExpand({} as React.MouseEvent);
              onSelect();
            } else if (!isSelected) {
              onSelect();
            } else {
              onToggleExpand({} as React.MouseEvent);
            }
          }}
          className={`
            group/row relative flex-1 flex items-center gap-1.5 pl-1.5 pr-0 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-all duration-150 overflow-hidden
            ${isSelected ? 'bg-gray-100/80' : 'hover:bg-gray-50'}
            ${isDragging ? 'opacity-50' : ''}
            ${isDragOver ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}
          `}
        >
          <div
            className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <SvgIcon iconId={sublocation.icon_id || getLocationIconId(sublocation.location_type)} size={15} color={accentColor} />
          </div>

          <div className="flex-1 min-w-0 overflow-hidden sidebar-text-mask">
            <span
              className="font-medium truncate block text-gray-700"
              style={{ fontSize: '12.5px' }}
            >
              {sublocation.name}
            </span>
          </div>

          <div className="absolute right-0 top-0 bottom-0 flex items-center gap-0.5 pr-1.5 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity duration-150" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onTransfer}
                className="p-0.5 rounded hover:bg-gray-200/80 transition-colors"
                title="Transfer sub-location"
              >
                <ArrowRightLeft size={12} className="text-gray-400 hover:text-gray-600" />
              </button>
              <button
                onClick={onEdit}
                className="p-0.5 rounded hover:bg-gray-200/80 transition-colors"
                title="Edit sub-location"
              >
                <Pencil size={12} className="text-gray-400 hover:text-gray-600" />
              </button>
              <button
                onClick={onCreatePosition}
                className="p-0.5 rounded hover:bg-gray-200/80 transition-colors"
                title="Add position"
                data-tutorial-id="sidebar-add-position-btn"
              >
                <Plus size={12} className="text-gray-400 hover:text-gray-600" />
              </button>
          </div>

        </div>
      </div>

      {isExpanded && positions.length > 0 && (
        <div className="ml-6">
          {positions.map((position) => (
            <PositionItem
              key={position.id}
              position={position}
              isSelected={selectedPositionId === position.id}
              isDragging={draggedPosId === position.id}
              isDragOver={dragOverPosId === position.id}
              onSelect={() =>
                onSelectPosition(position.id, position.name, position.accent_color, position.location_type || 'general', position.icon_id || null)
              }
              onEdit={() => onEditPosition(position)}
              onTransfer={() => onTransferPosition(position)}
              onDragStart={(e) => handlePosDragStart(e, position.id)}
              onDragEnd={handlePosDragEnd}
              onDragOver={(e) => handlePosDragOver(e, position.id)}
              onDragLeave={handlePosDragLeave}
              onDrop={(e) => handlePosDrop(e, position.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface PositionItemProps {
  position: PositionWithStats;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onTransfer: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

const PositionItem: React.FC<PositionItemProps> = ({
  position,
  isSelected,
  isDragging,
  isDragOver,
  onSelect,
  onEdit,
  onTransfer,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const accentColor = position.accent_color || '#6b7280';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onSelect}
      className={`
        group/row relative flex items-center gap-1.5 pl-2 pr-0 py-1 rounded-md cursor-grab active:cursor-grabbing transition-all duration-150 overflow-hidden
        ${isSelected ? 'bg-gray-100/80' : 'hover:bg-gray-50'}
        ${isDragging ? 'opacity-50' : ''}
        ${isDragOver ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}
      `}
    >
      <div
        className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center"
        style={{ backgroundColor: `${accentColor}20` }}
      >
        <SvgIcon iconId={position.icon_id || getLocationIconId(position.location_type)} size={12} color={accentColor} />
      </div>

      <div className="flex-1 min-w-0 overflow-hidden sidebar-text-mask">
        <span
          className="text-xs font-medium truncate block text-gray-600"
          style={{ fontSize: '11px' }}
        >
          {position.name}
        </span>
      </div>

      <div className="absolute right-0 top-0 bottom-0 flex items-center gap-0.5 pr-2 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity duration-150" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onTransfer}
            className="p-0.5 rounded hover:bg-gray-200/80 transition-colors"
            title="Transfer position"
          >
            <ArrowRightLeft size={10} className="text-gray-400 hover:text-gray-600" />
          </button>
          <button
            onClick={onEdit}
            className="p-0.5 rounded hover:bg-gray-200/80 transition-colors"
            title="Edit position"
          >
            <Pencil size={10} className="text-gray-400 hover:text-gray-600" />
          </button>
          <div className="w-[18px]" />
      </div>

    </div>
  );
};

const ProjectSidebarItem: React.FC<{
  project: ProjectWithStats;
  isSelected: boolean;
  selectedExperimentId: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onSelectExperiment: (exp: ExperimentWithStats) => void;
}> = ({ project, isSelected, selectedExperimentId, isExpanded, onToggleExpand, onSelect, onSelectExperiment }) => {
  const { data: experiments = [] } = useExperiments(isExpanded ? project.id : null);
  const color = project.accent_color || '#3b82f6';

  return (
    <div>
      <div
        onClick={onSelect}
        className={`
          group relative flex items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-all duration-150
          ${isSelected ? 'bg-gray-100/80' : 'hover:bg-gray-50'}
        `}
      >
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: `${color}15` }}
        >
          <SvgIcon iconId={project.icon_id || 'folder1'} size={18} color={color} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate text-gray-900">
            {project.name}
          </h3>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          className="flex-shrink-0 p-0.5 rounded hover:bg-gray-100/50 transition-colors"
        >
          {isExpanded ? <ChevronDown size={14} className="text-black" /> : <ChevronRight size={14} className="text-black" />}
        </button>
      </div>

      {isExpanded && experiments.length > 0 && (
        <div
          className="ml-3 mt-1 space-y-0.5 border-l-2 pl-1"
          style={{ borderColor: `${color}40` }}
        >
          {experiments.map(exp => {
            const isExpSelected = selectedExperimentId === exp.id;
            const expColor = exp.accent_color || '#0ea5e9';
            return (
              <div
                key={exp.id}
                onClick={() => onSelectExperiment(exp)}
                className={`relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all duration-150 ${
                  isExpSelected ? 'bg-gray-100/80' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${expColor}20` }}>
                  <SvgIcon iconId={exp.icon_id || 'folder1'} size={12} color={expColor} />
                </div>
                <span className="text-xs font-medium truncate text-gray-700">{exp.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LocationSidebar;
