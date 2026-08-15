import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Microscope } from 'lucide-react';
import { CellData } from '../services/locationCellService';
import { SlideBoxHeader } from '../services/slideBoxHeaderService';
import { SlideValuesMap } from '../services/slideCellValueService';
import { scaled } from '../utils/scaleUtils';
import { computeSlideTextLayout } from '../utils/slideFontConfig';

export interface ExternalDragHandlers {
  onMouseDown: (globalIndex: number, e: React.MouseEvent) => void;
  onMouseEnter: (globalIndex: number) => void;
  onMouseUp: () => void;
  onTouchStart: (globalIndex: number, e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

interface SlideGridProps {
  selectedCells: Set<string>;
  onCellSelection: (cellId: string, isSelected: boolean) => void;
  cellData: Record<string, CellData>;
  slideValues: SlideValuesMap;
  headers: SlideBoxHeader[];
  sortedHeaders: SlideBoxHeader[];
  rows: number;
  activeColumn: string;
  accentColor: string;
  onOpenSlideDetails?: (cellId: string) => void;
  scaleFactor?: number;
  externalDragHandlers?: ExternalDragHandlers;
  externalRefRegistration?: (cellId: string, element: HTMLDivElement | null) => void;
  globalIndexOffset?: number;
  externalDragSelection?: Set<string>;
  externalOriginalSelection?: Record<string, boolean>;
  externalIsDragging?: boolean;
  onGridContextMenu?: (cellId: string, x: number, y: number) => void;
  onHoveredCellChange?: (cellId: string | null) => void;
  moveStagedCells?: Set<string>;
  clipboardCells?: Set<string>;
  clipboardOperation?: 'copy' | 'cut' | null;
  slideFontDivisor?: number;
}

const LONG_PRESS_MS = 500;

const SlideGrid: React.FC<SlideGridProps> = ({
  selectedCells,
  onCellSelection,
  cellData,
  slideValues,
  sortedHeaders,
  rows,
  activeColumn,
  onOpenSlideDetails,
  scaleFactor = 1,
  externalDragHandlers,
  externalRefRegistration,
  globalIndexOffset = 0,
  externalDragSelection,
  externalOriginalSelection,
  externalIsDragging,
  onGridContextMenu,
  onHoveredCellChange,
  moveStagedCells,
  clipboardCells,
  clipboardOperation,
  slideFontDivisor = 10,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null);
  const [dragSelection, setDragSelection] = useState<Set<string>>(new Set());
  const [originalSelectionState, setOriginalSelectionState] = useState<Record<string, boolean>>({});
  const slideRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const isDraggingRef = useRef(false);
  const dragStartIndexRef = useRef<number | null>(null);
  const dragEndIndexRef = useRef<number | null>(null);
  const dragSelectionRef = useRef<Set<string>>(new Set());
  const originalSelectionStateRef = useRef<Record<string, boolean>>({});
  const lastTouchEndTimeRef = useRef(0);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartCellRef = useRef<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const TOUCH_MOVE_THRESHOLD = 10;
  const useExternal = !!externalDragHandlers;

  const slideIds: string[] = [];
  for (let i = 1; i <= rows; i++) {
    slideIds.push(`${activeColumn}${i}`);
  }

  const computeRangeSelection = useCallback((startIdx: number, endIdx: number) => {
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const newSelection = new Set<string>();
    for (let i = minIdx; i <= maxIdx; i++) {
      newSelection.add(slideIds[i]);
    }
    return newSelection;
  }, [slideIds]);

  const handleMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (Date.now() - lastTouchEndTimeRef.current < 500) return;

    setIsDragging(true);
    setDragStartIndex(index);
    setDragEndIndex(index);
    setDragSelection(new Set([slideIds[index]]));

    const originalState: Record<string, boolean> = {};
    selectedCells.forEach(id => { originalState[id] = true; });
    setOriginalSelectionState(originalState);
  }, [selectedCells, slideIds]);

