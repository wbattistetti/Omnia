/**
 * Contract Editor Wrapper
 * Wraps individual contract editors (Regex, Rules, NER, LLM, Embeddings)
 * Shows editor when contract is added and enabled
 */

import React from 'react';
import type { DataContract, DataContractItem } from '@components/DialogueDataEngine/contracts/contractLoader';
import type { ContractMethod } from '@responseEditor/ContractSelector/ContractSelector';
import RegexInlineEditor from '@responseEditor/InlineEditors/RegexInlineEditor';
import ExtractorInlineEditor from '@responseEditor/InlineEditors/ExtractorInlineEditor';
import NERInlineEditor from '@responseEditor/InlineEditors/NERInlineEditor';
import LLMInlineEditor from '@responseEditor/InlineEditors/LLMInlineEditor';
import IntentEditorInlineEditor from '@responseEditor/InlineEditors/IntentEditorInlineEditor';

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
  // Get method data from contract.contracts array
  const methodData = React.useMemo(() => {
    if (!contract?.contracts || !Array.isArray(contract.contracts)) {
      return null;
    }
    return contract.contracts.find(c => c.type === method) || null;
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
            const updatedContracts = contract.contracts.map(c =>
              c.type === 'regex' ? { ...c, patterns: [value] } : c
            );
            const updatedContract: DataContract = {
              ...contract,
              contracts: updatedContracts,
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

    default:
      return null;
  }
}
