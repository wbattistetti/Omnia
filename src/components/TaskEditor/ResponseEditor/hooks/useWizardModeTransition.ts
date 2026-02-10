// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useMemo } from 'react';
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';
import type { TaskTree } from '@types/taskTypes';
import type { PipelineStep } from '../../../../../TaskBuilderAIWizard/hooks/useWizardState';

/**
 * Hook di supporto per determinare quando resettare taskWizardMode a 'none'.
 * Monitora: wizardMode, taskTree, pipelineSteps.
 * Ritorna: shouldTransitionToNone: boolean.
 */
export function useWizardModeTransition(
  taskWizardMode: TaskWizardMode,
  wizardMode: WizardMode | undefined,
  taskTree: TaskTree | null | undefined,
  pipelineSteps: PipelineStep[] | undefined
): boolean {
  return useMemo(() => {
    // ✅ Transiziona a 'none' solo se:
    // 1. taskWizardMode è 'full'
    // 2. wizardMode è COMPLETED
    // 3. taskTree è disponibile (task salvato)
    // 4. Tutti gli step sono completati
    if (
      taskWizardMode === 'full' &&
      wizardMode === WizardMode.COMPLETED &&
      taskTree !== null &&
      taskTree !== undefined &&
      pipelineSteps &&
      pipelineSteps.every(step => step.status === 'completed')
    ) {
      return true;
    }
    return false;
  }, [taskWizardMode, wizardMode, taskTree, pipelineSteps]);
}
