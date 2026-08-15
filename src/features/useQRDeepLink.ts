import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { qrCodeService } from '../services/qrCodeService';
import { BoxType } from '../services/boxService';
import { SublocationWithStats } from '../services/sublocationService';
import { PositionWithStats } from '../services/positionService';
import {
  ViewState,
  SublocationSelection,
  PositionSelection,
  SELECTED_LOCATION_KEY,
  SELECTED_SUBLOCATION_KEY,
  SELECTED_POSITION_KEY,
} from './types';

const QR_SESSION_KEY = 'pending_qr_token';

interface UseQRDeepLinkParams {
  isInitialized: boolean;
  setSelectedLocationId: (id: string | null) => void;
  setSelectedSublocation: (s: SublocationSelection | null) => void;
  setSelectedPosition: (p: PositionSelection | null) => void;
  setViewState: (vs: ViewState) => void;
  allSublocations: SublocationWithStats[];
  allPositions: PositionWithStats[];
}

export function useQRDeepLink({
  isInitialized,
  setSelectedLocationId,
  setSelectedSublocation,
  setSelectedPosition,
  setViewState,
  allSublocations,
  allPositions,
}: UseQRDeepLinkParams) {
  const { workspace } = useAuth();
  const qrProcessedRef = useRef(false);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized || qrProcessedRef.current) return;
    const token = sessionStorage.getItem(QR_SESSION_KEY);
    if (!token) return;
    qrProcessedRef.current = true;
    sessionStorage.removeItem(QR_SESSION_KEY);

    (async () => {
      try {
        const resolved = await qrCodeService.resolveToken(token);
        if (!resolved) {
          setQrError('This QR code is no longer valid.');
          return;
        }
        if (workspace && resolved.workspace_id !== workspace.id) {
          setQrError('You do not have access to this workspace.');
          return;
        }
        setSelectedLocationId(resolved.location_id);
        localStorage.setItem(SELECTED_LOCATION_KEY, resolved.location_id);
        if (resolved.sublocation_id) {
          const sub = allSublocations.find(s => s.id === resolved.sublocation_id);
          setSelectedSublocation(sub ? {
            id: sub.id, name: sub.name, accentColor: sub.accent_color,
            locationType: sub.location_type, iconId: sub.icon_id,
          } : { id: resolved.sublocation_id, name: '', accentColor: null, locationType: 'general', iconId: null });
          localStorage.setItem(SELECTED_SUBLOCATION_KEY, resolved.sublocation_id);
        } else {
          setSelectedSublocation(null);
          localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
        }
        if (resolved.position_id) {
          const pos = allPositions.find(p => p.id === resolved.position_id);
          setSelectedPosition(pos ? {
            id: pos.id, sublocationId: pos.sublocation_id, name: pos.name,
            accentColor: pos.accent_color, locationType: pos.location_type, iconId: pos.icon_id,
          } : { id: resolved.position_id, sublocationId: resolved.sublocation_id || '', name: '', accentColor: null, locationType: 'general', iconId: null });
          localStorage.setItem(SELECTED_POSITION_KEY, resolved.position_id);
        } else {
          setSelectedPosition(null);
          localStorage.removeItem(SELECTED_POSITION_KEY);
        }
        setViewState({
          view: 'box',
          boxId: resolved.box_id,
          boxName: resolved.box_name,
          boxAccentColor: resolved.accent_color,
          boxType: resolved.box_type as BoxType,
        });
      } catch {
        setQrError('Failed to resolve QR code.');
      }
    })();
  }, [isInitialized, workspace, allSublocations, allPositions]);

  return { qrError, setQrError };
}

export { QR_SESSION_KEY };
