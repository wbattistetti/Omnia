/**
 * Maps Omnia-neutral ConvAI workflow graph to React Flow nodes/edges (editable layout canvas).
 */

import { Position, type Edge, type Node } from 'reactflow';
import type {
  WorkspaceWorkflowEdge,
  WorkspaceWorkflowGraph,
  WorkspaceWorkflowNode,
} from '../core/types';
import { buildElevenLabsStyleEdge } from './workflowEdgeStyle';
import {
  buildPositionMapForHandleInference,
  inferNodeHandlePositions,
} from './inferWorkflowNodeHandles';
import type { WorkflowNodePosition } from './workflowLayoutPositions';

export type ElWorkflowNodeData = {
  label: string;
  kind: string;
  promptPreview: string;
  /** Full text for IA tooltip (not shown in card body). */
  promptTooltip?: string;
  inheritsGlobalPrompt: boolean;
  /** HTML5 drag source (handle ⋮⋮) → Omnia flow canvas. */
  onDragToOmniaFlow?: (nodeId: string, dataTransfer: DataTransfer) => void;
  onCopyNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  targetHandlePosition?: Position;
  sourceHandlePosition?: Position;
};

/** Tooltip body for IA icon (full prompt, not card preview). */
export function workflowNodePromptTooltip(
  node: WorkspaceWorkflowNode,
  globalPrompt: string
): string {
  if (node.inheritsGlobalPrompt) {
    const g = globalPrompt.trim();
    return g || 'SYSTEM PROMPT (ereditato dall’agente ConvAI)';
  }
  return node.promptText.trim();
}

function nodePromptPreview(node: WorkspaceWorkflowNode): string {
  if (node.inheritsGlobalPrompt) return 'SYSTEM PROMPT';
  const text = node.promptText.trim();
  return text ? text.slice(0, 160) : '';
}

/** Organic left-to-right layout when API omits `position` (closer to EL editor than vertical stack). */
function fallbackPositions(nodes: readonly WorkspaceWorkflowNode[]): Map<string, WorkflowNodePosition> {
  const map = new Map<string, WorkflowNodePosition>();
  const start = nodes.find((n) => n.kind === 'start');
  const rest = nodes.filter((n) => n.id !== start?.id);
  if (start) map.set(start.id, { x: 80, y: 200 });
  rest.forEach((n, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    map.set(n.id, { x: 360 + col * 280, y: 60 + row * 160 });
  });
  return map;
}

function resolveNodePosition(
  n: WorkspaceWorkflowNode,
  fallback: Map<string, WorkflowNodePosition>
): WorkflowNodePosition {
  return n.position ?? fallback.get(n.id) ?? { x: 0, y: 0 };
}

export type BuildReactFlowOptions = {
  /** When true, nodes can be dragged on the workspace canvas (Omnia grip still uses nodrag). */
  nodesDraggable?: boolean;
};

/** Builds React Flow graph for the ElevenLabs-style workflow canvas. */
export function buildReactFlowFromWorkspaceGraph(
  graph: WorkspaceWorkflowGraph,
  options?: BuildReactFlowOptions
): {
  nodes: Node<ElWorkflowNodeData>[];
  edges: Edge[];
  resolvedPositions: Map<string, WorkflowNodePosition>;
} {
  const fallback = fallbackPositions(graph.nodes);
  const resolvedPositions = new Map<string, WorkflowNodePosition>();
  for (const n of graph.nodes) {
    resolvedPositions.set(n.id, resolveNodePosition(n, fallback));
  }

  const handlePosMap = buildPositionMapForHandleInference(graph.nodes, resolvedPositions);
  const draggable = options?.nodesDraggable === true;

  const nodes: Node<ElWorkflowNodeData>[] = graph.nodes.map((n) => {
    const handles = inferNodeHandlePositions(n.id, handlePosMap, graph.edges);
    const isStart = n.kind === 'start';
    const isEnd = n.kind === 'end';
    return {
      id: n.id,
      type: 'elWorkflow',
      position: resolvedPositions.get(n.id) ?? { x: 0, y: 0 },
      sourcePosition: isEnd ? undefined : handles.sourcePosition,
      targetPosition: isStart ? undefined : handles.targetPosition,
      data: {
        label: n.label,
        kind: n.kind,
        promptPreview: nodePromptPreview(n),
        inheritsGlobalPrompt: n.inheritsGlobalPrompt === true,
        targetHandlePosition: isStart ? undefined : handles.targetPosition,
        sourceHandlePosition: isEnd ? undefined : handles.sourcePosition,
      },
      draggable,
      selectable: true,
    };
  });

  const edges: Edge[] = graph.edges.map((e) => buildElevenLabsStyleEdge(e));

  return { nodes, edges, resolvedPositions };
}

/** Re-export for tests that imported edgeDisplayLabel from here. */
export { edgeDisplayLabel } from './workflowEdgeStyle';
