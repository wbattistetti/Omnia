/**
 * Maps Omnia-neutral ConvAI workflow graph to React Flow nodes/edges (read-only canvas).
 */

import { MarkerType, type Edge, type Node } from 'reactflow';
import type {
  WorkspaceWorkflowEdge,
  WorkspaceWorkflowGraph,
  WorkspaceWorkflowNode,
} from '../core/types';

export type ElWorkflowNodeData = {
  label: string;
  kind: string;
  promptPreview: string;
  inheritsGlobalPrompt: boolean;
  /** When true, selected node shows «Edit in Omnia» toolbar. */
  showEditInOmnia?: boolean;
  importBusy?: boolean;
  onEditInOmnia?: (nodeId: string) => void;
  /** HTML5 drag source (handle ⋮⋮) → Omnia flow canvas. */
  onDragToOmniaFlow?: (nodeId: string, dataTransfer: DataTransfer) => void;
};

function nodePromptPreview(node: WorkspaceWorkflowNode): string {
  if (node.inheritsGlobalPrompt) return 'SYSTEM PROMPT';
  const text = node.promptText.trim();
  return text ? text.slice(0, 160) : '';
}

function edgeDisplayLabel(edge: WorkspaceWorkflowEdge): string | undefined {
  if (edge.label?.trim()) return edge.label.trim();
  if (edge.conditionKind === 'unconditional') return 'sempre';
  if (edge.conditionText?.trim()) return edge.conditionText.trim();
  return undefined;
}

function fallbackPositions(nodes: readonly WorkspaceWorkflowNode[]): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  const start = nodes.find((n) => n.kind === 'start');
  const rest = nodes.filter((n) => n.id !== start?.id);
  if (start) map.set(start.id, { x: 40, y: 220 });
  rest.forEach((n, i) => {
    map.set(n.id, { x: 320, y: 40 + i * 150 });
  });
  return map;
}

/** Builds React Flow graph for the ElevenLabs-style workflow canvas. */
export function buildReactFlowFromWorkspaceGraph(graph: WorkspaceWorkflowGraph): {
  nodes: Node<ElWorkflowNodeData>[];
  edges: Edge[];
} {
  const fallback = fallbackPositions(graph.nodes);
  const nodes: Node<ElWorkflowNodeData>[] = graph.nodes.map((n) => ({
    id: n.id,
    type: 'elWorkflow',
    position: n.position ?? fallback.get(n.id) ?? { x: 0, y: 0 },
    data: {
      label: n.label,
      kind: n.kind,
      promptPreview: nodePromptPreview(n),
      inheritsGlobalPrompt: n.inheritsGlobalPrompt === true,
    },
    draggable: false,
    selectable: true,
  }));

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    label: edgeDisplayLabel(e),
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
    style: { stroke: '#64748b', strokeWidth: 2 },
    labelStyle: { fill: '#e2e8f0', fontSize: 11, fontWeight: 500 },
    labelBgStyle: { fill: '#0f172a', fillOpacity: 0.9 },
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
  }));

  return { nodes, edges };
}
