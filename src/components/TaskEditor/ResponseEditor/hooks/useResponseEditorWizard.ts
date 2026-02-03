/**
 * useResponseEditorWizard
 *
 * Custom hook that manages all wizard-related logic for ResponseEditor.
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 *
 * This hook handles:
 * - Wizard rendering logic (DDTWizard vs ContractWizard)
 * - Wizard handlers (onComplete, onClose, onNodeUpdate)
 * - Wizard ownership management (wizardOwnsDataRef)
 * - Initial DDT preparation for wizards
 */

import { useCallback } from 'react';
import { info } from '../../../../utils/logger';
import { taskRepository } from '../../../../services/TaskRepository';
import { TaskType } from '../../../../types/taskTypes';
import type { Task, TaskTree } from '../../../../types/taskTypes';
import { saveTaskToRepository } from '../modules/ResponseEditor/persistence/ResponseEditorPersistence';

export interface UseResponseEditorWizardProps {
  task: Task | null | undefined;
  taskTree: TaskTree | null | undefined;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;
  currentProjectId: string | null;
  showWizard: boolean;
  showContractWizard: boolean;
  isInferring: boolean;
  inferenceResult: any;
  setShowWizard: (value: boolean) => void;
  setShowContractWizard: (value: boolean) => void;
  setTaskTreeVersion: React.Dispatch<React.SetStateAction<number>>;
  setLeftPanelMode: React.Dispatch<React.SetStateAction<any>>;
  replaceSelectedDDT: (taskTree: TaskTree) => void;
  wizardOwnsDataRef: React.MutableRefObject<boolean>;
  onClose?: () => void;
  onWizardComplete?: (finalTaskTree: TaskTree) => void;
}

export interface UseResponseEditorWizardResult {
  handleGenerateAll: () => void;
  handleContractWizardClose: () => void;
  handleContractWizardNodeUpdate: (nodeId: string) => void;
  handleContractWizardComplete: (results: any) => void;
  handleDDTWizardCancel: () => void;
  handleDDTWizardComplete: (finalDDT: TaskTree, messages?: any) => Promise<void>;
  getInitialDDT: () => TaskTree | undefined;
  shouldShowInferenceLoading: boolean;
}

/**
 * Hook that manages all wizard-related logic for ResponseEditor
 */
