import { useState } from 'react';

export type EditorType = 'regex' | 'extractor' | 'ner' | 'llm' | null;

/**
 * Hook for managing active inline editor state
 */
export function useEditorState() {
  const [activeEditor, setActiveEditor] = useState<EditorType>(null);

  const openEditor = (type: EditorType) => {
    setActiveEditor(type);
  };

  const closeEditor = () => {
    setActiveEditor(null);
  };

  const toggleEditor = (type: Exclude<EditorType, null>) => {
    setActiveEditor(prev => prev === type ? null : type);
  };

  const isEditorOpen = (type: Exclude<EditorType, null>): boolean => {
    return activeEditor === type;
  };

  const isAnyEditorOpen = (): boolean => {
    return activeEditor !== null;
  };

  return {
    activeEditor,
    openEditor,
    closeEditor,
    toggleEditor,
    isEditorOpen,
    isAnyEditorOpen,
  };
}

