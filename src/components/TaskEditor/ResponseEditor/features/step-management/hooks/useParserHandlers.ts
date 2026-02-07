// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';

export interface UseParserHandlersParams {
  findAndSelectNodeById: (nodeId: string) => void;
  setShowSynonyms: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingEditorOpen: React.Dispatch<React.SetStateAction<{
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings';
    nodeId: string;
  } | null>>;
}

export interface UseParserHandlersResult {
  handleParserCreate: (nodeId: string, node: any) => void;
  handleParserModify: (nodeId: string, node: any) => void;
  handleEngineChipClick: (
    nodeId: string,
    node: any,
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings'
  ) => void;
}

/**
 * Hook that provides parser-related handlers (create, modify, engine chip click).
 */
export function useParserHandlers(params: UseParserHandlersParams): UseParserHandlersResult {
  const { findAndSelectNodeById, setShowSynonyms, setPendingEditorOpen } = params;

  const handleParserCreate = useCallback((nodeId: string, node: any) => {
    findAndSelectNodeById(nodeId);
    setShowSynonyms(true);
    // Editor will open automatically when Recognition panel opens
  }, [findAndSelectNodeById, setShowSynonyms]);

  const handleParserModify = useCallback((nodeId: string, node: any) => {
    findAndSelectNodeById(nodeId);
    setShowSynonyms(true);
    // Editor will open automatically when Recognition panel opens
  }, [findAndSelectNodeById, setShowSynonyms]);

  const handleEngineChipClick = useCallback((
    nodeId: string,
    node: any,
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings'
  ) => {
    findAndSelectNodeById(nodeId);
    setShowSynonyms(true);
    // Set pending editor to open after Recognition panel is ready
    setPendingEditorOpen({ editorType, nodeId });
  }, [findAndSelectNodeById, setShowSynonyms, setPendingEditorOpen]);

  return {
    handleParserCreate,
    handleParserModify,
    handleEngineChipClick,
  };
}
