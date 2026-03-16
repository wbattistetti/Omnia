// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import { GrammarNode } from './GrammarNode';
import { GrammarEdge as GrammarEdgeComponent } from './GrammarEdge';

const nodeTypes = { grammar: GrammarNode };
const edgeTypes = { grammar: GrammarEdgeComponent };

interface GrammarCanvasViewProps {
  nodes: Node[];
  edges: Edge[];
  onPaneDoubleClick: (event: React.MouseEvent) => void;
  onPaneClick: () => void;
  onNodesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  onNodeClick: (event: React.MouseEvent, node: { id: string }) => void;
  onPaneMouseUp?: (event: React.MouseEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
}

/**
 * Pure view component for ReactFlow canvas.
 * Single Responsibility: Rendering only.
 *
 * Uses a native dblclick DOM listener because ReactFlow's onPaneDoubleClick
 * is not reliably fired in all versions.
 */
export function GrammarCanvasView({
  nodes,
  edges,
  onPaneDoubleClick,
  onPaneClick,
  onNodesChange,
  onConnect,
  onNodeClick,
  onPaneMouseUp,
  onDrop,
  onDragOver,
}: GrammarCanvasViewProps) {
  const canvasRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleDoubleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isNode = !!target?.closest('.react-flow__node');
      const isEdge = !!target?.closest('.react-flow__edge');
      const isControl = !!target?.closest('.react-flow__controls');

      if (!isNode && !isEdge && !isControl) {
        // Do NOT call preventDefault — it can interfere with focus acquisition
        // on the input that gets created immediately after this call.
        e.stopPropagation();
        onPaneDoubleClick(e as any);
      }
    };

    canvas.addEventListener('dblclick', handleDoubleClick, true);
    return () => canvas.removeEventListener('dblclick', handleDoubleClick, true);
  }, [onPaneDoubleClick]);

  return (
    <>
      <style>{`
        .grammar-canvas .react-flow__pane { cursor: default !important; }
        .grammar-canvas .react-flow__node { cursor: default; }
      `}</style>
      <div
        ref={canvasRef}
        className="grammar-canvas"
        style={{ width: '100%', height: '100%', position: 'relative' }}
        onMouseUp={onPaneMouseUp}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onPaneClick={onPaneClick}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          noDragClassName="nodrag"
          selectionOnDrag={true}
          panOnDrag={[1, 2]}
          fitView={false}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </>
  );
}