export function useResponseEditorWizard({
  task,
  taskTree,
  taskTreeRef,
  currentProjectId,
  showWizard,
  showContractWizard,
  isInferring,
  inferenceResult,
  setShowWizard,
  setShowContractWizard,
  setTaskTreeVersion,
  setLeftPanelMode,
  replaceSelectedDDT,
  wizardOwnsDataRef,
  onClose,
  onWizardComplete,
}: UseResponseEditorWizardProps): UseResponseEditorWizardResult {

  // ✅ Handler for Generate All button (opens ContractWizard)
  const handleGenerateAll = useCallback(() => {
    setShowContractWizard(true);
  }, [setShowContractWizard]);

  // ✅ Handler for ContractWizard close
  const handleContractWizardClose = useCallback(() => {
    setShowContractWizard(false);
  }, [setShowContractWizard]);

  // ✅ Handler for ContractWizard node update
  const handleContractWizardNodeUpdate = useCallback((nodeId: string) => {
    // ✅ Trigger refresh of parser status in Sidebar
    info('RESPONSE_EDITOR', 'Node updated in ContractWizard', { nodeId });
    // Force re-render of Sidebar to show updated parser status
    setTaskTreeVersion(v => v + 1);
  }, [setTaskTreeVersion]);

  // ✅ Handler for ContractWizard complete
  const handleContractWizardComplete = useCallback((results: any) => {
    info('RESPONSE_EDITOR', 'Contract wizard completed', { results });
    setShowContractWizard(false);
    // Force re-render of Sidebar to show updated parser status
    setTaskTreeVersion(v => v + 1);
  }, [setShowContractWizard, setTaskTreeVersion]);

  // ✅ Handler for DDTWizard cancel
  const handleDDTWizardCancel = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // ✅ Handler for DDTWizard complete
  const handleDDTWizardComplete = useCallback(async (finalDDT: TaskTree, messages?: any) => {
    if (!finalDDT) {
      info('RESPONSE_EDITOR', 'onComplete called with null/undefined finalDDT');
      return;
    }

    // ✅ DEBUG: Verifica cosa contiene finalDDT dal wizard
    info('RESPONSE_EDITOR', 'DDTWizard onComplete', {
      hasFinalDDT: !!finalDDT,
      finalDDTKeys: Object.keys(finalDDT || {}),
      hasSteps: !!finalDDT.steps,
      stepsType: typeof finalDDT.steps,
      stepsKeys: finalDDT.steps ? Object.keys(finalDDT.steps) : [],
      stepsCount: finalDDT.steps ? Object.keys(finalDDT.steps).length : 0,
      hasNodes: !!finalDDT.nodes,
      nodesLength: finalDDT.nodes?.length || 0,
    });

    // ✅ NUOVO MODELLO: Usa direttamente finalDDT (TaskTree con nodes[])
    const coerced = finalDDT;

    // Set flag to prevent auto-reopen IMMEDIATELY (before any state updates)
    wizardOwnsDataRef.current = true;

    // ✅ CRITICAL: Salva immediatamente il task con steps per evitare perdita dati
    // Questo assicura che quando si riapre l'editor, i steps siano già salvati
    if (task?.id || task?.instanceId) {
      const key = (task?.instanceId || task?.id) as string;
      const hasDDT = coerced && Object.keys(coerced).length > 0 && coerced.nodes && coerced.nodes.length > 0;

      if (hasDDT) {
        let taskInstance = taskRepository.getTask(key);
        if (!taskInstance) {
          const taskType = task?.type ?? TaskType.UtteranceInterpretation;
          taskInstance = taskRepository.createTask(taskType, null, undefined, key, currentProjectId || undefined);
        }

        // ✅ DEBUG: Verifica taskInstance prima del salvataggio
        info('RESPONSE_EDITOR', 'taskInstance before save', {
          key,
          hasTaskInstance: !!taskInstance,
          taskInstanceHasSteps: !!taskInstance.steps,
          taskInstanceStepsKeys: taskInstance.steps ? Object.keys(taskInstance.steps) : [],
          taskInstanceStepsCount: taskInstance.steps ? Object.keys(taskInstance.steps).length : 0
        });

        // ✅ Usa funzione di persistenza per salvare
        await saveTaskToRepository(key, coerced, taskInstance, currentProjectId || undefined);

        // ✅ DEBUG: Verifica task salvato dopo il salvataggio
        const savedTask = taskRepository.getTask(key);
        info('RESPONSE_EDITOR', 'Task saved with steps', {
          key,
          hasSteps: !!coerced.steps,
          stepsCount: coerced.steps ? Object.keys(coerced.steps).length : 0,
          nodesLength: coerced.nodes?.length || 0,
          savedTaskHasSteps: !!savedTask?.steps,
          savedTaskStepsKeys: savedTask?.steps ? Object.keys(savedTask.steps) : [],
          savedTaskStepsCount: savedTask?.steps ? Object.keys(savedTask.steps).length : 0,
        });
      }
    }

    // Update DDT state
    try {
      replaceSelectedDDT(coerced);
    } catch (err) {
      info('RESPONSE_EDITOR', 'replaceSelectedDDT FAILED', { error: err });
    }

    // ✅ IMPORTANTE: Chiudi SEMPRE il wizard quando onComplete viene chiamato
    // Il wizard ha già assemblato il DDT, quindi non deve riaprirsi
    setShowWizard(false);

    setLeftPanelMode('actions'); // Force show TaskList (now in Tasks panel)

    // If parent provided onWizardComplete, notify it after updating UI
    if (onWizardComplete) {
      onWizardComplete(coerced);
    }
  }, [task, currentProjectId, setShowWizard, setLeftPanelMode, replaceSelectedDDT, onWizardComplete]);

  // ✅ Get initial DDT for wizard
  const getInitialDDT = useCallback((): TaskTree | undefined => {
    if (inferenceResult?.ai?.schema) {
      // ✅ Pre-compila con il risultato dell'inferenza
      return {
        id: taskTree?.id || `temp_taskTree_${task?.id}`,
        label: inferenceResult.ai.schema.label || task?.label || 'Data',
        nodes: inferenceResult.ai.schema.nodes || [],
        _inferenceResult: inferenceResult // Passa anche il risultato completo per riferimento (con traduzioni se disponibili)
      } as TaskTree;
    } else if (taskTree && taskTree.nodes && taskTree.nodes.length > 0) {
      // ✅ Se taskTree ha nodes (creato da categoria), passalo come initialDDT
      // Il wizard andrà direttamente a 'structure' e mostrerà "Build Messages"
      return {
        id: taskTree?.id || `temp_taskTree_${task?.id}`,
        label: taskTree?.label || task?.label || 'Data',
        nodes: taskTree.nodes,
        steps: taskTree.steps,  // ✅ Steps a root level
        constraints: taskTree.constraints,
        dataContract: taskTree.dataContract
      } as TaskTree;
    } else {
      return taskTree || undefined;
    }
  }, [inferenceResult, taskTree, task]);

  // ✅ Determine if should show inference loading
  const shouldShowInferenceLoading = (() => {
    const taskLabel = task?.label?.trim();
    const shouldHaveInference = taskLabel && taskLabel.length >= 3;
    return shouldHaveInference && !inferenceResult && isInferring;
  })();

  return {
    handleGenerateAll,
    handleContractWizardClose,
    handleContractWizardNodeUpdate,
    handleContractWizardComplete,
    handleDDTWizardCancel,
    handleDDTWizardComplete,
    getInitialDDT,
    shouldShowInferenceLoading,
  };
}
