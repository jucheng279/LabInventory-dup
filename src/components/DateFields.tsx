import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { daysInMonth } from '../utils/dateFilterUtils';

export const MONTHS = [
  { value: '', label: '---' },
  { value: '1', label: 'Jan' },
  { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' },
  { value: '5', label: 'May' },
  { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' },
  { value: '8', label: 'Aug' },
  { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];

export interface DateFieldsProps {
  year: string;
  month: string;
  day: string;
  onYearChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  onDayChange: (v: string) => void;
  compact?: boolean;
}

const DayGrid: React.FC<{
  day: string;
  maxDay: number;
  disabled: boolean;
  onDayChange: (v: string) => void;
  compact?: boolean;
}> = ({ day, maxDay, disabled, onDayChange, compact }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const cells = [];
  for (let d = 1; d <= 31; d++) {
    const outOfRange = d > maxDay;
    const selected = day === String(d);
    cells.push(
      <button
        key={d}
        type="button"
        disabled={outOfRange}
        onClick={() => { onDayChange(String(d)); setOpen(false); }}
        className={`w-7 h-7 text-xs rounded-md transition-colors ${
          selected
            ? 'bg-blue-600 text-white font-semibold'
            : outOfRange
              ? 'text-gray-200 cursor-not-allowed'
              : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
        }`}
      >
        {d}
      </button>
    );
  }
  const clearCell = (
    <button
      key="clear"
      type="button"
      onClick={() => { onDayChange(''); setOpen(false); }}
      className="w-7 h-7 text-xs rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center"
    >
      <X size={12} />
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`${compact ? 'w-[48px] text-xs py-1' : 'w-[56px] text-sm py-1.5'} flex-shrink-0 border rounded-lg px-1 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed bg-white ${
          day ? 'border-gray-200 text-gray-900' : 'border-gray-200 text-gray-400'
        }`}
      >
        {day || '---'}
      </button>
      {open && !disabled && (
        <div className="absolute z-50 top-full mt-1 right-0 min-w-[196px] bg-white border border-gray-200 rounded-lg shadow-lg p-2">
          <div className="grid grid-cols-6 gap-0.5">
            {cells}
            {clearCell}
          </div>
        </div>
      )}
    </div>
  );
};

const DateFields: React.FC<DateFieldsProps> = ({
  year, month, day,
  onYearChange, onMonthChange, onDayChange,
  compact,
}) => {
  const maxDay = year && month
    ? daysInMonth(parseInt(year, 10), parseInt(month, 10))
    : 31;

  return (
    <div className="flex items-center gap-1.5 flex-nowrap">
      <input
        type="number"
        min="1900"
        max="2099"
        placeholder="YYYY"
        value={year}
        onChange={(e) => {
          const v = e.target.value.slice(0, 4);
          onYearChange(v);
        }}
        className={`${compact ? 'w-[60px] text-xs py-1' : 'w-[72px] text-sm py-1.5'} flex-shrink-0 border border-gray-200 rounded-lg px-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      />
      <span className="text-gray-300 text-sm flex-shrink-0">-</span>
      <select
        value={month}
        onChange={(e) => {
          onMonthChange(e.target.value);
          if (!e.target.value) onDayChange('');
        }}
        disabled={!year}
        className={`${compact ? 'w-[58px] text-xs py-1' : 'w-[68px] text-sm py-1.5'} flex-shrink-0 border border-gray-200 rounded-lg px-1.5 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed bg-white`}
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <span className="text-gray-300 text-sm flex-shrink-0">-</span>
      <DayGrid
        day={day}
        maxDay={maxDay}
        disabled={!year || !month}
        onDayChange={onDayChange}
        compact={compact}
      />
    </div>
  );
};

export default DateFields;
