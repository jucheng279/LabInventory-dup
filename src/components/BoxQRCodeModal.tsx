import React, { useState, useRef, useEffect } from 'react';
import { X, QrCode, Printer, Download, Copy, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import Portal from './Portal';
import BoxLabel from './BoxLabel';
import { useBoxQRCode, useCreateQRCode, useRegenerateQRCode } from '../hooks/useBoxQRCode';
import { qrCodeService } from '../services/qrCodeService';
import { exportLabelAsPng, printLabel } from '../utils/labelExportUtils';
import { useAuth } from '../contexts/AuthContext';

interface BoxQRCodeModalProps {
  boxId: string;
  boxName: string;
  boxDescription: string;
  boxRows: number;
  boxColumns: number;
  workspaceId: string;
  currentTeamMemberId: string;
  onClose: () => void;
}

const BoxQRCodeModal: React.FC<BoxQRCodeModalProps> = ({
  boxId,
  boxName,
  boxDescription,
  boxRows,
  boxColumns,
  workspaceId,
  currentTeamMemberId,
  onClose,
}) => {
  const { workspace } = useAuth();
  const workspaceName = workspace?.name || '';

  const { data: qrCode, isLoading } = useBoxQRCode(boxId);
  const createMutation = useCreateQRCode();
  const regenerateMutation = useRegenerateQRCode();

  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const deepLinkUrl = qrCode ? qrCodeService.buildDeepLinkUrl(qrCode.token) : '';

  const handleGenerate = () => {
    createMutation.mutate({
      boxId,
      workspaceId,
      createdBy: currentTeamMemberId,
      label: boxName,
    });
  };

  const handleRegenerate = () => {
    regenerateMutation.mutate({
      boxId,
      workspaceId,
      createdBy: currentTeamMemberId,
      label: boxName,
    });
    setShowRegenerateConfirm(false);
  };

  const handleCopyLink = async () => {
    if (!deepLinkUrl) return;
    try {
      await navigator.clipboard.writeText(deepLinkUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = deepLinkUrl;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = async () => {
    if (!labelRef.current) return;
    const fileName = `label-${boxName.replace(/\s+/g, '-').toLowerCase()}.png`;
    await exportLabelAsPng(labelRef.current, fileName);
  };

  const handlePrint = async () => {
    if (!labelRef.current) return;
    await printLabel(labelRef.current);
  };

  const isGenerating = createMutation.isPending || regenerateMutation.isPending;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[760px] overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50">
                <QrCode size={20} className="text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Box Label</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : qrCode ? (
              <>
                <div className="overflow-auto max-h-[65vh] rounded-lg border border-gray-100">
                  <BoxLabel
                    ref={labelRef}
                    workspaceName={workspaceName}
                    boxName={boxName}
                    boxRows={boxRows}
                    boxColumns={boxColumns}
                    boxDescription={boxDescription}
                    deepLinkUrl={deepLinkUrl}
                  />
                </div>

                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500 truncate" title={deepLinkUrl}>{deepLinkUrl}</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <Printer size={18} className="text-gray-600" />
                    <span className="text-xs font-medium text-gray-600">Print</span>
                  </button>
                  <button
                    onClick={handleDownloadPng}
                    className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <Download size={18} className="text-gray-600" />
                    <span className="text-xs font-medium text-gray-600">Save PNG</span>
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-gray-600" />}
                    <span className="text-xs font-medium text-gray-600">{copied ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>

                {!showRegenerateConfirm ? (
                  <button
                    onClick={() => setShowRegenerateConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
                  >
                    <RefreshCw size={14} />
                    <span>Regenerate QR Code</span>
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-700">
                        This will invalidate the current QR code. Any previously printed labels will stop working.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowRegenerateConfirm(false)}
                        className="flex-1 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRegenerate}
                        disabled={isGenerating}
                        className="flex-1 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
                      >
                        {isGenerating ? 'Regenerating...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="inline-flex p-4 rounded-full bg-gray-50">
                  <QrCode size={40} className="text-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">No QR code yet</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Generate a unique QR code to create a printable box label.
                    Anyone who scans it will be directed to this box.
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full py-2.5 px-4 rounded-xl font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                >
                  {isGenerating ? 'Generating...' : 'Generate QR Code'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default BoxQRCodeModal;
