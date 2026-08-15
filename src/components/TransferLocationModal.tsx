import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, ArrowRightLeft, ChevronRight, ChevronDown, Package, FolderOpen } from 'lucide-react';
import { LocationWithStats } from '../services/locationManagerService';
import { SublocationWithStats } from '../services/sublocationService';
import { PositionWithStats } from '../services/positionService';
import { useAllSublocations } from '../hooks/useSublocationData';
import { useAllPositions } from '../hooks/usePositionData';
import { getLocationIconId } from '../config/locationTypes';
import SvgIcon from './SvgIcon';
import Portal from './Portal';

export type TransferSourceType = 'location' | 'sublocation' | 'position';

export interface TransferSource {
  type: TransferSourceType;
  id: string;
  name: string;
  locationId: string;
  sublocationId?: string;
  iconId?: string | null;
  locationType?: string;
  accentColor?: string | null;
  boxCount: number;
  itemCount: number;
  sublocationCount?: number;
  positionCount?: number;
  hasPositions?: boolean;
}

export type TransferDestination =
  | { type: 'sublocation'; sublocationId: string; locationId: string; name: string }
  | { type: 'location'; locationId: string; name: string };

function getSourceDepth(source: TransferSource): number {
  if (source.type === 'location') {
    if (source.hasPositions) return 3;
    if (source.sublocationCount && source.sublocationCount > 0) return 2;
    return 1;
  }
  if (source.type === 'sublocation') {
    if (source.positionCount && source.positionCount > 0) return 2;
    return 1;
  }
  return 1;
}

function getDestinationLabel(source: TransferSource, dest: TransferDestination): string {
  if (dest.type === 'location') {
    return 'Will become a sub-location';
  }
  return 'Will become a position';
}

interface TransferLocationModalProps {
  source: TransferSource;
  locations: LocationWithStats[];
  onClose: () => void;
  onTransfer: (destination: TransferDestination) => void;
  isTransferring?: boolean;
}

