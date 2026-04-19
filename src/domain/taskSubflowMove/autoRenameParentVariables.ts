/**
 * After task→subflow move: renames parent variable display names to `prefix.leaf` (S2), where
 * `prefix` is derived from the subflow title and `leaf` from the child interface output or the
 * current variable name. Writes `var:<uuid>` into parent flow `meta.translations` and publishes
 * globally so editors resolve labels consistently.
 *
 * `taskVariableIds` is the set to rename — for a normal linked DnD move, callers pass only varIds
 * referenced in the parent; legacy resync may pass the full task variable id list.
 *
 * Label resolution priority for the leaf:
 *   1. Child flow `meta.translations` (in-progress, already has cloned `var:` labels)
 *   2. Parent flow `meta.translations` (still has the pre-rename label at this point)
 *   3. Global project translations registry (may be stale; used as last resort)
 * Using in-progress flow meta avoids race conditions where `getProjectTranslationsTable()` has not
 * yet been updated by React context during the synchronous move pipeline.
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
import { logTaskSubflowMove, logTaskSubflowMoveTrace } from '@utils/taskSubflowMoveDebug';
import { logS2Diag } from '@utils/s2WiringDiagnostic';
import { isDndOperationInstrumentEnabled } from '@utils/dndOperationInstrument';
import { flattenFlowMetaTranslations } from '@utils/activeFlowTranslations';

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
  /** Optional: correlates with `applyTaskMoveToSubflow` / DnD. */
  dndTraceId?: string;
  /** Explicit gesture id for `[Subflow:autoRename]` logs (often same as `dndTraceId`). */
  operationId?: string;
};

export type ParentAutoRenameRecord = { id: string; previousName: string; nextName: string };

/**
 * Builds the translations lookup used for leaf computation during the rename.
 *
 * Priority (last write wins):
 *   1. Child flow `meta.translations` — may contain cloned `var:` labels (in-progress)
 *   2. Parent flow `meta.translations` — holds the original (pre-rename) labels
 *   3. Global compiled registry — wins over flow meta (authoritative when available)
 *
 * This order means: global always wins; parent/child fill keys that are absent in the stale
 * registry (e.g. labels written only to flow meta and not yet propagated to `ProjectTranslationsContext`).
 */
