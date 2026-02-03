// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';

export interface UsePendingEditorClearParams {
  pendingEditorOpen: {
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings';
    nodeId: string;
  } | null;
  showSynonyms: boolean;
  selectedNode: any;
  setPendingEditorOpen: React.Dispatch<React.SetStateAction<{
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings';
    nodeId: string;
  } | null>>;
}

/**
 * Hook that clears pending editor after it's been opened.
 */
export function usePendingEditorClear(params: UsePendingEditorClearParams) {
  const { pendingEditorOpen, showSynonyms, selectedNode, setPendingEditorOpen } = params;

  useEffect(() => {
    if (pendingEditorOpen && showSynonyms && selectedNode) {
      const nodeId = selectedNode.id || selectedNode.templateId;
      if (nodeId === pendingEditorOpen.nodeId) {
        const timer = setTimeout(() => {
          setPendingEditorOpen(null);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [pendingEditorOpen, showSynonyms, selectedNode, setPendingEditorOpen]);
}
