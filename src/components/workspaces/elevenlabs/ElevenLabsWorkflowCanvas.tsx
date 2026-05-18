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
  type Node,
  type NodeDragHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './elevenLabsWorkflowCanvas.css';
import type { WorkspaceWorkflowGraph, WorkspaceWorkflowNode } from '@workspaces/core/types';
import {
  buildReactFlowFromWorkspaceGraph,
  workflowNodePromptTooltip,
  type ElWorkflowNodeData,
} from '@workspaces/elevenlabs/convaiWorkflowToReactFlow';
import {
  mergeWorkflowPositionOverrides,
  overridesFromReactFlowNodes,
  type WorkflowPositionOverrides,
} from '@workspaces/elevenlabs/workflowLayoutPositions';
import {
  addNodeToWorkflowPatch,
  applyWorkflowCanvasLocalPatch,
  duplicateWorkflowNode,
  removeNodeFromWorkflowPatch,
  type WorkflowCanvasLocalPatch,
} from '@workspaces/elevenlabs/workflowCanvasLocalPatch';
import { ElevenLabsWorkflowNodeCard } from './ElevenLabsWorkflowNodeCard';
import { ReactFlowContainerResize } from './reactFlowContainerResize';
import { useElWorkflowRigidDrag } from './useElWorkflowRigidDrag';
import { FlowPanZoomOverview } from '@components/Flowchart/panZoom/FlowPanZoomOverview';
import {
  ELEVENLABS_WORKFLOW_BACKGROUND_ID,
  ELEVENLABS_WORKFLOW_REACT_FLOW_ID,
} from '@components/Flowchart/flowReactFlowInstanceIds';

const nodeTypes = { elWorkflow: ElevenLabsWorkflowNodeCard };

export type ElevenLabsWorkflowCanvasProps = {
  graph: WorkspaceWorkflowGraph;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onDragToOmniaFlow?: (nodeId: string, dataTransfer: DataTransfer) => void;
  positionOverrides?: WorkflowPositionOverrides;
  onPositionOverridesChange?: (overrides: WorkflowPositionOverrides) => void;
  workflowCanvasPatch?: WorkflowCanvasLocalPatch;
  onWorkflowCanvasPatchChange?: (patch: WorkflowCanvasLocalPatch) => void;
  globalPrompt?: string;
};

function canDuplicateNode(kind: string): boolean {
  return kind === 'subagent' || kind === 'tool';
}

function canDeleteNode(kind: string): boolean {
  return kind !== 'start';
}

