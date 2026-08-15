import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Trash2, Plus, X, ChevronDown, Lock, Clock as Unlock, Calendar, CalendarClock, Type, List, ListOrdered, PackagePlus, Link2 } from 'lucide-react';
import ColorPicker from './ColorPicker';
import CollapsibleSection from './CollapsibleSection';
import DateFields from './DateFields';
import type { StructuredBoxHeader } from '../types/database';
import { parsePartialDate, buildDateString } from '../utils/dateFilterUtils';
import { StructuredPartialMatch, StructuredFieldMatchStatus } from '../utils/structuredDataUtils';
import { detectSequentialCandidate, buildSequentialNamesMap, SequentialCandidate, SequentialRef } from '../utils/sequentialNamingUtils';
import type { CellData, ColumnValuesMap } from '../types/database';

interface StructuredFreezerInputSectionProps {
  selectedCells: Set<string>;
  cellData: Record<string, CellData>;
  columnValues: ColumnValuesMap;
  sequentialRef: React.MutableRefObject<SequentialRef>;
  onApply: (name: string, headerValues: Record<number, string>, color: string | null, activeFields: StructuredFieldMatchStatus, sequentialNames?: Record<string, string>) => void;
  onClear: () => void;
  onCross: () => void;
  partialMatch: StructuredPartialMatch | null;
  hasNonEmptyCells: boolean;
  headers: StructuredBoxHeader[];
  onFormDataChange?: (name: string, headerValues: Record<number, string>, color: string | null, activeFields: StructuredFieldMatchStatus) => void;
  canApplyItemToGrid?: boolean;
  onApplyItemToGrid?: () => void;
  singleLinkedItemId?: string | null;
  onNavigateToLinkedItem?: (itemId: string) => void;
  readOnly?: boolean;
}

