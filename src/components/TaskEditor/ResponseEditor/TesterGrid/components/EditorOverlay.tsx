import React from 'react';
import { Wand2, X } from 'lucide-react';
import { MemoizedEditorRenderer } from './EditorRenderer';

interface EditorOverlayProps {
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings' | null;
  testing: boolean;
  editorOverlayStyle: React.CSSProperties;
  editorProps?: {
    regex?: string;
    setRegex?: (value: string) => void;
    node?: any;
    kind?: string;
    profile?: any;
    testCases?: string[];
    setTestCases?: (cases: string[]) => void;
    onProfileUpdate?: (profile: any) => void;
    task?: any;
  };
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  onCloseEditor?: () => void;
  editorButton: React.ReactNode;
  editorErrorMessage: React.ReactNode;
  getActiveEditorColor: () => string;
  getActiveEditorTitle: () => string;
  getTextColor: (color: string) => string;
  setEditorButton: (button: React.ReactNode) => void;
  setEditorErrorMessage: (error: React.ReactNode) => void;
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
  editorButton,
  editorErrorMessage,
  getActiveEditorColor,
  getActiveEditorTitle,
  getTextColor,
  setEditorButton,
  setEditorErrorMessage,
}: EditorOverlayProps) {
  if (!activeEditor || testing || !['regex', 'extractor', 'ner', 'llm'].includes(activeEditor) || Object.keys(editorOverlayStyle).length === 0 || !editorProps) {
    return null;
  }

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
      {/* Editor header with dynamic color based on column */}
      <div
        style={{
          background: getActiveEditorColor(),
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderRadius: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={true} readOnly style={{ cursor: 'default' }} />
          <span style={{ fontWeight: 600, color: getTextColor(getActiveEditorColor()) }}>
            {getActiveEditorTitle()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, justifyContent: 'flex-end' }}>
          {editorErrorMessage && (
            <div style={{ marginLeft: 'auto', marginRight: 0 }}>
              {editorErrorMessage}
            </div>
          )}
          {editorButton && (
            <div style={{ marginRight: 0 }}>
              {editorButton}
            </div>
          )}
          <button
            onClick={() => toggleEditor(activeEditor)}
            style={{
              background: 'rgba(0,0,0,0.1)',
              border: 'none',
              borderRadius: 4,
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s',
            }}
            title="Configure"
          >
            <Wand2 size={14} color={getTextColor(getActiveEditorColor())} />
          </button>
          <button
            onClick={onCloseEditor || (() => toggleEditor(activeEditor))}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: getTextColor(getActiveEditorColor()),
            }}
            title="Close Editor"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 6, minHeight: 0 }}>
        <MemoizedEditorRenderer
          activeEditor={activeEditor}
          editorProps={editorProps}
          onCloseEditor={onCloseEditor}
          toggleEditor={toggleEditor}
          setEditorButton={setEditorButton}
          setEditorErrorMessage={setEditorErrorMessage}
        />
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const MemoizedEditorOverlay = React.memo(EditorOverlay);
