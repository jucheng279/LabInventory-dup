import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import SlideGrid, { ExternalDragHandlers } from './SlideGrid';
import { CellData } from '../services/locationCellService';
import { SlideBoxHeader } from '../services/slideBoxHeaderService';
import { SlideValuesMap } from '../services/slideCellValueService';
import { scaled, computeIdealRowWidth, computeScaleFactor } from '../utils/scaleUtils';

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRST';
const COLUMN_GAP = 32;

interface MultiColumnSlideGridProps {
  selectedCells: Set<string>;
  onCellSelection: (cellId: string, isSelected: boolean) => void;
  cellData: Record<string, CellData>;
  slideValues: SlideValuesMap;
  headers: SlideBoxHeader[];
  sortedHeaders: SlideBoxHeader[];
  rows: number;
  columns: number;
  accentColor: string;
  onOpenSlideDetails?: (cellId: string) => void;
  onGridContextMenu?: (cellId: string, x: number, y: number) => void;
  onHoveredCellChange?: (cellId: string | null) => void;
  moveStagedCells?: Set<string>;
  clipboardCells?: Set<string>;
  clipboardOperation?: 'copy' | 'cut' | null;
  slideFontDivisor?: number;
}

const MultiColumnSlideGrid: React.FC<MultiColumnSlideGridProps> = ({
  selectedCells,
  onCellSelection,
  cellData,
  slideValues,
  headers,
  sortedHeaders,
  rows,
  columns,
  accentColor,
  onOpenSlideDetails,
  onGridContextMenu,
  onHoveredCellChange,
  moveStagedCells,
  clipboardCells,
  clipboardOperation,
  slideFontDivisor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(1);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [dragSelection, setDragSelection] = useState<Set<string>>(new Set());
  const [originalSelectionState, setOriginalSelectionState] = useState<Record<string, boolean>>({});

  const slideRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const isDraggingRef = useRef(false);
  const dragStartIndexRef = useRef<number | null>(null);
  const dragSelectionRef = useRef<Set<string>>(new Set());
  const originalSelectionStateRef = useRef<Record<string, boolean>>({});
  const lastTouchEndTimeRef = useRef(0);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartCellRef = useRef<string | null>(null);

  const TOUCH_MOVE_THRESHOLD = 10;

  const columnLetters = useMemo(() => {
    const letters: string[] = [];
    for (let c = 0; c < columns; c++) {
      letters.push(ROW_LABELS[c] || String.fromCharCode(65 + c));
    }
    return letters;
  }, [columns]);

  const allSlideIds = useMemo(() => {
    const ids: string[] = [];
    for (const col of columnLetters) {
      for (let i = 1; i <= rows; i++) {
        ids.push(`${col}${i}`);
      }
    }
    return ids;
  }, [columnLetters, rows]);

  const idealColumnWidth = useMemo(
    () => computeIdealRowWidth(sortedHeaders.length),
    [sortedHeaders.length]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const fullWidth = COLUMN_GAP * (columns - 1) + idealColumnWidth * columns;
        setScaleFactor(computeScaleFactor(entry.contentRect.width, fullWidth));
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [columns, idealColumnWidth]);

  const computeRangeSelection = useCallback((startIdx: number, endIdx: number) => {
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const newSelection = new Set<string>();
    for (let i = minIdx; i <= maxIdx; i++) {
      newSelection.add(allSlideIds[i]);
    }
    return newSelection;
  }, [allSlideIds]);

  const handleMouseDown = useCallback((globalIndex: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (Date.now() - lastTouchEndTimeRef.current < 500) return;

    setIsDragging(true);
    setDragStartIndex(globalIndex);
    setDragSelection(new Set([allSlideIds[globalIndex]]));

    const originalState: Record<string, boolean> = {};
    selectedCells.forEach(id => { originalState[id] = true; });
    setOriginalSelectionState(originalState);
  }, [selectedCells, allSlideIds]);

  const handleMouseEnter = useCallback((globalIndex: number) => {
    if (isDragging && dragStartIndex !== null) {
      const newSelection = computeRangeSelection(dragStartIndex, globalIndex);
      setDragSelection(newSelection);
    }
  }, [isDragging, dragStartIndex, computeRangeSelection]);

  const handleMouseUp = useCallback(() => {
    if (Date.now() - lastTouchEndTimeRef.current < 500) return;

    if (isDragging && dragStartIndex !== null && dragSelection.size > 1) {
      dragSelection.forEach(cellId => {
        const wasOriginallySelected = originalSelectionState[cellId] || false;
        onCellSelection(cellId, !wasOriginallySelected);
      });
    } else if (isDragging && dragSelection.size === 1) {
      const cellId = Array.from(dragSelection)[0];
      const wasOriginallySelected = originalSelectionState[cellId] || false;
      onCellSelection(cellId, !wasOriginallySelected);
    }

    setIsDragging(false);
    setDragStartIndex(null);
    setDragSelection(new Set());
    setOriginalSelectionState({});
  }, [isDragging, dragStartIndex, dragSelection, originalSelectionState, onCellSelection]);

  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalMouseUp = () => handleMouseUp();
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, handleMouseUp]);

  const handleTouchStart = useCallback((globalIndex: number, e: React.TouchEvent) => {
    e.preventDefault();
    const cellId = allSlideIds[globalIndex];
    const touch = e.touches[0];

    const originalState: Record<string, boolean> = {};
    selectedCells.forEach(id => { originalState[id] = true; });

    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    touchStartCellRef.current = cellId;
    dragStartIndexRef.current = globalIndex;
    dragSelectionRef.current = new Set([cellId]);
    originalSelectionStateRef.current = originalState;
    isDraggingRef.current = false;
  }, [selectedCells, allSlideIds]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startPos = touchStartPosRef.current;

    if (startPos && !isDraggingRef.current) {
      const dx = touch.clientX - startPos.x;
      const dy = touch.clientY - startPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= TOUCH_MOVE_THRESHOLD) {
        isDraggingRef.current = true;
        setIsDragging(true);
        setDragStartIndex(dragStartIndexRef.current);
        setDragSelection(dragSelectionRef.current);
        setOriginalSelectionState(originalSelectionStateRef.current);
      } else {
        return;
      }
    }

    if (!isDraggingRef.current || dragStartIndexRef.current === null) return;
    e.preventDefault();

    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    let foundIndex: number | null = null;
    slideRefsMap.current.forEach((ref, cellId) => {
      if (ref === element || ref.contains(element as Node)) {
        const idx = allSlideIds.indexOf(cellId);
        if (idx >= 0) foundIndex = idx;
      }
    });

    if (foundIndex === null) return;

    const startIdx = dragStartIndexRef.current;
    const newSelection = computeRangeSelection(startIdx, foundIndex);

    dragSelectionRef.current = newSelection;
    setDragSelection(newSelection);
  }, [allSlideIds, computeRangeSelection]);

  const handleTouchEnd = useCallback(() => {
    lastTouchEndTimeRef.current = Date.now();

    const dragging = isDraggingRef.current;
    const selection = dragSelectionRef.current;
    const origState = originalSelectionStateRef.current;

    if (dragging && selection.size > 1) {
      selection.forEach(cellId => {
        const wasOriginallySelected = origState[cellId] || false;
        onCellSelection(cellId, !wasOriginallySelected);
      });
    } else if (touchStartCellRef.current) {
      const cellId = touchStartCellRef.current;
      const wasOriginallySelected = origState[cellId] || false;
      onCellSelection(cellId, !wasOriginallySelected);
    }

    isDraggingRef.current = false;
    dragStartIndexRef.current = null;
    dragSelectionRef.current = new Set();
    originalSelectionStateRef.current = {};
    touchStartPosRef.current = null;
    touchStartCellRef.current = null;

    setIsDragging(false);
    setDragStartIndex(null);
    setDragSelection(new Set());
    setOriginalSelectionState({});
  }, [onCellSelection]);

  const externalDragHandlers: ExternalDragHandlers = useMemo(() => ({
    onMouseDown: handleMouseDown,
    onMouseEnter: handleMouseEnter,
    onMouseUp: handleMouseUp,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }), [handleMouseDown, handleMouseEnter, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const handleRefRegistration = useCallback((cellId: string, element: HTMLDivElement | null) => {
    if (element) {
      slideRefsMap.current.set(cellId, element);
    } else {
      slideRefsMap.current.delete(cellId);
    }
  }, []);

  const s = scaleFactor;
  const headerFontSize = scaled(11, s);
  const headerPy = scaled(8, s);
  const stickyPl = scaled(10, s) + scaled(48, s) + scaled(12, s);
  const stickyGap = scaled(12, s);
  const stickyTrailer = scaled(30, s);
  const stickyPr = scaled(10, s);
  const columnLabelFontSize = scaled(12, s);
  const colGap = scaled(COLUMN_GAP, s);

  return (
    <div ref={containerRef} className="w-full">
      <div className="flex" style={{ gap: colGap }}>
        {columnLetters.map((colLetter, colIdx) => {
          const globalOffset = colIdx * rows;

          return (
            <div key={colLetter} className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span
                  className="font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  style={s < 1 ? { fontSize: columnLabelFontSize } : { fontSize: 12 }}
                >
                  Column {colLetter} (1-{rows})
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div
                className="sticky top-0 z-10 bg-white border-b border-gray-100"
              >
                <div
                  className="flex items-center"
                  style={s < 1
                    ? { paddingLeft: stickyPl, paddingRight: stickyPr, gap: stickyGap }
                    : { paddingLeft: 70, paddingRight: 10, gap: 12 }
                  }
                >
                  {sortedHeaders.map((header) => (
                    <div
                      key={header.id}
                      className="flex-1 min-w-0 font-semibold text-gray-400 uppercase tracking-wider text-center truncate"
                      style={s < 1
                        ? { paddingTop: headerPy, paddingBottom: headerPy, fontSize: headerFontSize }
                        : { padding: '8px 0', fontSize: 11 }
                      }
                    >
                      {header.header_text || `Header ${header.display_order + 1}`}
                    </div>
                  ))}
                  <div
                    className="flex-shrink-0"
                    style={{ width: s < 1 ? stickyTrailer : 30 }}
                  />
                </div>
              </div>

              <div className="pt-3">
                <SlideGrid
                  selectedCells={selectedCells}
                  onCellSelection={onCellSelection}
                  cellData={cellData}
                  slideValues={slideValues}
                  headers={headers}
                  sortedHeaders={sortedHeaders}
                  rows={rows}
                  activeColumn={colLetter}
                  accentColor={accentColor}
                  onOpenSlideDetails={onOpenSlideDetails}
                  scaleFactor={scaleFactor}
                  externalDragHandlers={externalDragHandlers}
                  externalRefRegistration={handleRefRegistration}
                  globalIndexOffset={globalOffset}
                  externalDragSelection={dragSelection}
                  externalOriginalSelection={originalSelectionState}
                  externalIsDragging={isDragging}
                  onGridContextMenu={onGridContextMenu}
                  onHoveredCellChange={onHoveredCellChange}
                  moveStagedCells={moveStagedCells}
                  clipboardCells={clipboardCells}
                  clipboardOperation={clipboardOperation}
                  slideFontDivisor={slideFontDivisor}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MultiColumnSlideGrid;
