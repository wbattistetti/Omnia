/**
 * Computes which project variable GUIDs (varIds) are referenced from a parent flow's
 * linked tasks, conditions, and translations via an internal haystack (GUID substring match).
 * Used for task→subflow moves per docs/SEMANTICA_TASK_VARIABLES_E_SUBFLOW.md.
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import type { VariableInstance } from '@types/variableTypes';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import {
  buildInternalReferenceHaystackForParentFlow,
  conditionExpressionTextForReferenceScan,
} from './internalReferenceHaystack';

/**
 * Extracts which known varIds appear in `text` (substring match per id).
 * Restricting to `knownVarIds` avoids treating arbitrary node/edge UUIDs as variables.
 */
export function extractReferencedVarIdsFromText(text: string, knownVarIds: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  if (!text || knownVarIds.size === 0) return out;
  const haystack = String(text);
  for (const id of knownVarIds) {
    const vid = String(id || '').trim();
    if (!vid) continue;
    if (haystack.includes(vid)) out.add(vid);
  }
  return out;
}

/**
 * Builds a searchable text corpus for the parent flow: serialized flow + optional task JSON blobs + condition scripts.
 */
export function buildParentFlowReferenceCorpus(params: {
  flowJson: unknown;
  taskJsonChunks?: string[];
  conditionTextChunks?: string[];
  extraChunks?: string[];
}): string {
  const parts: string[] = [JSON.stringify(params.flowJson ?? null)];
  for (const t of params.taskJsonChunks ?? []) {
    if (t) parts.push(t);
  }
  for (const c of params.conditionTextChunks ?? []) {
    if (c) parts.push(c);
  }
  for (const e of params.extraChunks ?? []) {
    if (e) parts.push(e);
  }
  return parts.join('\n');
}

/**
 * Collects edge `conditionId` values from a flow graph.
 */
export function collectConditionIdsFromFlowEdges(flow: { edges?: Array<{ conditionId?: string }> } | null | undefined): string[] {
  const ids: string[] = [];
  for (const e of flow?.edges ?? []) {
    const cid = String((e as { conditionId?: string }).conditionId ?? '').trim();
    if (cid) ids.push(cid);
  }
  return [...new Set(ids)];
}

export type ProjectConditionLike = {
  id: string;
  expression?: {
    /** GUID-based text persisted at condition save for reference scan (optional; else executable/compiled). */
    internalReferenceText?: string;
    compiledCode?: string;
    compiledText?: string;
    script?: string;
    executableCode?: string;
  };
};

function conditionInternalTextsForIds(
  conditionIds: string[],
  conditions: ProjectConditionLike[] | undefined
): string[] {
  if (!conditions?.length || !conditionIds.length) return [];
  const byId = new Map(conditions.map((c) => [String(c.id || '').trim(), c] as const));
  const out: string[] = [];
  for (const id of conditionIds) {
    const c = byId.get(id);
    const t = conditionExpressionTextForReferenceScan(c?.expression);
    if (t) out.push(t);
  }
  return out;
}

/**
 * One internal expression text per condition item (all categories), for reference scanning.
 */
export function collectAllProjectConditionInternalExpressionTexts(projectData: unknown): string[] {
  const conditions = (projectData as { conditions?: Array<{ items?: unknown[] }> })?.conditions;
  if (!Array.isArray(conditions)) return [];
  const out: string[] = [];
  for (const cat of conditions) {
    for (const item of (cat?.items || []) as Array<{ expression?: ProjectConditionLike['expression'] }>) {
      const t = conditionExpressionTextForReferenceScan(item?.expression);
      if (t) out.push(t);
    }
  }
  return out;
}

/**
 * Returns condition script/compiled fragments for the given condition ids (in project order).
 */
export function conditionTextsForIds(
  conditionIds: string[],
  conditions: ProjectConditionLike[] | undefined
): string[] {
  if (!conditions?.length || !conditionIds.length) return [];
  const byId = new Map(conditions.map((c) => [String(c.id || '').trim(), c] as const));
  const out: string[] = [];
  for (const id of conditionIds) {
    const c = byId.get(id);
    if (!c?.expression) continue;
    const ex = c.expression;
    out.push(
      [ex.compiledCode, ex.script, ex.executableCode].filter(Boolean).join('\n')
    );
  }
  return out;
}

/**
 * Collects expression text from every condition item in project data (all categories).
 * Use for reference scanning so varIds referenced only from off-edge conditions are still found.
 */
export function collectAllProjectConditionExpressionChunks(projectData: unknown): string[] {
  const conditions = (projectData as { conditions?: Array<{ items?: unknown[] }> })?.conditions;
  if (!Array.isArray(conditions)) return [];
  const out: string[] = [];
  for (const cat of conditions) {
    for (const item of (cat?.items || []) as Array<{ expression?: ProjectConditionLike['expression'] }>) {
      const ex = item?.expression;
      if (!ex) continue;
      const chunk = [ex.compiledCode, ex.script, ex.executableCode].filter(Boolean).join('\n');
      if (chunk) out.push(chunk);
    }
  }
  return out;
}

const DEEP_STRING_MAX_NODES = 8000;

/**
 * Collects string leaf values from JSON-like structures (extra pass for varId substring matching).
 */
