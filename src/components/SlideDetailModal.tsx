import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Microscope, Upload, Loader as Loader2, Pencil, Save, Download, Trash2, Lock } from 'lucide-react';
import Portal from './Portal';
import ImageLightbox from './ImageLightbox';
import DateFields from './DateFields';
import { CellData, locationCellService } from '../services/locationCellService';
import { SlideBoxHeader } from '../services/slideBoxHeaderService';
import { SlideValuesMap } from '../services/slideCellValueService';
import { slideImageService } from '../services/slideImageService';
import { isTiffPath, decodeTiffToDataUrl } from '../utils/tiffUtils';
import { parsePartialDate, buildDateString } from '../utils/dateFilterUtils';

interface SlideDetailModalProps {
  cellId: string;
  boxId: string;
  boxName: string;
  accentColor: string;
  cellData: CellData;
  slideValues: SlideValuesMap;
  sortedHeaders: SlideBoxHeader[];
  onClose: () => void;
  onSave: (
    cellId: string,
    headerValues: Array<{ headerId: string; value: string }>,
    color: string | null
  ) => Promise<void>;
  onImageUpdated: () => void;
}

const DetailDateInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
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
    <div className="mt-1">
      <DateFields
        year={year}
        month={month}
        day={day}
        onYearChange={handleYearChange}
        onMonthChange={(v) => { setMonth(v); commit(year, v, day); }}
        onDayChange={(v) => { setDay(v); commit(year, month, v); }}
      />
    </div>
  );
};

const MODAL_ACCENT = '#3b82f6';

