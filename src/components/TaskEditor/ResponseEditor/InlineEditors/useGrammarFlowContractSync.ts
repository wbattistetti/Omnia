/**
 * Syncs local grammar + test phrase state from contract (standalone) or template cache (instance rows).
 * Grammar and test phrases use separate fingerprints so phrase edits do not reset the graph.
 */

import { useState, useEffect, useRef } from 'react';
import DialogueTaskService from '@services/DialogueTaskService';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import type { Grammar } from '@components/GrammarEditor/types/grammarTypes';
import {
  fingerprintGrammarFromContract,
  fingerprintTestPhrasesFromContract,
  getGrammarFlowFromContract,
  getTestPhrasesFromContract,
} from './grammarFlowContractHelpers';

export interface UseGrammarFlowContractSyncParams {
  contract: DataContract | null;
  useNodeContractOnly: boolean;
  nodeId: string | undefined;
  nodeTemplateId: string | undefined;
}

export interface UseGrammarFlowContractSyncResult {
  grammar: Grammar | null;
  setGrammar: React.Dispatch<React.SetStateAction<Grammar | null>>;
  testPhrases: string[];
  setTestPhrases: React.Dispatch<React.SetStateAction<string[]>>;
}

export function useGrammarFlowContractSync({
  contract,
  useNodeContractOnly,
  nodeId,
  nodeTemplateId,
}: UseGrammarFlowContractSyncParams): UseGrammarFlowContractSyncResult {
  const [grammar, setGrammar] = useState<Grammar | null>(() => {
    if (useNodeContractOnly) {
      return getGrammarFlowFromContract(contract);
    }
    if (nodeTemplateId) {
      const template = DialogueTaskService.getTemplate(nodeTemplateId);
      if (template) {
        const engines = template?.dataContract?.engines || [];
        const grammarFlowEngine = engines.find((e: any) => e.type === 'grammarflow');
        const grammarData = grammarFlowEngine?.grammarFlow || grammarFlowEngine?.GrammarFlow;
        if (grammarFlowEngine && grammarData) {
          return grammarData as Grammar;
        }
      }
    }
    return null;
  });

  const [testPhrases, setTestPhrases] = useState<string[]>(() => {
    if (useNodeContractOnly) {
      return getTestPhrasesFromContract(contract);
    }
    if (nodeTemplateId) {
      const template = DialogueTaskService.getTemplate(nodeTemplateId);
      return template?.dataContract?.testPhrases || [];
    }
    return [];
  });

  const lastGrammarFpRef = useRef<string>('');
  const lastTpFpRef = useRef<string>('');
  const lastNodeIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!useNodeContractOnly) {
      return;
    }
    if (nodeId !== lastNodeIdRef.current) {
      lastNodeIdRef.current = nodeId;
      lastGrammarFpRef.current = '';
      lastTpFpRef.current = '';
    }
    const gfp = fingerprintGrammarFromContract(contract);
    if (gfp !== lastGrammarFpRef.current) {
      lastGrammarFpRef.current = gfp;
      setGrammar(getGrammarFlowFromContract(contract));
    }
    const tfp = fingerprintTestPhrasesFromContract(contract);
    if (tfp !== lastTpFpRef.current) {
      lastTpFpRef.current = tfp;
      setTestPhrases(getTestPhrasesFromContract(contract));
    }
  }, [useNodeContractOnly, contract, nodeId]);

  useEffect(() => {
    if (useNodeContractOnly) {
      return;
    }
    if (!nodeTemplateId) {
      setGrammar(null);
      setTestPhrases([]);
      return;
    }
    const template = DialogueTaskService.getTemplate(nodeTemplateId);
    if (!template) {
      setGrammar(null);
      setTestPhrases([]);
      return;
    }
    const engines = template?.dataContract?.engines || [];
    const grammarFlowEngine = engines.find((e: any) => e.type === 'grammarflow');
    const grammarData = grammarFlowEngine?.grammarFlow || grammarFlowEngine?.GrammarFlow;
    if (grammarFlowEngine && grammarData) {
      setGrammar(grammarData as Grammar);
    } else {
      setGrammar(null);
    }
    setTestPhrases(template?.dataContract?.testPhrases || []);
  }, [useNodeContractOnly, nodeTemplateId, nodeId]);

  return { grammar, setGrammar, testPhrases, setTestPhrases };
}