const StructuredDateInput: React.FC<{ value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
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

function headerTypeMeta(type: StructuredBoxHeader['header_type']) {
  if (type === 'date') return { Icon: Calendar, bg: 'bg-blue-100', text: 'text-blue-700' };
  if (type === 'expiration') return { Icon: CalendarClock, bg: 'bg-orange-100', text: 'text-orange-700' };
  if (type === 'preset') return { Icon: List, bg: 'bg-teal-100', text: 'text-teal-700' };
  return { Icon: Type, bg: 'bg-gray-100', text: 'text-gray-600' };
}

const StructuredFreezerInputSection: React.FC<StructuredFreezerInputSectionProps> = ({
  selectedCells,
  cellData,
  columnValues,
  sequentialRef,
  onApply,
  onClear,
  onCross,
  partialMatch,
  hasNonEmptyCells,
  headers,
  onFormDataChange,
  canApplyItemToGrid,
  onApplyItemToGrid,
  singleLinkedItemId,
  onNavigateToLinkedItem,
  readOnly = false,
}) => {
  const sortedHeaders = [...headers].sort((a, b) => a.display_order - b.display_order);

  const buildAllActive = useCallback((): StructuredFieldMatchStatus => ({
    name: true,
    headerFields: Object.fromEntries(sortedHeaders.map(h => [h.display_order, true])),
    color: true,
  }), [sortedHeaders]);

  const [name, setName] = useState('');
  const [headerInputs, setHeaderInputs] = useState<Record<number, string>>({});
  const [color, setColor] = useState<string | null>(null);
  const [activeFields, setActiveFields] = useState<StructuredFieldMatchStatus>(buildAllActive());
  const prevMatchRef = useRef<StructuredPartialMatch | null>(null);
  const nameTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  const [focusedHeader, setFocusedHeader] = useState<number | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertMode, setInsertMode] = useState<'Cell' | 'Conc'>('Cell');
  const [coefficient, setCoefficient] = useState('');
  const [power, setPower] = useState('0');
  const [numeratorPrefix, setNumeratorPrefix] = useState('');
  const [baseUnit, setBaseUnit] = useState('');
  const [denominatorPrefix, setDenominatorPrefix] = useState('');

  const [sequentialActive, setSequentialActive] = useState(false);

  const sequentialCandidate = useMemo<SequentialCandidate | null>(
    () => detectSequentialCandidate(selectedCells, cellData),
    [selectedCells, cellData]
  );

  useEffect(() => {
    if (!sequentialCandidate) setSequentialActive(false);
  }, [sequentialCandidate]);

  const toggleSequential = useCallback(() => {
    if (!sequentialCandidate) return;
    if (sequentialActive) {
      setSequentialActive(false);
    } else {
      const sourceId = sequentialCandidate.sourceCellId;
      const source = cellData[sourceId];
      if (source) setColor(source.color || null);
      const sourceColVals = columnValues[sourceId] || {};
      const newHeaderInputs: Record<number, string> = {};
      for (const h of sortedHeaders) {
        newHeaderInputs[h.display_order] = sourceColVals[h.display_order] || '';
      }
      setHeaderInputs(newHeaderInputs);
      setSequentialActive(true);
    }
  }, [sequentialCandidate, sequentialActive, cellData, columnValues, sortedHeaders]);

  const getSequentialNamesMap = useCallback(() => {
    if (!sequentialActive || !sequentialCandidate) return undefined;
    const namesMap = buildSequentialNamesMap(sequentialCandidate);
    const source = cellData[sequentialCandidate.sourceCellId];
    namesMap[sequentialCandidate.sourceCellId] = source?.name?.trim() || '';
    return namesMap;
  }, [sequentialActive, sequentialCandidate, cellData]);

  useEffect(() => {
    sequentialRef.current = { active: sequentialActive, getNamesMap: getSequentialNamesMap, infoActive: false, getInfoMap: () => undefined };
  }, [sequentialActive, getSequentialNamesMap, sequentialRef]);

  const unitPrefixes = [
    { value: '', label: '' },
    { value: 'f', label: 'f (femto)' },
    { value: 'p', label: 'p (pico)' },
    { value: 'n', label: 'n (nano)' },
    { value: '\u03BC', label: '\u03BC (micro)' },
    { value: 'm', label: 'm (milli)' },
    { value: 'k', label: 'k (kilo)' },
  ];

  const baseUnits = [
    { value: '', label: '' },
    { value: 'g', label: 'g' },
    { value: 'M', label: 'M' },
  ];

  const denominatorUnits = [
    { value: '', label: '' },
    { value: 'fL', label: 'fL' },
    { value: 'pL', label: 'pL' },
    { value: 'nL', label: 'nL' },
    { value: '\u03BCL', label: '\u03BCL' },
    { value: 'mL', label: 'mL' },
    { value: 'L', label: 'L' },
    { value: 'kL', label: 'kL' },
  ];

  useEffect(() => {
    if (partialMatch === prevMatchRef.current) return;
    prevMatchRef.current = partialMatch;

    if (!partialMatch) {
      setActiveFields(buildAllActive());
      return;
    }

    const { name: matchName, headerValues, color: matchColor, fieldStatus } = partialMatch;
    setActiveFields({ ...fieldStatus });

    if (fieldStatus.name) setName(matchName);

    for (const h of sortedHeaders) {
      if (fieldStatus.headerFields[h.display_order]) {
        setHeaderInputs(prev => ({
          ...prev,
          [h.display_order]: headerValues[h.display_order] || '',
        }));
      }
    }

    if (fieldStatus.color) setColor(matchColor);
  }, [partialMatch, sortedHeaders, buildAllActive]);

  useEffect(() => {
    if (nameTextareaRef.current) {
      nameTextareaRef.current.style.height = 'auto';
      nameTextareaRef.current.style.height = `${nameTextareaRef.current.scrollHeight}px`;
    }
  }, [name]);

  useEffect(() => {
    textareaRefs.current.forEach((t) => {
      t.style.height = 'auto';
      t.style.height = `${t.scrollHeight}px`;
    });
  }, [headerInputs]);

  useEffect(() => {
    const trimmed: Record<number, string> = {};
    for (const [k, v] of Object.entries(headerInputs)) trimmed[Number(k)] = v.trim();
    onFormDataChange?.(name.trim(), trimmed, color, activeFields);
  }, [name, headerInputs, color, activeFields, onFormDataChange]);

  const handleHeaderChange = (order: number, value: string) => {
    setHeaderInputs(prev => ({ ...prev, [order]: value }));
  };

  const handleApply = () => {
    const trimmed: Record<number, string> = {};
    for (const [k, v] of Object.entries(headerInputs)) trimmed[Number(k)] = v.trim();
    const namesMap = getSequentialNamesMap();
    onApply(name.trim(), trimmed, color, activeFields, namesMap);
    if (namesMap) setSequentialActive(false);
  };

  const handleResetAll = () => {
    setName('');
    setHeaderInputs({});
    setColor(null);
    setCoefficient('');
    setPower('0');
    setNumeratorPrefix('');
    setBaseUnit('');
    setDenominatorPrefix('');
    setActiveFields(buildAllActive());
    setSequentialActive(false);
  };

  const toggleNameField = () => setActiveFields(prev => ({ ...prev, name: !prev.name }));
  const toggleColorField = () => setActiveFields(prev => ({ ...prev, color: !prev.color }));
  const toggleHeaderField = (order: number) => setActiveFields(prev => ({
    ...prev,
    headerFields: { ...prev.headerFields, [order]: !prev.headerFields[order] },
  }));

  const setTextareaRef = useCallback((order: number, el: HTMLTextAreaElement | null) => {
    if (el) textareaRefs.current.set(order, el);
    else textareaRefs.current.delete(order);
  }, []);

  const handleInsert = () => {
    if (focusedHeader === null) return;
    const header = sortedHeaders.find(h => h.display_order === focusedHeader);
    if (!header || header.header_type !== 'text') return;
    const textarea = textareaRefs.current.get(focusedHeader);
    if (!textarea) return;

    let insertText = '';
    if (insertMode === 'Cell') {
      if (!coefficient.trim()) return;
      const superscriptMap: Record<string, string> = {
        '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074',
        '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
        '10': '\u00B9\u2070',
      };
      insertText = `${coefficient.trim()}\u00D710${superscriptMap[power] || power}`;
    } else {
      insertText = (numeratorPrefix + baseUnit) + '/' + denominatorPrefix;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = headerInputs[focusedHeader] || '';
    const newValue = current.substring(0, start) + insertText + current.substring(end);
    setHeaderInputs(prev => ({ ...prev, [focusedHeader]: newValue }));

    setTimeout(() => {
      const pos = start + insertText.length;
      textarea.setSelectionRange(pos, pos);
      textarea.focus();
    }, 0);

    if (insertMode === 'Cell') setCoefficient('');
  };

  const hasMixedFields = partialMatch && !partialMatch.allMatch && partialMatch.hasAnyData;

  const focusedHeaderIsText = (() => {
    if (focusedHeader === null) return false;
    const h = sortedHeaders.find(hd => hd.display_order === focusedHeader);
    return h?.header_type === 'text';
  })();

  const headerRight = (
    <div className="flex items-center gap-1">
      {!readOnly && canApplyItemToGrid && onApplyItemToGrid && (
        <button
          onClick={onApplyItemToGrid}
          className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200"
          title="Apply item to selected cells"
        >
          <PackagePlus size={18} />
        </button>
      )}
      {singleLinkedItemId && onNavigateToLinkedItem && (
        <button
          onClick={() => onNavigateToLinkedItem(singleLinkedItemId)}
          className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors duration-200"
          title="Go to linked item"
        >
          <Link2 size={18} />
        </button>
      )}
      <button
        onClick={handleResetAll}
        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        title="Reset all fields"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );

  const renderLockIcon = (active: boolean) => (active ? <Unlock size={13} /> : <Lock size={13} />);

  return (
    <CollapsibleSection
      title="Reagent Input"
      defaultOpen={true}
      headerRight={headerRight}
      className="bg-gray-50 shadow-lg"
    >
      <div>
        <div className="max-h-[60vh] overflow-y-auto px-1 -mx-1">
          <div className={hasMixedFields && !partialMatch.fieldStatus.name && !activeFields.name ? 'opacity-50' : ''}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <label htmlFor="sf-name" className={`block text-sm font-medium ${activeFields.name ? 'text-gray-700' : 'text-gray-400'}`}>
                  Name
                </label>
                {hasMixedFields && !partialMatch.fieldStatus.name && !activeFields.name && (
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md leading-none">
                    Mixed
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {hasMixedFields && !partialMatch.fieldStatus.name && (
                  <button
                    type="button"
                    onClick={toggleNameField}
                    className={`p-1 rounded-md transition-all duration-200 ${
                      activeFields.name ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {renderLockIcon(activeFields.name)}
                  </button>
                )}
                {!readOnly && sequentialCandidate && (
                  <button
                    type="button"
                    onClick={toggleSequential}
                    className={`p-1 rounded-md transition-all duration-200 ${
                      sequentialActive
                        ? 'text-teal-600 bg-teal-50 hover:bg-teal-100'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                    title={sequentialActive ? 'Disable sequential fill' : 'Enable sequential fill'}
                  >
                    <ListOrdered size={13} />
                  </button>
                )}
              </div>
            </div>
            <textarea
              ref={nameTextareaRef}
              id="sf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!activeFields.name}
              rows={1}
              className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden transition-colors duration-200 ${
                activeFields.name ? 'bg-white border-gray-300' : 'bg-gray-100 border-dashed border-gray-300 cursor-not-allowed'
              }`}
            />
          </div>

          {sortedHeaders.map((header) => {
            const order = header.display_order;
            const isActive = activeFields.headerFields[order] ?? true;
            const isMixed = hasMixedFields && !partialMatch.fieldStatus.headerFields[order];
            const meta = headerTypeMeta(header.header_type);
            const { Icon } = meta;

            return (
              <div key={header.id} className="mt-3">
                <div className={isMixed && !isActive ? 'opacity-50' : ''}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`p-1 rounded-md ${meta.bg} ${meta.text}`}>
                        <Icon size={11} />
                      </span>
                      <label
                        htmlFor={`sf-h-${order}`}
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
                          isActive ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {renderLockIcon(isActive)}
                      </button>
                    )}
                  </div>
                  {header.header_type === 'preset' ? (
                    <select
                      id={`sf-h-${order}`}
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
                    <StructuredDateInput
                      value={headerInputs[order] || ''}
                      onChange={(v) => handleHeaderChange(order, v)}
                      disabled={!isActive}
                    />
                  ) : (
                    <textarea
                      ref={(el) => setTextareaRef(order, el)}
                      id={`sf-h-${order}`}
                      value={headerInputs[order] || ''}
                      onChange={(e) => handleHeaderChange(order, e.target.value)}
                      onFocus={() => setFocusedHeader(order)}
                      disabled={!isActive}
                      rows={1}
                      className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden transition-colors duration-200 ${
                        isActive ? 'bg-white border-gray-300' : 'bg-gray-100 border-dashed border-gray-300 cursor-not-allowed'
                      }`}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {sortedHeaders.some(h => h.header_type === 'text') && (
            <div className="mt-2 bg-gray-100 rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setInsertOpen(!insertOpen)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-200/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-700">Insert</h4>
                  {focusedHeaderIsText && focusedHeader !== null && (
                    <span className="text-[10px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md leading-none">
                      {sortedHeaders.find(h => h.display_order === focusedHeader)?.header_text || `Header ${focusedHeader + 1}`}
                    </span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${insertOpen ? 'rotate-180' : ''}`} />
              </button>
              {insertOpen && (
                <div className="px-3 pb-3">
                  <div className="flex items-center justify-end mb-2">
                    <div className="flex bg-white/50 rounded-lg border border-white/50 p-0.5">
                      <button
                        onClick={() => setInsertMode('Cell')}
                        className={`px-2 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                          insertMode === 'Cell' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Cell
                      </button>
                      <button
                        onClick={() => setInsertMode('Conc')}
                        className={`px-2 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                          insertMode === 'Conc' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Conc
                      </button>
                    </div>
                  </div>
                  {insertMode === 'Cell' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={coefficient}
                        onChange={(e) => setCoefficient(e.target.value)}
                        placeholder="Coefficient"
                        className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                      <span className="text-sm text-gray-600">x10^</span>
                      <select
                        value={power}
                        onChange={(e) => setPower(e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        {Array.from({ length: 11 }, (_, i) => (
                          <option key={i} value={i.toString()}>{i}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {insertMode === 'Conc' && (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={numeratorPrefix}
                        onChange={(e) => setNumeratorPrefix(e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        {unitPrefixes.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                      <select
                        value={baseUnit}
                        onChange={(e) => setBaseUnit(e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        {baseUnits.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                      <span className="text-sm font-semibold text-gray-500">/</span>
                      <select
                        value={denominatorPrefix}
                        onChange={(e) => setDenominatorPrefix(e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        {denominatorUnits.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                  )}
                  <button
                    onClick={handleInsert}
                    disabled={!focusedHeaderIsText || (insertMode === 'Cell' && !coefficient.trim())}
                    className={`mt-2 w-full px-3 py-2 text-sm rounded-xl font-medium transition-colors duration-200 flex items-center justify-center gap-1 ${
                      (!focusedHeaderIsText || (insertMode === 'Cell' && !coefficient.trim()))
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Plus size={14} />
                    Insert
                  </button>
                </div>
              )}
            </div>
          )}

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
                      activeFields.color ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {renderLockIcon(activeFields.color)}
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
              Selected cells have different values. Locked fields will keep their original values when applied.
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
                : sequentialActive
                  ? 'bg-teal-600 text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }`}
          >
            {sequentialActive ? 'Apply Sequential Fill' : 'Apply to Selected Cells'}
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
      </div>
    </CollapsibleSection>
  );
};

export default StructuredFreezerInputSection;
