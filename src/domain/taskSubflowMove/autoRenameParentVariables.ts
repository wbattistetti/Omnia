/**
 * After task→subflow move: renames parent variable display names to `prefix.leaf` (S2), where
 * `prefix` is derived from the subflow title and `leaf` from the child interface output or the
 * current variable name. Writes `var:<uuid>` into parent flow `meta.translations` and publishes
 * globally so editors resolve labels consistently.
 *
 * `taskVariableIds` is the set to rename — for a normal linked DnD move, callers pass only varIds
 * referenced in the parent; legacy resync may pass the full task variable id list.
 */

import type { MappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import type { WorkspaceState } from '@flows/FlowTypes';
import { localLabelForSubflowTaskVariable, normalizeSemanticTaskLabel } from '@domain/variableProxyNaming';
import { variableCreationService } from '@services/VariableCreationService';
import type { VariableInstance } from '@types/variableTypes';
import { getVariableLabel } from '@utils/getVariableLabel';
import { getProjectTranslationsTable } from '@utils/projectTranslationsRegistry';
import { publishVariableDisplayTranslation } from '@utils/variableTranslationBridge';
import { makeTranslationKey } from '@utils/translationKeys';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';
import { logS2Diag } from '@utils/s2WiringDiagnostic';

import { extractInterfaceOutputsByVariableRefId } from './autoFillSubflowBindings';
import { mergeVariableDisplayLabelIntoParentFlowSlice } from './subflowParentFlowTranslations';

export type FlowDoc = NonNullable<WorkspaceState['flows'][string]>;

export type AutoRenameParentVariablesParams = {
  projectId: string;
  parentFlowId: string;
  parentFlow: FlowDoc | undefined;
  childFlow: FlowDoc | undefined;
  /** Subflow canvas row / display title (e.g. "Chiedi i dati personali"). */
  subflowDisplayTitle: string;
  /** Variable GUIDs to rename in the parent (referenced-only for standard linked moves). */
  taskVariableIds: readonly string[];
  /** Current workspace flows; updated copy returned with parent slice translations merged. */
  flows: WorkspaceState['flows'];
};

export type ParentAutoRenameRecord = { id: string; previousName: string; nextName: string };

function interfaceParamLabel(entry: MappingEntry | undefined, translations: Record<string, string>): string {
  if (!entry) return '';
  const vid = entry.variableRefId?.trim();
  if (vid) {
    const t = getVariableLabel(vid, translations);
    if (t) return t;
  }
  const lk = entry.labelKey?.trim();
  if (lk && translations[lk] != null && String(translations[lk]).trim() !== '') {
    return String(translations[lk]).trim();
  }
  return '';
}

function parentAuthoringLabel(v: VariableInstance, translations: Record<string, string>): string {
  return getVariableLabel(v.id, translations) || '';
}

function computeLeafForS2Rename(
  v: VariableInstance,
  entry: MappingEntry | undefined,
  translations: Record<string, string>
): string {
  const paramRaw = interfaceParamLabel(entry, translations);
  if (paramRaw) {
    return (
      localLabelForSubflowTaskVariable(paramRaw) ||
      normalizeSemanticTaskLabel(paramRaw) ||
      paramRaw.trim()
    );
  }
  const parentRaw = parentAuthoringLabel(v, translations);
  return (
    localLabelForSubflowTaskVariable(parentRaw) ||
    normalizeSemanticTaskLabel(parentRaw) ||
    parentRaw.trim()
  );
}

/**
 * Applies `prefix.leaf` rename for each id in `taskVariableIds`, updates parent flow
 * translations in `flows`, and publishes `var:<uuid>` globally.
 */
export function autoRenameParentVariablesForMovedTask(params: AutoRenameParentVariablesParams): {
  renamed: ParentAutoRenameRecord[];
  flowsNext: WorkspaceState['flows'];
} {
  const pid = String(params.projectId || '').trim();
  const parentFlowId = String(params.parentFlowId || '').trim();
  let flowsNext = params.flows;
  if (!pid || !parentFlowId) {
    logS2Diag('autoRenameParent', 'ABORT pid/parentFlowId mancante', { pid, parentFlowId });
    return { renamed: [], flowsNext };
  }

  const prefix =
    normalizeSemanticTaskLabel(params.subflowDisplayTitle) ||
    String(params.subflowDisplayTitle || '').trim();
  if (!prefix) {
    logTaskSubflowMove('autoRename:skip', { reason: 'empty_subflow_title' });
    logS2Diag('autoRenameParent', 'SKIP: subflowDisplayTitle vuoto → nessun prefix.leaf', {});
    return { renamed: [], flowsNext };
  }

  const taskVarSet = new Set(params.taskVariableIds.map((x) => String(x || '').trim()).filter(Boolean));
  if (taskVarSet.size === 0) {
    logS2Diag('autoRenameParent', 'SKIP: taskVariableIds vuoto', { parentFlowId });
    return { renamed: [], flowsNext };
  }

  const ifaceByVarRef = extractInterfaceOutputsByVariableRefId(params.childFlow);
  const translations = getProjectTranslationsTable();
  const all = variableCreationService.getAllVariables(pid) ?? [];

  const renamed: ParentAutoRenameRecord[] = [];

  for (const vid of taskVarSet) {
    const v = all.find((x) => String(x.id || '').trim() === vid);
    if (!v) {
      logS2Diag('autoRenameParent', 'SKIP: variabile non in store progetto (rename impossibile)', {
        variableId: vid,
        parentFlowId,
        storeRowCount: all.length,
      });
      continue;
    }
    if (v.subflowAutoRenameLocked === true) {
      logTaskSubflowMove('autoRename:skipLocked', { variableId: vid });
      continue;
    }

    const entry = ifaceByVarRef.get(vid);
    const leaf = computeLeafForS2Rename(v, entry, translations);
    if (!leaf) {
      logTaskSubflowMove('autoRename:skipEmptyLeaf', { variableId: vid });
      continue;
    }

    const nextName = `${prefix}.${leaf}`;
    const prevName = getVariableLabel(vid, translations) || vid;
    if (prevName === nextName) continue;

    const ok = variableCreationService.renameVariableRowById(pid, vid, nextName);
    if (!ok) {
      logTaskSubflowMove('autoRename:renameFailed', { variableId: vid, nextName });
      continue;
    }

    flowsNext = mergeVariableDisplayLabelIntoParentFlowSlice(flowsNext, parentFlowId, vid, nextName);

    try {
      publishVariableDisplayTranslation(makeTranslationKey('var', vid), nextName);
    } catch {
      logTaskSubflowMove('autoRename:translationPublishFailed', { variableId: vid });
    }

    renamed.push({ id: vid, previousName: prevName, nextName });
  }

  if (renamed.length > 0) {
    logTaskSubflowMove('autoRename:done', { count: renamed.length, parentFlowId });
  }

  return { renamed, flowsNext };
}
