/**
 * When a task row's authoring canvas moves onto a subflow (`authoringFlowCanvasId` → subflow_*),
 * runs the same interface merge as the subflow portal path (reference scan + OUTPUT merge).
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { TaskType } from '@types/taskTypes';
import { applyTaskMoveToSubflow, type ApplyTaskMoveToSubflowResult } from './applyTaskMoveToSubflow';
import type { ProjectConditionLike } from './collectReferencedVarIds';
import { getSubflowSyncFlows, getSubflowSyncTranslations } from './subflowSyncFlowsRef';

const SUBFLOW_PREFIX = 'subflow_';

/** Parses `subflow_<rowId>` → subflow (portal) task row id. */
export function parseSubflowTaskRowIdFromChildCanvasId(childCanvasId: string): string | null {
  const s = String(childCanvasId || '').trim();
  if (!s.startsWith(SUBFLOW_PREFIX)) return null;
  const rest = s.slice(SUBFLOW_PREFIX.length).trim();
  return rest || null;
}

/**
 * Finds which flow slice contains a node row whose id is the Subflow portal task row.
 */
export function findParentFlowIdContainingSubflowRow(
  flows: WorkspaceState['flows'],
  subflowPortalRowTaskId: string
): string | null {
  const rid = String(subflowPortalRowTaskId || '').trim();
  if (!rid) return null;
  for (const [flowId, slice] of Object.entries(flows || {})) {
    const nodes = (slice as { nodes?: Array<{ data?: { rows?: unknown[] } }> })?.nodes || [];
    for (const node of nodes) {
      const rows = Array.isArray(node?.data?.rows) ? node.data!.rows! : [];
      if (rows.some((r) => String((r as { id?: string })?.id || '').trim() === rid)) {
        return flowId;
      }
    }
  }
  return null;
}

function flattenConditionsFromProjectData(projectData: unknown): ProjectConditionLike[] {
  const conditions = (projectData as { conditions?: Array<{ items?: unknown[] }> })?.conditions || [];
  const out: ProjectConditionLike[] = [];
  for (const cat of conditions) {
    for (const item of cat.items || []) {
      const it = item as { id?: string; _id?: string; expression?: ProjectConditionLike['expression'] };
      const cid = String(it.id || it._id || '').trim();
      if (!cid) continue;
      out.push({ id: cid, expression: it.expression });
    }
  }
  return out;
}

let syncInFlight = false;

export type SyncSubflowInterfaceAfterAuthoringResult = ApplyTaskMoveToSubflowResult & {
  parentFlowId: string;
  childFlowId: string;
};

export type SyncSubflowInterfaceOnAuthoringParams = {
  projectId: string;
  taskInstanceId: string;
  previousAuthoringCanvasId: string | undefined;
  nextAuthoringCanvasId: string | undefined;
  /** Skip TaskType.Subflow rows (parent subflow task); sync is for authored tasks moved into child canvas. */
  taskType: TaskType;
};

/**
 * If the task moved onto a subflow canvas, run applyTaskMoveToSubflow (interface only).
 * Returns null when no action was taken.
 */
export function syncSubflowInterfaceAfterAuthoringCanvasChange(
  params: SyncSubflowInterfaceOnAuthoringParams
): SyncSubflowInterfaceAfterAuthoringResult | null {
  const pid = String(params.projectId || '').trim();
  const tid = String(params.taskInstanceId || '').trim();
  const prev = params.previousAuthoringCanvasId?.trim() || '';
  const next = params.nextAuthoringCanvasId?.trim() || '';

  if (!pid || !tid) return null;
  if (params.taskType === TaskType.Subflow) return null;
  if (prev === next) return null;
  if (!next.startsWith(SUBFLOW_PREFIX)) return null;

  const portalRowId = parseSubflowTaskRowIdFromChildCanvasId(next);
  if (!portalRowId) return null;

  const flows = getSubflowSyncFlows();
  const parentFlowId =
    findParentFlowIdContainingSubflowRow(flows, portalRowId) || 'main';
  const childFlowId = next;

  if (!flows[parentFlowId] || !flows[childFlowId]) {
    return null;
  }

  const projectData =
    typeof window !== 'undefined' ? (window as unknown as { __projectData?: unknown }).__projectData : undefined;
  const conditions = flattenConditionsFromProjectData(projectData);

  const childSlice = flows[childFlowId];
  const subflowDisplayTitle =
    String((childSlice as { title?: string })?.title || '').trim() || 'Subflow';

  const translations = getSubflowSyncTranslations();
  const translationsArg =
    translations && Object.keys(translations).length > 0 ? translations : undefined;

  if (syncInFlight) return null;
  syncInFlight = true;
  try {
    const result = applyTaskMoveToSubflow({
      projectId: pid,
      parentFlowId,
      childFlowId,
      taskInstanceId: tid,
      subflowDisplayTitle,
      parentSubflowTaskRowId: portalRowId,
      flows,
      conditions,
      translations: translationsArg,
      projectData,
      skipMaterialization: true,
    });
    return { ...result, parentFlowId, childFlowId };
  } finally {
    syncInFlight = false;
  }
}
