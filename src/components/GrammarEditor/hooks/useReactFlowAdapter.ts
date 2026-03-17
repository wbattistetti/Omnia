// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useMemo } from 'react';
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
    () => {
      if (!grammar) {
        console.log('[useReactFlowAdapter] ⚠️ No grammar, returning empty nodes');
        return [];
      }

      const result = grammar.nodes.map((n) => ({
        id: n.id,
        type: 'grammar',
        position: n.position,
        data: { node: n },
      }));

      console.log('[useReactFlowAdapter] ✅ Mapped nodes', {
        grammarId: grammar.id,
        grammarNodesCount: grammar.nodes.length,
        reactFlowNodesCount: result.length,
        nodeIds: result.map(n => n.id).slice(0, 3),
      });

      return result;
    },
    // ✅ CRITICAL: Include grammar and nodes array reference to detect changes
    [grammar, grammar?.nodes]
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

  // Debug log when grammar changes
  React.useEffect(() => {
    if (grammar) {
      console.log('[useReactFlowAdapter] 🔄 Grammar loaded in adapter', {
        grammarId: grammar.id,
        nodesCount: grammar.nodes.length,
        edgesCount: grammar.edges.length,
        slotsCount: grammar.slots.length,
        semanticSetsCount: grammar.semanticSets.length,
        reactFlowNodesCount: nodes.length,
        reactFlowEdgesCount: edges.length,
      });
    } else {
      console.warn('[useReactFlowAdapter] ⚠️ Grammar is null');
    }
  }, [grammar?.id, grammar?.nodes.length, grammar?.edges.length, nodes.length, edges.length]);

  return { nodes, edges, hasGrammar: grammar !== null };
}
