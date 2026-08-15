import React from 'react';
import { Boxes, FlaskConical } from 'lucide-react';
import type { ItemType } from '../types/database';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

const AntibodyIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Heavy chains (Fab arms and Fc stems) */}
    <path d="M10 12L4 3" />
    <path d="M14 12L20 3" />
    <path d="M10 12V22" />
    <path d="M14 12V22" />

    {/* Light chains (parallel to Fab arms) */}
    <path d="M6 12L2 6" />
    <path d="M18 12L22 6" />
  </svg>
);

const CellIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill={color}
    stroke="none"
    className={className}
  >
    <path d="M32,61A29,29,0,1,1,61,32,29,29,0,0,1,32,61ZM32,5A27,27,0,1,0,59,32,27,27,0,0,0,32,5Z" />
    <path d="M32,56A24,24,0,1,1,56,32,24,24,0,0,1,32,56Zm0-46A22,22,0,1,0,54,32,22,22,0,0,0,32,10Z" />
    <path d="M32 43A11 11 0 1 1 43 32 11 11 0 0 1 32 43zm0-20a9 9 0 1 0 9 9A9 9 0 0 0 32 23zM17.2 41a2.87 2.87 0 0 1-2.65-1.77 17.69 17.69 0 0 1 0-14.46 2.86 2.86 0 0 1 5-.57 2.84 2.84 0 0 1 .37 2.6 15.59 15.59 0 0 0 0 10.4A2.86 2.86 0 0 1 17.2 41zm0-16a.92.92 0 0 0-.82.55 15.69 15.69 0 0 0 0 12.9h0a.9.9 0 0 0 1.51.19.81.81 0 0 0 .11-.78 17.46 17.46 0 0 1 0-11.72.81.81 0 0 0-.11-.78A.83.83 0 0 0 17.2 25zM39.59 48.9a2.8 2.8 0 0 1-1.12-5.38A8.28 8.28 0 0 0 43 39.06a2.79 2.79 0 0 1 4.55-.8A2.83 2.83 0 0 1 48.26 41h0a10.68 10.68 0 0 1-7.92 7.76A3.22 3.22 0 0 1 39.59 48.9zm6-9.48h-.14a.76.76 0 0 0-.57.44 10.3 10.3 0 0 1-5.62 5.5A.79.79 0 0 0 39 46.66a.84.84 0 0 0 .81.21 8.7 8.7 0 0 0 6.52-6.39.84.84 0 0 0-.19-.82A.78.78 0 0 0 45.57 39.42zm1.73 1.34h0zM46.4 27.33l-.39 0a2.91 2.91 0 0 1-2.18-1.55 11.54 11.54 0 0 0-6.1-5.61 2.89 2.89 0 0 1-1.73-2 2.77 2.77 0 0 1 .67-2.52 2.92 2.92 0 0 1 2.94-.79A14 14 0 0 1 49 23.43a2.89 2.89 0 0 1-.54 3A2.79 2.79 0 0 1 46.4 27.33zM38.77 16.68a.81.81 0 0 0-.62.27.75.75 0 0 0-.2.72.88.88 0 0 0 .54.63 13.66 13.66 0 0 1 7.12 6.54.84.84 0 0 0 .67.48.79.79 0 0 0 .7-.25.88.88 0 0 0 .16-.91A11.88 11.88 0 0 0 39 16.72h0A.75.75 0 0 0 38.77 16.68zM26 51a4 4 0 1 1 4-4A4 4 0 0 1 26 51zm0-6a2 2 0 1 0 2 2A2 2 0 0 0 26 45zM26 20a3 3 0 1 1 3-3A3 3 0 0 1 26 20zm0-4a1 1 0 1 0 1 1A1 1 0 0 0 26 16zM48 35a3 3 0 1 1 3-3A3 3 0 0 1 48 35zm0-4a1 1 0 1 0 1 1A1 1 0 0 0 48 31z" />
  </svg>
);

const MediumBottleIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M9 6V8C7 9 5 11 5 14V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V14C19 11 17 9 15 8V6" />
    <path d="M8 13H16" />
    <path d="M7 17H17" />
  </svg>
);

export const getItemTypeIcon = (
  type: ItemType,
  size: number = 24,
  color?: string
): React.ReactElement => {
  const props: IconProps = { size, className: 'transition-transform duration-300' };
  if (color) props.color = color;

  switch (type) {
    case 'Antibody':
      return <AntibodyIcon {...props} />;
    case 'Cell':
      return <CellIcon {...props} />;
    case 'Medium':
      return <MediumBottleIcon {...props} />;
    case 'Kits':
      return <Boxes {...props} />;
    case 'Chemicals':
      return <FlaskConical {...props} />;
    default:
      return <FlaskConical {...props} />;
  }
};

export const getItemTypeLabel = (type: ItemType): string => {
  return type;
};
