/**
 * Keeps parent-flow proxy variables and Subflow outputBindings aligned with child flow interface
 * outputs. Child slot varIds (`fromVariable`) stay on the subflow task variables (local names);
 * parent FQ names live on separate manual flow-scoped rows (`toVariable`). Runs after interface edits
 * and when a parent links a Subflow task to a child flow.
 */

import { taskRepository } from './TaskRepository';
import { variableCreationService } from './VariableCreationService';
import { TaskType } from '../types/taskTypes';
import type { WorkspaceState } from '../flows/FlowTypes';
import { loadFlow } from '../flows/FlowPersistence';
import type { MappingEntry } from '../components/FlowMappingPanel/mappingTypes';
import {
  buildSubflowQualifiedDisplayLabel,
  buildSubflowParentProxyVariableName,
  disambiguateProxyVarName,
  localLabelForSubflowTaskVariable,
} from '../domain/variableProxyNaming';
import { projectHasBracketReferenceToVarId } from './subflowVariableReferenceScan';
import { getVariableLabel } from '../utils/getVariableLabel';
import { getProjectTranslationsTable, mergeProjectTranslationEntry } from '../utils/projectTranslationsRegistry';
import { logTaskSubflowMove } from '../utils/taskSubflowMoveDebug';

type SubflowIoBinding = { fromVariable: string; toVariable: string };

function resolveSubflowId(task: any): string | null {
  const direct = String(task?.flowId || '').trim();
  if (direct) return direct;
  const params = Array.isArray(task?.parameters) ? task.parameters : [];
  const fromParam = params.find((p: any) => String(p?.parameterId || '').trim() === 'flowId');
  return String(fromParam?.value || '').trim() || null;
}

function extractRows(node: any): any[] {
  const rows = node?.data?.rows;
  return Array.isArray(rows) ? rows : [];
}

export function getCanvasRowTextForTask(
  parentFlowId: string,
  subflowTaskId: string,
  flows: WorkspaceState['flows']
): string {
  const flow = flows[parentFlowId];
  if (!flow) return '';
  for (const node of flow.nodes || []) {
    for (const row of extractRows(node)) {
      if (String(row?.id || '').trim() === String(subflowTaskId).trim()) {
        return String(row?.text || '').trim();
      }
    }
  }
  return '';
}

export function collectParentSubflowInstancesForChildFlow(
  childFlowId: string,
  flows: WorkspaceState['flows']
): Array<{ parentFlowId: string; subflowTaskId: string }> {
  const cf = String(childFlowId || '').trim();
  if (!cf) return [];
  const out: Array<{ parentFlowId: string; subflowTaskId: string }> = [];
  for (const [parentFlowId, f] of Object.entries(flows || {})) {
    for (const node of (f as any)?.nodes || []) {
      for (const row of extractRows(node)) {
        const tid = String(row?.id || '').trim();
        if (!tid) continue;
        const task = taskRepository.getTask(tid);
        if (!task || task.type !== TaskType.Subflow) continue;
        const fid = resolveSubflowId(task);
        if (fid === cf) {
          out.push({ parentFlowId, subflowTaskId: tid });
        }
      }
    }
  }
  return out;
}

function entryLabel(entry: MappingEntry): string {
  return (
    String(entry?.externalName || '').trim() ||
    String(entry?.internalPath || '').trim() ||
    String(entry?.linkedVariable || '').trim() ||
    ''
  );
}

async function resolveChildInterfaceOutputs(
  projectId: string,
  childFlowId: string,
  flows: WorkspaceState['flows']
): Promise<MappingEntry[]> {
  const slice = flows[childFlowId] as any;
  if (Array.isArray(slice?.meta?.flowInterface?.output)) {
    return slice.meta.flowInterface.output as MappingEntry[];
  }
  if (!String(projectId || '').trim()) return [];
  try {
    const loaded = await loadFlow(projectId, childFlowId);
    const o = (loaded.meta as any)?.flowInterface?.output;
    return Array.isArray(o) ? (o as MappingEntry[]) : [];
  } catch {
    return [];
  }
}

function pickUniqueProxyNameForRename(
  projectId: string,
  parentFlowId: string,
  desiredBase: string,
  ownVarId: string
): string {
  return disambiguateProxyVarName(desiredBase, (name) => {
    const hit = variableCreationService.findVariableInFlowScopeByExactName(projectId, parentFlowId, name);
    if (!hit) return false;
    return hit.id !== ownVarId;
  });
}

/**
 * Creates/renames parent proxy vars and rewrites outputBindings for one Subflow task instance.
 */
export type SyncProxyBindingsForSubflowTaskOptions = {
  /** Resolved subflow title for qualified parent labels (`Title.internal`). Overrides canvas row text when set. */
  qualifiedSubflowTitle?: string;
};

function mergeTranslationForGuid(guid: string, text: string): void {
  mergeProjectTranslationEntry(guid, text);
}

