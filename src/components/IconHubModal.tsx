import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import {
  getAllCategories,
  getSubcategories,
  getIconsBySubcategory,
  getSubcategoryLabel,
  type IconCategory,
  type IconSubcategory,
  type IconEntry,
} from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import Portal from './Portal';

interface IconHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconId: string) => void;
  defaultCategory?: IconCategory;
  defaultSubcategory?: IconSubcategory;
  selectedIconId?: string | null;
}

const CATEGORY_COLORS: Record<IconCategory, { activeBg: string; text: string; border: string; ring: string }> = {
  Location: { activeBg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', ring: 'ring-blue-200' },
  Biology: { activeBg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-200' },
  Material: { activeBg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', ring: 'ring-amber-200' },
  Folder: { activeBg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', ring: 'ring-slate-200' },
};

const CATEGORY_ICONS: Record<IconCategory, string> = {
  Location: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
  Biology: 'M12 2a4 4 0 014 4v1h1a3 3 0 013 3v1a3 3 0 01-3 3h-1v1a4 4 0 01-8 0v-1H7a3 3 0 01-3-3v-1a3 3 0 013-3h1V6a4 4 0 014-4z',
  Material: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  Folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
};

const IconHubModal: React.FC<IconHubModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  defaultCategory,
  defaultSubcategory,
  selectedIconId,
}) => {
  const categories = useMemo(() => getAllCategories(), []);

  const initialCategory = defaultCategory && categories.includes(defaultCategory)
    ? defaultCategory
    : categories[0];

  const [activeCategory, setActiveCategory] = useState<IconCategory>(initialCategory);
  const [activeSubcategory, setActiveSubcategory] = useState<IconSubcategory>(() => {
    const subs = getSubcategories(initialCategory);
    if (defaultSubcategory && subs.includes(defaultSubcategory)) return defaultSubcategory;
    return subs[0];
  });

  useEffect(() => {
    if (isOpen) {
      const cat = defaultCategory && categories.includes(defaultCategory)
        ? defaultCategory
        : categories[0];
      setActiveCategory(cat);
      const subs = getSubcategories(cat);
      if (defaultSubcategory && subs.includes(defaultSubcategory)) {
        setActiveSubcategory(defaultSubcategory);
      } else {
        setActiveSubcategory(subs[0]);
      }
    }
  }, [isOpen, defaultCategory, defaultSubcategory, categories]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const subcategories = getSubcategories(activeCategory);
  const icons: IconEntry[] = activeSubcategory
    ? getIconsBySubcategory(activeCategory, activeSubcategory)
    : [];
  const colors = CATEGORY_COLORS[activeCategory];

  const handleCategoryChange = (cat: IconCategory) => {
    setActiveCategory(cat);
    const subs = getSubcategories(cat);
    setActiveSubcategory(subs[0]);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-scale-in">
          <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Icon Library</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="flex-shrink-0 px-5">
            <div className="flex gap-1.5">
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                const catColors = CATEGORY_COLORS[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`flex items-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? `${catColors.activeBg} ${catColors.text} ${catColors.border} border shadow-sm`
                        : 'bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600 border border-transparent'
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3.5 h-3.5"
                    >
                      <path d={CATEGORY_ICONS[cat]} />
                    </svg>
                    {cat}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1 mt-2 pb-1 flex-wrap">
              {subcategories.map((sub) => {
                const isActive = activeSubcategory === sub;
                return (
                  <button
                    key={sub}
                    onClick={() => setActiveSubcategory(sub)}
                    className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? `${colors.activeBg} ${colors.text}`
                        : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}
                  >
                    {getSubcategoryLabel(sub)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mx-5 border-b border-gray-100" />

          <div className="h-[14rem] overflow-y-auto p-5">
            <div className="grid grid-cols-5 gap-3">
              {icons.map((icon) => {
                const isSelected = selectedIconId === icon.id;
                return (
                  <button
                    key={icon.id}
                    onClick={() => {
                      onSelect(icon.id);
                      onClose();
                    }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-400 bg-blue-50 shadow-sm scale-105'
                        : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm'
                    }`}
                  >
                    <SvgIcon iconId={icon.id} size={32} forceColorful />
                    <span className={`text-[10px] font-medium leading-tight text-center truncate w-full ${
                      isSelected ? 'text-blue-700' : 'text-gray-500'
                    }`}>
                      {icon.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {icons.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                No icons in this category
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default IconHubModal;
