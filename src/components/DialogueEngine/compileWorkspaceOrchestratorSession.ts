/**
 * Compiles the root flow canvas plus every nested subflow canvas (transitive Subflow references)
 * for a single orchestrator session. Primary compilation JSON is always the root flow;
 * nested canvases are sent as subflowCompilations keyed by flowId.
 */

import type { Node, Edge } from 'reactflow';
import type { FlowNode, EdgeData } from '../Flowchart/types/flowTypes';
import { enrichRowsWithTaskId } from '../../utils/taskHelpers';
import { FlowWorkspaceSnapshot } from '../../flows/FlowWorkspaceSnapshot';
import { backendCompileFlowGraph, discoverSubflowCanvasIdsTransitively } from './backendCompileFlowGraph';

export type CompileWorkspaceOrchestratorParams = {
  rootFlowId: string;
  projectData: unknown;
  translations: Record<string, string>;
  /** If the snapshot has no nodes yet for root, use props when the active canvas matches rootFlowId */
  fallback?: { nodes: Node<FlowNode>[]; edges: Edge<EdgeData>[] };
};

export type FlowCompileSlice = {
  flowId: string;
  errors: unknown[] | undefined;
  hasErrors: boolean | undefined;
};

function enrichFlowNodes(nodes: Node<FlowNode>[]): Node<FlowNode>[] {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      rows: enrichRowsWithTaskId(node.data?.rows || []),
    },
  }));
}

function mergeTasksById(existing: unknown[], more: unknown[]): void {
  const seen = new Set(
    existing.map((t) => (t as { id?: string }).id).filter(Boolean) as string[]
  );
  for (const t of more) {
    const id = (t as { id?: string }).id;
    if (id && !seen.has(id)) {
      seen.add(id);
      existing.push(t);
    }
  }
}

/**
 * Compiles root + all reachable subflow canvases; merges task/DDT payloads for the session POST.
 */
export async function compileWorkspaceForOrchestratorSession(
  params: CompileWorkspaceOrchestratorParams
): Promise<{
  primaryCompileJson: Record<string, unknown>;
  subflowCompilations: Record<string, Record<string, unknown>>;
  mergedTasks: unknown[];
  mergedDDTs: unknown[];
  allCompileSlices: FlowCompileSlice[];
}> {
  const { rootFlowId, projectData, translations, fallback } = params;
  const ctx = { projectData, translations };

  const snap = FlowWorkspaceSnapshot.getFlowById(rootFlowId);
  let nodes = snap?.nodes;
  let edges = snap?.edges ?? [];

  if (!nodes?.length && fallback && FlowWorkspaceSnapshot.getActiveFlowId() === rootFlowId) {
    nodes = fallback.nodes;
    edges = fallback.edges ?? [];
  }

  if (!nodes?.length) {
    throw new Error(
      `Cannot compile flow "${rootFlowId}": no nodes in workspace snapshot. Open the flow canvas or refresh the editor.`
    );
  }

  const enrichedRoot = enrichFlowNodes(nodes);
  const subflowIds = discoverSubflowCanvasIdsTransitively(enrichedRoot);

  const rootArtifacts = await backendCompileFlowGraph(enrichedRoot, edges, ctx);
  const primaryCompileJson = rootArtifacts.compileJson;
  const mergedTasks = [...rootArtifacts.allTasksWithTemplates];
  const mergedDDTs = [...rootArtifacts.allDDTs];
  const subflowCompilations: Record<string, Record<string, unknown>> = {};
  const allCompileSlices: FlowCompileSlice[] = [
    {
      flowId: rootFlowId,
      errors: primaryCompileJson.errors as unknown[] | undefined,
      hasErrors: primaryCompileJson.hasErrors as boolean | undefined,
    },
  ];

  for (const sfId of subflowIds) {
    const sfSnap = FlowWorkspaceSnapshot.getFlowById(sfId);
    if (!sfSnap?.nodes?.length) {
      console.warn(`[compileWorkspaceForOrchestratorSession] Subflow "${sfId}" missing or empty in snapshot — skipped`);
      continue;
    }
    const en = enrichFlowNodes(sfSnap.nodes);
    const art = await backendCompileFlowGraph(en, sfSnap.edges || [], ctx);
    subflowCompilations[sfId] = art.compileJson;
    mergeTasksById(mergedTasks, art.allTasksWithTemplates);
    mergedDDTs.push(...art.allDDTs);
    allCompileSlices.push({
      flowId: sfId,
      errors: art.compileJson.errors as unknown[] | undefined,
      hasErrors: art.compileJson.hasErrors as boolean | undefined,
    });
  }

  return {
    primaryCompileJson,
    subflowCompilations,
    mergedTasks,
    mergedDDTs,
    allCompileSlices,
  };
}