export function collectDeepStringLeavesFromUnknown(value: unknown, maxNodes = DEEP_STRING_MAX_NODES): string[] {
  const out: string[] = [];
  const visit = (v: unknown, n: { c: number }) => {
    if (n.c >= maxNodes) return;
    n.c += 1;
    if (v === null || v === undefined) return;
    if (typeof v === 'string') {
      if (v) out.push(v);
      return;
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      out.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) visit(x, n);
      return;
    }
    if (typeof v === 'object') {
      for (const x of Object.values(v as Record<string, unknown>)) visit(x, n);
    }
  };
  visit(value, { c: 0 });
  return out;
}

/**
 * `knownVarIds` should be all VariableInstance.id values for the project (or a safe superset).
 */
export function collectReferencedVarIdsInParentFlowCorpus(
  corpus: string,
  knownVarIds: ReadonlySet<string>
): Set<string> {
  return extractReferencedVarIdsFromText(corpus, knownVarIds);
}

/**
 * Partitions project variables into referenced vs not referenced w.r.t. the given corpus.
 */
export function partitionVariablesByReference(
  variables: VariableInstance[],
  referencedIds: ReadonlySet<string>
): { referenced: VariableInstance[]; notReferenced: VariableInstance[] } {
  const referenced: VariableInstance[] = [];
  const notReferenced: VariableInstance[] = [];
  for (const v of variables) {
    const id = String(v.id || '').trim();
    if (!id) continue;
    if (referencedIds.has(id)) referenced.push(v);
    else notReferenced.push(v);
  }
  return { referenced, notReferenced };
}

/**
 * Serializes tasks for every canvas row in the given flow (for expression / parameter scanning).
 */
export function buildTaskJsonChunksForParentFlow(
  parentFlowId: string,
  flows: WorkspaceState['flows']
): string[] {
  const flow = flows[parentFlowId];
  const chunks: string[] = [];
  for (const node of (flow?.nodes as any[]) || []) {
    const rows: any[] = Array.isArray(node?.data?.rows) ? node.data.rows : [];
    for (const row of rows) {
      const tid = String(row?.id || '').trim();
      if (!tid) continue;
      const t = taskRepository.getTask(tid);
      if (t) chunks.push(JSON.stringify(t));
    }
  }
  return chunks;
}

export type CollectReferencedWorkspaceParams = {
  projectId: string;
  parentFlowId: string;
  flows: WorkspaceState['flows'];
  conditions?: ProjectConditionLike[];
  /**
   * Precompiled translation strings (GUID form). Omit if translations are not part of this scan.
   * UI translations are compiled at project save, not inside the scan.
   */
  translationsInternal?: Record<string, string>;
  /** When set, all condition expressions from project data are scanned (not only edge-linked). */
  projectData?: unknown;
  /**
   * When true with `projectData`, scan every condition expression in the project (not only edges of flow A).
   * Default behavior for task moves is **false**: only conditions attached to edges of `parentFlowId` (flow A).
   */
  useAllProjectConditionsForReferenceScan?: boolean;
  /** Extra text blobs (e.g. serialized moved task) — only `referenceScanInternalText` is read if JSON. */
  extraCorpusChunks?: string[];
};

/**
 * Full pipeline: known project varIds × concatenated persisted GUID-only text (no label resolution here).
 */
export function collectReferencedVarIdsForParentFlowWorkspace(
  params: CollectReferencedWorkspaceParams
): Set<string> {
  const pid = String(params.projectId || '').trim();
  const parentFlowId = String(params.parentFlowId || '').trim();
  if (!pid || !parentFlowId) return new Set();

  const knownVarIds = new Set(
    (variableCreationService.getAllVariables(pid) ?? [])
      .map((v) => String(v.id || '').trim())
      .filter(Boolean)
  );

  const parentFlow = params.flows[parentFlowId];
  if (!parentFlow) return new Set();

  const conditionIds = collectConditionIdsFromFlowEdges(parentFlow as { edges?: Array<{ conditionId?: string }> });
  let conditionInternalTexts: string[];
  if (params.useAllProjectConditionsForReferenceScan && params.projectData !== undefined) {
    conditionInternalTexts = collectAllProjectConditionInternalExpressionTexts(params.projectData);
  } else {
    conditionInternalTexts = conditionInternalTextsForIds(conditionIds, params.conditions);
  }

  const taskJsonChunks = buildTaskJsonChunksForParentFlow(parentFlowId, params.flows);
  /** Serialized flow A (outputBindings, meta, nodes) — appended as raw text; not parsed for referenceScanInternalText. */
  const flowStructureChunk = JSON.stringify(parentFlow ?? null);

  const internalHaystack = buildInternalReferenceHaystackForParentFlow({
    conditionInternalTexts,
    taskJsonChunks,
    translationsInternal: params.translationsInternal,
    extraCorpusChunks: params.extraCorpusChunks,
  });

  const haystack = `${internalHaystack}\n${flowStructureChunk}`;
  return extractReferencedVarIdsFromText(haystack, knownVarIds);
}

/**
 * True iff `variableId` appears in the static reference corpus for flow A only
 * (conditions on edges of that flow, tasks on canvas, serialized flow JSON including outputBindings, translations slice).
 */
export function isVariableReferencedInFlow(
  variableId: string,
  params: CollectReferencedWorkspaceParams
): boolean {
  const vid = String(variableId || '').trim();
  if (!vid) return false;
  return collectReferencedVarIdsForParentFlowWorkspace(params).has(vid);
}
