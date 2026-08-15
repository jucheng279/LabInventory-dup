import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, ChevronLeft, ChevronRight, Calendar, CalendarClock, Type, GripVertical, Shield, List } from 'lucide-react';
import { CreateBoxData } from '../services/boxService';
import type { HeaderInput } from '../services/slideBoxHeaderService';
import type { SlideHeaderType, TeamMember } from '../types/database';
import { getGridPresetIcons, getDefaultHubConfig, getDefaultIconForContext } from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import IconPresetRow from './IconPresetRow';
import ModalFrame from './ModalFrame';
import BoxPrivacySettingsModal, { PrivacyFormState } from './BoxPrivacySettingsModal';
import { ACCENT_COLORS } from '../constants/accentColors';

interface CreateSlideBoxModalProps {
  onClose: () => void;
  onCreate: (data: Omit<CreateBoxData, 'location_id'>, headers: HeaderInput[], privacySettings?: PrivacyFormState) => void;
  teamMembers?: TeamMember[];
  currentTeamMemberId?: string;
  workspaceOwnerId?: string;
}

const COLUMN_OPTIONS = [1, 2, 3];

interface HeaderEntry {
  name: string;
  type: SlideHeaderType;
  presetOptions: string[];
}

const DEFAULT_HEADERS: HeaderEntry[] = [
  { name: '', type: 'text', presetOptions: [] },
  { name: '', type: 'text', presetOptions: [] },
  { name: '', type: 'text', presetOptions: [] },
  { name: '', type: 'text', presetOptions: [] },
];

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

const CreateSlideBoxModal: React.FC<CreateSlideBoxModalProps> = ({ onClose, onCreate, teamMembers, currentTeamMemberId, workspaceOwnerId }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accentColor, setAccentColor] = useState<string | null>('#3b82f6');
  const [rows, setRows] = useState('');
  const [columns, setColumns] = useState('2');
  const [iconId, setIconId] = useState<string | null>(getDefaultIconForContext('box'));
  const [headers, setHeaders] = useState<HeaderEntry[]>([...DEFAULT_HEADERS]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacyFormState | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const headerEndRef = useRef<HTMLDivElement>(null);

  const boxPresets = getGridPresetIcons('box', 4);
  const hubConfig = getDefaultHubConfig('box');

  useEffect(() => {
    if (step === 1) {
      nameInputRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const isValidRows = () => {
    const num = parseInt(rows);
    return !isNaN(num) && num >= 1 && num <= 80;
  };

  const isStep1Valid = name.trim() && isValidRows() && columns !== '';

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

  const handleSubmit = async () => {
    if (!isStep1Valid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const finalHeaders: HeaderInput[] = headers.map((h, i) => ({
        name: h.name.trim() || getPlaceholder(h, i),
        type: h.type,
        presetOptions: h.type === 'preset' ? h.presetOptions : undefined,
      }));

      await onCreate(
        {
          name: name.trim(),
          description: description.trim(),
          accent_color: accentColor,
          rows: parseInt(rows),
          columns: parseInt(columns),
          box_type: 'slide',
          icon_id: iconId,
        },
        finalHeaders,
        privacySettings || undefined,
      );
    } finally {
      setIsSubmitting(false);
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
            <h2 className="text-lg font-semibold text-gray-900">Create Slide Box</h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {teamMembers && currentTeamMemberId && (
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              className={`p-2 rounded-lg transition-colors ${
                privacySettings?.privacyMode === 'restricted'
                  ? 'bg-amber-50 hover:bg-amber-100'
                  : 'hover:bg-gray-100'
              }`}
              title={privacySettings?.privacyMode === 'restricted' ? 'Restricted Access' : 'Open Access'}
            >
              <Shield size={18} className={privacySettings?.privacyMode === 'restricted' ? 'text-amber-500' : 'text-gray-400'} />
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
                <label htmlFor="slideBoxName" className="block text-sm font-medium text-gray-700 mb-1">
                  Box Name
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  id="slideBoxName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  required
                />
              </div>

              <div>
                <label htmlFor="slideBoxDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="slideBoxDescription"
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
                    <label htmlFor="slideBoxRows" className="block text-xs text-gray-500 mb-1">
                      Rows
                    </label>
                    <input
                      type="number"
                      id="slideBoxRows"
                      value={rows}
                      onChange={(e) => setRows(e.target.value)}
                      min={1}
                      max={80}
                      placeholder="1-80"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-center"
                    />
                  </div>
                  <span className="text-gray-400 mt-5">x</span>
                  <div className="flex-1">
                    <label htmlFor="slideBoxColumns" className="block text-xs text-gray-500 mb-1">
                      Columns
                    </label>
                    <select
                      id="slideBoxColumns"
                      value={columns}
                      onChange={(e) => setColumns(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-center appearance-none bg-white"
                    >
                      {COLUMN_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
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
                  Column Headers
                </label>

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
                        <div className="ml-[calc(1rem+2px+1.5rem)] mr-[calc(14px+6px+14px)] mb-1 p-2 bg-gray-50 rounded-lg">
                          <div className="flex flex-wrap gap-1 mb-2">
                            {header.presetOptions.map((opt, optIdx) => (
                              <span
                                key={optIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full"
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
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="Add option..."
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
                                const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                handleAddPresetOption(index, input.value);
                                input.value = '';
                              }}
                              className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
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
              </div>

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
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
                    isSubmitting
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20'
                  }`}
                >
                  {isSubmitting ? 'Creating...' : 'Create Box'}
                </button>
              </div>
            </div>
          )}

        {showPrivacy && teamMembers && currentTeamMemberId && (
          <BoxPrivacySettingsModal
            onClose={() => setShowPrivacy(false)}
            onSave={setPrivacySettings}
            teamMembers={teamMembers}
            currentTeamMemberId={currentTeamMemberId}
            workspaceOwnerId={workspaceOwnerId}
            initialSettings={privacySettings}
          />
        )}
    </ModalFrame>
  );
};

export default CreateSlideBoxModal;
