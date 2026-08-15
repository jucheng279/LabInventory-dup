import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Plus, Trash2, ChevronLeft, ChevronRight, TriangleAlert as AlertTriangle, Loader as Loader2, Undo2, Calendar, CalendarClock, Type, GripVertical, Shield, QrCode, List } from 'lucide-react';
import { LocationBoxWithStats, UpdateBoxData } from '../services/boxService';
import { slideBoxHeaderService, SlideBoxHeader } from '../services/slideBoxHeaderService';
import type { HeaderInput } from '../services/slideBoxHeaderService';
import type { SlideHeaderType, TeamMember } from '../types/database';
import { getGridPresetIcons, getDefaultHubConfig, getDefaultIconForContext } from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import IconPresetRow from './IconPresetRow';
import ModalFrame from './ModalFrame';
import BoxPrivacySettingsModal, { PrivacyFormState, boxPrivacyDataToFormState } from './BoxPrivacySettingsModal';
import BoxQRCodeModal from './BoxQRCodeModal';
import { useBoxPrivacy } from '../hooks/useBoxPrivacy';
import { ACCENT_COLORS } from '../constants/accentColors';

interface EditStructuredFreezerBoxModalProps {
  box: LocationBoxWithStats;
  onClose: () => void;
  onUpdate: (boxId: string, data: UpdateBoxData, headers: HeaderInput[], headersChanged: boolean, privacySettings?: PrivacyFormState) => void | Promise<void>;
  teamMembers?: TeamMember[];
  currentTeamMemberId?: string;
  workspaceOwnerId?: string;
  workspaceId?: string;
}

interface HeaderEntry {
  name: string;
  type: SlideHeaderType;
  presetOptions: string[];
}

function getPlaceholder(h: HeaderEntry, index: number): string {
  if (h.type === 'date') return 'Date';
  if (h.type === 'expiration') return 'Expiration';
  if (h.type === 'preset') return 'Preset';
  return `Header ${index + 1}`;
}

function headerTypeIcon(type: SlideHeaderType) {
  if (type === 'date') return { icon: Calendar, bg: 'bg-blue-100', text: 'text-blue-700' };
  if (type === 'expiration') return { icon: CalendarClock, bg: 'bg-orange-100', text: 'text-orange-700' };
  if (type === 'preset') return { icon: List, bg: 'bg-gray-100', text: 'text-gray-600' };
  return { icon: Type, bg: 'bg-gray-100', text: 'text-gray-600' };
}