export function syncProxyBindingsForSubflowTask(
  projectId: string,
  parentFlowId: string,
  subflowTaskId: string,
  childFlowId: string,
  interfaceOutputs: MappingEntry[],
  flows: WorkspaceState['flows'],
  options?: SyncProxyBindingsForSubflowTaskOptions
): void {
  const pid = String(projectId || '').trim();
  if (!pid) {
    logTaskSubflowMove('sync:abort', { reason: 'no_projectId' });
    return;
  }

  const task = taskRepository.getTask(subflowTaskId);
  if (!task || task.type !== TaskType.Subflow) {
    logTaskSubflowMove('sync:abort', {
      reason: 'not_subflow_task',
      subflowTaskId,
      taskFound: !!task,
      taskType: task?.type,
    });
    return;
  }
  if (resolveSubflowId(task) !== String(childFlowId).trim()) {
    logTaskSubflowMove('sync:abort', {
      reason: 'childFlowId_mismatch',
      resolvedChild: resolveSubflowId(task),
      expectedChildFlowId: childFlowId,
    });
    return;
  }

  const rowText =
    getCanvasRowTextForTask(parentFlowId, subflowTaskId, flows) ||
    String((task as any).label || (task as any).name || '').trim() ||
    'Subflow';

  const prevBindings = Array.isArray((task as any).outputBindings)
    ? ((task as any).outputBindings as SubflowIoBinding[])
    : [];

  const output = interfaceOutputs;
  const nextBindings: SubflowIoBinding[] = [];
  const keptChildIds = new Set<string>();

  logTaskSubflowMove('sync:enter', {
    parentFlowId,
    subflowTaskId,
    childFlowId,
    interfaceOutputEntryCount: output.length,
    prevBindingCount: prevBindings.length,
    prevBindings: prevBindings.map((b) => ({
      fromVariable: String(b?.fromVariable || '').trim(),
      toVariable: String(b?.toVariable || '').trim(),
    })),
    rowText,
    qualifiedSubflowTitle: options?.qualifiedSubflowTitle,
  });

  for (const entry of output) {
    const refId = String(entry?.variableRefId || '').trim();
    if (!refId) continue;
    const internalLabel = entryLabel(entry);
    if (!internalLabel) continue;
    keptChildIds.add(refId);

    const internalDisplay =
      getVariableLabel(refId, getProjectTranslationsTable()) || internalLabel;
    const titleForQual = String(options?.qualifiedSubflowTitle ?? '').trim() || rowText;
    let desiredBase: string;
    try {
      desiredBase = options?.qualifiedSubflowTitle
        ? buildSubflowQualifiedDisplayLabel(titleForQual, internalDisplay)
        : buildSubflowParentProxyVariableName(rowText, internalLabel);
    } catch {
      continue;
    }

    const existing = prevBindings.find((b) => String(b?.fromVariable || '').trim() === refId);
    if (existing) {
      const parentId = String(existing.toVariable || '').trim();
      if (!parentId) continue;
      const uniqueName = pickUniqueProxyNameForRename(pid, parentFlowId, desiredBase, parentId);
      const current = getVariableLabel(parentId, getProjectTranslationsTable());
      if (current !== uniqueName) {
        if (variableCreationService.renameVariableById(pid, parentId, uniqueName)) {
          mergeTranslationForGuid(parentId, uniqueName);
        }
      }
      logTaskSubflowMove('sync:binding', {
        mode: 'reuse_parent_proxy',
        childVariableGuid: refId,
        parentProxyGuid: parentId,
        desiredBase,
        uniqueName,
        renamed: current !== uniqueName,
      });
      nextBindings.push({ fromVariable: refId, toVariable: parentId });
    } else {
      const tokenLabel = disambiguateProxyVarName(desiredBase, (name) =>
        !!variableCreationService.findVariableInFlowScopeByExactName(pid, parentFlowId, name)
      );
      const parentVar = variableCreationService.createManualVariable(pid, tokenLabel, {
        scope: 'flow',
        scopeFlowId: parentFlowId,
      });
      mergeTranslationForGuid(parentVar.id, tokenLabel);
      logTaskSubflowMove('sync:binding', {
        mode: 'new_parent_proxy',
        childVariableGuid: refId,
        parentProxyGuid: parentVar.id,
        desiredBase,
        tokenLabel,
      });
      nextBindings.push({ fromVariable: refId, toVariable: parentVar.id });
    }
  }

  for (const b of prevBindings) {
    const from = String(b?.fromVariable || '').trim();
    if (!from || keptChildIds.has(from)) continue;
    const toId = String(b?.toVariable || '').trim();
    if (
      toId &&
      !projectHasBracketReferenceToVarId(pid, toId, flows) &&
      variableCreationService.getAllVariables(pid).some((v) => String(v?.id || '').trim() === toId)
    ) {
      logTaskSubflowMove('sync:removedStaleParentProxy', {
        fromVariable: from,
        removedParentProxyId: toId,
      });
      variableCreationService.removeVariableById(pid, toId);
    }
  }

  taskRepository.updateTask(subflowTaskId, { outputBindings: nextBindings } as any);

  logTaskSubflowMove('sync:exit', {
    subflowTaskId,
    nextBindingCount: nextBindings.length,
    nextBindings: nextBindings.map((b) => ({
      from: String(b?.fromVariable || '').trim(),
      to: String(b?.toVariable || '').trim(),
    })),
  });
}