const TransferLocationModal: React.FC<TransferLocationModalProps> = ({
  source,
  locations,
  onClose,
  onTransfer,
  isTransferring = false,
}) => {
  const { data: allSublocations = [] } = useAllSublocations();
  const { data: allPositions = [] } = useAllPositions();
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(() => new Set(locations.map(f => f.id)));
  const [expandedSublocations, setExpandedSublocations] = useState<Set<string>>(new Set());
  const [selectedDest, setSelectedDest] = useState<TransferDestination | null>(null);
  const hasInitializedSublocations = useRef(false);

  const sourceDepth = getSourceDepth(source);

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
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  };

  const toggleSublocationExpansion = (sublocationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSublocations((prev) => {
      const next = new Set(prev);
      if (next.has(sublocationId)) next.delete(sublocationId);
      else next.add(sublocationId);
      return next;
    });
  };

  const canTargetLocation = sourceDepth <= 2;
  const canTargetSublocation = sourceDepth <= 1;

  const contentParts = useMemo(() => {
    const p: string[] = [];
    if (source.boxCount > 0) p.push(`${source.boxCount} ${source.boxCount === 1 ? 'box' : 'boxes'}`);
    if (source.itemCount > 0) p.push(`${source.itemCount} ${source.itemCount === 1 ? 'item' : 'items'}`);
    if (source.sublocationCount && source.sublocationCount > 0) {
      p.push(`${source.sublocationCount} ${source.sublocationCount === 1 ? 'sub-location' : 'sub-locations'}`);
    }
    if (source.positionCount && source.positionCount > 0) {
      p.push(`${source.positionCount} ${source.positionCount === 1 ? 'position' : 'positions'}`);
    }
    return p;
  }, [source]);

  const sourceLabel = source.type === 'location' ? 'Location' : source.type === 'sublocation' ? 'Sub-Location' : 'Position';

  const sourceIconId = source.iconId || getLocationIconId(source.locationType || 'general');
  const sourceColor = source.accentColor || '#6b7280';

  const sourceLocationSubIds = useMemo(() => {
    if (source.type !== 'location') return new Set<string>();
    return new Set(allSublocations.filter(s => s.location_id === source.id).map(s => s.id));
  }, [source, allSublocations]);

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
                  Transfer {sourceLabel}
                </h2>
                <p className="text-sm text-gray-500 truncate max-w-[200px]">{source.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
              <div className="p-1.5 rounded-lg bg-white border border-gray-200">
                <SvgIcon iconId={sourceIconId} size={16} color={sourceColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{source.name}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {source.boxCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Package size={10} />
                      {source.boxCount} {source.boxCount === 1 ? 'box' : 'boxes'}
                    </span>
                  )}
                  {source.itemCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <FolderOpen size={10} />
                      {source.itemCount} {source.itemCount === 1 ? 'item' : 'items'}
                    </span>
                  )}
                  {source.sublocationCount !== undefined && source.sublocationCount > 0 && (
                    <span className="text-xs text-gray-500">
                      {source.sublocationCount} {source.sublocationCount === 1 ? 'sub-location' : 'sub-locations'}
                    </span>
                  )}
                  {source.positionCount !== undefined && source.positionCount > 0 && (
                    <span className="text-xs text-gray-500">
                      {source.positionCount} {source.positionCount === 1 ? 'position' : 'positions'}
                    </span>
                  )}
                  {contentParts.length === 0 && (
                    <span className="text-xs text-gray-400">Empty</span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-3">Select destination:</p>
            <div className="space-y-0.5 max-h-[50vh] overflow-y-auto pr-1 overscroll-contain">
              {locations.map((location) => {
                const locationSublocations = allSublocations.filter(s => s.location_id === location.id);

                return (
                  <TransferTreeItem
                    key={location.id}
                    location={location}
                    sublocations={locationSublocations}
                    source={source}
                    sourceDepth={sourceDepth}
                    sourceLocationSubIds={sourceLocationSubIds}
                    canTargetLocation={canTargetLocation}
                    canTargetSublocation={canTargetSublocation}
                    selectedDest={selectedDest}
                    isLocationExpanded={expandedLocations.has(location.id)}
                    expandedSublocations={expandedSublocations}
                    onToggleLocationExpand={(e) => toggleLocationExpansion(location.id, e)}
                    onToggleSublocationExpand={toggleSublocationExpansion}
                    onSelectDestination={setSelectedDest}
                  />
                );
              })}
            </div>

            {selectedDest && (
              <div className="mt-3 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-700">
                  {getDestinationLabel(source, selectedDest)} under <span className="font-medium">{selectedDest.name}</span>
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
              onClick={() => selectedDest && onTransfer(selectedDest)}
              disabled={!selectedDest || isTransferring}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            >
              {isTransferring ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRightLeft size={16} />
                  Transfer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

interface TransferTreeItemProps {
  location: LocationWithStats;
  sublocations: SublocationWithStats[];
  source: TransferSource;
  sourceDepth: number;
  sourceLocationSubIds: Set<string>;
  canTargetLocation: boolean;
  canTargetSublocation: boolean;
  selectedDest: TransferDestination | null;
  isLocationExpanded: boolean;
  expandedSublocations: Set<string>;
  onToggleLocationExpand: (e: React.MouseEvent) => void;
  onToggleSublocationExpand: (sublocationId: string, e: React.MouseEvent) => void;
  onSelectDestination: (dest: TransferDestination) => void;
}

function isDestSelected(dest: TransferDestination | null, check: TransferDestination): boolean {
  if (!dest) return false;
  if (dest.type !== check.type) return false;
  if (dest.type === 'location' && check.type === 'location') return dest.locationId === check.locationId;
  if (dest.type === 'sublocation' && check.type === 'sublocation') return dest.sublocationId === check.sublocationId;
  return false;
}

const TransferTreeItem: React.FC<TransferTreeItemProps> = ({
  location,
  sublocations,
  source,
  sourceLocationSubIds,
  canTargetLocation,
  canTargetSublocation,
  selectedDest,
  isLocationExpanded,
  expandedSublocations,
  onToggleLocationExpand,
  onToggleSublocationExpand,
  onSelectDestination,
}) => {
  const accentColor = location.accent_color || '#3b82f6';

  const isSelfLocation = source.type === 'location' && source.id === location.id;
  const showLocationAsTarget = canTargetLocation && !isSelfLocation;

  const locationDest: TransferDestination = { type: 'location', locationId: location.id, name: location.name };
  const isLocationSelected = isDestSelected(selectedDest, locationDest);

  const hasSublocations = sublocations.length > 0;
  const hasExpandableContent = hasSublocations && canTargetSublocation;

  return (
    <div>
      <div className="flex items-center gap-1">
        {(hasSublocations) ? (
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
        ) : (
          <div className="w-7" />
        )}

        {showLocationAsTarget ? (
          <button
            onClick={() => onSelectDestination(locationDest)}
            className={`
              flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all duration-150
              hover:bg-gray-50
              ${isLocationSelected ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}
            `}
          >
            <div
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <SvgIcon iconId={location.icon_id || getLocationIconId(location.location_type)} size={16} color={accentColor} />
            </div>
            <span className={`flex-1 text-sm font-medium truncate ${isLocationSelected ? 'text-blue-900' : 'text-gray-900'}`}>
              {location.name}
            </span>
            {isLocationSelected && (
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            )}
          </button>
        ) : (
          <div className={`flex-1 flex items-center gap-2 px-2 py-1.5 ${isSelfLocation ? 'opacity-50' : ''}`}>
            <div
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <SvgIcon iconId={location.icon_id || getLocationIconId(location.location_type)} size={16} color={accentColor} />
            </div>
            <span className="flex-1 text-sm font-medium text-gray-900 truncate">
              {location.name}
            </span>
            {isSelfLocation && <span className="text-xs text-gray-400 flex-shrink-0">Current</span>}
          </div>
        )}
      </div>

      {isLocationExpanded && hasSublocations && (
        <div className="ml-6 mt-1 space-y-0.5">
          {sublocations.map((sublocation) => {
            const subAccent = sublocation.accent_color || '#6b7280';
            const isSelf = source.type === 'sublocation' && source.id === sublocation.id;
            const isChildOfSourceLocation = source.type === 'location' && sourceLocationSubIds.has(sublocation.id);

            const showSubAsTarget = canTargetSublocation && !isSelf && !isChildOfSourceLocation;

            const subDest: TransferDestination = { type: 'sublocation', sublocationId: sublocation.id, locationId: location.id, name: sublocation.name };
            const isSubSelected = isDestSelected(selectedDest, subDest);

            return (
              <div key={sublocation.id}>
                <div className="flex items-center gap-1">
                  <div className="w-5" />
                  {showSubAsTarget ? (
                    <button
                      onClick={() => onSelectDestination(subDest)}
                      className={`
                        flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all duration-150
                        hover:bg-gray-50
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
                      {isSubSelected && (
                        <div className="ml-auto w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  ) : (
                    <div className={`flex-1 flex items-center gap-2 px-2 py-2 ${(isSelf || isChildOfSourceLocation) ? 'opacity-50' : ''}`}>
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center"
                        style={{ backgroundColor: `${subAccent}20` }}
                      >
                        <SvgIcon iconId={sublocation.icon_id || getLocationIconId(sublocation.location_type)} size={12} color={subAccent} />
                      </div>
                      <span className="text-sm text-gray-700">{sublocation.name}</span>
                      {isSelf && <span className="text-xs text-gray-400 ml-auto">Current</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TransferLocationModal;