  const handleMouseEnter = useCallback((index: number) => {
    if (isDragging && dragStartIndex !== null) {
      setDragEndIndex(index);
      const newSelection = computeRangeSelection(dragStartIndex, index);
      setDragSelection(newSelection);
    }
  }, [isDragging, dragStartIndex, computeRangeSelection]);

  const handleMouseUp = useCallback(() => {
    if (Date.now() - lastTouchEndTimeRef.current < 500) return;

    if (isDragging && dragStartIndex !== null && dragEndIndex !== null && dragSelection.size > 1) {
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
    setDragEndIndex(null);
    setDragSelection(new Set());
    setOriginalSelectionState({});
  }, [isDragging, dragStartIndex, dragEndIndex, dragSelection, originalSelectionState, onCellSelection]);

  useEffect(() => {
    if (useExternal || !isDragging) return;
    const handleGlobalMouseUp = () => handleMouseUp();
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [useExternal, isDragging, handleMouseUp]);

  const handleTouchStart = useCallback((index: number, e: React.TouchEvent) => {
    e.preventDefault();
    const cellId = slideIds[index];
    const touch = e.touches[0];

    const originalState: Record<string, boolean> = {};
    selectedCells.forEach(id => { originalState[id] = true; });

    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    touchStartCellRef.current = cellId;
    dragStartIndexRef.current = index;
    dragEndIndexRef.current = index;
    dragSelectionRef.current = new Set([cellId]);
    originalSelectionStateRef.current = originalState;
    isDraggingRef.current = false;
    longPressFiredRef.current = false;

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current && onGridContextMenu) {
        longPressFiredRef.current = true;
        if (navigator.vibrate) navigator.vibrate(10);
        if (!selectedCells.has(cellId)) {
          onCellSelection(cellId, true);
        }
        onGridContextMenu(cellId, touch.clientX, touch.clientY);
      }
    }, LONG_PRESS_MS);
  }, [selectedCells, slideIds, onGridContextMenu, onCellSelection]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startPos = touchStartPosRef.current;

    if (startPos && !isDraggingRef.current) {
      const dx = touch.clientX - startPos.x;
      const dy = touch.clientY - startPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= TOUCH_MOVE_THRESHOLD) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        isDraggingRef.current = true;
        setIsDragging(true);
        setDragStartIndex(dragStartIndexRef.current);
        setDragEndIndex(dragStartIndexRef.current);
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
    slideRefs.current.forEach((ref, cellId) => {
      if (ref === element || ref.contains(element as Node)) {
        foundIndex = slideIds.indexOf(cellId);
      }
    });

    if (foundIndex === null || foundIndex < 0) return;

    const startIdx = dragStartIndexRef.current;
    const newSelection = new Set<string>();
    const minIdx = Math.min(startIdx, foundIndex);
    const maxIdx = Math.max(startIdx, foundIndex);
    for (let i = minIdx; i <= maxIdx; i++) {
      newSelection.add(slideIds[i]);
    }