const EditStructuredFreezerBoxModal: React.FC<EditStructuredFreezerBoxModalProps> = ({ box, onClose, onUpdate, teamMembers, currentTeamMemberId, workspaceOwnerId, workspaceId }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(box.name);
  const [description, setDescription] = useState(box.description || '');
  const [accentColor, setAccentColor] = useState<string | null>(box.accent_color || '#3b82f6');
  const [iconId, setIconId] = useState<string | null>(box.icon_id || getDefaultIconForContext('box'));
  const [rows, setRows] = useState(String(box.rows));
  const [columns, setColumns] = useState(String(box.columns));
  const [headers, setHeaders] = useState<HeaderEntry[]>([]);
  const [initialHeaders, setInitialHeaders] = useState<HeaderEntry[]>([]);
  const [isLoadingHeaders, setIsLoadingHeaders] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacyFormState | null>(null);
  const [privacyChanged, setPrivacyChanged] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const headerEndRef = useRef<HTMLDivElement>(null);

  const { data: existingPrivacy, isFetched: privacyFetched } = useBoxPrivacy(box.id);

  useEffect(() => {
    if (existingPrivacy && !privacySettings) {
      setPrivacySettings(boxPrivacyDataToFormState(existingPrivacy.settings, existingPrivacy.accessList));
    }
  }, [existingPrivacy, privacySettings]);

  const boxPresets = getGridPresetIcons('box', 4);
  const hubConfig = getDefaultHubConfig('box');

  const rowsNum = parseInt(rows) || 0;
  const columnsNum = parseInt(columns) || 0;

  const isShrinking = useMemo(() => {
    return rowsNum < box.rows || columnsNum < box.columns;
  }, [rowsNum, columnsNum, box.rows, box.columns]);

  useEffect(() => {
    if (step === 1) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await slideBoxHeaderService.getHeaders(box.id);
        if (cancelled) return;
        const entries: HeaderEntry[] = data.map((h: SlideBoxHeader) => ({
          name: h.header_text,
          type: h.header_type || 'text',
          presetOptions: h.preset_options?.map(o => o.option_label) || [],
        }));
        const result = entries.length > 0 ? entries : [{ name: '', type: 'text' as SlideHeaderType, presetOptions: [] }];
        setHeaders(result);
        setInitialHeaders(result);
      } catch {
        if (!cancelled) {
          const fallback = [{ name: '', type: 'text' as SlideHeaderType, presetOptions: [] as string[] }];
          setHeaders(fallback);
          setInitialHeaders(fallback);
        }
      } finally {
        if (!cancelled) setIsLoadingHeaders(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [box.id]);

  const isValidDimension = (value: string) => {
    const num = parseInt(value);
    return !isNaN(num) && num >= 1 && num <= 20;
  };

  const isStep1Valid = name.trim() && isValidDimension(rows) && isValidDimension(columns);

  const hasBoxChanges =
    name.trim() !== box.name ||
    description.trim() !== (box.description || '') ||
    accentColor !== (box.accent_color || '#3b82f6') ||
    (iconId || null) !== (box.icon_id || null) ||
    rowsNum !== box.rows ||
    columnsNum !== box.columns;

  const hasHeaderChanges = useMemo(() => {
    if (headers.length !== initialHeaders.length) return true;
    return headers.some((h, i) => {
      if (h.name !== initialHeaders[i].name || h.type !== initialHeaders[i].type) return true;
      if (h.presetOptions.length !== initialHeaders[i].presetOptions.length) return true;
      return h.presetOptions.some((opt, oi) => opt !== initialHeaders[i].presetOptions[oi]);
    });
  }, [headers, initialHeaders]);

  const hasChanges = hasBoxChanges || hasHeaderChanges || privacyChanged;

  const removedHeaders = useMemo(() => {
    if (headers.length >= initialHeaders.length) return [];
    return initialHeaders.slice(headers.length);
  }, [headers.length, initialHeaders]);

  const hasRemovedHeaders = removedHeaders.length > 0;

  const hasExpiration = headers.some(h => h.type === 'expiration');

  const handleAddHeader = (type: SlideHeaderType = 'text') => {
    if (type === 'expiration' && headers.some(h => h.type === 'expiration')) return;
    setHeaders((prev) => [...prev, { name: '', type, presetOptions: [] }]);
    requestAnimationFrame(() => {
      headerEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const handleRemoveHeader = (index: number) => {
    if (headers.length <= 1) return;
    setShowDeleteConfirm(false);
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  };

  const handleHeaderNameChange = (index: number, value: string) => {
    setHeaders((prev) => prev.map((h, i) => (i === index ? { ...h, name: value } : h)));
  };

  const handleAddPresetOption = (headerIndex: number, optionLabel: string) => {
    const trimmed = optionLabel.trim();
    if (!trimmed) return;
    setHeaders((prev) =>
      prev.map((h, i) =>
        i === headerIndex
          ? { ...h, presetOptions: [...h.presetOptions, trimmed] }
          : h
      )
    );
  };

  const handleRemovePresetOption = (headerIndex: number, optionIndex: number) => {
    setHeaders((prev) =>
      prev.map((h, i) =>
        i === headerIndex
          ? { ...h, presetOptions: h.presetOptions.filter((_, oi) => oi !== optionIndex) }
          : h
      )
    );
  };

  const handleHeaderDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    if (e.currentTarget instanceof HTMLElement) {
      setTimeout(() => {
        (e.currentTarget as HTMLElement).style.opacity = '0.4';
      }, 0);
    }
  };

  const handleHeaderDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleHeaderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleHeaderDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragOverIndex(null);
      return;
    }
    setHeaders((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragOverIndex(null);
  };

  const handleSaveClick = () => {
    if (!isStep1Valid || !hasChanges || isSubmitting) return;
    if (hasRemovedHeaders && !showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (!isStep1Valid || !hasChanges || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const finalHeaders: HeaderInput[] = headers.map((h, i) => ({
        name: h.name.trim() || getPlaceholder(h, i),
        type: h.type,
        presetOptions: h.type === 'preset' ? h.presetOptions : undefined,
      }));

      await onUpdate(
        box.id,
        {
          name: name.trim(),
          description: description.trim(),
          accent_color: accentColor,
          icon_id: iconId,
          rows: parseInt(rows),
          columns: parseInt(columns),
        },
        finalHeaders,
        hasHeaderChanges,
        privacyChanged ? (privacySettings || undefined) : undefined,
      );
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <ModalFrame onClose={onClose} allowOverflow>
      <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <SvgIcon iconId={iconId} size={20} color={accentColor || '#3b82f6'} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Structured Freezer Box</h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {teamMembers && currentTeamMemberId && (
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              disabled={!privacyFetched}
              className={`p-2 rounded-lg transition-colors ${
                !privacyFetched
                  ? 'opacity-40 cursor-not-allowed'
                  : privacySettings?.privacyMode === 'restricted'
                    ? 'bg-amber-50 hover:bg-amber-100'
                    : 'hover:bg-gray-100'
              }`}
              title={!privacyFetched ? 'Loading...' : privacySettings?.privacyMode === 'restricted' ? 'Restricted Access' : 'Open Access'}
            >
              <Shield size={18} className={privacySettings?.privacyMode === 'restricted' ? 'text-amber-500' : 'text-gray-400'} />
            </button>
          )}
          {workspaceId && currentTeamMemberId && (currentTeamMemberId === workspaceOwnerId || privacySettings?.ownerId === currentTeamMemberId || (privacyFetched && !existingPrivacy)) && (
            <button
              type="button"
              onClick={() => setShowQR(true)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="QR Code"
            >
              <QrCode size={18} className="text-gray-400" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
      </div>

          {step === 1 ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              <div>
                <label htmlFor="editSfBoxName" className="block text-sm font-medium text-gray-700 mb-1">
                  Box Name
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  id="editSfBoxName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  required
                />
              </div>

              <div>
                <label htmlFor="editSfBoxDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="editSfBoxDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grid Dimensions
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label htmlFor="editSfBoxRows" className="block text-xs text-gray-500 mb-1">
                      Rows
                    </label>
                    <input
                      type="number"
                      id="editSfBoxRows"
                      value={rows}
                      onChange={(e) => setRows(e.target.value)}
                      min={1}
                      max={20}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-center"
                    />
                  </div>
                  <span className="text-gray-400 mt-5">x</span>
                  <div className="flex-1">
                    <label htmlFor="editSfBoxColumns" className="block text-xs text-gray-500 mb-1">
                      Columns
                    </label>
                    <input
                      type="number"
                      id="editSfBoxColumns"
                      value={columns}
                      onChange={(e) => setColumns(e.target.value)}
                      min={1}
                      max={20}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-center"
                    />
                  </div>
                </div>
                {isShrinking && isValidDimension(rows) && isValidDimension(columns) && (
                  <div className="mt-2 flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Reducing grid size will remove data from cells outside the new dimensions.
                    </p>
                  </div>
                )}
              </div>

              <IconPresetRow
                label="Box Type"
                presetIcons={boxPresets}
                selectedIconId={iconId}
                onSelect={setIconId}
                gridLayout="1x5"
                seeAllCategory={hubConfig.category}
                seeAllSubcategory={hubConfig.subcategory}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accent Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setAccentColor(color.value)}
                      className={`w-8 h-8 rounded-full transition-all duration-200 ${
                        accentColor === color.value
                          ? 'ring-2 ring-offset-2 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{
                        backgroundColor: color.value,
                        ringColor: color.value,
                      }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isStep1Valid}
                  onClick={() => setStep(2)}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all inline-flex items-center justify-center gap-1.5 ${
                    !isStep1Valid
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20'
                  }`}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Info Field Headers
                </label>

                {isLoadingHeaders ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {headers.map((header, index) => {
                        const typeInfo = headerTypeIcon(header.type);
                        const Icon = typeInfo.icon;
                        return (
                          <React.Fragment key={index}>
                          <div
                            draggable
                            onDragStart={(e) => handleHeaderDragStart(e, index)}
                            onDragEnd={handleHeaderDragEnd}
                            onDragOver={(e) => handleHeaderDragOver(e, index)}
                            onDragLeave={() => setDragOverIndex(null)}
                            onDrop={(e) => handleHeaderDrop(e, index)}
                            className={`flex items-center gap-1.5 rounded-lg transition-colors ${
                              dragOverIndex === index ? 'bg-blue-50 ring-1 ring-blue-300' : ''
                            }`}
                          >
                            <span className="text-xs text-gray-400 w-4 text-right flex-shrink-0">
                              {index + 1}
                            </span>
                            <span className={`p-1.5 rounded-md flex-shrink-0 ${typeInfo.bg} ${typeInfo.text}`}>
                              <Icon size={12} />
                            </span>
                            <input
                              type="text"
                              value={header.name}
                              onChange={(e) => handleHeaderNameChange(index, e.target.value)}
                              placeholder={getPlaceholder(header, index)}
                              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveHeader(index)}
                              disabled={headers.length <= 1}
                              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                                headers.length <= 1
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                              }`}
                            >
                              <Trash2 size={14} />
                            </button>
                            <GripVertical size={14} className="text-gray-300 cursor-grab flex-shrink-0" />
                          </div>
                          {header.type === 'preset' && (
                            <div className="ml-9 mb-1 p-2 bg-gray-50 rounded-lg">
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {header.presetOptions.map((opt, optIdx) => (
                                  <span
                                    key={optIdx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs"
                                  >
                                    {opt}
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePresetOption(index, optIdx)}
                                      className="text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                      <X size={10} />
                                    </button>
                                  </span>
                                ))}

                              </div>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Option label"
                                  className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const input = e.currentTarget;
                                      handleAddPresetOption(index, input.value);
                                      input.value = '';
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    const input = (e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement;
                                    if (input) {
                                      handleAddPresetOption(index, input.value);
                                      input.value = '';
                                      input.focus();
                                    }
                                  }}
                                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-200 transition-colors"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          )}
                          </React.Fragment>
                        );
                      })}
                      <div ref={headerEndRef} />
                    </div>

                    <div className="mt-3 flex gap-2">
                      <div className="flex items-center border-2 border-dashed border-gray-300 rounded-lg overflow-hidden hover:border-blue-400 transition-all shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAddHeader('text')}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50/50 transition-all border-r border-gray-300"
                        >
                          <Plus size={14} />
                          <Type size={14} />
                          Text
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddHeader('preset')}
                          className="flex items-center justify-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
                          title="Add preset dropdown"
                        >
                          <List size={14} />
                          Preset
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddHeader('date')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-blue-200 rounded-lg text-sm text-blue-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
                      >
                        <Plus size={14} />
                        <Calendar size={14} />
                        Date
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddHeader('expiration')}
                        disabled={hasExpiration}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-dashed rounded-lg text-sm transition-all ${hasExpiration ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-orange-200 text-orange-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/50'}`}
                        title={hasExpiration ? 'Only one expiration header allowed' : undefined}
                      >
                        <Plus size={14} />
                        <CalendarClock size={14} />
                        Expiry
                      </button>
                    </div>
                  </>
                )}
              </div>

              {hasRemovedHeaders && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-red-700">
                    <p>
                      All data under {removedHeaders.length === 1 ? 'this header' : 'these headers'} will be permanently deleted:{' '}
                      <span className="font-semibold">
                        {removedHeaders.map((h) => h.name || 'Untitled').join(', ')}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHeaders(initialHeaders);
                      setShowDeleteConfirm(false);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Undo2 size={12} />
                    Undo
                  </button>
                </div>
              )}

              {showDeleteConfirm ? (
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-medium text-red-700 text-center">
                    Are you sure? This cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2.5 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSubmit}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
                        isSubmitting
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20'
                      }`}
                    >
                      {isSubmitting ? 'Saving...' : 'Confirm & Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-2.5 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <ChevronLeft size={16} />
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!isStep1Valid || !hasChanges || isSubmitting || isLoadingHeaders}
                    onClick={handleSaveClick}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
                      !isStep1Valid || !hasChanges || isSubmitting || isLoadingHeaders
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20'
                    }`}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          )}

        {showPrivacy && teamMembers && currentTeamMemberId && (
          <BoxPrivacySettingsModal
            onClose={() => setShowPrivacy(false)}
            onSave={(settings) => {
              setPrivacySettings(settings);
              setPrivacyChanged(true);
            }}
            teamMembers={teamMembers}
            currentTeamMemberId={currentTeamMemberId}
            workspaceOwnerId={workspaceOwnerId}
            readOnly={!!privacySettings?.ownerId && privacySettings.ownerId !== currentTeamMemberId && currentTeamMemberId !== workspaceOwnerId}
            initialSettings={privacySettings}
          />
        )}

        {showQR && workspaceId && currentTeamMemberId && (
          <BoxQRCodeModal
            boxId={box.id}
            boxName={box.name}
            boxDescription={box.description || ''}
            boxRows={box.rows}
            boxColumns={box.columns}
            workspaceId={workspaceId}
            currentTeamMemberId={currentTeamMemberId}
            onClose={() => setShowQR(false)}
          />
        )}
    </ModalFrame>
  );
};

export default EditStructuredFreezerBoxModal;
