// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import type { NodeChange, Connection } from 'reactflow';
import { useGrammarStore } from '../core/state/grammarStore';
import { createGrammarNode } from '../core/domain/node';
import { v4 as uuidv4 } from 'uuid';
import type { GrammarEdge } from '../types/grammarTypes';

// Estimated node size in flow units used to center the node on the click point.
const ESTIMATED_NODE_WIDTH = 40;
const ESTIMATED_NODE_HEIGHT = 20;

/**
 * Hook for handling canvas-level events.
 * Single Responsibility: Event handling only.
 */
export function useGrammarCanvasEvents() {
  const rf = useReactFlow();
  const { grammar, addNode, addEdge, updateNode, selectNode, clearSelection } = useGrammarStore();

  const handlePaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (!grammar) return;
      if (!rf) return;

      const clickPos = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const centeredPos = {
        x: clickPos.x - ESTIMATED_NODE_WIDTH / 2,
        y: clickPos.y - ESTIMATED_NODE_HEIGHT / 2,
      };

      const newNode = createGrammarNode('', centeredPos);
      addNode(newNode);
    },
    [rf, addNode, grammar]
  );

  const handlePaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          updateNode(change.id, { position: change.position });
        }
      });
    },
    [updateNode]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !grammar) return;

      const edge: GrammarEdge = {
        id: uuidv4(),
        source: connection.source,
        target: connection.target,
        type: 'sequential',
      };
      addEdge(edge);
    },
    [addEdge, grammar]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  return {
    handlePaneDoubleClick,
    handlePaneClick,
    handleNodesChange,
    handleConnect,
    handleNodeClick,
  };
}
