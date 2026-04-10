import type { Flow, FlowId } from './FlowTypes';
import type { WorkspaceState } from './FlowTypes';
import type { Task } from '../types/taskTypes';
import type { VariableInstance } from '../types/variableTypes';
import type { FlowSubflowBindingPersisted } from '../domain/flowDocument/FlowDocument';
import type { Node } from 'reactflow';
import type { FlowNode } from '../components/Flowchart/types/flowTypes';
import { transformNodesToReactFlow, transformEdgesToReactFlow } from './flowTransformers';
import { logFlowSaveDebug } from '../utils/flowSaveDebug';
import { logFlowHydrationTrace } from '../utils/flowHydrationTrace';
import { loadFlowDocument, saveFlowDocument } from './flowDocumentPersistence';
import { applyFlowDocumentToStores } from '../domain/flowDocument/applyFlowDocumentToStores';
import { flowDocumentToFlowMeta } from '../domain/flowDocument/flowDocumentBridge';
import { assertFlowDocument } from '../domain/flowDocument/validateFlowDocument';
import { buildFlowDocumentFromFlowSlice } from '../domain/flowDocument/flowDocumentSerialize';

export async function listFlows(projectId: string): Promise<{ id: FlowId; updatedAt?: string }[]> {
  if (!projectId || String(projectId).trim() === '') {
    return [];
  }
  const url = `/api/projects/${encodeURIComponent(projectId)}/flows`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('listFlows_failed');
  const json = await res.json();
  const items = Array.isArray(json?.items) ? json.items : [];
  return items;
}

export type FlowLoadResult = {
  nodes: Node<FlowNode>[];
  edges: any[];
  meta?: Flow['meta'];
  tasks: Task[];
  variables: VariableInstance[];
  bindings: FlowSubflowBindingPersisted[];
};

/**
 * Load one flow as FlowDocument (atomic); applies tasks/variables to stores; returns ReactFlow graph + meta.
 * FLOW.SAVE-BULK REFACTOR — `meta` includes `translations` from FlowDocument (flow slice source of truth for labels).
 */
export async function loadFlow(projectId: string, flowId: FlowId): Promise<FlowLoadResult> {
  if (!projectId || String(projectId).trim() === '') {
    return { nodes: [], edges: [], tasks: [], variables: [], bindings: [] };
  }
  const doc = await loadFlowDocument(projectId, flowId);
  assertFlowDocument(doc);
  applyFlowDocumentToStores(doc);
  const nodes = transformNodesToReactFlow(doc.nodes as any[]);
  const edges = transformEdgesToReactFlow(doc.edges as any[]);
  const meta = flowDocumentToFlowMeta(doc);

  logFlowHydrationTrace('loadFlow result (after transform to React Flow)', {
    projectId,
    flowId,
    reactNodeCount: nodes.length,
    reactEdgeCount: edges.length,
    simplifiedNodeCount: doc.nodes.length,
    simplifiedEdgeCount: doc.edges.length,
    firstNodeRowSample:
      nodes[0] && (nodes[0] as any).data?.rows
        ? ((nodes[0] as any).data.rows as unknown[]).length
        : null,
  });

  logFlowSaveDebug('loadFlow: FlowDocument applied', {
    projectId,
    flowId,
    simplifiedNodeCount: doc.nodes.length,
    simplifiedEdgeCount: doc.edges.length,
    hasMeta: meta !== undefined,
    taskCount: doc.tasks.length,
    variableCount: doc.variables.length,
  });

  return {
    nodes,
    edges,
    meta,
    tasks: doc.tasks,
    variables: doc.variables,
    bindings: doc.bindings,
  };
}

/**
 * Save one flow as a single FlowDocument (tasks, variables, interface, translations embedded).
 */
export async function saveFlow(
  projectId: string,
  flowId: FlowId,
  nodes: Node<FlowNode>[],
  edges: any[],
  flows: WorkspaceState['flows'],
  metaPatch?: Flow['meta']
): Promise<void> {
  if (!projectId || String(projectId).trim() === '') {
    return;
  }
  const base = flows[flowId];
  if (!base) {
    throw new Error(`saveFlow: missing flow slice ${flowId}`);
  }
  const mergedFlows: WorkspaceState['flows'] = {
    ...flows,
    [flowId]: {
      ...base,
      meta: metaPatch !== undefined ? { ...base.meta, ...metaPatch } : base.meta,
    },
  };
  const doc = buildFlowDocumentFromFlowSlice(projectId, flowId, mergedFlows, nodes, edges);
  await saveFlowDocument(doc);
}