const SlideDetailModal: React.FC<SlideDetailModalProps> = ({
  cellId,
  boxId,
  cellData,
  slideValues,
  sortedHeaders,
  onClose,
  onSave,
  onImageUpdated,
}) => {
  const values = slideValues[cellId] || {};
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(cellData.slide_image_url || null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isDecodingTiff, setIsDecodingTiff] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const autoResizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (!imagePath) {
      setImageUrl(null);
      return;
    }

    setIsPortrait(false);

    if (isTiffPath(imagePath)) {
      setIsDecodingTiff(true);
      const publicUrl = slideImageService.getPublicUrl(imagePath);
      decodeTiffToDataUrl(publicUrl)
        .then((dataUrl) => setImageUrl(dataUrl))
        .catch(() => setImageUrl(publicUrl))
        .finally(() => setIsDecodingTiff(false));
    } else {
      setImageUrl(slideImageService.getPublicUrl(imagePath));
    }
  }, [imagePath]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleStartEdit = useCallback(() => {
    const initial: Record<number, string> = {};
    sortedHeaders.forEach((h) => {
      initial[h.display_order] = values[h.display_order] || '';
    });
    setEditValues(initial);
    setIsEditing(true);
  }, [sortedHeaders, values]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValues({});
  }, []);

  const handleSaveEdit = useCallback(async () => {
    setIsSaving(true);
    try {
      const headerValues = sortedHeaders.map((h) => ({
        headerId: h.id,
        value: editValues[h.display_order] || '',
      }));
      await onSave(cellId, headerValues, cellData.color || null);
      setIsEditing(false);
      setEditValues({});
    } catch (error) {
      console.error('Failed to save slide details:', error);
    } finally {
      setIsSaving(false);
    }
  }, [cellId, sortedHeaders, editValues, cellData.color, onSave]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      return;
    }

    setIsUploading(true);
    try {
      if (imagePath) {
        try { await slideImageService.deleteImage(imagePath); } catch { /* ignore */ }
      }

      const newPath = await slideImageService.uploadImage(boxId, cellId, file);
      await locationCellService.updateSlideImageUrl(boxId, cellId, newPath);
      setImagePath(newPath);
      onImageUpdated();
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [boxId, cellId, imagePath, onImageUpdated]);

  const handleRemoveImage = useCallback(async () => {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      removeTimerRef.current = setTimeout(() => setConfirmingRemove(false), 3000);
      return;
    }
    if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    setConfirmingRemove(false);
    setIsRemoving(true);
    try {
      if (imagePath) {
        try { await slideImageService.deleteImage(imagePath); } catch { /* ignore */ }
      }
      await locationCellService.updateSlideImageUrl(boxId, cellId, null);
      setImagePath(null);
      setImageUrl(null);
      onImageUpdated();
    } catch (error) {
      console.error('Failed to remove image:', error);
    } finally {
      setIsRemoving(false);
    }
  }, [boxId, cellId, imagePath, confirmingRemove, onImageUpdated]);

  useEffect(() => {
    return () => {
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };
  }, []);

  const handleDownloadImage = useCallback(async () => {
    if (!imagePath) return;
    const publicUrl = slideImageService.getPublicUrl(imagePath);
    try {
      const response = await fetch(publicUrl);
      const blob = await response.blob();
      const ext = imagePath.split('.').pop() || 'jpg';
      const filename = `slide-${cellId}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  }, [imagePath, cellId]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !showLightbox) onClose();
  }, [onClose, showLightbox]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${MODAL_ACCENT}15` }}
              >
                <Microscope size={20} style={{ color: MODAL_ACCENT }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{cellId}</h2>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Slide Details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* IMAGE_UPLOAD_DISABLED_START */}
            <div className="w-full h-24 border border-gray-200 rounded-xl bg-gray-50 flex items-center justify-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-200/70 flex items-center justify-center">
                <Lock size={15} className="text-gray-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-400 block">Image upload temporarily disabled</span>
                <span className="text-[11px] text-gray-300">This feature is currently unavailable</span>
              </div>
            </div>
            {/* IMAGE_UPLOAD_DISABLED_END */}

            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                {sortedHeaders.map((header) => (
                  <div key={header.id}>
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: MODAL_ACCENT }}>
                      {header.header_text || `Header ${header.display_order + 1}`}
                    </span>
                    {isEditing ? (
                      header.header_type === 'preset' ? (
                        <select
                          value={editValues[header.display_order] || ''}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [header.display_order]: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white transition-shadow text-sm"
                          style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                        >
                          <option value="">—</option>
                          {(header.preset_options || []).map((opt) => (
                            <option key={opt.id} value={opt.option_label}>{opt.option_label}</option>
                          ))}
                        </select>
                      ) :
                      (header.header_type === 'date' || header.header_type === 'expiration') ? (
                        <DetailDateInput
                          value={editValues[header.display_order] || ''}
                          onChange={(v) => setEditValues((prev) => ({ ...prev, [header.display_order]: v }))}
                        />
                      ) : (
                        <textarea
                          ref={autoResizeTextarea}
                          value={editValues[header.display_order] || ''}
                          onChange={(e) => {
                            setEditValues((prev) => ({
                              ...prev,
                              [header.display_order]: e.target.value,
                            }));
                            autoResizeTextarea(e.target);
                          }}
                          rows={1}
                          className="mt-1 w-full text-base text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none overflow-hidden break-words"
                        />
                      )
                    ) : (
                      <p className="mt-1 text-base text-gray-900 whitespace-pre-wrap break-words">
                        {values[header.display_order] || <span className="text-gray-300 italic">--</span>}
                      </p>
                    )}
                    <div className="mt-2 h-px bg-gray-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-5 py-2.5 text-sm font-medium text-white rounded-xl flex items-center gap-2 transition-colors"
                  style={{ backgroundColor: MODAL_ACCENT }}
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleStartEdit}
                  className="px-5 py-2.5 text-sm font-medium text-white rounded-xl flex items-center gap-2 transition-colors"
                  style={{ backgroundColor: MODAL_ACCENT }}
                >
                  <Pencil size={16} />
                  Edit Record
                </button>
              </>
            )}
          </div>
        </div>
      </div>

    </Portal>
  );
};

export default SlideDetailModal;
