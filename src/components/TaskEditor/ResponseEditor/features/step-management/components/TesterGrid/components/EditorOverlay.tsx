import React from 'react';
import { MemoizedEditorRenderer } from './EditorRenderer';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';

interface EditorOverlayProps {
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings' | 'grammarflow' | null;
  testing: boolean;
  editorOverlayStyle: React.CSSProperties;
  editorProps?: {
    regex?: string;
    setRegex?: (value: string) => void;
    onRegexSave?: (value: string) => void;
    node?: any;
    kind?: string;
    profile?: any;
    testCases?: string[];
    setTestCases?: (cases: string[]) => void;
    onProfileUpdate?: (profile: any) => void;
    task?: any;
  };
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings' | 'grammarflow') => void;
  onCloseEditor?: () => void;
  editorButton: React.ReactNode;
  editorErrorMessage: React.ReactNode;
  getActiveEditorColor: () => string;
  getActiveEditorTitle: () => string;
  getTextColor: (color: string) => string;
  setEditorButton: (button: React.ReactNode) => void;
  setEditorErrorMessage: (error: React.ReactNode) => void;
  contract?: DataContract | null;
  onContractChange?: (contract: DataContract | null) => void;
  // ✅ REMOVED: Header-related props are no longer needed (header removed from overlay)
}

/**
 * Overlay component that displays the inline editor when active.
 * Don't render during batch testing to prevent Monaco unmount errors.
 */
export function EditorOverlay({
  activeEditor,
  testing,
  editorOverlayStyle,
  editorProps,
  toggleEditor,
  onCloseEditor,
  setEditorButton,
  setEditorErrorMessage,
  contract,
  onContractChange,
  // ✅ REMOVED: editorButton, editorErrorMessage, getActiveEditorColor, getActiveEditorTitle, getTextColor
  // These are no longer used since header was removed
}: EditorOverlayProps) {
  if (!activeEditor || testing || !['regex', 'extractor', 'ner', 'llm', 'embeddings', 'grammarflow'].includes(activeEditor) || Object.keys(editorOverlayStyle).length === 0 || !editorProps) {
    return null;
  }

  // ✅ Editors now have their own headers (EditorHeader component)
  // The overlay is just a visual container for the editor content
  return (
    <div
      style={{
        ...editorOverlayStyle,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        pointerEvents: 'auto',
      }}
    >
      {/* ✅ Editor with its own header - no padding to allow header to be visible */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <MemoizedEditorRenderer
          activeEditor={activeEditor}
          editorProps={editorProps}
          onCloseEditor={onCloseEditor}
          toggleEditor={toggleEditor}
          setEditorButton={setEditorButton}
          setEditorErrorMessage={setEditorErrorMessage}
          contract={contract}
          onContractChange={onContractChange}
        />
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const MemoizedEditorOverlay = React.memo(EditorOverlay);
