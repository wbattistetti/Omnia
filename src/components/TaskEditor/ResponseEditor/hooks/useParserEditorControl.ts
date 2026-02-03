// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useCallback } from 'react';

/**
 * Hook to control parser editor opening from Sidebar
 * This allows Sidebar to trigger opening Recognition panel and specific editor
 */
export function useParserEditorControl() {
  const [pendingEditorOpen, setPendingEditorOpen] = useState<{
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings';
    nodeId: string;
  } | null>(null);

  const openParserEditor = useCallback((
    nodeId: string,
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings'
  ) => {
    setPendingEditorOpen({ editorType, nodeId });
  }, []);

  const clearPendingEditor = useCallback(() => {
    setPendingEditorOpen(null);
  }, []);

  return {
    pendingEditorOpen,
    openParserEditor,
    clearPendingEditor,
  };
}
