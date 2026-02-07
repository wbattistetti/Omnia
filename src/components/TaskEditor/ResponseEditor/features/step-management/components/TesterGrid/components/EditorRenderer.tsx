import React from 'react';
import RegexInlineEditor from '@responseEditor/InlineEditors/RegexInlineEditor';
import ExtractorInlineEditor from '@responseEditor/InlineEditors/ExtractorInlineEditor';
import NERInlineEditor from '@responseEditor/InlineEditors/NERInlineEditor';
import LLMInlineEditor from '@responseEditor/InlineEditors/LLMInlineEditor';
import IntentEditorInlineEditor from '@responseEditor/InlineEditors/IntentEditorInlineEditor';

import { RowResult } from '@responseEditor/hooks/useExtractionTesting';

interface EditorRendererProps {
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings' | null;
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
    // ✅ NEW: Feedback from test notes
    examplesList?: string[];
    rowResults?: RowResult[];
    getNote?: (rowIndex: number, col: string) => string | undefined;
  };
  onCloseEditor?: () => void;
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  setEditorButton: (button: React.ReactNode) => void;
  setEditorErrorMessage: (error: React.ReactNode) => void;
}

/**
 * Renders the appropriate inline editor based on activeEditor type
 */
export function EditorRenderer({
  activeEditor,
  editorProps,
  onCloseEditor,
  toggleEditor,
  setEditorButton,
  setEditorErrorMessage,
}: EditorRendererProps) {
  if (!activeEditor || !['regex', 'extractor', 'ner', 'llm', 'embeddings'].includes(activeEditor) || !editorProps) {
    return null;
  }

  const commonProps = {
    onClose: onCloseEditor || (() => toggleEditor(activeEditor)),
    node: editorProps.node,
    profile: editorProps.profile,
    testCases: editorProps.testCases,
    setTestCases: editorProps.setTestCases,
    onProfileUpdate: editorProps.onProfileUpdate,
    onButtonRender: setEditorButton,
  };

  switch (activeEditor) {
    case 'regex':
      return (
        <RegexInlineEditor
          regex={editorProps.regex || ''}
          setRegex={editorProps.setRegex || (() => { })}
          kind={editorProps.kind}
          examplesList={editorProps.examplesList}
          rowResults={editorProps.rowResults}
          getNote={editorProps.getNote}
          {...commonProps}
          onErrorRender={setEditorErrorMessage}
        />
      );
    case 'extractor':
      return <ExtractorInlineEditor {...commonProps} />;
    case 'ner':
      return <NERInlineEditor {...commonProps} />;
    case 'llm':
      return <LLMInlineEditor {...commonProps} />;
    case 'embeddings':
      const taskForEmbeddings = editorProps.task;
      const actForEmbeddings = taskForEmbeddings ? {
        // ✅ NO FALLBACKS: Use id as primary, instanceId as fallback (both are valid properties)
        id: taskForEmbeddings.id ?? taskForEmbeddings.instanceId ?? '',
        type: taskForEmbeddings.type || '',
        label: taskForEmbeddings.label,
        instanceId: taskForEmbeddings.instanceId,
      } : undefined;

      if (!actForEmbeddings) {
        console.warn('[EditorRenderer][embeddings] act is undefined', {
          hasNode: !!editorProps.node,
          hasTaskProp: !!editorProps.task,
          task: editorProps.task,
        });
      }

      return (
        <IntentEditorInlineEditor
          {...commonProps}
          act={actForEmbeddings}
        />
      );
    default:
      return null;
  }
}

// Memoize to prevent unnecessary re-renders
export const MemoizedEditorRenderer = React.memo(EditorRenderer);
