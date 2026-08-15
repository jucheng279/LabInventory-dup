import React, { useEffect, useRef, useState } from 'react';
import type { CellData, SlideBoxHeader } from '../types/database';

interface StructuredCellContentProps {
  data: CellData | undefined;
  values: Record<number, string>;
  sortedHeaders: SlideBoxHeader[];
  nameFontDivisor: number;
  infoFontDivisor: number;
  initialCellWidth?: number;
}

const SPACING_DIVISOR = 15;

const DynamicNameText: React.FC<{ name: string; divisor: number; isCrossed?: boolean; initialCellWidth?: number }> = ({ name, divisor, isCrossed, initialCellWidth }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(() => initialCellWidth ? initialCellWidth / divisor : 12);

  useEffect(() => {
    const adjust = () => {
      if (!ref.current) return;
      const width = ref.current.offsetWidth;
      if (width === 0) return;
      setFontSize(width / divisor);
    };
    const ro = new ResizeObserver(adjust);
    if (ref.current) ro.observe(ref.current);
    adjust();
    return () => ro.disconnect();
  }, [name, divisor]);

  return (
    <div ref={ref} className={`flex-shrink-0 font-medium text-gray-900 overflow-hidden text-center ${isCrossed ? 'opacity-50' : ''}`}>
      {name.split('\n').map((line, i) => (
        <div
          key={i}
          className={`whitespace-nowrap overflow-hidden text-ellipsis ${isCrossed ? 'line-through' : ''}`}
          style={{ fontSize: `${fontSize}px` }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

interface SlotProps {
  value: string;
  divisor: number;
  isCrossed?: boolean;
  hasName: boolean;
  initialCellWidth?: number;
}

const StructuredSlot: React.FC<SlotProps> = ({ value, divisor, isCrossed, hasName, initialCellWidth }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(() => initialCellWidth ? initialCellWidth / divisor : 10);
  const [maxLines, setMaxLines] = useState(1);

  useEffect(() => {
    const adjust = () => {
      if (!ref.current) return;
      const w = ref.current.offsetWidth;
      const h = ref.current.offsetHeight;
      if (w === 0 || h === 0) return;
      const fs = w / divisor;
      setFontSize(fs);
      const lineHeight = fs * 1.15;
      const lines = Math.max(1, Math.floor(h / lineHeight));
      setMaxLines(lines);
    };
    const ro = new ResizeObserver(adjust);
    if (ref.current) ro.observe(ref.current);
    adjust();
    return () => ro.disconnect();
  }, [value, divisor]);

  return (
    <div
      ref={ref}
      className={`flex-1 min-h-0 overflow-hidden flex items-center justify-center px-1 ${
        hasName ? 'text-gray-600' : 'text-gray-900'
      } ${isCrossed ? 'opacity-50' : ''}`}
    >
      <span
        className={`text-center break-words whitespace-pre-wrap ${isCrossed ? 'line-through' : ''}`}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: 1.15,
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </span>
    </div>
  );
};

const StructuredCellContent: React.FC<StructuredCellContentProps> = ({
  data,
  values,
  sortedHeaders,
  nameFontDivisor,
  infoFontDivisor,
  initialCellWidth,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(() => initialCellWidth ?? 0);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      if (w === 0) return;
      setContainerWidth(w);
    };
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    measure();
    return () => ro.disconnect();
  }, []);

  const spacing = containerWidth / SPACING_DIVISOR;
  const isCrossed = data?.is_crossed;
  const name = data?.name || '';
  const hasHeaders = sortedHeaders.length > 0;
  const hasAnyValue = hasHeaders && sortedHeaders.some(h => (values[h.display_order] || '').length > 0);

  if (!data && !hasAnyValue) return null;

  return (
    <div
      ref={containerRef}
      className="leading-tight h-full flex flex-col min-w-0 w-full"
      style={{ paddingTop: `${spacing}px`, paddingBottom: `${spacing}px` }}
    >
      {name && <DynamicNameText name={name} divisor={nameFontDivisor} isCrossed={isCrossed} initialCellWidth={initialCellWidth} />}
      {hasHeaders && (
        <div className="flex-1 min-h-0 flex flex-col">
          {sortedHeaders.map((h, i) => (
            <React.Fragment key={h.id}>
              {i > 0 && <div className="h-px bg-gray-200 flex-shrink-0" />}
              <StructuredSlot
                value={values[h.display_order] || ''}
                divisor={infoFontDivisor}
                isCrossed={isCrossed}
                hasName={!!name}
                initialCellWidth={initialCellWidth}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default StructuredCellContent;
