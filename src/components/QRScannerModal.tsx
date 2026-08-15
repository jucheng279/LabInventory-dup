import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, Check, AlertTriangle, RotateCcw } from 'lucide-react';
import Portal from './Portal';
import { qrCodeService } from '../services/qrCodeService';
import type { BoxType } from '../types/database';

interface QRScannerModalProps {
  workspaceId: string;
  onNavigateToBox: (
    locationId: string,
    boxId: string,
    boxName: string,
    boxAccentColor: string | null,
    boxType?: BoxType,
    sublocationId?: string | null,
    positionId?: string | null,
  ) => void;
  onClose: () => void;
}

type ScanState = 'initializing' | 'scanning' | 'resolving' | 'success' | 'error';

const QRScannerModal: React.FC<QRScannerModalProps> = ({
  workspaceId,
  onNavigateToBox,
  onClose,
}) => {
  const [scanState, setScanState] = useState<ScanState>('initializing');
  const [errorMessage, setErrorMessage] = useState('');
  const [successBoxName, setSuccessBoxName] = useState('');
  const scannerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasProcessedRef = useRef(false);
  const closingRef = useRef(false);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
      } catch {
        // ignore library cleanup errors
      }
      scannerRef.current = null;
    }
    releaseStream();
  }, [releaseStream]);

  const handleClose = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    await stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  const extractToken = (scannedText: string): string | null => {
    try {
      const url = new URL(scannedText);
      return url.searchParams.get('qr');
    } catch {
      const match = scannedText.match(/[?&]qr=([^&]+)/);
      return match ? match[1] : null;
    }
  };

  const handleDecode = useCallback(async (decodedText: string) => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const token = extractToken(decodedText);
    if (!token) {
      setScanState('error');
      setErrorMessage('Not a valid box QR code.');
      return;
    }

    setScanState('resolving');
    await stopScanner();

    try {
      const resolved = await qrCodeService.resolveToken(token);
      if (!resolved) {
        setScanState('error');
        setErrorMessage('This QR code is no longer valid.');
        return;
      }

      if (resolved.workspace_id !== workspaceId) {
        setScanState('error');
        setErrorMessage('This QR code belongs to a different workspace.');
        return;
      }

      setSuccessBoxName(resolved.box_name);
      setScanState('success');

      setTimeout(() => {
        onNavigateToBox(
          resolved.location_id,
          resolved.box_id,
          resolved.box_name,
          resolved.accent_color,
          resolved.box_type as BoxType,
          resolved.sublocation_id,
          resolved.position_id,
        );
      }, 400);
    } catch {
      setScanState('error');
      setErrorMessage('Failed to resolve QR code.');
    }
  }, [workspaceId, onNavigateToBox, stopScanner]);

  const startScanner = useCallback(async () => {
    hasProcessedRef.current = false;
    setScanState('initializing');
    setErrorMessage('');

    await new Promise((r) => requestAnimationFrame(r));

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-scanner-region');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
        },
        (decodedText) => {
          handleDecode(decodedText);
        },
        () => {},
      );

      const container = document.getElementById('qr-scanner-region');
      if (container) {
        const video = container.querySelector('video');
        if (video && video.srcObject instanceof MediaStream) {
          streamRef.current = video.srcObject;
        }
      }

      setScanState('scanning');
    } catch {
      setScanState('error');
      setErrorMessage('Could not start camera. Please try again.');
    }
  }, [handleDecode]);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleClose]);

  const handleRetry = async () => {
    hasProcessedRef.current = false;
    setErrorMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setScanState('error');
      setErrorMessage('Camera access denied. Please allow camera in your browser settings.');
      return;
    }
    startScanner();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={handleClose} />

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-50">
                <Camera size={18} className="text-blue-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">Scan Box QR</h2>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          <div className="p-4">
            <div
              ref={containerRef}
              className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-900"
            >
              <div id="qr-scanner-region" className="w-full h-full" />

              {scanState === 'initializing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                  <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-300">Initializing camera...</p>
                </div>
              )}

              {scanState === 'scanning' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-[220px] h-[220px]">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-blue-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-blue-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-blue-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-blue-400 rounded-br-lg" />
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse" />
                  </div>
                </div>
              )}

              {scanState === 'resolving' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
                  <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-200">Opening box...</p>
                </div>
              )}

              {scanState === 'success' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mb-3 animate-bounce">
                    <Check size={24} className="text-white" />
                  </div>
                  <p className="text-sm text-gray-200 font-medium">{successBoxName}</p>
                </div>
              )}

              {scanState === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 p-6">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
                    <AlertTriangle size={24} className="text-red-400" />
                  </div>
                  <p className="text-sm text-gray-200 text-center mb-4">{errorMessage}</p>
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <RotateCcw size={14} />
                    Try Again
                  </button>
                </div>
              )}
            </div>

            {scanState === 'scanning' && (
              <p className="text-xs text-gray-500 text-center mt-3">
                Point your camera at a box QR code
              </p>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default QRScannerModal;
