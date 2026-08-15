import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { UNIT_GROUPS } from '../utils/unitOptions';

interface UnitSelectorProps {
  value: string;
  onChange: (unit: string) => void;
  disabled?: boolean;
}

const UnitSelector: React.FC<UnitSelectorProps> = ({ value, onChange, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (unit: string) => {
    onChange(unit);
    setOpen(false);
  };

  const displayLabel = value || '--';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-1 h-[42px] px-2.5 rounded-xl border-2 text-sm font-medium transition-all duration-200 min-w-[60px] justify-center ${
          disabled
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : open
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : value
                ? 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 bg-white rounded-xl shadow-xl border border-gray-200 p-2.5 w-[240px] animate-scale-in">
          <div className="flex gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                value === ''
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-500 hover:bg-gray-100 border border-transparent'
              }`}
            >
              None
            </button>
            <button
              type="button"
              onClick={() => handleSelect('unit')}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                value === 'unit'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-500 hover:bg-gray-100 border border-transparent'
              }`}
            >
              unit
            </button>
          </div>

          <div className="border-t border-gray-100 pt-2 grid grid-cols-2 gap-2">
            {UNIT_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">
                  {group.label}
                </div>
                <div className="flex flex-wrap gap-1">
                  {group.units.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => handleSelect(u)}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                        value === u
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitSelector;
