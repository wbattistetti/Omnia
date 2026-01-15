/**
 * Contract Editor Wrapper
 * Wraps individual contract editors (Regex, Rules, NER, LLM, Embeddings)
 * Shows editor when contract is added and enabled
 */

import React from 'react';
import type { NLPContract } from '../../../../components/DialogueDataEngine/contracts/contractLoader';
import type { ContractMethod } from './ContractSelector';
import RegexInlineEditor from '../InlineEditors/RegexInlineEditor';
import ExtractorInlineEditor from '../InlineEditors/ExtractorInlineEditor';
import NERInlineEditor from '../InlineEditors/NERInlineEditor';
import LLMInlineEditor from '../InlineEditors/LLMInlineEditor';
import IntentEditorInlineEditor from '../InlineEditors/IntentEditorInlineEditor';

interface ContractEditorWrapperProps {
  method: ContractMethod;
  contract: NLPContract | null;
  onContractChange: (contract: NLPContract) => void;
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
  // Get method data from contract
  const methodData = React.useMemo(() => {
    if (!contract?.methods?.[method]) {
      // Legacy fallback
      switch (method) {
        case 'regex':
          return contract?.regex;
        case 'rules':
          return contract?.rules;
        case 'ner':
          return contract?.ner;
        case 'llm':
          return contract?.llm;
        default:
          return null;
      }
    }
    return contract.methods[method];
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
          regex={methodData.patterns?.[0] || ''}
          setRegex={(value: string) => {
            if (!contract) return;
            const updatedContract: NLPContract = {
              ...contract,
              methods: {
                ...contract.methods,
                regex: {
                  ...methodData,
                  patterns: [value],
                },
              },
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
