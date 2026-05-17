/**
 * Read-only React Flow canvas mirroring ElevenLabs ConvAI workflow graph.
 */

import React from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { WorkspaceWorkflowGraph } from '@workspaces/core/types';
import {
  buildReactFlowFromWorkspaceGraph,
  type ElWorkflowNodeData,
} from '@workspaces/elevenlabs/convaiWorkflowToReactFlow';
import { ElevenLabsWorkflowNodeCard } from './ElevenLabsWorkflowNodeCard';

const nodeTypes = { elWorkflow: ElevenLabsWorkflowNodeCard };

export type ElevenLabsWorkflowCanvasProps = {
  graph: WorkspaceWorkflowGraph;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  /** Import nodo selezionato nel task Agente AI (toolbar «Edit in Omnia»). */
  onEditInOmnia?: (nodeId: string) => void;
  /** Avvia drag HTML5 verso canvas Omnia (payload completo). */
  onDragToOmniaFlow?: (nodeId: string, dataTransfer: DataTransfer) => void;
  importBusy?: boolean;
};

function CanvasInner({
  graph,
  selectedNodeId,
  onSelectNode,
  onEditInOmnia,
  onDragToOmniaFlow,
  importBusy = false,
}: ElevenLabsWorkflowCanvasProps): React.ReactElement {
  const built = React.useMemo(() => buildReactFlowFromWorkspaceGraph(graph), [graph]);
  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);

  React.useEffect(() => {
    setNodes(built.nodes);
    setEdges(built.edges);
  }, [built.nodes, built.edges, setNodes, setEdges]);

  React.useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        const kind = n.data?.kind ?? '';
        const editable = kind === 'subagent' || kind === 'tool';
        return {
          ...n,
          selected: n.id === selectedNodeId,
          data: {
            ...n.data,
            showEditInOmnia: editable,
            importBusy,
            onEditInOmnia: editable ? onEditInOmnia : undefined,
            onDragToOmniaFlow: editable ? onDragToOmniaFlow : undefined,
          },
        };
      })
    );
  }, [selectedNodeId, setNodes, onEditInOmnia, onDragToOmniaFlow, importBusy]);

  const onNodeClick = React.useCallback(
    (_: React.MouseEvent, node: Node<ElWorkflowNodeData>) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  const onPaneClick = React.useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  if (graph.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Nessun nodo nel workflow remoto.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        selectNodesOnDrag={false}
        noDragClassName="nodrag"
        noPanClassName="nopan"
        panOnDrag={[2]}
        fitView
        fitViewOptions={{ padding: 0.35, maxZoom: 1.2 }}
        minZoom={0.25}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#334155" />
        <Controls showInteractive={false} className="!border-slate-700 !bg-slate-900/90" />
      </ReactFlow>
    </div>
  );
}

export function ElevenLabsWorkflowCanvas(props: ElevenLabsWorkflowCanvasProps): React.ReactElement {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
