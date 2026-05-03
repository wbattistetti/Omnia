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
import { loadFlow } from '../../flows/FlowPersistence';
import { collectSubflowWorkspaceCompileErrors } from '../../domain/compileErrors/collectSubflowWorkspaceCompileErrors';
import { normalizeSeverity } from '../../utils/severityUtils';
import { iaConvaiTraceMergedCompileTasks } from '../../utils/debug/iaConvaiFlowTrace';
import {
  collectIaAgentRuntimeCompileErrors,
  mergeAiAgentTaskLocations,
  type AiAgentTaskLocation,
} from '../../domain/compileErrors/collectIaAgentRuntimeCompileErrors';
import { flushAiAgentPromptAlignmentBeforeCompile } from '../TaskEditor/EditorHost/editors/aiAgentEditor/aiAgentPromptAlignmentFlush';
import { extractManualCatalogBackendTaskIdsFromProjectData } from '@domain/iaAgentTools/manualCatalogBackendToolIds';

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

function mergeCompileJsonGuardErrors(
  compileJson: Record<string, unknown>,
  guards: Record<string, unknown>[]
): void {
  if (!guards.length) return;
  const cur = (compileJson.errors as unknown[]) ?? [];
  const merged = [...cur, ...guards];
  compileJson.errors = merged;
  const hasBlocking = merged.some(
    (e) => normalizeSeverity((e as { severity?: string })?.severity) === 'error'
  );
  compileJson.hasErrors = hasBlocking || compileJson.hasErrors === true;
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
 * Grafi per reachability ConvAI nel collector: preferisce {@link FlowWorkspaceSnapshot} (UI attuale),
 * integra con `projectData.flows` persistito dove lo snapshot non ha ancora nodi.
 */
function buildFlowsByFlowIdForIaRuntimeGuards(
  rootFlowId: string,
  subflowIds: readonly string[],
  aiAgentLocations: Map<string, AiAgentTaskLocation>,
  projectData: unknown
): Record<string, { nodes: unknown[]; edges: unknown[] }> {
  const flowIds = new Set<string>([rootFlowId, ...subflowIds]);
  for (const loc of aiAgentLocations.values()) {
    const f = String(loc?.flowId ?? '').trim();
    if (f) flowIds.add(f);
  }
  for (const fid of FlowWorkspaceSnapshot.getAllFlowIds()) {
    const t = String(fid ?? '').trim();
    if (t) flowIds.add(t);
  }

  const out: Record<string, { nodes: unknown[]; edges: unknown[] }> = {};

  for (const fid of flowIds) {
    const snap = FlowWorkspaceSnapshot.getFlowById(fid);
    const n = snap?.nodes;
    if (Array.isArray(n) && n.length > 0) {
      out[fid] = {
        nodes: n as unknown[],
        edges: (Array.isArray(snap?.edges) ? snap.edges : []) as unknown[],
      };
    }
  }

  const persisted = (projectData as { flows?: Record<string, { nodes?: unknown[]; edges?: unknown[] }> })?.flows;
  if (persisted) {
    for (const [fid, doc] of Object.entries(persisted)) {
      if (!doc || !Array.isArray(doc.nodes) || doc.nodes.length === 0) continue;
      const cur = out[fid];
      if (!cur || cur.nodes.length === 0) {
        out[fid] = {
          nodes: doc.nodes,
          edges: Array.isArray(doc.edges) ? doc.edges : [],
        };
      }
    }
  }

  return out;
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
  const projectId = String(localStorage.getItem('currentProjectId') || '').trim();

  const snap = FlowWorkspaceSnapshot.getFlowById(rootFlowId);
  let nodes = snap?.nodes;
  let edges = snap?.edges ?? [];

  if (!nodes?.length && fallback?.nodes?.length) {
    const activeId = FlowWorkspaceSnapshot.getActiveFlowId();
    if (activeId === rootFlowId) {
      nodes = fallback.nodes;
      edges = fallback.edges ?? [];
    } else if (!snap?.nodes?.length) {
      // Snapshot missing this canvas (e.g. debugger props for a non-active subflow) — use caller fallback.
      nodes = fallback.nodes;
      edges = fallback.edges ?? [];
    }
  }

  if (!nodes?.length) {
    throw new Error(
      `Cannot compile flow "${rootFlowId}": no nodes in workspace snapshot. Open the flow canvas or refresh the editor.`
    );
  }

  const enrichedRoot = enrichFlowNodes(nodes);
  const subflowIds = discoverSubflowCanvasIdsTransitively(enrichedRoot);

  flushAiAgentPromptAlignmentBeforeCompile();

  const rootArtifacts = await backendCompileFlowGraph(enrichedRoot, edges, ctx);
  const primaryCompileJson = rootArtifacts.compileJson;
  const rootSubflowGuards = await collectSubflowWorkspaceCompileErrors({
    enrichedNodes: enrichedRoot,
    projectId,
  });
  mergeCompileJsonGuardErrors(primaryCompileJson, rootSubflowGuards);
  const aiAgentLocations = new Map<string, AiAgentTaskLocation>();
  mergeAiAgentTaskLocations(aiAgentLocations, enrichedRoot, rootFlowId);
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
    // Primary source: in-memory snapshot (already open/hydrated canvas).
    let sfNodes = FlowWorkspaceSnapshot.getFlowById(sfId)?.nodes ?? [];
    let sfEdges = FlowWorkspaceSnapshot.getFlowById(sfId)?.edges ?? [];

    // Clean compile fallback: read subflow directly from persisted project data.
    // No FlowStore/React state mutation, compile only.
    if (!sfNodes.length) {
      if (!projectId) {
        throw new Error(
          `Cannot compile subflow "${sfId}": currentProjectId missing for load fallback.`
        );
      }
      const loaded = await loadFlow(projectId, sfId);
      sfNodes = loaded.nodes || [];
      sfEdges = loaded.edges || [];
    }

    if (!sfNodes.length) {
      continue;
    }

    const en = enrichFlowNodes(sfNodes);
    const nestedGuards = await collectSubflowWorkspaceCompileErrors({
      enrichedNodes: en,
      projectId,
    });
    const art = await backendCompileFlowGraph(en, sfEdges || [], ctx);
    mergeCompileJsonGuardErrors(art.compileJson, nestedGuards);
    subflowCompilations[sfId] = art.compileJson;
    mergeTasksById(mergedTasks, art.allTasksWithTemplates);
    mergedDDTs.push(...art.allDDTs);
    mergeAiAgentTaskLocations(aiAgentLocations, en, sfId);
    allCompileSlices.push({
      flowId: sfId,
      errors: art.compileJson.errors as unknown[] | undefined,
      hasErrors: art.compileJson.hasErrors as boolean | undefined,
    });
  }

  const flowsByFlowId = buildFlowsByFlowIdForIaRuntimeGuards(
    rootFlowId,
    subflowIds,
    aiAgentLocations,
    projectData
  );
  const manualCatalogBackendTaskIds = extractManualCatalogBackendTaskIdsFromProjectData(projectData);
  const iaProviderGuards = collectIaAgentRuntimeCompileErrors(mergedTasks, aiAgentLocations, rootFlowId, {
    flowsByFlowId,
    manualCatalogBackendTaskIds,
  });
  mergeCompileJsonGuardErrors(primaryCompileJson, iaProviderGuards);

  /** `mergeCompileJsonGuardErrors` replaces `errors` with a new array — keep root slice in sync for consumers that merged slices before this step (e.g. IA provisioning guards). */
  const rootSlice = allCompileSlices[0];
  if (rootSlice?.flowId === rootFlowId) {
    rootSlice.errors = primaryCompileJson.errors as unknown[] | undefined;
    rootSlice.hasErrors = primaryCompileJson.hasErrors as boolean | undefined;
  }

  if (iaProviderGuards.length > 0) {
    console.info('[IA·ConvAI] compile: merged IA runtime / provisioning guards into root compile JSON', {
      rootFlowId,
      guardCount: iaProviderGuards.length,
      codes: iaProviderGuards.map((g) => String((g as { code?: unknown }).code ?? '')),
    });
  }

  iaConvaiTraceMergedCompileTasks(rootFlowId, mergedTasks);

  return {
    primaryCompileJson,
    subflowCompilations,
    mergedTasks,
    mergedDDTs,
    allCompileSlices,
  };
}
