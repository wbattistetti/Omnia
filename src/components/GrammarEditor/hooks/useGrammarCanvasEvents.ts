// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import type { NodeChange, Connection } from 'reactflow';
import { useGrammarStore } from '../core/state/grammarStore';
import { createGrammarNode } from '../core/domain/node';
import { v4 as uuidv4 } from 'uuid';
import type { GrammarEdge } from '../types/grammarTypes';
import { ESTIMATED_NODE_WIDTH, ESTIMATED_NODE_HEIGHT } from '../constants/nodeConstants';
import { useDrag } from '../context/DragContext';

/**
 * Hook for handling canvas-level events.
 * Single Responsibility: Event handling only.
 */
export function useGrammarCanvasEvents() {
  const rf = useReactFlow();
  const { grammar, addNode, addEdge, updateNode, selectNode, clearSelection } = useGrammarStore();
  const { dragState, setDragState } = useDrag();

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

      // Focus immediately after ReactFlow renders the node
      // Double RAF: first waits for React commit, second waits for browser paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const selector = `[data-node-id="${newNode.id}"] input`;
          const input = document.querySelector(selector) as HTMLInputElement | null;
          if (input) {
            input.focus();
            input.select();
          }
        });
      });
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

  const handlePaneMouseUp = useCallback(
    (event: React.MouseEvent) => {
      if (!dragState || !rf || !grammar) return;

      const dropPos = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const centeredPos = {
        x: dropPos.x - ESTIMATED_NODE_WIDTH / 2,
        y: dropPos.y - ESTIMATED_NODE_HEIGHT / 2,
      };

      const newNode = createGrammarNode('', centeredPos);
      addNode(newNode);

      const edge: GrammarEdge = {
        id: uuidv4(),
        source: dragState.sourceNodeId,
        target: newNode.id,
        type: 'sequential',
      };
      addEdge(edge);

      setDragState(null);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const selector = `[data-node-id="${newNode.id}"] input`;
          const input = document.querySelector(selector) as HTMLInputElement | null;
          if (input) {
            input.focus();
            input.select();
          }
        });
      });
    },
    [dragState, rf, grammar, addNode, addEdge, setDragState]
  );

  // Cancel drag on escape or mouseup anywhere (if not on canvas)
  React.useEffect(() => {
    if (!dragState) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragState(null);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isOnCanvas = target?.closest('.grammar-canvas') || target?.closest('.react-flow');
      if (!isOnCanvas) {
        setDragState(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, setDragState]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  // Cancel drag on escape
  React.useEffect(() => {
    if (!dragState) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragState(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [dragState, setDragState]);

  return {
    handlePaneDoubleClick,
    handlePaneClick,
    handleNodesChange,
    handleConnect,
    handleNodeClick,
    handlePaneMouseUp,
  };
}
