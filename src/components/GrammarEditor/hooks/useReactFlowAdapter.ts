// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import { MarkerType } from 'reactflow';
import { useGrammarStore } from '../core/state/grammarStore';
import { isGrammarEditorDebugEnabled } from '../grammarEditorLoadPolicy';

/**
 * Hook for transforming Zustand grammar state to ReactFlow format.
 * Single Responsibility: Data transformation only.
 */
export function useReactFlowAdapter() {
  const { grammar } = useGrammarStore();
  const dbg = isGrammarEditorDebugEnabled();

  const nodes: Node[] = useMemo(
    () => {
      if (!grammar) {
        return [];
      }

      const result = grammar.nodes.map((n) => ({
        id: n.id,
        type: 'grammar',
        position: n.position,
        data: { node: n },
      }));

      if (dbg) {
        console.log('[useReactFlowAdapter] Mapped nodes', {
          grammarId: grammar.id,
          count: result.length,
        });
      }

      return result;
    },
    [grammar, grammar?.nodes, dbg]
  );

  const edges: Edge[] = useMemo(
    () => {
      if (!grammar) {
        return [];
      }

      return grammar.edges.map((e) => ({
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
      }));
    },
    [grammar, grammar?.edges?.length]
  );

  React.useEffect(() => {
    if (!dbg) return;
    if (grammar) {
      console.log('[useReactFlowAdapter] grammar in adapter', {
        grammarId: grammar.id,
        nodesCount: grammar.nodes.length,
        edgesCount: grammar.edges.length,
      });
    }
  }, [dbg, grammar?.id, grammar?.nodes.length, grammar?.edges.length, nodes.length, edges.length]);

  return { nodes, edges, hasGrammar: grammar !== null };
}
