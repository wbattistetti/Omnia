// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback, useState } from 'react';
import { useGrammarStore } from '../core/state/grammarStoreContext';
import {
  createSemanticSlot,
  createSemanticValue,
  createSemanticSet,
} from '../core/domain/semantic';

/**
 * Hook for semantic panel management
 * - Slots and semantic sets
 */
export function useSemanticPanel() {
  const { addSlot, addSemanticSet, grammar } = useGrammarStore();
  const [isOpen, setIsOpen] = useState(true);

  const createSlot = useCallback((name: string, type: 'string' | 'number' | 'date' | 'boolean' | 'object' = 'string') => {
    const slot = createSemanticSlot(name, type);
    addSlot(slot);
    return slot;
  }, [addSlot]);

  const createValue = useCallback((value: string, synonyms: string[] = []) => {
    const semanticValue = createSemanticValue(value, synonyms);
    return semanticValue;
  }, []);

  const createSet = useCallback((name: string) => {
    const set = createSemanticSet(name);
    addSemanticSet(set);
    return set;
  }, [addSemanticSet]);

  const togglePanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    isOpen,
    togglePanel,
    createSlot,
    createValue,
    createSet,
    slots: grammar?.slots || [],
    semanticSets: grammar?.semanticSets || [],
  };
}
