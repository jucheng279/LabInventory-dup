import { useState } from 'react';
import { LocationWithStats } from '../services/locationManagerService';
import { PositionWithStats } from '../services/positionService';
import { SublocationWithStats } from '../services/sublocationService';
import { TransferSource, TransferDestination } from '../components/TransferLocationModal';
import {
  useTransferLocationToLocation,
  useTransferLocationToSublocation,
  useTransferSublocationToLocation,
  useTransferSublocationToSublocation,
  useTransferPositionToLocation,
  useTransferPositionToSublocation,
} from '../hooks/useTransfer';
import { useAllSublocations } from '../hooks/useSublocationData';
import { useAllPositions } from '../hooks/usePositionData';
import {
  ViewState,
  SublocationSelection,
  PositionSelection,
  SELECTED_LOCATION_KEY,
  SELECTED_SUBLOCATION_KEY,
  SELECTED_POSITION_KEY,
} from './types';

interface UseTransferManagerParams {
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  selectedSublocation: SublocationSelection | null;
  setSelectedSublocation: (s: SublocationSelection | null) => void;
  selectedPosition: PositionSelection | null;
  setSelectedPosition: (p: PositionSelection | null) => void;
  setViewState: (vs: ViewState) => void;
  allSublocations: SublocationWithStats[];
  allPositions: PositionWithStats[];
}

