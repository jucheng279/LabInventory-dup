import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface ColorPickerProps {
  selectedColor: string | null;
  onColorSelect: (color: string | null) => void;
}

export const COLORS = [
  { value: '#FECACA', name: 'Red' },
  { value: '#FED7AA', name: 'Orange' },
  { value: '#FDE68A', name: 'Amber' },
  { value: '#FEF3C7', name: 'Yellow' },
  { value: '#D9F99D', name: 'Lime' },
  { value: '#BBF7D0', name: 'Emerald' },
  { value: '#A7F3D0', name: 'Green' },
  { value: '#A5F3FC', name: 'Cyan' },
  { value: '#BAE6FD', name: 'Sky' },
  { value: '#BFDBFE', name: 'Blue' },
  { value: '#DDD6FE', name: 'Violet' },
  { value: '#FBCFE8', name: 'Pink' },
];

const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onColorSelect }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleSelect = (value: string | null) => {
    onColorSelect(value);
    setOpen(false);
  };

  return (
    <div ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-7 h-7 rounded-full border-2 flex-shrink-0 transition-all duration-200 cursor-pointer hover:scale-110 ${
          selectedColor
            ? 'border-gray-300 hover:border-gray-400'
            : 'border-gray-300 hover:border-gray-400 flex items-center justify-center bg-white'
        }`}
        style={selectedColor ? { backgroundColor: selectedColor } : undefined}
        title={selectedColor ? COLORS.find(c => c.value === selectedColor)?.name || 'Color' : 'No color'}
      >
        {!selectedColor && <X size={12} className="text-gray-400" />}
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                selectedColor === null
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              title="No color"
            >
              <X size={14} className="text-gray-400" />
            </button>
            {COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => handleSelect(color.value)}
                data-tutorial-id={`color-swatch-${color.name.toLowerCase()}`}
                className={`w-7 h-7 rounded-full border-2 transition-all duration-200 ${
                  selectedColor === color.value
                    ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
                    : 'border-gray-200 hover:border-gray-400 hover:scale-105'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