/**
 * When a parent-flow message still references the child slot GUID, resolve bracket display to the
 * parent proxy's qualified label (child GUID → parent translation).
 */
export function resolveChildOutputGuidToParentProxyLabelForFlow(
  childSlotGuid: string,
  parentFlowId: string,
  flows: WorkspaceState['flows']
): string | null {
  const g = String(childSlotGuid || '').trim();
  if (!g) return null;
  const flow = flows[parentFlowId];
  if (!flow) return null;
  for (const node of flow.nodes || []) {
    for (const row of extractRows(node)) {
      const tid = String(row?.id || '').trim();
      if (!tid) continue;
      const task = taskRepository.getTask(tid);
      if (!task || task.type !== TaskType.Subflow) continue;
      const bindings = Array.isArray((task as any).outputBindings)
        ? ((task as any).outputBindings as SubflowIoBinding[])
        : [];
      for (const b of bindings) {
        if (String(b?.fromVariable || '').trim() !== g) continue;
        const parentId = String(b?.toVariable || '').trim();
        if (!parentId) continue;
        const lbl = getVariableLabel(parentId, getProjectTranslationsTable());
        return lbl || null;
      }
    }
  }
  return null;
}

/**
 * Second pass: set the parent proxy GUID to the qualified display label only. Child slot GUID keeps
 * the internal segment (e.g. "colore") for subflow canvas / interface, not the FQ parent label.
 */
export function ensureSubflowOutputBindingsDisplayLabels(params: {
  parentSubflowTaskRowId: string;
  referencedChildVarIds: ReadonlySet<string> | ReadonlyArray<string>;
  qualifiedSubflowTitle: string;
  interfaceOutputs: MappingEntry[];
}): number {
  const { parentSubflowTaskRowId, qualifiedSubflowTitle, interfaceOutputs } = params;
  const refSet =
    params.referencedChildVarIds instanceof Set
      ? params.referencedChildVarIds
      : new Set(
          [...params.referencedChildVarIds].map((x) => String(x || '').trim()).filter(Boolean)
        );

  const task = taskRepository.getTask(parentSubflowTaskRowId);
  if (!task || task.type !== TaskType.Subflow) return 0;
  const bindings = Array.isArray((task as any).outputBindings)
    ? ((task as any).outputBindings as SubflowIoBinding[])
    : [];

  const title = String(qualifiedSubflowTitle || '').trim() || 'Subflow';
  let count = 0;

  for (const b of bindings) {
    const childId = String(b?.fromVariable || '').trim();
    const parentId = String(b?.toVariable || '').trim();
    if (!childId || !parentId || !refSet.has(childId)) continue;

    const entry = interfaceOutputs.find((o) => String(o?.variableRefId || '').trim() === childId);
    const internalLabel = entry ? entryLabel(entry) : '';
    const internalOnly =
      localLabelForSubflowTaskVariable(internalLabel) || internalLabel || childId;
    const fq = buildSubflowQualifiedDisplayLabel(title, internalOnly);

    mergeProjectTranslationEntry(parentId, fq);
    mergeProjectTranslationEntry(childId, internalOnly);
    logTaskSubflowMove('apply:secondPass:rename', {
      varId: parentId,
      childVarId: childId,
      parentNewLabel: fq,
      childInternalLabel: internalOnly,
    });
    count++;
  }
  return count;
}

/**
 * After child flow interface outputs change: update every parent Subflow task that references this child flow.
 */
export async function syncSubflowChildInterfaceToAllParents(
  projectId: string,
  childFlowId: string,
  flows: WorkspaceState['flows']
): Promise<void> {
  const pid = String(projectId || '').trim();
  const cf = String(childFlowId || '').trim();
  if (!pid || !cf) return;

  const outputs = await resolveChildInterfaceOutputs(pid, cf, flows);
  const instances = collectParentSubflowInstancesForChildFlow(cf, flows);
  for (const inst of instances) {
    syncProxyBindingsForSubflowTask(pid, inst.parentFlowId, inst.subflowTaskId, cf, outputs, flows);
  }
}

/**
 * When a parent links a Subflow row to a child flow (single instance).
 */
export async function syncProxyBindingsForSingleSubflowTaskAsync(
  projectId: string,
  parentFlowId: string,
  subflowTaskId: string,
  flows: WorkspaceState['flows']
): Promise<void> {
  const pid = String(projectId || '').trim();
  if (!pid) return;
  const task = taskRepository.getTask(subflowTaskId);
  if (!task || task.type !== TaskType.Subflow) return;
  const childFlowId = resolveSubflowId(task);
  if (!childFlowId) return;
  const outputs = await resolveChildInterfaceOutputs(pid, childFlowId, flows);
  syncProxyBindingsForSubflowTask(pid, parentFlowId, subflowTaskId, childFlowId, outputs, flows);
}
