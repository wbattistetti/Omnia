/**
 * FLOW.SAVE-BULK REFACTOR — Re-exports explicit flow-scoped routing; heuristic canvas/task lookup removed.
 */

import {
  getFlowIdForFlowScopedWrite,
  shouldPersistTranslationToGlobalApi,
} from './flowScopedTranslation';

export { getFlowIdForFlowScopedWrite, shouldPersistTranslationToGlobalApi };

/**
 * @deprecated Prefer {@link getFlowIdForFlowScopedWrite}. `projectId` is unused (flow-centric model).
 */
export function resolveFlowIdForTranslationKey(
  key: string,
  _projectId: string | null | undefined
): string | null {
  return getFlowIdForFlowScopedWrite(key);
}