function buildRenameTranslations(
  parentFlow: FlowDoc | undefined,
  childFlow: FlowDoc | undefined
): Record<string, string> {
  const global = getProjectTranslationsTable();
  const parent = flattenFlowMetaTranslations(parentFlow);
  const child = flattenFlowMetaTranslations(childFlow);
  return { ...child, ...parent, ...global };
}

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
export function autoRenameReferencedVariablesForMovedTask(params: AutoRenameParentVariablesParams): {
  renamed: ParentAutoRenameRecord[];
  flowsNext: WorkspaceState['flows'];
} {
  const pid = String(params.projectId || '').trim();
  const parentFlowId = String(params.parentFlowId || '').trim();
  const traceId = String(params.dndTraceId || '').trim();
  const operationId = String(params.operationId || '').trim() || traceId;
  let flowsNext = params.flows;
  if (!pid || !parentFlowId) {
    logS2Diag('autoRenameParent', 'ABORT pid/parentFlowId mancante', { pid, parentFlowId });
    logTaskSubflowMoveTrace('autoRename:abortMissingPidOrParent', { dndTraceId: traceId || undefined, pid, parentFlowId });
    return { renamed: [], flowsNext };
  }

  const prefix =
    normalizeSemanticTaskLabel(params.subflowDisplayTitle) ||
    String(params.subflowDisplayTitle || '').trim();
  if (!prefix) {
    logTaskSubflowMove('autoRename:skip', { reason: 'empty_subflow_title' });
    logS2Diag('autoRenameParent', 'SKIP: subflowDisplayTitle vuoto → nessun prefix.leaf', {});
    logTaskSubflowMoveTrace('autoRename:skipEmptyPrefix', { dndTraceId: traceId || undefined, parentFlowId });
    return { renamed: [], flowsNext };
  }

  const taskVarSet = new Set(params.taskVariableIds.map((x) => String(x || '').trim()).filter(Boolean));
  if (taskVarSet.size === 0) {
    logS2Diag('autoRenameParent', 'SKIP: taskVariableIds vuoto', { parentFlowId });
    logTaskSubflowMoveTrace('autoRename:skipEmptyTaskVariableIds', {
      dndTraceId: traceId || undefined,
      parentFlowId,
      prefix,
    });
    return { renamed: [], flowsNext };
  }

  logTaskSubflowMoveTrace('autoRename:enter', {
    dndTraceId: traceId || undefined,
    parentFlowId,
    prefix,
    candidateVarCount: taskVarSet.size,
    candidateVarIds: [...taskVarSet].sort(),
  });

  const ifaceByVarRef = extractInterfaceOutputsByVariableRefId(params.childFlow);
  const translations = buildRenameTranslations(params.parentFlow, params.childFlow);
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
      logTaskSubflowMoveTrace('autoRename:skipNotInStore', {
        dndTraceId: traceId || undefined,
        variableId: vid,
        parentFlowId,
      });
      if (isDndOperationInstrumentEnabled()) {
        console.log('[Rename] result', {
          operationId: operationId || undefined,
          varId: vid,
          prevName: '',
          nextName: '',
          result: 'skipEmpty' as const,
        });
      }
      continue;
    }
    if (v.subflowAutoRenameLocked === true) {
      logTaskSubflowMove('autoRename:skipLocked', { variableId: vid });
      logTaskSubflowMoveTrace('autoRename:skipLocked', { dndTraceId: traceId || undefined, variableId: vid });
      if (isDndOperationInstrumentEnabled()) {
        const prevName = getVariableLabel(vid, translations) || vid;
        console.log('[Rename] result', {
          operationId: operationId || undefined,
          varId: vid,
          prevName,
          nextName: prevName,
          result: 'skipLocked' as const,
        });
      }
      continue;
    }

    const entry = ifaceByVarRef.get(vid);
    const leaf = computeLeafForS2Rename(v, entry, translations);
    if (!leaf) {
      logTaskSubflowMove('autoRename:skipEmptyLeaf', { variableId: vid });
      logTaskSubflowMoveTrace('autoRename:skipEmptyLeaf', { dndTraceId: traceId || undefined, variableId: vid });
      if (isDndOperationInstrumentEnabled()) {
        const prevName = getVariableLabel(vid, translations) || vid;
        console.log('[Rename] result', {
          operationId: operationId || undefined,
          varId: vid,
          prevName,
          nextName: '',
          result: 'skipEmpty' as const,
        });
      }
      continue;
    }

    const nextName = `${prefix}.${leaf}`;
    const prevName = getVariableLabel(vid, translations) || vid;
    if (prevName === nextName) {
      logTaskSubflowMoveTrace('autoRename:skipAlreadyQualified', {
        dndTraceId: traceId || undefined,
        variableId: vid,
        prevName,
        nextName,
      });
      if (isDndOperationInstrumentEnabled()) {
        console.log('[Rename] result', {
          operationId: operationId || undefined,
          varId: vid,
          prevName,
          nextName,
          result: 'skipSame' as const,
        });
      }
      continue;
    }

    const ok = variableCreationService.renameVariableRowById(pid, vid, nextName);
    if (!ok) {
      logTaskSubflowMove('autoRename:renameFailed', { variableId: vid, nextName });
      logTaskSubflowMoveTrace('autoRename:renameFailed', {
        dndTraceId: traceId || undefined,
        variableId: vid,
        nextName,
      });
      if (isDndOperationInstrumentEnabled()) {
        console.log('[Rename] result', {
          operationId: operationId || undefined,
          varId: vid,
          prevName,
          nextName,
          result: 'renameFailed' as const,
        });
      }
      continue;
    }

    flowsNext = mergeVariableDisplayLabelIntoParentFlowSlice(flowsNext, parentFlowId, vid, nextName);

    try {
      publishVariableDisplayTranslation(makeTranslationKey('var', vid), nextName);
    } catch {
      logTaskSubflowMove('autoRename:translationPublishFailed', { variableId: vid });
    }

    renamed.push({ id: vid, previousName: prevName, nextName });
    logTaskSubflowMoveTrace('autoRename:renamedOne', {
      dndTraceId: traceId || undefined,
      variableId: vid,
      previousName: prevName,
      nextName,
    });
    if (isDndOperationInstrumentEnabled()) {
      console.log('[Rename] result', {
        operationId: operationId || undefined,
        varId: vid,
        prevName,
        nextName,
        result: 'done' as const,
      });
    }
  }

  if (renamed.length > 0) {
    logTaskSubflowMove('autoRename:done', { count: renamed.length, parentFlowId });
  }
  logTaskSubflowMoveTrace('autoRename:exit', {
    dndTraceId: traceId || undefined,
    parentFlowId,
    renamedCount: renamed.length,
    renamedIds: renamed.map((r) => r.id),
  });

  return { renamed, flowsNext };
}
