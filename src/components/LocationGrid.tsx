import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { getExpirationColor } from '../utils/cellDataUtils';

interface CellBoundaryEdges {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

function computeBoundaryEdges(
  cellSet: Set<string>,
  rowLabels: string[],
  columnNumbers: number[]
): Map<string, CellBoundaryEdges> {
  const result = new Map<string, CellBoundaryEdges>();
  if (cellSet.size === 0) return result;

  for (const cellId of cellSet) {
    const match = cellId.match(/^([A-T])(\d+)$/);
    if (!match) continue;
    const row = match[1];
    const col = parseInt(match[2], 10);
    const rowIdx = rowLabels.indexOf(row);
    const colIdx = columnNumbers.indexOf(col);
    if (rowIdx === -1 || colIdx === -1) continue;

    const topNeighbor = rowIdx > 0 ? `${rowLabels[rowIdx - 1]}${col}` : null;
    const bottomNeighbor = rowIdx < rowLabels.length - 1 ? `${rowLabels[rowIdx + 1]}${col}` : null;
    const leftNeighbor = colIdx > 0 ? `${row}${columnNumbers[colIdx - 1]}` : null;
    const rightNeighbor = colIdx < columnNumbers.length - 1 ? `${row}${columnNumbers[colIdx + 1]}` : null;

    result.set(cellId, {
      top: !topNeighbor || !cellSet.has(topNeighbor),
      bottom: !bottomNeighbor || !cellSet.has(bottomNeighbor),
      left: !leftNeighbor || !cellSet.has(leftNeighbor),
      right: !rightNeighbor || !cellSet.has(rightNeighbor),
    });
  }
  return result;
}

interface BoundaryOverlay {
  edges: CellBoundaryEdges;
  color: string;
}

interface CellData {
  name: string;
  information: string;
  date: string | null;
  color?: string | null;
  is_crossed?: boolean;
  date_type?: 'date' | 'expiration' | 'none';
}

interface DynamicDateTextProps {
  date: string;
  dateType?: 'date' | 'expiration' | 'none';
  divisor: number;
  onHeightChange?: (height: number) => void;
  isCrossed?: boolean;
  bottomOffset: number;
  leftOffset: number;
  initialCellWidth?: number;
}

interface DynamicNameTextProps {
  name: string;
  divisor: number;
  isCrossed?: boolean;
  initialCellWidth?: number;
}

interface DynamicInformationTextProps {
  information: string;
  hasName: boolean;
  divisor: number;
  isCrossed?: boolean;
  initialCellWidth?: number;
}

interface DynamicCellContentProps {
  data: CellData;
  cellId: string;
  nameFontDivisor: number;
  infoFontDivisor: number;
  isCrossed?: boolean;
  initialCellWidth?: number;
}

interface LocationGridProps {
  selectedCells: Set<string>;
  onCellSelection: (cellId: string, isSelected: boolean) => void;
  cellData: Record<string, CellData>;
  rows: number;
  columns: number;
  nameFontDivisor?: number;
  infoFontDivisor?: number;
  onGridContextMenu?: (cellId: string, x: number, y: number) => void;
  onHoveredCellChange?: (cellId: string | null) => void;
  moveStagedCells?: Set<string>;
  clipboardCells?: Set<string>;
  clipboardOperation?: 'copy' | 'cut' | null;
  renderCellContent?: (cellId: string) => React.ReactNode;
  rotateGrid?: boolean;
  initialGridWidth?: number;
}

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRST';

const DynamicDateText: React.FC<DynamicDateTextProps> = ({ date, dateType, divisor, onHeightChange, isCrossed, bottomOffset, leftOffset, initialCellWidth }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(() => initialCellWidth ? initialCellWidth / divisor : 8);
  const onHeightChangeRef = useRef(onHeightChange);
  onHeightChangeRef.current = onHeightChange;

  const isExpiration = dateType === 'expiration';
  const colorClass = isExpiration ? getExpirationColor(date) : 'text-gray-500';

  useEffect(() => {
    const adjustFontSize = () => {
      if (!containerRef.current) return;

      const parentWidth = containerRef.current.parentElement?.offsetWidth || containerRef.current.offsetWidth;
      if (parentWidth === 0) return;

      const calculatedSize = parentWidth / divisor;
      setFontSize(calculatedSize);

      if (onHeightChangeRef.current && containerRef.current) {
        onHeightChangeRef.current(containerRef.current.offsetHeight);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      adjustFontSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    adjustFontSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [date, divisor]);

  return (
    <div
      ref={containerRef}
      className={`absolute w-full ${colorClass} whitespace-nowrap overflow-hidden ${isCrossed ? 'opacity-50' : ''}`}
      style={{ bottom: `${bottomOffset}px`, left: `${leftOffset}px` }}
    >
      <span className={`flex items-center ${isCrossed ? 'line-through' : ''}`} style={{ fontSize: `${fontSize}px`, gap: `${fontSize * 0.1}px` }}>
        {isExpiration && (
          <CalendarClock style={{ width: `${fontSize}px`, height: `${fontSize}px`, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: `${fontSize}px` }}>
          {date}
        </span>
      </span>
    </div>
  );
};

const DynamicNameText: React.FC<DynamicNameTextProps> = ({ name, divisor, isCrossed, initialCellWidth }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(() => initialCellWidth ? initialCellWidth / divisor : 12);

  useEffect(() => {
    const adjustFontSize = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerWidth = container.offsetWidth;

      if (containerWidth === 0) return;

      const calculatedSize = containerWidth / divisor;
      setFontSize(calculatedSize);
    };

    const resizeObserver = new ResizeObserver(() => {
      adjustFontSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    adjustFontSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [name, divisor]);

  return (
    <div ref={containerRef} className={`flex-shrink-0 font-medium text-gray-900 overflow-hidden text-center ${isCrossed ? 'opacity-50' : ''}`}>
      {name.split('\n').map((line, index) => (
        <div
          key={index}
          className={`whitespace-nowrap overflow-hidden text-ellipsis ${isCrossed ? 'line-through' : ''}`}
          style={{ fontSize: `${fontSize}px` }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

const DynamicInformationText: React.FC<DynamicInformationTextProps> = ({ information, hasName, divisor, isCrossed, initialCellWidth }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(() => initialCellWidth ? initialCellWidth / divisor : 10);

  useEffect(() => {
    const adjustFontSize = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerWidth = container.offsetWidth;

      if (containerWidth === 0) return;

      const calculatedSize = containerWidth / divisor;
      setFontSize(calculatedSize);
    };

    const resizeObserver = new ResizeObserver(() => {
      adjustFontSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    adjustFontSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [information, divisor]);

  return (
    <div
      ref={containerRef}
      className={`flex-1 min-h-0 flex flex-col justify-center ${
        hasName ? 'text-gray-600' : 'font-medium text-gray-900'
      } ${isCrossed ? 'opacity-50' : ''}`}
    >
      <div
        className={`max-h-full overflow-hidden whitespace-pre-wrap break-all text-center ${isCrossed ? 'line-through' : ''}`}
        style={{ fontSize: `${fontSize}px` }}
      >
        {information}
      </div>
    </div>
  );
};

const SPACING_DIVISOR = 15;
const DATE_FONT_DIVISOR = 8;

const DynamicCellContent: React.FC<DynamicCellContentProps> = ({ data, cellId, nameFontDivisor, infoFontDivisor, isCrossed, initialCellWidth }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(() => initialCellWidth ?? 0);
  const [dateHeight, setDateHeight] = useState(0);
  const hasDate = !!data.date && data.date_type !== 'none';

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      if (w === 0) return;
      setContainerWidth(w);
    };

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    measure();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleDateHeightChange = useCallback((height: number) => {
    setDateHeight(height);
  }, []);

  useEffect(() => {
    if (!hasDate) {
      setDateHeight(0);
    }
  }, [hasDate]);

  const spacing = containerWidth / SPACING_DIVISOR;
  const dynamicPaddingBottom = hasDate ? dateHeight + spacing : spacing;

  return (
    <div
      ref={containerRef}
      className="leading-tight h-full flex flex-col min-w-0 w-full relative"
      style={{ paddingTop: `${spacing}px`, paddingBottom: `${dynamicPaddingBottom}px` }}
    >
      <div className="flex-1 overflow-hidden flex flex-col">
        {data.name && <DynamicNameText name={data.name} divisor={nameFontDivisor} isCrossed={isCrossed} initialCellWidth={initialCellWidth} />}
        {data.information && (
          <DynamicInformationText
            information={data.information}
            hasName={!!data.name}
            divisor={infoFontDivisor}
            isCrossed={isCrossed}
            initialCellWidth={initialCellWidth}
          />
        )}
      </div>
      {hasDate && (
        <DynamicDateText
          date={data.date!}
          dateType={data.date_type}
          divisor={DATE_FONT_DIVISOR}
          onHeightChange={handleDateHeightChange}
          isCrossed={isCrossed}
          bottomOffset={spacing}
          leftOffset={spacing}
          initialCellWidth={initialCellWidth}
        />
      )}
    </div>
  );
};

const LocationGrid: React.FC<LocationGridProps> = ({
  selectedCells,
  onCellSelection,
  cellData,
  rows: rowCount,
  columns: columnCount,
  nameFontDivisor = 10,
  infoFontDivisor = 12,
  onGridContextMenu,
  onHoveredCellChange,
  moveStagedCells,
  clipboardCells,
  clipboardOperation,
  renderCellContent: renderCellContentProp,
  rotateGrid = false,
  initialGridWidth,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ row: number; col: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ row: number; col: number } | null>(null);
  const [dragSelection, setDragSelection] = useState<Set<string>>(new Set());
  const [originalSelectionState, setOriginalSelectionState] = useState<Record<string, boolean>>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const initialVisualColumns = rotateGrid ? rowCount : columnCount;
  const initialApproxCellWidth = initialGridWidth ? initialGridWidth / (initialVisualColumns + 0.5) : 0;
  const [cellHPadding, setCellHPadding] = useState(() => initialApproxCellWidth ? initialApproxCellWidth / SPACING_DIVISOR : 4);

  useEffect(() => {
    const measureGrid = () => {
      if (!gridRef.current) return;
      const gridWidth = gridRef.current.offsetWidth;
      if (gridWidth === 0) return;
      const visualColumns = rotateGrid ? rowCount : columnCount;
      const approxCellWidth = gridWidth / (visualColumns + 0.5);
      setCellHPadding(approxCellWidth / SPACING_DIVISOR);
    };

    const resizeObserver = new ResizeObserver(() => {
      measureGrid();
    });

    if (gridRef.current) {
      resizeObserver.observe(gridRef.current);
    }

    measureGrid();

    return () => {
      resizeObserver.disconnect();
    };
  }, [columnCount, rowCount, rotateGrid]);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);
  const dragEndRef = useRef<{ row: number; col: number } | null>(null);
  const dragSelectionRef = useRef<Set<string>>(new Set());
  const originalSelectionStateRef = useRef<Record<string, boolean>>({});
  const lastTouchEndTimeRef = useRef(0);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartCellRef = useRef<string | null>(null);
  const [longPressingCellId, setLongPressingCellId] = useState<string | null>(null);

  const rowLabels = ROW_LABELS.slice(0, rowCount).split('');
  const columnNumbers = Array.from({ length: columnCount }, (_, i) => i + 1);
  const lastRowLabel = rowLabels[rowLabels.length - 1];
  const lastColumnNumber = columnNumbers[columnNumbers.length - 1];

  const getCellId = (row: string, col: number) => `${row}${col}`;
  const getRowIndex = (row: string) => rowLabels.indexOf(row);
  const getColIndex = (col: number) => col - 1;

  const LONG_PRESS_DURATION = 500;
  const LONG_PRESS_MOVE_THRESHOLD = 10;

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setLongPressingCellId(null);
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleMouseDown = useCallback((row: string, col: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (Date.now() - lastTouchEndTimeRef.current < 500) return;

    const cellId = getCellId(row, col);

    setIsDragging(true);
    const rowIndex = getRowIndex(row);
    const colIndex = getColIndex(col);
    setDragStart({ row: rowIndex, col: colIndex });
    setDragEnd({ row: rowIndex, col: colIndex });
    setDragSelection(new Set([cellId]));
    
    // Capture the original selection state before any changes
    const originalState: Record<string, boolean> = {};
    selectedCells.forEach(id => {
      originalState[id] = true;
    });
    setOriginalSelectionState(originalState);
  }, [selectedCells, onCellSelection]);

  const handleMouseEnter = useCallback((row: string, col: number) => {
    const cellId = getCellId(row, col);
    onHoveredCellChange?.(cellId);

    if (isDragging && dragStart) {
      const rowIndex = getRowIndex(row);
      const colIndex = getColIndex(col);
      setDragEnd({ row: rowIndex, col: colIndex });

      const minRow = Math.min(dragStart.row, rowIndex);
      const maxRow = Math.max(dragStart.row, rowIndex);
      const minCol = Math.min(dragStart.col, colIndex);
      const maxCol = Math.max(dragStart.col, colIndex);

      const newDragSelection = new Set<string>();
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const cellId = getCellId(rowLabels[r], c + 1);
          newDragSelection.add(cellId);
        }
      }
      setDragSelection(newDragSelection);
    }
  }, [isDragging, dragStart, rowLabels, onHoveredCellChange]);

  const handleMouseUp = useCallback(() => {
    if (Date.now() - lastTouchEndTimeRef.current < 500) return;

    if (isDragging && dragStart && dragEnd && dragSelection.size > 1) {
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
    setDragStart(null);
    setDragEnd(null);
    setDragSelection(new Set());
    setOriginalSelectionState({});
  }, [isDragging, dragSelection, originalSelectionState, onCellSelection]);

  const handleTouchStart = useCallback((row: string, col: number, e: React.TouchEvent) => {
    e.preventDefault();
    const cellId = getCellId(row, col);
    const touch = e.touches[0];
    const rowIndex = getRowIndex(row);
    const colIndex = getColIndex(col);
    const startPos = { row: rowIndex, col: colIndex };
    const originalState: Record<string, boolean> = {};
    selectedCells.forEach(id => {
      originalState[id] = true;
    });

    longPressTriggeredRef.current = false;
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    touchStartCellRef.current = cellId;

    dragStartRef.current = startPos;
    dragEndRef.current = startPos;
    dragSelectionRef.current = new Set([cellId]);
    originalSelectionStateRef.current = originalState;
    isDraggingRef.current = false;

    setLongPressingCellId(cellId);

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressTriggeredRef.current = true;
      setLongPressingCellId(null);

      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      if (onGridContextMenu) {
        onGridContextMenu(cellId, touch.clientX, touch.clientY);
      }
    }, LONG_PRESS_DURATION);
  }, [selectedCells, onGridContextMenu]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (longPressTriggeredRef.current) return;

    const touch = e.touches[0];
    const startPos = touchStartPosRef.current;

    if (startPos && !isDraggingRef.current) {
      const dx = touch.clientX - startPos.x;
      const dy = touch.clientY - startPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= LONG_PRESS_MOVE_THRESHOLD) {
        cancelLongPress();

        isDraggingRef.current = true;
        setIsDragging(true);
        setDragStart(dragStartRef.current);
        setDragEnd(dragStartRef.current);
        setDragSelection(dragSelectionRef.current);
        setOriginalSelectionState(originalSelectionStateRef.current);
      } else {
        return;
      }
    }

    if (!isDraggingRef.current || !dragStartRef.current) return;
    e.preventDefault();

    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    if (!element) return;

    let cellElement: HTMLDivElement | null = null;
    cellRefs.current.forEach((ref) => {
      if (ref === element || ref.contains(element as Node)) {
        cellElement = ref;
      }
    });

    if (!cellElement) return;

    let foundCellId: string | null = null;
    cellRefs.current.forEach((ref, cellId) => {
      if (ref === cellElement) {
        foundCellId = cellId;
      }
    });

    if (!foundCellId) return;

    const match = foundCellId.match(/^([A-T])(\d+)$/);
    if (!match) return;

    const row = match[1];
    const col = parseInt(match[2], 10);
    const rowIndex = getRowIndex(row);
    const colIndex = getColIndex(col);
    const start = dragStartRef.current;

    const endPos = { row: rowIndex, col: colIndex };
    const minRow = Math.min(start.row, rowIndex);
    const maxRow = Math.max(start.row, rowIndex);
    const minCol = Math.min(start.col, colIndex);
    const maxCol = Math.max(start.col, colIndex);

    const newDragSelection = new Set<string>();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cellId = getCellId(rowLabels[r], c + 1);
        newDragSelection.add(cellId);
      }
    }

    dragEndRef.current = endPos;
    dragSelectionRef.current = newDragSelection;

    setDragEnd(endPos);
    setDragSelection(newDragSelection);
  }, [rowLabels, cancelLongPress]);

  const handleTouchEnd = useCallback(() => {
    lastTouchEndTimeRef.current = Date.now();
    cancelLongPress();

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      isDraggingRef.current = false;
      dragStartRef.current = null;
      dragEndRef.current = null;
      dragSelectionRef.current = new Set();
      originalSelectionStateRef.current = {};
      touchStartPosRef.current = null;
      touchStartCellRef.current = null;

      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      setDragSelection(new Set());
      setOriginalSelectionState({});
      return;
    }

    const dragging = isDraggingRef.current;
    const start = dragStartRef.current;
    const end = dragEndRef.current;
    const selection = dragSelectionRef.current;
    const origState = originalSelectionStateRef.current;

    if (dragging && start && end && selection.size > 1) {
      selection.forEach(cellId => {
        const wasOriginallySelected = origState[cellId] || false;
        onCellSelection(cellId, !wasOriginallySelected);
      });
    } else if (!dragging && touchStartCellRef.current) {
      const cellId = touchStartCellRef.current;
      const wasOriginallySelected = origState[cellId] || false;
      onCellSelection(cellId, !wasOriginallySelected);
    } else if (dragging && selection.size === 1) {
      const cellId = Array.from(selection)[0];
      const wasOriginallySelected = origState[cellId] || false;
      onCellSelection(cellId, !wasOriginallySelected);
    }

    isDraggingRef.current = false;
    dragStartRef.current = null;
    dragEndRef.current = null;
    dragSelectionRef.current = new Set();
    originalSelectionStateRef.current = {};
    touchStartPosRef.current = null;
    touchStartCellRef.current = null;

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setDragSelection(new Set());
    setOriginalSelectionState({});
  }, [onCellSelection, cancelLongPress]);

  const setCellRef = useCallback((cellId: string, element: HTMLDivElement | null) => {
    if (element) {
      cellRefs.current.set(cellId, element);
    } else {
      cellRefs.current.delete(cellId);
    }
  }, []);

  const renderCellContent = (cellId: string) => {
    if (renderCellContentProp) return renderCellContentProp(cellId);
    const data = cellData[cellId];
    if (!data) return null;

    return (
      <DynamicCellContent
        data={data}
        cellId={cellId}
        nameFontDivisor={nameFontDivisor}
        infoFontDivisor={infoFontDivisor}
        isCrossed={data.is_crossed}
        initialCellWidth={initialApproxCellWidth || undefined}
      />
    );
  };

  const visualColumns = rotateGrid ? rowCount : columnCount;
  const visualRows = rotateGrid ? columnCount : rowCount;

  const reversedRowLabels = rotateGrid ? [...rowLabels].reverse() : rowLabels;

  const BLUE = 'rgb(59,130,246)';
  const RED = 'rgb(239,68,68)';

  const selectionBoundary = useMemo(() => {
    return computeBoundaryEdges(selectedCells, rowLabels, columnNumbers);
  }, [selectedCells, rowLabels, columnNumbers]);

  const { dragAddBoundary, dragRemoveBoundary } = useMemo(() => {
    if (!isDragging || dragSelection.size === 0) {
      return { dragAddBoundary: new Map<string, CellBoundaryEdges>(), dragRemoveBoundary: new Map<string, CellBoundaryEdges>() };
    }
    const addSet = new Set<string>();
    const removeSet = new Set<string>();
    dragSelection.forEach(cellId => {
      const wasSelected = originalSelectionState[cellId] || false;
      if (wasSelected) removeSet.add(cellId);
      else addSet.add(cellId);
    });
    return {
      dragAddBoundary: computeBoundaryEdges(addSet, rowLabels, columnNumbers),
      dragRemoveBoundary: computeBoundaryEdges(removeSet, rowLabels, columnNumbers),
    };
  }, [isDragging, dragSelection, originalSelectionState, rowLabels, columnNumbers]);

  const getCellBoundaryOverlay = (cellId: string, isInDragArea: boolean, wasOriginallySelected: boolean, isSelected: boolean): BoundaryOverlay | null => {
    if (isInDragArea) {
      if (wasOriginallySelected) {
        const edges = dragRemoveBoundary.get(cellId);
        return edges ? { edges, color: RED } : null;
      }
      const edges = dragAddBoundary.get(cellId);
      return edges ? { edges, color: BLUE } : null;
    }
    if (isSelected) {
      const edges = selectionBoundary.get(cellId);
      return edges ? { edges, color: BLUE } : null;
    }
    return null;
  };

  return (
    <div
      ref={gridRef}
      className="grid gap-0 select-none bg-white rounded-2xl w-full h-full"
      style={{
        gridTemplateColumns: rotateGrid
          ? `repeat(${visualColumns}, 1fr) 0.5fr`
          : `0.5fr repeat(${visualColumns}, 1fr)`,
        gridTemplateRows: `0.5fr repeat(${visualRows}, 1fr)`,
        touchAction: 'none'
      }}
      onMouseLeave={() => onHoveredCellChange?.(null)}
    >
      {rotateGrid ? (
        <>
          {reversedRowLabels.map((row, idx) => (
            <div
              key={row}
              className={`bg-gray-100 border-l-2 border-b-2 border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700 ${idx === 0 ? 'rounded-tl-2xl' : ''}`}
            >
              {row}
            </div>
          ))}
          <div className="bg-gray-200 border-b-2 border-gray-200 flex items-center justify-center text-xs font-medium text-gray-700 rounded-tr-2xl"></div>

          {columnNumbers.map((col) => (
            <React.Fragment key={col}>
              {reversedRowLabels.map((row, rowIdx) => {
                const cellId = getCellId(row, col);
                const isSelected = selectedCells.has(cellId);
                const isInDragArea = isDragging && dragSelection.has(cellId);
                const wasOriginallySelected = originalSelectionState[cellId] || false;
                const isMoveStaged = moveStagedCells?.has(cellId) || false;
                const isClipboardStaged = clipboardCells?.has(cellId) || false;
                const data = cellData[cellId];
                const cellColor = data?.color;

                const getBackgroundStyle = () => {
                  if (isMoveStaged) {
                    return 'bg-amber-100';
                  }
                  if (isClipboardStaged) {
                    return clipboardOperation === 'cut' ? 'bg-amber-50' : 'bg-sky-50';
                  }
                  if (cellColor) {
                    return '';
                  }
                  return 'bg-white hover:bg-gray-50';
                };

                const getStagedRingStyle = () => {
                  if (isMoveStaged) return 'ring-1 ring-inset ring-amber-400';
                  if (isClipboardStaged) return clipboardOperation === 'cut' ? 'ring-1 ring-inset ring-amber-400 ring-dashed' : 'ring-1 ring-inset ring-sky-400 ring-dashed';
                  return '';
                };

                const isLongPressing = longPressingCellId === cellId;
                const boundaryOverlay = getCellBoundaryOverlay(cellId, isInDragArea, wasOriginallySelected, isSelected);

                const cellStyle: React.CSSProperties = {
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  paddingLeft: `${cellHPadding}px`,
                  paddingRight: `${cellHPadding}px`,
                  ...(!isMoveStaged && !isClipboardStaged && cellColor ? { backgroundColor: cellColor } : {}),
                  ...(boundaryOverlay ? { zIndex: 1 } : {}),
                };

                return (
                  <div
                    key={cellId}
                    ref={(el) => setCellRef(cellId, el)}
                    className={`border-l-2 border-b-2 border-gray-200 cursor-pointer transition-all duration-150 text-xs min-w-0 min-h-0 relative ${col === lastColumnNumber && rowIdx === 0 ? 'rounded-bl-2xl' : ''} ${getBackgroundStyle()} ${getStagedRingStyle()}`}
                    style={cellStyle}
                    onMouseDown={(e) => handleMouseDown(row, col, e)}
                    onMouseEnter={() => handleMouseEnter(row, col)}
                    onMouseUp={handleMouseUp}
                    onTouchStart={(e) => handleTouchStart(row, col, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={(e) => {
                      if (onGridContextMenu) {
                        e.preventDefault();
                        onGridContextMenu(cellId, e.clientX, e.clientY);
                      }
                    }}
                  >
                    {boundaryOverlay && (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          top: -2,
                          left: -2,
                          right: -2,
                          bottom: -2,
                          zIndex: 10,
                          backgroundColor: boundaryOverlay.color === BLUE ? 'rgba(59,130,246,0.08)' : 'rgba(239,68,68,0.08)',
                          borderTop: boundaryOverlay.edges.top ? `2px solid ${boundaryOverlay.color}` : 'none',
                          borderBottom: boundaryOverlay.edges.bottom ? `2px solid ${boundaryOverlay.color}` : 'none',
                          borderLeft: boundaryOverlay.edges.left ? `2px solid ${boundaryOverlay.color}` : 'none',
                          borderRight: boundaryOverlay.edges.right ? `2px solid ${boundaryOverlay.color}` : 'none',
                        }}
                      />
                    )}
                    <div className="overflow-hidden w-full h-full flex items-center">
                      {isLongPressing && (
                        <div className="absolute inset-0 rounded-sm pointer-events-none animate-long-press-ring" />
                      )}
                      {renderCellContent(cellId)}
                    </div>
                  </div>
                );
              })}
              <div
                className={`bg-gray-100 border-b-2 border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700 ${col === lastColumnNumber ? 'rounded-br-2xl' : ''}`}
              >
                {col}
              </div>
            </React.Fragment>
          ))}
        </>
      ) : (
        <>
          <div className="bg-gray-200 border-r-2 border-b-2 border-gray-200 flex items-center justify-center text-xs font-medium text-gray-700 rounded-tl-2xl"></div>
          {columnNumbers.map(col => (
            <div
              key={col}
              className={`bg-gray-100 border-r-2 border-b-2 border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700 ${col === lastColumnNumber ? 'rounded-tr-2xl' : ''}`}
            >
              {col}
            </div>
          ))}

          {rowLabels.map(row => (
            <React.Fragment key={row}>
              <div
                className={`bg-gray-100 border-r-2 border-b-2 border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700 ${row === lastRowLabel ? 'rounded-bl-2xl' : ''}`}
              >
                {row}
              </div>
              {columnNumbers.map(col => {
                const cellId = getCellId(row, col);
                const isSelected = selectedCells.has(cellId);
                const isInDragArea = isDragging && dragSelection.has(cellId);
                const wasOriginallySelected = originalSelectionState[cellId] || false;
                const isMoveStaged = moveStagedCells?.has(cellId) || false;
                const isClipboardStaged = clipboardCells?.has(cellId) || false;
                const data = cellData[cellId];
                const cellColor = data?.color;

                const getBackgroundStyle = () => {
                  if (isMoveStaged) {
                    return 'bg-amber-100';
                  }
                  if (isClipboardStaged) {
                    return clipboardOperation === 'cut' ? 'bg-amber-50' : 'bg-sky-50';
                  }
                  if (cellColor) {
                    return '';
                  }
                  return 'bg-white hover:bg-gray-50';
                };

                const getStagedRingStyle = () => {
                  if (isMoveStaged) return 'ring-1 ring-inset ring-amber-400';
                  if (isClipboardStaged) return clipboardOperation === 'cut' ? 'ring-1 ring-inset ring-amber-400 ring-dashed' : 'ring-1 ring-inset ring-sky-400 ring-dashed';
                  return '';
                };

                const isLongPressing = longPressingCellId === cellId;
                const boundaryOverlay = getCellBoundaryOverlay(cellId, isInDragArea, wasOriginallySelected, isSelected);

                const cellStyle: React.CSSProperties = {
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  paddingLeft: `${cellHPadding}px`,
                  paddingRight: `${cellHPadding}px`,
                  ...(!isMoveStaged && !isClipboardStaged && cellColor ? { backgroundColor: cellColor } : {}),
                  ...(boundaryOverlay ? { zIndex: 1 } : {}),
                };

                return (
                  <div
                    key={cellId}
                    ref={(el) => setCellRef(cellId, el)}
                    data-tutorial-id={`grid-cell-${cellId}`}
                    className={`border-r-2 border-b-2 border-gray-200 cursor-pointer transition-all duration-150 text-xs min-w-0 min-h-0 relative ${row === lastRowLabel && col === lastColumnNumber ? 'rounded-br-2xl' : ''} ${getBackgroundStyle()} ${getStagedRingStyle()}`}
                    style={cellStyle}
                    onMouseDown={(e) => handleMouseDown(row, col, e)}
                    onMouseEnter={() => handleMouseEnter(row, col)}
                    onMouseUp={handleMouseUp}
                    onTouchStart={(e) => handleTouchStart(row, col, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={(e) => {
                      if (onGridContextMenu) {
                        e.preventDefault();
                        onGridContextMenu(cellId, e.clientX, e.clientY);
                      }
                    }}
                  >
                    {boundaryOverlay && (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          top: -2,
                          left: -2,
                          right: -2,
                          bottom: -2,
                          zIndex: 10,
                          backgroundColor: boundaryOverlay.color === BLUE ? 'rgba(59,130,246,0.08)' : 'rgba(239,68,68,0.08)',
                          borderTop: boundaryOverlay.edges.top ? `2px solid ${boundaryOverlay.color}` : 'none',
                          borderBottom: boundaryOverlay.edges.bottom ? `2px solid ${boundaryOverlay.color}` : 'none',
                          borderLeft: boundaryOverlay.edges.left ? `2px solid ${boundaryOverlay.color}` : 'none',
                          borderRight: boundaryOverlay.edges.right ? `2px solid ${boundaryOverlay.color}` : 'none',
                        }}
                      />
                    )}
                    <div className="overflow-hidden w-full h-full flex items-center">
                      {isLongPressing && (
                        <div className="absolute inset-0 rounded-sm pointer-events-none animate-long-press-ring" />
                      )}
                      {renderCellContent(cellId)}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </>
      )}
    </div>
  );
};

export default LocationGrid;