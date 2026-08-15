import React from 'react';
import { EllipsisVertical, Pencil, Trash2, ArrowRightLeft, Copy, Database, Lock, FolderKanban } from 'lucide-react';
import { LocationBoxWithStats } from '../services/boxService';
import type { BoxAccessLevel } from '../types/database';
import SvgIcon from './SvgIcon';
import Portal from './Portal';

interface BoxCardProps {
  box: LocationBoxWithStats;
  onOpen: (boxId: string) => void;
  onEdit: (box: LocationBoxWithStats) => void;
  onDelete: (box: LocationBoxWithStats) => void;
  onMove: (box: LocationBoxWithStats) => void;
  onDuplicate: (box: LocationBoxWithStats) => void;
  onDuplicateWithData: (box: LocationBoxWithStats) => void;
  isExiting?: boolean;
  accessLevel?: BoxAccessLevel;
  onAddToProject?: (box: LocationBoxWithStats) => void;
}

const BoxCard: React.FC<BoxCardProps> = ({ box, onOpen, onEdit, onDelete, onMove, onDuplicate, onDuplicateWithData, isExiting = false, accessLevel = 'open', onAddToProject }) => {
  const canEnter = accessLevel !== 'none';
  const canEdit = accessLevel === 'owner' || accessLevel === 'edit' || accessLevel === 'open';
  const canDelete = accessLevel === 'owner' || accessLevel === 'open' || accessLevel === 'edit';
  const [showMenu, setShowMenu] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({ top: 0, right: 0 });
  const menuRef = React.useRef<HTMLDivElement>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        btnRef.current && !btnRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    const handleDismiss = () => setShowMenu(false);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [showMenu]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showMenu) {
      setShowMenu(false);
      return;
    }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setShowMenu(true);
  };

  const getAccentBorder = () => {
    if (box.accent_color) {
      return box.accent_color;
    }
    return '#3b82f6';
  };



  return (
    <div
      data-tutorial-id={box.id.startsWith('tutorial-') ? 'workspace-box-card-tutorial' : undefined}
      className={`group relative bg-white rounded-xl overflow-hidden transition-all duration-300 h-[150px] shadow-sm ${
        isExiting
          ? 'animate-card-exit pointer-events-none'
          : canEnter
            ? 'cursor-pointer hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-0.5'
            : 'cursor-default opacity-75'
      }`}
      onClick={() => !isExiting && canEnter && onOpen(box.id)}
    >
      <div
        className="absolute top-0 left-0 w-0.5 h-full transition-all duration-300 group-hover:w-1"
        style={{ backgroundColor: getAccentBorder() }}
      />

      <div className="absolute top-2 right-2 z-10">
        {accessLevel === 'none' ? (
          <div className="p-1 rounded-md bg-white/80 backdrop-blur-sm border border-gray-200/50">
            <Lock size={14} className="text-gray-400" />
          </div>
        ) : canEdit ? (
          <button
            ref={btnRef}
            onClick={openMenu}
            className="p-1 rounded-md bg-white/80 backdrop-blur-sm border border-gray-200/50 opacity-0 group-hover:opacity-100 touch-visible transition-all duration-200 hover:bg-gray-100"
          >
            <EllipsisVertical size={14} className="text-gray-500" />
          </button>
        ) : null}
      </div>

      {showMenu && (
        <Portal>
          <div
            ref={menuRef}
            className="fixed w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[9999]"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onEdit(box);
              }}
              className="w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onMove(box);
              }}
              className="w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ArrowRightLeft size={12} />
              Move
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDuplicate(box);
              }}
              className="w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Copy size={12} />
              Duplicate
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDuplicateWithData(box);
              }}
              className="w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Database size={12} />
              Duplicate (data)
            </button>
            {onAddToProject && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onAddToProject(box);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
              >
                <FolderKanban size={12} />
                Add to Project
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDelete(box);
              }}
              className="w-full px-2.5 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </Portal>
      )}

      <div className="p-3">
        <div className="flex items-start gap-3">
          <div
            className="relative flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{
              background: `linear-gradient(135deg, ${getAccentBorder()}20 0%, ${getAccentBorder()}40 100%)`,
            }}
          >
            <SvgIcon iconId={box.icon_id} size={32} color={getAccentBorder()} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate text-sm leading-tight">
              {box.name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {box.rows} × {box.columns}
            </p>
            {box.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                {box.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-500">Storage</span>
            <span className="font-medium text-gray-700">
              {box.occupiedCells} / {box.totalCells}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${box.utilizationPercent}%`, backgroundColor: getAccentBorder() }}
            />
          </div>
          <div className="mt-1.5">
            <span className="text-xs text-gray-400">
              {box.totalCells - box.occupiedCells} available
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoxCard;
