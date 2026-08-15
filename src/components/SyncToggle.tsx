import React from 'react';
import { RefreshCw } from 'lucide-react';

interface SyncToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const SyncToggle: React.FC<SyncToggleProps> = ({ enabled, onToggle }) => {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
        enabled
          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-500'
      }`}
      title={enabled ? 'Live sync is on -- click to disable' : 'Live sync is off -- click to enable'}
    >
      <RefreshCw
        size={13}
        className={`transition-all duration-300 ${enabled ? 'animate-spin-slow' : ''}`}
      />
      <span className="hidden sm:inline">Sync</span>
      <span
        className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
          enabled ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
      />
    </button>
  );
};

export default SyncToggle;
