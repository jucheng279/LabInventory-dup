import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Trash2, Plus, X, ChevronDown, Lock, Clock as Unlock, ListOrdered, PackagePlus, Link2 } from 'lucide-react';
import ColorPicker from './ColorPicker';
import CollapsibleSection from './CollapsibleSection';
import { PartialCellMatch, FieldMatchStatus } from '../utils/cellDataUtils';
import { detectSequentialCandidate, detectSequentialInfoCandidate, buildSequentialNamesMap, SequentialCandidate, SequentialRef } from '../utils/sequentialNamingUtils';

interface CellData {
  name: string;
  information: string;
  date: string | null;
  color?: string | null;
  is_crossed?: boolean;
  date_type?: 'date' | 'expiration' | 'none';
}

interface InputSectionProps {
  selectedCells: Set<string>;
  cellData: Record<string, CellData>;
  sequentialRef: React.MutableRefObject<SequentialRef>;
  onApply: (data: CellData, activeFields?: FieldMatchStatus, sequentialNames?: Record<string, string>, sequentialInfo?: Record<string, string>) => void;
  onClear: () => void;
  onCross: () => void;
  partialMatch: PartialCellMatch | null;
  hasNonEmptyCells: boolean;
  onFormDataChange?: (data: CellData, activeFields: FieldMatchStatus) => void;
  canApplyItemToGrid?: boolean;
  onApplyItemToGrid?: () => void;
  singleLinkedItemId?: string | null;
  onNavigateToLinkedItem?: (itemId: string) => void;
  readOnly?: boolean;
}

const ALL_ACTIVE: FieldMatchStatus = { name: true, information: true, date: true, color: true, dateType: true };

