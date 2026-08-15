import { useState } from 'react';
import {
  LocationWithStats,
  CreateLocationData,
  UpdateLocationData,
} from '../services/locationManagerService';
import {
  SublocationWithStats,
  CreateSublocationData,
  UpdateSublocationData,
} from '../services/sublocationService';
import {
  PositionWithStats,
  CreatePositionData,
  UpdatePositionData,
} from '../services/positionService';
import {
  useLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  useReorderLocations,
} from '../hooks/useLocations';
import {
  useCreateSublocation,
  useUpdateSublocation,
  useDeleteSublocation,
} from '../hooks/useSublocationData';
import {
  useCreatePosition,
  useUpdatePosition,
  useDeletePosition,
} from '../hooks/usePositionData';
import {
  SublocationSelection,
  PositionSelection,
  SELECTED_LOCATION_KEY,
  SELECTED_SUBLOCATION_KEY,
  SELECTED_POSITION_KEY,
} from './types';

interface UseLocationManagerParams {
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  selectedSublocation: SublocationSelection | null;
  setSelectedSublocation: (s: SublocationSelection | null) => void;
  selectedPosition: PositionSelection | null;
  setSelectedPosition: (p: PositionSelection | null) => void;
}

export function useLocationManager({
  selectedLocationId,
  setSelectedLocationId,
  selectedSublocation,
  setSelectedSublocation,
  selectedPosition,
  setSelectedPosition,
}: UseLocationManagerParams) {
  const [showCreateLocationModal, setShowCreateLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationWithStats | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<LocationWithStats | null>(null);

  const [creatingSublocationLocationId, setCreatingSublocationLocationId] = useState<string | null>(null);
  const [editingSublocation, setEditingSublocation] = useState<SublocationWithStats | null>(null);
  const [deletingSublocation, setDeletingSublocation] = useState<SublocationWithStats | null>(null);

  const [creatingPositionSublocationId, setCreatingPositionSublocationId] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<PositionWithStats | null>(null);
  const [deletingPosition, setDeletingPosition] = useState<PositionWithStats | null>(null);

  const { data: locations = [], isLoading: isLoadingLocations } = useLocations();
  const createLocationMutation = useCreateLocation();
  const updateLocationMutation = useUpdateLocation();
  const deleteLocationMutation = useDeleteLocation();
  const reorderLocationsMutation = useReorderLocations();

  const createSublocationMutation = useCreateSublocation(creatingSublocationLocationId || '');
  const updateSublocationMutation = useUpdateSublocation(editingSublocation?.location_id || '');
  const deleteSublocationMutation = useDeleteSublocation(deletingSublocation?.location_id || '');

  const createPositionMutation = useCreatePosition(creatingPositionSublocationId || '');
  const updatePositionMutation = useUpdatePosition(editingPosition?.sublocation_id || '');
  const deletingPositionLocationId = selectedLocationId || '';
  const deletePositionMutation = useDeletePosition(deletingPosition?.sublocation_id || '', deletingPositionLocationId);

  const handleCreateLocation = async (data: CreateLocationData) => {
    try {
      const newLocation = await createLocationMutation.mutateAsync(data);
      setSelectedLocationId(newLocation.id);
      setSelectedSublocation(null);
      setSelectedPosition(null);
      localStorage.setItem(SELECTED_LOCATION_KEY, newLocation.id);
      localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
      localStorage.removeItem(SELECTED_POSITION_KEY);
      setShowCreateLocationModal(false);
    } catch (error) {
      console.error('Failed to create location:', error);
    }
  };

  const handleUpdateLocation = async (locationId: string, data: UpdateLocationData) => {
    try {
      await updateLocationMutation.mutateAsync({ locationId, data });
      setEditingLocation(null);
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    try {
      await deleteLocationMutation.mutateAsync(locationId);

      if (selectedLocationId === locationId) {
        const remainingLocations = locations.filter((f) => f.id !== locationId);
        if (remainingLocations.length > 0) {
          setSelectedLocationId(remainingLocations[0].id);
          setSelectedSublocation(null);
          setSelectedPosition(null);
          localStorage.setItem(SELECTED_LOCATION_KEY, remainingLocations[0].id);
          localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
          localStorage.removeItem(SELECTED_POSITION_KEY);
        } else {
          setSelectedLocationId(null);
          setSelectedSublocation(null);
          setSelectedPosition(null);
          localStorage.removeItem(SELECTED_LOCATION_KEY);
          localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
          localStorage.removeItem(SELECTED_POSITION_KEY);
        }
      }

      setDeletingLocation(null);
    } catch (error) {
      console.error('Failed to delete location:', error);
    }
  };

  const handleReorderLocations = async (locationIds: string[]) => {
    try {
      await reorderLocationsMutation.mutateAsync(locationIds);
    } catch (error) {
      console.error('Failed to update location order:', error);
    }
  };

  const handleCreateSublocation = async (data: CreateSublocationData) => {
    try {
      await createSublocationMutation.mutateAsync(data);
      setCreatingSublocationLocationId(null);
    } catch (error) {
      console.error('Failed to create sublocation:', error);
    }
  };

  const handleUpdateSublocation = async (sublocationId: string, data: UpdateSublocationData) => {
    try {
      await updateSublocationMutation.mutateAsync({ sublocationId, data });
      if (selectedSublocation?.id === sublocationId) {
        setSelectedSublocation({
          ...selectedSublocation,
          name: data.name || selectedSublocation.name,
          accentColor: data.accent_color !== undefined ? data.accent_color : selectedSublocation.accentColor,
          locationType: data.location_type || selectedSublocation.locationType,
          iconId: data.icon_id !== undefined ? data.icon_id ?? null : selectedSublocation.iconId,
        });
      }
      setEditingSublocation(null);
    } catch (error) {
      console.error('Failed to update sublocation:', error);
    }
  };

  const handleDeleteSublocation = async (sublocationId: string) => {
    try {
      await deleteSublocationMutation.mutateAsync(sublocationId);
      if (selectedSublocation?.id === sublocationId) {
        setSelectedSublocation(null);
        setSelectedPosition(null);
        localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
        localStorage.removeItem(SELECTED_POSITION_KEY);
      }
      setDeletingSublocation(null);
    } catch (error) {
      console.error('Failed to delete sublocation:', error);
    }
  };

  const handleCreatePosition = async (data: CreatePositionData) => {
    try {
      await createPositionMutation.mutateAsync(data);
      setCreatingPositionSublocationId(null);
    } catch (error) {
      console.error('Failed to create position:', error);
    }
  };

  const handleUpdatePosition = async (positionId: string, data: UpdatePositionData) => {
    try {
      await updatePositionMutation.mutateAsync({ positionId, data });
      if (selectedPosition?.id === positionId) {
        setSelectedPosition({
          ...selectedPosition,
          name: data.name || selectedPosition.name,
          accentColor: data.accent_color !== undefined ? data.accent_color : selectedPosition.accentColor,
          locationType: data.location_type || selectedPosition.locationType,
          iconId: data.icon_id !== undefined ? data.icon_id ?? null : selectedPosition.iconId,
        });
      }
      setEditingPosition(null);
    } catch (error) {
      console.error('Failed to update position:', error);
    }
  };

  const handleDeletePosition = async (positionId: string) => {
    try {
      await deletePositionMutation.mutateAsync(positionId);
      if (selectedPosition?.id === positionId) {
        setSelectedPosition(null);
        localStorage.removeItem(SELECTED_POSITION_KEY);
      }
      setDeletingPosition(null);
    } catch (error) {
      console.error('Failed to delete position:', error);
    }
  };

  return {
    // State
    locations,
    isLoadingLocations,
    showCreateLocationModal,
    setShowCreateLocationModal,
    editingLocation,
    setEditingLocation,
    deletingLocation,
    setDeletingLocation,
    creatingSublocationLocationId,
    setCreatingSublocationLocationId,
    editingSublocation,
    setEditingSublocation,
    deletingSublocation,
    setDeletingSublocation,
    creatingPositionSublocationId,
    setCreatingPositionSublocationId,
    editingPosition,
    setEditingPosition,
    deletingPosition,
    setDeletingPosition,
    // Handlers
    handleCreateLocation,
    handleUpdateLocation,
    handleDeleteLocation,
    handleReorderLocations,
    handleCreateSublocation,
    handleUpdateSublocation,
    handleDeleteSublocation,
    handleCreatePosition,
    handleUpdatePosition,
    handleDeletePosition,
  };
}
