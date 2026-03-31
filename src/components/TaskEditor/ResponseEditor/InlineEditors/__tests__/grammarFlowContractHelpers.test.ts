import { describe, it, expect } from 'vitest';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import type { Grammar } from '@components/GrammarEditor/types/grammarTypes';
import {
  fingerprintGrammarFromContract,
  fingerprintTestPhrasesFromContract,
  mergeGrammarFlowIntoContract,
  getGrammarFlowFromContract,
} from '../grammarFlowContractHelpers';

describe('grammarFlowContractHelpers', () => {
  it('grammar and test phrase fingerprints are independent', () => {
    const c1: DataContract = {
      engines: [{ type: 'grammarflow', grammarFlow: { id: 'g1', nodes: [] } as Grammar }],
      testPhrases: ['a'],
    };
    const c2: DataContract = {
      ...c1,
      testPhrases: ['b'],
    };
    expect(fingerprintGrammarFromContract(c1)).toBe(fingerprintGrammarFromContract(c2));
    expect(fingerprintTestPhrasesFromContract(c1)).not.toBe(fingerprintTestPhrasesFromContract(c2));
  });

  it('grammar fingerprint ignores grammar id', () => {
    const c1: DataContract = {
      engines: [{ type: 'grammarflow', grammarFlow: { id: 'a', nodes: [] } as Grammar }],
    };
    const c2: DataContract = {
      engines: [{ type: 'grammarflow', grammarFlow: { id: 'b', nodes: [] } as Grammar }],
    };
    expect(fingerprintGrammarFromContract(c1)).toBe(fingerprintGrammarFromContract(c2));
  });

  it('mergeGrammarFlowIntoContract embeds grammar and phrases', () => {
    const grammar = { id: 'x', nodes: [], edges: [] } as Grammar;
    const out = mergeGrammarFlowIntoContract(null, grammar, ['p1']);
    expect(getGrammarFlowFromContract(out)?.id).toBe('x');
    expect(out.testPhrases).toEqual(['p1']);
  });
});