export function useTransferManager({
  selectedLocationId,
  setSelectedLocationId,
  selectedSublocation,
  setSelectedSublocation,
  selectedPosition,
  setSelectedPosition,
  setViewState,
  allSublocations,
  allPositions,
}: UseTransferManagerParams) {
  const [transferringLocation, setTransferringLocation] = useState<LocationWithStats | null>(null);
  const [transferringPosition, setTransferringPosition] = useState<PositionWithStats | null>(null);
  const [transferringSublocation, setTransferringSublocation] = useState<SublocationWithStats | null>(null);

  const locToLocMutation = useTransferLocationToLocation();
  const locToSubMutation = useTransferLocationToSublocation();
  const subToLocMutation = useTransferSublocationToLocation();
  const subToSubMutation = useTransferSublocationToSublocation();
  const posToLocMutation = useTransferPositionToLocation();
  const posToSubMutation = useTransferPositionToSublocation();

  const transferSource: TransferSource | null = (() => {
    if (transferringLocation) {
      const subs = allSublocations.filter(s => s.location_id === transferringLocation.id);
      const subIds = new Set(subs.map(s => s.id));
      const positions = allPositions.filter(p => subIds.has(p.sublocation_id));
      return {
        type: 'location' as const,
        id: transferringLocation.id,
        name: transferringLocation.name,
        locationId: transferringLocation.id,
        iconId: transferringLocation.icon_id,
        locationType: transferringLocation.location_type,
        accentColor: transferringLocation.accent_color,
        boxCount: transferringLocation.boxCount,
        itemCount: transferringLocation.itemCount,
        sublocationCount: subs.length,
        hasPositions: positions.length > 0,
      };
    }
    if (transferringPosition) {
      return {
        type: 'position' as const,
        id: transferringPosition.id,
        name: transferringPosition.name,
        locationId: selectedLocationId || '',
        sublocationId: transferringPosition.sublocation_id,
        iconId: transferringPosition.icon_id,
        locationType: transferringPosition.location_type,
        accentColor: transferringPosition.accent_color,
        boxCount: transferringPosition.box_count,
        itemCount: transferringPosition.item_count,
      };
    }
    if (transferringSublocation) {
      const posCount = allPositions.filter(p => p.sublocation_id === transferringSublocation.id).length;
      return {
        type: 'sublocation' as const,
        id: transferringSublocation.id,
        name: transferringSublocation.name,
        locationId: transferringSublocation.location_id,
        iconId: transferringSublocation.icon_id,
        locationType: transferringSublocation.location_type,
        accentColor: transferringSublocation.accent_color,
        boxCount: transferringSublocation.box_count,
        itemCount: transferringSublocation.item_count,
        positionCount: posCount,
      };
    }
    return null;
  })();

  const isTransferring =
    locToLocMutation.isPending ||
    locToSubMutation.isPending ||
    subToLocMutation.isPending ||
    subToSubMutation.isPending ||
    posToLocMutation.isPending ||
    posToSubMutation.isPending;

  const navigateToDestination = (dest: TransferDestination) => {
    setSelectedLocationId(dest.locationId);
    localStorage.setItem(SELECTED_LOCATION_KEY, dest.locationId);

    if (dest.type === 'sublocation') {
      setSelectedSublocation({
        id: dest.sublocationId, name: dest.name, accentColor: null, locationType: 'general', iconId: null,
      });
      setSelectedPosition(null);
      localStorage.setItem(SELECTED_SUBLOCATION_KEY, dest.sublocationId);
      localStorage.removeItem(SELECTED_POSITION_KEY);
    } else {
      setSelectedSublocation(null);
      setSelectedPosition(null);
      localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
      localStorage.removeItem(SELECTED_POSITION_KEY);
    }

    setViewState({ view: 'workspace' });
  };

  const handleTransfer = async (dest: TransferDestination) => {
    try {
      if (transferringLocation) {
        const sourceLocationId = transferringLocation.id;
        if (dest.type === 'location') {
          await locToLocMutation.mutateAsync({
            sourceLocationId: sourceLocationId,
            targetLocationId: dest.locationId,
          });
        } else if (dest.type === 'sublocation') {
          await locToSubMutation.mutateAsync({
            sourceLocationId: sourceLocationId,
            targetSublocationId: dest.sublocationId,
            targetLocationId: dest.locationId,
          });
        }
        if (selectedLocationId === sourceLocationId) {
          setSelectedLocationId(dest.locationId);
          localStorage.setItem(SELECTED_LOCATION_KEY, dest.locationId);
        }
        setTransferringLocation(null);
        navigateToDestination(dest);
      } else if (transferringSublocation) {
        const sourceLocationId = transferringSublocation.location_id;
        if (dest.type === 'location') {
          await subToLocMutation.mutateAsync({
            sourceSublocationId: transferringSublocation.id,
            targetLocationId: dest.locationId,
            sourceLocationId,
          });
        } else if (dest.type === 'sublocation') {
          await subToSubMutation.mutateAsync({
            sourceSublocationId: transferringSublocation.id,
            targetSublocationId: dest.sublocationId,
            sourceLocationId,
            targetLocationId: dest.locationId,
          });
        }
        if (selectedSublocation?.id === transferringSublocation.id) {
          setSelectedSublocation(null);
          setSelectedPosition(null);
          localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
          localStorage.removeItem(SELECTED_POSITION_KEY);
        }
        setTransferringSublocation(null);
        navigateToDestination(dest);
      } else if (transferringPosition) {
        const sourceLocationId = selectedLocationId || '';
        if (dest.type === 'location') {
          await posToLocMutation.mutateAsync({
            sourcePositionId: transferringPosition.id,
            targetLocationId: dest.locationId,
            sourceLocationId: sourceLocationId,
          });
        } else if (dest.type === 'sublocation') {
          await posToSubMutation.mutateAsync({
            sourcePositionId: transferringPosition.id,
            targetSublocationId: dest.sublocationId,
            sourceLocationId: sourceLocationId,
            targetLocationId: dest.locationId,
          });
        }
        if (selectedPosition?.id === transferringPosition.id) {
          setSelectedPosition(null);
          localStorage.removeItem(SELECTED_POSITION_KEY);
        }
        setTransferringPosition(null);
        navigateToDestination(dest);
      }
    } catch (error) {
      console.error('Transfer failed:', error);
    }
  };

  return {
    transferringLocation,
    setTransferringLocation,
    transferringPosition,
    setTransferringPosition,
    transferringSublocation,
    setTransferringSublocation,
    transferSource,
    isTransferring,
    handleTransfer,
  };
}
