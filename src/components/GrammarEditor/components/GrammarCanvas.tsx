// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { useReactFlowAdapter } from '../hooks/useReactFlowAdapter';
import { useGrammarCanvasEvents } from '../hooks/useGrammarCanvasEvents';
import { GrammarCanvasView } from './GrammarCanvasView';
import { DragProvider } from '../context/DragContext';

/**
 * Inner component — must be inside ReactFlowProvider.
 * Single Responsibility: Composition of hooks and view.
 */
function GrammarCanvasInner() {
  const { nodes, edges } = useReactFlowAdapter();
  const {
    handlePaneDoubleClick,
    handlePaneClick,
    handleNodesChange,
    handleConnect,
    handleNodeClick,
    handlePaneMouseUp,
  } = useGrammarCanvasEvents();

  return (
    <GrammarCanvasView
      nodes={nodes}
      edges={edges}
      onPaneDoubleClick={handlePaneDoubleClick}
      onPaneClick={handlePaneClick}
      onNodesChange={handleNodesChange}
      onConnect={handleConnect}
      onNodeClick={handleNodeClick}
      onPaneMouseUp={handlePaneMouseUp}
    />
  );
}

/**
 * Public component — wraps with ReactFlowProvider.
 */
export function GrammarCanvas() {
  return (
    <ReactFlowProvider>
      <DragProvider>
        <GrammarCanvasInner />
      </DragProvider>
    </ReactFlowProvider>
  );
}
