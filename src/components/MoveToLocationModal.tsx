import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRightLeft, Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { LocationWithStats } from '../services/locationManagerService';
import { SublocationWithStats } from '../services/sublocationService';
import { PositionWithStats } from '../services/positionService';
import { useAllSublocations } from '../hooks/useSublocationData';
import { useAllPositions } from '../hooks/usePositionData';
import { getLocationIconId } from '../config/locationTypes';
import SvgIcon from './SvgIcon';
import Portal from './Portal';

interface MoveToLocationModalProps {
  entityName: string;
  entityType: 'box' | 'item' | 'folder' | 'sheet';
  currentLocationId: string;
  currentSublocationId?: string | null;
  currentPositionId?: string | null;
  locations: LocationWithStats[];
  onClose: () => void;
  onMove: (targetLocationId: string, targetSublocationId?: string | null, targetPositionId?: string | null) => void;
  isMoving?: boolean;
}

interface DestinationSelection {
  locationId: string;
  sublocationId: string | null;
  positionId: string | null;
}

const MoveToLocationModal: React.FC<MoveToLocationModalProps> = ({
  entityName,
  entityType,
  currentLocationId,
  currentSublocationId,
  currentPositionId,
  locations,
  onClose,
  onMove,
  isMoving = false,
}) => {
  const { data: allSublocations = [] } = useAllSublocations();
  const { data: allPositions = [] } = useAllPositions();
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(() => new Set(locations.map(f => f.id)));
  const [expandedSublocations, setExpandedSublocations] = useState<Set<string>>(new Set());
  const [selectedDestination, setSelectedDestination] = useState<DestinationSelection | null>(null);
  const hasInitializedSublocations = useRef(false);

  useEffect(() => {
    if (!hasInitializedSublocations.current && allSublocations.length > 0) {
      hasInitializedSublocations.current = true;
      setExpandedSublocations(new Set(allSublocations.map(s => s.id)));
    }
  }, [allSublocations]);

  const toggleLocationExpansion = (locationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
    e.stopPropagation();
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

  const handleSelectDestination = (locationId: string, sublocationId: string | null, positionId: string | null) => {
    const isSameLocation =
      locationId === currentLocationId &&
      sublocationId === (currentSublocationId || null) &&
      positionId === (currentPositionId || null);
    if (isSameLocation) return;
    setSelectedDestination({ locationId, sublocationId, positionId });
  };

  const handleMove = () => {
    if (selectedDestination) {
      onMove(selectedDestination.locationId, selectedDestination.sublocationId, selectedDestination.positionId);
    }
  };

  const isCurrentLocation = (locationId: string, sublocationId: string | null, positionId: string | null) => {
    return (
      locationId === currentLocationId &&
      sublocationId === (currentSublocationId || null) &&
      positionId === (currentPositionId || null)
    );
  };

  const isSelected = (locationId: string, sublocationId: string | null, positionId: string | null) => {
    return (
      selectedDestination?.locationId === locationId &&
      selectedDestination?.sublocationId === sublocationId &&
      selectedDestination?.positionId === positionId
    );
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50">
                <ArrowRightLeft size={20} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Move {entityType === 'box' ? 'Box' : entityType === 'folder' || entityType === 'sheet' ? 'Sheet' : 'Item'}
                </h2>
                <p className="text-sm text-gray-500 truncate max-w-[200px]">{entityName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="p-4">
            <p className="text-sm text-gray-600 mb-4">Select destination:</p>
            <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1 overscroll-contain">
              {locations.map((location) => (
                <LocationTreeItem
                  key={location.id}
                  location={location}
                  sublocations={allSublocations.filter(s => s.location_id === location.id)}
                  positions={allPositions}
                  isLocationExpanded={expandedLocations.has(location.id)}
                  expandedSublocations={expandedSublocations}
                  onToggleLocationExpand={(e) => toggleLocationExpansion(location.id, e)}
                  onToggleSublocationExpand={toggleSublocationExpansion}
                  onSelectDestination={handleSelectDestination}
                  isCurrentLocation={isCurrentLocation}
                  isSelected={isSelected}
                />
              ))}
            </div>

            {locations.length === 0 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                  <Plus size={28} className="text-gray-400" />
                </div>
                <h3 className="text-base font-medium text-gray-900 mb-2">
                  No locations available
                </h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                  Create a location first to move this {entityType}.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMove}
              disabled={!selectedDestination || isMoving}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isMoving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Moving...
                </>
              ) : (
                <>
                  <ArrowRightLeft size={16} />
                  Move
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

interface LocationTreeItemProps {
  location: LocationWithStats;
  sublocations: SublocationWithStats[];
  positions: PositionWithStats[];
  isLocationExpanded: boolean;
  expandedSublocations: Set<string>;
  onToggleLocationExpand: (e: React.MouseEvent) => void;
  onToggleSublocationExpand: (sublocationId: string, e: React.MouseEvent) => void;
  onSelectDestination: (locationId: string, sublocationId: string | null, positionId: string | null) => void;
  isCurrentLocation: (locationId: string, sublocationId: string | null, positionId: string | null) => boolean;
  isSelected: (locationId: string, sublocationId: string | null, positionId: string | null) => boolean;
}

const LocationTreeItem: React.FC<LocationTreeItemProps> = ({
  location,
  sublocations,
  positions,
  isLocationExpanded,
  expandedSublocations,
  onToggleLocationExpand,
  onToggleSublocationExpand,
  onSelectDestination,
  isCurrentLocation,
  isSelected,
}) => {
  const accentColor = location.accent_color || '#3b82f6';
  const isMainCurrent = isCurrentLocation(location.id, null, null);
  const isMainSelected = isSelected(location.id, null, null);
  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleLocationExpand}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          {isLocationExpanded ? (
            <ChevronDown size={16} className="text-gray-400" />
          ) : (
            <ChevronRight size={16} className="text-gray-400" />
          )}
        </button>

        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${accentColor}15` }}
        >
          <SvgIcon iconId={location.icon_id || getLocationIconId(location.location_type)} size={16} color={accentColor} />
        </div>

        <span className="flex-1 text-sm font-medium text-gray-900 truncate ml-1">
          {location.name}
        </span>
      </div>

      {isLocationExpanded && (
        <div className="ml-6 mt-1 space-y-0.5">
          <button
            onClick={() => onSelectDestination(location.id, null, null)}
            disabled={isMainCurrent}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-150
              ${isMainCurrent ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'}
              ${isMainSelected ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}
            `}
          >
            <div className="w-5 h-5 rounded flex items-center justify-center bg-gray-100">
              <SvgIcon iconId={location.icon_id || getLocationIconId(location.location_type)} size={12} color="#6b7280" />
            </div>
            <span className={`text-sm ${isMainSelected ? 'font-medium text-blue-900' : 'text-gray-700'}`}>
              Main Area
            </span>
            {isMainCurrent && (
              <span className="text-xs text-gray-400 ml-auto">Current</span>
            )}
            {isMainSelected && (
              <div className="ml-auto w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            )}
          </button>

          {sublocations.map((sublocation) => {
            const subAccent = sublocation.accent_color || '#6b7280';
            const subPositions = positions.filter(p => p.sublocation_id === sublocation.id);
            const hasPositions = subPositions.length > 0;
            const isSubExpanded = expandedSublocations.has(sublocation.id);
            const isCurrent = isCurrentLocation(location.id, sublocation.id, null);
            const isSubSelected = isSelected(location.id, sublocation.id, null);
            return (
              <div key={sublocation.id}>
                <div className="flex items-center gap-1">
                  {hasPositions ? (
                    <button
                      onClick={(e) => onToggleSublocationExpand(sublocation.id, e)}
                      className="p-0.5 rounded hover:bg-gray-100 transition-colors"
                    >
                      {isSubExpanded ? (
                        <ChevronDown size={14} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-400" />
                      )}
                    </button>
                  ) : (
                    <div className="w-5" />
                  )}
                  <button
                    onClick={() => onSelectDestination(location.id, sublocation.id, null)}
                    disabled={isCurrent}
                    className={`
                      flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all duration-150
                      ${isCurrent ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'}
                      ${isSubSelected ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}
                    `}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${subAccent}20` }}
                    >
                      <SvgIcon iconId={sublocation.icon_id || getLocationIconId(sublocation.location_type)} size={12} color={subAccent} />
                    </div>
                    <span className={`text-sm ${isSubSelected ? 'font-medium text-blue-900' : 'text-gray-700'}`}>
                      {sublocation.name}
                    </span>
                    {isCurrent && (
                      <span className="text-xs text-gray-400 ml-auto">Current</span>
                    )}
                    {isSubSelected && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                </div>

                {hasPositions && isSubExpanded && (
                  <div className="ml-6 mt-0.5 space-y-0.5">
                    {subPositions.map((position) => {
                      const posAccent = position.accent_color || '#6b7280';
                      const isPosCurrent = isCurrentLocation(location.id, sublocation.id, position.id);
                      const isPosSelected = isSelected(location.id, sublocation.id, position.id);
                      return (
                        <button
                          key={position.id}
                          onClick={() => onSelectDestination(location.id, sublocation.id, position.id)}
                          disabled={isPosCurrent}
                          className={`
                            w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all duration-150
                            ${isPosCurrent ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'}
                            ${isPosSelected ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}
                          `}
                        >
                          <div
                            className="w-4 h-4 rounded flex items-center justify-center"
                            style={{ backgroundColor: `${posAccent}20` }}
                          >
                            <SvgIcon iconId={position.icon_id || getLocationIconId(position.location_type)} size={10} color={posAccent} />
                          </div>
                          <span className={`text-xs ${isPosSelected ? 'font-medium text-blue-900' : 'text-gray-700'}`}>
                            {position.name}
                          </span>
                          {isPosCurrent && (
                            <span className="text-xs text-gray-400 ml-auto">Current</span>
                          )}
                          {isPosSelected && (
                            <div className="ml-auto w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MoveToLocationModal;
