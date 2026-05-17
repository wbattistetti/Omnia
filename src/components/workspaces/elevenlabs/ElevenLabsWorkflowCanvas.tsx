/**
 * React Flow canvas mirroring ElevenLabs ConvAI workflow (API layout + local drag overrides).
 */

import React from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type NodeDragHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { WorkspaceWorkflowGraph } from '@workspaces/core/types';
import {
  buildReactFlowFromWorkspaceGraph,
  type ElWorkflowNodeData,
} from '@workspaces/elevenlabs/convaiWorkflowToReactFlow';
import {
  mergeWorkflowPositionOverrides,
  overridesFromReactFlowNodes,
  type WorkflowPositionOverrides,
} from '@workspaces/elevenlabs/workflowLayoutPositions';
import { ElevenLabsWorkflowNodeCard } from './ElevenLabsWorkflowNodeCard';
import { ReactFlowContainerResize } from './reactFlowContainerResize';

const nodeTypes = { elWorkflow: ElevenLabsWorkflowNodeCard };

export type ElevenLabsWorkflowCanvasProps = {
  graph: WorkspaceWorkflowGraph;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onEditInOmnia?: (nodeId: string) => void;
  onDragToOmniaFlow?: (nodeId: string, dataTransfer: DataTransfer) => void;
  importBusy?: boolean;
  /** Persisted layout overrides from session (merged before build). */
  positionOverrides?: WorkflowPositionOverrides;
  onPositionOverridesChange?: (overrides: WorkflowPositionOverrides) => void;
};

function CanvasInner({
  graph,
  selectedNodeId,
  onSelectNode,
  onEditInOmnia,
  onDragToOmniaFlow,
  importBusy = false,
  positionOverrides,
  onPositionOverridesChange,
}: ElevenLabsWorkflowCanvasProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mergedGraph = React.useMemo(
    () => mergeWorkflowPositionOverrides(graph, positionOverrides),
    [graph, positionOverrides]
  );

  const built = React.useMemo(
    () => buildReactFlowFromWorkspaceGraph(mergedGraph, { nodesDraggable: true }),
    [mergedGraph]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);
  const nodesRef = React.useRef(nodes);
  nodesRef.current = nodes;
  const graphKeyRef = React.useRef('');

  const graphStructureKey = React.useMemo(() => {
    const nIds = graph.nodes.map((n) => n.id).join(',');
    const eIds = graph.edges.map((e) => e.id).join(',');
    const posKey = graph.nodes
      .map((n) => (n.position ? `${n.id}:${n.position.x},${n.position.y}` : n.id))
      .join('|');
    const ovKey = positionOverrides ? JSON.stringify(positionOverrides) : '';
    return `${nIds}#${eIds}#${posKey}#${ovKey}`;
  }, [graph.nodes, graph.edges, positionOverrides]);

  React.useEffect(() => {
    if (graphKeyRef.current === graphStructureKey) return;
    graphKeyRef.current = graphStructureKey;
    setNodes(built.nodes);
    setEdges(built.edges);
  }, [graphStructureKey, built.nodes, built.edges, setNodes, setEdges]);

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

  const onNodeDragStop: NodeDragHandler = React.useCallback(() => {
    if (!onPositionOverridesChange) return;
    onPositionOverridesChange(overridesFromReactFlowNodes(nodesRef.current));
  }, [onPositionOverridesChange]);

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
    <div ref={containerRef} className="relative h-full min-h-0 w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        selectNodesOnDrag={false}
        noDragClassName="nodrag"
        noPanClassName="nopan"
        panOnDrag={[2]}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <ReactFlowContainerResize containerRef={containerRef} layoutKey={graphStructureKey} />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#334155" />
        <Controls showInteractive={false} className="!border-slate-700 !bg-slate-900/90" />
      </ReactFlow>
      <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-slate-900/80 px-2 py-1 text-[10px] text-slate-500">
        Trascina i nodi per riposizionare · tasto centrale per pan · ⋮⋮ verso canvas Omnia
      </p>
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