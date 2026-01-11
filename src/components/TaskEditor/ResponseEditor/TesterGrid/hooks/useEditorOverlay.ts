import { useState, useEffect, useRef } from 'react';

interface UseEditorOverlayOptions {
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  showDeterministic: boolean;
  showNER: boolean;
  examplesListLength: number;
  phraseColumnWidth: number;
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
      if (!table || !headerRow) return;

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

      const tableRect = table.getBoundingClientRect();
      const startCellRect = extractorStartCell.getBoundingClientRect();
      const endCellRect = extractorEndCell.getBoundingClientRect();

      const left = startCellRect.left - tableRect.left;
      const width = endCellRect.right - startCellRect.left;

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
  }, [activeEditor, showDeterministic, showNER, examplesListLength, phraseColumnWidth]);

  return {
    editorOverlayStyle,
    tableRef,
    headerRowRef,
  };
}
