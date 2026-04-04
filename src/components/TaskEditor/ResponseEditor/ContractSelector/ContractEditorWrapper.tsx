/**
 * Contract Editor Wrapper
 * Wraps individual contract editors (Regex, Rules, NER, LLM, Embeddings)
 * Shows editor when contract is added and enabled
 */

import React from 'react';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import type { ContractMethod } from '@responseEditor/ContractSelector/ContractSelector';
import RegexInlineEditor from '@responseEditor/InlineEditors/RegexInlineEditor';
import ExtractorInlineEditor from '@responseEditor/InlineEditors/ExtractorInlineEditor';
import NERInlineEditor from '@responseEditor/InlineEditors/NERInlineEditor';
import LLMInlineEditor from '@responseEditor/InlineEditors/LLMInlineEditor';
import IntentEditorInlineEditor from '@responseEditor/InlineEditors/IntentEditorInlineEditor';
import GrammarFlowInlineEditor from '@responseEditor/InlineEditors/GrammarFlowInlineEditor';

/** Maps task meta (from node.task or editorProps.task) to IntentEditorInlineEditor `act`. */
function taskToAct(t: unknown): { id: string; type: string; label?: string; instanceId?: string } | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const o = t as Record<string, unknown>;
  const id = (o.id ?? o.instanceId) as string | undefined;
  if (id === undefined || id === '') return undefined;
  return {
    id: String(o.id ?? o.instanceId ?? ''),
    type: String(o.type ?? ''),
    label: o.label as string | undefined,
    instanceId: o.instanceId as string | undefined,
  };
}

interface ContractEditorWrapperProps {
  method: ContractMethod;
  contract: DataContract | null;
  onContractChange: (contract: DataContract) => void;
  node?: any;
  kind?: string;
  profile?: any;
  testCases?: string[];
  setTestCases?: (cases: string[]) => void;
  onProfileUpdate?: (profile: any) => void;
  onClose?: () => void;
  /** Owning task id for GrammarFlow standalone vs template cache resolution. */
  taskId?: string;
  /** Task data tree roots; GrammarFlow seeds slots when there is exactly one root. */
  mainList?: unknown[];
  dataTranslations?: Record<string, string>;
}

export default function ContractEditorWrapper({
  method,
  contract,
  onContractChange,
  node,
  kind,
  profile,
  testCases,
  setTestCases,
  onProfileUpdate,
  onClose,
  taskId,
  mainList,
  dataTranslations,
}: ContractEditorWrapperProps) {
  // Get method data from contract.engines array
  const methodData = React.useMemo(() => {
    const engines = contract?.engines;
    if (!engines || !Array.isArray(engines)) {
      return null;
    }
    return engines.find(c => c.type === method) || null;
  }, [contract, method]);

  if (!methodData || methodData.enabled === false) {
    return null;
  }

  const commonProps = {
    onClose: onClose || (() => {}),
    node,
    profile,
    testCases,
    setTestCases,
    onProfileUpdate,
  };

  switch (method) {
    case 'regex':
      return (
        <RegexInlineEditor
          regex={(methodData as any).patterns?.[0] || ''}
          contract={contract}
          onContractChange={onContractChange}
          kind={kind}
          {...commonProps}
        />
      );

    case 'rules':
      return (
        <ExtractorInlineEditor
          contract={contract}
          onContractChange={onContractChange}
          {...commonProps}
        />
      );

    case 'ner':
      return (
        <NERInlineEditor
          contract={contract}
          onContractChange={onContractChange}
          {...commonProps}
        />
      );

    case 'llm':
      return (
        <LLMInlineEditor
          contract={contract}
          onContractChange={onContractChange}
          {...commonProps}
        />
      );

    case 'embeddings': {
      const act = taskToAct(node?.task);
      return (
        <IntentEditorInlineEditor
          {...commonProps}
          act={act}
        />
      );
    }

    case 'grammarflow':
      return (
        <GrammarFlowInlineEditor
          contract={contract}
          onContractChange={onContractChange}
          taskId={taskId}
          mainList={mainList}
          dataTranslations={dataTranslations}
          {...commonProps}
        />
      );

    default:
      return null;
  }
}
