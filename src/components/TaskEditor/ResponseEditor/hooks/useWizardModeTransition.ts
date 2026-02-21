// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';
import type { TaskTree } from '@types/taskTypes';
import type { PipelineStep } from '../../../../../TaskBuilderAIWizard/store/wizardStore';

/**
 * Hook di supporto per determinare quando resettare taskWizardMode a 'none'.
 *
 * ✅ TEMPORARY SIMPLIFICATION: Testing minimal conditions to isolate the issue.
 * If this works, the problem is pipelineSteps. If not, wizardMode never becomes COMPLETED or taskTree is null.
 */
export function useWizardModeTransition(
  taskWizardMode: TaskWizardMode,
  wizardMode: WizardMode | undefined,
  taskTree: TaskTree | null | undefined,
  pipelineSteps: PipelineStep[] | undefined,
  taskTreeVersion?: number
): boolean {
  // ✅ REMOVED: Log rumoroso che causava spam in console
  // Il problema di rendering continuo verrà risolto con refactoring architetturale

  // ✅ MINIMAL CONDITIONS: Only check wizardMode and taskTree
  // If this works, the problem is pipelineSteps
  // If this doesn't work, wizardMode never becomes COMPLETED or taskTree is null
  return (
    taskWizardMode === 'full' &&
    wizardMode === WizardMode.COMPLETED &&
    taskTree !== null &&
    taskTree !== undefined
  );
}