const InputSection: React.FC<InputSectionProps> = ({ selectedCells, cellData, sequentialRef, onApply, onClear, onCross, partialMatch, hasNonEmptyCells, onFormDataChange, canApplyItemToGrid, onApplyItemToGrid, singleLinkedItemId, onNavigateToLinkedItem, readOnly = false }) => {
  const [name, setName] = useState('');
  const [information, setInformation] = useState('');
  const [date, setDate] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [coefficient, setCoefficient] = useState('');
  const [power, setPower] = useState('0');
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);
  const [insertMode, setInsertMode] = useState<'Cell' | 'Conc'>('Cell');
  const [numeratorPrefix, setNumeratorPrefix] = useState('');
  const [baseUnit, setBaseUnit] = useState('');
  const [denominatorPrefix, setDenominatorPrefix] = useState('');
  const [dateType, setDateType] = useState<'date' | 'expiration' | 'none'>('none');
  const [insertOpen, setInsertOpen] = useState(false);
  const nameTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [activeFields, setActiveFields] = useState<FieldMatchStatus>(ALL_ACTIVE);
  const prevMatchRef = useRef<PartialCellMatch | null>(null);

  const [sequentialActive, setSequentialActive] = useState(false);
  const [sequentialInfoActive, setSequentialInfoActive] = useState(false);

  const sequentialCandidate = useMemo<SequentialCandidate | null>(
    () => detectSequentialCandidate(selectedCells, cellData),
    [selectedCells, cellData]
  );

  const sequentialInfoCandidate = useMemo<SequentialCandidate | null>(
    () => detectSequentialInfoCandidate(selectedCells, cellData),
    [selectedCells, cellData]
  );

  useEffect(() => {
    if (!sequentialCandidate) setSequentialActive(false);
  }, [sequentialCandidate]);

  useEffect(() => {
    if (!sequentialInfoCandidate) setSequentialInfoActive(false);
  }, [sequentialInfoCandidate]);

  const toggleSequential = useCallback(() => {
    if (!sequentialCandidate) return;
    if (sequentialActive) {
      setSequentialActive(false);
    } else {
      const source = cellData[sequentialCandidate.sourceCellId];
      if (source) {
        setInformation(source.information || '');
        setDateType(source.date_type || 'date');
        setDate(source.date || '');
        setColor(source.color || null);
      }
      setSequentialActive(true);
    }
  }, [sequentialCandidate, sequentialActive, cellData]);

  const toggleSequentialInfo = useCallback(() => {
    if (!sequentialInfoCandidate) return;
    if (sequentialInfoActive) {
      setSequentialInfoActive(false);
    } else {
      const source = cellData[sequentialInfoCandidate.sourceCellId];
      if (source) {
        setName(source.name || '');
        setDateType(source.date_type || 'date');
        setDate(source.date || '');
        setColor(source.color || null);
      }
      setSequentialInfoActive(true);
    }
  }, [sequentialInfoCandidate, sequentialInfoActive, cellData]);

  const getSequentialNamesMap = useCallback(() => {
    if (!sequentialActive || !sequentialCandidate) return undefined;
    const namesMap = buildSequentialNamesMap(sequentialCandidate);
    const source = cellData[sequentialCandidate.sourceCellId];
    namesMap[sequentialCandidate.sourceCellId] = source?.name?.trim() || '';
    return namesMap;
  }, [sequentialActive, sequentialCandidate, cellData]);

  const getSequentialInfoMap = useCallback(() => {
    if (!sequentialInfoActive || !sequentialInfoCandidate) return undefined;
    const infoMap = buildSequentialNamesMap(sequentialInfoCandidate);
    const source = cellData[sequentialInfoCandidate.sourceCellId];
    infoMap[sequentialInfoCandidate.sourceCellId] = source?.information?.trim() || '';
    return infoMap;
  }, [sequentialInfoActive, sequentialInfoCandidate, cellData]);

  useEffect(() => {
    sequentialRef.current = {
      active: sequentialActive,
      getNamesMap: getSequentialNamesMap,
      infoActive: sequentialInfoActive,
      getInfoMap: getSequentialInfoMap,
    };
  }, [sequentialActive, getSequentialNamesMap, sequentialInfoActive, getSequentialInfoMap, sequentialRef]);

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

  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    setDate('');
  }, []);

  useEffect(() => {
    if (partialMatch === prevMatchRef.current) return;
    prevMatchRef.current = partialMatch;

    if (!partialMatch) {
      setActiveFields(ALL_ACTIVE);
      return;
    }

    const { data, fieldStatus } = partialMatch;

    setActiveFields({ ...fieldStatus });

    if (fieldStatus.name) {
      setName(data.name);
    }
    if (fieldStatus.information) {
      setInformation(data.information);
    }
    if (fieldStatus.dateType) {
      const populatedDateType = data.date_type || 'date';
      setDateType(populatedDateType);
      if (fieldStatus.date) {
        if (populatedDateType === 'none' || !data.date) {
          setDateType('none');
          setDate('');
        } else {
          setDate(data.date);
        }
      }
    }
    if (fieldStatus.date && !fieldStatus.dateType) {
      if (data.date) {
        setDate(data.date);
      }
    }
    if (fieldStatus.color) {
      setColor(data.color || null);
    }
  }, [partialMatch]);

  useEffect(() => {
    if (nameTextareaRef.current) {
      nameTextareaRef.current.style.height = 'auto';
      nameTextareaRef.current.style.height = `${nameTextareaRef.current.scrollHeight}px`;
    }
  }, [name]);

  useEffect(() => {
    if (textareaRef) {
      textareaRef.style.height = 'auto';
      textareaRef.style.height = `${textareaRef.scrollHeight}px`;
    }
  }, [information, textareaRef]);

  useEffect(() => {
    onFormDataChange?.(
      {
        name: name.trim(),
        information,
        date: dateType === 'none' ? null : date,
        color,
        date_type: dateType,
      },
      activeFields
    );
  }, [name, information, date, color, dateType, activeFields, onFormDataChange]);

  const handleApply = () => {
    const data: CellData = {
      name: name.trim(),
      information,
      date: dateType === 'none' ? null : date,
      color,
      date_type: dateType,
    };
    const namesMap = getSequentialNamesMap();
    const infoMap = getSequentialInfoMap();
    onApply(data, activeFields, namesMap, infoMap);
    if (namesMap) setSequentialActive(false);
    if (infoMap) setSequentialInfoActive(false);
  };

  const handleResetAll = () => {
    setName('');
    setInformation('');
    setCoefficient('');
    setPower('0');
    setNumeratorPrefix('');
    setBaseUnit('');
    setDenominatorPrefix('');
    setColor(null);
    setDateType('none');
    setDate('');
    setActiveFields(ALL_ACTIVE);
    setSequentialActive(false);
    setSequentialInfoActive(false);
  };

  const handleDateTypeChange = (newType: 'date' | 'expiration' | 'none') => {
    const prevType = dateType;
    setDateType(newType);
    if (newType === 'none') {
      setDate('');
    } else if (prevType === 'none') {
      setDate(getTodayString());
    }
  };

  const toggleField = useCallback((field: keyof FieldMatchStatus) => {
    setActiveFields(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const handleInsert = () => {
    if (!textareaRef) return;

    let insertText = '';

    if (insertMode === 'Cell') {
      if (!coefficient.trim()) return;

      const superscriptMap: Record<string, string> = {
        '0': '\u2070',
        '1': '\u00B9',
        '2': '\u00B2',
        '3': '\u00B3',
        '4': '\u2074',
        '5': '\u2075',
        '6': '\u2076',
        '7': '\u2077',
        '8': '\u2078',
        '9': '\u2079',
        '10': '\u00B9\u2070'
      };

      const superscriptPower = superscriptMap[power] || power;
      insertText = `${coefficient.trim()}\u00D710${superscriptPower}`;
    } else if (insertMode === 'Conc') {
      const numerator = numeratorPrefix + baseUnit;
      insertText = numerator + '/' + denominatorPrefix;
    }

    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const currentValue = information;

    const newValue = currentValue.substring(0, start) + insertText + currentValue.substring(end);
    setInformation(newValue);

    setTimeout(() => {
      const newCursorPos = start + insertText.length;
      textareaRef.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.focus();
    }, 0);

    if (insertMode === 'Cell') {
      setCoefficient('');
    }
  };

  const hasMixedFields = partialMatch && !partialMatch.allMatch && partialMatch.hasAnyData;

  const fieldLabel = (label: string, field: keyof FieldMatchStatus, htmlFor?: string) => {
    const isActive = activeFields[field];
    const isMixed = hasMixedFields && !partialMatch.fieldStatus[field];

    return (
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <label htmlFor={htmlFor} className={`block text-sm font-medium ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>
            {label}
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
            onClick={() => toggleField(field)}
            className={`p-1 rounded-md transition-all duration-200 ${
              isActive
                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title={isActive ? `Lock ${label} (keep original values)` : `Unlock ${label} (edit and apply)`}
          >
            {isActive ? <Unlock size={13} /> : <Lock size={13} />}
          </button>
        )}
      </div>
    );
  };

  const fieldWrapperClass = (field: keyof FieldMatchStatus) => {
    const isActive = activeFields[field];
    const isMixed = hasMixedFields && !partialMatch.fieldStatus[field];
    if (isMixed && !isActive) {
      return 'opacity-50';
    }
    return '';
  };

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

  return (
    <CollapsibleSection
      title="Reagent Input"
      defaultOpen={true}
      headerRight={headerRight}
      className="bg-gray-50 shadow-lg"
    >
      <div>
        <div className={fieldWrapperClass('name')}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <label htmlFor="name" className={`block text-sm font-medium ${activeFields.name ? 'text-gray-700' : 'text-gray-400'}`}>
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
                  onClick={() => toggleField('name')}
                  className={`p-1 rounded-md transition-all duration-200 ${
                    activeFields.name
                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  title={activeFields.name ? 'Lock Name (keep original values)' : 'Unlock Name (edit and apply)'}
                >
                  {activeFields.name ? <Unlock size={13} /> : <Lock size={13} />}
                </button>
              )}
              {!readOnly && sequentialCandidate && (
                <button
                  type="button"
                  onClick={toggleSequential}
                  data-tutorial-id="input-sequential-name-btn"
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
            id="name"
            data-tutorial-id="input-name-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!activeFields.name}
            rows={1}
            className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden transition-colors duration-200 ${
              activeFields.name
                ? 'bg-white border-gray-300'
                : 'bg-gray-100 border-dashed border-gray-300 cursor-not-allowed'
            }`}
          />
        </div>

        <div className={`mt-4 ${fieldWrapperClass('information')}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <label htmlFor="information" className={`block text-sm font-medium ${activeFields.information ? 'text-gray-700' : 'text-gray-400'}`}>
                Reagent Information
              </label>
              {hasMixedFields && !partialMatch.fieldStatus.information && !activeFields.information && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md leading-none">
                  Mixed
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasMixedFields && !partialMatch.fieldStatus.information && (
                <button
                  type="button"
                  onClick={() => toggleField('information')}
                  className={`p-1 rounded-md transition-all duration-200 ${
                    activeFields.information
                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  title={activeFields.information ? 'Lock Reagent Information (keep original values)' : 'Unlock Reagent Information (edit and apply)'}
                >
                  {activeFields.information ? <Unlock size={13} /> : <Lock size={13} />}
                </button>
              )}
              {!readOnly && sequentialInfoCandidate && (
                <button
                  type="button"
                  onClick={toggleSequentialInfo}
                  data-tutorial-id="input-sequential-info-btn"
                  className={`p-1 rounded-md transition-all duration-200 ${
                    sequentialInfoActive
                      ? 'text-teal-600 bg-teal-50 hover:bg-teal-100'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  title={sequentialInfoActive ? 'Disable sequential info fill' : 'Enable sequential info fill'}
                >
                  <ListOrdered size={13} />
                </button>
              )}
            </div>
          </div>
          <textarea
            ref={setTextareaRef}
            id="information"
            data-tutorial-id="input-info-field"
            value={information}
            onChange={(e) => setInformation(e.target.value)}
            disabled={!activeFields.information}
            rows={1}
            className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden transition-colors duration-200 ${
              activeFields.information
                ? 'bg-white border-gray-300'
                : 'bg-gray-100 border-dashed border-gray-300 cursor-not-allowed'
            }`}
          />

          {activeFields.information && (
          <div className="mt-0.5 bg-gray-100 rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setInsertOpen(!insertOpen)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-200/50 transition-colors"
            >
              <h4 className="text-sm font-medium text-gray-700">Insert</h4>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${insertOpen ? 'rotate-180' : ''}`} />
            </button>
            {insertOpen && (
            <div className="px-3 pb-3">
              <div className="flex items-center justify-end mb-2">
                <div className="flex bg-white/50 backdrop-blur-sm rounded-lg border border-white/50 p-0.5">
                  <button
                    onClick={() => setInsertMode('Cell')}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                      insertMode === 'Cell'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Cell
                  </button>
                  <button
                    onClick={() => setInsertMode('Conc')}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                      insertMode === 'Conc'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-gray-800'
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
                  className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent bg-white"
                />
                <span className="text-sm text-gray-600">x10^</span>
                <select
                  value={power}
                  onChange={(e) => setPower(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent bg-white"
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
                  className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {unitPrefixes.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <select
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {baseUnits.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
                <span className="text-sm font-semibold text-gray-500">/</span>
                <select
                  value={denominatorPrefix}
                  onChange={(e) => setDenominatorPrefix(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {denominatorUnits.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={handleInsert}
              disabled={insertMode === 'Cell' ? !coefficient.trim() : false}
              className={`
                mt-2 w-full px-3 py-2 text-sm rounded-xl font-medium transition-colors duration-200 flex items-center justify-center gap-1
                ${(insertMode === 'Cell' ? !coefficient.trim() : false)
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500'
                }
              `}
            >
              <Plus size={14} />
              Insert
            </button>
            </div>
            )}
          </div>
          )}
        </div>

        <div className={`mt-6 ${fieldWrapperClass('date')}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <label htmlFor="date" className={`block text-sm font-medium ${activeFields.date && activeFields.dateType ? 'text-gray-700' : 'text-gray-400'}`}>
                {dateType === 'expiration' ? 'Expiration Date' : 'Date'}
              </label>
              {hasMixedFields && (!partialMatch.fieldStatus.date || !partialMatch.fieldStatus.dateType) && !(activeFields.date && activeFields.dateType) && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md leading-none">
                  Mixed
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasMixedFields && (!partialMatch.fieldStatus.date || !partialMatch.fieldStatus.dateType) && (
                <button
                  type="button"
                  onClick={() => {
                    const bothActive = activeFields.date && activeFields.dateType;
                    setActiveFields(prev => ({ ...prev, date: !bothActive, dateType: !bothActive }));
                  }}
                  className={`p-1 rounded-md transition-all duration-200 ${
                    activeFields.date && activeFields.dateType
                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  title={activeFields.date && activeFields.dateType ? 'Lock Date (keep original values)' : 'Unlock Date (edit and apply)'}
                >
                  {activeFields.date && activeFields.dateType ? <Unlock size={13} /> : <Lock size={13} />}
                </button>
              )}
              {(activeFields.date && activeFields.dateType) && (
                <div className="flex bg-white/50 backdrop-blur-sm rounded-lg border border-gray-200 p-0.5">
                  <button
                    onClick={() => handleDateTypeChange('date')}
                    data-tutorial-id="input-date-type-date"
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                      dateType === 'date'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Date
                  </button>
                  <button
                    onClick={() => handleDateTypeChange('expiration')}
                    data-tutorial-id="input-date-type-expiration"
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                      dateType === 'expiration'
                        ? 'bg-amber-500 text-white'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Expiration
                  </button>
                  <button
                    onClick={() => handleDateTypeChange('none')}
                    data-tutorial-id="input-date-type-none"
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                      dateType === 'none'
                        ? 'bg-gray-600 text-white'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    None
                  </button>
                </div>
              )}
            </div>
          </div>
          {(activeFields.date && activeFields.dateType) && dateType !== 'none' && (
            <input
              type="date"
              id="date"
              data-tutorial-id="input-date-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors duration-200 ${
                dateType === 'expiration' ? 'border-amber-400' : 'border-gray-300'
              }`}
            />
          )}
          {!(activeFields.date && activeFields.dateType) && (
            <div className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-xl bg-gray-100 text-sm text-gray-400 cursor-not-allowed">
              Locked
            </div>
          )}
        </div>

        <div className={`mt-4 relative ${fieldWrapperClass('color')}`}>
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
                  onClick={() => toggleField('color')}
                  className={`p-1 rounded-md transition-all duration-200 ${
                    activeFields.color
                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  title={activeFields.color ? 'Lock Background Color (keep original values)' : 'Unlock Background Color (edit and apply)'}
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
            Selected cells have different values. Locked fields will keep their original values when applied.
            Click the lock icon to unlock and edit a field.
          </p>
        </div>
      )}

      {!readOnly && (
        <div className="mt-4 space-y-3">
          <button
            onClick={handleApply}
            data-tutorial-id="input-save-btn"
            disabled={selectedCells.size === 0}
            className={`
              w-full py-2 px-4 rounded-xl font-medium transition-colors duration-200
              ${selectedCells.size === 0
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : (sequentialActive || sequentialInfoActive)
                  ? 'bg-teal-600 text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }
            `}
          >
            {(sequentialActive || sequentialInfoActive) ? 'Apply Sequential Fill' : 'Apply to Selected Cells'}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onCross}
              data-tutorial-id="input-cross-btn"
              disabled={!hasNonEmptyCells}
              className={`
                py-2 px-4 rounded-xl font-medium transition-colors duration-200 flex items-center justify-center gap-2
                ${!hasNonEmptyCells
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-amber-500 text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2'
                }
              `}
            >
              <X size={16} />
              Cross
            </button>

            <button
              onClick={onClear}
              data-tutorial-id="input-clear-btn"
              disabled={!hasNonEmptyCells}
              className={`
                py-2 px-4 rounded-xl font-medium transition-colors duration-200 flex items-center justify-center gap-2
                ${!hasNonEmptyCells
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                }
              `}
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

export default InputSection;