    dragEndIndexRef.current = foundIndex;
    dragSelectionRef.current = newSelection;
    setDragEndIndex(foundIndex);
    setDragSelection(newSelection);
  }, [slideIds]);

  const handleTouchEnd = useCallback(() => {
    lastTouchEndTimeRef.current = Date.now();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      isDraggingRef.current = false;
      dragStartIndexRef.current = null;
      dragEndIndexRef.current = null;
      dragSelectionRef.current = new Set();
      originalSelectionStateRef.current = {};
      touchStartPosRef.current = null;
      touchStartCellRef.current = null;
      setIsDragging(false);
      setDragStartIndex(null);
      setDragEndIndex(null);
      setDragSelection(new Set());
      setOriginalSelectionState({});
      return;
    }

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
    dragEndIndexRef.current = null;
    dragSelectionRef.current = new Set();
    originalSelectionStateRef.current = {};
    touchStartPosRef.current = null;
    touchStartCellRef.current = null;

    setIsDragging(false);
    setDragStartIndex(null);
    setDragEndIndex(null);
    setDragSelection(new Set());
    setOriginalSelectionState({});
  }, [onCellSelection]);

  const setSlideRef = useCallback((cellId: string, element: HTMLDivElement | null) => {
    if (element) {
      slideRefs.current.set(cellId, element);
    } else {
      slideRefs.current.delete(cellId);
    }
    externalRefRegistration?.(cellId, element);
  }, [externalRefRegistration]);

  const activeDragSelection = useExternal ? (externalDragSelection || new Set<string>()) : dragSelection;
  const activeOriginalSelection = useExternal ? (externalOriginalSelection || {}) : originalSelectionState;
  const activeIsDragging = useExternal ? (externalIsDragging || false) : isDragging;

  const getSlideBackground = (cellId: string) => {
    const isInDragArea = activeIsDragging && activeDragSelection.has(cellId);
    const wasOriginallySelected = activeOriginalSelection[cellId] || false;
    const isSelected = selectedCells.has(cellId);
    const data = cellData[cellId];
    const isMoveStaged = moveStagedCells?.has(cellId);
    const isInClipboard = clipboardCells?.has(cellId);

    if (isMoveStaged) {
      return 'bg-amber-100 border-amber-400 ring-2 ring-amber-400';
    }
    if (isInClipboard && clipboardOperation === 'copy') {
      return 'bg-sky-50 border-sky-400 ring-2 ring-sky-400 ring-dashed';
    }
    if (isInClipboard && clipboardOperation === 'cut') {
      return 'bg-amber-50 border-amber-400 ring-2 ring-amber-400 ring-dashed';
    }
    if (isInDragArea) {
      return wasOriginallySelected
        ? 'border-red-400 ring-2 ring-red-200'
        : 'border-blue-400 ring-2 ring-blue-300';
    }
    if (isSelected) {
      return 'border-blue-400 ring-2 ring-blue-300';
    }
    if (data?.color) {
      return 'border-gray-200';
    }
    return 'bg-white border-gray-200 hover:border-gray-300';
  };

  const handleContextMenu = useCallback((cellId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedCells.has(cellId)) {
      onCellSelection(cellId, true);
    }
    onGridContextMenu?.(cellId, e.clientX, e.clientY);
  }, [selectedCells, onCellSelection, onGridContextMenu]);

  const handleCellMouseEnter = useCallback((cellId: string) => {
    onHoveredCellChange?.(cellId);
  }, [onHoveredCellChange]);

  const slideEntries = slideIds.map((cellId, index) => ({ cellId, index }));

  const s = scaleFactor;
  const isScaled = s < 1;

  const textLayout = computeSlideTextLayout(slideFontDivisor);
  const cellSquareSize = scaled(48, s);
  const cellIdFontSize = scaled(14, s);
  const headerValFontSize = scaled(textLayout.fontSize, s);
  const headerValLineHeight = scaled(textLayout.lineHeight, s);
  const microscopeWH = scaled(30, s);
  const microscopeIconSize = scaled(15, s);
  const rowGap = scaled(8, s);
  const rowHeight = scaled(72, s);
  const borderRadius = scaled(12, s);
  const cellSquareRadius = scaled(8, s);
  const innerGap = scaled(12, s);
  const rowPx = scaled(10, s);
  const rowPy = scaled(12, s);

  return (
    <div className="w-full select-none" style={{ touchAction: 'none' }}>
      <div style={isScaled ? { display: 'flex', flexDirection: 'column', gap: rowGap } : undefined} className={isScaled ? undefined : 'space-y-2'}>
        {slideEntries.map(({ cellId, index }) => {
          const data = cellData[cellId];
          const values = slideValues[cellId] || {};
          const isEmpty = !data;
          const isCrossed = data?.is_crossed;
          const bgClass = getSlideBackground(cellId);
          const cellColor = data?.color;

          const globalIndex = globalIndexOffset + index;

          const mouseDown = useExternal
            ? (e: React.MouseEvent) => externalDragHandlers.onMouseDown(globalIndex, e)
            : (e: React.MouseEvent) => handleMouseDown(index, e);
          const mouseEnter = useExternal
            ? () => externalDragHandlers.onMouseEnter(globalIndex)
            : () => handleMouseEnter(index);
          const mouseUp = useExternal
            ? externalDragHandlers.onMouseUp
            : handleMouseUp;
          const touchStart = useExternal
            ? (e: React.TouchEvent) => externalDragHandlers.onTouchStart(globalIndex, e)
            : (e: React.TouchEvent) => handleTouchStart(index, e);
          const touchMove = useExternal
            ? externalDragHandlers.onTouchMove
            : handleTouchMove;
          const touchEnd = useExternal
            ? externalDragHandlers.onTouchEnd
            : handleTouchEnd;

          const rowStyle: React.CSSProperties = {
            ...(cellColor ? { backgroundColor: cellColor as string } : {}),
            ...(isScaled ? { height: rowHeight, borderRadius, padding: `${rowPy}px ${rowPx}px`, gap: innerGap } : {}),
          };

          return (
            <div
              key={cellId}
              ref={(el) => setSlideRef(cellId, el)}
              className={`flex items-center border transition-all duration-150 cursor-pointer overflow-hidden ${bgClass} ${
                isEmpty ? 'border-dashed' : ''
              } ${isScaled ? '' : 'rounded-xl h-[72px] px-2.5 py-3 gap-3'}`}
              style={rowStyle}
              onMouseDown={mouseDown}
              onMouseEnter={(e) => {
                mouseEnter();
                handleCellMouseEnter(cellId);
              }}
              onMouseUp={mouseUp}
              onTouchStart={touchStart}
              onTouchMove={touchMove}
              onTouchEnd={touchEnd}
              onContextMenu={(e) => handleContextMenu(cellId, e)}
            >
              <div className="flex items-center justify-center flex-shrink-0">
                <div
                  className={`border border-gray-200 bg-gray-100 flex items-center justify-center ${isScaled ? '' : 'w-12 h-12 rounded-lg'}`}
                  style={isScaled ? { width: cellSquareSize, height: cellSquareSize, borderRadius: cellSquareRadius } : undefined}
                >
                  <span
                    className={`font-semibold text-gray-400 ${isScaled ? '' : 'text-sm'}`}
                    style={isScaled ? { fontSize: cellIdFontSize } : undefined}
                  >
                    {cellId}
                  </span>
                </div>
              </div>

              {isEmpty ? (
                <>
                  {sortedHeaders.map((header) => (
                    <div
                      key={header.id}
                      className="flex-1 min-w-0"
                    />
                  ))}
                  <div className="flex items-center flex-shrink-0">
                    <button
                      className="flex items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
                      style={isScaled ? { width: microscopeWH, height: microscopeWH } : { width: 30, height: 30 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onOpenSlideDetails?.(cellId);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <Microscope size={isScaled ? microscopeIconSize : 15} className="text-gray-400" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {sortedHeaders.map((header) => (
                    <div
                      key={header.id}
                      className={`flex-1 min-w-0 overflow-hidden flex items-center justify-center ${isCrossed ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`whitespace-pre-wrap break-words text-center ${
                          header.display_order === 0
                            ? 'font-bold text-gray-900'
                            : 'text-gray-700'
                        } ${isCrossed ? 'line-through' : ''}`}
                        style={{
                          fontSize: isScaled ? headerValFontSize : textLayout.fontSize,
                          lineHeight: isScaled ? `${headerValLineHeight}px` : `${textLayout.lineHeight}px`,
                          display: '-webkit-box',
                          WebkitLineClamp: textLayout.maxLines,
                          WebkitBoxOrient: 'vertical' as const,
                          overflow: 'hidden',
                        }}
                      >
                        {values[header.display_order] || ''}
                      </span>
                    </div>
                  ))}
                  <div className={`flex items-center flex-shrink-0 ${isCrossed ? 'opacity-50' : ''}`}>
                    <button
                      className="flex items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
                      style={isScaled ? { width: microscopeWH, height: microscopeWH } : { width: 30, height: 30 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onOpenSlideDetails?.(cellId);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <Microscope size={isScaled ? microscopeIconSize : 15} className="text-gray-400" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SlideGrid;
