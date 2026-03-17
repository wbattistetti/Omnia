/**
 * Contract Editor Wrapper
 * Wraps individual contract editors (Regex, Rules, NER, LLM, Embeddings)
 * Shows editor when contract is added and enabled
 */

import React from 'react';
import type { DataContract, DataContractItem } from '@components/DialogueDataEngine/parsers/contractLoader';
import type { ContractMethod } from '@responseEditor/ContractSelector/ContractSelector';
import RegexInlineEditor from '@responseEditor/InlineEditors/RegexInlineEditor';
import ExtractorInlineEditor from '@responseEditor/InlineEditors/ExtractorInlineEditor';
import NERInlineEditor from '@responseEditor/InlineEditors/NERInlineEditor';
import LLMInlineEditor from '@responseEditor/InlineEditors/LLMInlineEditor';
import IntentEditorInlineEditor from '@responseEditor/InlineEditors/IntentEditorInlineEditor';
import GrammarFlowInlineEditor from '@responseEditor/InlineEditors/GrammarFlowInlineEditor';

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
          onRegexSave={(value: string) => {
            if (!contract) return;
            const engines = contract.engines || [];
            const updatedEngines = engines.map(c =>
              c.type === 'regex' ? { ...c, patterns: [value] } : c
            );
            const updatedContract: DataContract = {
              ...contract,
              engines: updatedEngines,
            };
            onContractChange(updatedContract);
          }}
          kind={kind}
          {...commonProps}
        />
      );

    case 'rules':
      return (
        <ExtractorInlineEditor
          {...commonProps}
        />
      );

    case 'ner':
      return (
        <NERInlineEditor
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

    case 'embeddings':
      return (
        <IntentEditorInlineEditor
          {...commonProps}
          task={node?.task}
        />
      );

    case 'grammarflow':
      return (
        <GrammarFlowInlineEditor
          contract={contract}
          onContractChange={onContractChange}
          {...commonProps}
        />
      );

    default:
      return null;
  }
}
