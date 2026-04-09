/**
 * After task→subflow move: renames parent variable display names when the leaf label matches the child
 * interface output label, using the semantic subflow title as prefix (`prefix.leaf`).
 * Respects {@link VariableInstance.subflowAutoRenameLocked} (user override).
 */

import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import type { WorkspaceState } from '@flows/FlowTypes';
import { localLabelForSubflowTaskVariable, normalizeSemanticTaskLabel } from '@domain/variableProxyNaming';
import { variableCreationService } from '@services/VariableCreationService';
import type { VariableInstance } from '@types/variableTypes';
import { getVariableLabel } from '@utils/getVariableLabel';
import { getProjectTranslationsTable, mergeProjectTranslationEntry } from '@utils/projectTranslationsRegistry';
import { makeTranslationKey } from '@utils/translationKeys';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';

import { extractInterfaceOutputsByVariableRefId } from './autoFillSubflowBindings';

export type FlowDoc = NonNullable<WorkspaceState['flows'][string]>;

export type AutoRenameParentVariablesParams = {
  projectId: string;
  parentFlowId: string;
  parentFlow: FlowDoc | undefined;
  childFlow: FlowDoc | undefined;
  /** Subflow canvas row / display title (e.g. "Chiedi i dati personali"). */
  subflowDisplayTitle: string;
  referencedVarIds: readonly string[];
};

export type ParentAutoRenameRecord = { id: string; previousName: string; nextName: string };

function interfaceParamLabel(entry: MappingEntry): string {
  return String(entry.externalName || entry.internalPath || entry.linkedVariable || '').trim();
}

function parentAuthoringLabel(v: VariableInstance, translations: Record<string, string>): string {
  const fromTr = getVariableLabel(v.id, translations);
  if (fromTr) return fromTr;
  return String(v.varName || '').trim();
}

function leafMatchesParentAndParam(parentLabel: string, paramLabel: string): boolean {
  const p = localLabelForSubflowTaskVariable(parentLabel) || normalizeSemanticTaskLabel(parentLabel);
  const q = localLabelForSubflowTaskVariable(paramLabel) || normalizeSemanticTaskLabel(paramLabel);
  if (!p || !q) return false;
  return p.toLowerCase() === q.toLowerCase();
}

/**
 * Applies `prefix.leaf` rename to referenced parent variables when labels match child interface outputs.
 */
export function autoRenameParentVariablesForMovedTask(
  params: AutoRenameParentVariablesParams
): { renamed: ParentAutoRenameRecord[] } {
  const pid = String(params.projectId || '').trim();
  const parentFlowId = String(params.parentFlowId || '').trim();
  if (!pid || !parentFlowId) return { renamed: [] };

  const prefix =
    normalizeSemanticTaskLabel(params.subflowDisplayTitle) ||
    String(params.subflowDisplayTitle || '').trim();
  if (!prefix) {
    logTaskSubflowMove('autoRename:skip', { reason: 'empty_subflow_title' });
    return { renamed: [] };
  }

  const refSet = new Set(params.referencedVarIds.map((x) => String(x || '').trim()).filter(Boolean));
  if (refSet.size === 0) return { renamed: [] };

  const ifaceByVarRef = extractInterfaceOutputsByVariableRefId(params.childFlow);
  const translations = getProjectTranslationsTable();
  const all = variableCreationService.getAllVariables(pid) ?? [];

  const renamed: ParentAutoRenameRecord[] = [];

  for (const vid of refSet) {
    const v = all.find((x) => String(x.id || '').trim() === vid);
    if (!v) continue;
    if (v.subflowAutoRenameLocked === true) {
      logTaskSubflowMove('autoRename:skipLocked', { variableId: vid });
      continue;
    }

    const entry = ifaceByVarRef.get(vid);
    if (!entry) continue;

    const paramRaw = interfaceParamLabel(entry as MappingEntry);
    if (!paramRaw) continue;

    const parentRaw = parentAuthoringLabel(v, translations);
    if (!leafMatchesParentAndParam(parentRaw, paramRaw)) continue;

    const leaf =
      localLabelForSubflowTaskVariable(paramRaw) ||
      normalizeSemanticTaskLabel(paramRaw) ||
      paramRaw.trim();
    if (!leaf) continue;

    const nextName = `${prefix}.${leaf}`;
    const prevName = String(v.varName || '').trim();
    if (prevName === nextName) continue;

    const ok = variableCreationService.renameVariableRowById(pid, vid, nextName);
    if (!ok) {
      logTaskSubflowMove('autoRename:renameFailed', { variableId: vid, nextName });
      continue;
    }

    try {
      mergeProjectTranslationEntry(makeTranslationKey('variable', vid), nextName);
    } catch {
      logTaskSubflowMove('autoRename:translationMergeFailed', { variableId: vid });
    }

    renamed.push({ id: vid, previousName: prevName, nextName });
  }

  if (renamed.length > 0) {
    logTaskSubflowMove('autoRename:done', { count: renamed.length, parentFlowId });
  }

  return { renamed };
}
