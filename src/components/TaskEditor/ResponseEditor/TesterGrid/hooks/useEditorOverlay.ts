import { useState, useLayoutEffect, useCallback, useRef } from 'react';

interface UseEditorOverlayOptions {
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  showDeterministic: boolean;
  showNER: boolean;
  examplesListLength: number;
  phraseColumnWidth: number;
  contractTableRef?: React.RefObject<HTMLDivElement>; // ✅ FIX: Riferimento al contenitore scrollabile
}

/**
 * Hook for managing editor overlay positioning
 * ✅ Event-driven: uses refs, useLayoutEffect, and ResizeObserver
 */
export function useEditorOverlay({
  activeEditor,
  showDeterministic,
  showNER,
  examplesListLength,
  phraseColumnWidth,
  contractTableRef, // ✅ FIX: Riferimento al contenitore scrollabile
}: UseEditorOverlayOptions) {
  const [editorOverlayStyle, setEditorOverlayStyle] = useState<React.CSSProperties>({});
  const tableRef = useRef<HTMLTableElement>(null);
  const headerRowRef = useRef<HTMLTableRowElement>(null);

  // ✅ Calcola lo stile quando tutti gli elementi sono pronti
  const calculateOverlayStyle = useCallback(() => {
    const tableElement = tableRef.current;
    const headerRowElement = headerRowRef.current;

    if (!activeEditor || !['regex', 'extractor', 'ner', 'llm'].includes(activeEditor)) {
      setEditorOverlayStyle({});
      return;
    }

    if (!tableElement || !headerRowElement || !contractTableRef?.current) {
      setEditorOverlayStyle({});
      return;
    }

    const firstHeaderCell = headerRowElement.querySelector('th:first-child') as HTMLElement;
    if (!firstHeaderCell) {
      console.warn('[🔍 useEditorOverlay] ❌ No first header cell found');
      setEditorOverlayStyle({});
      return;
    }

    const headerCells = Array.from(headerRowElement.querySelectorAll('th'));
    const firstColIndex = headerCells.findIndex(cell => cell === firstHeaderCell);
    if (firstColIndex === -1) {
      setEditorOverlayStyle({});
      return;
    }

    // ✅ Calculate extractor columns based on actual header cells present
    // Columns structure: [Frase, Buttons, ...Extractors]
    // Extractor columns start from index firstColIndex + 2 (after Frase and buttons)
    const extractorStartIndex = firstColIndex + 2;

    // ✅ Find the last extractor column (the last header cell before the end)
    // The last cell is always the last extractor column
    const extractorEndIndex = headerCells.length - 1;

    // ✅ Validate indices
    if (extractorStartIndex >= headerCells.length || extractorEndIndex < extractorStartIndex) {
      setEditorOverlayStyle({});
      return;
    }

    const extractorStartCell = headerCells[extractorStartIndex];
    const extractorEndCell = headerCells[extractorEndIndex];
    if (!extractorStartCell || !extractorEndCell) {
      setEditorOverlayStyle({});
      return;
    }

    const scrollContainer = contractTableRef.current;
    const scrollContainerRect = scrollContainer.getBoundingClientRect(); // ✅ FIX: Usa il contenitore scrollabile
    const startCellRect = extractorStartCell.getBoundingClientRect();
    const endCellRect = extractorEndCell.getBoundingClientRect();

    const left = startCellRect.left - scrollContainerRect.left; // ✅ FIX: Posizione relativa al contenitore
    const SCROLLBAR_WIDTH = 12; // ✅ FIX: Larghezza della scrollbar (da CSS)

    // ✅ FIX: Verifica se la scrollbar è visibile (se il contenuto supera il contenitore)
    const hasVerticalScrollbar = scrollContainer.scrollHeight > scrollContainer.clientHeight;
    const scrollbarOffset = hasVerticalScrollbar ? SCROLLBAR_WIDTH : 0;

    // ✅ FIX: Calcola la larghezza corretta lasciando spazio per la scrollbar
    const naturalWidth = endCellRect.right - startCellRect.left;
    const availableWidth = scrollContainerRect.width - left - scrollbarOffset;
    const width = Math.min(naturalWidth, availableWidth);

    const overlayStyle = {
      position: 'absolute' as const,
      left: `${left}px`,
      top: '0px',
      width: `${width}px`,
      height: '100%',
      zIndex: 1000,
    };

    setEditorOverlayStyle(overlayStyle);
  }, [activeEditor, contractTableRef, showDeterministic, showNER]);

  // ✅ useLayoutEffect - eseguito sincronamente dopo il rendering, prima del paint
  // Usa requestAnimationFrame per aspettare che il DOM sia completamente aggiornato
  // requestAnimationFrame è event-driven (basato sul frame del browser), non un timeout arbitrario
  useLayoutEffect(() => {
    if (!activeEditor || !['regex', 'extractor', 'ner', 'llm'].includes(activeEditor)) {
      setEditorOverlayStyle({});
      return;
    }

    // ✅ requestAnimationFrame - event-driven, aspetta il prossimo frame quando il DOM è aggiornato
    const rafId = requestAnimationFrame(() => {
      calculateOverlayStyle();
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [activeEditor, calculateOverlayStyle]);

  // ✅ ResizeObserver - ricalcola automaticamente quando gli elementi cambiano dimensione
  useLayoutEffect(() => {
    const tableElement = tableRef.current;
    const headerRowElement = headerRowRef.current;

    if (!tableElement || !headerRowElement || !contractTableRef?.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      calculateOverlayStyle();
    });

    resizeObserver.observe(tableElement);
    resizeObserver.observe(headerRowElement);
    resizeObserver.observe(contractTableRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeEditor, contractTableRef, calculateOverlayStyle]);

  return {
    editorOverlayStyle,
    tableRef,
    headerRowRef,
  };
}
