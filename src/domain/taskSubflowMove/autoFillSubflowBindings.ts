/**
 * S2: after a task move into a linked subflow, writes `subflowBindings` on the parent Subflow task.
 * Each row maps child interface output (`variableRefId` = child store key) to a parent variable id.
 * Never uses MappingEntry.id — only `variableRefId` from `childFlow.meta.flowInterface.output`.
 *
 * Bindings are generated for each id in `taskVariableIds` that has a matching child interface output row
 * (callers pass referenced-only ids for normal linked moves, or the full S2 set for legacy `exposeAll`).
 */

import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import type { WorkspaceState } from '@flows/FlowTypes';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';
import { logS2Diag } from '@utils/s2WiringDiagnostic';

export type FlowDoc = NonNullable<WorkspaceState['flows'][string]>;

export type AutoFillSubflowBindingsParams = {
  projectId: string;
  parentFlowId: string;
  /** Parent flow document (reserved for stricter parent-side validation). */
  parentFlow: FlowDoc | undefined;
  /** Child flow after `mergeChildFlowInterfaceOutputsForVariables` (outputs carry `variableRefId`). */
  childFlow: FlowDoc | undefined;
  /** Canvas row id of `TaskType.Subflow` on the parent (portal task). */
  subflowTaskId: string;
  /**
   * All variable GUIDs for the moved task (S2 deterministic set). Bindings are created for each id
   * that exists in the project store and has a matching child interface output row.
   */
  taskVariableIds: readonly string[];
};

export type SubflowBindingRow = { interfaceParameterId: string; parentVariableId: string };

/**
 * Reads child interface outputs and builds binding rows: interfaceParameterId = entry.variableRefId only.
 */
export function extractInterfaceOutputsByVariableRefId(childFlow: FlowDoc | undefined): Map<string, MappingEntry> {
  const out = new Map<string, MappingEntry>();
  const raw = childFlow?.meta as { flowInterface?: { output?: unknown[] } } | undefined;
  const rows = Array.isArray(raw?.flowInterface?.output) ? raw.flowInterface!.output : [];
  for (const e of rows) {
    const entry = e as MappingEntry;
    const vid = String(entry?.variableRefId || '').trim();
    if (!vid) continue;
    out.set(vid, entry);
  }
  return out;
}

function dedupeBindings(rows: SubflowBindingRow[]): SubflowBindingRow[] {
  const seen = new Set<string>();
  const next: SubflowBindingRow[] = [];
  for (const r of rows) {
    const k = `${r.interfaceParameterId}\0${r.parentVariableId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    next.push(r);
  }
  return next;
}

/**
 * For each task variable id, finds the child interface output whose `variableRefId` equals that id
 * (same GUID after move when task variables are preserved). Builds S2 rows and merges into the Subflow task.
 */
export function autoFillSubflowBindingsForMovedTask(params: AutoFillSubflowBindingsParams): boolean {
  const pid = String(params.projectId || '').trim();
  const sid = String(params.subflowTaskId || '').trim();
  const parentFlowId = String(params.parentFlowId || '').trim();
  if (!pid || !sid || !parentFlowId) {
    logS2Diag('autoFillSubflowBindings', 'ABORT pid/sid/parentFlowId mancante', { pid, sid, parentFlowId });
    return false;
  }

  const task = taskRepository.getTask(sid);
  if (!task || task.type !== TaskType.Subflow) {
    logS2Diag('autoFillSubflowBindings', 'ABORT task Subflow non trovato o tipo errato', {
      sid,
      hasTask: !!task,
      taskType: task?.type,
    });
    return false;
  }

  const taskVarIds = [...params.taskVariableIds].map((x) => String(x || '').trim()).filter(Boolean).sort();
  const taskVarSet = new Set(taskVarIds);

  const childFlow = params.childFlow;
  const docParentId = String(params.parentFlow?.id || '').trim();
  if (docParentId && docParentId !== parentFlowId) {
    logTaskSubflowMove('autoFill:warn:parentFlowDocumentIdMismatch', { parentFlowId, docParentId });
  }

  const ifaceByVarRef = extractInterfaceOutputsByVariableRefId(childFlow);

  const generated: SubflowBindingRow[] = [];
  const skipped: Array<{ parentVarId: string; reason: string }> = [];

  for (const parentVarId of taskVarSet) {
    const entry = ifaceByVarRef.get(parentVarId);
    if (!entry) {
      skipped.push({ parentVarId, reason: 'no_child_interface_output_with_variableRefId' });
      continue;
    }

    const interfaceParameterId = String(entry.variableRefId || '').trim();
    if (!interfaceParameterId) {
      skipped.push({ parentVarId, reason: 'empty_variableRefId_on_interface_row' });
      continue;
    }

    generated.push({
      interfaceParameterId,
      parentVariableId: parentVarId,
    });
  }

  if (skipped.length > 0) {
    logTaskSubflowMove('autoFill:skipped', { skipped, parentFlowId, childFlowId: String(childFlow?.id || '').trim() });
  }
  logS2Diag('autoFillSubflowBindings', 'riepilogo', {
    parentFlowId,
    childFlowId: String(childFlow?.id || '').trim(),
    taskVarIdsRequested: taskVarIds.length,
    generatedBindings: generated.length,
    skippedCount: skipped.length,
    skippedReasons: skipped.slice(0, 12),
    childInterfaceOutputRows: ifaceByVarRef.size,
  });

  const childParamSet = new Set(generated.map((g) => g.interfaceParameterId));
  const existing = Array.isArray(task.subflowBindings) ? [...task.subflowBindings] : [];
  const withoutRefreshed = existing.filter((b) => {
    const p = String(b?.parentVariableId || '').trim();
    const c = String(b?.interfaceParameterId || '').trim();
    if (taskVarSet.has(p)) return false;
    if (childParamSet.has(c)) return false;
    return true;
  });

  const next = dedupeBindings([...withoutRefreshed, ...generated]);

  const updated = taskRepository.updateTask(
    sid,
    {
      subflowBindingsSchemaVersion: 1,
      subflowBindings: next,
    },
    pid,
    { merge: true, skipSubflowInterfaceSync: true }
  );
  logS2Diag('autoFillSubflowBindings', 'taskRepository.updateTask(subflowBindings)', {
    sid,
    ok: updated,
    finalBindingRowCount: next.length,
  });
  return updated;
}