function CanvasInner({
  graph,
  selectedNodeId,
  onSelectNode,
  onDragToOmniaFlow,
  positionOverrides,
  onPositionOverridesChange,
  workflowCanvasPatch,
  onWorkflowCanvasPatchChange,
  globalPrompt = '',
}: ElevenLabsWorkflowCanvasProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const patch = workflowCanvasPatch ?? { addedNodes: [], removedNodeIds: [] };

  const mergedGraph = React.useMemo(() => {
    const withPatch = applyWorkflowCanvasLocalPatch(graph, patch);
    return mergeWorkflowPositionOverrides(withPatch, positionOverrides);
  }, [graph, patch, positionOverrides]);

  const nodesById = React.useMemo(
    () => new Map(mergedGraph.nodes.map((n) => [n.id, n])),
    [mergedGraph.nodes]
  );

  const built = React.useMemo(
    () => buildReactFlowFromWorkspaceGraph(mergedGraph, { nodesDraggable: true }),
    [mergedGraph]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);
  const [repaintKey, setRepaintKey] = React.useState(0);
  const nodesRef = React.useRef(nodes);
  nodesRef.current = nodes;
  const topologyKeyRef = React.useRef('');
  const bumpCanvasRepaint = React.useCallback(() => {
    setRepaintKey((k) => k + 1);
  }, []);

  const { onNodeDragStart, onNodeDrag, onNodeDragStop: onRigidDragStop } =
    useElWorkflowRigidDrag(edges, setNodes);

  const handleCopyNode = React.useCallback(
    (nodeId: string) => {
      if (!onWorkflowCanvasPatchChange) return;
      const source = nodesById.get(nodeId);
      const rf = nodesRef.current.find((n) => n.id === nodeId);
      if (!source || !rf || !canDuplicateNode(source.kind)) return;

      const copy = duplicateWorkflowNode(source, rf.position);
      const nextPatch = addNodeToWorkflowPatch(patch, copy);
      onWorkflowCanvasPatchChange(nextPatch);
      if (copy.position && onPositionOverridesChange) {
        onPositionOverridesChange({
          ...(positionOverrides ?? {}),
          [copy.id]: { ...copy.position },
        });
      }
      onSelectNode(copy.id);
    },
    [
      nodesById,
      onWorkflowCanvasPatchChange,
      patch,
      onPositionOverridesChange,
      positionOverrides,
      onSelectNode,
    ]
  );

  const handleDeleteNode = React.useCallback(
    (nodeId: string) => {
      if (!onWorkflowCanvasPatchChange) return;
      const source = nodesById.get(nodeId);
      if (!source || !canDeleteNode(source.kind)) return;
      onWorkflowCanvasPatchChange(removeNodeFromWorkflowPatch(patch, nodeId));
      if (selectedNodeId === nodeId) onSelectNode(null);
    },
    [nodesById, onWorkflowCanvasPatchChange, patch, selectedNodeId, onSelectNode]
  );

  const enrichNodeData = React.useCallback(
    (n: Node<ElWorkflowNodeData>, wsNode: WorkspaceWorkflowNode | undefined) => {
      const kind = n.data?.kind ?? '';
      const editable = kind === 'subagent' || kind === 'tool';
      return {
        ...n,
        selected: n.id === selectedNodeId,
        data: {
          ...n.data,
          promptTooltip: wsNode ? workflowNodePromptTooltip(wsNode, globalPrompt) : '',
          onDragToOmniaFlow: editable ? onDragToOmniaFlow : undefined,
          onCopyNode: canDuplicateNode(kind) ? handleCopyNode : undefined,
          onDeleteNode: canDeleteNode(kind) ? handleDeleteNode : undefined,
        },
      };
    },
    [selectedNodeId, globalPrompt, onDragToOmniaFlow, handleCopyNode, handleDeleteNode]
  );

  /** Node/edge/patch identity — full resync when this changes. */
  const graphTopologyKey = React.useMemo(() => {
    const nIds = mergedGraph.nodes.map((n) => n.id).join(',');
    const eIds = mergedGraph.edges.map((e) => e.id).join(',');
    const patchKey = JSON.stringify(patch);
    return `${nIds}#${eIds}#${patchKey}`;
  }, [mergedGraph.nodes, mergedGraph.edges, patch]);

  /** Positions / overrides — layout sync only (no full graph rebuild). */
  const graphLayoutKey = React.useMemo(() => {
    const posKey = mergedGraph.nodes
      .map((n) => (n.position ? `${n.id}:${n.position.x},${n.position.y}` : n.id))
      .join('|');
    const ovKey = positionOverrides ? JSON.stringify(positionOverrides) : '';
    return `${posKey}#${ovKey}`;
  }, [mergedGraph.nodes, positionOverrides]);

  React.useEffect(() => {
    if (topologyKeyRef.current === graphTopologyKey) return;
    topologyKeyRef.current = graphTopologyKey;
    setNodes(built.nodes.map((n) => enrichNodeData(n, nodesById.get(n.id))));
    setEdges(built.edges);
    bumpCanvasRepaint();
  }, [graphTopologyKey, built.nodes, built.edges, setNodes, setEdges, bumpCanvasRepaint, enrichNodeData, nodesById]);

  React.useEffect(() => {
    setNodes(built.nodes.map((n) => enrichNodeData(n, nodesById.get(n.id))));
    setEdges(built.edges);
  }, [graphLayoutKey, built.nodes, built.edges, setNodes, setEdges, enrichNodeData, nodesById]);

  React.useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => enrichNodeData(n, nodesById.get(n.id)))
    );
  }, [selectedNodeId, setNodes, enrichNodeData, nodesById]);

  const onNodeDragStop: NodeDragHandler = React.useCallback(
    (...args) => {
      onRigidDragStop(...args);
      if (onPositionOverridesChange) {
        onPositionOverridesChange(overridesFromReactFlowNodes(nodesRef.current));
      }
      bumpCanvasRepaint();
    },
    [onRigidDragStop, onPositionOverridesChange, bumpCanvasRepaint]
  );

  const onNodeClick = React.useCallback(
    (_: React.MouseEvent, node: Node<ElWorkflowNodeData>) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  const onPaneClick = React.useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  if (mergedGraph.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Nessun nodo nel workflow remoto.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="el-workflow-canvas relative flex h-full min-h-0 w-full flex-1 flex-col"
    >
      <ReactFlow
        id={ELEVENLABS_WORKFLOW_REACT_FLOW_ID}
        className="h-full w-full"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
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
        <ReactFlowContainerResize
          containerRef={containerRef}
          layoutKey={graphTopologyKey}
          repaintKey={repaintKey}
        />
        <Background
          id={ELEVENLABS_WORKFLOW_BACKGROUND_ID}
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#334155"
        />
        <Controls showInteractive={false} className="!border-slate-700 !bg-slate-900/90" />
        <FlowPanZoomOverview
          nodes={nodes}
          viewportHostRef={containerRef}
          theme="dark"
          reactFlowInstanceId={ELEVENLABS_WORKFLOW_REACT_FLOW_ID}
        />
      </ReactFlow>
      <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-slate-900/80 px-2 py-1 text-[10px] text-slate-500">
        Trascina i nodi per riposizionare · ancoraggio per spostare il ramo · tasto centrale per pan · ⋮⋮ verso canvas Omnia
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
