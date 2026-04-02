/**
 * Merges dock-tab snapshot variables with live flowchart-scoped names from VariableCreationService
 * so the condition DSL picker updates after task-tree sync without closing the tab.
 */

import { variableCreationService } from '@services/VariableCreationService';
import { logVariableScope } from '@utils/debugVariableScope';
import { getSafeProjectId } from '@utils/safeProjectId';

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
    const names = variableCreationService.getAllVarNames(pid, fid);
    logVariableScope('conditionEditor.merge', {
      projectId: pid,
      flowCanvasId: fid,
      nameCount: names.length,
      names,
      tabKeys: Object.keys(base).length,
    });
    for (const n of names) {
      base[n] = '';
    }
  } catch {
    /* keep base */
  }
  return base;
}
