import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, X, Lock, Clock as Unlock } from 'lucide-react';
import ColorPicker from './ColorPicker';
import CollapsibleSection from './CollapsibleSection';
import DateFields from './DateFields';
import { SlideBoxHeader } from '../services/slideBoxHeaderService';
import { SlidePartialMatch, SlideFieldMatchStatus } from '../utils/slideDataUtils';
import { parsePartialDate, buildDateString } from '../utils/dateFilterUtils';

interface SlideInputSectionProps {
  selectedCells: Set<string>;
  onApply: (headerValues: Record<number, string>, color: string | null, activeFields: SlideFieldMatchStatus) => void;
  onClear: () => void;
  onCross: () => void;
  partialMatch: SlidePartialMatch | null;
  hasNonEmptyCells: boolean;
  headers: SlideBoxHeader[];
  onFormDataChange?: (headerValues: Record<number, string>, color: string | null, activeFields: SlideFieldMatchStatus) => void;
  readOnly?: boolean;
}

const SlideDateInput: React.FC<{ value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const parsed = parsePartialDate(value);
  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);
  const yearRef = useRef(parsed.year);

  useEffect(() => {
    const p = parsePartialDate(value);
    if (p.year !== yearRef.current) {
      setYear(p.year);
      yearRef.current = p.year;
    }
    setMonth(p.month);
    setDay(p.day);
  }, [value]);

  const commit = (y: string, m: string, d: string) => {
    onChange(y ? buildDateString(y, m, d) : '');
  };

  const handleYearChange = (v: string) => {
    setYear(v);
    yearRef.current = v;
    if (v.length === 4 || v === '') {
      commit(v, month, day);
    }
  };

  return (
    <div className={`${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <DateFields
        year={year}
        month={month}
        day={day}
        onYearChange={handleYearChange}
        onMonthChange={(v) => { setMonth(v); commit(year, v, day); }}
        onDayChange={(v) => { setDay(v); commit(year, month, v); }}
        compact
      />
    </div>
  );
};

const SlideInputSection: React.FC<SlideInputSectionProps> = ({
  selectedCells,
  onApply,
  onClear,
  onCross,
  partialMatch,
  hasNonEmptyCells,
  headers,
  onFormDataChange,
  readOnly = false,
}) => {
  const sortedHeaders = [...headers].sort((a, b) => a.display_order - b.display_order);

  const buildAllActive = useCallback((): SlideFieldMatchStatus => ({
    headerFields: Object.fromEntries(sortedHeaders.map(h => [h.display_order, true])),
    color: true,
  }), [sortedHeaders]);

  const [headerInputs, setHeaderInputs] = useState<Record<number, string>>({});
  const [color, setColor] = useState<string | null>(null);
  const [activeFields, setActiveFields] = useState<SlideFieldMatchStatus>(buildAllActive());
  const prevMatchRef = useRef<SlidePartialMatch | null>(null);
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  useEffect(() => {
    if (partialMatch === prevMatchRef.current) return;
    prevMatchRef.current = partialMatch;

    if (!partialMatch) {
      setActiveFields(buildAllActive());
      return;
    }

    const { headerValues, color: matchColor, fieldStatus } = partialMatch;

    setActiveFields({ ...fieldStatus });

    for (const h of sortedHeaders) {
      if (fieldStatus.headerFields[h.display_order]) {
        setHeaderInputs(prev => ({
          ...prev,
          [h.display_order]: headerValues[h.display_order] || '',
        }));
      }
    }

    if (fieldStatus.color) {
      setColor(matchColor);
    }
  }, [partialMatch, sortedHeaders, buildAllActive]);

  useEffect(() => {
    textareaRefs.current.forEach((textarea) => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, [headerInputs]);

  useEffect(() => {
    onFormDataChange?.(headerInputs, color, activeFields);
  }, [headerInputs, color, activeFields, onFormDataChange]);

  const handleHeaderChange = (displayOrder: number, value: string) => {
    setHeaderInputs(prev => ({ ...prev, [displayOrder]: value }));
  };

  const handleApply = () => {
    const trimmed: Record<number, string> = {};
    for (const [key, val] of Object.entries(headerInputs)) {
      trimmed[Number(key)] = val.trim();
    }
    onApply(trimmed, color, activeFields);
  };

  const handleResetAll = () => {
    setHeaderInputs({});
    setColor(null);
    setActiveFields(buildAllActive());
  };

  const toggleHeaderField = useCallback((displayOrder: number) => {
    setActiveFields(prev => ({
      ...prev,
      headerFields: {
        ...prev.headerFields,
        [displayOrder]: !prev.headerFields[displayOrder],
      },
    }));
  }, []);

  const toggleColorField = useCallback(() => {
    setActiveFields(prev => ({ ...prev, color: !prev.color }));
  }, []);

  const hasMixedFields = partialMatch && !partialMatch.allMatch && partialMatch.hasAnyData;

  const setTextareaRef = useCallback((displayOrder: number, el: HTMLTextAreaElement | null) => {
    if (el) {
      textareaRefs.current.set(displayOrder, el);
    } else {
      textareaRefs.current.delete(displayOrder);
    }
  }, []);

  const headerRight = (
    <button
      onClick={handleResetAll}
      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
      title="Reset all fields"
    >
      <Trash2 size={18} />
    </button>
  );

  return (
    <CollapsibleSection
      title="Slide Input"
      defaultOpen={true}
      headerRight={headerRight}
      className="bg-gray-50 shadow-lg"
    >
      <div>
        <div className="max-h-[45vh] overflow-y-auto px-1 -mx-1">
        {sortedHeaders.map((header, idx) => {
          const order = header.display_order;
          const isActive = activeFields.headerFields[order] ?? true;
          const isMixed = hasMixedFields && !partialMatch.fieldStatus.headerFields[order];

          return (
            <div key={header.id} className={idx > 0 ? 'mt-2' : ''}>
              <div className={isMixed && !isActive ? 'opacity-50' : ''}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor={`slide-header-${order}`}
                      className={`block text-sm font-medium ${isActive ? 'text-gray-700' : 'text-gray-400'}`}
                    >
                      {header.header_text || `Header ${order + 1}`}
                    </label>
                    {isMixed && !isActive && (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md leading-none">
                        Mixed
                      </span>
                    )}
                  </div>
                  {isMixed && (
                    <button
                      type="button"
                      onClick={() => toggleHeaderField(order)}
                      className={`p-1 rounded-md transition-all duration-200 ${
                        isActive
                          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                      title={isActive ? `Lock ${header.header_text}` : `Unlock ${header.header_text}`}
                    >
                      {isActive ? <Unlock size={13} /> : <Lock size={13} />}
                    </button>
                  )}
                </div>
                {header.header_type === 'preset' ? (
                  <select
                    id={`slide-header-${order}`}
                    value={headerInputs[order] || ''}
                    onChange={(e) => handleHeaderChange(order, e.target.value)}
                    disabled={!isActive}
                    className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 appearance-none ${
                      isActive
                        ? 'bg-white border-gray-300'
                        : 'bg-gray-100 border-dashed border-gray-300 cursor-not-allowed'
                    }`}
                    style={isActive ? { backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' } : undefined}
                  >
                    <option value="">—</option>
                    {(header.preset_options || []).map((opt) => (
                      <option key={opt.id} value={opt.option_label}>
                        {opt.option_label}
                      </option>
                    ))}
                  </select>
                ) : (header.header_type === 'date' || header.header_type === 'expiration') ? (
                  <SlideDateInput
                    value={headerInputs[order] || ''}
                    onChange={(v) => handleHeaderChange(order, v)}
                    disabled={!isActive}
                  />
                ) : (
                  <textarea
                    ref={(el) => setTextareaRef(order, el)}
                    id={`slide-header-${order}`}
                    value={headerInputs[order] || ''}
                    onChange={(e) => handleHeaderChange(order, e.target.value)}
                    disabled={!isActive}
                    rows={1}
                    className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden transition-colors duration-200 ${
                      isActive
                        ? 'bg-white border-gray-300'
                        : 'bg-gray-100 border-dashed border-gray-300 cursor-not-allowed'
                    }`}
                  />
                )}
              </div>
            </div>
          );
        })}
        </div>

        <div className={`mt-4 relative ${hasMixedFields && !partialMatch.fieldStatus.color && !activeFields.color ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className={`block text-sm font-medium ${activeFields.color ? 'text-gray-700' : 'text-gray-400'}`}>
                Background Color
              </label>
              {hasMixedFields && !partialMatch.fieldStatus.color && !activeFields.color && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md leading-none">
                  Mixed
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {hasMixedFields && !partialMatch.fieldStatus.color && (
                <button
                  type="button"
                  onClick={toggleColorField}
                  className={`p-1 rounded-md transition-all duration-200 ${
                    activeFields.color
                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  title={activeFields.color ? 'Lock Background Color' : 'Unlock Background Color'}
                >
                  {activeFields.color ? <Unlock size={13} /> : <Lock size={13} />}
                </button>
              )}
              {activeFields.color && (
                <ColorPicker selectedColor={color} onColorSelect={setColor} />
              )}
            </div>
          </div>
        </div>
      </div>

      {hasMixedFields && (
        <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-700">
            Selected slides have different values. Locked fields will keep their original values when applied.
          </p>
        </div>
      )}

      {!readOnly && (
      <div className="mt-4 space-y-3">
        <button
          onClick={handleApply}
          disabled={selectedCells.size === 0}
          className={`w-full py-2 px-4 rounded-xl font-medium transition-colors duration-200 ${
            selectedCells.size === 0
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          }`}
        >
          Apply to Selected Slides
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCross}
            disabled={!hasNonEmptyCells}
            className={`py-2 px-4 rounded-xl font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
              !hasNonEmptyCells
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-amber-500 text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2'
            }`}
          >
            <X size={16} />
            Cross
          </button>

          <button
            onClick={onClear}
            disabled={!hasNonEmptyCells}
            className={`py-2 px-4 rounded-xl font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
              !hasNonEmptyCells
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
            }`}
          >
            <Trash2 size={16} />
            Clear
          </button>
        </div>
      </div>
      )}
    </CollapsibleSection>
  );
};

export default SlideInputSection;
