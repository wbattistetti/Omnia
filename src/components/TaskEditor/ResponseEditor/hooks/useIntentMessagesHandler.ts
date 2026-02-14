// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { taskRepository } from '@services/TaskRepository';
import { getTemplateId } from '@utils/taskHelpers';
import { TaskType, isUtteranceInterpretationTemplateId } from '@types/taskTypes';
import type { Task, TaskTree } from '@types/taskTypes';
import { saveIntentMessagesToTaskTree } from '@responseEditor/utils/saveIntentMessages';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';

export interface UseIntentMessagesHandlerParams {
  task: Task | null | undefined;
  taskTree: TaskTree | null | undefined;
  currentProjectId: string | null;
  onWizardComplete?: (finalTaskTree: TaskTree) => void;
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
}

/**
 * Hook that provides handleIntentMessagesComplete function for handling intent messages completion.
 */
export function useIntentMessagesHandler(params: UseIntentMessagesHandlerParams) {
  const {
    task,
    taskTree,
    currentProjectId,
    onWizardComplete,
    replaceSelectedTaskTree,
  } = params;

  // ✅ FASE 1.1: Get addTranslation from context
  let addTranslation: ((guid: string, text: string) => void) | undefined;
  try {
    const { addTranslation: addTranslationFromContext } = useProjectTranslations();
    addTranslation = addTranslationFromContext;
  } catch {
    // Context not available, will use fallback in saveIntentMessagesToTaskTree
    addTranslation = undefined;
  }

  const handleIntentMessagesComplete = useCallback((messages: any) => {
    const updatedTaskTree = saveIntentMessagesToTaskTree(taskTree, messages, addTranslation);

    // CRITICO: Salva il DDT nell'istanza IMMEDIATAMENTE quando si completano i messaggi
    // Questo assicura che quando si fa "Save" globale, l'istanza abbia il DDT aggiornato
    // ✅ NO FALLBACKS: Use instanceId as primary, id as fallback (both are valid properties)
    if (task?.id ?? (task as any)?.instanceId) {
      const key = ((task as any)?.instanceId ?? task?.id) as string;
      // MIGRATION: Use getTemplateId() helper
      // FIX: Se c'è un DDT, assicurati che il templateId sia 'UtteranceInterpretation'
      const taskInstance = taskRepository.getTask(key);
      const hasTaskTree = updatedTaskTree && Object.keys(updatedTaskTree).length > 0 && updatedTaskTree.nodes && updatedTaskTree.nodes.length > 0;
      if (hasTaskTree && taskInstance) {
        const currentTemplateId = getTemplateId(taskInstance);
        // Usa helper function invece di stringa hardcoded
        // Update task con campi TaskTree direttamente (niente wrapper value)
        if (!isUtteranceInterpretationTemplateId(currentTemplateId)) {
          taskRepository.updateTask(key, {
            type: TaskType.UtteranceInterpretation,  // type: enum numerico
            templateId: null,            // templateId: null (standalone)
            ...updatedTaskTree  // Spread: label, nodes, steps, ecc.
          }, currentProjectId || undefined);
        } else {
          taskRepository.updateTask(key, {
            ...updatedTaskTree  // Spread: label, nodes, steps, ecc.
          }, currentProjectId || undefined);
        }
      } else if (hasTaskTree) {
        // Task doesn't exist, create it with UtteranceInterpretation type
        taskRepository.createTask(TaskType.UtteranceInterpretation, null, updatedTaskTree, key, currentProjectId || undefined);
      } else {
        // FIX: Salva con projectId per garantire persistenza nel database
        taskRepository.updateTask(key, {
          ...updatedTaskTree  // Spread: label, nodes, steps, ecc.
        }, currentProjectId || undefined);
      }

      // FIX: Notifica il parent (DDTHostAdapter) che il TaskTree è stato aggiornato
      onWizardComplete?.(updatedTaskTree);
    }

    try {
      replaceSelectedTaskTree(updatedTaskTree);
    } catch (err) {
      console.error('[ResponseEditor][replaceSelectedDDT] FAILED', err);
    }

    // After saving, show normal editor (needsIntentMessages will become false)
  }, [task, taskTree, currentProjectId, onWizardComplete, replaceSelectedTaskTree, addTranslation]);

  return handleIntentMessagesComplete;
}
