// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useModePropagation Hook
 *
 * Manages mode propagation (IA/Manual/Postponed) for nodes.
 * Handles automatic propagation of AI mode to children.
 */

import { useCallback } from 'react';
import type { SchemaNode, NodeMode } from '../types/wizard.types';
import { propagateMode, setModeWithoutPropagation } from '../services/modePropagationService';

export function useModePropagation(
  structure: SchemaNode[],
  onStructureChange: (structure: SchemaNode[]) => void
) {
  const setNodeMode = useCallback((nodeId: string, mode: NodeMode, propagate: boolean = true) => {
    const updated = propagate
      ? propagateMode(structure, nodeId, mode)
      : setModeWithoutPropagation(structure, nodeId, mode);
    onStructureChange(updated);
  }, [structure, onStructureChange]);

  return {
    setNodeMode
  };
}
