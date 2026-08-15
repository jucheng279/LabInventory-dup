import React from 'react';
import { ChevronDown, ChevronRight, Video as LucideIcon } from 'lucide-react';

interface SidebarSectionProps {
  icon: LucideIcon;
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  activeColor?: string;
  children: React.ReactNode;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({
  icon: Icon,
  title,
  isExpanded,
  onToggle,
  activeColor = 'text-blue-600',
  children,
}) => {
  return (
    <div className="select-none">
      <button
        onClick={onToggle}
        className={`
          group w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg
          transition-all duration-200 border
          ${
            isExpanded
              ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-100'
              : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-100'
          }
        `}
      >
        <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
          <Icon
            className={`h-5 w-5 transition-colors duration-200 ${
              isExpanded ? activeColor : 'text-gray-500 group-hover:text-gray-700'
            }`}
            strokeWidth={2}
          />
        </div>
        <span
          className={`flex-1 text-left text-sm font-semibold tracking-tight ${
            isExpanded ? 'text-blue-900' : 'text-gray-800'
          }`}
        >
          {title}
        </span>
        <div
          className="flex-shrink-0 transition-transform duration-200 text-black"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      <div
        className={`
          overflow-hidden transition-all duration-300 ease-out
          ${isExpanded ? 'max-h-[4000px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}
        `}
      >
        <div className="pl-1">{children}</div>
      </div>
    </div>
  );
};

export default SidebarSection;
