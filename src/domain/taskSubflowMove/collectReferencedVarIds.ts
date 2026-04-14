/**
 * `variabiliReferenziate` for a parent flow (§3): structural walks of flow / tasks / conditions
 * plus RFC UUID token extraction in expression and template strings — no per-id haystack.includes.
 * @see docs/SEMANTICA_TASK_VARIABLES_E_SUBFLOW.md §3
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import type { VariableInstance } from '@types/variableTypes';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';
import { conditionExpressionTextForParentReferenceScan } from './internalReferenceHaystack';
import {
  buildLowercaseToCanonicalVarIdMap,
  extractKnownVarIdsFromText,
  extractReferencedVarIdsFromExtraCorpusChunks,
  extractReferencedVarIdsFromParentFlowStructure,
  extractReferencedVarIdsFromTaskObject,
  extractReferencedVarIdsFromTranslationsInternal,
} from './referenceScanStructural';

function mergeInto(target: Set<string>, source: Iterable<string>): void {
  for (const x of source) target.add(x);
}

/**
 * Extracts known project variable ids appearing as RFC UUID tokens in `text`.
 * Replaces legacy O(n vars × text length) substring checks.
 */
export function extractReferencedVarIdsFromText(text: string, knownVarIds: ReadonlySet<string>): Set<string> {
  const map = buildLowercaseToCanonicalVarIdMap(knownVarIds);
  return extractKnownVarIdsFromText(text, map);
}

/**
 * Builds a searchable text corpus (legacy helpers / tests). Prefer structural APIs for new code.
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

function conditionInternalTextsForParentScan(
  conditionIds: string[],
  conditions: ProjectConditionLike[] | undefined
): string[] {
  if (!conditions?.length || !conditionIds.length) return [];
  const byId = new Map(conditions.map((c) => [String(c.id || '').trim(), c] as const));
  const out: string[] = [];
  for (const id of conditionIds) {
    const c = byId.get(id);
    const t = conditionExpressionTextForParentReferenceScan(c?.expression);
    if (t) out.push(t);
  }
  return out;
}

/**
 * One expression text per condition item (all categories), for §3 variable reference scanning.
 */
export function collectAllProjectConditionExpressionTextsForParentScan(projectData: unknown): string[] {
  const conditions = (projectData as { conditions?: Array<{ items?: unknown[] }> })?.conditions;
  if (!Array.isArray(conditions)) return [];
  const out: string[] = [];
  for (const cat of conditions) {
    for (const item of (cat?.items || []) as Array<{ expression?: ProjectConditionLike['expression'] }>) {
      const t = conditionExpressionTextForParentReferenceScan(item?.expression);
      if (t) out.push(t);
    }
  }
  return out;
}

/**
 * @deprecated Use {@link collectAllProjectConditionExpressionTextsForParentScan} for reference scan.
 * Legacy: concatenates compiled/script chunks without script-only fallback priority used for §3.
 */
export function collectAllProjectConditionInternalExpressionTexts(projectData: unknown): string[] {
  return collectAllProjectConditionExpressionTextsForParentScan(projectData);
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
 * Collects string leaf values from JSON-like structures (legacy helpers).
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

export type CollectReferencedWorkspaceParams = {
  projectId: string;
  parentFlowId: string;
  flows: WorkspaceState['flows'];
  conditions?: ProjectConditionLike[];
  /**
   * Precompiled translation strings (GUID form). Omit if translations are not part of this scan.
   */
  translationsInternal?: Record<string, string>;
  /** When set, all condition expressions from project data are scanned (not only edge-linked). */
  projectData?: unknown;
  /**
   * When true with `projectData`, scan every condition expression in the project (not only edges of flow A).
   * Default behavior for task moves is **false**: only conditions attached to edges of `parentFlowId` (flow A).
   */
  useAllProjectConditionsForReferenceScan?: boolean;
  /** Extra blobs: JSON objects use `referenceScanInternalText` + structural walk (legacy; prefer `movedTaskInstanceIdForReferenceScan`). */
  extraCorpusChunks?: string[];
  /**
   * Task row id for the moved task: after structural move it may not appear on the parent canvas,
   * but must still be scanned for §3 references (conditions, messages, API params, subflowBindings, …).
   */
  movedTaskInstanceIdForReferenceScan?: string;
};

/**
 * §3 structural reference scan for the parent flow workspace slice.
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

  const lowercaseToCanonical = buildLowercaseToCanonicalVarIdMap(knownVarIds);
  const refs = new Set<string>();

  mergeInto(refs, extractReferencedVarIdsFromParentFlowStructure(parentFlowId, params.flows, lowercaseToCanonical));

  const conditionIds = collectConditionIdsFromFlowEdges(parentFlow as { edges?: Array<{ conditionId?: string }> });
  const conditionTexts =
    params.useAllProjectConditionsForReferenceScan && params.projectData !== undefined
      ? collectAllProjectConditionExpressionTextsForParentScan(params.projectData)
      : conditionInternalTextsForParentScan(conditionIds, params.conditions);

  for (const t of conditionTexts) {
    mergeInto(refs, extractKnownVarIdsFromText(t, lowercaseToCanonical));
  }

  mergeInto(refs, extractReferencedVarIdsFromTranslationsInternal(params.translationsInternal, lowercaseToCanonical));

  const movedTid = String(params.movedTaskInstanceIdForReferenceScan || '').trim();
  if (movedTid) {
    const movedTask = taskRepository.getTask(movedTid);
    if (movedTask) {
      mergeInto(refs, extractReferencedVarIdsFromTaskObject(movedTask, lowercaseToCanonical));
    }
  }

  mergeInto(refs, extractReferencedVarIdsFromExtraCorpusChunks(params.extraCorpusChunks, lowercaseToCanonical));

  return refs;
}

/**
 * True iff `variableId` appears in the §3 structural reference scan for flow A.
 */
export function isVariableReferencedInFlow(
  variableId: string,
  params: CollectReferencedWorkspaceParams
): boolean {
  const vid = String(variableId || '').trim();
  if (!vid) return false;
  return collectReferencedVarIdsForParentFlowWorkspace(params).has(vid);
}
