import React from 'react';
import { ChevronRight } from 'lucide-react';
import SvgIcon from './SvgIcon';
import { getLocationIconId } from '../config/locationTypes';

interface LocationCardProps {
  id: string;
  name: string;
  iconId?: string | null;
  accentColor?: string | null;
  locationType?: string | null;
  boxCount: number;
  folderCount: number;
  onClick: (id: string) => void;
}

const LocationCard: React.FC<LocationCardProps> = ({
  id,
  name,
  iconId,
  accentColor,
  locationType,
  boxCount,
  folderCount,
  onClick,
}) => {
  const color = accentColor || '#6b7280';
  const resolvedIconId = iconId || getLocationIconId(locationType);

  const parts: string[] = [];
  if (boxCount > 0) parts.push(`${boxCount} ${boxCount === 1 ? 'box' : 'boxes'}`);
  if (folderCount > 0) parts.push(`${folderCount} ${folderCount === 1 ? 'sheet' : 'sheets'}`);
  const subtitle = parts.length > 0 ? parts.join(', ') : 'Empty';

  return (
    <div
      className="group relative bg-white rounded-xl overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-0.5 h-[150px] shadow-sm"
      onClick={() => onClick(id)}
    >
      <div className="relative p-3 flex flex-col items-center text-center h-full justify-center gap-1">
        <div className="transition-transform duration-300 group-hover:scale-110">
          <SvgIcon iconId={resolvedIconId} size={52} color={color} />
        </div>

        <h3 className="font-bold text-gray-900 truncate text-base leading-tight w-full">
          {name}
        </h3>

        <p className="text-xs text-gray-400">{subtitle}</p>

        <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:right-1.5">
          <ChevronRight size={16} style={{ color }} />
        </div>
      </div>
    </div>
  );
};

export default LocationCard;
