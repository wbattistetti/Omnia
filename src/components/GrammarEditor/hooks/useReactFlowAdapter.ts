// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import { MarkerType } from 'reactflow';
import { useGrammarStore } from '../core/state/grammarStore';

/**
 * Hook for transforming Zustand grammar state to ReactFlow format.
 * Single Responsibility: Data transformation only.
 */
export function useReactFlowAdapter() {
  const { grammar } = useGrammarStore();

  const nodes: Node[] = useMemo(
    () =>
      (grammar?.nodes ?? []).map((n) => ({
        id: n.id,
        type: 'grammar',
        position: n.position,
        data: { node: n },
      })),
    [grammar?.nodes]
  );

  const edges: Edge[] = useMemo(
    () =>
      (grammar?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'grammar',
        data: { edge: e },
        markerEnd: {
          type: MarkerType.Arrow,
          width: 12,
          height: 12,
          color: '#6b7280',
        },
      })),
    [grammar?.edges]
  );

  return { nodes, edges, hasGrammar: grammar !== null };
}
