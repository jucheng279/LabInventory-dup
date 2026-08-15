import React, { useState } from 'react';
import { Calendar, Clock, ArrowRight, Check } from 'lucide-react';
import type { DateFilter, DateFilterMode } from '../types/search';
import {
  buildDateString,
  formatPartialDateLabel,
  parsePartialDate,
} from '../utils/dateFilterUtils';
import DateFields from './DateFields';

interface DateFilterPickerProps {
  value: DateFilter | null;
  onChange: (filter: DateFilter | null) => void;
  onClose: () => void;
  showDateTypeOptions?: boolean;
}

const MODE_OPTIONS: { mode: DateFilterMode; label: string }[] = [
  { mode: 'exact', label: 'Exact' },
  { mode: 'range', label: 'Range' },
  { mode: 'before', label: 'Before' },
  { mode: 'after', label: 'After' },
  { mode: 'expiring_within', label: 'Expiring' },
];

const EXPIRY_PRESETS = [7, 14, 30, 60, 90];

const DateFilterPicker: React.FC<DateFilterPickerProps> = ({ value, onChange, onClose, showDateTypeOptions }) => {
  const initDate = parsePartialDate(value?.date || '');
  const initStart = parsePartialDate(value?.startDate || '');
  const initEnd = parsePartialDate(value?.endDate || '');

  const [mode, setMode] = useState<DateFilterMode>(value?.mode || 'exact');
  const [year, setYear] = useState(initDate.year);
  const [month, setMonth] = useState(initDate.month);
  const [day, setDay] = useState(initDate.day);
  const [startYear, setStartYear] = useState(initStart.year);
  const [startMonth, setStartMonth] = useState(initStart.month);
  const [startDay, setStartDay] = useState(initStart.day);
  const [endYear, setEndYear] = useState(initEnd.year);
  const [endMonth, setEndMonth] = useState(initEnd.month);
  const [endDay, setEndDay] = useState(initEnd.day);
  const [days, setDays] = useState<number | ''>(value?.days ?? '');
  const [customDays, setCustomDays] = useState('');
  const [dateTypeDate, setDateTypeDate] = useState<boolean>(() => {
    if (!value?.dateTypeTarget) return true;
    return value.dateTypeTarget === 'date';
  });
  const [dateTypeExpiration, setDateTypeExpiration] = useState<boolean>(() => {
    if (!value?.dateTypeTarget) return true;
    return value.dateTypeTarget === 'expiration';
  });

  const handleModeChange = (newMode: DateFilterMode) => {
    setMode(newMode);
  };

  const canApply = (): boolean => {
    if (mode === 'expiring_within') {
      return typeof days === 'number' && days > 0;
    }
    if (mode === 'range') {
      return !!startYear && !!endYear;
    }
    return !!year;
  };

  const computeDateTypeTarget = (): DateFilter['dateTypeTarget'] => {
    if (!showDateTypeOptions) return undefined;
    if (dateTypeDate && dateTypeExpiration) return null;
    if (!dateTypeDate && !dateTypeExpiration) return null;
    if (dateTypeDate) return 'date';
    return 'expiration';
  };

  const handleApply = () => {
    if (!canApply()) return;

    const dateTypeTarget = computeDateTypeTarget();

    if (mode === 'expiring_within') {
      onChange({ mode: 'expiring_within', days: days as number, dateTypeTarget });
      onClose();
      return;
    }

    if (mode === 'range') {
      onChange({
        mode: 'range',
        startDate: buildDateString(startYear, startMonth, startDay),
        endDate: buildDateString(endYear, endMonth, endDay),
        dateTypeTarget,
      });
      onClose();
      return;
    }

    const dateStr = buildDateString(year, month, day);
    onChange({ mode, date: dateStr, dateTypeTarget });
    onClose();
  };

  const handleClear = () => {
    onChange(null);
    onClose();
  };

  const handlePresetClick = (d: number) => {
    setDays(d);
    setCustomDays('');
    onChange({ mode: 'expiring_within', days: d, dateTypeTarget: computeDateTypeTarget() });
    onClose();
  };

  const handleCustomDaysApply = () => {
    const parsed = parseInt(customDays, 10);
    if (parsed > 0) {
      setDays(parsed);
      onChange({ mode: 'expiring_within', days: parsed, dateTypeTarget: computeDateTypeTarget() });
      onClose();
    }
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-lg border border-gray-200">
      <div className="flex border-b border-gray-100 overflow-x-auto rounded-t-xl">
        {MODE_OPTIONS.map(({ mode: m, label }) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={`flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors ${
              mode === m
                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {mode === 'exact' && (
          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider">Date</label>
            <DateFields
              year={year} month={month} day={day}
              onYearChange={setYear} onMonthChange={setMonth} onDayChange={setDay}
            />
          </div>
        )}

        {mode === 'range' && (
          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider">From</label>
            <DateFields
              year={startYear} month={startMonth} day={startDay}
              onYearChange={setStartYear} onMonthChange={setStartMonth} onDayChange={setStartDay}
            />
            <div className="flex items-center justify-center">
              <ArrowRight size={14} className="text-gray-300" />
            </div>
            <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider">To</label>
            <DateFields
              year={endYear} month={endMonth} day={endDay}
              onYearChange={setEndYear} onMonthChange={setEndMonth} onDayChange={setEndDay}
            />
          </div>
        )}

        {mode === 'before' && (
          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider">On or before</label>
            <DateFields
              year={year} month={month} day={day}
              onYearChange={setYear} onMonthChange={setMonth} onDayChange={setDay}
            />
          </div>
        )}

        {mode === 'after' && (
          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider">On or after</label>
            <DateFields
              year={year} month={month} day={day}
              onYearChange={setYear} onMonthChange={setMonth} onDayChange={setDay}
            />
          </div>
        )}

        {mode === 'expiring_within' && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-orange-600">
              <Clock size={14} />
              <span className="text-[11px] font-medium uppercase tracking-wider">Expiring within</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {EXPIRY_PRESETS.map((d) => (
                <button
                  key={d}
                  onClick={() => handlePresetClick(d)}
                  className={`px-2 py-2 text-xs font-medium rounded-lg border transition-all duration-150 ${
                    days === d
                      ? 'bg-orange-50 border-orange-300 text-orange-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600'
                  }`}
                >
                  {d} days
                </button>
              ))}
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  placeholder="N"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomDaysApply();
                  }}
                  className="w-full px-2 py-2 text-xs text-center font-medium rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-300 placeholder:text-gray-400"
                />
              </div>
            </div>
            {customDays && parseInt(customDays, 10) > 0 && (
              <button
                onClick={handleCustomDaysApply}
                className="w-full py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <Check size={12} />
                Apply {customDays} days
              </button>
            )}
            <p className="text-[10px] text-gray-400 leading-tight">
              Only matches cells with expiration-type dates
            </p>
          </div>
        )}
      </div>

      {mode !== 'expiring_within' && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {showDateTypeOptions && (
            <div className="flex items-center gap-3 pb-1 border-b border-gray-100">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Type:</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dateTypeDate}
                  onChange={(e) => setDateTypeDate(e.target.checked)}
                  className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] text-gray-600 font-medium">Date</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dateTypeExpiration}
                  onChange={(e) => setDateTypeExpiration(e.target.checked)}
                  className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] text-gray-600 font-medium">Expiration Date</span>
              </label>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleApply}
              disabled={!canApply()}
              className="flex-1 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Check size={14} />
              Apply
            </button>
            {value && (
              <button
                onClick={handleClear}
                className="px-3 py-2 text-sm font-medium rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export function getDateFilterLabel(filter: DateFilter): string {
  switch (filter.mode) {
    case 'exact':
      return formatPartialDateLabel(filter.date || '');
    case 'range':
      return `${formatPartialDateLabel(filter.startDate || '')} -- ${formatPartialDateLabel(filter.endDate || '')}`;
    case 'before':
      return `On or before ${formatPartialDateLabel(filter.date || '')}`;
    case 'after':
      return `On or after ${formatPartialDateLabel(filter.date || '')}`;
    case 'expiring_within':
      return `Expiring in ${filter.days || '?'} days`;
    default:
      return '';
  }
}

export function getDateFilterIcon(filter: DateFilter): typeof Calendar {
  if (filter.mode === 'expiring_within') return Clock;
  return Calendar;
}

export default DateFilterPicker;
