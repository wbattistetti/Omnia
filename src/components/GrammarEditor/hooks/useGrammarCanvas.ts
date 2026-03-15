// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useGrammarStore } from '../core/state/grammarStore';
import { useNodeCreation } from '../features/node-creation/useNodeCreation';
import { useNodeInteractions } from './useNodeInteractions';
import { useEdgeInteractions } from './useEdgeInteractions';
import type { Node, Edge, Connection } from 'reactflow';

/**
 * Hook for grammar canvas (ReactFlow integration)
 */
export function useGrammarCanvas(reactFlowInstance?: any) {
  const { grammar, clearSelection } = useGrammarStore();
  const { createNodeAtPosition } = useNodeCreation();
  const nodeInteractions = useNodeInteractions();
  const edgeInteractions = useEdgeInteractions();

  const handlePaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handlePaneDoubleClick = useCallback((event: React.MouseEvent) => {
    // ReactFlow's onPaneDoubleClick only fires when clicking on the pane, not on nodes
    if (!reactFlowInstance) return;
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    // Create node centered on the double-click position (node will be in editing mode automatically)
    createNodeAtPosition(position, '');
  }, [createNodeAtPosition, reactFlowInstance]);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    edgeInteractions.handleEdgeCreate(connection.source, connection.target);
  }, [edgeInteractions]);

  // Convert grammar nodes to ReactFlow nodes
  const reactFlowNodes: Node[] = grammar?.nodes.map(node => ({
    id: node.id,
    type: 'grammar',
    position: node.position,
    data: { node },
  })) || [];

  // Convert grammar edges to ReactFlow edges
  const reactFlowEdges: Edge[] = grammar?.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'grammar',
    data: { edge },
  })) || [];

  return {
    nodes: reactFlowNodes,
    edges: reactFlowEdges,
    handlePaneClick,
    handlePaneDoubleClick,
    handleConnect,
    nodeInteractions,
    edgeInteractions,
  };
}
