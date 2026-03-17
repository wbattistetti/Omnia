import React from 'react';
import RegexInlineEditor from '@responseEditor/InlineEditors/RegexInlineEditor';
import ExtractorInlineEditor from '@responseEditor/InlineEditors/ExtractorInlineEditor';
import NERInlineEditor from '@responseEditor/InlineEditors/NERInlineEditor';
import LLMInlineEditor from '@responseEditor/InlineEditors/LLMInlineEditor';
import IntentEditorInlineEditor from '@responseEditor/InlineEditors/IntentEditorInlineEditor';
import ContractEditorWrapper from '@responseEditor/ContractSelector/ContractEditorWrapper';

import { RowResult } from '@responseEditor/hooks/useExtractionTesting';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';

interface EditorRendererProps {
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings' | 'grammarflow' | null;
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
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings' | 'grammarflow') => void;
  setEditorButton: (button: React.ReactNode) => void;
  setEditorErrorMessage: (error: React.ReactNode) => void;
  contract?: DataContract | null;
  onContractChange?: (contract: DataContract | null) => void;
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
  contract,
  onContractChange,
}: EditorRendererProps) {
  if (!activeEditor || !['regex', 'extractor', 'ner', 'llm', 'embeddings', 'grammarflow'].includes(activeEditor) || !editorProps) {
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
          onRegexSave={editorProps.setRegex}
          kind={editorProps.kind}
          examplesList={editorProps.examplesList}
          rowResults={editorProps.rowResults}
          {...commonProps}
          onErrorRender={setEditorErrorMessage}
        />
      );
    case 'extractor':
      return <ExtractorInlineEditor {...commonProps} />;
    case 'ner':
      return <NERInlineEditor {...commonProps} />;
    case 'llm':
      return (
        <LLMInlineEditor
          {...commonProps}
          contract={contract}
          onContractChange={onContractChange}
        />
      );
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
    case 'grammarflow':
      return (
        <ContractEditorWrapper
          method="grammarflow"
          contract={contract}
          onContractChange={onContractChange || (() => {})}
          node={editorProps.node}
          kind={editorProps.kind}
          profile={editorProps.profile}
          testCases={editorProps.testCases}
          setTestCases={editorProps.setTestCases}
          onProfileUpdate={editorProps.onProfileUpdate}
          onClose={onCloseEditor || (() => toggleEditor('grammarflow'))}
        />
      );
    default:
      return null;
  }
}

// Memoize to prevent unnecessary re-renders
export const MemoizedEditorRenderer = React.memo(EditorRenderer);
