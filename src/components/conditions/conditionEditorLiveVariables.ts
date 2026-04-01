/**
 * Merges dock-tab snapshot variables with live flowchart-scoped names from VariableCreationService
 * so the condition DSL picker updates after task-tree sync without closing the tab.
 */

import { variableCreationService } from '@services/VariableCreationService';

export function mergeConditionEditorVariablesWithLiveFlowchart(
  projectId: string | null | undefined,
  flowCanvasId: string | null | undefined,
  tabVariables: Record<string, unknown> | undefined
): Record<string, unknown> {
  const pid = String(projectId || '').trim();
  const fid = String(flowCanvasId || '').trim();
  const base =
    tabVariables && typeof tabVariables === 'object' && !Array.isArray(tabVariables)
      ? { ...tabVariables }
      : {};
  if (!pid || !fid) {
    return base;
  }
  try {
    const names = variableCreationService.getAllVarNames(pid, fid);
    for (const n of names) {
      base[n] = '';
    }
  } catch {
    /* keep base */
  }
  return base;
}
