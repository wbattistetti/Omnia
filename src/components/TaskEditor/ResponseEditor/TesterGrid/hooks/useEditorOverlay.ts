import { useState, useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (!activeEditor || !['regex', 'extractor', 'ner', 'llm'].includes(activeEditor) || !tableRef.current || !headerRowRef.current) {
      setEditorOverlayStyle({});
      return;
    }

    // Use setTimeout to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      const table = tableRef.current;
      const headerRow = headerRowRef.current;
      const scrollContainer = contractTableRef?.current; // ✅ FIX: Contenitore scrollabile
      if (!table || !headerRow || !scrollContainer) return;

      const firstHeaderCell = headerRow.querySelector('th:first-child') as HTMLElement;
      if (!firstHeaderCell) return;

      // Find columns 2-5 (Regex, Extractor, NER, LLM)
      const headerCells = Array.from(headerRow.querySelectorAll('th'));
      const firstColIndex = headerCells.findIndex(cell => cell === firstHeaderCell);
      if (firstColIndex === -1) return;

      // Column 1 is "Frase", column 2 is buttons, columns 3-6 are extractors
      // Calculate index of last extractor column (LLM is always present)
      // Extractor columns start from firstColIndex + 2 (after Frase and buttons)
      let lastExtractorIndex = firstColIndex + 2; // Regex (after Frase and buttons)
      if (showDeterministic) lastExtractorIndex++; // Extractor
      if (showNER) lastExtractorIndex++; // NER
      lastExtractorIndex++; // LLM (always present)

      const extractorStartCell = headerCells[firstColIndex + 2]; // After Frase and buttons
      const extractorEndCell = headerCells[lastExtractorIndex];
      if (!extractorStartCell || !extractorEndCell) return;

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

      setEditorOverlayStyle({
        position: 'absolute',
        left: `${left}px`,
        top: '0px',
        width: `${width}px`,
        height: '100%',
        zIndex: 1000,
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [activeEditor, showDeterministic, showNER, examplesListLength, phraseColumnWidth, contractTableRef]);

  return {
    editorOverlayStyle,
    tableRef,
    headerRowRef,
  };
}
