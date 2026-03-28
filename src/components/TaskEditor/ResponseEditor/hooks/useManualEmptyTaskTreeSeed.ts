/**
 * Legacy hook: manual mode no longer auto-seeds a default field.
 * The sidebar starts empty; the user adds structure via "Add root data" and row hover actions.
 */

import type { TaskTree } from '@types/taskTypes';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';
import type { SelectPathHandler } from '@responseEditor/features/node-editing/selectPathTypes';

export interface UseManualEmptyTaskTreeSeedParams {
  taskWizardMode: TaskWizardMode;
  taskId: string | undefined;
  isTaskTreeLoading: boolean | undefined;
  needsTaskBuilder: boolean | undefined;
  taskLabel: string;
  headerTitle: string;
  replaceSelectedTaskTree: (next: TaskTree) => void;
  handleSelectByPath: SelectPathHandler;
  setSelectedRoot: (value: boolean) => void;
}

/** No-op: keeps call sites stable while manual empty state is handled only in the sidebar. */
export function useManualEmptyTaskTreeSeed(_params: UseManualEmptyTaskTreeSeedParams): void {
  /* intentionally empty */
}
