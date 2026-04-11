/**
 * Merges dock-tab snapshot variables with live flowchart-scoped names from VariableCreationService
 * so the condition DSL picker updates after task-tree sync without closing the tab.
 *
 * Live flowchart variable **keys** are display labels from {@link getVariableLabel}
 * using that canvas `flow.meta.translations` only.
 */

import type { VariableInstance } from '@types/variableTypes';
import { variableCreationService } from '@services/VariableCreationService';
import { logVariableScope } from '@utils/debugVariableScope';
import { getSafeProjectId } from '@utils/safeProjectId';
import { getVariableLabel } from '@utils/getVariableLabel';
import { getFlowMetaTranslationsFlattened } from '@utils/activeFlowTranslations';

/**
 * Display label for a variable row: `var:<guid>` in the flow canvas meta only; missing → GUID.
 */
export function flowchartVariableDisplayLabel(v: VariableInstance, flowCanvasId: string): string {
  const id = String(v.id || '').trim();
  if (!id) return '';
  const fid = String(flowCanvasId || '').trim();
  if (!fid) return '';
  return getVariableLabel(id, getFlowMetaTranslationsFlattened(fid));
}

/**
 * Map `{ [displayLabel]: '' }` for variables visible on the flow canvas (same scoping as conditions).
 */
export function buildFlowchartVariableLabelRecord(
  projectId: string | null | undefined,
  flowCanvasId: string | null | undefined
): Record<string, unknown> {
  const pid = projectId ?? getSafeProjectId();
  const fid = String(flowCanvasId || '').trim();
  const out: Record<string, unknown> = {};
  if (!fid) return out;
  try {
    const instances = variableCreationService.getVariablesForFlowScope(pid, fid) ?? [];
    const labels: string[] = [];
    for (const v of instances) {
      const label = flowchartVariableDisplayLabel(v as VariableInstance, fid);
      if (label) {
        out[label] = '';
        labels.push(label);
      }
    }
    logVariableScope('conditionEditor.merge', {
      projectId: pid,
      flowCanvasId: fid,
      labelCount: labels.length,
      labels,
      source: 'flow.meta.translations',
    });
  } catch {
    /* keep out */
  }
  return out;
}

export function mergeConditionEditorVariablesWithLiveFlowchart(
  _projectId: string | null | undefined,
  flowCanvasId: string | null | undefined,
  tabVariables: Record<string, unknown> | undefined
): Record<string, unknown> {
  const pid = getSafeProjectId();
  const fid = String(flowCanvasId || '').trim();
  const base =
    tabVariables && typeof tabVariables === 'object' && !Array.isArray(tabVariables)
      ? { ...tabVariables }
      : {};
  if (!fid) {
    return base;
  }
  try {
    const live = buildFlowchartVariableLabelRecord(pid, fid);
    for (const k of Object.keys(live)) {
      base[k] = '';
    }
  } catch {
    /* keep base */
  }
  return base;
}
