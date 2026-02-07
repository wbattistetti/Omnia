import { useState, useLayoutEffect, useCallback, useRef } from 'react';

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_EDITOR_TYPES = ['regex', 'extractor', 'ner', 'llm'] as const;
const EXTRACTOR_START_OFFSET = 2; // After "Frase" and "Buttons" columns
const FALLBACK_SCROLLBAR_WIDTH = 12;
const OVERLAY_Z_INDEX = 1000;

// ============================================================================
// TYPES
// ============================================================================

type ValidEditorType = typeof VALID_EDITOR_TYPES[number];

interface UseEditorOverlayOptions {
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  contractTableRef?: React.RefObject<HTMLDivElement>;
}

interface UseEditorOverlayReturn {
  editorOverlayStyle: React.CSSProperties;
  tableRef: React.RefObject<HTMLTableElement>;
  headerRowRef: React.RefObject<HTMLTableRowElement>;
}

interface ExtractorColumnRange {
  startIndex: number;
  endIndex: number;
  startCell: HTMLElement;
  endCell: HTMLElement;
}

interface OverlayStyleParams {
  startCellRect: DOMRect;
  endCellRect: DOMRect;
  scrollContainerRect: DOMRect;
  scrollbarOffset: number;
}

// ============================================================================
// HELPER FUNCTIONS (Pure functions - testable)
// ============================================================================

/**
 * Validates that all required elements are present and activeEditor is valid
 */
function validateEditorState(
  activeEditor: string | null,
  tableElement: HTMLTableElement | null,
  headerRowElement: HTMLTableRowElement | null,
  scrollContainer: HTMLElement | null | undefined
): boolean {
  if (!activeEditor || !VALID_EDITOR_TYPES.includes(activeEditor as ValidEditorType)) {
    return false;
  }
  return !!(tableElement && headerRowElement && scrollContainer);
}

/**
 * Calculates the range of extractor columns in the header.
 * Structure: [Frase, Buttons, ...Extractors]
 * Extractor columns start after Frase and Buttons (offset = 2)
 */
function getExtractorColumnRange(
  headerRowElement: HTMLTableRowElement,
  firstColIndex: number
): ExtractorColumnRange | null {
  const headerCells = Array.from(headerRowElement.querySelectorAll('th'));

  const extractorStartIndex = firstColIndex + EXTRACTOR_START_OFFSET;
  const extractorEndIndex = headerCells.length - 1;

  if (extractorStartIndex >= headerCells.length || extractorEndIndex < extractorStartIndex) {
    return null;
  }

  const startCell = headerCells[extractorStartIndex] as HTMLElement;
  const endCell = headerCells[extractorEndIndex] as HTMLElement;

  if (!startCell || !endCell) {
    return null;
  }

  return { startIndex: extractorStartIndex, endIndex: extractorEndIndex, startCell, endCell };
}

/**
 * Calculates scrollbar width dynamically, with fallback
 */
function getScrollbarWidth(element: HTMLElement): number {
  try {
    const width = element.offsetWidth - element.clientWidth;
    return width > 0 ? width : FALLBACK_SCROLLBAR_WIDTH;
  } catch {
    return FALLBACK_SCROLLBAR_WIDTH;
  }
}

/**
 * Calculates the overlay style based on cell positions and container dimensions
 */
function calculateOverlayStyle(params: OverlayStyleParams): React.CSSProperties {
  const { startCellRect, endCellRect, scrollContainerRect, scrollbarOffset } = params;

  const left = startCellRect.left - scrollContainerRect.left;
  const naturalWidth = endCellRect.right - startCellRect.left;
  const availableWidth = scrollContainerRect.width - left - scrollbarOffset;
  const width = Math.min(naturalWidth, availableWidth);

  return {
    position: 'absolute' as const,
    left: `${left}px`,
    top: '0px',
    width: `${width}px`,
    height: '100%',
    zIndex: OVERLAY_Z_INDEX,
  };
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Hook for managing editor overlay positioning.
 * Uses refs, useLayoutEffect, and ResizeObserver for event-driven updates.
 */
export function useEditorOverlay({
  activeEditor,
  contractTableRef,
}: UseEditorOverlayOptions): UseEditorOverlayReturn {
  const [editorOverlayStyle, setEditorOverlayStyle] = useState<React.CSSProperties>({});
  const tableRef = useRef<HTMLTableElement>(null);
  const headerRowRef = useRef<HTMLTableRowElement>(null);

  const calculateOverlayStyleCallback = useCallback(() => {
    const tableElement = tableRef.current;
    const headerRowElement = headerRowRef.current;
    const scrollContainer = contractTableRef?.current;

    // Centralized validation
    if (!validateEditorState(activeEditor, tableElement, headerRowElement, scrollContainer)) {
      setEditorOverlayStyle({});
      return;
    }

    try {
      // Find first header cell
      const firstHeaderCell = headerRowElement!.querySelector('th:first-child') as HTMLElement;
      if (!firstHeaderCell) {
        setEditorOverlayStyle({});
        return;
      }

      // Find first column index
      const headerCells = Array.from(headerRowElement!.querySelectorAll('th'));
      const firstColIndex = headerCells.findIndex(cell => cell === firstHeaderCell);
      if (firstColIndex === -1) {
        setEditorOverlayStyle({});
        return;
      }

      // Calculate extractor column range
      const columnRange = getExtractorColumnRange(headerRowElement!, firstColIndex);
      if (!columnRange) {
        setEditorOverlayStyle({});
        return;
      }

      // Get bounding rectangles
      const scrollContainerRect = scrollContainer!.getBoundingClientRect();
      const startCellRect = columnRange.startCell.getBoundingClientRect();
      const endCellRect = columnRange.endCell.getBoundingClientRect();

      // Calculate scrollbar width
      const hasVerticalScrollbar = scrollContainer!.scrollHeight > scrollContainer!.clientHeight;
      const scrollbarWidth = hasVerticalScrollbar && scrollContainer ? getScrollbarWidth(scrollContainer) : 0;

      // Calculate and set overlay style
      const overlayStyle = calculateOverlayStyle({
        startCellRect,
        endCellRect,
        scrollContainerRect,
        scrollbarOffset: scrollbarWidth,
      });

      setEditorOverlayStyle(overlayStyle);
    } catch (error) {
      console.warn('[useEditorOverlay] Error calculating overlay style:', error);
      setEditorOverlayStyle({});
    }
  }, [activeEditor, contractTableRef]);

  // Calculate overlay style when activeEditor changes
  // Uses requestAnimationFrame to wait for DOM updates (event-driven, not a timeout)
  useLayoutEffect(() => {
    if (!activeEditor || !VALID_EDITOR_TYPES.includes(activeEditor as ValidEditorType)) {
      setEditorOverlayStyle({});
      return;
    }

    const rafId = requestAnimationFrame(() => {
      calculateOverlayStyleCallback();
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [activeEditor, calculateOverlayStyleCallback]);

  // ResizeObserver automatically recalculates when elements change size
  useLayoutEffect(() => {
    const tableElement = tableRef.current;
    const headerRowElement = headerRowRef.current;
    const scrollContainer = contractTableRef?.current;

    if (!validateEditorState(activeEditor, tableElement, headerRowElement, scrollContainer)) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      calculateOverlayStyleCallback();
    });

    resizeObserver.observe(tableElement!);
    resizeObserver.observe(headerRowElement!);
    resizeObserver.observe(scrollContainer!);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeEditor, contractTableRef, calculateOverlayStyleCallback]);

  return {
    editorOverlayStyle,
    tableRef,
    headerRowRef,
  };
}
